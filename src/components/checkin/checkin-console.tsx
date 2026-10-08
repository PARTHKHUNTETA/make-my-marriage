"use client";

import * as React from "react";
import { Camera, CameraOff, CheckCircle2, CloudOff, Search, UserPlus } from "lucide-react";
import { FormAlert } from "@/components/auth/form-alert";
import { drop, enqueue, newKey, readQueue, subscribeToQueue } from "@/lib/offline-queue";
import {
  admitWalkInAction,
  checkInAction,
  counterAction,
  lookupEntryAction,
  searchPartiesAction,
  syncScansAction,
} from "@/modules/checkin/actions";
import type { Counter, EntryLookup, PartyMatch } from "@/modules/checkin/schema";

const time = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});
const small = "rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50";
const input =
  "h-11 w-full rounded-lg border border-line-soft/60 bg-white px-3 text-sm text-ink outline-none focus:border-plum focus:ring-1 focus:ring-plum";

type Notice = { tone: "ok" | "info" | "warn"; text: string } | null;

// What the gate sees. Scan a guest's code with the camera, type or paste it, or look the party up
// by name or phone. Everything works with a weak signal: a scan that cannot reach the server is
// kept on the phone and sent when the signal returns.
export function CheckInConsole({ eventId, initial }: { eventId: string; initial: Counter }) {
  const [counter, setCounter] = React.useState(initial);
  const [lookup, setLookup] = React.useState<EntryLookup | null>(null);
  const [count, setCount] = React.useState("");
  const [notice, setNotice] = React.useState<Notice>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [matches, setMatches] = React.useState<PartyMatch[] | null>(null);
  // How many scans are saved on this phone, and whether it has a signal: both read live.
  const waiting = React.useSyncExternalStore(
    subscribeToQueue,
    () => readQueue(eventId).length,
    () => 0,
  );
  const online = React.useSyncExternalStore(
    (listener) => {
      window.addEventListener("online", listener);
      window.addEventListener("offline", listener);
      return () => {
        window.removeEventListener("online", listener);
        window.removeEventListener("offline", listener);
      };
    },
    () => navigator.onLine,
    () => true,
  );
  const [walkIn, setWalkIn] = React.useState<{ name: string; guestId?: string } | null>(null);

  // ---- the counter and the offline queue ----

  const refreshCounter = React.useCallback(async () => {
    try {
      const result = await counterAction({ eventId });
      if (result.ok) setCounter(result.data);
    } catch {
      // No signal: keep showing the last figures.
    }
  }, [eventId]);

  const flush = React.useCallback(async () => {
    const queue = readQueue(eventId);
    if (queue.length === 0) return;
    try {
      const result = await syncScansAction({ eventId, scans: queue });
      if (!result.ok) return;
      // Whatever the server answered for (even "unknown"), it has seen: do not send it again.
      const done = result.data.filter((r) => r.outcome !== "error").map((r) => r.clientKey);
      drop(eventId, done);
      const added = result.data.filter((r) => r.outcome === "checked_in");
      if (added.length > 0)
        setNotice({
          tone: "ok",
          text: `${added.length} saved ${added.length === 1 ? "scan was" : "scans were"} sent: ${added.map((r) => r.name).join(", ")}.`,
        });
      void refreshCounter();
    } catch {
      // Still offline; try again later.
    }
  }, [eventId, refreshCounter]);

  React.useEffect(() => {
    // Send anything left from an earlier visit, a moment after the screen opens.
    const first = setTimeout(() => void flush(), 0);
    const tick = setInterval(() => {
      void refreshCounter();
      void flush();
    }, 15_000);
    // Send anything saved the moment the signal comes back.
    const up = () => void flush();
    window.addEventListener("online", up);
    return () => {
      clearTimeout(first);
      clearInterval(tick);
      window.removeEventListener("online", up);
    };
  }, [eventId, flush, refreshCounter]);

  // ---- handling one code ----

  const handleCode = React.useCallback(
    async (raw: string) => {
      const token = raw.trim();
      if (!token) return;
      setProblem(null);
      setNotice(null);
      setBusy(true);
      try {
        const result = await lookupEntryAction({ eventId, entryToken: token });
        if (!result.ok) {
          setProblem(result.error.message);
        } else {
          setLookup(result.data);
          if (result.data.kind === "party") {
            const p = result.data;
            setCount(String(p.numberAttending ?? p.guestsAllowed));
          }
        }
      } catch {
        // No signal: keep the scan on the phone to send later.
        enqueue(eventId, {
          entryToken: token,
          clientKey: newKey(),
          scannedAt: new Date().toISOString(),
        });
        setLookup(null);
        setNotice({
          tone: "info",
          text: "No signal. This scan is saved on your phone and will be sent when you are back online.",
        });
      }
      setBusy(false);
    },
    [eventId],
  );

  // ---- the camera ----

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = React.useState(false);
  const [cameraProblem, setCameraProblem] = React.useState<string | null>(null);
  const lastSeen = React.useRef<{ token: string; at: number }>({ token: "", at: 0 });
  const handle = React.useRef(handleCode);
  React.useEffect(() => {
    handle.current = handleCode;
  }, [handleCode]);

  React.useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | undefined;
    let frame = 0;
    let stopped = false;
    (async () => {
      try {
        const { default: jsQR } = await import("jsqr");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        // The scanner may have been closed while the camera was still starting. The cleanup below
        // ran before this stream existed, so release it here or the camera light stays on.
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        // Closed while the video was starting: the loop below must not begin.
        if (stopped) return;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        let last = 0;
        const loop = (now: number) => {
          if (stopped) return;
          frame = requestAnimationFrame(loop);
          if (now - last < 200 || video.readyState < 2 || !ctx) return; // about five looks a second
          last = now;
          const width = 480;
          const height = Math.round((video.videoHeight / video.videoWidth) * width) || 360;
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(video, 0, 0, width, height);
          const found = jsQR(ctx.getImageData(0, 0, width, height).data, width, height, {
            inversionAttempts: "dontInvert",
          });
          if (!found?.data) return;
          // The same code held in front of the camera is read once, not many times a second.
          if (found.data === lastSeen.current.token && Date.now() - lastSeen.current.at < 4000)
            return;
          lastSeen.current = { token: found.data, at: Date.now() };
          void handle.current(found.data);
        };
        frame = requestAnimationFrame(loop);
      } catch {
        if (stopped) return; // closed on purpose: nothing went wrong
        setCameraProblem(
          "We couldn't open the camera. Allow camera access in your browser, or type the code instead.",
        );
        setScanning(false);
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [scanning]);

  // ---- recording an arrival ----

  async function checkIn(guestId: string, arrived: string) {
    setBusy(true);
    setProblem(null);
    const result = await checkInAction({
      eventId,
      guestId,
      arrivedCount: arrived,
      clientKey: newKey(),
    });
    setBusy(false);
    if (!result.ok) {
      const details = result.error.details as Record<string, string[] | undefined> | undefined;
      setProblem(details?.arrivedCount?.[0] ?? result.error.message);
      return;
    }
    const r = result.data.record;
    setNotice(
      result.data.status === "already"
        ? {
            tone: "warn",
            text: `Already checked in at ${time.format(r.checkedInAt)}, ${r.arrivedCount} ${r.arrivedCount === 1 ? "person" : "people"}.`,
          }
        : {
            tone: "ok",
            text: `Checked in: ${r.arrivedCount} ${r.arrivedCount === 1 ? "person" : "people"}.`,
          },
    );
    setLookup(null);
    setMatches(null);
    setCode("");
    void refreshCounter();
  }

  async function admit(name: string, arrived: string, guestId?: string) {
    setBusy(true);
    setProblem(null);
    const result = await admitWalkInAction({
      eventId,
      name,
      arrivedCount: arrived,
      guestId,
      clientKey: newKey(),
    });
    setBusy(false);
    if (!result.ok) {
      const details = result.error.details as Record<string, string[] | undefined> | undefined;
      setProblem(details?.name?.[0] ?? details?.arrivedCount?.[0] ?? result.error.message);
      return;
    }
    const r = result.data.record;
    setNotice({
      tone: "ok",
      text: `${name} admitted as a walk-in: ${r.arrivedCount} ${r.arrivedCount === 1 ? "person" : "people"}.`,
    });
    setWalkIn(null);
    setLookup(null);
    setMatches(null);
    void refreshCounter();
  }

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setProblem(null);
    setNotice(null);
    setBusy(true);
    try {
      const result = await searchPartiesAction({ eventId, query });
      if (result.ok) setMatches(result.data);
      else
        setProblem(
          result.error.details
            ? ((result.error.details as Record<string, string[]>).query?.[0] ??
                result.error.message)
            : result.error.message,
        );
    } catch {
      setProblem("No signal. Searching needs a connection; scanning still works and is saved.");
    }
    setBusy(false);
  }

  const percent =
    counter.expected > 0
      ? Math.min(100, Math.round((counter.arrived / counter.expected) * 100))
      : 0;
  const tones = {
    ok: "border-forest/20 bg-forest/10 text-forest",
    info: "border-line bg-rose-50 text-ink",
    warn: "border-honey bg-honey/30 text-amber-deep",
  } as const;

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-label="Arrivals"
        className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)]"
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-serif text-4xl text-plum">
            {counter.arrived}{" "}
            <span className="font-sans text-base text-ink-2">of {counter.expected} expected</span>
          </p>
          <p className="text-[13px] text-ink-2">
            {counter.arrivedParties} {counter.arrivedParties === 1 ? "party" : "parties"} in
          </p>
        </div>
        <div
          role="progressbar"
          aria-label="Arrived"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-3 h-2 overflow-hidden rounded-full bg-rose-100"
        >
          <div className="h-full rounded-full bg-forest" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-xs text-ink-2">Updates every 15 seconds.</p>
      </section>

      {!online || waiting > 0 ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg border border-honey bg-honey/30 px-3.5 py-3 text-[13px] font-medium text-amber-deep"
        >
          <CloudOff className="size-4 shrink-0" aria-hidden />
          {!online ? "No signal. " : ""}
          {waiting > 0
            ? `${waiting} ${waiting === 1 ? "scan is" : "scans are"} saved on this phone and will be sent when you are back online.`
            : "Scans will be saved on this phone."}
        </p>
      ) : null}

      {notice ? (
        <p
          role="status"
          className={`flex items-start gap-2 rounded-lg border px-3.5 py-3 text-[14px] font-medium ${tones[notice.tone]}`}
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          {notice.text}
        </p>
      ) : null}
      {problem ? <FormAlert title="Couldn't do that">{problem}</FormAlert> : null}
      {cameraProblem ? <FormAlert title="Camera">{cameraProblem}</FormAlert> : null}

      <section className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
        <h2 className="font-serif text-xl text-ink">Scan a code</h2>
        <div className="mt-3 flex flex-col gap-3">
          <div className={scanning ? "overflow-hidden rounded-lg bg-black" : "hidden"}>
            <video ref={videoRef} muted playsInline className="aspect-[4/3] w-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <button
            type="button"
            onClick={() => {
              setCameraProblem(null);
              setScanning((s) => !s);
            }}
            className={`${small} inline-flex items-center justify-center gap-2 self-start bg-bronze text-white`}
          >
            {scanning ? (
              <CameraOff className="size-4" aria-hidden />
            ) : (
              <Camera className="size-4" aria-hidden />
            )}
            {scanning ? "Stop the camera" : "Scan with the camera"}
          </button>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleCode(code);
            }}
          >
            <label className="sr-only" htmlFor="entry-code">
              Entry code
            </label>
            <input
              id="entry-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Or type or paste the code"
              autoComplete="off"
              className={input}
            />
            <button
              type="submit"
              disabled={busy || !code.trim()}
              className={`${small} bg-rose-100 text-ink hover:bg-rose-200`}
            >
              Look up
            </button>
          </form>
        </div>
      </section>

      {lookup ? (
        <section
          aria-live="polite"
          className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)] ring-2 ring-plum"
        >
          {lookup.kind === "unknown" ? (
            <>
              <p className="font-serif text-xl text-destructive">Code not recognised</p>
              <p className="mt-1 text-[13px] text-ink-2">
                It is not one of this wedding&rsquo;s entry codes. Try searching by name.
              </p>
            </>
          ) : lookup.kind === "not_on_list" ? (
            <>
              <p className="font-serif text-xl text-destructive">Not on the list for this event</p>
              <p className="mt-1 text-[13px] text-ink-2">
                {lookup.name} is a guest, but this code is for a different event.
              </p>
              <button
                type="button"
                onClick={() => setWalkIn({ name: lookup.name, guestId: lookup.guestId })}
                className={`${small} mt-3 bg-bronze text-white`}
              >
                Admit as a walk-in
              </button>
            </>
          ) : (
            <>
              <p className="font-serif text-2xl text-ink">{lookup.name}</p>
              <p className="mt-1 text-[13px] text-ink-2">
                {lookup.status === "attending"
                  ? `Coming: ${lookup.numberAttending ?? lookup.guestsAllowed}`
                  : lookup.status === "pending"
                    ? "Has not replied"
                    : "Said they are not coming"}{" "}
                · Allowed {lookup.guestsAllowed}
                {lookup.table ? ` · Table ${lookup.table.replace(/^Table\s+/i, "")}` : ""}
              </p>
              {lookup.notes ? (
                <p className="mt-1 text-[13px] text-ink">Note: {lookup.notes}</p>
              ) : null}
              {lookup.checkedIn ? (
                <p className="mt-3 rounded-lg bg-honey/30 px-3 py-2 text-[14px] font-semibold text-amber-deep">
                  Already checked in at {time.format(lookup.checkedIn.at)}, {lookup.checkedIn.count}{" "}
                  {lookup.checkedIn.count === 1 ? "person" : "people"}
                </p>
              ) : (
                <form
                  className="mt-3 flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void checkIn(lookup.guestId, count);
                  }}
                >
                  <label className="flex flex-col gap-0.5 text-xs text-ink-2">
                    How many arrived?
                    <input
                      value={count}
                      onChange={(e) => setCount(e.target.value)}
                      inputMode="numeric"
                      className={`${input} w-28`}
                    />
                  </label>
                  {Number(count) > lookup.guestsAllowed ? (
                    <span className="basis-full text-xs text-bronze">
                      That is more than the {lookup.guestsAllowed} allowed.
                    </span>
                  ) : null}
                  <button
                    type="submit"
                    disabled={busy}
                    className={`${small} h-11 bg-forest px-5 text-sm text-white`}
                  >
                    {busy ? "Saving..." : "Check in"}
                  </button>
                </form>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => setLookup(null)}
            className={`${small} mt-3 text-ink-2 hover:bg-rose-100`}
          >
            Dismiss
          </button>
        </section>
      ) : null}

      <section className="rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)]">
        <h2 className="font-serif text-xl text-ink">No code? Find them</h2>
        <form onSubmit={search} className="mt-3 flex gap-2">
          <label className="sr-only" htmlFor="party-search">
            Name or phone
          </label>
          <input
            id="party-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or phone number"
            autoComplete="off"
            className={input}
          />
          <button
            type="submit"
            disabled={busy || query.trim().length < 2}
            className={`${small} inline-flex items-center gap-1.5 bg-rose-100 text-ink hover:bg-rose-200`}
          >
            <Search className="size-4" aria-hidden /> Search
          </button>
        </form>
        {matches ? (
          matches.length === 0 ? (
            <p className="mt-3 text-[13px] text-ink-2">
              No one found. You can admit them as a walk-in below.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {matches.map((m) => (
                <li key={m.guestId} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{m.name}</p>
                    <p className="text-[13px] text-ink-2">
                      {m.invited
                        ? `Allowed ${m.guestsAllowed}${m.numberAttending ? ` · coming ${m.numberAttending}` : ""}`
                        : "Not on the list for this event"}
                      {m.phone ? ` · ${m.phone}` : ""}
                    </p>
                  </div>
                  {m.checkedIn ? (
                    <span className="text-[13px] font-semibold text-amber-deep">
                      In at {time.format(m.checkedIn.at)} ({m.checkedIn.count})
                    </span>
                  ) : m.invited ? (
                    <button
                      type="button"
                      onClick={() =>
                        void checkIn(m.guestId, String(m.numberAttending ?? m.guestsAllowed))
                      }
                      disabled={busy}
                      className={`${small} bg-forest text-white`}
                    >
                      Check in {m.numberAttending ?? m.guestsAllowed}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setWalkIn({ name: m.name, guestId: m.guestId })}
                      className={`${small} bg-bronze text-white`}
                    >
                      Admit as walk-in
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )
        ) : null}
        <button
          type="button"
          onClick={() => setWalkIn({ name: "" })}
          className={`${small} mt-3 inline-flex items-center gap-1.5 text-bronze hover:bg-rose-100`}
        >
          <UserPlus className="size-4" aria-hidden /> Admit a walk-in
        </button>
      </section>

      {walkIn ? (
        <WalkInForm
          key={walkIn.guestId ?? "new"}
          initial={walkIn}
          busy={busy}
          onAdmit={admit}
          onCancel={() => setWalkIn(null)}
        />
      ) : null}
    </div>
  );
}

function WalkInForm({
  initial,
  busy,
  onAdmit,
  onCancel,
}: {
  initial: { name: string; guestId?: string };
  busy: boolean;
  onAdmit: (name: string, count: string, guestId?: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = React.useState(initial.name);
  const [count, setCount] = React.useState("1");
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(35,31,32,0.04)] ring-2 ring-bronze"
      onSubmit={(e) => {
        e.preventDefault();
        void onAdmit(name, count, initial.guestId);
      }}
    >
      <p className="basis-full font-serif text-xl text-ink">Admit a walk-in</p>
      <label className="flex min-w-48 flex-1 flex-col gap-0.5 text-xs text-ink-2">
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          readOnly={Boolean(initial.guestId)}
          className={input}
        />
      </label>
      <label className="flex flex-col gap-0.5 text-xs text-ink-2">
        How many?
        <input
          value={count}
          onChange={(e) => setCount(e.target.value)}
          inputMode="numeric"
          className={`${input} w-24`}
        />
      </label>
      <button
        type="submit"
        disabled={busy || !name.trim()}
        className={`${small} h-11 bg-bronze px-5 text-sm text-white`}
      >
        {busy ? "Saving..." : "Admit"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className={`${small} h-11 text-ink-2 hover:bg-rose-100`}
      >
        Cancel
      </button>
    </form>
  );
}
