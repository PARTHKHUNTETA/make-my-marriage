"use server";

import { revalidatePath } from "next/cache";
import { safeAction } from "@/lib/action";
import { recordAudit } from "@/lib/audit";
import { requirePlatform } from "@/lib/authz";
import { setStaffRoles } from "@/modules/members/service";
import { staffRolesSchema } from "./schema";

// The Make My Marriage team's own roles. Only someone who may manage staff (a super admin).
export async function setStaffRolesAction(input: unknown) {
  return safeAction(async () => {
    const staff = await requirePlatform("staff.manage");
    const { email, roles } = staffRolesSchema.parse(input);
    const { before } = await setStaffRoles({ actorUserId: staff.userId, email, roles });
    await recordAudit({
      actorUserId: staff.userId,
      action: "staff.roles",
      target: email,
      before: { roles: before },
      after: { roles },
    });
    revalidatePath("/staff/team");
    return {};
  });
}
