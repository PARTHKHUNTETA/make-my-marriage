"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import {
  getNotificationsAction,
  getVendorNotificationsAction,
  markAllNotificationsReadAction,
  markAllVendorNotificationsReadAction,
  markNotificationReadAction,
  markVendorNotificationReadAction,
} from "@/modules/notifications/actions";
import type { NotificationItem } from "@/modules/notifications/schema";

const POLL_MS = 60_000;

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

// The bell in the top bar. The count and list refresh every minute and when the page opens; there
// is no live connection (PRD 5.15).
export function NotificationBell({ kind = "member" }: { kind?: "member" | "vendor" }) {
  const router = useRouter();
  const api =
    kind === "member"
      ? {
          list: getNotificationsAction,
          one: markNotificationReadAction,
          all: markAllNotificationsReadAction,
        }
      : {
          list: getVendorNotificationsAction,
          one: markVendorNotificationReadAction,
          all: markAllVendorNotificationsReadAction,
        };
  const [open, setOpen] = React.useState(false);
  const [unread, setUnread] = React.useState(0);
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const box = React.useRef<HTMLDivElement>(null);

  const refresh = React.useCallback(async () => {
    const r = await (kind === "member" ? getNotificationsAction() : getVendorNotificationsAction());
    if (r.ok) {
      setUnread(r.data.unread);
      setItems(r.data.items);
    }
  }, [kind]);

  React.useEffect(() => {
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refresh]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function openItem(n: NotificationItem) {
    setOpen(false);
    if (!n.read) {
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read: true } : i)));
      setUnread((u) => Math.max(0, u - 1));
      await api.one({ id: n.id });
    }
    if (n.link) router.push(n.link);
  }

  async function readAll() {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    setUnread(0);
    await api.all();
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) void refresh();
        }}
        className="relative p-1 text-ink-2 transition-colors hover:text-ink"
      >
        <Bell className="size-5" />
        {unread > 0 ? (
          <span className="absolute -top-0.5 -right-1 flex min-w-4 items-center justify-center rounded-full bg-bronze px-1 text-[10px] leading-4 font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-line"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            <button
              type="button"
              onClick={readAll}
              disabled={unread === 0}
              className="text-xs font-semibold text-bronze hover:underline disabled:opacity-40"
            >
              Mark all as read
            </button>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-ink-2">Nothing yet.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className="border-b border-line last:border-0">
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={`flex w-full gap-2.5 px-4 py-3 text-left hover:bg-rose-50 ${n.read ? "" : "bg-rose-50/60"}`}
                  >
                    <span
                      aria-hidden
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-bronze"}`}
                    />
                    <span className="min-w-0">
                      <span
                        className={`block text-[13px] text-ink ${n.read ? "" : "font-semibold"}`}
                      >
                        {n.message}
                      </span>
                      <span className="block text-[11px] text-ink-2">{ago(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
