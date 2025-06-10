# Complex Deck Shapes Implementation Plan

## Overview
This plan implements support for complex deck shapes with 90-degree corners that are automatically decomposed into rectangular sections for structural calculations.

## Phase 1: Shape Validation and Decomposition

### Step 1: Enhanced Shape Validation
**File:** `deckCalcjs/shapeValidator.js` (new file)

**Claude Code Prompt:**
```
Create a new file `deckCalcjs/shapeValidator.js` that validates deck shapes and ensures they can be decomposed into rectangles. The module should:

1. Export a function `validateShape(points)` that:
   - Checks that all corners are 90 degrees (within EPSILON tolerance)
   - Verifies the shape is a simple polygon (no self-intersections)
   - Ensures the shape can be decomposed into rectangles
   - Returns { isValid: boolean, error: string | null }

2. Export a function `hasOnlyRightAngles(points)` that:
   - Calculates the angle at each vertex
   - Allows for 90, 180, or 270 degree angles only
   - Uses the EPSILON constant for floating-point comparisons

3. Import necessary utilities from config.js and utils.js
4. Include comprehensive error messages for different validation failures
5. Add JSDoc documentation for all functions

The validation should run before allowing shape closure in the main app.
```

### Step 2: Rectangle Decomposition Algorithm
**File:** `deckCalcjs/shapeDecomposer.js` (new file)

**Claude Code Prompt:**
```
Create a new file `deckCalcjs/shapeDecomposer.js` that decomposes complex deck shapes into rectangular sections. The module should:

1. Export a function `decomposeShape(points, ledgerWallIndex)` that:
   - Takes a valid polygon and the index of the ledger wall
   - Decomposes the shape into rectangles starting from the ledger wall outward
   - Returns an array of rectangle objects, each with:
     ```javascript
     {
       id: string,
       corners: [{x, y}, {x, y}, {x, y}, {x, y}], // in clockwise order
       ledgerWall: {p1, p2} | null, // if this rectangle has ledger
       isLedgerRectangle: boolean,
       adjacentRectangles: [string], // IDs of adjacent rectangles
       sharedEdges: [{rectangleId, edge: {p1, p2}}] // shared boundaries
     }
     ```

2. Export a helper function `findLedgerDirection(points, ledgerWallIndex)` that:
   - Determines the primary direction (horizontal/vertical) from the ledger
   - This will guide the decomposition strategy

3. Export a function `createDecompositionLines(points, ledgerDirection)` that:
   - Creates the internal lines needed to split the shape into rectangles
   - Lines should extend from concave corners perpendicular to the ledger direction
   - Returns array of line segments that will create the rectangular sections

4. For testing purposes, also export `visualizeDecomposition(rectangles)` that:
   - Returns data that can be used to shade different rectangles with different colors
   - This will help us verify the decomposition is working correctly

5. Import utilities from config.js and utils.js
6. Handle edge cases like shapes that are already rectangular
7. Add comprehensive JSDoc documentation

The algorithm should always decompose from ledger outward, creating the minimum number of rectangles needed.
```

### Step 3: Integration with Main App
**File:** `deckCalcjs/app.js` (modify existing)

**Claude Code Prompt:**
```
Modify the existing `deckCalcjs/app.js` file to integrate shape validation and decomposition:

1. Import the new modules:
   ```javascript
   import * as shapeValidator from "./shapeValidator.js";
   import * as shapeDecomposer from "./shapeDecomposer.js";
   ```

2. In the `handleCanvasClick` function, modify the shape closing logic to:
   - Call `shapeValidator.validateShape(appState.points)` before closing
   - If invalid, show error message and don't close the shape
   - If valid, proceed with closing and call decomposition

3. Add a new property to `appState`:
   ```javascript
   rectangularSections: [], // Will store the decomposed rectangles
   showDecompositionShading: true, // For testing visualization
   ```

4. Create a new function `decomposeClosedShape()` that:
   - Calls `shapeDecomposer.decomposeShape(appState.points, appState.selectedWallIndex)`
   - Stores the result in `appState.rectangularSections`
   - Triggers a redraw to show the decomposition (for testing)

5. Call `decomposeClosedShape()` after successful shape validation and closure

6. Add error handling for decomposition failures

This integration should maintain all existing functionality while adding the new shape decomposition capability.
```

## Phase 2: Visualization and Testing

