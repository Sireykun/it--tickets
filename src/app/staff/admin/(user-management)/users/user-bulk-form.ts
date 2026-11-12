// Kept out of the "use client" bar: a server component importing a plain value from a client module
// gets a client reference instead of the object, which left the row checkboxes without `form`/`name`.
export const USER_BULK_FORM = { id: "user-bulk-form", name: "users" };
