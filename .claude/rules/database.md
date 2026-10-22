---
paths:
  - "prisma/**"
---

# Database Migrations (Prisma)

- **Never modify an existing migration.** Change `prisma/schema.prisma`, then create a new one: `docker compose run --rm app npx prisma migrate dev --name <x> --create-only`, review the SQL, then apply.
- Migrations contain hand-written SQL Prisma can't express (ticket-number sequence, `priority_level` trigger, CHECK constraints). Keep it; check a generated migration doesn't drop or recreate them.
- Prisma has no down migrations. For destructive changes (drop column/table, narrowing types), confirm the data is no longer needed first.
- Never seed data in migrations. Seeds go in the seed script (`npm run db:seed`), kept idempotent.
- After schema changes run `npx prisma generate`; never hand-edit `src/generated/`.
