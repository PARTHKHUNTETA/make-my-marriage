import "server-only";
import { getCounter } from "@/modules/checkin/service";
import { listEvents } from "@/modules/events/service";
import { getStats } from "@/modules/guests/service";
import { summarize } from "@/modules/money/calc";
import {
  CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  PAYER_LABELS,
  type ExpenseItem,
} from "@/modules/money/schema";
import { getBudgetOverview, listEveryExpense } from "@/modules/money/service";
import { getPhotoBreakdown } from "@/modules/photos/service";
import { listTasks } from "@/modules/tasks/service";
import { getWedding } from "@/modules/wedding/service";
import { cumulativeByWeek, inRange } from "./calc";
import type { AnalyticsFilter, ChartData } from "./schema";

// Turns what the wedding already holds into the seven charts of PRD 5.16. Nothing is stored for
// analytics and nothing extra is entered: every number is worked out from the live data on each
// view. The filters are an event and/or a date range.

export type Analytics = {
  charts: ChartData[];
  events: { id: string; name: string }[];
  notes: string[];
};

export async function getAnalytics(
  weddingId: string,
  filter: AnalyticsFilter,
  currentMemberId: string,
): Promise<Analytics> {
  const range = { from: filter.from, to: filter.to };
  const allEvents = await listEvents(weddingId);
  const events = allEvents.filter(
    (e) => (!filter.eventId || e.id === filter.eventId) && inRange(e.date, range),
  );
  const filtered = Boolean(filter.eventId || filter.from || filter.to);
  const notes: string[] = [];

  const [wedding, everyExpense, stats, tasks, photos] = await Promise.all([
    getWedding(weddingId),
    listEveryExpense(weddingId),
    getStats(weddingId),
    listTasks(weddingId, { view: "all" }, currentMemberId),
    getPhotoBreakdown(
      weddingId,
      allEvents.map((e) => ({ id: e.id, name: e.name })),
    ),
  ]);

  // ---- money ----
  const expenses: ExpenseItem[] = everyExpense.filter(
    (e) => (!filter.eventId || e.eventId === filter.eventId) && inRange(e.date, range),
  );
  const summary = summarize(expenses);

  // Budgets belong to the whole wedding, so they are only compared when nothing narrows the view.
  const overview = !filtered
    ? await getBudgetOverview(
        weddingId,
        wedding?.overallBudget ?? null,
        allEvents.map((e) => ({ id: e.id, name: e.name })),
      )
    : null;
  const budgetByCategory = new Map(overview?.categories.map((c) => [c.key, c.budget]) ?? []);
  const categories = EXPENSE_CATEGORIES.filter(
    (c) => (summary.byCategory[c] ?? 0) > 0 || (budgetByCategory.get(c) ?? 0) > 0,
  );
  const hasBudgets = categories.some((c) => (budgetByCategory.get(c) ?? 0) > 0);
  if (filtered)
    notes.push("Budgets are for the whole wedding, so they are hidden while a filter is on.");

  const spendByCategory: ChartData = {
    id: "spending-by-category",
    title: "Spending by category",
    description: hasBudgets ? "Budget against what has been spent." : "What has been spent.",
    kind: "groupedBar",
    unit: "rupees",
    labels: categories.map((c) => CATEGORY_LABELS[c]),
    series: [
      ...(hasBudgets
        ? [{ name: "Budget", values: categories.map((c) => budgetByCategory.get(c) ?? 0) }]
        : []),
      { name: "Spent", values: categories.map((c) => summary.byCategory[c] ?? 0) },
    ],
  };

  const weekly = cumulativeByWeek(
    expenses.map((e) => ({ date: e.date, value: e.amount })),
    range,
  );
  if (weekly.truncated) notes.push("Spending over time shows the most recent two years.");
  const spendOverTime: ChartData = {
    id: "spending-over-time",
    title: "Spending over time",
    description: "Total spent so far, week by week.",
    kind: "line",
    unit: "rupees",
    labels: weekly.labels,
    series: [{ name: "Spent so far", values: weekly.values }],
  };

  const byPayer: ChartData = {
    id: "contribution-by-payer",
    title: "Contribution by payer",
    description: "How much each side has paid, with shared costs split as agreed.",
    kind: "bar",
    unit: "rupees",
    labels: [PAYER_LABELS.bride_family, PAYER_LABELS.groom_family, PAYER_LABELS.couple],
    series: [
      {
        name: "Paid",
        values: [
          summary.byPayer.bride_family,
          summary.byPayer.groom_family,
          summary.byPayer.couple,
        ],
      },
    ],
  };

  // ---- guests ----
  const perEvent = new Map(stats.perEvent.map((e) => [e.eventId, e]));
  const rsvp: ChartData = {
    id: "rsvp-by-event",
    title: "RSVP by event",
    description: "Invited parties who are attending, not attending, or yet to reply.",
    kind: "stackedBar",
    unit: "count",
    labels: events.map((e) => e.name),
    series: [
      { name: "Attending", values: events.map((e) => perEvent.get(e.id)?.attending ?? 0) },
      { name: "Not attending", values: events.map((e) => perEvent.get(e.id)?.notAttending ?? 0) },
      { name: "Pending", values: events.map((e) => perEvent.get(e.id)?.pending ?? 0) },
    ],
  };

  const counters = await Promise.all(events.map((e) => getCounter(weddingId, e.id)));
  const headcount: ChartData = {
    id: "headcount-by-event",
    title: "Headcount by event",
    description: "People expected (from replies) against people checked in at the venue.",
    kind: "groupedBar",
    unit: "count",
    labels: events.map((e) => e.name),
    series: [
      { name: "Expected", values: counters.map((c) => c.expected) },
      { name: "Checked in", values: counters.map((c) => c.arrived) },
    ],
  };

  // ---- tasks ----
  const done = tasks.filter(
    (t) =>
      t.status === "completed" &&
      t.completedAt &&
      (!filter.eventId || t.eventId === filter.eventId) &&
      inRange(t.completedAt, range),
  );
  const progress = cumulativeByWeek(
    done.map((t) => ({ date: t.completedAt!, value: 1 })),
    range,
  );
  const taskProgress: ChartData = {
    id: "task-progress",
    title: "Task progress",
    description: "Tasks completed so far, week by week.",
    kind: "line",
    unit: "count",
    labels: progress.labels,
    series: [{ name: "Completed", values: progress.values }],
  };

  // ---- photos ----
  const wanted = new Set(events.map((e) => e.id));
  const albums = photos.filter((a) => (a.eventId ? wanted.has(a.eventId) : !filtered));
  const photosByEvent: ChartData = {
    id: "photos-by-event",
    title: "Photos by event",
    description: "Approved photos in each album, from members and from guests.",
    kind: "stackedBar",
    unit: "count",
    labels: albums.map((a) => a.name),
    series: [
      { name: "Members", values: albums.map((a) => a.member) },
      { name: "Guests", values: albums.map((a) => a.guest) },
    ],
  };

  return {
    charts: [spendByCategory, spendOverTime, byPayer, rsvp, headcount, taskProgress, photosByEvent],
    events: allEvents.map((e) => ({ id: e.id, name: e.name })),
    notes,
  };
}