### Step 4: Decomposition Visualization
**File:** `deckCalcjs/canvasLogic.js` (modify existing)

**Claude Code Prompt:**
```
Modify the existing `deckCalcjs/canvasLogic.js` file to add visualization of shape decomposition:

1. In the `drawDeckContent` function, add a new section for drawing decomposition shading:
   - Check if `state.showDecompositionShading` is true and `state.rectangularSections` exists
   - Draw each rectangle with a different semi-transparent color overlay
   - Use colors like: rgba(255,0,0,0.1), rgba(0,255,0,0.1), rgba(0,0,255,0.1), etc.
   - Cycle through colors if there are more rectangles than colors

2. Add a new function `drawRectangleShading(ctx, rectangle, colorIndex, scale)` that:
   - Draws a filled rectangle with semi-transparent color
   - Takes the rectangle corners and fills the area
   - Adjusts opacity based on scale for better visibility

3. Add decomposition lines visualization:
   - Draw the internal lines that separate rectangles
   - Use a dashed line style with a distinct color (e.g., purple)
   - Make lines visible but not overwhelming

4. Ensure this visualization only appears when `showDecompositionShading` is true
   - This will allow us to turn it off once we're confident the decomposition works

5. The shading should appear behind all other structural elements but above the grid

This will help us verify that the decomposition algorithm is working correctly before proceeding to structural calculations.
```

### Step 5: Testing Interface
**File:** `index.html` (modify existing)

**Claude Code Prompt:**
```
Add testing controls to the existing `index.html` file for decomposition visualization:

1. In the floating controls section (where zoom buttons are), add a new button:
   ```html
   <button
     id="toggleDecompositionBtn"
     class="btn btn-secondary text-xs px-3 py-2 leading-tight shadow-lg"
     title="Toggle Decomposition View"
   >
     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
       <path fill-rule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h9.5A2.25 2.25 0 0117 4.25v2.5A2.25 2.25 0 0114.75 9h-9.5A2.25 2.25 0 013 6.75v-2.5zm2.25-.75a.75.75 0 00-.75.75v2.5c0 .414.336.75.75.75h9.5a.75.75 0 00.75-.75v-2.5a.75.75 0 00-.75-.75h-9.5z" clip-rule="evenodd" />
       <path fill-rule="evenodd" d="M3 13.25A2.25 2.25 0 015.25 11h9.5A2.25 2.25 0 0117 13.25v2.5A2.25 2.25 0 0114.75 18h-9.5A2.25 2.25 0 013 15.75v-2.5zm2.25-.75a.75.75 0 00-.75.75v2.5c0 .414.336.75.75.75h9.5a.75.75 0 00.75-.75v-2.5a.75.75 0 00-.75-.75h-9.5z" clip-rule="evenodd" />
     </svg>
   </button>
   ```

2. Add the button event listener in app.js:
   ```javascript
   const toggleDecompositionBtn = document.getElementById("toggleDecompositionBtn");
   if (toggleDecompositionBtn) {
     toggleDecompositionBtn.addEventListener("click", handleToggleDecomposition);
   }
   
   function handleToggleDecomposition() {
     appState.showDecompositionShading = !appState.showDecompositionShading;
     
     // Update button appearance
     if (appState.showDecompositionShading) {
       toggleDecompositionBtn.classList.add('btn-primary');
       toggleDecompositionBtn.classList.remove('btn-secondary');
     } else {
       toggleDecompositionBtn.classList.add('btn-secondary');
       toggleDecompositionBtn.classList.remove('btn-primary');
     }
     
     redrawApp();
   }
   ```

3. Add CSS styling for the new button to match existing floating controls

This will allow us to easily toggle the decomposition visualization on/off during testing.
```

## Phase 3: Multiple Wall Selection

### Step 6: Enhanced Wall Selection
**File:** `deckCalcjs/app.js` (modify existing)

