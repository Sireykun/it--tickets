import { redirect } from "next/navigation";
import { isStaff, requireUser } from "@/server/authz";

// Post-login landing: staff go to the queue, everyone else to their tickets.
export default async function Go() {
  const user = await requireUser();
  redirect(isStaff(user.role) ? "/staff" : "/");
}
