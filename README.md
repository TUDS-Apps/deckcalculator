# Deck Calculator

A professional web-based deck design and material estimation application. Draw deck outlines interactively, configure specifications, and generate comprehensive structural plans with accurate Bills of Materials (BOM).

## Features

### Drawing & Design
- **Interactive Canvas** - Click-to-place drawing with real-time preview
- **Complex Shapes** - Support for L-shapes, U-shapes, and other 90-degree polygon configurations
- **Manual Dimension Input** - Type exact measurements while drawing
- **Snap-to-Grid** - 1" grid with automatic snapping
- **Viewport Controls** - Zoom, pan, and center/fit functions
- **Blueprint Mode** - Toggle between simple lines and to-scale lumber rendering

### Structural Calculations
- **Automatic Joist Sizing** - Based on span tables (2x6 through 2x12)
- **Multi-Section Support** - Decomposed shapes calculated section-by-section with merged beams
- **Beam Placement** - Drop or flush beams with proper cantilever calculations
- **Cantilever by Joist Size** - 2x6: 0", 2x8: 16", 2x10+: 24"
- **Diagonal Support** - Bay window configurations with diagonal ledgers and beams
- **Post & Footing Calculation** - Automatic sizing and placement

### Stair System
- **Interactive Placement** - Click rim joists to place stairs
- **Drag Repositioning** - Move stairs along edges
- **Multiple Stringer Types** - Pylex Steel, LVL Wood, Custom Cut 2x12
- **Landing Calculations** - Slabs or poured concrete

### Bill of Materials
- **Stock Optimization** - Minimizes waste with smart cutting
- **Real Inventory** - Based on actual stocked items
- **Hardware Included** - Hangers, fasteners, connectors
- **Protection Materials** - G-Tape, deck coating options

## Technical Stack

- **Frontend**: HTML5, Tailwind CSS, Vanilla JavaScript (ES6 modules)
- **Canvas**: HTML5 Canvas API for 2D rendering
- **Architecture**: 12 modular ES6 modules

## Project Structure

```
deckCalcjs/
├── app.js                    - Main application orchestrator
├── config.js                 - Constants and configuration
├── utils.js                  - Geometry and utility functions
├── dataManager.js            - Stock data and span tables
├── uiController.js           - DOM manipulation and forms
├── canvasLogic.js            - Canvas rendering
├── deckCalculations.js       - Core structural calculations
├── stairCalculations.js      - Stair geometry and materials
├── bomCalculations.js        - Material optimization
├── shapeValidator.js         - Shape validation (90° corners)
├── shapeDecomposer.js        - Polygon decomposition
└── multiSectionCalculations.js - Multi-section beam merging
```

## Usage

1. Open `index.html` in a browser (requires local server for ES6 modules)
2. Draw your deck outline on the canvas
3. Select the wall(s) for ledger attachment
4. Configure deck specifications in the left panel
5. Generate plan to see structural layout and BOM

## Development

Requires a local development server due to ES6 module imports:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve
```

## License

Proprietary - TUDS Lumber
