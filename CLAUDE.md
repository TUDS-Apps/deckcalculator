# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Running the Application
The Deck Calculator is a static web application that requires a local development server due to ES6 module usage:

```bash
# Start local development server (Python 3)
python3 -m http.server 8000

# Alternative with Python 2
python -m SimpleHTTPServer 8000

# Alternative with Node.js http-server
npx http-server -p 8000

# Then navigate to
http://localhost:8000
```

### Testing
No automated test suite exists. Testing is done manually through the test HTML files:
- `test_beam_merging.html` - Beam merging functionality
- `test_contextual_panels.html` - UI panel transitions
- `test_decomposition.html` - Shape decomposition testing
- `test_grid_boundary_fix.html` - Grid boundary calculations
- `test_post_size_override.html` - Post sizing logic
- `test_progress_stepper.html` - Progress stepper UI
- `test_stair_orientation.html` - Stair placement logic

### Code Quality
No linting or type checking is currently configured. The project uses vanilla JavaScript without a build process.

## Architecture Overview

The Deck Calculator is a modular JavaScript application using ES6 modules with a clear separation of concerns:

### Core Architecture Pattern
- **Event-Driven**: Canvas interactions and UI events drive the application flow
- **Centralized State**: All application state is managed in `appState` object in app.js
- **Modular Design**: Each module has specific responsibilities with minimal coupling

### Module Dependency Hierarchy
```
app.js (Main Orchestrator)
  ├── config.js (Constants and Configuration)
  ├── dataManager.js (CSV Data Management)
  ├── uiController.js (DOM Manipulation)
  ├── canvasLogic.js (Canvas Rendering)
  ├── deckCalculations.js (Structural Calculations)
  ├── bomCalculations.js (Bill of Materials)
  ├── stairCalculations.js (Stair Calculations)
  ├── shapeValidator.js (Shape Validation)
  ├── shapeDecomposer.js (Complex Shape Handling)
  ├── multiSectionCalculations.js (Multi-Section Support)
  └── utils.js (Utility Functions)
```

### Key State Management
The `appState` object in app.js contains:
- **Drawing State**: points, isDrawing, isShapeClosed
- **Selection State**: selectedWallIndices, selectedStairIndex
- **Interaction Modes**: wallSelectionMode, stairPlacementMode, isPanning
- **Viewport State**: scale, offset (for pan/zoom)
- **Structural Data**: structuralComponents, deckDimensions, bomData
- **UI State**: currentPanelMode, blueprintMode

### Coordinate Systems
The application uses two coordinate spaces:
- **Model Space**: Real-world measurements (1 unit = 1 inch)
- **View Space**: Canvas pixels with scaling and panning
- Transformation functions in canvasLogic.js handle conversions

### Workflow Stages
1. **Drawing**: User draws deck outline with orthogonal lines
2. **Wall Selection**: User selects wall(s) for ledger attachment
3. **Plan Generation**: Structural calculations create framing plan
4. **Stair Placement**: Interactive stair positioning on rim joists
5. **BOM Review**: Material list generation and optimization

### Important Implementation Details

**Grid System**:
- 1-foot grid (12 inches) for visual reference
- Snap-to-grid at 1-inch increments
- 24 pixels = 1 foot base scaling

**Structural Calculations**:
- Joist span tables embedded in dataManager.js
- Beam placement with 8' max post spacing
- Special rules for 18-20ft decks (continuous 2x8s with mid-beam)
- Height-based post sizing (4x4 vs 6x6)

**BOM Optimization**:
- Stock length optimization to minimize waste
- Multi-piece cutting calculations
- Hardware selection based on lumber dimensions
- Package quantity handling (boxes, rolls, etc.)

**Canvas Rendering**:
- Double buffering not used (direct canvas drawing)
- Blueprint mode for technical drawings
- Print optimization with enhanced scaling
- Responsive canvas sizing with ResizeObserver

### Data Management
- Stock inventory embedded as CSV strings in dataManager.js
- No external API calls or database connections
- All calculations performed client-side
- No user data persistence

### Common Development Tasks

**Adding New Structural Components**:
1. Define component type in config.js
2. Add calculation logic in deckCalculations.js
3. Add rendering logic in canvasLogic.js
4. Update BOM calculations in bomCalculations.js

**Modifying UI Panels**:
1. Update HTML structure in index.html
2. Add event handlers in app.js
3. Update panel transitions in updateContextualPanel()
4. Style with Tailwind classes or deckcalculatorstyles.css

**Debugging Canvas Interactions**:
- Check coordinate transformations (model vs view space)
- Verify grid snapping logic
- Use console logs in redrawCanvas() for render debugging
- Test with different viewport scales and offsets