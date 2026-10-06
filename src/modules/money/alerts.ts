import "server-only";
import { listEvents } from "@/modules/events/service";
import { notifyMembers } from "@/modules/notifications/service";
import { getWedding } from "@/modules/wedding/service";
import { getBudgetOverview } from "./service";

// Tells every member when spending passes 90% or 100% of a budget (PRD 5.7). Each budget line and
// threshold is announced once: the alert's key names the line, the threshold and the budget amount,
// so raising a budget and then passing the new one alerts again, but re-saving does not.
export async function checkBudgetAlerts(weddingId: string): Promise<void> {
  try {
    const wedding = await getWedding(weddingId);
    if (!wedding) return;
    const events = (await listEvents(weddingId)).map((e) => ({ id: e.id, name: e.name }));
    const overview = await getBudgetOverview(weddingId, wedding.overallBudget ?? null, events);
    const rows = [
      { scope: "overall", row: overview.overall },
      ...overview.categories.map((row) => ({ scope: "category", row })),
      ...overview.events.map((row) => ({ scope: "event", row })),
    ];
    for (const { scope, row } of rows) {
      if (row.budget === null || row.budget <= 0 || row.percentUsed === null) continue;
      const level = row.percentUsed >= 100 ? 100 : row.percentUsed >= 90 ? 90 : 0;
      if (level === 0) continue;
      await notifyMembers(weddingId, {
        type: "budget_alert",
        message:
          level === 100
            ? `Spending has passed the ${row.label} budget.`
            : `Spending has passed 90% of the ${row.label} budget.`,
        link: "/money/budget",
        dedupeKey: `budget:${scope}:${row.key}:${level}:${row.budget}`,
      });
    }
  } catch (err) {
    console.error("budget alert failed", err instanceof Error ? err.name : "unknown");
  }
}
