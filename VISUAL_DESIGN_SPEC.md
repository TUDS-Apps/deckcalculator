# TUDS Pro Deck Calculator — Visual Design Specification

> Component-by-component design spec with exact CSS values.
> Goal: polished, modern, professional tool that feels like Stripe/Linear quality — not a Bootstrap prototype.
> Every spec references existing design tokens from `deckcalculatorstyles.css :root`.

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Page Shell & Background](#2-page-shell--background)
3. [Header](#3-header)
4. [Step Sidebar Navigation](#4-step-sidebar-navigation)
5. [Config Panel (Left Sidebar)](#5-config-panel-left-sidebar)
6. [Cards (Mode Selection, Templates, Info)](#6-cards)
7. [Buttons](#7-buttons)
8. [Form Inputs & Selects](#8-form-inputs--selects)
9. [Canvas Area](#9-canvas-area)
10. [Floating Toolbar](#10-floating-toolbar)
11. [BOM Table](#11-bom-table)
12. [Persistent Footer](#12-persistent-footer)
13. [Modals & Overlays](#13-modals--overlays)
14. [Transitions & Micro-interactions](#14-transitions--micro-interactions)
15. [Loading & Skeleton States](#15-loading--skeleton-states)
16. [Empty States](#16-empty-states)
17. [Notification Toasts](#17-notification-toasts)
18. [Icons](#18-icons)
19. [Accessibility](#19-accessibility)
20. [What NOT to Do](#20-what-not-to-do)

---

## 1. Design Philosophy

### The look we're going for

**Stripe's dashboard meets a professional construction tool.** Clean, spacious, confident. Not playful, not corporate-bland. The kind of tool where a salesperson feels fast and a consumer feels guided.

### Principles

1. **Whitespace is a feature.** Don't fill every pixel. Let elements breathe. Padding inside panels should feel generous, not cramped. Research shows whitespace improves comprehension by 20%.

2. **One color does the talking.** The navy header anchors the brand. The teal accent highlights the current action. Everything else is neutral. If more than 2 elements are competing for attention, the design is wrong.

3. **Depth through shadows, not borders.** Use shadows to create hierarchy. Borders are for grouping (input fields, table cells). Shadows are for elevation (cards, dropdowns, floating toolbar). Don't use both on the same element.

4. **Motion means something.** Every transition communicates: "this appeared" (fade in), "this moved" (slide), "this changed" (scale pulse). No animation without purpose. 200ms for interactions, 300ms for layout shifts.

5. **Consistency is the design.** Every button that does the same thing should look the same. Every panel should have the same padding. Every shadow should come from the same token. Inconsistency is what makes an app feel "dated."

---

## 2. Page Shell & Background

### Current problem
`body` has `class="bg-gray-200 p-4 md:p-8"` — the gray-200 background makes the whole app feel like a form inside a form. The padding creates unnecessary margins on all sides.

### Spec

```css
body {
  background: var(--gray-50);           /* #FAFAFA — barely off-white */
  margin: 0;
  padding: 0;
  min-height: 100vh;
  font-family: var(--font-family);
  font-size: var(--text-base);          /* 14px */
  color: var(--gray-800);              /* #27272A — primary text */
  line-height: var(--leading-normal);   /* 1.5 */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### Why
- `gray-50` (#FAFAFA) instead of `gray-200` (#E4E4E7): Subtle off-white gives cards and panels definition against the background without the "inside a dialog box" feel.
- Full viewport, no body padding — the app owns the entire screen.
- Anti-aliased font rendering for crisp Inter on all platforms.

---

## 3. Header

### Current problem
The header has negative margins (`margin: -1rem -1rem 0.5rem -1rem`) as a hack to span the full width despite body padding. The logo and text scale awkwardly on mobile. Help/Feedback buttons use background colors that make them look like primary CTAs.

### Spec

```css
.deck-calculator-header {
  background: var(--tuds-navy);         /* #133A52 */
  padding: 0 var(--space-6);           /* 0 24px — no vertical padding waste */
  height: 56px;                        /* Fixed height, not content-driven */
  display: flex;
  align-items: center;
  border-bottom: none;                 /* Shadow provides separation, not border */
  box-shadow: 0 1px 3px rgba(0,0,0,0.12);
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);           /* 200 */
}

.header-content {
  display: flex;
  align-items: center;
  gap: var(--space-4);                 /* 16px */
  width: 100%;
  max-width: 100%;
}

.header-logo {
  height: 28px;                        /* Slightly smaller, crisper */
  width: auto;
  flex-shrink: 0;
}

.deck-calculator-header h1 {
  font-size: var(--text-lg);           /* 18px */
  font-weight: var(--font-semibold);   /* 600 */
  color: var(--surface-primary);       /* White */
  margin: 0;
  white-space: nowrap;
}

.header-subtitle {
  font-size: var(--text-sm);           /* 12px */
  color: var(--tuds-green);           /* #83AD54 */
  font-weight: var(--font-medium);     /* 500 */
}
```

### Header action buttons (Help, Admin, Sign In)

```css
.header-action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);                 /* 4px */
  padding: var(--space-1) var(--space-3);  /* 4px 12px */
  height: 32px;
  background: transparent;             /* NOT colored — ghost style */
  color: rgba(255, 255, 255, 0.7);    /* Subdued white */
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-md);     /* 6px */
  font-size: var(--text-sm);          /* 12px */
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-fast); /* 150ms */
}

.header-action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.95);
  border-color: rgba(255, 255, 255, 0.25);
}

.header-action-btn svg {
  width: 14px;
  height: 14px;
}
```

### Why
- 56px fixed height is the modern standard for app headers (Notion, Linear, Figma all use 48-56px).
- Ghost-style action buttons don't compete with the brand or the page content.
- Sticky positioning keeps the header visible during scroll without eating vertical space.
- No border-radius on the header — it should span edge-to-edge.

---

## 4. Step Sidebar Navigation

### Current state
The step sidebar uses 64px width with icon circles and connecting lines. The active/complete states use color changes.

### Spec

```css
.step-sidebar {
  width: 64px;
  background: var(--surface-primary);   /* White */
  border-right: 1px solid var(--gray-200);
  padding: var(--space-4) 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;                              /* Connecting lines handle spacing */
  flex-shrink: 0;
}

.step-sidebar .wizard-step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-1);
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
  width: 100%;
}

.step-sidebar .step-number {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);           /* 12px */
  font-weight: var(--font-semibold);
  transition: all var(--transition-normal); /* 200ms */

  /* Default (pending) state */
  background: var(--gray-100);
  color: var(--gray-400);
  border: 2px solid var(--gray-200);
}

/* Active step */
.step-sidebar .wizard-step-item.active .step-number {
  background: var(--tuds-teal);
  color: white;
  border-color: var(--tuds-teal);
  box-shadow: 0 0 0 4px rgba(45, 106, 106, 0.15);  /* Glow ring */
}

/* Completed step */
.step-sidebar .wizard-step-item.complete .step-number {
  background: var(--tuds-green);
  color: white;
  border-color: var(--tuds-green);
}

/* Step name label */
.step-sidebar .step-name {
  font-size: 9px;                      /* Very small — icons are primary */
  font-weight: var(--font-medium);
  color: var(--gray-400);
  text-align: center;
  line-height: 1.2;
  max-width: 56px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.step-sidebar .wizard-step-item.active .step-name {
  color: var(--tuds-teal);
  font-weight: var(--font-semibold);
}

.step-sidebar .wizard-step-item.complete .step-name {
  color: var(--tuds-green);
}

/* Connecting line between steps */
.step-sidebar .wizard-step-item:not(:last-child)::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 50%;
  transform: translateX(-50%);
  width: 2px;
  height: 8px;
  background: var(--gray-200);
  transition: background var(--transition-normal);
}

.step-sidebar .wizard-step-item.complete:not(:last-child)::after {
  background: var(--tuds-green);
}

/* Hover effect on clickable steps */
.step-sidebar .wizard-step-item:not(.unavailable):hover .step-number {
  transform: scale(1.08);
  box-shadow: var(--shadow-sm);
}
```

### Why
- The glow ring on the active step number draws the eye instantly.
- Completed steps use green (success semantic) not just a color variant.
- Hover scale (1.08) gives tactile feedback that the step is clickable.
- 9px step names are intentional — the icon/number is the primary identifier, the label is a hint.

---

## 5. Config Panel (Left Sidebar)

### Spec

```css
#input-panel {
  width: 300px;                        /* Slightly wider than current 280px */
  background: var(--surface-primary);  /* White */
  border-right: 1px solid var(--gray-200);
  overflow-y: auto;
  overflow-x: hidden;
  flex-shrink: 0;
  padding: 0;                         /* Sections handle their own padding */
}

/* Scrollbar styling */
#input-panel::-webkit-scrollbar {
  width: 4px;
}

#input-panel::-webkit-scrollbar-track {
  background: transparent;
}

#input-panel::-webkit-scrollbar-thumb {
  background: var(--gray-300);
  border-radius: var(--radius-full);
}

#input-panel::-webkit-scrollbar-thumb:hover {
  background: var(--gray-400);
}

/* Panel sections */
.wizard-step-content {
  padding: var(--space-5);             /* 20px — generous internal padding */
}

.wizard-step-content h3,
.wizard-step-title {
  font-size: var(--text-md);           /* 16px */
  font-weight: var(--font-semibold);
  color: var(--gray-900);
  margin: 0 0 var(--space-4) 0;       /* 16px bottom margin */
  padding-bottom: var(--space-3);      /* 12px */
  border-bottom: 1px solid var(--gray-100);
}

/* Section dividers between config groups */
.config-section {
  padding: var(--space-4) 0;
  border-bottom: 1px solid var(--gray-100);
}

.config-section:last-child {
  border-bottom: none;
}

/* Config section labels */
.config-label {
  font-size: var(--text-sm);           /* 12px */
  font-weight: var(--font-semibold);
  color: var(--gray-500);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-3);
}
```

### Why
- 300px width gives form controls more room (300px is the Figma/VS Code standard for property panels).
- Custom thin scrollbar doesn't fight for horizontal space.
- Uppercase small labels for section headings create visual hierarchy without taking vertical space.
- Generous padding (20px) prevents the "cramped form" feeling.

---

## 6. Cards

### Mode selection cards (Step 0)

```css
.mode-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);                 /* 12px */
  padding: var(--space-5) var(--space-4);  /* 20px 16px */
  background: var(--surface-primary);
  border: 1.5px solid var(--gray-200);    /* Slightly thinner than current 2px */
  border-radius: var(--radius-xl);     /* 12px */
  cursor: pointer;
  transition: all var(--transition-normal); /* 200ms */
  text-align: center;
  min-height: 140px;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.mode-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: transparent;
  transition: background var(--transition-normal);
}

.mode-card:hover {
  border-color: var(--tuds-teal);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.mode-card:hover::before {
  background: var(--tuds-teal);        /* Colored top accent on hover */
}

.mode-card.selected {
  border-color: var(--tuds-teal);
  background: var(--surface-primary);  /* Stay white, not tinted */
  box-shadow: 0 0 0 3px rgba(45, 106, 106, 0.15);
}

.mode-card.selected::before {
  background: var(--tuds-teal);        /* Persistent top accent when selected */
}

.mode-card-icon {
  width: 40px;
  height: 40px;
  padding: var(--space-2);
  background: var(--gray-50);
  border-radius: var(--radius-lg);     /* 8px */
  color: var(--tuds-navy);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-normal);
}

.mode-card.selected .mode-card-icon {
  background: var(--tuds-teal-muted);
  color: var(--tuds-teal);
}

.mode-card:hover .mode-card-icon {
  background: var(--tuds-teal-muted);
  color: var(--tuds-teal);
}

.mode-card-label {
  font-size: var(--text-base);         /* 14px */
  font-weight: var(--font-semibold);
  color: var(--gray-900);
}

.mode-card-desc {
  font-size: var(--text-xs);           /* 11px */
  color: var(--gray-500);
  line-height: var(--leading-normal);
}
```

### Shape entry cards (new — for Enter Dimensions / Template / Custom Draw)

```css
.shape-entry-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-4);
  background: var(--surface-primary);
  border: 1.5px solid var(--gray-200);
  border-radius: var(--radius-xl);
  cursor: pointer;
  transition: all var(--transition-normal);
  text-align: center;
  flex: 1;
  min-width: 0;
}

