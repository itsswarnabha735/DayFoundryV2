# General guidelines

- Prefer **responsive, well-structured layouts** (flexbox & grid). Use absolute positioning only for overlays (modals, toasts) or when anchoring to the viewport is required.
- **Mobile-first.** Optimize for 360–430 px width; gracefully scale to tablets. Respect safe-area insets and on-screen keyboards.
- **Offline-first.** All core flows (capture → compose → schedule → focus → reflect) must work without network. Queue writes and show sync state.
- **Accessibility by default.** Tap targets ≥ 44 pt; semantic roles/labels; support Dynamic Type; high-contrast color pairs; honor “Reduce Motion.”
- **Performance.** Keep bundle small; virtualize long lists; avoid unnecessary re-renders; images as SVG/WebP where possible.
- **State & structure.** Encapsulate screens and reusable UI as components; keep helper functions/components in their own files; co-locate tests.
- **Naming & tokens.** Prefix design tokens and utility classes with `df-` (Day Foundry). Keep tokens the single source of truth.
- **Copy & tone.** Clear, concise, action-oriented UI text (“Compose day,” “Start focus,” “Replan”). Avoid jargon.
- **Notifications.** Always support **local notifications**; gate OS prompts behind a friendly explainer. Respect quiet hours.
- **Error handling.** Fail soft, never lose user input. Use inline hints for validation; toasts for transient success/fail; dialogs only for destructive actions.
- **Privacy & secrets.** Never embed API keys in code or prompts. Route model calls through a secure backend. Provide a visible “Privacy Mode” indicator.
- **Incremental generation.** In Figma Make, work in **small, testable steps**. Prefer point‑and‑prompt edits over all‑page rewrites.
- **Refactor as you go.** Keep code clean, remove dead code, and keep file sizes small.
- **Design with intent.** Every screen must support the core day loop; avoid ornamental elements that don’t improve comprehension or speed.

---

# Design system guidelines

> **Theme:** Calm, minimal, focus‑first. Neutral surfaces with a confident blue primary. High legibility and generous spacing.

## Design tokens

> All tokens must exist in **light** and **dark** themes. Name tokens with the `--df-` prefix.

### Color (light)

- `--df-surface`: `#FFFFFF`
- `--df-surface-alt`: `#F7F8FA`
- `--df-elev-1`: `#FFFFFF` (shadow token below)
- `--df-text`: `#0B1320`
- `--df-text-muted`: `#5B6472`
- `--df-primary`: `#2563EB`
- `--df-primary-contrast`: `#FFFFFF`
- `--df-success`: `#16A34A`
- `--df-warning`: `#D97706`
- `--df-danger`: `#DC2626`
- `--df-border`: `#E5E7EB`

### Color (dark)

- `--df-surface`: `#0F1115`
- `--df-surface-alt`: `#171A20`
- `--df-elev-1`: `#171A20`
- `--df-text`: `#F6F7F9`
- `--df-text-muted`: `#A8B0BD`
- `--df-primary`: `#3B82F6`
- `--df-primary-contrast`: `#0B1320`
- `--df-success`: `#22C55E`
- `--df-warning`: `#F59E0B`
- `--df-danger`: `#F87171`
- `--df-border`: `#2A2F39`

### Elevation (shadows)

- `--df-shadow-sm`: `0 1px 2px rgba(0,0,0,0.08)`
- `--df-shadow-md`: `0 4px 12px rgba(0,0,0,0.12)`
- `--df-shadow-lg`: `0 8px 24px rgba(0,0,0,0.14)`

### Spacing & layout

- Spacing scale: `4, 8, 12, 16, 24, 32, 40, 48` (px) → `--df-space-4` … `--df-space-48`
- Corner radius: `--df-radius-sm: 8px`, `--df-radius-md: 12px`, `--df-radius-pill: 999px`
- Content gutters: **16 px** (phones), **20–24 px** (large phones/tablets)
- Grid: Mobile single-column with stacked sections; use flex layouts; avoid absolute positioning.

### Typography

