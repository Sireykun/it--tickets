# CIA FIRST IT Help Desk UI style guide

Use this guide for the requester portal and staff pages. The CSS variables in
[`src/app/globals.css`](src/app/globals.css) are the source of truth. Use the
shared components in `src/components/ui/` before writing new styles.

## Overall look

- Use the [CIA FIRST Digital Nexus News & Logs](https://nexus.ciaschool.edu.kh/news-logs)
  dark palette: near-black slate page, navy cards, light text, cyan links,
  teal actions, and a small muted-gold line. Give the content room to breathe.
- Use the logo gold for key headings, ticket numbers, time badges, and accent
  lines. Use cyan and soft green inside selected icon boxes; keep body text light.
- Keep one main action per section. Use a secondary or ghost button for the rest.
- Use the same rules on desktop and mobile. Cards should fit the viewport with
  no horizontal scrolling.

## Colors

Use semantic Tailwind classes such as `bg-surface`, `text-text`, and
`border-border`. Do not copy hex values into page components. The effective
default palette is **Ocean / Nexus**; Violet and Rose change the accent and surfaces
through `data-portal-theme`.

| Purpose | Token / class | Ocean value | Rule |
| --- | --- | --- | --- |
| Page background | `bg-bg` | `#020617` | Near-black slate page canvas |
| Card background | `bg-surface` | `#0f172a` | Main cards, forms, conversation panel |
| Raised or selected area | `bg-surface-2` | `#17243a` | Small inset areas, hover, selected navigation |
| Divider / card border | `border-border` | `#1e293b` | Thin, quiet separation |
| Nexus gold accent rule | `bg-gold` | `#bca560` | Short line beneath headings and the brand |
| Supporting green accent | `bg-accent-green` | `#6fd0a2` | Small rules, box edges, and icons |
| Input border | `border-border-strong` | `#334155` | Controls that need a clearer edge |
| Main text | `text-text` | `#f1f5f9` | Headings, body text, field values |
| Secondary text | `text-muted` | `#cbd5e1` | Help text, dates, labels with less emphasis |
| Link and icon | `text-primary` | `#5cc8e8` | Bright cyan on dark surfaces |
| Main action | `bg-action text-action-fg` | `#015f7a` / white | Teal button with white text |
| Focus ring | `outline-focus`, `ring-focus` | `#5cc8e8` | Visible keyboard focus |
| Error / destructive | `text-danger`, `bg-danger-soft` | `#f2837a` / `#3a1714` | Errors and destructive actions |

Theme accents: Ocean `#5cc8e8`, Violet `#c4a7ff`, Rose `#f7a2ca`.
The gold matches the Nexus site and stays `#bca560` in every theme.
Use `text-action-fg` on `bg-action` buttons. When adding a color pair, check
text contrast in all three themes; aim for WCAG AA (4.5:1 for normal text).

### Status and priority

Status colors are reserved for ticket state: Open blue, In progress violet,
Resolved green, Closed gray. Priority colors are Low muted, Normal blue, High
orange, Emergency red. Render them with `StatusChip` and `PriorityBadge` from
[`src/components/tickets/badges.tsx`](src/components/tickets/badges.tsx). Always
include the text label; color alone must not carry the meaning.

## Text

| Element | Size and weight | Rule |
| --- | --- | --- |
| Base type | 17 px phone, 18 px desktop | All rem based sizes scale together for readability |
| Page title | `text-2xl font-bold` | One clear heading per page |
| Section title | `text-lg font-bold` | Short and descriptive |
| Body and message text | `text-base leading-relaxed` | 17–18 px; easy to read on phones |
| Field label | `text-sm font-bold` | Place directly above its control |
| Hint, date, and metadata | `text-sm text-muted` | About 15–16 px; do not make important text tiny |
| Ticket number | `font-mono text-sm font-bold` | Use for IDs only |

Use sentence case for labels and buttons. Keep paragraphs short. Wrap long
subjects and file names so they do not push a card wider than the screen.

## Boxes and rules

| Element | Shape | Border and fill | Spacing |
| --- | --- | --- | --- |
| Main card or panel | `rounded-xl` (12 px) | `border border-border bg-surface shadow-card` | `p-4 sm:p-5` |
| Input, button, navigation item | `rounded-lg` (8 px) | Use the shared control/button component | At least 44 px tall on touch screens |
| Chip, count, avatar | `rounded-full` | Semantic fill or `bg-surface-2` | Compact, readable text |
| Divider or timeline rule | 1 px | `border-border` or a subdued accent | Leave space on both sides |
| Logo gold heading rule | 2 px high, 40–56 px wide | `bg-gold` | Place below main and key panel headings |

Prefer one outer card for each section. Put related content inside it and use a
quiet divider (`border-t border-border pt-5`) between parts. For example, the
reply composer belongs **inside** the Conversation panel, below the messages.
Avoid stacking several bordered cards around the same content. Use `gap-4` or
`gap-5` between fields and `gap-6` between page sections.

Use a thin gold left edge on selected text boxes and list cards. Cycle gold,
green, and cyan on the small icon boxes for variety while keeping the background
navy and the text readable. Status and priority retain their own colors and
labels.

Use `AccentRule` from [`src/components/ui/misc.tsx`](src/components/ui/misc.tsx)
for short gold lines. Keep structural dividers and card outlines slate; do not
turn every border gold. Reserve gold text for the logo, ticket numbers, and
time badges; keep body text and status/priority labels semantic.
The active sidebar item uses a thin gold left rule, and the active phone tab
uses a thin gold top rule. Inactive items keep a transparent rule of the same
width so the navigation does not shift.

Conversation messages use speech bubbles: requester bubbles use the deep teal
accent surface; IT replies use a subtle dark gold surface (`bg-reply-bg`) and border
(`border-reply-border`); system events are plain text on the connecting rule. Internal
notes use the note tokens and a dashed border. Preserve this distinction when
editing [`Thread`](src/components/tickets/thread.tsx).
The conversation panel has a gold outer frame. Message bubbles use roomy text,
gold author names, and a compact reply row with attach, emoji, and send controls.
The reply field grows for long drafts and scrolls after several lines.
The requester sees a compact kudo action in the Conversation heading on closed
tickets, regardless of who closed them. It is a one-time thank-you gift, never a rating.

## Controls and feedback

- The New Ticket form asks one group of questions at a time: topic, priority,
  location, description, and review. Keep Back and Continue visible, preserve
  answers between steps, and validate the current step before moving forward.
- Use `Button`, `LinkButton`, `Field`, `Input`, `Select`, `Textarea`, `Card`, and
  `Alert` from `src/components/ui/`. They already handle shape, focus, and
  spacing consistently.
- Use a solid primary button for Submit, Send, or Save. Use secondary for a
  less important action and danger styling only for destructive actions.
- Inputs need a visible label, helpful hint when needed, and an error near the
  field or form. Do not rely on placeholders as labels.
- Keep a 2 px visible focus outline. Never remove it without an equivalent.
- Honor reduced-motion settings. Animation should not be needed to understand
  status or complete a task.

## Quick review before merging

1. Check the page at desktop and phone width. No clipped text or horizontal scroll.
2. Check Ocean, Violet, and Rose. Text, borders, and focus remain clear.
3. Confirm status and priority have words as well as color.
4. Confirm related content is in one clean card with consistent spacing.
5. Confirm primary actions, labels, errors, and keyboard focus are easy to find.
