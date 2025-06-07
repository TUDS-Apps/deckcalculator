**Deck Calculator App – Development Brief V8** Updated: May 11, 2025

**1\. Project Goal** Develop a web-based application that allows users to:

* Draw simple and, in later phases, complex deck shapes (initially L-shapes and other 90-degree cornered polygons).  
* Input deck specifications.  
* Automatically generate:  
  * A 2D layout/blueprint (Ledger/Wall Rim, Beams, Joists, Posts, Footings, Rim Joists, Blocking, Stairs).  
  * A Bill of Materials (BOM) using only stocked items with optimized usage.  
  * A project summary.

**Target Platform:** Standalone web app (initial). Future Plan: Shopify integration.

**Code Architecture:**

* HTML for structure.  
* Tailwind CSS for primary styling, with custom styles in an external `deckcalculatorstyles.css` file.  
* JavaScript organized into ES6 modules, requiring a local development server:  
  * `app.js`: Main application orchestrator, state management, top-level event handlers. (Current: v6 \- Panning & Button Relocation)  
  * `config.js`: Application-wide constants (dimensions, tolerances, colors, etc.).  
  * `utils.js`: General utility functions (distance calculation, string/number parsing, formatting, point simplification).  
  * `dataManager.js`: Manages application data (embedded CSV strings, joist span data; parsing functions, data accessors).  
  * `uiController.js`: Handles DOM manipulation for UI elements outside the canvas (forms, BOM/summary tables, status messages). (Current: v3 \- Enhanced Summary)  
  * `canvasLogic.js`: Manages canvas setup, drawing operations (grid, deck outline, components, stairs, dimensions), direct canvas event handling. (Current: v9 \- Interactive Grid Fixes, Print Enhancements)  
  * `deckCalculations.js`: Core structural logic for component sizing and placement. (Current: v13 \- Continuous 2x8s Logic)  
  * `stairCalculations.js`: Detailed stair geometry calculations.  
  * `bomCalculations.js`: Bill of Materials generation, lumber optimization, hardware selection. (Current: v33 \- Updated Stair Landing Rules)

**2\. Core Features**

**2.1 Interactive Drawing Canvas**

