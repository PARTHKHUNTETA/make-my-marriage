"use server";

import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/action";
import { requireMember } from "@/lib/authz";
import { consumeRateLimit, subjectKey } from "@/lib/ratelimit";
import {
  checkInSchema,
  eventOnlySchema,
  lookupSchema,
  searchSchema,
  syncSchema,
  walkInSchema,
} from "./schema";
import {
  admitWalkIn,
  checkInParty,
  getCounter,
  lookupEntry,
  searchParties,
  syncScans,
} from "./service";

// Server Actions for check-in at the venue. Open to Admins and Managers (gate volunteers are
// Managers). The wedding and the member always come from the signed-in session.

// Generous, since a busy gate scans many codes, but a limit all the same: it stops anyone who
// somehow holds a session from trying codes in bulk.
async function limit(memberId: string) {
  await consumeRateLimit("checkin", subjectKey("member", memberId), {
    limit: 1500,
    windowSeconds: 15 * 60,
  });
}

const refresh = () => revalidatePath("/guests/checkin");

export async function lookupEntryAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    await limit(ctx.memberId);
    const { eventId, entryToken } = lookupSchema.parse(input);
    return lookupEntry(ctx.weddingId, eventId, entryToken);
  });
}

export async function searchPartiesAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    await limit(ctx.memberId);
    const { eventId, query } = searchSchema.parse(input);
    return searchParties(ctx.weddingId, eventId, query);
  });
}

export async function checkInAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    await limit(ctx.memberId);
    const outcome = await checkInParty(ctx.weddingId, ctx.memberId, checkInSchema.parse(input));
    refresh();
    return outcome;
  });
}

export async function admitWalkInAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    await limit(ctx.memberId);
    const outcome = await admitWalkIn(ctx.weddingId, ctx.memberId, walkInSchema.parse(input));
    refresh();
    return outcome;
  });
}

export async function syncScansAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    await limit(ctx.memberId);
    const { eventId, scans } = syncSchema.parse(input);
    const results = await syncScans(ctx.weddingId, ctx.memberId, eventId, scans);
    refresh();
    return results;
  });
}

export async function counterAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireMember();
    return getCounter(ctx.weddingId, eventOnlySchema.parse(input).eventId);
  });
}
