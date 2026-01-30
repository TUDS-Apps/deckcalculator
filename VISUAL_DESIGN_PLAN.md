# TUDS Pro Deck Calculator — Visual Design Modernization Plan

## Executive Summary

The current UI works but feels dated and inconsistent — a natural result of iterative development over a year. This plan addresses the visual layer specifically: color, typography, spacing, component styling, and overall polish. The goal is a modern, professional tool that instills confidence when a customer uses it and reflects the quality of the TUDS brand.

This plan is independent of the UX flow changes (see `UX_PLAN.md`) and the architecture refactor (see `REFACTOR_PLAN.md`). Visual changes can be applied incrementally and should not break functionality.

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [Design Direction](#2-design-direction)
3. [Color System Overhaul](#3-color-system-overhaul)
4. [Typography System](#4-typography-system)
5. [Component Redesign](#5-component-redesign)
6. [Layout & Spacing](#6-layout--spacing)
7. [Canvas & Drawing Area](#7-canvas--drawing-area)
8. [Modals & Overlays](#8-modals--overlays)
9. [Tables & Data Display](#9-tables--data-display)
10. [Micro-interactions & Animation](#10-micro-interactions--animation)
11. [Responsive & Mobile](#11-responsive--mobile)
12. [Accessibility Fixes](#12-accessibility-fixes)
13. [Implementation Order](#13-implementation-order)

---

## 1. Current State Assessment

### What Works
- The design token system (CSS custom properties) is a solid foundation
- Inter font choice is good — clean, modern, excellent readability
- The color palette (navy/teal/green) is appropriate for a professional tool
- Responsive breakpoints exist at 480px, 640px, 768px, 1024px
- Print stylesheets are thorough

### What Needs Work

| Issue | Severity | Where |
|-------|----------|-------|
| **Color inconsistency** — 3+ teals, 11+ grays, hardcoded hex mixed with CSS vars | High | Entire stylesheet |
| **Dated gradients** — navy-to-teal gradients on everything feel 2018-era | Medium | Header, buttons, modals, panels |
| **Tiny font sizes** — 10px and 11px text on navigation labels | High | Wizard sidebar, mobile nav, substeps |
| **Heavy shadows** — Multiple layered shadows on cards and buttons | Low | Cards, buttons, floating controls |
| **Inconsistent component styling** — Same component type styled differently across contexts | Medium | Buttons, cards, modals |
| **Cluttered toolbar** — 13+ floating buttons over the canvas | Medium | Canvas toolbar |
| **Web 2.0 sky gradient** — 3D viewer uses `#87CEEB` to `#E0F7FA` background | Low | 3D preview |
| **Overuse of `!important`** — ~100+ `!important` declarations | Medium | Print styles, BOM table |
| **No dark mode foundation** — All colors hardcoded to light theme | Low | Future concern |

---

## 2. Design Direction

### Reference Style: "Clean Professional Tool"

Think: Figma's sidebar + Linear's card styling + Stripe's typography.

**Key principles:**
- **Flat with subtle depth** — No heavy gradients. Use solid colors with 1-2px borders and minimal shadow for depth.
- **High contrast, muted palette** — Strong text contrast, muted backgrounds, accent color only for primary actions and active states.
- **Generous whitespace** — Let components breathe. Cramped UI feels dated.
- **Consistent radius** — One border-radius value for cards (8px), one for buttons (6px), one for pills (9999px).
- **Restrained animation** — Subtle transitions (150-200ms). No bouncing, pulsing, or scaling on hover.

### Before/After Vision

**Current:** Navy-to-teal gradient header, green-bordered selected cards, multiple shadow layers, gradient buttons, blue-white sky 3D background, tiny step labels.

**Target:** Clean white/gray header bar with navy logo, teal accent for active states only, flat buttons with subtle hover, neutral 3D background, readable step labels.

---

## 3. Color System Overhaul

### Problem

The stylesheet currently uses:
- `--tuds-navy: #133A52` AND hardcoded `#133a52` AND `#1e3a5f` (different navy!)
- `--tuds-teal: #2D6A6A` AND `#00A19A` (completely different teal!)
- 11+ gray values, some from Tailwind, some custom
- Semantic colors mixed with brand colors

### Proposed Palette

Lock in exactly these values and use **only** CSS variables throughout:

```css
:root {
  /* ── Brand ── */
  --tuds-navy:       #133A52;   /* Primary brand color — headers, primary text */
  --tuds-navy-dark:  #0D2A3D;   /* Hover state for navy elements */
  --tuds-navy-light: #1A5070;   /* Lighter accent */

  --tuds-teal:       #2D6A6A;   /* Secondary brand — active states, accents */
  --tuds-teal-light: #3D8A8A;   /* Hover state for teal elements */
  --tuds-teal-muted: #E8F0F0;   /* Teal tint for backgrounds */

  --tuds-green:      #83AD54;   /* Success, completion, selected states */
  --tuds-green-light:#9DBE78;   /* Lighter variant */
  --tuds-green-muted:#F0F5EA;   /* Green tint for backgrounds */

  /* ── Neutral ── */
  --gray-50:  #FAFAFA;          /* Page background */
  --gray-100: #F4F4F5;          /* Card backgrounds, zebra rows */
  --gray-200: #E4E4E7;          /* Borders, dividers */
  --gray-300: #D4D4D8;          /* Disabled borders */
  --gray-400: #A1A1AA;          /* Placeholder text */
  --gray-500: #71717A;          /* Secondary text */
  --gray-600: #52525B;          /* Body text */
  --gray-700: #3F3F46;          /* Strong body text */
  --gray-800: #27272A;          /* Headings */
  --gray-900: #18181B;          /* Primary text */

  /* ── Semantic ── */
  --color-success:    #16A34A;
  --color-warning:    #D97706;
  --color-error:      #DC2626;
  --color-info:       #2563EB;

  /* ── Surfaces ── */
  --surface-primary:   #FFFFFF;
  --surface-secondary: var(--gray-50);
  --surface-elevated:  #FFFFFF;
  --surface-overlay:   rgba(0, 0, 0, 0.5);
}
```

### Migration Rule

**Every hardcoded hex color in the stylesheet must be replaced with a CSS variable.** No exceptions. This makes future theming (dark mode, white-label for other stores) possible.

---

## 4. Typography System

### Problem
- Base font size is 14px (`--text-base: 0.875rem`), which is fine for a dense tool
- But navigation labels drop to 10-11px — below WCAG minimums
- Inconsistent use of `font-weight: 600` vs `var(--font-semibold)` (same value, different syntax)
- No clear type scale hierarchy

### Proposed Type Scale

```css
:root {
  /* ── Type Scale ── */
  --text-xs:   0.6875rem;  /* 11px — MINIMUM size, captions only */
  --text-sm:   0.75rem;    /* 12px — secondary labels, badges */
  --text-base: 0.875rem;   /* 14px — body text, form inputs */
  --text-md:   1rem;        /* 16px — section headings, prominent labels */
  --text-lg:   1.125rem;   /* 18px — page titles */
  --text-xl:   1.25rem;    /* 20px — modal titles */
  --text-2xl:  1.5rem;     /* 24px — major headings (rarely used) */
}
```

### Rules
- **No text below 11px anywhere** — current 10px mobile nav labels must increase
- **Navigation labels:** minimum 12px (`--text-sm`)
- **Step sidebar labels:** minimum 11px (`--text-xs`), ideally 12px
- **Body text and inputs:** 14px (`--text-base`)
- **Section headings:** 16px (`--text-md`)
- **Always use variables** — no hardcoded `font-size: 0.5rem` or `font-size: 9pt`

---

## 5. Component Redesign

### 5a. Header

**Current:** Navy-to-teal gradient with white text, glass-morphism action buttons.

**Proposed:** Clean, flat header.

```
┌──────────────────────────────────────────────────────────────────┐
│  [TUDS Logo]  TUDS Pro Deck Estimator          [Help] [Sign In] │
│                                                                  │
│  by The Ultimate Deck Shop                                       │
└──────────────────────────────────────────────────────────────────┘
```

**Changes:**
- Solid `--tuds-navy` background (no gradient)
- Remove `::before` overlay layer
- Remove `box-shadow: 0 4px 20px` — use a simple `border-bottom: 1px solid var(--gray-200)` or no shadow
- Action buttons: solid white text, no glass morphism, subtle `rgba(255,255,255,0.1)` background on hover only
- Remove `transform: translateY(-1px)` hover effect on header buttons (feels jittery)

### 5b. Buttons

**Current:** Multiple button styles with gradients, ripple effects, hover lift.

**Proposed:** Flat buttons with clear hierarchy.

```css
/* Primary — solid navy, white text */
.btn-primary {
  background: var(--tuds-navy);       /* NO gradient */
  color: #fff;
  border: 1px solid var(--tuds-navy);
}
.btn-primary:hover {
  background: var(--tuds-navy-dark);
  /* NO translateY, NO shadow change */
}

/* Secondary — outlined */
.btn-secondary {
  background: var(--surface-primary);
  color: var(--gray-700);
  border: 1px solid var(--gray-300);
}
.btn-secondary:hover {
  background: var(--gray-100);
  border-color: var(--gray-400);
}

/* Success/CTA — solid green for "Add to Cart" type actions */
.btn-success {
  background: var(--tuds-green);
  color: #fff;
  border: 1px solid var(--tuds-green);
}
```

**Remove entirely:**
- `.btn-primary:after` ripple effect (material design artifact)
- `transform: translateY(-1px)` on all button hovers
- Gradient backgrounds on buttons
- The `#blueprintToggleBtn::before` shimmer effect

### 5c. Cards / Info Cards

**Current:** White background, subtle gray border, shadow on hover that changes, `hover: box-shadow`.

**Proposed:** Clean cards with consistent styling.

```css
.info-card {
  background: var(--surface-primary);
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  padding: 1rem;
  /* NO shadow by default — flat design */
  /* NO hover shadow change — cards don't need hover effects */
}
```

### 5d. Visual Option Selectors (Footing Type, Beam Type, etc.)

**Current:** White cards with gray border, green gradient on selection, small SVG icons.

**Proposed:** Slightly larger, cleaner selection cards.

```css
.visual-option {
  border: 2px solid var(--gray-200);
  border-radius: 8px;
  background: var(--surface-primary);
  padding: 0.75rem;
  transition: border-color 150ms ease;
}

.visual-option:hover {
  border-color: var(--tuds-teal);
  /* NO background change, NO shadow */
}

.visual-option.selected {
  border-color: var(--tuds-teal);
  background: var(--tuds-teal-muted);
  /* Single ring, no double border + shadow combo */
}
```

**Change:** Replace green selection color with teal. Green should mean "success/done" (like step completion), not "selected option." Teal is the interactive accent.

### 5e. Wizard Step Sidebar

**Current:** 56px wide, circular numbered steps, 11px labels, green/navy states.

**Proposed:** Slightly wider (64px), cleaner step indicators.

```
   ┌────┐
   │ ① │  Draw        ← Active: filled navy circle, white number
   │  │ │
   │ ② │  Structure   ← Complete: teal checkmark, green tint
   │  │ │
   │ ③ │  Stairs      ← Upcoming: gray outline circle, gray text
   │  │ │
   │ ④ │  Decking
   │  │ │
   │ ⑤ │  Railing
   │  │ │
   │ ⑥ │  Review
   └────┘
```

**Changes:**
- Width: 64px (from 56px) — gives labels more room
- Step number circles: 32px (from 28px) — easier to read and tap
- Labels: 12px minimum (from 11px)
- Connector lines: 1px (from 2px) — lighter
- Active step: solid navy background, white number
- Completed step: teal checkmark icon replaces the number
- Future step: light gray border, gray number and text
- Remove the blue glow/ring on active step

### 5f. Floating Canvas Toolbar

**Current:** 13 buttons in a centered floating bar with glass morphism.

**Proposed:** Grouped, simplified toolbar.

```
┌───────────────────────────────────────────────────┐
│ [✏ Draw] [↗ Select] │ [↩ Undo] [↪ Redo] │ [🔍+] [🔍-] [⊡ Fit] │ [✕ Clear] │
└───────────────────────────────────────────────────┘
```

**Changes:**
- Keep glass morphism background (appropriate for a floating toolbar over canvas)
- Remove per-button shadows and hover-scale effects
- Buttons: 32px height, no individual borders — group separator lines between sections
- Active tool (Draw/Select): teal background, white icon
- Icons only (no text) — rely on tooltips
- Tooltip styling: simple dark popup, no arrow pseudo-elements needed (simplify CSS)
- Remove blueprint toggle from the toolbar (move to a settings/view panel or the legend)

### 5g. Template Cards

**Current:** Tiny cards (0.5rem padding) with 0.625rem labels and 0.5625rem size text.

**Proposed:** Slightly larger with better readability.

```css
.template-card {
  padding: 0.625rem;
  border: 1px solid var(--gray-200);  /* 1px, not 2px */
  border-radius: 8px;
}

.template-label {
  font-size: 0.75rem;   /* up from 0.625rem */
  font-weight: 600;
}

.template-size {
  font-size: 0.6875rem;  /* up from 0.5625rem */
  color: var(--gray-500);
}
```

---

## 6. Layout & Spacing

### Spacing Scale

Stick to the existing 8pt grid but enforce it:

```
4px  — tight internal gaps (icon to label)
8px  — standard gap between related elements
12px — gap between form fields
16px — section padding, card padding
24px — gap between sections
32px — gap between major layout regions
```

### Main Layout

**Current:** `step-sidebar (56px) + input-panel (280px) + canvas (flex:1)`

**Proposed:** Same structure, minor adjustments:
- Step sidebar: 64px
- Input panel: 300px (slight increase for readability)
- Gap between panels: 16px (consistent)
- Page background: `--gray-50` (#FAFAFA) — very subtle warmth vs pure white

### Remove Negative Margins

The header currently uses `margin: -1rem -1rem 0.5rem -1rem` to bleed to the edges. Instead, restructure the HTML so the header sits outside the padded container, or use full-width within the container naturally.

---

## 7. Canvas & Drawing Area

### Canvas Container

**Current:** `border: 1px solid #d9d9d9`, hover changes border color, white background.

**Proposed:**
```css
#canvasContainer {
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  overflow: hidden;
  background: #FFFFFF;
  /* Remove hover border color change — the canvas is always interactive */
}
```

### Grid

The canvas grid (24px = 1 foot) is drawn in JavaScript. No CSS change needed, but the grid color should be a very faint gray (`rgba(0,0,0,0.04)`) which it already is in blueprint mode. Make this the default.

### Legend Panel

**Current:** Floating bottom-right, expandable, navy toggle when expanded.

**Proposed:** Keep the floating position but simplify the expanded state:
- Expanded background: white with gray border (not navy toggle button)
- Checkboxes: use `--tuds-teal` accent (already done)
- Keep the compact size — it shouldn't compete with the drawing

### Status Bar

**Current:** `#canvasStatus` has a teal left border and light background.

**Proposed:** Keep as-is — the status bar style is functional and unobtrusive.

---

## 8. Modals & Overlays

### General Modal Pattern

All modals should follow one consistent pattern:

```css
.modal-content {
  background: var(--surface-primary);
  border-radius: 12px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  max-width: 640px;  /* default, override per modal if needed */
  width: calc(100% - 2rem);
  max-height: calc(100vh - 4rem);
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--gray-200);
  background: var(--surface-primary);  /* NO gradient */
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-header h2 {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--gray-900);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
}

.modal-footer {
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--gray-200);
  background: var(--gray-50);
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
```

**Key changes from current:**
- **No gradient headers.** Currently specs modal has navy-to-teal gradient, cut list has yellow gradient, 3D has green gradient, auth has navy gradient, projects has navy gradient. They should all use a plain white header with dark text.
- **Consistent close button.** Gray icon, top-right, same size everywhere.
- **Consistent padding.** 1.25rem body, 1rem header/footer.
- **Backdrop:** `rgba(0,0,0,0.4)` with `backdrop-filter: blur(4px)` (keep current — this is fine).

### Per-Modal Accent

Instead of gradient headers, use a small color accent to differentiate:
- **Structural Specs:** Navy icon + navy title text
- **Cut List:** Amber icon + amber badge
- **3D Preview:** Green icon
- **Projects:** Navy icon
- **Auth:** Teal icon

This is a subtle, modern way to distinguish modals without garish gradient banners.

---

## 9. Tables & Data Display

### BOM Table

**Current:** Dark navy category headers (#1e3a5f), alternating rows, sticky header, ~100 lines of `!important` overrides for backgrounds.

**Proposed:** Lighter, cleaner table.

```css
/* Category headers — no longer dark navy */
.bom-category-header {
  background: var(--gray-100);
  border-bottom: 2px solid var(--gray-200);
}

.bom-category-header td {
  color: var(--gray-800);
  font-weight: 600;
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

/* Alternating rows */
.bom-row-even { background: var(--gray-50); }
.bom-row-odd  { background: var(--surface-primary); }

/* Total row */
.bom-total-row {
  background: var(--tuds-teal-muted);
  font-weight: 600;
  border-top: 2px solid var(--tuds-teal);
}
```

**Key change:** Category headers go from dark navy (hard to read, high contrast, draws too much attention) to light gray (blends into the table, serves as a section divider without dominating).

This also eliminates the need for the `!important` cascade for background colors — the specificity war was caused by the dark backgrounds conflicting with alternating row colors.

### Spec Cards

**Current:** Gray gradient header, dashed separator rows, green highlight rows.

**Proposed:**
- Card header: solid `--gray-100` background (no gradient)
- Separator: `border-bottom: 1px solid var(--gray-100)` (no dashed lines — dashes look dated)
- Value display: same layout, just cleaner borders

---

## 10. Micro-interactions & Animation

### Keep
- `transition: 150ms ease` on buttons, inputs, cards (appropriate duration)
- `fadeIn` animation on modal open (subtle and quick)
- Checkbox accent color for legend toggles

### Remove
- **Ripple effect** on `.btn-primary:active:after` — Material Design artifact
- **translateY(-1px)** on button hover — subtle but adds jitter, not modern
- **scale(1.05)** on toolbar button hover — oversized hover effect
- **softPulse** animation on blueprint icon — unnecessary continuous animation
- **shimmer** on blueprint toggle `::before` — gimmicky
- **shake** animation on validation error — aggressive, replace with red border + error text
- **success-pulse** ring animation — replace with a simple green border transition
- **`transform: translateX(2px)`** on summary hover — makes text jump

### Add
- **Focus-visible rings:** Consistent `outline: 2px solid var(--tuds-teal); outline-offset: 2px` on keyboard focus (accessibility)
- **Skeleton loading states:** For BOM table while calculating (instead of empty state)
- **Smooth step transitions:** Simple `opacity` + `translateY(8px)` fade on wizard panel content change (already partially there)

---

## 11. Responsive & Mobile

### Consolidate Breakpoints

**Current:** 480px, 640px, 768px, 896px, 1024px — five different breakpoints is too many for a tool UI.

**Proposed:** Three breakpoints:

```css
/* Mobile-first base styles (< 640px) */
/* Tablet: 640px - 1023px */
@media (min-width: 640px) { ... }
/* Desktop: 1024px+ */
@media (min-width: 1024px) { ... }
```

### Mobile Bottom Nav

**Current:** Fixed bottom bar with 6 items, 10px labels.

**Proposed:**
- Labels: 12px minimum
- Touch targets: 48px height (currently 44px — increase slightly)
- Active state: teal bottom border or filled background (not both)
- Only show the step number and short label (keep icons small)

### Tablet Layout

The input panel should become a collapsible drawer from the left or bottom, not disappear entirely. On 768px screens there's enough room for a narrow (240px) side panel + canvas.

---

## 12. Accessibility Fixes

### Critical (Must Fix)

1. **Font size minimum:** No text below 11px. Currently: 10px mobile nav labels, 0.5rem (8px!) in some compact variants.

2. **Color contrast:** All text must meet WCAG AA (4.5:1 for body text, 3:1 for large text).
   - `--gray-400` (#A1A1AA) on white = 3.5:1 — fails for body text. Use `--gray-500` (#71717A = 4.6:1) minimum.
   - Green on white: `--tuds-green` (#83AD54) = 3.1:1 — fails. Use `--tuds-green` (#83AD54) only for non-text elements (icons, borders). For green text, use a darker shade.

3. **Focus indicators:** Many buttons have `outline: none` on focus. Add `focus-visible` ring:
   ```css
   :focus-visible {
     outline: 2px solid var(--tuds-teal);
     outline-offset: 2px;
   }
   ```

4. **Touch targets:** All interactive elements must be at least 44x44px on touch devices. Some toolbar buttons and template cards are smaller.

### Recommended

5. **`prefers-reduced-motion`:** Already has a section — good. Ensure ALL animations and transitions respect it (some are missed).

6. **`prefers-contrast: high`:** Already has a section for tabs — extend to all components.

7. **Semantic HTML:** Use `<nav>` for wizard sidebar, `<main>` for canvas area, `<aside>` for input panel. Currently everything is `<div>`.

---

## 13. Implementation Order

### Phase 1: Foundation (Do First)
**Goal:** Fix the design system tokens so all subsequent work builds on a clean foundation.

1. **Audit and replace all hardcoded colors** with CSS variables
   - Search for every hex color in the CSS file
   - Map each to the nearest design token
   - Replace and verify
   - This alone will fix much of the inconsistency

2. **Update typography scale**
   - Enforce minimum 11px
   - Replace all hardcoded font sizes with variables
   - Fix mobile nav label sizes

3. **Remove deprecated patterns**
   - Delete ripple effect CSS
   - Delete shimmer effect CSS
   - Delete `translateY(-1px)` from all hover states
   - Delete `scale(1.05)` from toolbar hover
   - Replace shake/pulse animations with simple transitions

### Phase 2: Components
**Goal:** Modernize the look of individual components.

4. **Flatten the header**
   - Solid navy background, remove gradient overlay
   - Simplify action buttons

5. **Flatten all buttons**
   - Remove gradient backgrounds
   - Solid colors, 1px borders, no hover lift

6. **Clean up modals**
   - Remove gradient headers on all modals
   - Apply consistent modal pattern (white header, dark text, color icon accent)
   - Standardize padding, close button, footer

7. **Modernize BOM table**
   - Light category headers (gray, not dark navy)
   - Remove `!important` cascade
   - Clean alternating rows

8. **Update visual selectors**
   - Teal selection color (not green)
   - Simpler selected state (no gradient background)
   - Slightly larger labels

### Phase 3: Layout & Polish
**Goal:** Structural layout improvements and final polish.

9. **Widen step sidebar** (56px → 64px)
   - Increase step circle size (28px → 32px)
   - Increase label size (11px → 12px)
   - Simplify step states

10. **Consolidate responsive breakpoints**
    - Reduce from 5 to 3 breakpoints
    - Test at each breakpoint
    - Fix mobile bottom nav sizing

11. **Canvas toolbar cleanup**
    - Remove per-button styling
    - Group buttons with dividers
    - Active tool indication (teal background)

12. **Accessibility pass**
    - Add focus-visible rings
    - Fix contrast ratios
    - Verify touch targets

### Phase 4: Consistency Pass
**Goal:** Final sweep to catch anything missed.

13. **Remove all remaining hardcoded values**
    - Grep for hex colors, px values outside the token system
    - Replace with variables

14. **Remove dead CSS**
    - Delete any rules that are no longer referenced
    - Delete commented-out code

15. **Test print styles**
    - Verify print output still works after visual changes
    - Update print-specific overrides for new styling

---

## Appendix: Quick Reference — Current vs. Proposed

| Element | Current | Proposed |
|---------|---------|----------|
| Header | Navy-teal gradient, glass buttons | Solid navy, clean buttons |
| Primary button | Navy gradient, hover lift, ripple | Solid navy, darker on hover |
| Selected option | Green gradient bg, green border + shadow | Teal border, teal tint bg |
| Card | White, gray-100 border, shadow-sm, hover shadow-md | White, gray-200 border, no shadow |
| Modal header | Navy-teal gradient (or yellow, or green) | White bg, dark text, color icon |
| BOM category row | Dark navy (#1e3a5f), white text | Light gray bg, dark text |
| Step indicator | 28px circle, 11px label, blue glow active | 32px circle, 12px label, solid navy active |
| Toolbar hover | scale(1.05), shadow increase | Background color change only |
| Button hover | translateY(-1px) | Background color change only |
| Gradient usage | Everywhere (header, buttons, modals, badges) | Nowhere (solid colors throughout) |
| Font minimum | 10px | 11px (12px for navigation) |

---

*This plan should be implemented after the architecture refactor is stable. Visual changes are purely CSS/HTML and carry low risk of breaking functionality, but testing should verify that JavaScript-driven class toggles still work correctly with renamed/restructured classes.*
