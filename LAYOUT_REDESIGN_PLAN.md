# TUDS Pro Deck Calculator — Layout Redesign Plan

## Why This Plan Exists

The previous visual update (VISUAL_DESIGN_PLAN.md) replaced color tokens and removed dated CSS effects. That work was technically correct but visually invisible — the app looks the same because the **layout, proportions, spatial hierarchy, and page shell** didn't change. This plan addresses the structural changes that will create a visible "before and after" difference.

---

## The 5 Structural Changes

1. [Kill the sidebar, add horizontal progress](#1-kill-the-sidebar-add-horizontal-progress)
2. [Redesign the input panel as a proper tool panel](#2-redesign-the-input-panel)
3. [Give the canvas real presence](#3-give-the-canvas-real-presence)
4. [Full-viewport page shell](#4-full-viewport-page-shell)
5. [BOM as a proper quote/invoice](#5-bom-as-a-proper-quote)

---

## 1. Kill the Sidebar, Add Horizontal Progress

### Current Problem

A 64px vertical sidebar with numbered circles wastes horizontal space and looks like a 2020 form wizard. On a 1280px screen, you lose 64px + 16px gap = 80px to step numbers that the user glances at once.

### What to Build

Replace with a **horizontal step progress bar** inside the input panel header. This reclaims the sidebar width and gives the canvas more room.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ TUDS Pro Deck Estimator                              [Help] [Sign In]  │
├──────────────────────┬──────────────────────────────────────────────────┤
│ ● Draw ─── ○ Structure ─── ○ Stairs ─── ○ Review                      │
│                      │                                                  │
│  [Input Panel]       │           [Canvas - much wider now]              │
│  280px               │           flex: 1                                │
│                      │                                                  │
│                      │                                                  │
│                      │                                                  │
│                      │                                                  │
│                      ├──────────────────────────────────────────────────┤
│                      │           [BOM / Quote Section]                  │
└──────────────────────┴──────────────────────────────────────────────────┘
```

### HTML Changes

**Delete:**
```html
<!-- Remove the entire step-sidebar div -->
<div class="step-sidebar">
  <ul id="wizardStepList" class="step-sidebar-list">...</ul>
</div>
```

**Add** (inside the input panel, at the very top, above the wizard content):
```html
<div class="progress-bar">
  <div class="progress-steps" id="progressSteps">
    <!-- JS populates: step dots with labels, connected by a line -->
    <!-- Active: filled dot + bold label -->
    <!-- Complete: checkmark dot + muted label -->
    <!-- Future: empty dot + muted label -->
  </div>
</div>
```

### CSS Specification

```css
/* Progress bar at top of input panel */
.progress-bar {
  padding: 12px 16px;
  border-bottom: 1px solid var(--gray-200);
  background: var(--gray-50);
  border-radius: 8px 8px 0 0;
}

.progress-steps {
  display: flex;
  align-items: center;
  gap: 0;
  position: relative;
}

.progress-step {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  position: relative;
}

/* The connecting line between steps */
.progress-step:not(:last-child)::after {
  content: '';
  flex: 1;
  height: 2px;
  background: var(--gray-300);
  margin: 0 8px;
}

.progress-step.complete:not(:last-child)::after {
  background: var(--tuds-teal);
}

/* Step dot */
.progress-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--gray-300);
  background: white;
  flex-shrink: 0;
}

.progress-step.active .progress-dot {
  border-color: var(--tuds-navy);
  background: var(--tuds-navy);
}

.progress-step.complete .progress-dot {
  border-color: var(--tuds-teal);
  background: var(--tuds-teal);
}

/* Step label */
.progress-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--gray-400);
  white-space: nowrap;
}

.progress-step.active .progress-label {
  color: var(--tuds-navy);
  font-weight: 700;
}

.progress-step.complete .progress-label {
  color: var(--tuds-teal);
}
```

### Layout Change

```css
/* OLD: 3-column with sidebar */
.main-layout-with-sidebar {
  display: flex;
  gap: 16px;
}

/* NEW: 2-column, no sidebar */
.main-layout {
  display: flex;
  gap: 0;  /* No gap — panels are edge-to-edge */
  height: calc(100vh - 56px);  /* Full viewport minus header */
  overflow: hidden;
}
```

### Mobile

On mobile (<768px), the progress bar becomes sticky at top with dots only (no labels), and the input panel becomes a bottom sheet.

---

## 2. Redesign the Input Panel

### Current Problem

The input panel is a 280px `.info-card` (white background, border, shadow, padding) containing a `.wizard-panel` containing `.wizard-content` containing step divs. It looks like a form in a box — not like a tool panel. The card-in-a-card nesting adds visual clutter.

### What to Build

A clean, flush panel that looks like Figma's right sidebar or VS Code's sidebar — no card border, no outer padding, just content with clear section separation.

```
┌──────────────────────┐
│ ● Draw ── ○ Struct   │ ← progress bar
├──────────────────────┤
│                      │
│  Draw Your Deck      │ ← step title, larger
│                      │
│  Quick Rectangle     │ ← section header
│  ┌────┐   ┌────┐    │
│  │ 16 │ × │ 12 │ ft │ ← inputs
│  └────┘   └────┘    │
│  [Create Rectangle]  │
│                      │
│  ── Templates ──     │ ← divider with label
│  ┌───┐ ┌───┐ ┌───┐  │
│  │ □ │ │ ▬ │ │ L │  │ ← template cards
│  └───┘ └───┘ └───┘  │
│  ┌───┐ ┌───┐ ┌───┐  │
│  │ U │ │ ◣ │ │ ◢ │  │
│  └───┘ └───┘ └───┘  │
│                      │
│           [Next →]   │
└──────────────────────┘
```

### Key Changes

**1. Remove the card wrapper.** The panel is the sidebar itself — it has its own background and border-right, no inner card.

```css
#input-panel {
  width: 320px;             /* Slightly wider than 280px */
  background: white;
  border-right: 1px solid var(--gray-200);
  display: flex;
  flex-direction: column;
  height: 100%;             /* Fill available height */
  overflow: hidden;
}

