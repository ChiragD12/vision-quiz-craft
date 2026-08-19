# Design System

## Principles

1. Dark first. The app is used long-form, often at night.
2. Restraint over decoration. Gold is an accent, never a fill.
3. Content-forward. Chrome fades; questions and notes lead.
4. Motion communicates state, never entertains.

## Palette (oklch)

Defined in `src/styles.css` under `:root`.

| Token                  | Value                   | Use                         |
| ---------------------- | ----------------------- | --------------------------- |
| `--background`         | `oklch(0.16 0.03 260)`  | Page background (deep navy) |
| `--foreground`         | `oklch(0.96 0.01 90)`   | Body text                   |
| `--card`               | `oklch(0.21 0.025 260)` | Surface layer 1             |
| `--muted`              | `oklch(0.26 0.02 260)`  | Surface layer 2             |
| `--border`             | `oklch(1 0 0 / 0.08)`   | Hairline dividers           |
| `--primary`            | `oklch(0.82 0.13 82)`   | Warm gold accent            |
| `--primary-foreground` | `oklch(0.18 0.02 260)`  | Text on gold                |
| `--success`            | `oklch(0.74 0.15 155)`  | Correct answers             |
| `--destructive`        | `oklch(0.66 0.20 25)`   | Wrong answers               |

Streak tier colours:

| Tier   | Threshold         | Colour                 |
| ------ | ----------------- | ---------------------- |
| Bronze | 25 solved today   | `oklch(0.70 0.12 55)`  |
| Silver | 50 solved today   | `oklch(0.85 0.02 250)` |
| Gold   | 100 solved today  | `oklch(0.82 0.13 82)`  |
| Gem    | 125+ solved today | `oklch(0.75 0.18 200)` |

## Typography

- Display: **Fraunces** — headings, streak counter, score.
- Body: **Inter** — everything else.
- Loaded via `@fontsource` in `src/styles.css`, not remote `@import`.
- Numbers use `font-variant-numeric: tabular-nums` (utility `.nums`).

## Spacing

- Base radius: 14px (`--radius`).
- Section padding: 24–32px.
- Card padding: 20–24px.
- Vertical rhythm between sections: 24px.

## Motion

- Duration: 200–280ms.
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out expo).
- Framer-motion for card enter and quiz-question transitions.
- Never animate on route change alone; animate content, not chrome.

## Components (rules of thumb)

- **Card** — surface with hairline border. Hover only on interactive cards
  (`hover:border-primary/40`).
- **Primary button** — solid gold. Reserved for the single most important
  action on screen.
- **Secondary button** — surface layer 2, no glow.
- **Icon buttons** — 36×36, ghost by default.
- **Streak ring** — concentric SVG rings; inactive tiers rendered at 8%
  opacity of their tier colour; active tier at 100%.

## Anti-patterns

- Purple/indigo gradients.
- Flashy neon.
- Multiple accent colours.
- Rounded-full buttons for text CTAs.
- Progress bars taller than 4px.
- Any greeting text ("Welcome", "Good morning").
