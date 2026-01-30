# Deck Calculator — Architecture Refactor Implementation Plan

**Purpose:** This document is a step-by-step implementation plan for Claude Code to execute. Each phase produces a working application before proceeding to the next. The goal is to fix the root causes of unreliable drawing, decomposition, and structural framing — not to add features.

**Key constraint:** Do NOT touch Shopify integration (`shopifyService.js`, `shopifyConfig.js`), Firebase auth (`firebase.js`), save/load, PDF export, or any UI/CSS unless a phase explicitly requires it. Those systems work. This refactor targets the drawing → decomposition → structural calculation pipeline.

**Branch:** Work on a feature branch off the current HEAD. Commit after each phase passes verification.

---

## Context for the AI

The deck calculator lets users draw deck shapes on a canvas, select ledger walls, then generates structural framing (joists, beams, posts, footings, rim joists, blocking) and a bill of materials. The codebase has ~30,000 lines of JavaScript, with `app.js` alone at ~10,800 lines containing 15+ responsibilities. Over a year of iterative development has created tight coupling where fixing one drawing bug breaks something else.

### The core pipeline that needs to be reliable:
```
User clicks canvas → Point snapped to grid → Point added to shape
→ Shape closed → Shape validated → Shape decomposed into rectangles
→ Each rectangle gets structural calculations → Results merged
→ Rendered on canvas
```

### Current files and their roles:
- `app.js` (10,810 lines) — Everything: event handling, drawing, calculations, UI, state management
- `canvasLogic.js` (3,663 lines) — Canvas rendering + snapping + event forwarding
- `deckCalculations.js` (3,893 lines) — Structural calculations for a single rectangular section
- `multiSectionCalculations.js` (2,335 lines) — Orchestrates calculations across decomposed sections, merges results
- `shapeDecomposer.js` (1,603 lines) — Decomposes complex shapes (L, U, T) into rectangles
- `shapeValidator.js` (458 lines) — Validates shapes have correct angles, no self-intersection
- `stateManager.js` (412 lines) — State factory + tier sync helpers
- `config.js` (86 lines) — Constants
- `utils.js` (256 lines) — Distance, formatting, point simplification
- `bomCalculations.js` (1,706 lines) — Bill of materials generation
- `dataManager.js` (652 lines) — Span tables, beam sizing lookup data

### Known problems to fix:
1. Shapes sometimes don't close properly or produce extra lines
2. Shape decomposition into rectangles fails for some non-rectangular shapes
3. Beams are sometimes placed incorrectly
4. Structural framing can render wrong for complex shapes
5. Multi-tier state sync between `appState.points` and `appState.tiers[x].points` causes desync bugs
6. The shape decomposer has hard-coded branches for 2, 3, 6, and 8+ cells — shapes producing 4, 5, or 7 cells fall through to a generic merger that may produce wrong results
7. Tests copy-paste source functions instead of importing them, so tests can pass while real code has diverged

---

## Phase 0: Establish a Safety Net (Tests)

**Goal:** Before changing anything, create tests that capture current correct behavior so we know if we break something.

### Step 0.1: Fix test infrastructure to import real modules

The current tests in `__tests__/` copy-paste functions from source files. Fix this:

1. Read `__tests__/closingPointRegression.test.js` — it defines its own copy of `simplifyPoints`. Remove the copy and import from `../../deckCalcjs/utils.js` instead.
2. Read `__tests__/shapeProcessing.test.js` and `__tests__/clippingFunctions.test.js` — same pattern. Fix all of them to import from real source files.
3. If ES module imports fail under Jest, add to `package.json` jest config:
   ```json
   "extensionsToTreatAsEsm": [".js"],
   "transformIgnorePatterns": []
   ```
   And ensure `"type": "module"` is already in package.json (it is).
