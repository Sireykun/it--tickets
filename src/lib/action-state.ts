// Shape returned by every form action. `nonce` changes on success so forms can reset.
export type ActionState = { error?: string; ok?: boolean; nonce?: number };

export const initialActionState: ActionState = {};