**Claude Code Prompt:**
```
Modify the wall selection logic in `deckCalcjs/app.js` to support multiple parallel wall segments:

1. Change `appState.selectedWallIndex` to `appState.selectedWallIndices: []`

2. Modify the wall selection click handler to:
   - Allow selection of multiple wall segments
   - Ensure all selected segments are parallel (within EPSILON tolerance)
   - Show visual feedback for all selected walls
   - Provide error message if user tries to select non-parallel walls

3. Add a function `areWallsParallel(wallIndex1, wallIndex2, points)` that:
   - Calculates the direction vectors of both walls
   - Returns true if they are parallel (or anti-parallel)
   - Uses EPSILON for floating-point comparison

4. Update the wall selection UI to show:
   - "Select wall segments for ledger attachment"
   - "All selected walls must be parallel"
   - Count of selected walls
   - Button to confirm wall selection and proceed

5. Modify `calculateAndUpdateDeckDimensions()` to handle multiple wall segments

6. Update the shape decomposition to use all selected wall segments as ledger walls

This allows for L-shaped or complex decks where the ledger spans multiple parallel segments.
```

## Phase 4: Multi-Section Structural Calculations

### Step 7: Enhanced Structural Calculations
**File:** `deckCalcjs/multiSectionCalculations.js` (new file)

**Claude Code Prompt:**
```
Create a new file `deckCalcjs/multiSectionCalculations.js` that handles structural calculations for decomposed shapes:

1. Export a function `calculateMultiSectionStructure(rectangularSections, inputs, selectedWallIndices, originalPoints)` that:
   - Calculates structure for each rectangular section independently
   - Uses the existing `deckCalculations.calculateStructure()` for each section
   - Merges overlapping/collinear beams between sections
   - Returns a combined structural components object

2. Export a function `mergeSectionResults(sectionResults)` that:
   - Combines beams, posts, footings, joists, etc. from all sections
   - Merges collinear beams and combines their properties
   - Handles beam intersections by using the larger beam size
   - Removes duplicate posts/footings at shared locations

3. Export a function `handleBeamMerging(allBeams)` that:
   - Identifies beams that should be merged (collinear, same type)
   - Creates new merged beam objects with combined length
   - Updates post positions to match merged beams
   - Returns the merged beam array

4. Export a function `calculateSectionDimensions(rectangle)` that:
   - Converts rectangle corners to the deck dimensions format
   - Returns {widthFeet, heightFeet, minX, maxX, minY, maxY}

5. Handle edge cases:
   - Sections with no structural elements
   - Very small sections
   - Sections that only contain blocking or minor elements

6. Maintain compatibility with existing BOM and summary calculations

The calculations should apply the same user inputs (joist spacing, beam type, etc.) to all sections.
```

### Step 8: Integration with Main Calculations
**File:** `deckCalcjs/app.js` (modify existing)

**Claude Code Prompt:**
```
Modify the `handleGeneratePlan()` function in `deckCalcjs/app.js` to use multi-section calculations:

1. Import the new multi-section calculations module:
   ```javascript
   import * as multiSectionCalculations from "./multiSectionCalculations.js";
   ```

2. Modify the plan generation logic to:
   - Check if `appState.rectangularSections` exists and has multiple sections
   - If single section (simple rectangle), use existing logic
   - If multiple sections, use `calculateMultiSectionStructure()`

3. Add a function `isSimpleRectangle()` that:
   - Returns true if there's only one rectangular section
   - This allows us to maintain existing behavior for simple decks

4. Update error handling for multi-section calculation failures

5. Ensure the generated structure is compatible with:
   - Existing BOM calculations
   - Stair placement logic
   - Summary display
   - Canvas rendering

6. Add logging to help debug multi-section calculations

The integration should be seamless - users shouldn't notice different behavior except for the support of complex shapes.
```

## Phase 5: Canvas Rendering Updates

### Step 9: Multi-Section Rendering
**File:** `deckCalcjs/canvasLogic.js` (modify existing)

**Claude Code Prompt:**
```
Update the canvas rendering in `deckCalcjs/canvasLogic.js` to properly display multi-section structures:

1. Modify `drawStructuralComponentsInternal()` to:
   - Handle merged beams that may span multiple sections
   - Ensure proper layering of structural elements
   - Handle beam intersections visually

2. Update beam drawing to:
   - Show merged beams as continuous elements
   - Use consistent sizing for merged beams
   - Handle beam intersections with appropriate visual cues

3. Ensure joists are drawn correctly:
   - Joists should respect section boundaries where appropriate
   - Show continuous joists spanning sections when applicable

4. Update the legend if needed to explain multi-section elements

5. Maintain blueprint mode compatibility:
   - All structural elements should render properly in blueprint mode
   - Merged beams should show accurate dimensions

6. Performance considerations:
   - Efficient rendering of potentially many more structural elements
   - Proper clipping and culling for large complex shapes

The rendering should clearly show the unified structural system while maintaining visual clarity.
```