.shape-entry-card:hover {
  border-color: var(--tuds-blue-accent);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.shape-entry-card.active {
  border-color: var(--tuds-blue-accent);
  box-shadow: 0 0 0 3px rgba(43, 133, 186, 0.15);
}

.shape-entry-card-icon {
  width: 48px;
  height: 48px;
  color: var(--gray-400);
  transition: color var(--transition-normal);
}

.shape-entry-card:hover .shape-entry-card-icon {
  color: var(--tuds-blue-accent);
}

.shape-entry-card-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--gray-800);
}

.shape-entry-card-desc {
  font-size: var(--text-xs);
  color: var(--gray-500);
  line-height: var(--leading-normal);
}
```

### Info/tip cards (used in config panels for explanatory content)

```css
.info-card {
  padding: var(--space-3) var(--space-4);
  background: var(--color-info-light);
  border-radius: var(--radius-lg);
  border-left: 3px solid var(--color-info);
  font-size: var(--text-sm);
  color: var(--gray-700);
  line-height: var(--leading-normal);
}

.warning-card {
  padding: var(--space-3) var(--space-4);
  background: var(--color-warning-light);
  border-radius: var(--radius-lg);
  border-left: 3px solid var(--color-warning);
  font-size: var(--text-sm);
  color: var(--gray-700);
}
```

### Why
- The `::before` colored top accent is a modern pattern (used by Stripe, Linear, Notion) that provides a subtle branded touch without overwhelming the card.
- Icons sit in a small rounded-square container (`gray-50` background) — this is the 2025 pattern replacing bare icons floating in space.
- Selected state uses a glow ring (`box-shadow`) instead of a background tint — cleaner, more modern.
- Info/warning cards use left-border accent (Stripe pattern) for quick visual scanning.

---

## 7. Buttons

### Button base

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);                 /* 8px */
  padding: var(--space-2) var(--space-4);  /* 8px 16px */
  height: 36px;                        /* Consistent height */
  font-size: var(--text-sm);           /* 12px */
  font-weight: var(--font-medium);     /* 500 */
  font-family: var(--font-family);
  border-radius: var(--radius-md);     /* 6px */
  border: 1px solid transparent;
  cursor: pointer;
  transition: all var(--transition-fast);  /* 150ms */
  white-space: nowrap;
  user-select: none;
  position: relative;
  overflow: hidden;
}

.btn:active {
  transform: scale(0.98);             /* Subtle press feedback */
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.btn svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
```

