# Deck Calculator App – Complete Development Brief V10
**Updated: November 27, 2025**

## 1. Executive Summary

The Deck Calculator is a professional web-based application designed to streamline deck construction planning and material estimation. The app enables users to draw deck outlines, input specifications, and automatically generate comprehensive 2D layouts with accurate Bill of Materials (BOM) using optimized lumber calculations and real inventory data.

**Current Status:** Core functionality complete including complex polygon shapes, diagonal support for bay windows, and multi-section structural calculations.

**Target Platform:** Standalone web application with future Shopify integration planned.

---

## 2. Technical Architecture

### 2.1 Code Organization
**JavaScript ES6 Modules Architecture (12 modules):**
- **app.js** (v8): Main application orchestrator, state management, event handling, panning functionality
- **config.js** (v8): Application constants (dimensions, tolerances, colors, lumber specifications, cantilever rules)
- **utils.js** (v8): Utility functions (geometry calculations, string parsing, formatting, polygon operations)
- **dataManager.js** (v8): Data management (embedded CSV parsing, joist span tables, stock inventory)
- **uiController.js** (v8): DOM manipulation for forms, BOM tables, summary displays
- **canvasLogic.js** (v8): Canvas rendering, drawing operations, interactive features, print optimization
- **deckCalculations.js** (v8): Core structural calculations, component sizing, beam/joist placement, diagonal support
- **stairCalculations.js** (v8): Detailed stair geometry and material calculations
- **bomCalculations.js** (v8): Material optimization, hardware selection, cost calculations
- **shapeValidator.js** (v8): Shape validation for complex deck shapes (90° corners)
- **shapeDecomposer.js** (v8): Polygon decomposition into rectangular sections
- **multiSectionCalculations.js** (v8): Multi-section structural calculations with beam merging

### 2.2 Technology Stack
- **Frontend**: HTML5, Tailwind CSS, Vanilla JavaScript (ES6 modules)
- **Styling**: External `deckcalculatorstyles.css` with Tailwind integration
- **Canvas**: HTML5 Canvas API for 2D rendering and interactive drawing
- **Data**: Embedded CSV strings with real-time parsing (future API integration planned)
- **Architecture**: Modular, event-driven design requiring local development server

---

## 3. Core Features Implementation Status

### 3.1 Interactive Drawing Canvas ✅ COMPLETE
**Grid System:**
- 100' x 100' conceptual drawing area (50' x 40' initial view)
- 24 pixels = 1 foot scaling
- 1" grid spacing
- Snap-to-grid functionality

**Drawing Capabilities:**
- ✅ Click-to-place orthogonal lines (90° enforced)
- ✅ Real-time preview with dimensions
- ✅ Auto-closing when clicking near start point
- ✅ Point simplification algorithm
- ✅ Manual dimension input (type numbers while drawing)
- ✅ Backspace to remove last point

**Viewport Controls:**
- ✅ Zoom In/Out buttons
- ✅ Center & Fit Drawing
- ✅ Middle-mouse panning
- ✅ Clear canvas functionality

