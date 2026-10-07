import "server-only";
import { toIstYmd } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { listEvents } from "@/modules/events/service";
import { listGuests } from "@/modules/guests/service";
import { CATEGORY_LABELS } from "@/modules/money/schema";
import { listEveryExpense } from "@/modules/money/service";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/modules/tasks/schema";
import { listTasks } from "@/modules/tasks/service";
import { VENDOR_CATEGORY_LABELS } from "@/modules/vendors/schema";
import { listVendors } from "@/modules/vendors/service";
import { PER_KIND, type SearchHit } from "./schema";

// Finds things across one wedding for the search box (⌘K). It only ever uses the wedding of the
// signed-in member, and each source is the module that owns that data, so permissions and scoping
// are exactly the ones those pages already have. Plain, case-insensitive matching on the words people
// remember: names, titles, venues, phone numbers.

const norm = (s: string | undefined) => (s ?? "").toLowerCase();
const has = (q: string, ...fields: Array<string | undefined>) =>
  fields.some((f) => norm(f).includes(q));

export async function searchWedding(
  weddingId: string,
  memberId: string,
  query: string,
): Promise<SearchHit[]> {
  const q = norm(query);
  const [guests, events, tasks, vendors, expenses] = await Promise.all([
    listGuests(weddingId, { search: query, page: 1 }),
    listEvents(weddingId),
    listTasks(weddingId, { view: "all" }, memberId),
    listVendors(weddingId),
    listEveryExpense(weddingId),
  ]);

  const hits: SearchHit[] = [];
  for (const g of guests.items.slice(0, PER_KIND))
    hits.push({
      kind: "guest",
      id: g.id,
      title: g.name,
      subtitle: [g.phone, g.email].filter(Boolean).join(" · ") || undefined,
      href: `/guests/${g.id}`,
    });
  for (const e of events
    .filter((e) => has(q, e.name, e.venueName, e.address, e.dressCode))
    .slice(0, PER_KIND))
    hits.push({
      kind: "event",
      id: e.id,
      title: e.name,
      subtitle: [toIstYmd(e.date), e.venueName].filter(Boolean).join(" · "),
      href: `/events/${e.id}`,
    });
  for (const t of tasks.filter((t) => has(q, t.title, t.description)).slice(0, PER_KIND))
    hits.push({
      kind: "task",
      id: t.id,
      title: t.title,
      subtitle: `${STATUS_LABELS[t.status]} · ${PRIORITY_LABELS[t.priority]} priority`,
      href: `/tasks/${t.id}`,
    });
  for (const { vendor: v } of vendors
    .filter(({ vendor: v }) => has(q, v.name, v.phone, v.email, VENDOR_CATEGORY_LABELS[v.category]))
    .slice(0, PER_KIND))
    hits.push({
      kind: "vendor",
      id: v.id,
      title: v.name,
      subtitle: VENDOR_CATEGORY_LABELS[v.category],
      href: `/vendors/${v.id}`,
    });
  for (const x of expenses.filter((x) => has(q, x.title, x.notes)).slice(0, PER_KIND))
    hits.push({
      kind: "expense",
      id: x.id,
      title: x.title,
      subtitle: `${formatRupees(x.amount)} · ${CATEGORY_LABELS[x.category]}`,
      href: `/money/${x.id}`,
    });
  return hits;
}