### Primary button

```css
.btn-primary {
  background: var(--tuds-navy);
  color: white;
  border-color: var(--tuds-navy);
  box-shadow: 0 1px 2px rgba(19, 58, 82, 0.2);  /* Subtle depth */
}

.btn-primary:hover {
  background: var(--tuds-navy-light);  /* #1A5070 — lighter, not darker */
  border-color: var(--tuds-navy-light);
  box-shadow: 0 2px 4px rgba(19, 58, 82, 0.25);
}

.btn-primary:focus-visible {
  box-shadow: 0 0 0 3px rgba(19, 58, 82, 0.3);
}
```

### Secondary button

```css
.btn-secondary {
  background: var(--surface-primary);
  color: var(--gray-700);
  border-color: var(--gray-300);
}

.btn-secondary:hover {
  background: var(--gray-50);
  border-color: var(--gray-400);
  color: var(--gray-800);
}
```

### Ghost button (for toolbar, less emphasis)

```css
.btn-ghost {
  background: transparent;
  color: var(--gray-600);
  border: none;
  padding: var(--space-2);
}

.btn-ghost:hover {
  background: var(--gray-100);
  color: var(--gray-800);
}
```

### Success button (for "Generate Plan", "Add to Cart")

```css
.btn-success {
  background: var(--tuds-green);
  color: white;
  border-color: var(--tuds-green);
  box-shadow: 0 1px 2px rgba(131, 173, 84, 0.2);
}

.btn-success:hover {
  background: var(--tuds-green-light);
  border-color: var(--tuds-green-light);
  box-shadow: 0 2px 4px rgba(131, 173, 84, 0.25);
}
```