- Base font size: **16 px** (scale with OS settings).
- Font stack: system fonts (iOS SF Pro / Android Roboto) with `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.
- Styles (rem based):

  - `--df-type-display`: 1.75rem / 600
  - `--df-type-title`: 1.25rem / 600
  - `--df-type-subtitle`: 1.125rem / 500
  - `--df-type-body`: 1rem / 400
  - `--df-type-caption`: 0.875rem / 500

- Line-height: 1.3–1.5; truncate to 1–2 lines with ellipsis for list rows.

### Motion

- Durations: `--df-anim-fast: 120ms`, `--df-anim-med: 200ms`, `--df-anim-slow: 280ms`
- Easing: standard ease‑in‑out; reduce motion when OS setting is on (swap to fades).
- Use motion to reinforce **state changes** (e.g., block “pin”, focus start), never as decoration.

### Iconography

- Sizes: 20 px (inline), 24 px (buttons/tabs), 32 px (empty states).
- Stroke icons preferred; fill for active/primary states.

### Date & time

- Date short: `Sep 13`
- Date with weekday: `Mon, Sep 13`
- Time: follow OS 12/24‑hour setting; show time zones explicitly when off‑device timezone.
- Relative time only when within 24 h (“in 15 min”, “3 h ago”).

---

## App structure & navigation

### Bottom tab bar

- **Tabs (max 5):** Today (home), Inbox, Schedule, Focus, Review.
- Labels required; active tab uses `--df-primary`.
- Safe‑area aware; avoid FAB overlap (see FAB rules).

### Top app bar

- Shows date context, page title, and a single primary action.
- Avoid more than **2** trailing icons; overflow goes to a kebab menu or bottom sheet.

### Floating Action Button (FAB)

- **Allowed with bottom tabs** on Today and Schedule only.
- Action: **Capture** (text/voice/camera/import).
- Do not show FAB on Focus or modal contexts.
- Elevation `--df-shadow-lg`; offset by safe area; avoid obstructing toasts.

---

## Components

### Button

#### Usage

Use buttons for primary actions (compose, schedule, start focus), with clear, verb‑first labels.

#### Variants

- **Primary** — filled `--df-primary` / text `--df-primary-contrast`

  - One per view section; use for the main flow action.

- **Secondary** — outline with `--df-primary` text; surface background.
- **Tertiary** — text‑only; reserved for low‑emphasis actions.
- **Destructive** — filled `--df-danger`; confirmation dialog required.

#### Specs

- Height 44–48 pt; icon optional at leading edge; corner `--df-radius-sm`.
- Loading state replaces label with spinner; keep width fixed to avoid layout shift.
- Disabled: 40% opacity; maintain contrast for label legibility.

---

### Input fields

#### Usage

Task capture, estimates, dates, quick edits. Prefer in‑place edits over full‑screen forms.

#### Variants

- Text, Multiline, Number (minutes), Date/Time pickers, Select (3+ options), Chips for tags.

#### Specs

- Height ≥ 44 pt; labels always visible (no placeholder‑only).
- Validation inline under field; do not block typing.
- Keyboard types per field (numeric, email, datetime).

---

### Cards

#### Usage

Present tasks, outcomes, meeting briefs, and review insights.

#### Specs

- Padding `16–20px`, radius `--df-radius-md`, shadow `--df-shadow-sm`.
- Use subdued dividers (`--df-border`) to separate sections.

---

### Lists & rows

#### Usage

Inbox items, tasks, meetings. Support swipe actions.

#### Specs

- Row height min 56 pt; left icon/checkbox; two‑line text; right affordance (chevron/toggle).
- Swipe right → complete; left → defer/snooze (confirm with brief toast & undo).

---

### Tabs & Segments

- Use segmented controls within a page for local filtering (e.g., Inbox filters).
- Keep segments ≤ 4; otherwise use a menu.

---

### Chips & Tags

#### Usage

Energy (“Deep”, “Shallow”), blockers, categories.

#### Specs

- Height 28–32 px; pill radius; small icon optional.
- Color map: energy (Deep=primary, Shallow=text‑muted background), blockers (Danger/Warning).

---

### Toasts & Snackbars

- Duration: 2–3 s for success; 4–6 s for errors with **Undo** when applicable.
- Position above tab bar; avoid stacking >2.

---

### Dialogs & Bottom sheets

- Prefer **bottom sheets** for multi‑step or list choices; dialogs for confirmations.
- Always include a clear primary action and a cancel/close affordance.

---

### Timeline blocks (Schedule)

#### Types & colors

- **Deep Work** — primary tint at 12% fill; bold border of primary.
- **Meeting** — solid surface with icon; prep/debrief badges.
- **Admin** — text‑muted tint at 12% fill.
- **Buffer** — dashed border; neutral fill at 8%.
- **Micro‑break** — thin separators; subtle highlight.
- **Errand/Travel** — warning tint (12%) with location icon.

#### Behavior

- Drag to resize (15‑min increments); snap to grid.
- **Pin** places a lock icon; pinned blocks aren’t moved by replans.
- Show **explainable diffs** after replan (bullet list, 2–4 items max).

---

### Focus timer

#### Layout

- Full‑screen, distraction‑free.
- Large timer (min\:sec), task title, acceptance criteria, “Next up.”

#### Controls

- Start/Pause/Extend (+5/10/15), Defer (opens replan sheet), Micro‑break ticker.

#### Feedback

- Haptic on start/complete; local notifications for breaks/resume; gentle color shift during focus.

---

### Empty states

- Use a friendly illustration/icon + 1–2 lines of guidance + a clear primary action (e.g., “Capture your first task”).
- Never dead‑end; provide a path forward.

---

## Patterns

### Capture → Extract (LLM)

- On capture accept, run extraction in background; show skeleton in Task Draft.
- If extraction fails, keep user text and highlight missing fields.

### Compose (Outcomes)

- Limit to **3–5** outcomes; each with 1–3 key steps and a short risk note.
- Show a “Send to Scheduler” CTA.

### Replan & conflicts

- Overlay with two strategies: **Protect Focus** vs **Hit Deadlines**.
- Show a human‑readable diff and a “Draft reschedule message” action.

### Reflection & learning

- Three prompts + quick blocker tags; summarize to 3 bullets.
- Display simple trend cards (sparklines) for estimate accuracy and top blockers.

---

## Do/Don’t (quick rules)

- **Do** use system fonts and OS date/time formats; **Don’t** lock into a custom font.
- **Do** respect safe areas and keyboard insets; **Don’t** let FAB or toasts overlap critical controls.
- **Do** keep one **primary** button per section; **Don’t** stack multiple primary actions together.
- **Do** show progress and placeholders (skeletons) during async work; **Don’t** freeze the UI.
- **Do** use bottom sheets for choices; **Don’t** overuse full‑screen modals.
- **Do** provide Undo for destructive or quick actions; **Don’t** require confirmations for low‑risk edits.
- **Do** keep tap targets ≥ 44 pt; **Don’t** use tiny icons for critical actions.
- **Do** rely on tokens; **Don’t** hardcode ad‑hoc colors or spacing.

---

## Component states (all)

- **Default / Hover (web) / Focus (a11y) / Active / Disabled / Loading** must be defined for Buttons, Inputs, Tabs, Chips.
- **Error states** include icon + message; never color alone.
- **Pinned state** for timeline blocks uses a lock icon and a slightly stronger border.

---

## Content & microcopy

- Use sentence case.
- Buttons/CTAs: **verb first** (“Start focus,” “Compose day”).
- Empty states: “What it is” + “What to do next.”
- Explanations: bullet lists, **≤ 30 words** each.

---

## Internationalization

- English first; keep strings short and concatenation‑free.
- Support pluralization (“1 min”, “2 mins”).
- Time zone and 12/24‑hour follow OS settings.

---

## QA checklist (visual)

- Color contrast ≥ AA (4.5:1 for text).
- Tap targets measured ≥ 44 pt.
- All screens tested in light/dark themes and with Dynamic Type increased 2 steps.
- Timeline drag/resize precise to 15‑minute grid on phone.
- No overlapping FAB/toast/tab bar.

---

## File & code organization (for Make)

- `/tokens` — theme & design tokens (light/dark).
- `/components` — Buttons, Inputs, Cards, Chips, Tabs, Toast, BottomSheet, TimelineBlock, FocusTimer.
- `/screens` — Today, Inbox, Schedule, Focus, Review, Meetings, Settings.
- `/utils` — date/time, a11y helpers, formatting, validation.
- `/services` — storage (offline queue), notifications, api (LLM, solver).
- Keep components small; export types; write minimal unit tests for pure helpers.

---

## Example token usage (snippet)

- Background: `background: var(--df-surface);`
- Body text: `color: var(--df-text);`
- Primary button: `background: var(--df-primary); color: var(--df-primary-contrast);`
- Card: `box-shadow: var(--df-shadow-sm); border-radius: var(--df-radius-md); padding: var(--df-space-16);`

---

Adhere to this **Guidelines.md** when generating, editing, or refactoring screens in Figma Make to keep Day Foundry fast, accessible, and coherent across the mobile app.