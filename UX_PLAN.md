# TUDS Pro Deck Calculator — UX Implementation Plan

## Executive Summary

This plan transforms the TUDS Pro Deck Calculator from an internal sales tool into a dual-purpose platform: a professional tool for TUDS staff and a customer-facing self-serve experience on the website. The design follows a "smart defaults with expert overrides" philosophy — every decision has a sensible default, but technical users can change anything.

---

## Table of Contents

1. [Product Vision & User Types](#1-product-vision--user-types)
2. [Application Flow Architecture](#2-application-flow-architecture)
3. [Gating & Authentication Strategy](#3-gating--authentication-strategy)
4. [Step-by-Step UX Specification](#4-step-by-step-ux-specification)
5. [Drawing Canvas UX](#5-drawing-canvas-ux)
6. [Defaults & Override System](#6-defaults--override-system)
7. [Output & Deliverables](#7-output--deliverables)
8. [Save, Share & Project Management](#8-save-share--project-management)
9. [Mobile & Touch Support](#9-mobile--touch-support)
10. [Railing Module (Phased)](#10-railing-module-phased)
11. [Future Additions](#11-future-additions)
12. [Implementation Phases](#12-implementation-phases)
13. [UX Principles & Constraints](#13-ux-principles--constraints)

---

## 1. Product Vision & User Types

### Primary Users

| User | Context | Needs |
|------|---------|-------|
| **TUDS Salesperson** | In-store, computer | Full access, all overrides, project management, send quotes |
| **TUDS Staff** | Any store location | Access any salesperson's saved projects |
| **Homeowner (Customer)** | Website, computer/tablet/phone | Self-serve drawing → material list → add to cart |
| **Contractor** | Website, computer/tablet | Draw deck → submit materials list to TUDS store |

### Use Cases

The tool must support **any combination** of these component modes:
- **Full Build** — Framing + Decking + Railing + Stairs (the complete deck)
- **Framing Only** — Just the structural takeoff
- **Decking Only** — Just the deck board layout and materials
- **Railing Only** — Just the railing takeoff
- **Any Combination** — e.g., Framing + Decking without Railing

The **drawing step is always required** regardless of mode — you always need a shape to calculate against.

### Gating Requirement

Competitors must not be able to use the tool for free takeoffs. Contact information must be captured. See [Section 3](#3-gating--authentication-strategy) for detailed strategy.

---

## 2. Application Flow Architecture

### High-Level Flow

```
[Mode Selection] → [Draw Shape] → [Height & Stairs Placement] → [Framing] → [Decking] → [Railing] → [Review & Output]
```

### Mode Selection (New — Step 0)

Before drawing, the user selects what they need:

```
┌─────────────────────────────────────────────────┐
│  What are you building today?                   │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Full     │  │ Framing  │  │ Decking  │      │
│  │ Deck     │  │ Only     │  │ Only     │      │
│  │ Build    │  │          │  │          │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│                                                 │
│  ┌──────────┐  ┌──────────┐                     │
│  │ Railing  │  │ Custom   │                     │
│  │ Only     │  │ Combo    │                     │
│  └──────────┘  └──────────┘                     │
│                                                 │
│  "Custom Combo" lets you pick: ☑ Framing        │
│  ☐ Decking  ☐ Railing                          │
└─────────────────────────────────────────────────┘
```

**Why this matters:** Selecting the mode upfront lets us:
- Skip irrelevant wizard steps entirely (cleaner experience)
- Show only the inputs relevant to the user's needs
- Reduce overwhelm for single-component users
- Still collect cross-cutting inputs (e.g., picture frame) when multiple components are selected

**For "Decking Only":** We still need joist direction/spacing input (affects board layout), but we skip beam/post/footing configuration.

**For "Railing Only":** We still need the shape and deck height (affects post height and stair railing).

### Wizard Step Visibility by Mode

| Step | Full Build | Framing Only | Decking Only | Railing Only |
|------|-----------|-------------|-------------|-------------|
| 0. Mode Select | ✓ | ✓ | ✓ | ✓ |
| 1. Draw Shape | ✓ | ✓ | ✓ | ✓ |
| 2. Height & Stairs | ✓ | ✓ | ✓ (height only) | ✓ |
| 3. Framing | ✓ | ✓ | — | — |
| 4. Decking | ✓ | — | ✓ | — |
| 5. Railing | ✓ | — | — | ✓ |
| 6. Review & Output | ✓ | ✓ | ✓ | ✓ |

Steps marked "—" are hidden entirely, not just disabled. The step sidebar renumbers dynamically.

---

## 3. Gating & Authentication Strategy

### Recommended Approach: "Draw Free, Results Require Sign-In"

This maximizes engagement while capturing leads:

#### What's Free (No Sign-In)
- Full access to the drawing canvas
- Shape drawing, editing, undo/redo
- Visual preview of the deck shape
- Mode selection

#### What Requires Sign-In
- All calculation results (structural specs, material quantities)
- Bill of Materials with pricing
- Save/Load projects
- Export/Print/Email
- Add to Cart
- Submit to Store

#### Sign-In Flow
When the user completes their drawing and clicks "Calculate" (or advances past the drawing step):

```
┌─────────────────────────────────────────────────┐
│  Sign in to see your results                    │
│                                                 │
│  Name:     [________________________]           │
│  Email:    [________________________]           │
│  Phone:    [________________________]           │
│                                                 │
│  ☐ I'm a contractor                             │
│  ☐ I'm a homeowner                              │
│                                                 │
│  [Continue →]                                   │
│                                                 │
│  Already have an account? [Sign In]             │
└─────────────────────────────────────────────────┘
```

**Internal staff:** Authenticated via existing Firebase auth. Staff bypass the sign-in gate entirely. Staff accounts are pre-provisioned (no self-registration for staff).

**Returning users:** Can sign in with email to access saved projects.

### Action Buttons for Authenticated Users

Once signed in, the Review step offers these actions:

| Button | Who Sees It | What It Does |
|--------|------------|--------------|
| **Add All to Cart** | Everyone | Adds full BOM to Shopify cart |
| **Add Shippable to Cart** | Everyone | Adds only shippable items to cart |
| **Email My Quote** | Everyone | Emails the drawing + BOM + pricing to the user |
| **Submit to Store** | Everyone | Sends the drawing + BOM to the TUDS store team for review/follow-up |
| **Print / Export PDF** | Everyone | Generates printable layout drawings + BOM |
| **Share Link** | Everyone | Generates a shareable URL to view (read-only) the design |
| **Save Project** | Everyone | Saves to their account for later editing |

**"Submit to Store"** is important for contractors who want TUDS to review their takeoff, adjust as needed, and prepare an order. This creates a lead/work order on the TUDS side.

**"Email My Quote"** sends a formatted email with:
- 2D layout drawing(s) for each relevant stage
- Bill of Materials with quantities and pricing
- Link back to the saved project to edit later

---

## 4. Step-by-Step UX Specification

### Step 0: Mode Selection

**Layout:** Centered card layout, no canvas visible yet.

**Content:**
- Heading: "What are you building today?"
- 4-5 large icon cards (Full Build, Framing Only, Decking Only, Railing Only, Custom Combo)
- Custom Combo reveals checkboxes for component selection
- Brief description under each card explaining what's included

**Behavior:**
- Selection advances to Step 1 automatically (or user clicks Next)
- Mode can be changed later (but warns that changing mode may reset some selections)

---

### Step 1: Draw Shape

**Layout:** Canvas takes maximum available width. Minimal input panel on the left (or collapsed on mobile). Floating toolbar above canvas.

**Content:**
- Instructions: "Click to place corners of your deck. Double-click or click the start point to close the shape."
- Floating toolbar: Draw, Select, Undo, Redo, Clear, Zoom In, Zoom Out, Fit to View
- Grid with scale indicator
- Dimension labels appear on each edge as drawn
- Snap indicators (grid snap, orthogonal snap, 45° snap)

**Behavior:**
- Click to place points
- Lines drawn between points with real-time dimension display
- 90° and 45° angle snapping (with visual indicator showing snap is active)
- Auto-close when clicking near the start point (small margin of error — snap to start)
- Shape validation on close (warns if invalid geometry)
- Multi-tier support: "Add Upper Tier" button to draw a second shape on the first
- Shape editing: click Select mode, then click/drag points to move them. Moving points triggers recalculation warning.

**Cross-cutting input shown here:**
- None at this step. Drawing is purely geometric.

---

### Step 2: Height & Stairs

**Why combined:** Height determines stair riser count. Stairs are placed on deck edges. Both are spatial/geometric inputs that relate to the shape.

**Layout:** Canvas remains visible showing the drawn shape. Input panel on left.

**Content — Height:**
- "Deck Height" — numeric input (inches or feet+inches), default: prompt user
- Visual indicator on canvas showing height dimension
- If multi-tier: separate height for each tier

**Content — Stairs:**
- "Add Stairs" button
- User clicks on an edge of the deck shape to place stairs
- Stair configuration panel appears:
  - Width (default: 36")
  - Number of risers (auto-calculated from height, editable)
  - Stringer type (default: pre-made stringer if available, or cut stringer)
  - Tread material (default: same as deck boards)
  - Open or closed risers (default: open)
  - Fascia risers: yes/no (default: no)
- Multiple staircases supported — each appears as a marker on the edge
- Wrap-around stairs: user can place stairs spanning a corner (clicks two adjacent edges)

**Behavior:**
- Stairs appear visually on the canvas at their placement location
- Riser count auto-updates when height changes
- Each stair set is independently configurable

---

### Step 3: Framing

**Shown in modes:** Full Build, Framing Only, Custom Combo (if framing selected)

**Layout:** Canvas shows the shape with framing overlay (joists, beams, posts drawn to scale). Input panel on left with configuration options.

**Smart Defaults (pre-selected):**
- Ledger attachment: House rim (ledger board)
- Joist spacing: 16" on center
- Joist size: Auto-calculated from span tables
- Foundation type: GH Levellers
- Beam configuration: Drop beam
- Post size: Auto-calculated
- Blocking: Code-required blocking only
- Picture frame: No

**Configuration Panel (collapsed sections, expandable):**

```
Framing Configuration
─────────────────────
▸ Ledger          [House Rim ▾]     ← expandable
▸ Joists          [16" OC ▾]       ← expandable
▸ Foundation      [GH Levellers ▾] ← expandable
▸ Beams           [Drop Beam ▾]    ← expandable
▸ Posts           [Auto ▾]         ← expandable
▸ Blocking        [Code Required ▾]
▸ Picture Frame   [No ▾]           ← CROSS-CUTTING: if Yes, affects decking step too
```

Each section expands to show detailed options only when clicked. The collapsed view shows the current selection.

**Canvas Behavior:**
- Real-time rendering of framing layout as options change
- Joists drawn to scale with correct spacing
- Beams shown at calculated locations
- Posts shown at beam/footing intersections
- Ledger shown on house side
- Blocking shown where required
- Dimensions labeled

**Picture Frame Note:** When picture frame is toggled ON:
- Framing canvas shows backing lumber/blocking for the picture frame
- A flag is set that the Decking step reads to show picture frame border boards
- If the user is in "Framing Only" mode and selects picture frame, a note appears: "Picture frame requires additional backing lumber. This is included in your framing takeoff."

---

### Step 4: Decking

**Shown in modes:** Full Build, Decking Only, Custom Combo (if decking selected)

**Layout:** Canvas shows the deck shape with individual boards drawn. Input panel on left.

**Smart Defaults:**
- Board material: Pressure Treated (PT)
- Board size: 5/4" × 6"
- Board direction: Perpendicular to joists (auto from framing, or user picks if decking-only)
- Fastener type: 3" screws
- Joist protection: None
- Picture frame: Inherited from framing step (or selectable here if framing was skipped)
- Seam/butt boards: Auto-placed based on board lengths

**Configuration Panel:**
```
Decking Configuration
─────────────────────
▸ Board Material    [PT 5/4×6 ▾]
▸ Board Direction   [Perpendicular ▾]   ← if Decking Only mode, also ask joist direction
▸ Fasteners         [3" Screws ▾]
▸ Joist Protection  [None ▾]
▸ Picture Frame     [No ▾]              ← inherited from framing or set here
▸ Divider Boards    [None ▾]            ← for multi-section visual dividers
```

**If Decking Only mode:**
- Additional input: "Joist Direction" (user draws an arrow or picks from a compass) so we know board orientation
- Additional input: "Joist Spacing" (needed to calculate fastener quantities)

**Canvas Behavior:**
- Individual deck boards drawn to scale
- Picture frame border boards shown if enabled
- Seam/butt/zipper boards shown at appropriate intervals based on available board lengths
- Divider boards shown between sections if multi-section shape
- Stair treads shown on stairs
- Fascia shown on visible edges
- Board count displayed

---

### Step 5: Railing

**Shown in modes:** Full Build, Railing Only, Custom Combo (if railing selected)

**Layout:** Canvas shows deck shape with railing locations marked. Input panel on left.

**Initial Interaction:**
User clicks on edges of the deck where railing is needed. The house-side edge is excluded by default (auto-detected from ledger placement; if no ledger, user manually excludes edges).

**Configuration Panel (Phase 1 — Basic Aluminum):**
```
Railing Configuration
─────────────────────
▸ Railing Edges     [Click edges on canvas]
▸ Brand             [Select Brand ▾]
                    - Regal Ideas
                    - Vista Railings
                    - Fortress Home Rail
                    - (Entourage — future)
▸ Style             [Picket ▾]          ← Phase 1: picket only
▸ Color             [Depends on brand]
▸ Height            [36" deck / 42" elevated ▾]  ← auto-suggest based on deck height
▸ Gate              [Click edge to place gate]
▸ Wall Mount        [Click edge touching wall]
▸ Stair Railing     [Auto-detected from stairs]
```

**Phase 1 Scope:** Basic aluminum railing with picket infill for 1-2 brands. Each brand requires specific SKU mapping (to be provided by TUDS).

**Future Phases:**
- Glass infill options
- Scenic frameless glass
- Cable rail
- Wood railing
- Additional brands (Entourage)
- Each brand/style has its own component kit and SKU mapping

**Canvas Behavior:**
- Railing sections highlighted on selected edges
- Post locations calculated and shown (spacing per brand requirements)
- Gate locations shown with swing direction
- Stair railing sections shown alongside stairs
- Wall mount brackets shown where railing meets the house
- Rail section lengths labeled

**Stair Railing:**
- Automatically suggested when stairs exist
- Stair railing components may differ from deck railing (brand-specific)
- Shown in the canvas alongside the staircase

---

### Step 6: Review & Output

**Layout:** Full-width view. Canvas shows the complete design with all layers. BOM table below.

**Content:**

**Layer Toggle (Legend):**
A legend panel allows showing/hiding individual layers to inspect each system:
- ☑ Outline & Dimensions
- ☑ Framing (joists, beams, posts, blocking, ledger)
- ☑ Decking (boards, picture frame, fascia)
- ☑ Railing (posts, rails, gates)
- ☑ Stairs (stringers, treads, risers)

Toggling layers on/off updates the canvas in real-time. This lets users view each system independently — important for understanding the layout and for generating clean per-stage printouts.

**Bill of Materials Table:**
```
┌──────────────────────────────────────────────────────────┐
│ Category    │ Item         │ Size   │ Qty │ Price │ Total│
├─────────────┼──────────────┼────────┼─────┼───────┼──────┤
│ Framing     │ Joist        │ 2×8×12 │  24 │ $X.XX │ $XXX │
│ Framing     │ Beam         │ 2×10×16│   4 │ $X.XX │ $XXX │
│ ...         │ ...          │ ...    │ ... │ ...   │ ...  │
│ Decking     │ Deck Board   │ 5/4×6  │  80 │ $X.XX │ $XXX │
│ ...         │ ...          │ ...    │ ... │ ...   │ ...  │
├─────────────┼──────────────┼────────┼─────┼───────┼──────┤
│             │              │        │     │ TOTAL │ $XXX │
└──────────────────────────────────────────────────────────┘
```

- Quantities are editable (click to override)
- Grouped by category (Framing, Decking, Railing, Stairs, Hardware)
- Only shows categories relevant to the selected mode

**Action Buttons:**
- [Add All to Cart] — Shopify integration
- [Add Shippable Only to Cart]
- [Email My Quote] — sends drawings + BOM to user's email
- [Submit to Store] — sends to TUDS for review/follow-up (creates internal lead)
- [Print / Export PDF] — generates per-stage layout drawings + BOM
- [Share Link] — read-only shareable URL
- [Save Project]

---

## 5. Drawing Canvas UX

### Persistent Canvas

The canvas remains visible throughout all steps (except Mode Selection). The shape never disappears — only the overlay changes per step:
- Step 1 (Draw): Just the shape outline + dimensions
- Step 2 (Height/Stairs): Shape + stair placements
- Step 3 (Framing): Shape + framing overlay
- Step 4 (Decking): Shape + board layout overlay
- Step 5 (Railing): Shape + railing overlay
- Step 6 (Review): All layers, toggleable

### Canvas Toolbar

Streamlined floating toolbar:
```
[Draw] [Select] [|] [Undo] [Redo] [|] [Zoom+] [Zoom-] [Fit] [|] [Clear]
```

- **Draw mode**: Click to place points, close shape
- **Select mode**: Click points/edges to modify, drag to move
- Zoom controls + scroll-wheel zoom + pinch-to-zoom (touch)
- Pan via middle-click drag or two-finger drag (touch)

### Shape Editing

After a shape is closed, the user can switch to Select mode and:
- Drag corner points to resize
- Click an edge and drag to move it (parallel move)
- All edits trigger recalculation with a brief toast: "Shape changed — recalculating..."
- If the edit creates invalid geometry, it's rejected with a visual snap-back

### Multi-Tier

- "Add Tier" button creates a new tier
- User draws the upper/lower tier on the same canvas
- Tiers have independent height inputs
- Structural calculations run independently per tier, then merge shared elements (beams, posts)

---

## 6. Defaults & Override System

### Philosophy

> Every input has a sensible default. The app works with zero manual configuration. Technical users expand sections to override specific values.

### Default Values

| Input | Default | Override Options |
|-------|---------|-----------------|
| Ledger | House rim (ledger board) | Freestanding (no ledger), beam on house side |
| Joist spacing | 16" OC | 12" OC, 19.2" OC, 24" OC |
| Joist size | Auto from span table | Manual selection |
| Foundation | GH Levellers | Sonotube, Helical pile, Deck block |
| Beam type | Drop beam | Flush beam, no beam (cantilever) |
| Post size | Auto from load calc | Manual selection |
| Decking | PT 5/4×6 | Composite brands, cedar, other sizes |
| Fasteners | 3" screws | Hidden fasteners, nails, specific brands |
| Joist protection | None | Butyl tape, membrane |
| Picture frame | No | Yes (triggers cross-cutting effects) |
| Stair risers | Open | Closed, fascia risers |
| Stair width | 36" | Custom |

### UI Pattern: Collapsed Sections

```
┌─ Framing ─────────────────────────────────────┐
│                                                │
│  ▸ Ledger: House Rim             [Change]      │
│  ▸ Joists: 16" OC, 2×8 (auto)   [Change]      │
│  ▸ Foundation: GH Levellers      [Change]      │
│  ▸ Beams: Drop Beam              [Change]      │
│  ▸ Posts: 6×6 (auto)             [Change]      │
│  ▸ Blocking: Code Required       [Change]      │
│  ▸ Picture Frame: No             [Change]      │
│                                                │
│  All values are set to recommended defaults.   │
│  Click [Change] to customize any option.       │
│                                                │
└────────────────────────────────────────────────┘
```

Clicking [Change] or the arrow expands that section to show the full option set (visual selectors with SVG icons where applicable).

---

## 7. Output & Deliverables

### 2D Layout Drawings

Each stage produces a dedicated 2D layout drawing that looks like a **blueprint**:

#### Framing Plan
- Joist layout with spacing dimensions
- Beam locations with sizes labeled
- Post locations with sizes labeled
- Ledger board on house side
- Blocking locations
- Rim/band board
- Overall dimensions
- Blue/white blueprint color scheme
- Title block with project name, date, scale

#### Decking Plan
- Individual board layout with direction
- Picture frame border (if applicable)
- Seam/butt/zipper boards
- Divider boards between sections
- Stair treads
- Fascia boards on visible edges
- Board count annotation
- Overall dimensions

#### Railing Plan
- Post locations with spacing
- Rail section lengths
- Gate locations with swing direction
- Stair railing sections
- Wall mount bracket locations
- Overall dimensions

#### Elevation View (for permits)
- Side view showing:
  - Ground level to deck surface height
  - Post heights
  - Beam depth
  - Joist depth
  - Decking thickness
  - Railing height (36" or 42")
  - Stair profile (rise/run)
  - Footing depth (frost line)

### Print / Export PDF

- "Print" button generates a print-optimized view
- "Export PDF" generates a downloadable PDF containing:
  - Cover page with project summary
  - Framing plan (if applicable)
  - Decking plan (if applicable)
  - Railing plan (if applicable)
  - Elevation view
  - Bill of Materials
- PDF uses blueprint styling (dark background, white/light blue lines)
- Each page includes title block: Project name, date, scale, page number

### Email

- "Email My Quote" sends a formatted email with:
  - Inline preview images of each layout drawing
  - Attached PDF of full drawings + BOM
  - Link to view/edit the saved project online
  - TUDS branding and contact info

---

## 8. Save, Share & Project Management

### Save

- **Staff:** Projects saved to Firebase under staff account. Named with customer name (free text field). Searchable/browsable by any TUDS staff member across all stores. Not locked to individual salespeople.
- **Customers:** Projects saved to their account (created at sign-in gate). Can return to edit.

### Share

- "Share" generates a read-only URL
- Recipient can view the design, rotate layers, see BOM, but cannot edit
- Optional: recipient can "Copy to My Account" to create an editable version

### Submit to Store

- Sends the complete project data (drawings + BOM) to a TUDS internal queue
- Creates a lead/notification for store staff
- Could integrate with existing CRM/POS if available
- Staff can open the submitted project, adjust, and prepare an order

---

## 9. Mobile & Touch Support

### Touch Drawing

- **Tap** to place corner points (equivalent to click)
- **Drag** on canvas to pan (two-finger or outside-shape)
- **Pinch** to zoom in/out
- **Long-press** a point in Select mode to grab and drag it
- Touch targets: minimum 44×44px per Apple HIG

### Layout Adaptation

**Desktop (>1024px):**
```
[Step Sidebar 56px] [Input Panel 280px] [Canvas flex:1]
                                        [BOM Table below canvas]
```

**Tablet (768-1024px):**
```
[Step Bar top]
[Canvas full width]
[Input Panel as bottom drawer — swipe up to expand]
[BOM as separate tab/view]
```

**Mobile (<768px):**
```
[Step Bar top — icons only]
[Canvas full width]
[Input Panel as bottom sheet — half screen, expandable]
[BOM as separate view]
```

### Bottom Sheet Pattern (Tablet/Mobile)

The input panel becomes a bottom sheet that:
- Shows a collapsed summary bar by default (current step name + key info)
- Swipe up to half-screen showing configuration options
- Swipe up further to full-screen if needed
- Swipe down to collapse back to summary bar
- Canvas remains interactive above the sheet

### Navigation

- Step sidebar becomes a horizontal step bar at the top on mobile
- Step numbers shown as circles with current step highlighted
- Swipe left/right between steps (with guard: "Save changes?" if modified)

---

## 10. Railing Module (Phased)

### Phase 1: Basic Aluminum with Pickets
- Support 1-2 brands (Regal Ideas, Vista Railings)
- Picket infill only
- Standard colors per brand
- Deck railing + stair railing
- Post spacing per brand requirements
- SKU mapping needed from TUDS for:
  - Top rail sections (by length)
  - Bottom rail sections
  - Pickets (by height)
  - Posts (by height — deck vs stair)
  - Post caps
  - Brackets/hardware
  - Stair connectors/adapters
  - Gate kits

### Phase 2: Additional Options
- Glass infill for existing brands
- Fortress Home Rail brand
- Additional colors
- Wall mount bracket components

### Phase 3: Specialty Railing
- Scenic frameless glass
- Cable rail
- Wood railing
- Entourage brand (Quebec)
- Custom post/infill combinations

### SKU Mapping Requirement

Each brand requires TUDS to provide:
1. Product catalog with SKUs
2. Available sizes/lengths
3. Available colors
4. Component breakdown (what parts make up a "railing section")
5. Pricing (via Shopify product IDs)
6. Spacing rules (max post spacing, max rail section length)
7. Stair-specific components vs deck-specific components

---

## 11. Future Additions

These are planned but **not in the current implementation scope**. Architecture decisions should not block these:

| Feature | Notes |
|---------|-------|
| **3D Render** | Isometric or perspective 3D view of the complete deck. Already partially built. Needs polish. |
| **Permit Drawings** | 2D blueprint + elevation views suitable for building permit submission. **Target: launch.** |
| **Lighting** | LED deck lights, post cap lights, stair lights. Adds a lighting layer + materials. |
| **Privacy Walls** | Vertical walls/screens on deck edges. Similar to railing but solid. |
| **Fencing** | Could be a separate tool or a module within this tool. Draws a fence line on property, calculates posts/rails/pickets. |
| **Patio** | Paver/stone patio calculator. Different geometry (no framing), different materials. May be a separate tool sharing the drawing engine. |

### Architecture Implications

- The drawing engine should be reusable across deck/fence/patio
- The layer system should support arbitrary layers (not hard-coded to framing/decking/railing)
- The BOM system should be category-agnostic
- The PDF/print system should handle any combination of plan views
- Fencing and patio may be separate "modes" in Mode Selection, or separate tools entirely — decision deferred

---

## 12. Implementation Phases

### Phase A: Foundation (Do First)

**Goal:** Restructure the wizard flow and layout without changing calculations.

1. **Add Mode Selection step** (Step 0)
   - Simple card selector UI
   - Controls which subsequent steps are visible
   - Store selected mode in state

2. **Consolidate wizard steps**
   - Merge current Structure sub-steps (Foundation → Framing → Finishing) into one Framing step with collapsed sections
   - Create the Height & Stairs step (extract from current flow)
   - Implement dynamic step visibility based on mode

3. **Implement collapsed sections with defaults**
   - Each configuration section shows current value + [Change] button
   - Expanding a section shows the full option selector
   - All defaults pre-selected on step entry

4. **Layer toggle system**
   - Legend panel with checkboxes for each layer
   - Canvas re-renders showing only checked layers
   - Persists across step navigation

### Phase B: Output & Gating

**Goal:** Add the deliverables and authentication gate.

1. **Sign-in gate**
   - Intercept at Step 2 (after drawing) for unauthenticated users
   - Sign-in/register form (name, email, phone, type)
   - Firebase auth integration for customers
   - Staff bypass via existing auth

2. **PDF/Print generation**
   - Per-stage blueprint-style layout drawings
   - Elevation view
   - BOM formatted for print
   - Combined PDF export

3. **Email quote**
   - Email service integration (SendGrid, Firebase email, or similar)
   - Formatted email with inline images + PDF attachment

4. **Submit to Store**
   - Firebase function or API endpoint
   - Internal notification/queue system
   - Staff can open submitted projects

5. **Share link**
   - Generate read-only project URL
   - Viewer page showing design + BOM (no edit)

### Phase C: Decking Module

**Goal:** Build the decking board layout and takeoff.

1. **Board layout rendering**
   - Individual boards drawn to scale on canvas
   - Correct direction relative to joists
   - Seam/butt board placement based on available lengths
   - Picture frame border rendering

2. **Decking configuration panel**
   - Material selection (PT, composite brands)
   - Board size selection
   - Direction override
   - Fastener selection
   - Joist protection selection

3. **Decking BOM**
   - Board count by length
   - Fastener quantities
   - Fascia quantities
   - Stair tread quantities

### Phase D: Railing Module (Phase 1)

**Goal:** Basic aluminum railing with picket infill.

1. **Edge selection UI**
   - Click edges to add/remove railing
   - Auto-exclude house side
   - Visual highlighting of selected edges

2. **Railing configuration**
   - Brand selector
   - Color selector
   - Height auto-suggestion

3. **Post placement calculation**
   - Per brand spacing rules
   - Corner posts
   - Gate posts
   - Stair posts

4. **Railing BOM**
   - Rail sections by length
   - Post quantities
   - Picket quantities
   - Hardware/bracket quantities
   - Stair-specific components

### Phase E: Mobile & Touch

**Goal:** Full tablet/phone support.

1. **Responsive layout**
   - Bottom sheet input panel
   - Top step bar
   - Full-width canvas

2. **Touch drawing**
   - Tap to place points
   - Long-press to select/drag
   - Pinch-to-zoom
   - Two-finger pan

3. **Touch-optimized controls**
   - Larger touch targets (44px minimum)
   - Swipe navigation between steps
   - Haptic feedback on snap (if available)

### Phase F: Permit Drawings & Elevation View

**Goal:** Generate permit-ready drawings.

1. **Elevation side view**
   - Ground to deck height
   - Structural members (posts, beams, joists)
   - Railing height
   - Stair profile
   - Footing depth

2. **Permit drawing package**
   - Plan view (top-down with all structural)
   - Elevation view (at least 2 sides)
   - Section detail (typical joist-to-beam connection)
   - Title block with project info

3. **PDF export for permits**
   - Formatted for standard paper sizes (letter/legal)
   - To scale with scale notation
   - Suitable for municipal permit submission

---

## 13. UX Principles & Constraints

### Design Principles

1. **Progressive Disclosure** — Show only what's needed. Defaults handle 80% of cases. Details are one click away.

2. **Persistent Context** — The canvas and shape are always visible. The user never loses sight of what they're building.

3. **Smart Defaults** — Every option has a sensible default. A user can go from drawing to BOM without changing a single setting.

4. **Non-Destructive Editing** — Changing the shape recalculates but never loses configuration choices. Undo/redo works everywhere.

5. **Confidence Through Feedback** — Every action has visible feedback. Calculations show instantly. Errors explain what's wrong and how to fix it.

### Constraints

- **No framework** — Vanilla JS (aligns with existing codebase; framework migration is a separate decision)
- **Browser support** — Modern browsers (Chrome, Safari, Firefox, Edge). No IE support.
- **Canvas-based rendering** — All drawing happens on HTML canvas (not SVG/DOM). This is the established pattern.
- **Shopify integration** — Products and pricing come from Shopify. BOM items link to Shopify product IDs.
- **Firebase backend** — Auth, project storage, and data persistence via Firebase.
- **No location-based code compliance** — General building code only. User is responsible for local variations.
- **Angle support** — 90° and 45° corners. 22.5° only if trivially implementable.

### Performance Targets

- Drawing: <16ms frame time (60fps) during point placement and shape rendering
- Calculation: <2s for full structural + BOM calculation on any shape
- PDF generation: <5s for complete drawing package
- Page load: <3s initial load on broadband

---

## Appendix: Current vs. Proposed Step Mapping

| Current | Proposed |
|---------|----------|
| (none) | **Step 0: Mode Selection** |
| Step 1: Draw | **Step 1: Draw Shape** (unchanged) |
| (embedded in Structure) | **Step 2: Height & Stairs** (extracted) |
| Step 2: Structure (3 sub-steps) | **Step 3: Framing** (single step, collapsed sections) |
| Step 3: Stairs | (merged into Step 2) |
| Step 4: Decking (coming soon) | **Step 4: Decking** (new build) |
| Step 5: Railing (coming soon) | **Step 5: Railing** (new build) |
| Step 6: Review | **Step 6: Review & Output** (enhanced) |

---

*This plan should be implemented after the architecture refactor (REFACTOR_PLAN.md) is complete, as the refactor establishes the clean state management, drawing pipeline, and decomposition logic that the UX improvements depend on.*