### Danger button (for "Clear Canvas", "Delete")

```css
.btn-danger {
  background: transparent;
  color: var(--color-error);
  border-color: var(--color-error);
}

.btn-danger:hover {
  background: var(--color-error);
  color: white;
}
```

### Button sizes

```css
.btn-sm {
  height: 28px;
  padding: var(--space-1) var(--space-3);  /* 4px 12px */
  font-size: var(--text-xs);               /* 11px */
}

.btn-lg {
  height: 44px;
  padding: var(--space-3) var(--space-6);  /* 12px 24px */
  font-size: var(--text-base);             /* 14px */
  font-weight: var(--font-semibold);
}
```

### Why
- Fixed heights (28/36/44px) instead of padding-only sizing ensures all buttons align consistently in rows.
- Hover lightens primary buttons instead of darkening — modern pattern, feels more alive.
- `scale(0.98)` on active gives physical "press" feedback in 150ms.
- Ghost buttons for toolbar actions prevent visual clutter.
- Danger buttons are outlined by default, fill on hover — prevents accidental destructive clicks.
- Subtle box-shadows on primary/success buttons create a "raised" feel without neumorphism excess.

---

## 8. Form Inputs & Selects

### Text inputs

```css
.form-input,
input[type="text"],
input[type="number"],
input[type="email"] {
  display: block;
  width: 100%;
  height: 36px;
  padding: 0 var(--space-3);           /* 0 12px */
  font-size: var(--text-base);         /* 14px */
  font-family: var(--font-family);
  color: var(--gray-800);
  background: var(--surface-primary);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);     /* 6px */
  transition: all var(--transition-fast);
  outline: none;
}

.form-input:hover,
input:hover {
  border-color: var(--gray-400);
}

.form-input:focus,
input:focus {
  border-color: var(--tuds-teal);
  box-shadow: 0 0 0 3px rgba(45, 106, 106, 0.1);
}

.form-input::placeholder,
input::placeholder {
  color: var(--gray-400);
  font-weight: var(--font-normal);
}

/* Error state */
.form-input.error,
input.error {
  border-color: var(--color-error);
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
}

/* Disabled state */
.form-input:disabled,
input:disabled {
  background: var(--gray-50);
  color: var(--gray-400);
  cursor: not-allowed;
}
```

### Labels

```css
.form-label,
label {
  display: block;
  font-size: var(--text-sm);           /* 12px */
  font-weight: var(--font-medium);     /* 500 */
  color: var(--gray-700);
  margin-bottom: var(--space-1);       /* 4px gap below label */
}

/* Form group (label + input + helper text) */
.form-group {
  margin-bottom: var(--space-4);       /* 16px between groups */
}

/* Helper text below input */
.form-helper {
  font-size: var(--text-xs);           /* 11px */
  color: var(--gray-500);
  margin-top: var(--space-1);
}

.form-helper.error {
  color: var(--color-error);
}
```

### Select dropdowns

```css
.form-select,
select {
  display: block;
  width: 100%;
  height: 36px;
  padding: 0 var(--space-8) 0 var(--space-3);  /* Extra right padding for arrow */
  font-size: var(--text-base);
  font-family: var(--font-family);
  color: var(--gray-800);
  background: var(--surface-primary);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23A1A1AA' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  cursor: pointer;
  transition: all var(--transition-fast);
  outline: none;
}

.form-select:hover,
select:hover {
  border-color: var(--gray-400);
}

.form-select:focus,
select:focus {
  border-color: var(--tuds-teal);
  box-shadow: 0 0 0 3px rgba(45, 106, 106, 0.1);
}
```

