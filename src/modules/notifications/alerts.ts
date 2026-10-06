import "server-only";
import { formatRupees } from "@/lib/money";
import { listTasksForAlerts } from "@/modules/tasks/service";
import { listPaymentsForAlerts } from "@/modules/vendors/service";
import { notifyMembers } from "./service";

// The daily alerts (PRD 5.15): a task due today or tomorrow, or overdue, tells its assignee; an
// installment due within 3 days, or overdue, tells every member. Each is sent once per item and
// stage (the key names it), so running the job twice, or a late run, never repeats an alert.
export async function runDailyAlerts(
  now: Date = new Date(),
  // Limits the run to these weddings (used by tests); normally every wedding.
  only?: string[],
): Promise<{ tasks: number; payments: number }> {
  const keep = <T extends { weddingId: string }>(rows: T[]) =>
    only ? rows.filter((r) => only.includes(r.weddingId)) : rows;
  const [tasks, payments] = await Promise.all([
    listTasksForAlerts(now).then(keep),
    listPaymentsForAlerts(now).then(keep),
  ]);

  for (const t of tasks) {
    const overdue = t.daysLeft < 0;
    await notifyMembers(t.weddingId, {
      type: "task_due",
      message: overdue
        ? `Overdue: ${t.title}`
        : `Due ${t.daysLeft === 0 ? "today" : "tomorrow"}: ${t.title}`,
      link: "/tasks",
      audience: { memberId: t.memberId },
      dedupeKey: `task:${t.taskId}:${overdue ? "overdue" : "soon"}`,
    });
  }
  for (const p of payments) {
    const overdue = p.daysLeft < 0;
    await notifyMembers(p.weddingId, {
      type: "payment_due",
      message: overdue
        ? `Overdue payment: ${formatRupees(p.amount)} to ${p.vendorName} (${p.label}).`
        : `Payment due ${p.daysLeft === 0 ? "today" : p.daysLeft === 1 ? "tomorrow" : `in ${p.daysLeft} days`}: ${formatRupees(p.amount)} to ${p.vendorName} (${p.label}).`,
      link: "/money/payments",
      dedupeKey: `payment:${p.installmentId}:${overdue ? "overdue" : "soon"}`,
    });
  }
  return { tasks: tasks.length, payments: payments.length };
}
