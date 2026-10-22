---
paths:
  - "src/server/**"
  - "src/app/api/**"
  - "src/app/**/actions.ts"
  - "src/app/**/route.ts"
  - "src/app/**/route.tsx"
  - "src/auth.ts"
  - "src/proxy.ts"
---

# Security

- Validate all user input at the boundary with the zod schemas in `src/server/validation.ts`. Never trust form data or route params.
- Use Prisma queries or tagged-template `$queryRaw`; never `$queryRawUnsafe`/`$executeRawUnsafe`. Never concatenate user input into SQL or shell commands.
- Sanitize output to prevent XSS. Use React's escaping; no `dangerouslySetInnerHTML` with user content.
- Never log secrets, tokens, passwords, or PII.
- Use constant-time comparison for secrets and tokens.
- Rate-limit authentication endpoints (`src/server/rate-limit.ts`).
- Attachments: check the viewer can see the ticket before serving a file; never build a filesystem path from user input.