/* Kill the info-card wrapper */
#input-panel .wizard-panel {
  background: none;
  border: none;
  box-shadow: none;
  padding: 0;
  border-radius: 0;
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
```

**2. Scrollable content area.** The step content scrolls independently. The step title and Next button are fixed.

```css
.wizard-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

/* Fixed step title at top */
.wizard-step-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--gray-900);
  padding: 16px 16px 0;
  margin: 0;
}

/* Fixed Next button at bottom */
.wizard-step-actions {
  padding: 12px 16px;
  border-top: 1px solid var(--gray-200);
  background: white;
}
```

**3. Section dividers instead of card boundaries.**

```css
.section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--gray-400);
  padding: 16px 0 8px;
  border-top: 1px solid var(--gray-100);
  margin-top: 16px;
}

/* First section-label has no top border */
.panel-content > .section-label:first-child,
.panel-content > *:first-child .section-label {
  border-top: none;
  margin-top: 0;
}
```

**4. Config sections (Structure step) — cleaner collapsed state.**

```css
.config-section-header {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--gray-100);
  cursor: pointer;
}

.config-section-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--gray-700);
  flex: 1;
}

.config-section-value {
  font-size: 13px;
  color: var(--tuds-teal);
  font-weight: 500;
  margin-right: 8px;
}

.config-change-btn {
  font-size: 12px;
  color: var(--tuds-teal);
  background: none;
  border: none;
  cursor: pointer;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
}

