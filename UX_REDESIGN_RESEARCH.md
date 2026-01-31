# TUDS Pro Deck Calculator — Research-Backed UX Redesign Plan

> Compiled from research across product configurator UX, construction estimator tools, drawing tool interaction patterns, dual-audience design, mobile canvas UX, and modern SaaS design systems. Grounded in the specific context of a deck building calculator used by both lumber yard salespeople and consumers.

---

## Table of Contents

1. [Competitive Landscape](#1-competitive-landscape)
2. [Core Design Principles](#2-core-design-principles)
3. [Layout Architecture](#3-layout-architecture)
4. [Drawing Experience](#4-drawing-experience)
5. [Wizard & Configuration Flow](#5-wizard--configuration-flow)
6. [Quote & BOM Presentation](#6-quote--bom-presentation)
7. [Dual-Audience Strategy](#7-dual-audience-strategy)
8. [Visual Design System](#8-visual-design-system)
9. [Mobile & Touch](#9-mobile--touch)
10. [Onboarding & Empty States](#10-onboarding--empty-states)
11. [Implementation Priorities](#11-implementation-priorities)

---

## 1. Competitive Landscape

### What the best deck tools do well

**Trex Deck Designer** (the gold standard):
- Template library OR start from scratch — users choose their entry point
- Shape flexibility: L-shapes, T-shapes, bump-outs, cut corners
- Section-by-section dimensioning (main deck vs bump-out vs stairs)
- Material selection with real-time visual preview (color changes live)
- Tiered product comparison (good/better/best) within the flow
- Outputs: 3D renders, printable construction plans, BOM with cost estimate, share-to-retailer
- Desktop only — no mobile support for the full designer

**TimberTech/AZEK Deck Designer**:
- BOM accessible at any stage (not gated behind completion)
- iPad app available — one of the few that supports tablet
- 140+ furnishing library for scene dressing

**Simpson Strong-Tie Deck Planner**:
- In-app video tutorial walks through each step
- Drag-drop-resize components (not click-to-draw)
- Explicit 2D/3D mode toggle

**Decks.com**:
- Simplest UX — fast and responsive, basic graphics
- 2D draw → 3D render toggle
- Targets the "I just need a quick plan" user

### What they all get wrong
- None handle the salesperson-at-counter use case well
- Most are product-locked (only their brand's materials)
- None integrate with a retail POS/Shopify for actual purchasing
- Drawing UX assumes spatial comfort — no hand-holding for first-timers
- No concept of "just give me framing" or "just give me decking" (component-only modes)

### TUDS Pro's unique advantages
- Multi-brand, multi-supplier material options
- Shopify cart integration (estimate → purchase in one flow)
- Component-only build modes (framing only, decking only, etc.)
- Dual-audience: works for both salesperson and consumer
- Structural calculation engine (not just surface area estimation)

---

## 2. Core Design Principles

Based on the research, these principles should guide every design decision:

### P1: Canvas is king
The drawing/preview canvas should dominate the screen. Every competitor gives the visual 60-70% of viewport. Configuration controls are secondary — they support what's on the canvas, not the other way around. The current layout gives the canvas roughly equal weight with the sidebar. That's wrong.

### P2: Progressive disclosure, not progressive hiding
Show the minimum needed for the current task. Don't hide things behind accordions and collapses — instead, only render the controls that matter for the current step. Research shows that progressive disclosure works best when it adapts to user context, not when it buries features in collapsible sections.

### P3: Always-visible output
The Trex model of "BOM accessible at any stage" is correct. Users should always see their running cost estimate, even if it's just "~$X,XXX estimated." Hiding the BOM behind a final step creates anxiety. A persistent cost indicator builds confidence and creates a natural motivation to complete the design.

### P4: Templates are the fast path
Research shows that 60-70% of deck projects are simple rectangles or L-shapes. Providing templates with preset dimensions eliminates the drawing step entirely for most users. The current "Quick Rectangle" input is buried in the draw step. It should be the primary entry point.

### P5: Error prevention over error correction
Smart defaults and constraints should make it nearly impossible to create an invalid design. The current app validates after the fact. Better: constrain inputs so invalid states can't be reached. Auto-snap to grid, enforce minimum dimensions, prevent impossible shapes inline.

### P6: One tool, two speeds
Salespeople need speed — they're standing at a counter with a customer. Consumers need guidance — they're exploring at home. The same tool must serve both by making the fast path obvious (templates, quick rectangle, defaults) while keeping the detailed path available (custom draw, manual config).

---

## 3. Layout Architecture

### Desktop (≥1024px): Three-zone layout

```
┌──────────────────────────────────────────────────────────┐
│  HEADER: Logo + Project Name + [Save] [Share] [Sign In]  │
├────────┬─────────────────────────────────┬───────────────┤
│        │                                 │               │
│  STEP  │         CANVAS (65%)            │  CONTEXT      │
│  NAV   │                                 │  PANEL        │
│  (48px)│   Drawing area with grid,       │  (280px)      │
│        │   zoom controls bottom-right,   │               │
│        │   tool palette top-left         │  Shows only   │
│        │                                 │  controls     │
│        │                                 │  relevant to  │
│        │                                 │  current step │
│        │                                 │               │
├────────┴─────────────────────────────────┴───────────────┤
│  FOOTER BAR: Running cost estimate | Step X of Y | Next  │
└──────────────────────────────────────────────────────────┘
```

**Key changes from current layout:**
- Canvas gets ~65% of horizontal space (currently ~50%)
- Context panel is on the RIGHT (where Trex, Figma, and most tools put it)
- Step nav is a narrow icon strip on the left (like Figma's tool panel)
- Running cost estimate is always visible in footer
- No horizontal progress bar eating vertical space — steps are in the left icon strip

### Why right-side panel
Research on drawing/canvas tools (Figma, SketchUp, Canva, Trex) consistently places the property/configuration panel on the right side. The left side is reserved for tools and navigation. This matches the natural eye flow: scan left-to-right, tools → canvas → properties. The current layout puts the config panel on the left, which forces the eye to jump back and forth.

### Tablet (768-1023px): Canvas + bottom sheet

```
┌──────────────────────────────────────┐
│  HEADER: Compact                      │
├──────────────────────────────────────┤
│                                      │
│         CANVAS (full width)          │
│                                      │
│   Tool palette floats top-left       │
│   Zoom controls float bottom-right   │
│                                      │
├──────────────────────────────────────┤
│  ▔▔▔ drag handle ▔▔▔                │
│  BOTTOM SHEET: Config controls       │
│  (collapsible, 3 snap points:        │
│   peek / half / full)                │
└──────────────────────────────────────┘
```

### Mobile (<768px): Canvas + bottom sheet (mandatory)

Same as tablet but the bottom sheet is the only way to access configuration. Canvas gets maximum vertical space. Step navigation moves to the bottom sheet header.

---

## 4. Drawing Experience

### The onboarding problem

The current app drops users onto a blank canvas with the instruction "Click on the canvas to draw a custom shape." Research shows this is the #1 drop-off point for non-technical users. They don't know where to click, how many clicks, or what a "shape" means in this context.

### Research-backed solution: Three entry paths

Present these as cards (similar to the current mode selection, but for shape entry):

**Path A: Quick Rectangle** (primary, 60-70% of users)
- Two input fields: Width × Depth
- "Create" button instantly generates a rectangle on canvas
- No drawing required — shape appears, user can resize by dragging edges
- This should be the DEFAULT highlighted option

**Path B: Choose a Template** (20-25% of users)
- Grid of common shapes: Rectangle, L-shape, T-shape, Wraparound, Octagon corner
- Each shows a thumbnail with placeholder dimensions
- Click → shape appears on canvas with editable dimensions
- Simpson Strong-Tie and Trex both use this pattern effectively

**Path C: Custom Draw** (5-10% of users)
- Click-to-place-points drawing (current approach)
- BUT with better guidance:
  - Animated ghost showing "click here to start" on the grid
  - Point counter: "Point 1 of ?" with a "Close shape" button
  - Live dimension labels on each segment as you draw
  - Rubberband preview line from last point to cursor
  - Snap indicators that highlight the grid intersection point
  - "Click near your first point to close the shape" tooltip after 3+ points

### Drawing tool palette
Float a small toolbar over the top-left of the canvas (like Figma):
- Select/Move tool (default after shape is closed)
- Draw tool (point-by-point)
- Edit tool (drag vertices/edges)
- Measure tool
- Zoom controls in bottom-right corner

### Post-drawing interaction
Once a shape exists on canvas:
- Click any edge → shows dimension label, click label to edit
- Click any vertex → drag to reshape
- Double-click an edge → add a vertex (for notches/bump-outs)
- Click inside shape → drag to reposition
- All of this should work on the current shape without entering a separate "edit mode"

---

## 5. Wizard & Configuration Flow

### Step structure

Research confirms the wizard pattern is correct for this type of configurator, but with key modifications:

| Step | Name | What it does | Can skip? |
|------|------|-------------|-----------|
| 0 | Start | Shape entry (Quick Rect / Template / Custom Draw) | No |
| 1 | Structure | Joist size, spacing, beam config, posts | Yes (use defaults) |
| 2 | Stairs | Place stairs on edges | Yes (no stairs) |
| 3 | Decking | Material, direction, picture frame | Yes (use defaults) |
| 4 | Railing | Brand, style, sections (future) | Yes (skip) |
| 5 | Review | Full BOM, cost, PDF export, add to cart | No |

**Key changes from current:**
- "Mode Selection" (full build, framing only, etc.) becomes a setting, not a step. It's a dropdown or toggle in the header, not a separate wizard page. Research shows that forcing a "what kind of build" decision upfront creates confusion for consumers who don't understand the distinction.
- "Draw" is not a wizard step — it's the canvas. Drawing happens continuously. The wizard steps control which CONFIG PANEL is showing on the right side, not whether you can draw.
- Steps should be completable in any order after the shape exists. The left nav should allow jumping to any unlocked step. Research on configurator UX shows that forcing linear progression frustrates expert users (salespeople).
- Smart defaults mean most users only interact with Step 0 (shape) and Step 5 (review). The middle steps exist for customization but aren't mandatory.

### Smart defaults (research-backed)

The configurator research is clear: smart defaults dramatically reduce time-to-value. Based on the most common deck configurations:

- **Joist size**: 2×8 (most common residential)
- **Joist spacing**: 16" OC
- **Attachment**: Ledger board (house-attached)
- **Decking**: Pressure-treated 5/4×6
- **Decking direction**: Perpendicular to joists
- **No stairs** by default
- **No railing** by default
- **No picture frame** by default

These defaults should produce a valid, buildable design with zero configuration. The "Review" step should show the full BOM immediately. Users who want to change things can navigate back to any step.

---

## 6. Quote & BOM Presentation

### Research findings on estimator/quote UX

The construction estimator tools (Buildxact, Buildertrend, Groundplan) all follow this pattern:

1. **Running estimate always visible** — not hidden until the end
2. **Category grouping** — materials grouped by type (lumber, hardware, decking, fasteners)
3. **Progressive detail** — summary total first, expandable categories, line items within
4. **Visual distinction** between subtotal and total
5. **One-click export** to PDF, Excel, or email
6. **Professional formatting** — the PDF output should look like it came from a real business, not a web app

### Recommended BOM layout

```
┌─────────────────────────────────────────────┐
│  YOUR DECK ESTIMATE                         │
│  12' × 16' Rectangle | 192 sq ft           │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ Framing              $1,234.56  ▼   │    │
│  ├─────────────────────────────────────┤    │
│  │ Decking                $867.00  ▼   │    │
│  ├─────────────────────────────────────┤    │
│  │ Hardware & Fasteners   $234.00  ▼   │    │
│  ├─────────────────────────────────────┤    │
│  │ Railing                  $0.00  ▼   │    │
│  ├─────────────────────────────────────┤    │
│  │ Stairs                   $0.00  ▼   │    │
│  ╞═════════════════════════════════════╡    │
│  │ ESTIMATED TOTAL       $2,335.56     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  [Download PDF]  [Email Quote]  [Add to Cart]│
│                                             │
│  Prices from: TUDS Sherwood Park            │
│  Valid for: 30 days                         │
└─────────────────────────────────────────────┘
```

Each category expands to show line items:
```
▼ Framing                          $1,234.56
  2×8×12  SPF Joist          ×14    $378.00
  2×10×16 SPF Beam           ×2     $156.00
  2×8×16  SPF Ledger         ×1      $67.00
  4×4×10  PT Post            ×6     $234.00
  ...
```

### PDF output
The PDF should look like a professional quote/invoice:
- Company logo and store info at top
- Customer name (if signed in)
- Date and quote number
- Deck dimensions and 2D layout drawing
- Categorized materials list with SKUs
- Subtotals by category
- Grand total
- Store contact info and validity period
- QR code linking back to the saved project

---

## 7. Dual-Audience Strategy

### The core tension

Salespeople need: speed, accuracy, ability to modify on the fly, customer association, quote printing
Consumers need: guidance, templates, visual feedback, cost awareness, ability to save and return

### Research-backed solution: Progressive disclosure with role awareness

**Don't ask "Are you a salesperson or consumer?" upfront.** Instead, infer from behavior and offer progressive complexity:

**Layer 1 — Everyone sees this:**
- Shape entry (Quick Rectangle prominent, templates visible)
- Canvas with the deck shape
- Running cost estimate
- Download PDF / Email Quote

**Layer 2 — Available on request (one click deeper):**
- Structure configuration (joist size, spacing, beams)
- Decking material options
- Stair placement
- Edit shape vertices

**Layer 3 — Requires sign-in:**
- Save project to cloud
- Associate with customer name
- Submit quote to store
- Access saved project library
- Store-specific pricing

This maps to how Home Depot and Lowe's handle their project tools: anonymous users can plan and estimate, signed-in users get personalization and saving, pro users get account-level features.

### Salesperson-specific enhancements
Once signed in as a TUDS employee:
- "New Quote" button in header (fast reset)
- Customer name field appears in header
- Store selector (for multi-location pricing)
- "Submit to Store" button alongside PDF/Email
- Project history searchable by customer name
- Keyboard shortcuts for common actions (R for rectangle, S for stairs, etc.)

---

## 8. Visual Design System

### Color system (research-backed)

Research confirms: muted professional palettes with strategic bold accents outperform both flat gray interfaces and heavily branded ones.

**Primary palette:**
- Navy `#1A2B49` — primary brand, header, active states (keep existing TUDS navy)
- Teal `#2A9D8F` — success states, completed steps, positive actions (keep existing TUDS teal)
- White `#FFFFFF` — canvas background, cards, primary surface
- Light gray `#F8FAFC` — page background (barely off-white, not the current `bg-gray-200`)
- Medium gray `#E2E8F0` — borders, dividers, grid lines

**Accent palette:**
- Blue `#3B82F6` — interactive elements, links, drawing cursor
- Amber `#F59E0B` — warnings, "in progress" states
- Red `#EF4444` — errors, delete actions
- Green `#10B981` — success confirmations

**Dark mode (future):**
Research shows dark mode is now a user expectation for professional tools. Plan for it by using CSS custom properties consistently. Don't implement now, but architect for it.

### Typography

Research confirms: one font family, clear hierarchy, readable at all sizes.

- **Font**: Inter (already loaded) — excellent for UI, screen-optimized
- **Scale**:
  - Page title: 24px / 600 weight
  - Section headers: 16px / 600 weight
  - Body text: 14px / 400 weight
  - Labels: 12px / 500 weight
  - Small/caption: 11px / 400 weight
- **Line height**: 1.5 for body, 1.2 for headings
- No font changes needed — just enforce the scale consistently

### Spacing

Use an 8px base grid (industry standard):
- `--space-1`: 4px (tight)
- `--space-2`: 8px (default)
- `--space-3`: 12px
- `--space-4`: 16px
- `--space-5`: 24px
- `--space-6`: 32px
- `--space-8`: 48px

### Shadows and elevation

Three levels only:
- `--shadow-sm`: `0 1px 2px rgba(0,0,0,0.05)` — cards, inputs
- `--shadow-md`: `0 4px 6px rgba(0,0,0,0.07)` — dropdowns, floating toolbar
- `--shadow-lg`: `0 10px 25px rgba(0,0,0,0.1)` — modals, bottom sheets

### Border radius

- Small (inputs, buttons): 6px
- Medium (cards, panels): 8px
- Large (modals, hero elements): 12px

### Icons

Replace all inline SVG icons with a consistent icon set. Research recommends:
- **Lucide** (open source, consistent stroke weight, 1000+ icons, MIT license)
- Load via CDN: `https://unpkg.com/lucide@latest`
- Consistent 20px size for toolbar, 16px for inline
- 1.5px stroke weight throughout

This eliminates the "shitty SVG icons" problem without needing AI image generation for UI icons. Save AI-generated imagery for the template thumbnails and deck style previews.

---

## 9. Mobile & Touch

### Layout strategy

Research (NNGroup, Material Design, Figma's approach) converges on:

**Canvas-first, controls in bottom sheet.**

The canvas fills the full viewport above a persistent bottom bar. Configuration lives in a draggable bottom sheet with three snap points:
- **Peek** (64px): Shows step name and "drag up" indicator
- **Half** (50% viewport): Shows current step's controls
- **Full** (90% viewport): For BOM review, long forms

### Touch drawing

- **Tap** = place point (same as click)
- **Tap near first point** = close shape (with larger touch target — 44px radius)
- **Pinch** = zoom (already implemented)
- **Two-finger drag** = pan (already implemented)
- **Long press on edge** = show dimension, open edit
- **Long press on vertex** = enter edit mode for that vertex
- **Single finger drag on shape** = move entire shape
- All touch targets must be minimum 44×44px (Apple HIG guideline)

### Bottom sheet implementation

Use the standard pattern from Material Design and NNGroup research:
- Grab handle (32px wide, 4px tall, centered, `border-radius: 2px`)
- Drag physics with momentum
- Snap to three positions
- Tapping the scrim (darkened area above sheet) collapses to peek
- Support Android back button to collapse
- Don't use bottom sheets for critical actions that need to be always visible (the running cost estimate stays in the persistent footer)

---

## 10. Onboarding & Empty States

### First-run experience

Research shows 25% of users abandon after one session if onboarding is poor. The deck calculator's first-run should:

1. **No modal tutorials.** Users skip them. Instead, use contextual hints.
2. **Pre-populated template gallery** as the primary landing state — not a blank canvas.
3. **"Try it" template** — a pre-built 12×16 rectangle deck that's already on canvas when the page loads for the first time. Users can explore the tool with real data. (Notion does this — never show a blank page.)
4. **Contextual tooltips** that appear on first interaction with each tool:
   - First time hovering over canvas: "Click to place points, or use Quick Rectangle below"
   - First time opening structure panel: "These defaults work for most decks. Adjust if needed."
   - First time reaching review: "Your estimate is ready! Download or email it."
5. **Progress motivation**: The persistent footer shows "3 of 5 steps complete" style indicators.

### Empty canvas state

When the canvas has no shape (after clearing or on first visit without template):

```
┌─────────────────────────────────────────────┐
│                                             │
│            ┌───────────────┐                │
│            │   [deck icon] │                │
│            └───────────────┘                │
│                                             │
│      Design your deck in minutes            │
│                                             │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│   │ Quick    │ │ Choose a │ │ Draw     │   │
│   │ Rectangle│ │ Template │ │ Custom   │   │
│   │   ⬜     │ │   🔲🔲   │ │   ✏️     │   │
│   └──────────┘ └──────────┘ └──────────┘   │
│                                             │
│      Most popular: 12×16 rectangle          │
│      [Create 12×16 deck →]                  │
│                                             │
└─────────────────────────────────────────────┘
```

This replaces the current blank canvas + sidebar instructions.

---

## 11. Implementation Priorities

Based on impact-to-effort ratio and the research findings, here's the recommended order:

### Phase 1: Fix the foundation (critical)
1. **Fix the canvas rendering bug** (already diagnosed)
2. **Fix CSS ID mismatch** (`#content-panel` → `#main-content-panel`)
3. **Move config panel to right side** of canvas
4. **Make canvas 65% width**, config panel 280px right
5. **Add persistent footer** with running cost estimate and step navigation

### Phase 2: Shape entry revolution
6. **Promote Quick Rectangle** to primary action (large, prominent, above fold)
7. **Add template gallery** (Rectangle, L-shape, T-shape, Wraparound) with thumbnails
8. **Move custom draw** to a secondary option ("or draw a custom shape")
9. **Add dimension labels** on canvas edges (clickable to edit)

### Phase 3: Smart defaults & flow
10. **Remove Mode Selection as a step** — make it a header dropdown
11. **Pre-populate all structural defaults** so Review step works immediately after shape
12. **Allow non-linear step navigation** (click any unlocked step)
13. **Always show estimated cost** in footer (even partial)

### Phase 4: BOM & output overhaul
14. **Redesign BOM as categorized, expandable quote** (not a flat table)
15. **Professional PDF template** with logo, dimensions, layout drawing
16. **Email quote** functionality
17. **Add-to-cart** integration refinement

### Phase 5: Visual polish
18. **Replace all inline SVGs** with Lucide icon set
19. **Page background** to `#F8FAFC` (subtle off-white)
20. **Card redesign** — consistent radius, shadow, padding
21. **Micro-interactions** — button hover states, step transitions, canvas tool feedback
22. **Loading states** — skeleton screens for Shopify price loading, spinner for calculations

### Phase 6: Mobile & touch
23. **Bottom sheet** for config panel on screens <1024px
24. **Canvas-first mobile layout** — full viewport canvas
25. **Touch target sizing** — minimum 44px for all interactive elements
26. **Pinch zoom enhancement** — zoom to cursor, smooth momentum

### Phase 7: Onboarding & empty states
27. **Template-populated first run** (pre-built 12×16 on canvas)
28. **Contextual tooltips** for first-time interactions
29. **Empty canvas state** with three entry path cards
30. **Progress indicators** in footer

---

## Sources

### Product Configurator UX
- [DriveWorks: How to Build a Product Configurator](https://www.driveworks.co.uk/articles/how-to-build-a-product-configurator-planning-design-ux/)
- [ConvertCalculator: Product Configuration Guide](https://www.convertcalculator.com/blog/product-configuration-ultimate-guide/)
- [CPQ Integrations: Simplify Complex Configurations](https://cpq-integrations.com/blog/how-to-simplify-complex-product-configurations-for-the-average-user/)
- [Salesforce CPQ Best Practices](https://www.dupontcirclesolutions.com/2025/04/03/salesforce-cpq-best-practices-enhancing-the-user-experience/)
- [Configit: Product Configurator Prototyping UX](https://configit.com/learn/blog/improved-ux-with-product-configurator-prototyping/)

### Deck Design Tools
- [Trex Deck Designer](https://www.trex.com/build-your-deck/planyourdeck/deck-designer/)
- [Engineer Fix: How to Use Trex Deck Designer](https://engineerfix.com/how-to-use-the-trex-deck-designer-tool/)
- [Decks.com Free Deck Designer](https://www.decks.com/deck-designer/)
- [Planner 5D Deck Design](https://planner5d.com/use/deck-design)
- [Simpson Strong-Tie Deck Planner](https://www.strongtie.com/deckplanner/)
- [ZWSOFT: 10 Best Deck Design Software 2025](https://blog.zwsoft.com/deck-design-software/)

### Construction Estimator Tools
- [Buildxact Construction Quoting](https://www.buildxact.com/us/features/construction-quoting-software/)
- [Buildertrend Construction Estimating](https://buildertrend.com/financial-tools/construction-estimating-software/)
- [Groundplan Cloud Estimating](https://groundplan.com)
- [BuildingWorks Estimating](https://getbuildingworks.com/product/estimate/)

### Dual-Audience & Progressive Disclosure
- [Peterson Technology Partners: Serving a Dual Audience](https://www.ptechpartners.com/2025/12/09/ui-ux-ax-serving-a-dual-audience-in-design/)
- [IxDF: Progressive Disclosure](https://www.interaction-design.org/literature/topics/progressive-disclosure)
- [IxDF: B2C Model in UX Design](https://www.interaction-design.org/literature/topics/business-to-consumers-model)
- [Userpilot: UX Design Principles](https://userpilot.com/blog/ux-design-principles/)

### Mobile & Bottom Sheets
- [NNGroup: Bottom Sheets Definition and Guidelines](https://www.nngroup.com/articles/bottom-sheet/)
- [LogRocket: Bottom Sheets for Optimized UX](https://blog.logrocket.com/ux-design/bottom-sheets-optimized-ux/)
- [Mobbin: Bottom Sheet Design Inspiration](https://mobbin.com/explore/mobile/ui-elements/bottom-sheet)
- [Shadcn UI Drawer Component](https://www.shadcn.io/ui/drawer)

### Home Improvement Retail
- [Retail Dive: Home Depot Digital Project Planning Tool](https://www.retaildive.com/news/home-depot-digital-project-planning-tool-pro-customers/761497/)
- [Retail Dive: Lowe's & Home Depot AI Tools](https://www.retaildive.com/news/lowes-home-depot-online-ai-powered-tools/741855/)
- [Lowe's Digital Project Planning Tools](https://www.lowes.com/n/ideas-inspiration/lowes-project-planning-tools)

### SaaS Design Trends
- [Design Studio: Top SaaS Design Trends 2026](https://www.designstudiouiux.com/blog/top-saas-design-trends/)
- [Duck.design: SaaS UX/UI Best Practices](https://duck.design/ux-ui-design-for-saas/)
- [Good Side: SaaS UI Trends 2025](https://goodside.fi/blog/top-saas-ui-trends-2025)
- [JetBase: SaaS Design Trends 2025](https://jetbase.io/blog/saas-design-trends-best-practices)
- [Codica: SaaS Design Ultimate Guide](https://www.codica.com/blog/how-to-design-saas-app/)

### Onboarding & Empty States
- [NNGroup: Empty States](https://www.nngroup.com/articles/empty-states/)
- [Carbon Design System: Empty States Pattern](https://carbondesignsystem.com/patterns/empty-states-pattern/)
- [Toptal: Empty State UX Design](https://www.toptal.com/designers/ux/empty-state-ux-design)
- [Appcues: In-App Onboarding Guide 2025](https://www.appcues.com/blog/in-app-onboarding)
- [UserGuiding: Onboarding Best Practices 2025](https://userguiding.com/blog/user-onboarding-best-practices)

### Lumber Yard POS/Software
- [ECI Spruce: Building Materials Software](https://www.ecisolutions.com/products/building-materials-software/)
- [Paladin: Lumber Point of Sale](https://paladinpointofsale.com/lumber-point-of-sale/)
- [TradeTek: Lumber Yard Estimating](https://www.tradeteksoftware.com/lumber-yard-estimating-software)