### Inline dimension inputs (side-by-side width × depth)

```css
.dimension-input-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.dimension-input-group input {
  flex: 1;
  text-align: center;
}

.dimension-separator {
  font-size: var(--text-md);
  color: var(--gray-400);
  font-weight: var(--font-medium);
  flex-shrink: 0;
}
```

### Why
- Consistent 36px height across all inputs and selects — they align perfectly in rows.
- Focus state uses teal glow ring (matching step sidebar active state) — creates visual language: "teal = active/focused."
- Labels above inputs (not floating) — research confirms this is more usable and accessible.
- Custom select arrow using inline SVG avoids browser inconsistencies.
- Error states use red glow ring to match focus pattern — consistent mental model.

---

## 9. Canvas Area

### Container

```css
#canvasContainer {
  position: relative;
  flex: 1;                             /* Fill remaining space */
  min-height: 0;                       /* Allow flex shrinking */
  background: var(--surface-primary);
  border-radius: 0;                    /* No radius — flush with layout */
  overflow: hidden;
  border: none;                        /* Shadow on parent provides separation */
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--surface-primary);
}

/* Canvas container in the main content area */
#main-content-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--gray-50);          /* Subtle contrast with white panels */
  padding: var(--space-3);             /* Small padding around canvas */
}
```

### Canvas card wrapper (optional — gives canvas a card-like elevated feel)

```css
.canvas-wrapper {
  flex: 1;
  min-height: 0;
  background: var(--surface-primary);
  border-radius: var(--radius-lg);     /* 8px */
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  position: relative;
}
```

### Why
- The canvas sits inside a subtle gray background area with a white card wrapper — this creates the "canvas is a workspace" feeling used by Figma and Canva.
- `flex: 1` and `min-height: 0` ensure the canvas fills available space without overflowing.

---

## 10. Floating Toolbar

### Canvas toolbar (floating over top-left of canvas)

```css
.canvas-toolbar {
  position: absolute;
  top: var(--space-3);
  left: var(--space-3);
  display: flex;
  gap: var(--space-1);
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: var(--space-1);
  z-index: 10;
}

.canvas-toolbar .btn-ghost {
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.canvas-toolbar .btn-ghost.active {
  background: var(--tuds-teal-muted);
  color: var(--tuds-teal);
}

.canvas-toolbar .btn-ghost svg {
  width: 18px;
  height: 18px;
}

/* Separator between tool groups */
.canvas-toolbar .toolbar-separator {
  width: 1px;
  background: var(--gray-200);
  margin: var(--space-1) 0;
}
```

### Zoom controls (floating bottom-right of canvas)

```css
.zoom-controls {
  position: absolute;
  bottom: var(--space-3);
  right: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: var(--space-1);
  z-index: 10;
}

.zoom-controls .btn-ghost {
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: var(--radius-md);
}

.zoom-level {
  font-size: var(--text-xs);
  color: var(--gray-500);
  text-align: center;
  padding: var(--space-1) 0;
  min-width: 32px;
  user-select: none;
}
```

### Why
- Floating toolbars with `shadow-md` feel like they're hovering above the canvas — the Figma pattern.
- Ghost buttons inside toolbars keep it clean; active state uses teal tint.
- Separated zoom controls in bottom-right don't interfere with drawing in the main canvas area.

---

## 11. BOM Table

### Table styling

```css
.bom-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: var(--text-sm);
}

.bom-table th {
  background: var(--gray-50);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--gray-500);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: var(--space-2) var(--space-3);
  text-align: left;
  border-bottom: 2px solid var(--gray-200);
  position: sticky;
  top: 0;
  z-index: 1;
}

.bom-table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--gray-100);
  color: var(--gray-700);
  vertical-align: middle;
}

/* Alternating rows */
.bom-table .bom-row-even td {
  background: var(--gray-50);
}

/* Hover rows */
.bom-table .bom-data-row:hover td {
  background: rgba(45, 106, 106, 0.04);  /* Very subtle teal tint */
}

/* Category headers */
.bom-category-header {
  cursor: pointer;
}

.bom-category-header td {
  background: var(--tuds-navy) !important;
  color: white;
  font-weight: var(--font-semibold);
  font-size: var(--text-sm);
  padding: var(--space-2) var(--space-3);
  border-bottom: none;
}

.bom-category-header:hover td {
  background: var(--tuds-navy-light) !important;
}

/* Category subtotal */
.category-subtotal-cell {
  font-weight: var(--font-semibold);
  text-align: right;
  font-variant-numeric: tabular-nums;  /* Aligned numbers */
}

/* Grand total row */
.bom-total-row td {
  background: var(--gray-50);
  font-weight: var(--font-bold);
  font-size: var(--text-base);
  color: var(--gray-900);
  padding: var(--space-3) var(--space-3);
  border-top: 2px solid var(--gray-300);
}

/* Price formatting */
.price-cell {
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}
```

