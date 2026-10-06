import { guestInputSchema, MAX_PARTY, normalizePhone, type GuestInput } from "./schema";

// Turning an uploaded spreadsheet into guests (PRD 5.5): a table of text cells goes in; for each
// row comes back what would be created, or what is wrong with it. Pure functions, so every rule
// is easy to test. Nothing here touches the database: the caller supplies the events and the
// phone numbers already in use.

export const MAX_IMPORT_ROWS = 1000;

export type ImportColumn = "name" | "phone" | "email" | "guestsAllowed" | "events";

// Header names are matched loosely (case, spaces and punctuation ignored), because people edit
// the template or bring their own sheet.
const HEADER_ALIASES: Record<ImportColumn, string[]> = {
  name: ["name", "guestname", "guest", "fullname", "family", "party", "partyname"],
  phone: ["phone", "phonenumber", "mobile", "mobilenumber", "whatsapp", "contact", "contactnumber"],
  email: ["email", "emailaddress", "mail"],
  guestsAllowed: [
    "guestsallowed",
    "allowed",
    "partysize",
    "numberofguests",
    "guests",
    "headcount",
    "maxguests",
    "peopleallowed",
  ],
  events: ["invitedevents", "events", "invitedto", "event", "eventsinvited"],
};

const simplify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const collapse = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

export type ImportRow = Record<ImportColumn, string> & { row: number };

export type ParsedTable = { rows: ImportRow[]; problem?: string };

export function parseImportTable(table: string[][]): ParsedTable {
  const header = table[0];
  if (!header || header.every((c) => !c.trim()))
    return { rows: [], problem: "The file is empty. Use the template to get started." };

  const columns = new Map<ImportColumn, number>();
  header.forEach((title, index) => {
    const key = simplify(title);
    for (const [column, aliases] of Object.entries(HEADER_ALIASES) as [ImportColumn, string[]][])
      if (!columns.has(column) && aliases.includes(key)) columns.set(column, index);
  });
  const missing = (["name", "guestsAllowed", "events"] as const).filter((c) => !columns.has(c));
  if (missing.length > 0) {
    const labels = { name: "Name", guestsAllowed: "Guests allowed", events: "Invited events" };
    return {
      rows: [],
      problem: `The first row needs these column titles: ${missing.map((c) => labels[c]).join(", ")}. Use the template to get the right layout.`,
    };
  }

  const rows: ImportRow[] = [];
  table.slice(1).forEach((cells, index) => {
    const pick = (column: ImportColumn) => {
      const at = columns.get(column);
      return at === undefined ? "" : (cells[at] ?? "").trim();
    };
    const row: ImportRow = {
      row: index + 2, // as numbered in the spreadsheet: the header is row 1
      name: pick("name"),
      phone: pick("phone"),
      email: pick("email"),
      guestsAllowed: pick("guestsAllowed"),
      events: pick("events"),
    };
    if (Object.values({ ...row, row: "" }).every((v) => !v)) return; // a blank line
    rows.push(row);
  });

  if (rows.length === 0) return { rows, problem: "There are no guests in this file yet." };
  if (rows.length > MAX_IMPORT_ROWS)
    return {
      rows: [],
      problem: `That is ${rows.length} rows. Import up to ${MAX_IMPORT_ROWS} at a time; split the file and import it in parts.`,
    };
  return { rows };
}

export type PreviewRow = {
  row: number;
  name: string;
  phone?: string;
  email?: string;
  guestsAllowed: string;
  eventNames: string[];
  // ok: will be created. duplicate: the phone number is already used, so it is skipped unless the
  // member chooses otherwise. error: cannot be imported until fixed in the file.
  status: "ok" | "duplicate" | "error";
  errors: string[];
  warnings: string[];
  input?: GuestInput;
};

const EVENT_SPLIT = /[,;|\n]/;