4. Some source files import with `?v=8` query strings (e.g., `deckCalculations.js` line 14: `from "./config.js?v=8"`). These will break Node.js imports. **Remove all `?v=X` query string suffixes from import paths** across all JS files. These are cache-busting for browsers and are not needed — the browser cache can be busted via the HTML script tag or build tooling instead.
5. Run `npm test` and verify all existing tests still pass.

### Step 0.2: Add integration tests for the drawing pipeline

Create `__tests__/drawingPipeline.test.js` that tests the core pipeline with known-good inputs and expected outputs. Import the real functions.

Test cases to include:

```javascript
// Test 1: Simple rectangle (4 points + closing point)
// Points forming a 10' x 12' rectangle
// Expected: decomposes into 1 rectangle, calculateStructure returns valid components

// Test 2: L-shape (6 points + closing point)
// Points forming an L-shape
// Expected: decomposes into 2 rectangles

// Test 3: U-shape (8 points + closing point)
// Expected: decomposes into 3 rectangles

// Test 4: T-shape (8 points + closing point)
// Expected: decomposes into 2 or 3 rectangles depending on orientation

// Test 5: Shape with 45-degree corner (bay window)
// Rectangle with one corner clipped at 45 degrees
// Expected: validates successfully, decomposes with diagonal handling

// Test 6: simplifyPoints preserves closing point
// A closed shape with collinear points
// Expected: collinear points removed, closing point preserved

// Test 7: simplifyPoints doesn't remove necessary corners
// An L-shape with no collinear points
// Expected: all points preserved

// Test 8: Point-in-polygon for concave shapes
// Test isPointInsidePolygon with points inside and outside an L-shape
```

Use `PIXELS_PER_FOOT = 24` from config for all coordinate values (e.g., a 10-foot wall = 240 pixels).

### Step 0.3: Add structural calculation snapshot tests

Create `__tests__/structuralCalculations.test.js`:

```javascript
// For a simple 10' x 12' rectangle with:
// - ledger on edge 0 (top horizontal)
// - 16" joist spacing
// - 48" deck height
// - house_rim attachment
// Verify:
// - components.joists is a non-empty array
// - components.beams is a non-empty array
// - components.posts is a non-empty array
// - components.ledger is not null
// - components.error is null
// - All joist p1.y and p2.y are within the deck bounds
// - All beam positions are within the deck bounds
// - No beams overlap with the ledger position
```

### Verification:
- `npm test` passes all new and existing tests
- No source code has been changed except import paths (removing `?v=8` suffixes) and test files

---

## Phase 1: Extract Drawing State Machine from app.js

**Goal:** Replace the nested if/else chain in `handleCanvasClick()` (lines 3764-4241) with an explicit state machine so drawing behavior is deterministic and each mode handles its own clicks.

### Step 1.1: Create `deckCalcjs/drawingStateMachine.js`

This module defines the states and transitions for all canvas interaction modes:

```
States:
  IDLE          — No shape, nothing happening (initial state)
  DRAWING       — User is placing points to create a shape
  SHAPE_CLOSED  — Shape is complete, waiting for wall selection or auto-calc
  WALL_SELECT   — User is clicking walls to mark as ledgers
  CALCULATED    — Structure has been generated
  EDITING       — User is modifying vertices of a closed shape
  STAIR_PLACE   — User is placing stairs
  MEASURING     — Measurement tool active
  BREAKER_PLACE — Breaker board placement active
```

The state machine should:
1. Export a `getCurrentState()` function that returns the current state name
2. Export a `handleClick(modelMousePos, appState, config)` function that:
   - Determines the current state from appState flags
   - Calls the appropriate handler for that state
   - Returns an action object describing what changed (e.g., `{ type: 'ADD_POINT', point: {x, y} }` or `{ type: 'CLOSE_SHAPE', points: [...] }`)
3. Export individual state handler functions (pure functions that take state and return actions):
   - `handleIdleClick(pos, state, config)` → starts drawing
   - `handleDrawingClick(pos, state, config)` → adds point or closes shape
   - `handleWallSelectClick(pos, state, config)` → toggles wall selection
   - `handleEditingClick(pos, state, config)` → vertex add/remove
   - `handleStairPlaceClick(pos, state, config)` → stair placement
   - etc.

