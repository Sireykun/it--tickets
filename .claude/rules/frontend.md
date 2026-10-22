---
paths:
  - "src/app/**/*.tsx"
  - "src/app/**/*.css"
  - "src/components/**"
---

# Frontend

## Design Tokens

Tokens live in `src/app/globals.css`: CSS variables with a `prefers-color-scheme: dark` block, exposed to Tailwind 4 via `@theme inline` (`bg-surface`, `text-primary-fg`, …). Use those utilities; never hardcode raw colors or add a competing tokens file. New tokens go there, with dark-mode values.

## Design principle & libraries

Reuse `src/components/ui/*` (`buttonClass`, fields, submit button) and the existing libraries (Tailwind, Radix Dialog, lucide-react, clsx); never introduce a competing one. For the full design doctrine, invoke the **frontend-designer** agent.

## Layout

- CSS Grid for 2D, Flexbox for 1D. Use `gap`, not margin hacks.
- Semantic HTML: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`.
- Mobile-first (e2e runs on iPhone too). Touch targets: minimum 44x44px; `size="sm"` buttons only in dense desktop tables.

## Accessibility (non-negotiable)

- All interactive elements keyboard-accessible.
- Images: meaningful `alt` text. Decorative: `alt=""`.
- Form inputs: associated `<label>` or `aria-label` (e2e selects by label/role, so this is load-bearing).
- Contrast: 4.5:1 normal text, 3:1 large text.
- Visible focus indicators. Never `outline: none` without replacement.
- Color never the sole indicator.
- `aria-live` for dynamic content. Respect `prefers-reduced-motion`.

## Performance

- Images: `loading="lazy"` below fold, explicit `width`/`height`.
- Animations: `transform` and `opacity` only.
- Bundle size: never import a whole library for one function.