.config-change-btn:hover {
  background: var(--tuds-teal-muted);
}
```

**5. Visual selector cards — larger, clearer.**

Replace the current tiny 36x36 SVG icons with larger representations:

```css
.visual-option {
  padding: 12px 8px;
  border: 2px solid var(--gray-200);
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: border-color 150ms ease;
  text-align: center;
  min-height: 90px;          /* Taller cards */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.visual-option-icon {
  width: 48px;               /* Up from 36px */
  height: 48px;
  color: var(--gray-500);
}

.visual-option.selected {
  border-color: var(--tuds-teal);
  background: var(--tuds-teal-muted);
}

.visual-option-name {
  font-size: 13px;           /* Up from 11px */
  font-weight: 600;
  color: var(--gray-700);
}

.visual-option-desc {
  font-size: 11px;
  color: var(--gray-400);
}
```

---

## 3. Give the Canvas Real Presence

### Current Problem

The canvas sits inside an `.info-card` (white, bordered, rounded, shadowed) inside `#main-content-panel`. It competes visually with the input panel and BOM section — all three are equal-weight white cards. The canvas should dominate.

### What to Build

The canvas fills the entire right side of the viewport. No card wrapper. No padding between the input panel and canvas. The toolbar floats over it. It feels like the main workspace, not a widget.

```css
#content-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--gray-50);    /* Subtle gray, not white */
  position: relative;
  overflow: hidden;
}

/* Remove the info-card wrapper around canvas */
#content-panel > .info-card {
  background: none;
  border: none;
  box-shadow: none;
  padding: 0;
  border-radius: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

#canvasContainer {
  flex: 1;
  position: relative;
  background: white;
  /* Clean inset appearance */
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.06);
}

#deckCanvas {
  width: 100%;
  height: 100%;
}
```

### Floating Toolbar

The toolbar already floats, but needs to feel more integrated:

```css
.floating-controls {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 2px;
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.floating-controls .btn {
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: var(--gray-600);
}

.floating-controls .btn:hover {
  background: var(--gray-100);
  color: var(--gray-900);
}

.floating-controls .btn.active {
  background: var(--tuds-navy);
  color: white;
}

.floating-controls-divider {
  width: 1px;
  height: 20px;
  background: var(--gray-200);
  margin: 0 2px;
}
```

### Legend

Move the legend to the bottom-left of the canvas as a compact, semi-transparent overlay:

```css
.legend-panel {
  position: absolute;
  bottom: 12px;
  left: 12px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  max-width: 200px;
}
```

---

## 4. Full-Viewport Page Shell

### Current Problem

The page uses `<body class="bg-gray-200 p-4 md:p-8">` with a `max-w-7xl` container. This creates visible gray padding around the entire app. It looks like a demo embedded in a page, not a full application.

### What to Build

The app fills the entire viewport. No visible page background. No outer padding.

### HTML Changes

```html
<!-- OLD -->
<body class="bg-gray-200 p-4 md:p-8">
  <div class="container mx-auto max-w-7xl">

<!-- NEW -->
<body>
  <div class="app-shell">
```

### CSS

```css
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
  font-family: var(--font-family);
  background: var(--gray-50);
}

.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

/* Header — full width, compact */
.deck-calculator-header {
  background: var(--tuds-navy);
  padding: 0 16px;
  height: 48px;              /* Fixed height, compact */
  display: flex;
  align-items: center;
  border-radius: 0;          /* No rounded corners — edge to edge */
  margin: 0;                 /* No negative margin hack */
  flex-shrink: 0;
}

.header-logo {
  height: 28px;
}

.deck-calculator-header h1 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.header-subtitle {
  display: none;             /* Hide subtitle — compact header */
}

/* Main content fills remaining space */
.main-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
}
```

### Result

The full page is now:
```
┌────────────────────────────────────────────────────────┐
│ [Logo] TUDS Pro Deck Estimator           [Help] [User] │ 48px
├─────────────┬──────────────────────────────────────────┤
│             │                                          │
│  Input      │                                          │
│  Panel      │         Canvas                           │ 100vh - 48px
│  320px      │         (fills everything)               │
│             │                                          │
│             │                                          │
│             ├──────────────────────────────────────────┤
│             │         BOM / Quote                      │
│             │                                          │
├─────────────┴──────────────────────────────────────────┤
```

No gray background visible. No outer padding. No `max-w-7xl` constraint. The app IS the page.

---

## 5. BOM as a Proper Quote

### Current Problem

The BOM is a data table stuck below the canvas inside a card. It looks like a debug output, not something you'd hand to a customer. For the self-serve flow, this IS the quote — it needs to look like one.

### What to Build

The BOM section transforms into a proper quote/invoice layout when the user reaches the Review step. During earlier steps, it stays as a compact summary below the canvas.

### During Configuration Steps (Structure, Decking, Railing)

Show a compact running total bar at the bottom of the canvas area:

```
┌──────────────────────────────────────────────────────┐
│                     Canvas                           │
│                                                      │
├──────────────────────────────────────────────────────┤
│ Framing: $1,234  │  Decking: --  │  Total: $1,234   │ ← running total bar
└──────────────────────────────────────────────────────┘
```

```css
.running-total-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--tuds-navy);
  color: white;
  font-size: 13px;
  font-weight: 500;
}

.running-total-bar .total-amount {
  font-size: 16px;
  font-weight: 700;
}
```

### At Review Step — Full Quote View

The canvas area is replaced by (or split with) a proper quote layout:

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   TUDS Pro Deck Estimator                                │
│   Project: Smith Residence                               │
│   Date: January 30, 2026                                 │
│                                                          │
│   ┌────────────────────────────────────────────────────┐ │
│   │  [2D Layout Drawing — toggleable layers]           │ │
│   │  Framing | Decking | Railing | All                 │ │
│   └────────────────────────────────────────────────────┘ │
│                                                          │
│   FRAMING                                                │
│   ─────────────────────────────────────────────────────  │
│   Joists      2×8×12'    24    $8.49     $203.76        │
│   Joists      2×8×10'     4    $7.29      $29.16        │
│   Beam        2×10×16'    4   $14.99      $59.96        │
│   ...                                                    │
│                                    Subtotal: $1,234.56   │
│                                                          │
│   DECKING                                                │
│   ─────────────────────────────────────────────────────  │
│   ...                                                    │
│                                    Subtotal:   $987.65   │
│                                                          │
│   ═══════════════════════════════════════════════════════ │
│                                    TOTAL:    $2,222.21   │
│                                                          │
│   [Add to Cart]  [Email Quote]  [Print/PDF]  [Share]     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### CSS for Quote Layout

```css
.quote-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 32px;
  background: white;
  font-feature-settings: "tnum";
}

.quote-header {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid var(--gray-900);
}

.quote-header h2 {
  font-size: 20px;
  font-weight: 700;
  color: var(--gray-900);
}

.quote-meta {
  font-size: 13px;
  color: var(--gray-500);
  margin-top: 4px;
}

/* Category header in quote */
.quote-category {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--gray-900);
  padding: 16px 0 8px;
  border-bottom: 1px solid var(--gray-200);
  margin-top: 24px;
}

/* Line items */
.quote-table {
  width: 100%;
  border-collapse: collapse;
}

.quote-table td {
  padding: 6px 0;
  font-size: 13px;
  color: var(--gray-700);
  border-bottom: 1px solid var(--gray-50);
}

.quote-table td:last-child {
  text-align: right;
  font-weight: 500;
}

/* Subtotal row */
.quote-subtotal {
  text-align: right;
  padding: 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--gray-700);
  border-top: 1px solid var(--gray-200);
}

/* Grand total */
.quote-total {
  text-align: right;
  padding: 16px 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--gray-900);
  border-top: 2px solid var(--gray-900);
  margin-top: 16px;
}

/* Action buttons row */
.quote-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--gray-200);
}
```

---

## Icon Replacement Catalog

Every inline SVG icon in the visual selectors needs to be replaced. Here is the complete list:

### Footing Types (3 icons)
| Option | Current SVG | What It Should Show |
|--------|-------------|-------------------|
| GH Levellers | Rectangle + small rect + line + circle | A post bracket on a concrete pad — recognizable bracket shape on a flat slab |
| Pylex | Vertical line + arrow + horizontal line + circle | A helical screw pile being driven into ground — spiral thread visible on shaft |
| Helical Piles | Vertical line + ellipses + rectangle | A long helical pile with visible helix plate at bottom, shaft extending up |

### Post Sizes (3 icons)
| Option | Current SVG | What It Should Show |
|--------|-------------|-------------------|
| Auto | Rectangle + circle + dashed lines | A post with a question mark or "auto" badge — clearly means "app decides" |
| 4×4 | Rectangle with "4x4" text inside | Cross-section view of a 4×4 post — small square with dimension arrows |
| 6×6 | Rectangle with "6x6" text inside | Cross-section view of a 6×6 post — larger square with dimension arrows |

### Joist Spacing (2 icons)
| Option | Current SVG | What It Should Show |
|--------|-------------|-------------------|
| 16" OC | 3 thin rectangles with dimension line | Top-down view of 3 joists with clear 16" dimension marked between them |
| 12" OC | 4 thin rectangles with dimension line | Top-down view of 4 joists — closer together — with 12" dimension |

### Attachment Type (3 icons)
| Option | Current SVG | What It Should Show |
|--------|-------------|-------------------|
| House Rim (Ledger) | Filled rectangle (wall) + lines | Side view: house wall with ledger board bolted to it, deck frame extending out |
| Concrete Foundation | Rectangle (slab) + circles (bolts) + rectangle | Side view: concrete foundation wall, sill plate bolted on, deck frame above |
| Floating (Freestanding) | Rectangle + 2 posts + ellipses | Side view: deck frame on posts with footings, no house wall — freestanding |

### Beam Type (2 icons)
| Option | Current SVG | What It Should Show |
|--------|-------------|-------------------|
| Drop Beam | Joists on top, beam hanging below | Side cross-section: joists sitting ON TOP of beam, beam hangs below joist plane |
| Flush Beam | Joists and beam at same level | Side cross-section: joists hanging FROM beam with hangers, beam at same level |

### Blocking (2 icons)
| Option | Current SVG | What It Should Show |
|--------|-------------|-------------------|
| Standard | Rectangles between joists | Top-down: joists with solid blocking between them in a staggered line |
| Bridging | X-pattern between joists | Top-down: joists with X-shaped bridging between them |

### Picture Frame (2 icons)
| Option | Current SVG | What It Should Show |
|--------|-------------|-------------------|
| No | Plain deck boards edge to edge | Top-down: parallel deck boards running to the edge |
| Yes | Border board around perimeter | Top-down: deck boards with a perpendicular border board framing the perimeter |

### Decking Material (future, but plan for it)
| Option | What It Should Show |
|--------|-------------------|
| Pressure Treated | Wood grain texture, warm brown tone |
| Cedar | Lighter reddish-brown wood grain |
| Composite | Smooth, even texture, gray/brown |

### Mode Selection Cards (5 icons — already larger at 48×48)
| Option | Current SVG | What It Should Show |
|--------|-------------|-------------------|
| Full Deck Build | Rectangles stacked | Isometric view of a complete deck: frame, boards, railing, stairs |
| Framing Only | Rectangles (joists/beams) | Isometric view of just the frame: joists, beams, posts |
| Decking Only | Horizontal lines | Top-down view of deck boards with visible grain pattern |
| Railing Only | Vertical lines (pickets) | Front view of a railing section: top rail, pickets, posts |
| Custom Combo | Circle with plus | A modular icon showing puzzle pieces or a plus/settings symbol |

### Template Cards (9 icons — currently in template-preview SVGs)
These are shape outlines and are actually fine as simple SVGs — they correctly convey the shape. No replacement needed.

### Total Icons to Replace: ~22 unique icons

### Icon Style Specification

All replacement icons should follow these rules:
- **Size:** Render at 96×96px, display at 48×48px (2x for retina)
- **Style:** Clean line illustration, 2px stroke weight, monochrome (use currentColor so they inherit the teal/gray states)
- **Perspective:** Side cross-section view for structural items (beam types, attachment types), top-down for layout items (joist spacing, blocking, decking)
- **Background:** Transparent
- **Format:** SVG preferred (scalable, themeable). PNG acceptable if generated by AI.
- **Consistency:** All icons should look like they came from the same illustrator — same line weight, same level of detail, same perspective conventions

### Icon Generation Prompts

If using an image generation tool (DALL-E, Midjourney, etc.), use this master prompt prefix for consistency:

> **Master prefix:** "Clean technical line illustration icon for a deck building calculator app. Monochrome dark gray on transparent background. 2px consistent stroke weight. Minimal detail, immediately recognizable. No text labels. No gradients or fills except for very subtle area fills to distinguish materials. Professional technical drawing style."

Then append the specific item description for each icon.

---

## Implementation Order

### Phase 1: Page Shell & Layout (Biggest Visual Impact)

This is the single highest-impact change. Do this first.

1. Change `<body>` from `bg-gray-200 p-4 md:p-8` to no padding, no background
2. Replace `container mx-auto max-w-7xl` with `app-shell` (full viewport)
3. Remove the `.step-sidebar` entirely
4. Change `.main-layout-with-sidebar` to `.main-layout` (2-column flex)
5. Make the header 48px, full-width, no border-radius, no negative margins
6. Add the horizontal progress bar inside the input panel header
7. Update the JS that populates the step sidebar to populate the progress bar instead

**Estimated lines of CSS changed:** ~200 (delete sidebar styles, add progress bar, update layout)
**Estimated lines of HTML changed:** ~30 (body classes, container, sidebar removal, progress bar addition)
**Risk:** Medium — layout change affects all responsive breakpoints. Test at 1280px, 1024px, 768px, 480px.

### Phase 2: Input Panel Redesign

8. Strip the `.info-card` wrapper from the input panel
9. Make the panel a flush sidebar with `border-right` only
10. Add scrollable content area with fixed title and fixed Next button
11. Restyle config sections with cleaner collapsed state
12. Section dividers replace card nesting
13. Larger visual selector cards (48px icons, 90px min-height)

**Estimated lines changed:** ~150 CSS, ~20 HTML
**Risk:** Low — mostly CSS changes to existing structure

### Phase 3: Canvas Presence

14. Strip the `.info-card` wrapper from the canvas area
15. Canvas fills remaining space, subtle gray background behind it
16. Clean floating toolbar (no per-button shadows)
17. Compact legend overlay
18. Running total bar at bottom of canvas (during config steps)

**Estimated lines changed:** ~100 CSS, ~15 HTML
**Risk:** Low — canvas rendering is in JavaScript, CSS changes don't affect it

### Phase 4: Quote/BOM Redesign

19. Build the quote view layout for Review step
20. Transform BOM table into invoice-style line items
21. Add quote header with project info
22. Action buttons row (Add to Cart, Email, Print, Share)
23. Keep editable quantities but style them as part of the quote

**Estimated lines changed:** ~200 CSS, ~60 HTML
**Risk:** Low-Medium — BOM generation is JavaScript-driven. HTML structure changes may need corresponding JS updates to `uiController.js`.

### Phase 5: Icon Replacement

24. Generate or source replacement icons for all 22 visual selector options
25. Replace inline SVG markup with `<img>` tags pointing to icon assets (or with new, better SVG markup)
26. Test all visual selectors still function with new icons

**Estimated lines changed:** ~200 HTML (inline SVGs replaced)
**Risk:** Low — purely visual, no logic changes

---

## What This Will Look Like When Done

The app will go from "a form wizard with a canvas embedded in it" to "a professional design tool that happens to have configuration options." The canvas dominates. The input panel is a clean, scrollable sidebar. The quote looks like something you'd email a customer. There is no visible page background — the app fills the screen.

Reference products with a similar feel:
- **Figma** — left sidebar for tools, canvas dominates, right sidebar for properties
- **Canva** — left panel for options, main area for design
- **Shopify admin** — compact header, full-width content, clean data tables
- **SmartDraw / SketchUp web** — toolbar over canvas, properties panel on side

The current app looks like a form-heavy admin page. After this plan, it looks like a design tool.

---

*This plan supersedes the layout-related portions of VISUAL_DESIGN_PLAN.md. The color tokens and typography from that plan remain valid and should be kept.*