**Important design rules:**
- State handlers must be **pure functions** — they receive state and return action objects. They do NOT mutate appState directly.
- The action objects are applied by the caller (app.js) which updates state and calls redraw.
- This makes every state transition testable without a DOM.

### Step 1.2: Extract shape closing logic into a pure function

Move the shape closing logic (currently app.js lines 4064-4208) into `drawingStateMachine.js` as a pure function:

```javascript
/**
 * Attempts to close a shape from the current points.
 * @param {Array} points - Current drawing points
 * @param {Object} config - {EPSILON, PIXELS_PER_FOOT, SNAP_TOLERANCE_PIXELS}
 * @returns {Object} Result: {success: boolean, closedPoints: Array, cornerAdded: boolean, error: string|null}
 */
export function tryCloseShape(points, config) {
  // 1. Copy points
  // 2. Auto-correct small misalignments (< 3 inches = 0.25 * PIXELS_PER_FOOT)
  // 3. Add corner point if needed for 90-degree closure
  // 4. Add closing point (copy of first point)
  // 5. Validate via shapeValidator.validateShape()
  // 6. Return result WITHOUT mutating input
}
```

### Step 1.3: Extract point snapping into a clearer pipeline

The current snapping in `canvasLogic.getSnappedPos()` (lines 1069-1168) mixes first-point grid snapping, orthogonal snapping, and 45-degree snapping in one function with nested conditionals.

Refactor into a pipeline of small pure functions in `canvasLogic.js`:

```javascript
// Step 1: Grid snap (always)
export function snapToGrid(x, y, gridSize) → {x, y}

// Step 2: Angle snap relative to previous point (only during drawing)
export function snapToAngle(pos, prevPoint, allowedAngles, gridSize) → {x, y}

// Step 3: Close-detection (only if 3+ points exist)
export function detectCloseClick(pos, firstPoint, tolerance) → boolean

// Main entry point composes these:
export function getSnappedPosition(rawModelPos, points, options) {
  if (points.length === 0) return snapToGrid(rawModelPos.x, rawModelPos.y, PIXELS_PER_FOOT);

  // Check close-detection FIRST (before angle snapping can push position away)
  if (points.length >= 3 && detectCloseClick(rawModelPos, points[0], tolerance)) {
    return { ...points[0], isClosingClick: true };
  }

  // Normal: grid snap then angle snap
  const gridSnapped = snapToGrid(rawModelPos.x, rawModelPos.y, GRID_SPACING_PIXELS);
  return snapToAngle(gridSnapped, points[points.length - 1], allowedAngles, GRID_SPACING_PIXELS);
}
```

`allowedAngles` should be `[0, 45, 90, 135, 180, -45, -90, -135]` for the current feature set. If 22.5-degree support is trivial (it is — just add those angles to the array), include `[0, 22.5, 45, 67.5, 90, ...]` as well. The snapping math is the same regardless — find nearest angle, project onto that line, re-snap to grid.

### Step 1.4: Wire the state machine into app.js

Replace the body of `handleCanvasClick()` in app.js with:

```javascript
function handleCanvasClick(viewMouseX, viewMouseY) {
  // Guard: panning/editing was just completed
  if (appState.wasPanningOnMouseUp || appState.wasEditingOnMouseUp) {
    appState.wasPanningOnMouseUp = false;
    appState.wasEditingOnMouseUp = false;
    return;
  }

  const modelMouse = getModelMousePosition(viewMouseX, viewMouseY);

  // Delegate to state machine
  const action = drawingStateMachine.handleClick(modelMouse, appState, config);

  // Apply the action
  applyDrawingAction(action);

  redrawApp();
}
```

`applyDrawingAction()` is a switch on `action.type` that updates appState. This is the ONLY place state mutation happens for click events.