**Blueprint Mode:** ✅ IMPLEMENTED
- Toggle between simple lines and to-scale component rendering
- Shows actual lumber dimensions (1.5" thick 2x lumber, actual post sizes)
- Hollow outlines for precise technical drawings

### 3.2 Input & Control Panel ✅ COMPLETE
**Deck Specifications:**
- ✅ Deck Height: 1'-12' (feet/inches dropdowns)
- ✅ Footing Type: GH Levellers, Pylex Screw Piles, Helical Piles
- ✅ Joist Spacing: 12" or 16" OC
- ✅ Attachment: House Rim (Ledger), Concrete Foundation, Floating
- ✅ Beam Type: Drop or Flush
- ✅ Post Size: 4x4 or 6x6 selection
- ✅ Picture Frame: None, Single, Double
- ✅ Joist Protection: None, G-Tape, Deck Coating
- ✅ Framing Fasteners: 3" Deck Screws, U2 3-1/8", Paslode 3-1/4"

**Stair Configuration:**
- ✅ Width: 4'-20' (1' increments)
- ✅ Stringer Types: Pylex Steel, LVL Wood, Custom Cut 2x12
- ✅ Landing Types: Existing surface, 16"x16" slabs, Poured concrete

### 3.3 Structural Calculations ✅ COMPLETE
**Advanced Logic:**
- ✅ Joist sizing by span tables (2x6 through 2x12)
- ✅ Height restrictions (no 2x6 for decks ≥24" high)
- ✅ Automatic mid-beam insertion for long spans
- ✅ **Special Rule**: Continuous 2x8s for 18-20ft depth decks with mid-beam requirement
- ✅ Post sizing (4x4 vs 6x6 based on height or user selection)
- ✅ Beam ply calculation (2-ply for 4x4 posts, 3-ply for 6x6)
- ✅ Drop vs Flush beam positioning (1' setback for drop beams)
- ✅ **Cantilever by Joist Size**: 2x6: 0", 2x8: 16", 2x10+: 24"

**Component Generation:**
- ✅ Ledger/Wall Rim/Wall-Side Beam (based on attachment type)
- ✅ Main beams with cantilevers and post placement
- ✅ Joists with picture frame options
- ✅ Rim joists (End Joists, Outer Rim)
- ✅ Mid-span blocking (8' max spacing)
- ✅ Picture frame blocking (ladder-style between joists)
- ✅ Posts with 8' max spacing, 1' end insets
- ✅ Footings matching post locations

### 3.4 Complex Shapes ✅ COMPLETE
**Shape Validation:**
- ✅ 90-degree corner enforcement
- ✅ Self-intersection detection
- ✅ Decomposition feasibility check

**Shape Decomposition:**
- ✅ Automatic polygon decomposition into rectangles
- ✅ Recursive splitting algorithm
- ✅ Support for L-shapes, U-shapes, T-shapes, and complex rectilinear polygons
- ✅ Visual decomposition shading (debug mode)

**Multi-Section Calculations:**
- ✅ Section-by-section structural calculation
- ✅ Beam merging at section boundaries
- ✅ Post/footing deduplication at shared locations
- ✅ Unified structural output

**Multi-Wall Selection:**
- ✅ Multiple parallel wall segments for ledger attachment
- ✅ Parallel wall validation
- ✅ Complex ledger configurations

### 3.5 Diagonal Support ✅ COMPLETE
**Bay Window Configurations:**
- ✅ Diagonal ledger detection and generation
- ✅ Diagonal beam support (45-degree edges)
- ✅ Beam extension to deck boundaries
- ✅ Unified beam outline generation (mirrors rim joist shape)

**Diagonal Edge Handling:**
- ✅ Automatic diagonal edge classification
- ✅ Perpendicular offset calculations for beam placement
- ✅ Post placement along diagonal beams

### 3.6 Stair System ✅ COMPLETE
**Interactive Features:**
- ✅ Click rim joist edges to place stairs
- ✅ Drag stairs along rim joist to reposition
- ✅ Live dimension display during dragging
- ✅ Select/delete stairs (Delete key)

**Calculations:**
- ✅ Rise/run based on deck height (7.5" ideal rise, 10.5" run)
- ✅ Stringer quantity rules:
  - Pylex: Qty = Width (ft)
  - LVL/Custom: Qty = Width (ft) + 1
- ✅ Landing materials:
  - **Slabs**: 1 per 16" of stair width
  - **Concrete**: 4ft depth × stair width, 1 bag per sq ft

### 3.7 Bill of Materials (BOM) ✅ COMPLETE
**Lumber Optimization:**
- ✅ Stock length optimization with waste minimization
- ✅ **20ft Override**: 2x8 joists/rims for 18-20ft decks use 20ft stock
- ✅ Multi-piece cutting optimization
- ✅ Exact match preference, then best fit

**Hardware Calculations:**
- ✅ Ledger/Wall Rim fasteners (GRK 4", Titen HD)
- ✅ Joist hangers (LUS series, size-matched)
- ✅ Beam-post connectors (BCS series)
- ✅ H2.5 ties for joist connections
- ✅ Corner angles (L series)
- ✅ SD connector screws (1.5" and 2.5")
- ✅ Framing fasteners (screws/nails by type)

**Protection & Finishing:**
- ✅ G-Tape by width (2", 4", 6" based on lumber)
- ✅ Deck frame coating
- ✅ End cut sealer and applicator brush

### 3.8 User Interface ✅ COMPLETE
**Layout:**
- ✅ Responsive 2-column design (inputs left, canvas/BOM right)
- ✅ Card-based UI with TUDS brand colors
- ✅ Dynamic legend with component color coding
- ✅ Progress stepper for workflow guidance

**Project Summary:**
- ✅ Key dimensions and areas
- ✅ Structural specifications
- ✅ Detailed stair information
- ✅ Real-time updates

**Print Functionality:** ✅ ENHANCED
- ✅ Optimized print layout with CSS grid
- ✅ Canvas scaling and grid coverage
- ✅ Enhanced dimension/icon sizing for print
- ✅ Summary, layout, and BOM on single page

---

## 4. Data Management

### 4.1 Embedded Data Sources
**Stock Inventory:** 95+ items with system IDs, descriptions, pricing
**Joist Span Tables:** Size/spacing combinations with maximum spans
**Manual Span Rules:** Complex span recommendations with special instructions

### 4.2 Data Processing
- ✅ CSV parsing with quote handling
- ✅ Lumber dimension extraction (size/length)
- ✅ Package quantity detection (boxes, rolls, singles)
- ✅ Price parsing and formatting

---

## 5. Recent Enhancements

### 5.1 Unified Beam Outline Generation (November 2025)
- Beams now mirror the outer rim joist shape, offset inward by cantilever distance
- Cantilever distance determined by joist size (code-compliant values)
- Replaces separate outer beam + diagonal beam calculations
- Cleaner beam layout for complex shapes

### 5.2 Joist Clipping to Polygon Boundary (November 2025)
- Joists automatically clipped to deck polygon boundary
- Supports notched/jogged deck shapes
- Prevents joists from extending outside deck area

### 5.3 Post Size Selection (November 2025)
- User can now select 4x4 or 6x6 posts regardless of deck height
- Beam ply automatically adjusted (2-ply for 4x4, 3-ply for 6x6)

---

## 6. Development Phases & Roadmap

### Phase 1: Foundation ✅ COMPLETE
- ✅ Rectangular deck support
- ✅ Full structural calculations
- ✅ Complete BOM system
- ✅ Interactive stair placement
- ✅ Print optimization
- ✅ Blueprint mode

### Phase 2: Complex Shapes ✅ COMPLETE
- ✅ 90-degree polygon support
- ✅ Multi-wall selection
- ✅ Shape decomposition algorithms
- ✅ Section-based calculations
- ✅ Beam merging logic

### Phase 3: Advanced Geometry ✅ COMPLETE
- ✅ Diagonal ledger support (bay windows)
- ✅ Diagonal beam handling
- ✅ Unified beam outline generation
- ✅ Joist clipping to polygon boundary

### Phase 4: Platform Integration 📋 PLANNED
- 📋 Shopify app development
- 📋 Real-time inventory integration
- 📋 Customer account systems
- 📋 Mobile app versions

### Phase 5: Advanced Features 📋 PLANNED
- 📋 3D visualization integration
- 📋 AR/VR preview capabilities
- 📋 Advanced material libraries
- 📋 PDF export

---

## 7. Technical Specifications

### 7.1 Performance Metrics
- **Canvas Rendering**: 60fps interactive drawing
- **Calculation Speed**: <500ms for complex multi-section structures
- **File Size**: ~600KB total bundle size
- **Browser Support**: Modern browsers (ES6 modules)

### 7.2 Code Quality
- **Modular Architecture**: 12 distinct ES6 modules
- **Version Control**: Cache-busting version parameter (v8)
- **Error Handling**: Comprehensive validation and user feedback
- **Testing**: Manual testing with real-world scenarios

### 7.3 Data Accuracy
- **Real Stock Items**: Based on actual inventory
- **Lumber Standards**: Canadian lumber sizing (actual vs nominal)
- **Code Compliance**: Structural calculations follow building standards
- **Hardware Selection**: Industry-standard connectors and fasteners

---

## 8. Implementation Status Summary

| Feature Category | Status | Completion |
|------------------|--------|------------|
| Drawing Canvas | ✅ Complete | 100% |
| Structural Calculations | ✅ Complete | 100% |
| BOM Generation | ✅ Complete | 100% |
| Stair System | ✅ Complete | 100% |
| UI/UX Visual Consistency | ✅ Complete | 100% |
| Print System | ✅ Complete | 100% |
| Blueprint Mode | ✅ Complete | 100% |
| Complex Shapes | ✅ Complete | 100% |
| Multi-Wall Selection | ✅ Complete | 100% |
| Diagonal Support | ✅ Complete | 100% |
| Save/Load Projects | 📋 Tier 1 | 0% |
| PDF Export | 📋 Tier 1 | 0% |
| Shopify Integration | 📋 Tier 1 | 0% |
| Decking Tab | 📋 Tier 2 | 0% |
| 3D Viewer | 📋 Tier 2 | 0% |
| Mobile Optimization | 📋 Tier 4 | 0% |

**Overall Project Completion: 95% (Core + Advanced Functionality Complete)**

---

## 9. Feature Roadmap

See **FEATURE_ROADMAP.md** for the complete prioritized feature list organized into tiers:

- **Tier 1: Sales Acceleration** - Save/Load, PDF Export, Shopify Integration, Quote Sharing
- **Tier 2: Design Enhancement** - Decking Tab, Photo Overlay, 3D Viewer, Component Library
- **Tier 3: Professional Tools** - Code Compliance, Permit Docs, Measurement Tool
- **Tier 4: Platform & Mobile** - Mobile Optimization, User Accounts, Collaboration
- **Tier 5: Future Innovation** - AR Visualization, AI Suggestions

---

## 10. Conclusion

The Deck Calculator has achieved full implementation of its core vision, including advanced features like complex polygon shapes and diagonal bay window support. The application is production-ready and provides professional-grade deck planning capabilities that exceed most competitors in the market.

**Next Priority**: Tier 1 features (Save/Load, PDF Export, Shopify Integration) to accelerate the sales process.