### Why
- `font-variant-numeric: tabular-nums` makes all numbers use fixed-width digits — prices align perfectly in columns.
- Uppercase tiny headers (`text-xs`, `letter-spacing`) is the Stripe/Linear table pattern — clean, doesn't dominate.
- Sticky headers so category/column headers stay visible when scrolling long BOMs.
- Navy category headers maintain brand identity and create strong visual grouping.
- Very subtle teal hover tint ties back to the overall teal = "active" visual language.

---

## 12. Persistent Footer

### Spec

```css
.app-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 52px;
  background: var(--surface-primary);
  border-top: 1px solid var(--gray-200);
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);  /* Upward shadow */
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-6);
  z-index: var(--z-sticky);
}

.footer-estimate {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.footer-estimate-label {
  font-size: var(--text-sm);
  color: var(--gray-500);
}

.footer-estimate-value {
  font-size: var(--text-lg);           /* 18px — the hero number */
  font-weight: var(--font-bold);
  color: var(--gray-900);
  font-variant-numeric: tabular-nums;
}

.footer-estimate-value.pending {
  color: var(--gray-400);
  font-style: italic;
  font-weight: var(--font-normal);
  font-size: var(--text-base);
}

.footer-step-indicator {
  font-size: var(--text-sm);
  color: var(--gray-500);
}

.footer-step-indicator strong {
  color: var(--gray-700);
}

.footer-actions {
  display: flex;
  gap: var(--space-2);
}
```

### Why
- The estimated total is the largest text element in the footer (18px bold) — it's the hero number that rewards the user's work.
- Upward shadow creates the floating effect without a heavy border.
- Pending state (italic, gray) clearly communicates "we don't have a number yet" without being alarming.

---

## 13. Modals & Overlays

### Modal base

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);     /* Not too dark */
  backdrop-filter: blur(4px);          /* Modern frosted glass effect */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  animation: fadeIn 200ms ease;
}

.modal {
  background: var(--surface-primary);
  border-radius: var(--radius-xl);     /* 12px */
  box-shadow: var(--shadow-xl);
  width: 90%;
  max-width: 520px;
  max-height: 85vh;
  overflow-y: auto;
  animation: slideUp 200ms ease;
}

.modal-header {
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--gray-100);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-header h2 {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--gray-900);
  margin: 0;
}

.modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--gray-400);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.modal-close:hover {
  background: var(--gray-100);
  color: var(--gray-600);
}

.modal-body {
  padding: var(--space-6);
}

.modal-footer {
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--gray-100);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### Why
- `backdrop-filter: blur(4px)` is the modern overlay pattern — adds depth without full blackout.
- `slideUp` animation (8px travel, 200ms) is subtle but makes the modal feel like it emerged from the content, not teleported.
- Max height 85vh with overflow scroll prevents modals from exceeding viewport on small screens.

---

## 14. Transitions & Micro-interactions

### Global transition rules

Every interactive element should have a transition. No element should snap between states.

```css
/* Apply to ALL interactive elements */
button, .btn, a, input, select, .mode-card, .wizard-step-item,
.bom-category-header, .shape-entry-card {
  transition: all var(--transition-fast);  /* 150ms ease */
}

/* Layout transitions (panels appearing/disappearing, step content switching) */
.transition-layout {
  transition: all var(--transition-slow);  /* 300ms ease */
}

/* Respect user motion preferences */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Specific micro-interactions

**Step transitions (wizard step content changing):**
```css
.wizard-step-content {
  opacity: 0;
  transform: translateX(8px);
  transition: opacity 200ms ease, transform 200ms ease;
}

.wizard-step-content.active {
  opacity: 1;
  transform: translateX(0);
}
```

**Success flash (after calculation completes):**
```css
@keyframes successPulse {
  0% { box-shadow: 0 0 0 0 rgba(131, 173, 84, 0.3); }
  50% { box-shadow: 0 0 0 8px rgba(131, 173, 84, 0); }
  100% { box-shadow: 0 0 0 0 rgba(131, 173, 84, 0); }
}

.calculation-complete {
  animation: successPulse 600ms ease;
}
```

**Estimate update (footer number changing):**
```css
@keyframes numberUpdate {
  0% { opacity: 0.5; transform: translateY(-4px); }
  100% { opacity: 1; transform: translateY(0); }
}

.footer-estimate-value.updated {
  animation: numberUpdate 300ms ease;
}
```

**Skeleton shimmer (loading state):**
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(90deg, var(--gray-100) 25%, var(--gray-200) 50%, var(--gray-100) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-md);
}
```

### Why
- 150ms for interactions (hover, focus) — fast enough to feel instant, slow enough to be visible.
- 200ms for content transitions (step switching) — gives the eye time to track the change.
- 300ms for layout changes (panel expanding, modal appearing) — prevents jarring jumps.
- `prefers-reduced-motion` media query is mandatory for accessibility — users with vestibular disorders need this.
- Success pulse draws attention to the result without blocking the flow.