### Verification:
- All existing tests pass
- New tests for `tryCloseShape()`, `snapToGrid()`, `snapToAngle()`, `detectCloseClick()` pass
- Manual testing: draw a rectangle, L-shape, and U-shape — all close correctly
- Manual testing: draw a shape with a 45-degree corner — validates and closes
- Manual testing: multi-tier drawing still works (draw upper, switch, draw lower)

---

## Phase 2: Generalize the Shape Decomposer

**Goal:** Replace the hard-coded cell-count branches (2, 3, 6, 8+) in `shapeDecomposer.js` with a single general algorithm that works for any rectilinear polygon.

### Step 2.1: Implement general grid-based decomposition

Replace `decomposePolygonIntoRectangles()` (lines 62-423 of `shapeDecomposer.js`) with:

```javascript
function decomposePolygonIntoRectangles(points, wallIndex) {
  // Remove duplicate closing point if present
  let workingPoints = removeClosingPoint(points);

  // Step 1: Create grid from unique X and Y coordinates
  const xCoords = [...new Set(workingPoints.map(p => p.x))].sort((a, b) => a - b);
  const yCoords = [...new Set(workingPoints.map(p => p.y))].sort((a, b) => a - b);

  // Step 2: Mark grid cells that are inside the polygon
  const grid = createInsideGrid(xCoords, yCoords, workingPoints);

  // Step 3: Determine merge direction from ledger wall orientation
  const ledgerStart = workingPoints[wallIndex];
  const ledgerEnd = workingPoints[(wallIndex + 1) % workingPoints.length];
  const isLedgerHorizontal = Math.abs(ledgerStart.y - ledgerEnd.y) < EPSILON;

  // Step 4: Greedy maximal rectangle merging
  // For horizontal ledger: merge along columns (vertically) first, then merge adjacent equal-height strips
  // For vertical ledger: merge along rows (horizontally) first, then merge adjacent equal-width strips
  const mergedRectangles = greedyMerge(grid, xCoords, yCoords, isLedgerHorizontal);

  return mergedRectangles;
}
```

The `greedyMerge()` function should work as follows:

```javascript
function greedyMerge(grid, xCoords, yCoords, mergeVerticalFirst) {
  // grid is a 2D boolean array: grid[col][row] = true if cell is inside polygon

  if (mergeVerticalFirst) {
    // Phase 1: For each column, merge contiguous runs of cells vertically
    const strips = [];
    for (let col = 0; col < grid.length; col++) {
      let runStart = null;
      for (let row = 0; row <= grid[col].length; row++) {
        if (row < grid[col].length && grid[col][row]) {
          if (runStart === null) runStart = row;
        } else {
          if (runStart !== null) {
            strips.push({
              x: xCoords[col],
              y: yCoords[runStart],
              width: xCoords[col + 1] - xCoords[col],
              height: yCoords[row] - yCoords[runStart],
              colStart: col, colEnd: col,
              rowStart: runStart, rowEnd: row - 1
            });
            runStart = null;
          }
        }
      }
    }

    // Phase 2: Merge horizontally adjacent strips with identical rowStart and rowEnd
    return mergeAdjacentStrips(strips, 'horizontal');
  } else {
    // Mirror logic: merge rows first, then columns
    // ... (same logic but transposed)
  }
}
```

This eliminates ALL the special-case branches. It works for 2, 3, 4, 5, 6, 7, 8, or any number of cells.

### Step 2.2: Clean up helper functions

Remove the dead/unused functions from shapeDecomposer.js:
- `findAdjacentCorners()` — unused
- `fallbackDecomposition()` — won't be needed with general algorithm
- `removeOverlapsAndMerge()` — comment says "for now, just return as-is"
- The old `mergeAdjacentRectangles()` — replaced by `greedyMerge()`
- The old recursive decomposition functions (`findConcaveVertexAndSplitLine`, `createSplitLineFromConcaveVertex`, etc.) — no longer the primary algorithm