* **Grid:** 50' x 40' (conceptual drawing area), snap-to-grid every 6" (where 24px \= 1ft). Interactive grid drawing improved.  
* **Drawing (Simple Shapes):** Click-to-place 90° lines, real-time preview line with dimensions, auto-closing of shape when clicking near the start point.  
* **Editing:** `Backspace` key deletes the last placed point during outline drawing. `Delete` key removes selected stairs.  
* **Wall Selection (Simple Shapes):** User selects the attached wall (or primary reference wall for floating/concrete attachment) after the deck shape is closed.  
* **Layout Display:** "Generate Plan" button populates the canvas with all calculated structural components.  
* **Legend:** Dynamically displayed key for component colors, positioned at the top of the canvas card.  
* **Clear Functionality:** "Clear" button (grouped with zoom/pan controls) resets the canvas, all user inputs, calculated results, and exits stair mode.  
* **Stair Display:** Permanent width dimension shown at the bottom of placed stairs. Live positioning dimensions (distance from stair edges to rim joist ends) shown during stair dragging.  
* **Stair Interaction:** Click to select/deselect stairs. Drag selected stairs along their attached rim joist (constrained within the rim's length).  
* **Dimension Display:** Dimensions are drawn with improved spacing from lines for better readability. Enhanced for print.  
* **Viewport Controls:**  
  * Zoom In / Zoom Out buttons.  
  * Center & Fit Drawing button.  
  * Panning via middle mouse button.

**2.2 Input & Control Panel**

* **Position:** Left side of the screen.  
* **Manual Inputs – Main Deck:**  
  * Deck Height (Floor to Ground): Default 4'0".  
  * Footing Type: Default "GH Levellers \+ 16x16 slab". Options: Pylex, Helical.  
  * Joist Spacing (On Center): Default 16" OC. Options: 12" OC.  
  * Attachment Type: Default "House Rim (Ledger)". Options: "Concrete Foundation", "Floating".  
  * Beam Type: Default "Drop Beam". Options: "Flush Beam".  
  * Picture Frame: Default "None". Options: "Single", "Double".  
  * Joist Protection: Default "None". Options: "G-Tape", "Deck Coating".  
  * Framing Fasteners: Default "3" Deck Screws". Options: U2 3-1/8", Paslode 3-1/4".  
* **Manual Inputs – Stairs** (Section appears after clicking "Add Stairs"):  
  * Width: 4–20 ft (in 1 ft increments).  
  * Stringer Type: Pylex Steel, LVL Wood, or Custom Cut 2x12.  
  * Landing Type: Existing surface, 16"x16" slabs, or Poured concrete pad.  
* **Controls:**  
  * "Generate Plan" button: Triggers structural calculations and BOM generation.  
  * "Add Stairs" button: Enters stair placement mode and shows stair input options.  
  * "Cancel Adding Stairs" button: Exits stair placement mode.  
  * "Clear" button (grouped with canvas viewport controls).

**2.3 Output Panel**

* **Project Summary:** Dynamically updated section showing key deck dimensions, calculated joist/beam sizes, post/footing types, attachment method, and detailed rise/run/stringer info for any added stairs.  
* **Bill of Materials (BOM):** Table displaying Qty, Item, Description, Unit Price, and Total Price. Appears after plan generation and updates with changes.  
* **Print Functionality:** Browser print function tailored with specific print CSS for Summary, Canvas Plan, Legend, and BOM. Canvas print includes better grid coverage and scaled icons/fonts.

**2.4 Complex Deck Shape Design (Phase 1: 90-Degree Angles) \- NEW**

* **User Drawing Experience:**  
  * Users can draw multi-segment deck outlines by clicking to place points.  
  * The system will enforce 90-degree angles between consecutive segments during drawing (except for the closing segment). Real-time preview line and dimensions will continue to assist.  
  * Auto-closing by clicking near the start point remains. `simplifyPoints` will be used.  
* **Multi-Segment Wall Selection:**  
  * After closing a complex shape, users can select multiple *contiguous* deck outline segments that are attached to the house.  
  * Selected segments will be visually highlighted. A "Confirm Attached Walls" action will finalize the selection.  
  * `appState.selectedWallSegmentIndices` will store this information.  
* **Internal Logic:**  
  * **Shape Analysis & Decomposition:**  
    * The application will validate the drawn polygon (e.g., for self-intersections, 90-degree corners).  
    * Valid complex shapes will be decomposed into a minimal set of non-overlapping rectangles (e.g., an L-shape into two rectangles). These are stored as `deckSections`.  
  * **Joist Direction:** Determined automatically for each decomposed `deckSection`, typically running perpendicular to the attached house wall segment(s) corresponding to that section.  
  * **Component Calculation:**  
    * Existing calculation logic in `deckCalculations.js` will be refactored into modular functions that operate on individual rectangular `deckSection` data.  
    * The main `calculateStructure` function will orchestrate:  
      * Decomposition of the overall shape.  
      * Iteration through each `deckSection` to calculate its specific joists, beams, posts, local rim joists, and blocking using the modular functions.  
      * Beams will be calculated independently for each section.  
    * Perimeter components (e.g., overall picture framing, final outer rim joists) will be calculated based on the full complex shape outline after section processing.  
* **Canvas & UI Updates:**  
  * Canvas will render the complex outline and all calculated components. Dimensions will be shown for all outer segments.  
  * The Project Summary will be enhanced to display overall bounding box dimensions and key specifications (dimensions, joist info, beams) for each distinct "wing" or decomposed section of the complex shape.

**3\. Structural & Calculation Logic**

**3.1 General Rules**

* Calculations triggered by "Generate Plan" button.  
* **Joists (Simple Rectangular Decks):** Run perpendicular to the selected attached wall; beams run parallel.  
* **Joists (Complex Shapes \- Phase 1):** Within each decomposed rectangular section, joists run perpendicular to the effective attached wall segment(s) for that section. Beams run parallel to these joists within that section.  
* A mid-beam is automatically added if a deck section's depth (joist span) exceeds the maximum allowable span for the selected joist size and spacing.

**3.2 Component Sizing & Placement** (Largely as per V7, applied per section for complex shapes)

* **Posts:** 6x6 if deck height ≥ 5’ (60 inches); otherwise 4x4. Maximum 8' spacing. Inset 1' from ends of supported beam span.  
* **Beams (Drop & Flush):** 3-ply if 6x6 posts; 2-ply if 4x4 posts. Lumber size matches joist size. 1' cantilever past end support posts.  
  * Drop Beam: Positioned with a 1' offset from the deck edge/reference line.  
  * Flush Beam: Positioned directly at the deck edge/reference line.  
* **Joists:** Size by span tables (2x6 → 2x12). 2x6 not used if deck height ≥ 24". If mid-beam present in a section, joists calculated as two segments for that section. For 2x8 joists on decks 18-20ft deep requiring a mid-beam, these (and their corresponding End Joists/Picture Frame Joists) are treated as continuous single pieces.  
* **Ledger / Wall Rim Joist / Wall-Side Beam:**  
  * `Ledger`: If "House Rim" attachment. Size matches beam size (1-ply). Follows selected attached wall (can be multi-segment for complex shapes).  
  * `Wall Rim Joist`: If "Concrete Foundation." Size matches joist size.  
  * `Wall-Side Beam`: If "Floating." Rules as other beams.  
* **Rim Joists (End Joists & Outer Rim):** Size matches main joist size. Segments created for sides perpendicular to main joists ("End Joists") and for side(s) opposite ledger/wall rim/wall-side beam ("Outer Rim Joist"). For complex shapes, these trace the overall perimeter not covered by ledger/wall-side elements. Segmented if a mid-beam is present (unless 2x8/18-20ft rule applies).  
* **Footings:** One per post. Type based on user input.  
* **Blocking:**  
  * Mid-Span Blocking: Required if joist span between supports \> 8’. Placed at mid-points. Size matches main joist size (1-ply).  
  * Picture Frame Blocking: Added between outer rim joists and first/last picture frame joists if enabled. Size matches main joist size. For complex shapes, follows the overall perimeter.

**3.3 BOM Logic** (Largely as per V7)

* Stocking Rules: Items from `parsedStockData`, aggregated by `system_id`, sorted alphabetically.  
* Lumber Optimization:  
  * Joists: Shortest stock meeting/exceeding length; fallback to combinations. 20ft stock override for 2x8 joists/rims/PF joists if deck depth 18-20ft (exclusive/inclusive) and piece \> 17.5ft.  
  * End Joists/Rim Joists: Follows 20' override if applicable. Otherwise, best fit/fallback.  
  * Posts: Optimized to cut multiple required lengths from stock.  
  * Blocking: Picture Frame Blocking attempts primary joist stock; else best fit. Mid-Span Blocking uses best fit/fallback.  
  * Beams/Ledger/Wall Rim: Best fit/fallback.  
* Hardware Calculations: Ledger/Wall Rim fasteners, Joist Hangers, Beam-Post Connectors, Joist-Beam Ties, Corner Ties, SD Connector Screws, Framing Fasteners, Joist Protection, End Cut Sealer & Applicator Brush.  
* Stair Hardware & Materials: As per V7.

**3.4 Stair Logic**

* Rise/Run: Based on total deck height, ideal 7.5" rise, standard 10.5" run.  
* Stringers: Pylex (Qty=WidthFt), LVL/Custom 2x12 (Qty=WidthFt+1). Min 2\.  
* Landing Materials:  
  * Slabs: Quantity based on stair width (1 slab per 16" of width, assuming one row of slabs).  
  * Concrete Pad: Bags estimated based on pad dimensions (width derived from stair width, **4ft fixed depth**, 4" thickness). Form lumber (2x4) calculated.

**4\. Data Requirements** (As per V7)

* Stock List CSV (Embedded in `dataManager.js`).  
* Joist Span Chart (Hardcoded array in `dataManager.js`).  
* Manual Spans CSV (Embedded in `dataManager.js`).

**5\. UI/UX & Styling** (As per V7, noting implemented panning)

* Layout: 2-column responsive design. Panning and Zoom/Fit controls for canvas.  
* Color Palette: TUDS brand (config.js, deckcalculatorstyles.css).  
* Canvas: Grid display, color-coded components, dimensions.  
* Buttons: Clear primary/secondary hierarchy.  
* Typography: Inter font, clean, card-based UI.  
* Feedback: UI status messages.

**6\. Current Status – As of May 11, 2025**

* **Core Functionality (Rectangular Decks):**  
  * Deck outline drawing, wall selection, and comprehensive structural logic for ledger/wall rim/wall-side beam, beams (drop/flush, mid-beam, "Floating"), joists (incl. picture framing), posts, footings, rim joists, and blocking (mid-span & picture frame) is implemented and robust.  
  * Stair addition, placement (constrained by rim joist), selection, dragging, and deletion are functional.  
  * Real-time BOM and Project Summary updates are implemented.  
* **Calculations & BOM (Rectangular Decks):**  
  * Joist/beam/post sizing logic (including 2x6 height restrictions, 20ft stock override for 2x8 joists/rims/PF joists) is operational.  
  * Mid-beam correctly added when deck depth exceeds max joist spans.  
  * Hardware and stair material (including updated landing slab/pad logic) calculations are implemented. Post optimization is functional.  
* **Code Structure & Refinements:**  
  * JavaScript modularized into ES6 modules; CSS externalized. Functions broken down.  
* **UI/UX Enhancements:**  
  * Canvas panning (middle mouse) and Zoom/Fit/Clear buttons implemented and grouped above canvas.  
  * Interactive grid drawing on canvas fixed.  
  * Print output enhanced with better grid coverage, scaled icons/fonts, and improved dimension padding.  
  * Replaced most `alert()` calls with integrated UI status messages.  
* **Bug Fixes (Assumed from V7 and code versions):**  
  * `Illegal continue statement` in `canvasLogic.js` fixed.  
  * `simplifyPoints` logic correctly removes extra points on shape close.  
  * Joist count discrepancy (picture framing off) and picture frame blocking alignment issues resolved.  
  * Correct board count/fastener types for various attachment types (e.g., Titen HD for "Concrete Foundation") ensured.  
  * Various JavaScript reference errors post-modularization resolved.

**7\. Planned Development (Next Steps)**

* **Complex Deck Shapes \- Phase 1 (90-Degree Angles):**  
  * Implement user drawing of multi-segment outlines with enforced 90-degree angles.  
  * Develop UI and logic for selecting multiple contiguous attached wall segments.  
  * Implement polygon analysis and decomposition into minimal rectangles within `deckCalculations.js`.  
  * Refactor existing component calculation logic into modular functions operating on single rectangular sections.  
  * Adapt `calculateStructure` to orchestrate decomposition and per-section calculations (joists perpendicular to attached walls per section, beams independent per section).  
  * Update Project Summary to detail sections of complex shapes.  
  * Ensure BOM correctly aggregates materials from all sections.  
  * Thoroughly test with various L-shape and other 90-degree multi-segment configurations.

**8\. Excluded / Future Scope**

* **Advanced Complex Shapes (e.g., 45-degree angles, curves, multi-levels).** (45-degree angles are a high-priority fast follower).  
* User-defined joist direction for sections of complex shapes.  
* Integrated/shared beam logic at intersections of complex shape sections.  
* Decking, railing, and fascia materials and calculations.  
* Logic for multiple mid-beams if a single section's depth is excessively large (beyond one mid-beam).  
* 3D rendering of the deck.  
* PDF export of the plan and BOM.  
* Comprehensive input validation for all fields.  
* Advanced waste optimization algorithms beyond current post/joist/blocking logic.  
* Stair tread and railing materials.  
* Loading `maxJoistSpans` and other CSV data from actual files or API instead of embedded strings/arrays.  
* Shopify integration (live pricing, stock, embedded app).

**9\. Key Changes Made in this Update (V8 from V7):**

* Updated date to May 11, 2025\.  
* **Added detailed development plan for "Complex Deck Shapes (Phase 1: 90-Degree Angles)"** including drawing, multi-wall selection, shape decomposition, and modular calculation strategy.  
* Updated "Current Status" to reflect:  
  * Canvas panning and relocated/grouped Zoom/Fit/Clear controls.  
  * Fixes and enhancements to interactive grid and print output rendering from `canvasLogic.js v9`.  
  * **Revised stair landing material calculation rules:** Slabs now 1 per 16" of stair width; concrete pad depth changed to 4ft (from `bomCalculations.js v33`).  
  * Explicit mention of continuous 2x8s for Joists, End Joists, and PF Joists under the 18-20ft depth rule.  
* Updated "Excluded / Future Scope" to move initial 90-degree complex shapes into active development and specify 45-degree angles as a fast follower.  
* Reflected current JS module versions in "Code Architecture."