---

## 15. Loading & Skeleton States

### When to use each

| Duration | What to show |
|----------|-------------|
| < 300ms | Nothing — don't flash a loader for instant operations |
| 300ms–1s | Inline spinner next to the trigger button |
| 1s–5s | Skeleton screen replacing the content area |
| 5s+ | Progress indicator with percentage or step info |

### Button loading state

```css
.btn.loading {
  position: relative;
  color: transparent;              /* Hide text */
  pointer-events: none;
}

.btn.loading::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 500ms linear infinite;
}

.btn-secondary.loading::after {
  border-color: rgba(0,0,0,0.1);
  border-top-color: var(--gray-600);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### Skeleton for BOM loading (while Shopify prices fetch)

```css
.bom-skeleton-row {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
}

.bom-skeleton-row .skeleton {
  height: 14px;
}

.bom-skeleton-row .skeleton:nth-child(1) { width: 40px; }   /* Qty */
.bom-skeleton-row .skeleton:nth-child(2) { flex: 2; }       /* Item */
.bom-skeleton-row .skeleton:nth-child(3) { flex: 3; }       /* Description */
.bom-skeleton-row .skeleton:nth-child(4) { width: 60px; }   /* Price */
```

### Why
- The 300ms threshold prevents "flash of loader" for fast operations.
- Button loading hides text and shows spinner in-place — no layout shift.
- Skeleton rows match the actual BOM row layout so the transition from loading to loaded feels seamless.

---

## 16. Empty States

### Canvas empty state (when no shape is drawn)

```css
.canvas-empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  text-align: center;
  pointer-events: none;               /* Clicks pass through to canvas */
  z-index: 5;
  padding: var(--space-8);
}

.canvas-empty-state-icon {
  width: 64px;
  height: 64px;
  color: var(--gray-300);
}

.canvas-empty-state-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--gray-500);
}

.canvas-empty-state-hint {
  font-size: var(--text-sm);
  color: var(--gray-400);
  max-width: 300px;
  line-height: var(--leading-relaxed);
}

/* Fade out when drawing starts */
.canvas-empty-state.hidden {
  opacity: 0;
  transition: opacity 300ms ease;
  pointer-events: none;
}
```

### Section empty state (when a config section has no data)

```css
.section-empty {
  padding: var(--space-6) var(--space-4);
  text-align: center;
}

.section-empty-icon {
  width: 40px;
  height: 40px;
  color: var(--gray-300);
  margin: 0 auto var(--space-3);
}

.section-empty-text {
  font-size: var(--text-sm);
  color: var(--gray-400);
  line-height: var(--leading-normal);
}
```

---

## 17. Notification Toasts

### For success messages, errors, and info

```css
.toast-container {
  position: fixed;
  bottom: calc(52px + var(--space-4)); /* Above the persistent footer */
  right: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  z-index: var(--z-tooltip);
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--gray-900);
  color: white;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  font-size: var(--text-sm);
  min-width: 280px;
  max-width: 400px;
  animation: slideInRight 300ms ease;
}

.toast.success {
  border-left: 3px solid var(--color-success);
}

.toast.error {
  border-left: 3px solid var(--color-error);
}

.toast.info {
  border-left: 3px solid var(--color-info);
}

.toast-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.toast.success .toast-icon { color: var(--color-success); }
.toast.error .toast-icon { color: var(--color-error); }
.toast.info .toast-icon { color: var(--color-info); }

.toast-dismiss {
  margin-left: auto;
  background: none;
  border: none;
  color: rgba(255,255,255,0.5);
  cursor: pointer;
  padding: var(--space-1);
}

.toast-dismiss:hover {
  color: white;
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(16px); }
  to { opacity: 1; transform: translateX(0); }
}
```

### Why
- Dark toasts on light backgrounds provide high contrast and clear visual separation.
- Positioned above the footer so they don't get hidden.
- Left-border accent color matches the info/warning/error card pattern — consistent visual language.
- Auto-dismiss after 4 seconds for success, persist until dismissed for errors.

---

## 18. Icons

### Replace all inline SVGs with Lucide

**Add to `<head>` in index.html:**
```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
```

**Usage pattern:**
```html
<i data-lucide="home" class="icon-sm"></i>
<i data-lucide="pencil" class="icon-md"></i>
```

**Initialize in JS:**
```js
lucide.createIcons();
```

**Icon size classes:**
```css
.icon-xs { width: 14px; height: 14px; }
.icon-sm { width: 16px; height: 16px; }
.icon-md { width: 20px; height: 20px; }
.icon-lg { width: 24px; height: 24px; }
.icon-xl { width: 32px; height: 32px; }
```

### Suggested icon mapping

| Current usage | Lucide icon name |
|---|---|
| Mode: Full Build | `building-2` |
| Mode: Framing Only | `frame` |
| Mode: Decking Only | `layers` |
| Mode: Railing Only | `fence` |
| Mode: Custom Combo | `settings-2` |
| Draw/Pencil | `pencil` |
| Edit/Select | `mouse-pointer` |
| Measure | `ruler` |
| Zoom In | `zoom-in` |
| Zoom Out | `zoom-out` |
| Undo | `undo-2` |
| Redo | `redo-2` |
| Delete/Clear | `trash-2` |
| Save | `save` |
| Download PDF | `file-down` |
| Email | `mail` |
| Cart | `shopping-cart` |
| Settings/Admin | `settings` |
| Help | `help-circle` |
| User/Sign In | `user` |
| Stairs | `stairs` (or `arrow-up-right`) |
| Structure | `box` |
| Expand/Collapse | `chevron-down` / `chevron-right` |
| Check/Complete | `check` |
| Close | `x` |
| Info | `info` |
| Warning | `alert-triangle` |
| Grid | `grid-3x3` |
| Move | `move` |
| Blueprint | `file-text` |

### Why
- Lucide has 1500+ icons with consistent 1.5px stroke weight — no more mixing hand-drawn SVGs.
- CDN load means no build step needed for this vanilla JS app.
- `lucide.createIcons()` auto-replaces `<i data-lucide="...">` elements, making migration straightforward.
- Size classes (xs through xl) enforce consistency — no more inline `width="24" height="24"` scattered through HTML.

---

## 19. Accessibility

### Focus management

```css
/* Already exists but verify it's strong enough */
:focus-visible {
  outline: 2px solid var(--tuds-teal);
  outline-offset: 2px;
}