Keep `isPointInsidePolygon()` — it's used elsewhere.
Keep `processRawRectangles()` — it adds ledger info and adjacency.
Keep `ensureClockwiseOrder()` — needed for output format.

### Step 2.3: Remove excessive console.log statements

The shapeDecomposer has dozens of console.log calls with emoji formatting. Remove all of them except for `console.error` calls for actual error conditions. If debugging is needed later, use conditional `console.debug` behind a flag.

Do the same cleanup in `multiSectionCalculations.js` and `deckCalculations.js` — there are hundreds of console.log calls throughout the codebase that add noise. Keep `console.warn` and `console.error` only.

### Verification:
- All tests pass (the pipeline tests from Phase 0 are critical here)
- Test decomposition with these shapes:
  - Rectangle → 1 section
  - L-shape → 2 sections
  - U-shape → 3 sections
  - T-shape → 2-3 sections
  - Plus-shape (+) → should work now even though it wasn't special-cased before
- Verify beam placement visually for L-shape and U-shape

---

## Phase 3: Eliminate Dual State Sync for Tiers

**Goal:** Remove the fragile `syncActiveTierToLegacy()` / `syncLegacyToActiveTier()` pattern. Make tiers the single source of truth.

### Step 3.1: Create accessor functions

In `stateManager.js`, add:

```javascript
/** Gets the points array for the active tier */
export function getActivePoints() {
  return appState.tiers[appState.activeTierId].points;
}

/** Sets the points array for the active tier */
export function setActivePoints(points) {
  appState.tiers[appState.activeTierId].points = points;
}

/** Gets isShapeClosed for the active tier */
export function isActiveShapeClosed() {
  return appState.tiers[appState.activeTierId].isShapeClosed;
}

/** Sets isShapeClosed for the active tier */
export function setActiveShapeClosed(closed) {
  appState.tiers[appState.activeTierId].isShapeClosed = closed;
}

// Same pattern for: selectedWallIndices, structuralComponents,
// rectangularSections, deckDimensions, isDrawing
```

### Step 3.2: Replace legacy field reads with accessor calls

Search app.js for all reads of `appState.points`, `appState.isShapeClosed`, `appState.selectedWallIndices`, `appState.structuralComponents`, `appState.rectangularSections`, `appState.deckDimensions`, and `appState.isDrawing`.

Replace each with the corresponding accessor function. **Do this incrementally, one field at a time**, running tests after each field.

Order of replacement (safest first):
1. `appState.isShapeClosed` → `isActiveShapeClosed()` (read) / `setActiveShapeClosed(val)` (write)
2. `appState.points` → `getActivePoints()` (read) / `setActivePoints(val)` (write)
3. `appState.isDrawing` → `isActiveDrawing()` / `setActiveDrawing(val)`
4. `appState.selectedWallIndices` → accessor functions
5. `appState.rectangularSections` → accessor functions
6. `appState.structuralComponents` → accessor functions
7. `appState.deckDimensions` → accessor functions

### Step 3.3: Remove sync functions

Once all reads/writes go through accessors:
1. Remove `syncActiveTierToLegacy()` and `syncLegacyToActiveTier()` from stateManager.js
2. Remove all calls to these functions from app.js
3. Remove the legacy fields (`appState.points`, `appState.isShapeClosed`, etc.) from `createInitialState()` — they're now only stored in `appState.tiers[x]`
4. Remove the defensive desync check at app.js line 3991-4000

### Step 3.4: Update save/load serialization

Check `createProjectData()` and any load/restore functions in app.js. They may reference `appState.points` directly. Update them to use tier data. Ensure backwards compatibility: if loading an old save that has `points` at the top level but no `tiers`, migrate it into `tiers.upper`.

### Verification:
- All tests pass
- Draw a shape on upper tier, switch to lower tier, draw another shape — both persist correctly
- Save a project, reload — both tiers restore correctly
- Load an old-format project (pre-tier) — migrates to tier format
- No console warnings about state desync

---

## Phase 4: Harden Structural Calculations for Complex Shapes

