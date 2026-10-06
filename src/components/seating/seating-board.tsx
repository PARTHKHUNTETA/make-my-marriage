"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import { FormAlert } from "@/components/auth/form-alert";
import { Select } from "@/components/ui/select";
import {
  assignPartyAction,
  createTableAction,
  deleteTableAction,
  moveSeatedPartyAction,
  setShowTableAction,
  unassignPartyAction,
  updateTableAction,
} from "@/modules/seating/actions";
import type { PlannedTable, SeatingPlan, Unseated } from "@/modules/seating/schema";

type Result = { ok: true } | { ok: false; error: { message: string; details?: unknown } };
const small = "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50";
const input =
  "h-9 rounded-lg border border-line-soft/60 bg-white px-3 text-[13px] text-ink outline-none focus:border-plum focus:ring-1 focus:ring-plum";

type Drag = { guestId: string; fromTableId?: string; seats?: number };

// The seating plan for one event (PRD 5.13). On a computer, parties can be dragged onto tables;
// everything can also be done with the pickers, which is how it works on a phone.
export function SeatingBoard({
  eventId,
  plan,
  showTable,
}: {
  eventId: string;
  plan: SeatingPlan;
  showTable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<string | null>(null);

  async function run(action: () => Promise<Result>): Promise<boolean> {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (result.ok) {
      router.refresh();
      return true;
    }
    const details = result.error.details as Record<string, string[] | undefined> | undefined;
    setError(
      details?.seats?.[0] ? result.error.message : (details?.name?.[0] ?? result.error.message),
    );
    return false;
  }

  function onDrop(event: React.DragEvent, tableId: string) {
    event.preventDefault();
    setOver(null);
    let drag: Drag;
    try {
      drag = JSON.parse(event.dataTransfer.getData("application/json")) as Drag;
    } catch {
      return;
    }
    if (drag.fromTableId === tableId) return;
    void run(() =>
      drag.fromTableId
        ? moveSeatedPartyAction({
            guestId: drag.guestId,
            fromTableId: drag.fromTableId,
            toTableId: tableId,
          })
        : assignPartyAction({ tableId, guestId: drag.guestId, seats: drag.seats }),
    );
  }

  const placeable: Unseated[] = [...plan.unseated, ...plan.awaitingReply];

  return (
    <div className="flex flex-col gap-6">
      {error ? <FormAlert title="Couldn't do that">{error}</FormAlert> : null}

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Totals">
        {[
          ["Seats at your tables", plan.totalSeats],
          ["People seated", plan.seatedPeople],
          ["People still to seat", plan.unseated.reduce((s, u) => s + u.remaining, 0)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(35,31,32,0.04)]"
          >
            <p className="font-serif text-3xl text-plum">{value}</p>
            <p className="text-[13px] text-ink-2">{label}</p>
          </div>
        ))}
      </section>

      <label className="flex items-start gap-3 text-sm text-ink">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-plum"
          checked={showTable}
          disabled={busy}
          onChange={(e) => void run(() => setShowTableAction({ eventId, on: e.target.checked }))}
        />
        <span>
          Show guests their table on their invitation page
          <span className="block text-xs text-ink-2">
            Off until you switch it on. Only parties who have said they are coming see it.
          </span>
        </span>
      </label>

      {plan.unseated.length > 0 ? (
        <section
          className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)]"
          aria-labelledby="unseated"
        >
          <h2 id="unseated" className="font-serif text-xl text-ink">
            Still to seat{" "}
            <span className="font-sans text-sm text-ink-2">({plan.unseated.length})</span>
          </h2>
          <p className="mt-1 text-[13px] text-ink-2">
            Drag a party onto a table, or use the table&rsquo;s picker.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {plan.unseated.map((u) => (
              <PartyChip key={u.party.id} u={u} />
            ))}
          </ul>
        </section>
      ) : plan.tables.length > 0 ? (
        <p className="rounded-xl bg-forest/10 px-4 py-3 text-[13px] font-medium text-forest">
          Everyone who is coming has a seat.
        </p>
      ) : null}

      {plan.tables.length === 0 ? (
        <p className="rounded-xl bg-white p-8 text-center text-sm text-ink-2 shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
          No tables yet. Add your first table below, for example &ldquo;Table 1&rdquo; with 10
          seats.
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {plan.tables.map((t) => (
            <li
              key={t.table.id}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(t.table.id);
              }}
              onDragLeave={() => setOver((cur) => (cur === t.table.id ? null : cur))}
              onDrop={(e) => onDrop(e, t.table.id)}
              className={`rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(35,31,32,0.04)] ${
                t.over ? "ring-2 ring-destructive" : over === t.table.id ? "ring-2 ring-plum" : ""
              }`}
            >
              <TableCard
                t={t}
                others={plan.tables.filter((o) => o.table.id !== t.table.id)}
                placeable={placeable}
                busy={busy}
                run={run}
              />
            </li>
          ))}
        </ul>
      )}

      <AddTable eventId={eventId} busy={busy} run={run} />

      {plan.awaitingReply.length > 0 ? (
        <section className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
          <h2 className="font-serif text-xl text-ink">
            Haven&rsquo;t replied yet{" "}
            <span className="font-sans text-sm text-ink-2">({plan.awaitingReply.length})</span>
          </h2>
          <p className="mt-1 text-[13px] text-ink-2">
            They can be seated now, using the number they were invited with.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {plan.awaitingReply.map((u) => (
              <PartyChip key={u.party.id} u={u} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function PartyChip({ u }: { u: Unseated }) {
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          "application/json",
          JSON.stringify({ guestId: u.party.id, seats: u.remaining }),
        );
        e.dataTransfer.effectAllowed = "move";
      }}
      className="flex cursor-grab items-center gap-1.5 rounded-full bg-rose-100 py-1.5 pr-3 pl-2 text-[13px] text-ink active:cursor-grabbing"
    >
      <GripVertical className="size-3.5 text-ink-2" aria-hidden />
      <span className="font-semibold">{u.party.name}</span>
      <span className="text-ink-2">
        {u.remaining === u.need ? u.need : `${u.remaining} of ${u.need}`}
      </span>
    </li>
  );
}

function TableCard({
  t,
  others,
  placeable,
  busy,
  run,
}: {
  t: PlannedTable;
  others: PlannedTable[];
  placeable: Unseated[];
  busy: boolean;
  run: (action: () => Promise<Result>) => Promise<boolean>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(t.table.name);
  const [capacity, setCapacity] = React.useState(String(t.table.capacity));
  const [pick, setPick] = React.useState("");
  const [seats, setSeats] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const chosen = placeable.find((u) => u.party.id === pick);

  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        {editing ? (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run(() => updateTableAction({ tableId: t.table.id, name, capacity })))
                setEditing(false);
            }}
          >
            <input
              aria-label="Table name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${input} w-32`}
            />
            <input
              aria-label="Seats"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              inputMode="numeric"
              className={`${input} w-20`}
            />
            <button type="submit" disabled={busy} className={`${small} bg-bronze text-white`}>
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className={`${small} text-ink-2 hover:bg-rose-100`}
            >
              Cancel
            </button>
          </form>
        ) : (
          <div>
            <h3 className="font-serif text-xl text-ink">{t.table.name}</h3>
            <p
              className={`text-[13px] ${t.over ? "font-semibold text-destructive" : "text-ink-2"}`}
            >
              {t.over ? (
                <span className="inline-flex items-center gap-1">
                  <TriangleAlert className="size-3.5" aria-hidden /> {t.used} seated, {-t.free} over
                  capacity of {t.table.capacity}
                </span>
              ) : (
                `${t.used} of ${t.table.capacity} seats used · ${t.free} free`
              )}
            </p>
          </div>
        )}
        {editing ? null : (
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className={`${small} bg-rose-100 text-ink hover:bg-rose-200`}
            >
              Edit
            </button>
            <button
              type="button"
              aria-label={`Delete ${t.table.name}`}
              onClick={() => setConfirmDelete(true)}
              className={`${small} text-destructive hover:bg-destructive/10`}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          </div>
        )}
      </div>

      {confirmDelete ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-destructive/5 p-3 text-[13px] text-ink-2">
          Delete this table? Its {t.seated.length} {t.seated.length === 1 ? "party" : "parties"}{" "}
          become unseated.
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => deleteTableAction({ tableId: t.table.id }))}
            className={`${small} bg-destructive text-white`}
          >
            Delete table
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className={`${small} hover:bg-rose-100`}
          >
            Keep it
          </button>
        </div>
      ) : null}

      {t.seated.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-line px-3 py-4 text-center text-[13px] text-ink-2">
          Drop a party here
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {t.seated.map((s) => (
            <li
              key={s.party.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "application/json",
                  JSON.stringify({ guestId: s.party.id, fromTableId: t.table.id, seats: s.seats }),
                );
                e.dataTransfer.effectAllowed = "move";
              }}
              className="flex flex-wrap items-center gap-2 py-2 text-[13px]"
            >
              <GripVertical className="size-3.5 shrink-0 cursor-grab text-ink-2" aria-hidden />
              <span className="min-w-0 flex-1 font-semibold text-ink">
                {s.party.name}
                {s.notAttending ? (
                  <span className="ml-2 font-normal text-destructive">not coming</span>
                ) : null}
                {s.tooMany ? (
                  <span className="ml-2 font-normal text-bronze">more seats than needed</span>
                ) : null}
              </span>
              <span className="text-ink-2">{s.seats}</span>
              {others.length > 0 ? (
                <Select
                  aria-label={`Move ${s.party.name} to another table`}
                  value=""
                  disabled={busy}
                  onChange={(e) =>
                    e.target.value
                      ? void run(() =>
                          moveSeatedPartyAction({
                            guestId: s.party.id,
                            fromTableId: t.table.id,
                            toTableId: e.target.value,
                          }),
                        )
                      : undefined
                  }
                  className="h-8 w-auto text-xs"
                >
                  <option value="">Move to…</option>
                  {others.map((o) => (
                    <option key={o.table.id} value={o.table.id}>
                      {o.table.name}
                    </option>
                  ))}
                </Select>
              ) : null}
              <button
                type="button"
                aria-label={`Take ${s.party.name} off ${t.table.name}`}
                disabled={busy}
                onClick={() =>
                  void run(() => unassignPartyAction({ tableId: t.table.id, guestId: s.party.id }))
                }
                className="rounded p-1 text-ink-2 hover:bg-rose-100"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {placeable.length > 0 ? (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!chosen) return;
            if (
              await run(() =>
                assignPartyAction({
                  tableId: t.table.id,
                  guestId: chosen.party.id,
                  seats: seats || chosen.remaining,
                }),
              )
            ) {
              setPick("");
              setSeats("");
            }
          }}
        >
          <Select
            aria-label={`Add a party to ${t.table.name}`}
            value={pick}
            onChange={(e) => {
              setPick(e.target.value);
              setSeats("");
            }}
            className="h-9 w-auto min-w-40 text-[13px]"
          >
            <option value="">Add a party…</option>
            {placeable.map((u) => (
              <option key={u.party.id} value={u.party.id}>
                {u.party.name} ({u.remaining})
              </option>
            ))}
          </Select>
          {chosen ? (
            <>
              <label className="sr-only" htmlFor={`seats-${t.table.id}`}>
                Seats
              </label>
              <input
                id={`seats-${t.table.id}`}
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                inputMode="numeric"
                placeholder={String(chosen.remaining)}
                className={`${input} w-16`}
              />
              <button type="submit" disabled={busy} className={`${small} bg-bronze text-white`}>
                Seat
              </button>
            </>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

function AddTable({
  eventId,
  busy,
  run,
}: {
  eventId: string;
  busy: boolean;
  run: (action: () => Promise<Result>) => Promise<boolean>;
}) {
  const [name, setName] = React.useState("");
  const [capacity, setCapacity] = React.useState("10");
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(35,31,32,0.04)]"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run(() => createTableAction({ eventId, name, capacity }))) setName("");
      }}
    >
      <label className="flex flex-col gap-0.5 text-xs text-ink-2">
        Table name or number
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Table 1"
          className={`${input} w-40`}
        />
      </label>
      <label className="flex flex-col gap-0.5 text-xs text-ink-2">
        Seats
        <input
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          inputMode="numeric"
          className={`${input} w-20`}
        />
      </label>
      <button
        type="submit"
        disabled={busy || !name.trim()}
        className={`${small} inline-flex items-center gap-1.5 bg-bronze text-white`}
      >
        <Plus className="size-3.5" aria-hidden /> Add table
      </button>
    </form>
  );
}