## Phase 6: Stair Placement Updates

### Step 10: Multi-Section Stair Placement
**File:** `deckCalcjs/app.js` (modify existing)

**Claude Code Prompt:**
```
Update stair placement logic in `deckCalcjs/app.js` to work with multi-section decks:

1. Modify `handleStairPlacementClick()` to:
   - Only allow stairs on outer perimeter edges
   - Prevent stair placement on internal section boundaries
   - Identify which edges are outer perimeter vs internal boundaries

2. Add a function `isOuterPerimeterEdge(rimJoist, rectangularSections)` that:
   - Determines if a rim joist is on the outer perimeter
   - Returns false for internal section boundaries
   - Uses the rectangular sections data to make this determination

3. Update stair validation to:
   - Ensure stairs don't span across section boundaries
   - Maintain existing stair sizing and placement logic
   - Show appropriate error messages for invalid placements

4. Visual feedback:
   - Highlight valid stair placement locations during stair mode
   - Show why certain edges can't accept stairs

The stair placement should work seamlessly with complex shapes while respecting the outer-perimeter-only constraint.
```

## Phase 7: Testing and Refinement

### Step 11: Comprehensive Testing
**Manual Testing Plan:**

1. **Basic Shapes:**
   - Test existing rectangular decks still work perfectly
   - Verify no regressions in simple deck functionality

2. **L-Shaped Decks:**
   - Draw various L-shapes with different orientations
   - Verify decomposition creates exactly 2 rectangles
   - Test multiple parallel ledger walls

3. **Complex Shapes:**
   - U-shapes, T-shapes, and other complex forms
   - Verify structural calculations for each shape type
   - Test beam merging at intersections

4. **Edge Cases:**
   - Very small sections
   - Long narrow sections
   - Shapes with many small notches

5. **BOM Verification:**
   - Compare BOM results between simple and decomposed shapes
   - Verify merged beams appear correctly in materials list
   - Check post and footing counts

### Step 12: Performance Optimization
**Files:** Various (modify as needed)

**Claude Code Prompt:**
```
Review and optimize performance for complex shape handling:

1. Profile the decomposition algorithm for complex shapes
2. Optimize structural calculations for multiple sections
3. Improve canvas rendering performance for many elements
4. Add caching where appropriate for expensive calculations
5. Ensure smooth interaction during shape drawing and editing

Focus on maintaining 60fps during drawing and reasonable calculation times (<2 seconds) for complex shapes.
```

## Phase 8: Cleanup and Documentation

### Step 13: Remove Testing Visualization
**Files:** Multiple

**Claude Code Prompt:**
```
Clean up the testing and debugging features:

1. Remove or hide the decomposition shading toggle button
2. Set `showDecompositionShading` to false by default
3. Clean up any debug logging
4. Ensure the UI is clean and user-friendly
5. Update any tooltips or help text to reflect new capabilities

The final interface should be as clean as the original, with no visible indication of the complexity underneath.
```

### Step 14: Documentation Update
**File:** `README.md` or similar

**Claude Code Prompt:**
```
Update project documentation to reflect the new complex shape capabilities:

1. Document the supported shape types
2. Explain the 90-degree corner requirement
3. Update any technical documentation about the calculation methods
4. Add examples of complex deck shapes
5. Document any limitations or known issues

The documentation should help future developers understand the decomposition approach and structural calculation methods.
```

## Implementation Notes

1. **Order Dependencies:** Steps must be completed in order as later steps depend on earlier implementations.

2. **Testing Between Steps:** Test thoroughly after each step before proceeding to avoid compounding issues.

3. **Rollback Strategy:** Each step should be implementable as a separate commit, allowing rollback if issues arise.

4. **Performance:** Monitor performance after each step, especially for canvas rendering and structural calculations.

5. **Compatibility:** Maintain full backward compatibility with existing simple rectangular decks throughout the implementation.

## Success Criteria

- [ ] All diagram examples from the original request work correctly
- [ ] Existing simple deck functionality unchanged
- [ ] BOM calculations accurate for complex shapes
- [ ] Stair placement works on outer perimeter only
- [ ] Multiple parallel ledger walls supported
- [ ] Performance remains acceptable
- [ ] No visual artifacts or rendering issues
- [ ] Error handling for invalid shapes
- [ ] Clean, intuitive user experience