**Goal:** Fix the beam placement issues that occur with non-rectangular shapes.

### Step 4.1: Audit beam positioning in multiSectionCalculations.js

The `calculateMultiSectionStructure()` function (line 168) calculates structure per-section then merges. The merge step in `mergeSectionResults()` (line 576) and `handleBeamMerging()` (line 697) is where beam placement errors most likely occur.

Read `handleBeamMerging()` carefully. The current logic tries to merge collinear beams across sections. The likely bug is:
- Two sections share an edge, both generate a beam along that edge
- The merge either fails to combine them (resulting in overlapping beams) or incorrectly merges beams that shouldn't be merged

Fix: After merging, validate that:
1. No two beams overlap (occupy the same space)
2. Every beam is within the deck boundary polygon
3. Beam endpoints connect to section boundaries (not floating in space)

Add a `validateMergedStructure()` function that runs these checks and logs warnings for any violations.

### Step 4.2: Fix beam generation for L-shaped decks

The most common complex shape is the L-shape. For L-shapes with a horizontal ledger:
- Section 1 (full width) should have beams running horizontally
- Section 2 (the leg) should have beams running horizontally at the same Y positions where possible

Read `determineGlobalJoistDirection()` in multiSectionCalculations.js and verify it correctly establishes a consistent direction. Then read `reorientSectionForGlobalJoistDirection()` to verify it correctly rotates section points.

The reorientation is where beam direction can go wrong — if a section's points aren't rotated correctly, the "ledger edge" for that section points the wrong way, and joists/beams are generated perpendicular to what they should be.

### Step 4.3: Add structural validation tests

Expand `__tests__/structuralCalculations.test.js`:

```javascript
// Test: L-shape beam positions
// Given an L-shape decomposed into 2 rectangles
// When calculateMultiSectionStructure() is called
// Then: all beams are within the L-shape polygon
// And: no two beams overlap
// And: joists in both sections run in the same direction

// Test: U-shape beam positions
// Given a U-shape decomposed into 3 rectangles
// Then: beams on the three "bottom" edges don't overlap
// And: shared edges between sections don't have duplicate beams
```

### Verification:
- All tests pass
- Draw an L-shape, select ledger, generate plan → beams are correctly placed
- Draw a U-shape, select ledger, generate plan → beams are correctly placed
- Draw a T-shape → beams are correctly placed
- No beams extend outside the deck shape boundary

---

## Phase 5: Clean Up app.js (Optional but Recommended)

**Goal:** Reduce app.js from 10,800 lines to a manageable size by extracting self-contained sections into their own modules.

### Step 5.1: Extract wizard/stepper logic

Move all wizard-related functions to a new `deckCalcjs/wizardController.js`:
- `initializeWizard()`, `renderWizardStepList()`, `showWizardStepContent()`
- `updateWizardNextButton()`, `handleWizardStepClick()`, `goToNextStep()`, `goToPreviousStep()`
- `setWizardStep()`, `navigateToStep()`, `isStepAvailable()`, `isStepComplete()`
- `handleStepEntry()`, `onStepComplete()`, `markStepComplete()`, `markStepIncomplete()`
- Related: `updateMobileBottomNav()`, `updateBOMVisibility()`

This is ~400 lines of code that has zero coupling to drawing/calculation logic.

### Step 5.2: Extract project management logic

Move save/load/project functions to `deckCalcjs/projectManager.js`:
- `createProjectData()`, `getSavedProjects()`, `saveProjectsToStorage()`
- `getStoreConfig()`, `saveStoreConfig()`, `getUserPrefs()`, `saveUserPrefs()`
- All modal management for projects (open, close, filter, render)
- `getCurrentFilters()`, `filterProjects()`, `getStoreBadgeHtml()`

This is ~600+ lines that deals only with localStorage and project CRUD.

### Step 5.3: Extract 3D viewer logic

