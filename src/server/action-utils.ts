import type { ActionState } from "@/lib/action-state";
import { TicketError } from "@/server/tickets";

// Runs an action body, turning expected errors into a form message. Anything else
// (including Next's redirect/notFound signals) is rethrown untouched.
export async function runAction(fn: () => Promise<void | ActionState>): Promise<ActionState> {
  try {
    return (await fn()) ?? { ok: true, nonce: Date.now() };
  } catch (err) {
    if (err instanceof TicketError) return { error: err.message };
    throw err;
  }
}
