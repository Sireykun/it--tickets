---
paths:
  - "tests/**"
  - "e2e/**"
---

# Testing

- Verify behavior, not implementation. Don't assert mock call counts when output values would do.
- Run the specific file after changes, not the full suite: `docker compose run --rm app npx vitest run tests/<file>.test.ts`.
- Unit/integration tests hit the real `ticketdb_test` database; call `src/server/*` functions with an acting user. Mock only at true boundaries (network, mail, clock).
- Make test data unique per run (the `tag = t${Date.now()}` pattern) so tests don't collide.
- Flaky test? Fix it or delete it. Never retry to make it pass.
- e2e: select by role/label (`getByRole`, `getByLabel`), not CSS classes. Restart `web` before running so it isn't testing stale code.
- Never `expect(true)` or check a mock was called without verifying arguments.