Move all 3D-related functions to a new `deckCalcjs/viewer3DController.js`:
- `setViewMode()`, `set3DViewPreset()`, `update3DView()`
- `getDeckBounds()`, `drawPost3D()`, `drawBeam3D()`, `drawJoist3D()`
- `drawRim3D()`, `drawLedger3D()`, `drawDecking3D()`

This is ~400 lines.

### Step 5.4: Extract settings/admin logic

Move admin/settings functions to `deckCalcjs/adminController.js`:
- `openAdminLogin()`, `openSettingsModal()`, `closeSettingsModal()`
- `renderStoresList()`, `handleAddStore()`, `handleRemoveStore()`
- `handleAddSalesperson()`, `handleRemoveSalesperson()`, `handleChangePassword()`
- Auth UI functions

This is ~500+ lines.

### Step 5.5: Extract decking step logic

Move decking-specific functions to `deckCalcjs/deckingController.js`:
- `initializeDeckingStep()`, `cleanupDeckingStep()`, `setupDeckingMaterialListener()`
- `calculateBreakerSuggestion()`, `addBreakerBoard()`, `renderBreakerBoardsList()`
- `handleBreakerPlacement()`, `updateDeckingSummary()`

This is ~500 lines.

After these extractions, app.js should be roughly 7,000-8,000 lines — still large but significantly more manageable. The remaining code in app.js would be the core initialization, event wiring, and the `applyDrawingAction()` dispatcher.

### Verification:
- All tests pass
- Full manual walkthrough: draw shape → select walls → generate plan → add stairs → configure decking → review BOM → save → reload
- No console errors
- No functional regressions

---

## General Rules for All Phases

1. **Never break the build.** After every file change, verify the app loads in a browser without console errors. If you're unsure, open `index.html` and check.

2. **Commit after each phase.** Each commit should be a working state. Commit message format: `Phase N: [description]`.

3. **Don't refactor what you aren't fixing.** If a function works correctly but is ugly, leave it alone. We're fixing reliability, not aesthetics.

4. **Preserve all existing function signatures that are called from HTML.** The `index.html` file has inline `onclick` handlers that call functions on `window`. Don't rename or remove those without updating the HTML.

5. **Keep `window.appState` available.** It's used by HTML onclick handlers and for debugging. Even after Phase 3, expose the state on window.

6. **Run `npm test` after every significant change.** If a test fails, fix it before moving on.

7. **45-degree and 22.5-degree angles.** The snapping system already supports 45-degree. Adding 22.5-degree is trivial — it's just adding more entries to the `snapAngles` array. Include `[0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180, -22.5, -45, -67.5, -90, -112.5, -135, -157.5]` in the angle set. The validation in `shapeValidator.js` will also need to accept these angles in `hasOnlyRightAngles()` — add `cos(22.5°) ≈ 0.924` and `cos(67.5°) ≈ 0.383` checks.

   **However:** if the decomposer or structural calculations can't handle non-90° and non-45° angles cleanly, remove 22.5° support. Don't add it if it creates new edge cases in decomposition. 45° is sufficient.

8. **Multi-tier implementation note for the future:** The stair landing use case (deck → stairs → landing → stairs → ground) is essentially the same as multi-tier: each landing is a tier at a different height with its own shape. The current tier system with `upper` and `lower` should be extended to support N tiers with arbitrary names. This is NOT in scope for this refactor, but the Phase 3 accessor pattern makes it easy to add later — just change `activeTierId` and everything works through the same accessors.

---

## Execution Order Summary

```
Phase 0 → Safety net (tests)           — NO source changes except import paths
Phase 1 → Drawing state machine        — Fixes closing/drawing bugs
Phase 2 → General decomposer           — Fixes decomposition bugs
Phase 3 → Single source of truth       — Fixes tier state desync
Phase 4 → Structural calc hardening    — Fixes beam placement
Phase 5 → app.js cleanup (optional)    — Reduces maintenance burden
```

Each phase depends on the previous one. Do not skip phases. If a phase reveals new bugs, add test cases before fixing them.