export function buildPreview(
  rows: ImportRow[],
  events: { id: string; name: string }[],
  phonesInUse: Map<string, string>,
): PreviewRow[] {
  const byName = new Map(events.map((e) => [collapse(e.name), e]));
  const seen = new Map<string, number>(); // phone -> first row in this file that used it

  return rows.map((raw) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Events: names matched without regard to case; "All" means every event.
    const wanted = raw.events.split(EVENT_SPLIT).map(collapse).filter(Boolean);
    const chosen = new Map<string, string>();
    const unknown: string[] = [];
    if (wanted.length === 1 && wanted[0] === "all")
      for (const e of events) chosen.set(e.id, e.name);
    else
      for (const name of wanted) {
        const found = byName.get(name);
        if (found) chosen.set(found.id, found.name);
        else
          unknown.push(
            raw.events
              .split(EVENT_SPLIT)
              .find((p) => collapse(p) === name)!
              .trim(),
          );
      }
    if (wanted.length === 0) errors.push("Choose at least one event.");
    if (unknown.length > 0)
      errors.push(
        `Unknown ${unknown.length === 1 ? "event" : "events"}: ${unknown.join(", ")}. Use the names from your Events page.`,
      );

    const count = /^\d+$/.test(raw.guestsAllowed) ? Number(raw.guestsAllowed) : NaN;
    if (!raw.guestsAllowed) errors.push("Enter how many guests are allowed.");
    else if (!(count >= 1 && count <= MAX_PARTY))
      errors.push(`Guests allowed must be a whole number from 1 to ${MAX_PARTY}.`);

    const parsed = guestInputSchema.safeParse({
      name: raw.name,
      phone: raw.phone,
      email: raw.email,
      guestsAllowed: raw.guestsAllowed,
      invitedEventIds: [...chosen.keys()],
    });
    if (!parsed.success)
      for (const issue of parsed.error.issues) {
        const message = issue.message;
        const field = issue.path[0];
        // Event and headcount problems are already described above in plainer words.
        if (field === "invitedEventIds" || field === "guestsAllowed") continue;
        if (!errors.includes(message)) errors.push(message);
      }

    const phone = raw.phone ? (normalizePhone(raw.phone) ?? undefined) : undefined;
    if (phone) {
      const owner = phonesInUse.get(phone);
      const earlier = seen.get(phone);
      if (owner) warnings.push(`${owner} already has this phone number.`);
      else if (earlier) warnings.push(`Same phone number as row ${earlier}.`);
      if (!seen.has(phone)) seen.set(phone, raw.row);
    }

    const status = errors.length > 0 ? "error" : warnings.length > 0 ? "duplicate" : "ok";
    return {
      row: raw.row,
      name: raw.name,
      phone,
      email: parsed.success ? parsed.data.email : undefined,
      guestsAllowed: raw.guestsAllowed,
      eventNames: [...chosen.values()],
      status,
      errors,
      warnings,
      input: errors.length === 0 && parsed.success ? parsed.data : undefined,
    };
  });
}

export type ImportSummary = { total: number; ok: number; duplicate: number; error: number };

export function summarize(rows: PreviewRow[]): ImportSummary {
  const count = (status: PreviewRow["status"]) => rows.filter((r) => r.status === status).length;
  return {
    total: rows.length,
    ok: count("ok"),
    duplicate: count("duplicate"),
    error: count("error"),
  };
}

// The rows that will be created: every clean row, plus (only if asked) rows whose phone number
// is already in use.
export function rowsToImport(rows: PreviewRow[], includeDuplicates: boolean): GuestInput[] {
  return rows.flatMap((r) =>
    r.input && (r.status === "ok" || (r.status === "duplicate" && includeDuplicates))
      ? [r.input]
      : [],
  );
}

// The downloadable template: the real header, and two example rows using this wedding's events.
export function templateRows(eventNames: string[]): string[][] {
  const first = eventNames[0] ?? "Wedding";
  const both = eventNames.slice(0, 2).join("; ") || "Wedding";
  return [
    ["Name", "Phone", "Email", "Guests allowed", "Invited events"],
    ["Rajesh Sharma", "98765 43210", "rajesh@example.com", "4", both],
    ["Meena Gupta", "", "", "2", first],
  ];
}
