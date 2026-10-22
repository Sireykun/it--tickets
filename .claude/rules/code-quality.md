# Code Quality

## Anti-defaults (counter common Claude tendencies)

- No premature abstractions. Three similar lines beats a helper used once.
- Don't add features or improvements beyond what was asked.
- Don't refactor adjacent code while fixing a bug.
- No dead code or commented-out blocks.
- WHY comments, never WHAT. If code needs a "what" comment, rename instead.
- API docs at module boundaries only, not every internal function.

## Naming

- Files and directories: kebab-case, components included (`ticket-card.tsx`, `staff-nav.tsx`). Component names PascalCase.
- Booleans: `is` / `has` / `should` / `can` prefix. Functions: verb-first (`getTicketForViewer`). Handlers: `handle*` internal, `on*` as props.
- Factories: `create*`. Converters: `to*`. Predicates: `is*` / `has*` / `can*`. Constants: `SCREAMING_SNAKE`.
- Abbreviations only when universally known (`id`, `url`, `api`, `db`, `auth`). Acronyms as words: `userId`, not `userID`.

## File Organization

- Imports: one alphabetized block, `@/` alias for anything under `src/`.
- Exports: named, except where Next.js requires a default (`page`, `layout`, `not-found`, `icon`, `manifest`).
- Related small components may share a file (`admin-forms.tsx`).
- Function order: public API first, then helpers in call order.
