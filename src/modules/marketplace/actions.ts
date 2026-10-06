"use server";

import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/action";
import { requireStaff, requireVendor } from "@/lib/authz";
import { listingInputSchema, pauseSchema, staffDecisionSchema } from "./schema";
import { decideListing, saveMyListing, setListingPaused } from "./service";

// Server Actions for the marketplace: the vendor portal (vendor session only) and the internal
// admin (staff only). The vendor account always comes from the signed-in vendor's session, never
// from the input, so a vendor can only ever change their own listing.

const refresh = () => revalidatePath("/", "layout");

export async function saveListingAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireVendor();
    const listing = await saveMyListing(ctx.vendorAccountId, listingInputSchema.parse(input));
    refresh();
    return { status: listing.status };
  });
}

export async function pauseListingAction(input: unknown) {
  return safeAction(async () => {
    const ctx = await requireVendor();
    const { paused } = pauseSchema.parse(input);
    const listing = await setListingPaused(ctx.vendorAccountId, paused);
    refresh();
    return { status: listing.status };
  });
}

export async function decideListingAction(input: unknown) {
  return safeAction(async () => {
    await requireStaff();
    const { listingId, decision, note } = staffDecisionSchema.parse(input);
    const listing = await decideListing(listingId, decision, note);
    refresh();
    return { status: listing.status };
  });
}
