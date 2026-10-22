import { UserPlus, X } from "lucide-react";
import { Card } from "@/components/ui/misc";
import type { ActionState } from "@/lib/action-state";
import { AddCcForm } from "./add-cc-form";

type Person = { id: string; name: string; email: string };

// People CC'd on a ticket. Shown to staff and to the requester/CCs in the portal.
export function CcPanel({
  collaborators,
  viewerId,
  canManage,
  addAction,
  removeAction,
  askName,
  hint,
}: {
  collaborators: { user: Person }[];
  viewerId: string;
  canManage: boolean; // staff or the requester
  addAction?: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  removeAction: (userId: string) => Promise<void>;
  askName: boolean; // staff may add brand-new people and should name them
  hint?: string;
}) {
  return (
    <Card className="space-y-3 p-4 text-sm" aria-labelledby="cc-heading">
      <h2 id="cc-heading" className="flex items-center gap-1.5 font-bold">
        <UserPlus className="size-4" aria-hidden /> CC
      </h2>
      {collaborators.length === 0 ? (
        <p className="text-muted">Nobody else is on this ticket.</p>
      ) : (
        <ul className="space-y-1">
          {collaborators.map(({ user }) => (
            <li key={user.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{user.name}</span>
                <span className="block truncate text-muted">{user.email}</span>
              </span>
              {(canManage || user.id === viewerId) && (
                <form action={removeAction.bind(null, user.id)}>
                  <button
                    type="submit"
                    className="grid size-11 place-items-center rounded-lg text-muted hover:bg-surface-2"
                    aria-label={user.id === viewerId ? "Leave this ticket" : `Remove ${user.name} from CC`}
                    title={user.id === viewerId ? "Leave" : "Remove"}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && addAction && <AddCcForm action={addAction} askName={askName} hint={hint} />}
    </Card>
  );
}