/* Skip to main content link (add if missing) */
.skip-link {
  position: absolute;
  top: -100%;
  left: var(--space-4);
  background: var(--tuds-navy);
  color: white;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  z-index: 9999;
  font-size: var(--text-sm);
}

.skip-link:focus {
  top: var(--space-2);
}
```

### Color contrast requirements

| Element | Foreground | Background | Ratio | WCAG |
|---|---|---|---|---|
| Body text | `gray-800` #27272A | `white` #FFFFFF | 14.7:1 | AAA |
| Secondary text | `gray-500` #71717A | `white` #FFFFFF | 5.2:1 | AA |
| Labels | `gray-700` #3F3F46 | `white` #FFFFFF | 9.4:1 | AAA |
| Button primary | `white` | `tuds-navy` #133A52 | 10.8:1 | AAA |
| Step name (active) | `tuds-teal` #2D6A6A | `white` | 5.4:1 | AA |
| Grid lines | `gray-200` #E4E4E7 | `white` | 1.3:1 | Decorative (OK) |

### Touch targets

All interactive elements must be minimum 44×44px on touch devices (Apple HIG):
```css
@media (pointer: coarse) {
  .btn, .header-action-btn, .canvas-toolbar .btn-ghost,
  .wizard-step-item, .mode-card {
    min-height: 44px;
    min-width: 44px;
  }
}
```

### Screen reader support

- All icons must have `aria-hidden="true"` when decorative, or `aria-label` when functional.
- Form inputs must have associated `<label>` elements.
- Step navigation must use `role="tablist"` with `aria-selected` on active step.
- Modals must trap focus and return focus to trigger element on close.
- BOM table must use proper `<thead>`, `<tbody>`, `<th scope="col">` markup.

---

## 20. What NOT to Do

These are anti-patterns to actively avoid:

1. **No gradients on backgrounds or buttons.** Flat colors only. Gradients look dated in tool UIs.
2. **No text-shadow on anything.** Text-shadow is a 2010s pattern. Use font-weight for emphasis instead.
3. **No box-shadow AND border on the same element.** Pick one. Shadow = elevation, border = grouping.
4. **No more than 2 font sizes in any single panel.** If you need a third size, the hierarchy is wrong.
5. **No color for color's sake.** If an element is colored (not gray/white/navy), it must mean something: teal = active, green = success, red = error, amber = warning.
6. **No animation longer than 500ms.** Anything slower feels sluggish. Most should be 150-200ms.
7. **No inline styles.** Everything goes through CSS classes using design tokens. No `style="background: #1e3a5f"` in HTML or JS.
8. **No pixel values in CSS.** Use tokens: `var(--space-4)` not `16px`, `var(--radius-lg)` not `8px`. Exception: 1px borders.
9. **No opacity on text for de-emphasis.** Use a lighter gray token instead. Opacity on text over non-white backgrounds creates inconsistent readability.
10. **No `!important` unless overriding third-party CSS (Tailwind).** If you need `!important`, the specificity chain is broken — fix the selector instead.

---

## Implementation Notes

This spec is designed to be implementable by Claude Code as a series of CSS replacements and HTML adjustments. The existing token system in `:root` already covers most values — the changes are about consistently USING those tokens instead of one-off values.

The migration can be done component-by-component:
1. Start with page shell and header (global impact, low risk)
2. Then buttons (used everywhere, high visual impact)
3. Then form inputs (config panel improvement)
4. Then cards (mode selection, templates)
5. Then BOM table
6. Then add new components (footer, toasts, empty states, loading)
7. Then icons (Lucide replacement)
8. Then transitions and micro-interactions (polish layer)
