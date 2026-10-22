---
paths:
  - "src/server/**"
  - "src/app/api/**"
  - "src/app/**/actions.ts"
  - "src/app/**/route.ts"
  - "src/app/**/route.tsx"
---

# Error Handling

- Errors meant for the user: throw `TicketError` (or the module's equivalent). Server actions turn them into `ActionState` via `runAction`. Anything else is unexpected and must not leak its message.
- Never swallow errors silently. Log or rethrow with context about what operation failed.
- Handle every rejected promise. No floating async calls.
- Never expose stack traces, internal paths, or raw database errors to the client.
- Route handlers: correct status codes (400 validation, 401 auth, 403 forbidden, 404 not found, 500 unexpected).
