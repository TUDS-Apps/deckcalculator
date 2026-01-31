# TUDS Pro Deck Calculator — UX Redesign Plan (Revised)

> Revised based on research AND owner feedback. Stripped of bad recommendations.
> Focused on what actually makes sense for a deck configurator used by lumber yard salespeople and consumers.
> Replaces the original UX_REDESIGN_RESEARCH.md.

---

## Table of Contents

1. [Competitive Landscape](#1-competitive-landscape)
2. [Core Design Principles](#2-core-design-principles)
3. [Combined Start Flow: Mode + Shape Entry](#3-combined-start-flow-mode--shape-entry)
4. [Drawing & Canvas Experience](#4-drawing--canvas-experience)
5. [Wizard & Configuration Flow](#5-wizard--configuration-flow)
6. [Persistent Cost Estimate Footer](#6-persistent-cost-estimate-footer)
7. [Visual Design System](#7-visual-design-system)
8. [Mobile & Touch](#8-mobile--touch)
9. [Onboarding & Empty States](#9-onboarding--empty-states)
10. [Implementation Priorities](#10-implementation-priorities)

---

## 1. Competitive Landscape

### What the best deck tools do well

**Trex Deck Designer** (gold standard):
- Template library OR start from scratch — users choose their entry point
- Shape flexibility: L-shapes, T-shapes, bump-outs, cut corners
- Section-by-section dimensioning (main deck vs bump-out vs stairs)
- Material selection with real-time visual preview
- Outputs: 3D renders, printable construction plans, BOM with cost estimate, share-to-retailer
- Desktop only — no mobile support

**Simpson Strong-Tie Deck Planner:**
- Config panel on the LEFT (standard for configurators)
- In-app video tutorial walks through each step
- Drag-drop-resize components
- Explicit 2D/3D mode toggle

**TimberTech/AZEK:**
- BOM accessible at any stage (not gated behind completion)
- iPad app available

**Decks.com:**
- Simplest UX — fast and responsive
- Targets the "I just need a quick plan" user

### TUDS Pro's unique advantages over all of them
- Multi-brand, multi-supplier material options (not locked to one brand)
- Shopify cart integration (estimate → actual purchase in one flow)
- Component-only build modes (framing only, decking only, etc.)
- Dual-audience: works for both salesperson at counter and consumer at home
- Real structural calculation engine (not just surface area estimation)

---

## 2. Core Design Principles

### P1: Config left, canvas right
People read left to right. Make a selection on the left, see the result on the right. This matches Simpson Strong-Tie, Trex, and most configurator tools. The current left-panel layout is correct — keep it.

### P2: Know what you're building before you build it
Mode selection is one of the best features. Users must declare their intent (Full Build, Framing Only, Decking Only, etc.) before entering the design flow. This sets context for which wizard steps appear and which calculations run. Don't bury this — it's the first thing users see.

### P3: Progressive disclosure, not progressive hiding
Show the minimum needed for the current task. Don't hide things behind nested accordions — instead, only render the controls that matter for the current step. Controls appear because the step demands them, not because the user hunts for them.

### P4: Always-visible cost estimate
A persistent footer showing the running cost estimate builds confidence and creates natural motivation to complete the design. Even before calculations run, showing "$0 — complete structure step for estimate" tells the user where value comes from.

### P5: Error prevention over error correction
Smart defaults and constraints should make it nearly impossible to create an invalid design. Auto-snap to grid, enforce minimum dimensions, prevent impossible shapes inline. Validate during input, not after submission.

### P6: One tool, two speeds
Salespeople need speed (templates, quick dimensions, defaults). Consumers need guidance (clear options, visual feedback, tooltips). Same tool, but the fast path is obvious while the detailed path is always available.

---

## 3. Combined Start Flow: Mode + Shape Entry

### The new Step 0: "What are you building?"

This replaces the current mode-selection-only step with a two-part modal/panel flow:

**Part 1: Select your build mode** (same as current mode cards)
- Full Build
- Framing Only
- Decking Only
- Railing Only
- Custom Combo

User clicks a mode card → Part 2 slides in or appears below.

**Part 2: How do you want to create your shape?**

Three clear options presented as cards:

```
┌─────────────────────────────────────────────────────┐
│  Great! Now let's create your deck shape.            │
│                                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │  ENTER       │ │  CHOOSE A    │ │  DRAW        │ │
│  │  DIMENSIONS  │ │  TEMPLATE    │ │  CUSTOM      │ │
│  │              │ │              │ │              │ │
│  │  [rect icon] │ │  [L T shapes]│ │  [pen icon]  │ │
│  │              │ │              │ │              │ │
│  │  Type width  │ │  L-shape     │ │  Click to    │ │
│  │  and depth   │ │  T-shape     │ │  place       │ │
│  │  for a       │ │  Wraparound  │ │  points on   │ │
│  │  rectangle   │ │  Octagon     │ │  the canvas  │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Option A: Enter Dimensions**
- Two fields appear inline: Width (ft) × Depth (ft)
- "Create Rectangle" button
- Clicking creates the rectangle on canvas, auto-closes the modal, advances to the Draw step with the shape already placed
- User can then drag edges/vertices on canvas to adjust if needed

**Option B: Choose a Template**
- Expands to show a grid of shape thumbnails:
  - Rectangle (with dimension fields)
  - L-Shape (with dimension fields for each leg)
  - T-Shape (with dimension fields)
  - Wraparound (with dimension fields)
  - Maybe: Octagon corner, Custom polygon
- Each template shows an outline preview with labeled dimension inputs
- User fills in dimensions, clicks "Create" → shape appears on canvas

**Option C: Draw Custom**
- Closes the modal, advances to the Draw step with a blank canvas
- Canvas shows the empty state guidance (see Section 9)
- User clicks to place points manually

### Why this is better than the current flow

Currently: Mode Selection → advance → Draw step (blank canvas + sidebar instructions)

Proposed: Mode Selection + Shape Entry → shape already on canvas OR blank canvas with clear intent

The key improvement: **most users leave the start step with a shape already created.** They skip the blank-canvas-with-instructions experience entirely. Only the ~10% who need a truly custom shape ever see a blank canvas.

For salespeople at the counter, this means: click Full Build → type 12 × 16 → Create → shape is on canvas in under 5 seconds.

---

## 4. Drawing & Canvas Experience

### Canvas layout (keep current structure)

Config panel stays on the left (280px). Canvas takes the remaining space on the right. This is the correct layout for a configurator — matches industry standard.

### Improvements to drawing interaction

**Dimension labels on edges:**
- Once a shape exists on canvas, each edge shows its dimension (e.g., "12'-0"")
- Click a dimension label → inline edit field appears → type new value → edge resizes
- This gives users direct manipulation without needing the sidebar input fields

**Drawing guidance for custom draw:**
- Animated dot pulsing on the grid: "Click here to start"
- After first point: rubberband preview line from last point to cursor
- Live dimension label on the rubberband line showing distance
- Snap indicator highlighting the nearest grid intersection
- After 3+ points: tooltip near first point says "Click here to close shape"
- Point counter in toolbar area: "3 points placed"

**Shape editing (post-drawing):**
- Click any edge → dimension label highlights, clickable to edit
- Click any vertex → drag handle appears, drag to reshape
- Double-click an edge → insert a new vertex (for notches/bump-outs)
- Click inside shape → drag to reposition
- No separate "edit mode" toggle needed — these should work directly on the canvas

**Floating tool hints:**
- Small toolbar floating over top-left of canvas:
  - Draw (pencil icon) — only when no shape exists
  - Edit (cursor icon) — default after shape is closed
  - Measure (ruler icon)
- Zoom controls in bottom-right corner (keep current)

---

## 5. Wizard & Configuration Flow

### Step structure (revised)

| Step | Name | What happens | Can skip? |
|------|------|-------------|-----------|
| 0 | Start | Mode selection + shape entry (combined) | No |
| 1 | Draw | Canvas active, shape editing, wall selection | No (but may arrive with shape already placed) |
| 2 | Structure | Joist size, spacing, beam config, posts | Yes (use smart defaults) |
| 3 | Stairs | Place stairs on edges | Yes (no stairs) |
| 4 | Decking | Material, direction, picture frame | Yes (use smart defaults) |
| 5 | Railing | Brand, style, sections (future) | Yes (skip / coming soon) |
| 6 | Review | Full BOM, cost, PDF export, add to cart | No |

### Key improvements

**Non-linear navigation after shape exists:**
Once the shape is drawn and closed, users should be able to click any step in the left nav to jump directly to it. Forcing strictly linear progression frustrates salespeople who know exactly what they want to configure. Currently the step items are clickable but gated — relax the gating so any step is reachable after shape completion.

**Smart defaults mean Step 2-5 are optional:**
With good defaults pre-loaded (2×8 joists at 16" OC, PT 5/4×6 decking, no stairs, no railing), a user who enters dimensions in Step 0 could theoretically jump straight to Review and get a valid BOM. The middle steps exist for customization, not as mandatory gates.

**Auto-calculate on step entry:**
When a user enters the Structure step, framing should calculate immediately with the current defaults. Don't wait for them to click "Generate Plan." The calculation is the point of the step — show it right away. (This is partially implemented already with `triggerAutoCalculation` but should be more aggressive about running with defaults.)

---

## 6. Persistent Cost Estimate Footer

### Design

A fixed footer bar at the bottom of the viewport, always visible:

```
┌─────────────────────────────────────────────────────────────┐
│  Est. Total: $2,335.56  │  Step 3 of 6: Stairs  │  [Next →]│
└─────────────────────────────────────────────────────────────┘
```

### Behavior

| State | What the footer shows |
|-------|----------------------|
| No shape yet | `Draw your deck to get an estimate` |
| Shape drawn, no calc yet | `Complete Structure step for pricing →` |
| Structure calculated | `Est. Total: $X,XXX` (framing cost so far) |
| Decking configured | `Est. Total: $X,XXX` (updated with decking) |
| Stairs added | `Est. Total: $X,XXX` (updated with stairs) |
| Review step | Full BOM visible in panel, footer shows grand total |

The estimate updates each time a step recalculates. It's not live-updating on every input change — it reflects the last completed calculation.

### Implementation notes

- Fixed position, bottom of viewport, full width
- Height: 48px
- Background: white with top border and subtle shadow
- Left: running estimate with currency formatting
- Center: current step indicator
- Right: "Next" button (replaces the current in-panel next button)
- On mobile: same footer, but "Next" may move into the bottom sheet

---

## 7. Visual Design System

### Color system (keep current TUDS brand)

- Navy `#1A2B49` — primary brand, header, active states
- Teal `#2A9D8F` — success states, completed steps, positive actions
- White `#FFFFFF` — canvas background, cards, primary surface
- Page background: `#F8FAFC` (subtle off-white instead of Tailwind `bg-gray-200`)
- Borders: `#E2E8F0` — consistent throughout

**Accent colors:**
- Blue `#3B82F6` — interactive elements, drawing cursor, links
- Amber `#F59E0B` — warnings, "in progress" indicators
- Red `#EF4444` — errors, delete actions
- Green `#10B981` — success confirmations

### Typography (already using Inter — just enforce consistency)

- Page title: 24px / 600 weight
- Section headers: 16px / 600 weight
- Body text: 14px / 400 weight
- Labels: 12px / 500 weight
- Small/caption: 11px / 400 weight

### Icons — Replace with Lucide

Replace all inline SVG icons with [Lucide](https://lucide.dev) icon set:
- Open source, MIT license, 1500+ icons
- Consistent 1.5px stroke weight
- Available via CDN: `https://unpkg.com/lucide@latest`
- 20px for toolbar icons, 16px for inline icons
- Eliminates the inconsistent hand-drawn SVG problem

This is a straightforward find-and-replace task. No AI image generation needed for UI icons. Save AI-generated imagery for marketing assets or deck style preview thumbnails if needed later.

### Spacing (8px base grid)

- `--space-1`: 4px
- `--space-2`: 8px
- `--space-3`: 12px
- `--space-4`: 16px
- `--space-5`: 24px
- `--space-6`: 32px

### Shadows (three levels)

- `--shadow-sm`: `0 1px 2px rgba(0,0,0,0.05)` — cards, inputs
- `--shadow-md`: `0 4px 6px rgba(0,0,0,0.07)` — dropdowns, floating toolbar
- `--shadow-lg`: `0 10px 25px rgba(0,0,0,0.1)` — modals, bottom sheets

### Border radius

- Small (inputs, buttons): 6px
- Medium (cards, panels): 8px
- Large (modals): 12px

---

## 8. Mobile & Touch

### Layout: Canvas-first with bottom sheet

On screens below 1024px, the config panel moves from the left sidebar into a bottom sheet:

```
┌──────────────────────────────────┐
│  HEADER: Compact logo + nav      │
├──────────────────────────────────┤
│                                  │
│      CANVAS (full width)         │
│                                  │
│  Tool hints float top-left       │
│  Zoom controls float bottom-right│
│                                  │
├──────────────────────────────────┤
│  ▔▔▔ drag handle ▔▔▔            │
│  BOTTOM SHEET: Current step      │
│  controls (3 snap points:        │
│  peek / half / full)             │
├──────────────────────────────────┤
│  FOOTER: Estimate + Next         │
└──────────────────────────────────┘
```

### Bottom sheet snap points

- **Peek** (64px): Step name + drag indicator. Canvas gets maximum space.
- **Half** (~40% viewport): Current step's controls visible. Canvas still usable above.
- **Full** (~85% viewport): For BOM review, template gallery, forms with many inputs.

### Touch interactions

- **Tap** = place point (same as click)
- **Tap near first point** = close shape (with 44px touch target, larger than desktop)
- **Pinch** = zoom (already implemented)
- **Two-finger drag** = pan (already implemented)
- **Long press on edge** = show dimension label / enter edit
- **Single finger drag on shape** = move shape
- All touch targets minimum 44×44px

### Step navigation on mobile

The left sidebar step nav is hidden on mobile. Instead:
- Bottom sheet header shows current step with prev/next arrows
- Or: a horizontal step indicator below the header (compact, scrollable if needed)
- The persistent footer "Next" button is the primary navigation

---

## 9. Onboarding & Empty States

### Empty canvas state (when user picks "Draw Custom")

When the canvas has no shape, show guidance ON the canvas — not in a sidebar:

```
┌─────────────────────────────────────────────┐
│                                             │
│                                             │
│         Click on the grid to place          │
│         your first point                    │
│                                             │
│              · (pulsing dot)                │
│                                             │
│         Tips:                               │
│         • Click to place corners            │
│         • Lines snap to 90° angles          │
│         • Click near first point to close   │
│                                             │
│                                             │
└─────────────────────────────────────────────┘
```

This overlay fades out as soon as the user places their first point.

### First-time tooltips (show once per user)

Triggered on first interaction, stored in localStorage so they don't repeat:

- **First time on mode step**: No tooltip needed — the cards are self-explanatory
- **First time on canvas with shape**: "Click any edge to see its dimension. Drag corners to reshape."
- **First time on structure step**: "These defaults work for most residential decks. Adjust if your project needs something different."
- **First time reaching review**: "Your material list and estimate are ready. Download a PDF or email it to a customer."

### No pre-populated content

Don't pre-populate the canvas with a sample deck. Users would need to delete it before starting their own project, which is wasted friction. A clear empty state with actionable guidance is better than sample data.

---

## 10. Visual Design

**See [VISUAL_DESIGN_SPEC.md](./VISUAL_DESIGN_SPEC.md)** for the complete component-by-component visual specification.

That document covers exact CSS specs for every component: page shell, header, step sidebar, config panel, cards, buttons, form inputs, canvas area, floating toolbar, BOM table, persistent footer, modals, transitions/micro-interactions, loading/skeleton states, empty states, notification toasts, Lucide icon system, accessibility, and anti-patterns to avoid.

---

## 11. Implementation Priorities

Ordered by impact-to-effort ratio. Each phase is independently valuable — the app improves after every phase, not just after all of them.

### Phase 1: Fix critical bugs
1. Fix canvas rendering bug (already diagnosed — CSS ID mismatch, resize calculation, viewport init timing)
2. Fix CSS `#content-panel` → `#main-content-panel` mismatch throughout stylesheet

### Phase 2: Visual Foundation (from VISUAL_DESIGN_SPEC.md)
3. Page shell: body background to `gray-50`, remove body padding, full viewport
4. Header: 56px fixed height, sticky, ghost-style action buttons, no negative margins
5. Buttons: Consistent height system (28/36/44px), hover lightens, active press scale
6. Form inputs: 36px height, teal focus ring, consistent styling across all inputs/selects
7. Replace all inline SVGs with Lucide icon set

### Phase 3: Combined Start Flow
8. Redesign Step 0 to include shape entry (Mode → Shape method → dimensions/template/custom)
9. Build template gallery with L-shape, T-shape, Wraparound shapes
10. "Enter Dimensions" quick path that creates rectangle on canvas directly
11. Auto-advance to Draw step with shape already placed

### Phase 4: Persistent Footer
12. Add fixed footer bar with running cost estimate
13. Move "Next step" button from in-panel to footer
14. Show step progress indicator in footer center
15. Connect footer estimate to calculation results (update on each step completion)

### Phase 5: Canvas Interaction Improvements
16. Add dimension labels on canvas edges (clickable to edit inline)
17. Drawing guidance overlay for custom draw (pulsing dot, rubberband line, snap indicator)
18. Direct shape editing without separate edit mode (click edge → edit dimension, drag vertex → reshape)
19. Point counter and "click to close" tooltip during drawing

### Phase 6: Wizard Flow Improvements
20. Allow non-linear step navigation (any step reachable after shape is closed)
21. Auto-calculate structure on step entry (don't wait for "Generate Plan" click)
22. Smart defaults that produce a valid BOM with zero configuration
23. Relax step gating so Review is reachable immediately after shape + defaults

### Phase 7: Visual Polish (from VISUAL_DESIGN_SPEC.md)
24. Config panel: 300px width, custom scrollbar, generous padding, section styling
25. Cards: top accent stripe, icon containers, glow ring selection state
26. Step sidebar: active glow ring, hover scale, green completion state
27. Canvas area: card wrapper with shadow, gray-50 background contrast
28. Floating toolbar: shadow-md, ghost buttons, teal active state
29. BOM table: sticky headers, tabular-nums pricing, teal hover tint
30. Modals: backdrop blur, slide-up animation, consistent header/footer
31. Transitions: 150ms interactions, 200ms content, 300ms layout, prefers-reduced-motion
32. Loading states: button spinners, skeleton shimmer for BOM, threshold timing
33. Notification toasts: dark background, left-border accent color, slide-in animation

### Phase 8: Mobile & Touch
34. Bottom sheet for config panel on screens <1024px
35. Canvas-first mobile layout with full-width canvas
36. Touch target sizing (44px minimum)
37. Bottom sheet with three snap points (peek/half/full)
38. Mobile step navigation (horizontal indicator or sheet-header nav)

### Phase 9: Onboarding
39. Empty canvas overlay with drawing guidance (pulsing dot, tips)
40. First-time contextual tooltips (one per key interaction, localStorage tracked)
41. Fade-out behavior (guidance disappears after first point placed)

---

## What was removed from the original plan (and why)

| Original recommendation | Why it was removed |
|---|---|
| Move config panel to right side | Wrong. Left-side config is standard for configurators. Users select left, see result right. |
| Remove Mode Selection as a step | Wrong. Mode selection sets critical context. Users should know what they're building before they start. |
| Pre-populate canvas with sample deck | Wrong. Users would have to delete it. Clear empty state with guidance is better. |
| Redesign BOM as categorized/expandable | Already implemented. BOM already has category headers, subtotals, and collapsible sections. |
| "Quick Rectangle as hero" replacing draw | Scaled back. Quick rectangle is now ONE of three options in the combined start flow, not a replacement. |

---

## Sources

### Product Configurator UX
- [CPQ Integrations: Simplify Complex Configurations](https://cpq-integrations.com/blog/how-to-simplify-complex-product-configurations-for-the-average-user/)
- [Salesforce CPQ UX Best Practices](https://www.dupontcirclesolutions.com/2025/04/03/salesforce-cpq-best-practices-enhancing-the-user-experience/)
- [Configit: Product Configurator Prototyping UX](https://configit.com/learn/blog/improved-ux-with-product-configurator-prototyping/)

### Deck Design Tools
- [Trex Deck Designer](https://www.trex.com/build-your-deck/planyourdeck/deck-designer/)
- [Engineer Fix: Trex Deck Designer Walkthrough](https://engineerfix.com/how-to-use-the-trex-deck-designer-tool/)
- [Simpson Strong-Tie Deck Planner](https://www.strongtie.com/deckplanner/)
- [ZWSOFT: 10 Best Deck Design Software 2025](https://blog.zwsoft.com/deck-design-software/)

### Dual-Audience & Progressive Disclosure
- [IxDF: Progressive Disclosure](https://www.interaction-design.org/literature/topics/progressive-disclosure)
- [Peterson Tech Partners: Serving a Dual Audience](https://www.ptechpartners.com/2025/12/09/ui-ux-ax-serving-a-dual-audience-in-design/)

### Mobile & Bottom Sheets
- [NNGroup: Bottom Sheets Guidelines](https://www.nngroup.com/articles/bottom-sheet/)
- [LogRocket: Bottom Sheets for Optimized UX](https://blog.logrocket.com/ux-design/bottom-sheets-optimized-ux/)

### SaaS Design Trends
- [Good Side: SaaS UI Trends 2025](https://goodside.fi/blog/top-saas-ui-trends-2025)
- [Codica: SaaS Design Guide](https://www.codica.com/blog/how-to-design-saas-app/)

### Onboarding & Empty States
- [Toptal: Empty State UX Design](https://www.toptal.com/designers/ux/empty-state-ux-design)
- [Appcues: In-App Onboarding Guide 2025](https://www.appcues.com/blog/in-app-onboarding)
- [Carbon Design System: Empty States](https://carbondesignsystem.com/patterns/empty-states-pattern/)

### Home Improvement Retail
- [Retail Dive: Home Depot Digital Planning Tool](https://www.retaildive.com/news/home-depot-digital-project-planning-tool-pro-customers/761497/)
- [Retail Dive: Lowe's & Home Depot AI Tools](https://www.retaildive.com/news/lowes-home-depot-online-ai-powered-tools/741855/)

### Lumber Yard Software
- [ECI Spruce: Building Materials POS](https://www.ecisolutions.com/products/building-materials-software/)
- [Paladin: Lumber Point of Sale](https://paladinpointofsale.com/lumber-point-of-sale/)
