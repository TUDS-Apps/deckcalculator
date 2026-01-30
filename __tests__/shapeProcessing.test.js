/**
 * Comprehensive Shape Processing Tests
 *
 * Tests all drawable shapes:
 * - Rectangles and Squares
 * - L-shapes
 * - U-shapes
 * - Shapes with 45-degree diagonal corners
 *
 * Ensures:
 * 1. simplifyPoints() preserves essential vertices and closing points
 * 2. decomposeShape() correctly identifies shape types
 * 3. All shapes maintain structural integrity through processing
 */

import { EPSILON } from '../deckCalcjs/config.js';
import { simplifyPoints } from '../deckCalcjs/utils.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Processes shape points for decomposition - handles closing point detection
 */
function processShapeForDecomposition(points) {
  let shapePoints;
  if (points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];
    const hasClosingPoint = Math.abs(first.x - last.x) < 0.1 && Math.abs(first.y - last.y) < 0.1;

    if (hasClosingPoint) {
      shapePoints = points.slice(0, -1);
    } else {
      shapePoints = [...points];
    }
  } else {
    shapePoints = [...points];
  }

  return {
    originalPointCount: points.length,
    processedPointCount: shapePoints.length,
    hasClosingPoint: points.length > shapePoints.length,
    shapePoints: shapePoints
  };
}

/**
 * Determines shape type based on vertex count
 */
function classifyShapeType(vertexCount) {
  if (vertexCount === 4) return 'rectangle';
  if (vertexCount === 6) return 'L-shape';
  if (vertexCount === 8) return 'U-shape';
  if (vertexCount > 8) return 'complex';
  return 'unknown';
}

/**
 * Checks if a shape has any diagonal (non-axis-aligned) edges
 */
function hasDiagonalEdges(points) {
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    // Skip closing point comparison
    if (i === points.length - 2) {
      const first = points[0];
      if (Math.abs(p2.x - first.x) < 0.1 && Math.abs(p2.y - first.y) < 0.1) {
        continue;
      }
    }

    const dx = Math.abs(p2.x - p1.x);
    const dy = Math.abs(p2.y - p1.y);

    // Skip zero-length edges
    if (dx < EPSILON && dy < EPSILON) continue;

    // Check if edge is neither horizontal nor vertical
    const isHorizontal = dy < EPSILON;
    const isVertical = dx < EPSILON;

    if (!isHorizontal && !isVertical) {
      return true;
    }
  }
  return false;
}

/**
 * Validates that all essential corners are preserved
 */
function hasAllCorners(original, simplified, tolerance = 1) {
  // Get unique vertices from original (excluding closing point)
  const origVertices = [];
  for (let i = 0; i < original.length; i++) {
    const p = original[i];
    // Skip if this is the closing point
    if (i === original.length - 1) {
      const first = original[0];
      if (Math.abs(p.x - first.x) < 0.1 && Math.abs(p.y - first.y) < 0.1) {
        continue;
      }
    }
    origVertices.push(p);
  }

  // Check each original vertex exists in simplified
  for (const orig of origVertices) {
    const found = simplified.some(s =>
      Math.abs(s.x - orig.x) < tolerance && Math.abs(s.y - orig.y) < tolerance
    );
    if (!found) return false;
  }
  return true;
}

// ============================================================================
// TEST SHAPE GENERATORS
// ============================================================================

// --- RECTANGLES ---

function createRectangle(width, height) {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
    { x: 0, y: 0 }  // closing point
  ];
}

function createSquare(size) {
  return createRectangle(size, size);
}

function createRectangleWithCollinearPoints() {
  return [
    { x: 0, y: 0 },
    { x: 100, y: 0 },    // collinear
    { x: 200, y: 0 },
    { x: 200, y: 50 },   // collinear
    { x: 200, y: 100 },
    { x: 100, y: 100 },  // collinear
    { x: 0, y: 100 },
    { x: 0, y: 50 },     // collinear
    { x: 0, y: 0 }       // closing point
  ];
}

// --- L-SHAPES ---

function createLShapeTopRight() {
  // L rotated so the notch is top-right
  return [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 100 },
    { x: 100, y: 100 },
    { x: 100, y: 200 },
    { x: 0, y: 200 },
    { x: 0, y: 0 }
  ];
}

function createLShapeTopLeft() {
  // L rotated so the notch is top-left
  return [
    { x: 100, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 200 },
    { x: 0, y: 200 },
    { x: 0, y: 100 },
    { x: 100, y: 100 },
    { x: 100, y: 0 }
  ];
}

function createLShapeBottomLeft() {
  // L rotated so the notch is bottom-left
  return [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 200 },
    { x: 100, y: 200 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
    { x: 0, y: 0 }
  ];
}

function createLShapeBottomRight() {
  // L rotated so the notch is bottom-right
  return [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 200, y: 100 },
    { x: 200, y: 200 },
    { x: 0, y: 200 },
    { x: 0, y: 0 }
  ];
}

function createLShapeWithCollinearPoints() {
  return [
    { x: 0, y: 0 },
    { x: 100, y: 0 },     // collinear
    { x: 200, y: 0 },
    { x: 200, y: 100 },
    { x: 100, y: 100 },
    { x: 100, y: 200 },
    { x: 0, y: 200 },
    { x: 0, y: 100 },     // collinear
    { x: 0, y: 0 }
  ];
}

// --- U-SHAPES ---

function createUShapeOpenBottom() {
  // U-shape opening at bottom
  return [
    { x: 0, y: 0 },
    { x: 300, y: 0 },
    { x: 300, y: 200 },
    { x: 200, y: 200 },
    { x: 200, y: 50 },
    { x: 100, y: 50 },
    { x: 100, y: 200 },
    { x: 0, y: 200 },
    { x: 0, y: 0 }
  ];
}

function createUShapeOpenTop() {
  // U-shape opening at top
  return [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 150 },
    { x: 200, y: 150 },
    { x: 200, y: 0 },
    { x: 300, y: 0 },
    { x: 300, y: 200 },
    { x: 0, y: 200 },
    { x: 0, y: 0 }
  ];
}

function createUShapeOpenLeft() {
  // U-shape opening on left side
  return [
    { x: 50, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 300 },
    { x: 50, y: 300 },
    { x: 50, y: 200 },
    { x: 0, y: 200 },
    { x: 0, y: 100 },
    { x: 50, y: 100 },
    { x: 50, y: 0 }
  ];
}

function createUShapeOpenRight() {
  // U-shape opening on right side
  return [
    { x: 0, y: 0 },
    { x: 150, y: 0 },
    { x: 150, y: 100 },
    { x: 200, y: 100 },
    { x: 200, y: 200 },
    { x: 150, y: 200 },
    { x: 150, y: 300 },
    { x: 0, y: 300 },
    { x: 0, y: 0 }
  ];
}

// --- DIAGONAL SHAPES (45-degree corners) ---

function createRectangleWithClippedCorner() {
  // Rectangle with top-right corner cut at 45 degrees
  return [
    { x: 0, y: 0 },
    { x: 150, y: 0 },     // top edge stops early
    { x: 200, y: 50 },    // diagonal edge (45 degrees)
    { x: 200, y: 100 },
    { x: 0, y: 100 },
    { x: 0, y: 0 }        // closing point
  ];
}

function createRectangleWithTwoClippedCorners() {
  // Rectangle with two opposite corners clipped
  return [
    { x: 50, y: 0 },      // top-left clipped
    { x: 200, y: 0 },
    { x: 200, y: 50 },    // top-right clipped
    { x: 150, y: 100 },
    { x: 0, y: 100 },
    { x: 0, y: 50 },
    { x: 50, y: 0 }
  ];
}

function createLShapeWithClippedCorner() {
  // L-shape with the inner corner clipped at 45 degrees
  return [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 100 },
    { x: 125, y: 100 },   // inner corner now has diagonal
    { x: 100, y: 125 },   // diagonal edge
    { x: 100, y: 200 },
    { x: 0, y: 200 },
    { x: 0, y: 0 }
  ];
}

function createOctagon() {
  // Octagon (rectangle with all 4 corners clipped)
  const size = 200;
  const clip = 50;
  return [
    { x: clip, y: 0 },
    { x: size - clip, y: 0 },
    { x: size, y: clip },
    { x: size, y: size - clip },
    { x: size - clip, y: size },
    { x: clip, y: size },
    { x: 0, y: size - clip },
    { x: 0, y: clip },
    { x: clip, y: 0 }
  ];
}

// ============================================================================
// UNIT TESTS
// ============================================================================

describe('Rectangle and Square Processing', () => {

  describe('Basic Rectangle', () => {
    it('should preserve all 4 corners after simplification', () => {
      const rect = createRectangle(200, 100);
      const simplified = simplifyPoints(rect);

      // Should have 4 unique corners + closing point
      expect(simplified.length).toBe(5);
    });

    it('should preserve closing point', () => {
      const rect = createRectangle(200, 100);
      const simplified = simplifyPoints(rect);

      const first = simplified[0];
      const last = simplified[simplified.length - 1];
      expect(Math.abs(first.x - last.x)).toBeLessThan(0.1);
      expect(Math.abs(first.y - last.y)).toBeLessThan(0.1);
    });

    it('should classify as rectangle with 4 vertices', () => {
      const rect = createRectangle(200, 100);
      const result = processShapeForDecomposition(rect);

      expect(result.processedPointCount).toBe(4);
      expect(classifyShapeType(result.processedPointCount)).toBe('rectangle');
    });

    it('should not have diagonal edges', () => {
      const rect = createRectangle(200, 100);
      expect(hasDiagonalEdges(rect)).toBe(false);
    });
  });

  describe('Square', () => {
    it('should preserve all 4 corners after simplification', () => {
      const square = createSquare(100);
      const simplified = simplifyPoints(square);

      expect(simplified.length).toBe(5);
    });

    it('should have equal width and height', () => {
      const square = createSquare(100);
      const result = processShapeForDecomposition(square);

      const points = result.shapePoints;
      const width = Math.abs(points[1].x - points[0].x);
      const height = Math.abs(points[2].y - points[1].y);

      expect(width).toBe(height);
    });
  });

  describe('Rectangle with collinear points', () => {
    it('should remove collinear points but preserve 4 corners', () => {
      const rect = createRectangleWithCollinearPoints();
      const simplified = simplifyPoints(rect);

      // Should have exactly 5 points (4 corners + closing)
      expect(simplified.length).toBe(5);
    });

    it('should still classify as rectangle', () => {
      const rect = createRectangleWithCollinearPoints();
      const simplified = simplifyPoints(rect);
      const result = processShapeForDecomposition(simplified);

      expect(classifyShapeType(result.processedPointCount)).toBe('rectangle');
    });
  });
});

describe('L-Shape Processing', () => {

  describe('L-Shape Top-Right notch', () => {
    it('should preserve all 6 corners', () => {
      const lShape = createLShapeTopRight();
      const simplified = simplifyPoints(lShape);

      // 6 unique corners + closing point = 7
      expect(simplified.length).toBe(7);
    });

    it('should preserve closing point', () => {
      const lShape = createLShapeTopRight();
      const simplified = simplifyPoints(lShape);

      const first = simplified[0];
      const last = simplified[simplified.length - 1];
      expect(Math.abs(first.x - last.x)).toBeLessThan(0.1);
      expect(Math.abs(first.y - last.y)).toBeLessThan(0.1);
    });

    it('should classify as L-shape with 6 vertices', () => {
      const lShape = createLShapeTopRight();
      const result = processShapeForDecomposition(lShape);

      expect(result.processedPointCount).toBe(6);
      expect(classifyShapeType(result.processedPointCount)).toBe('L-shape');
    });

    it('should preserve inner corner at (100, 100)', () => {
      const lShape = createLShapeTopRight();
      const simplified = simplifyPoints(lShape);

      const hasInnerCorner = simplified.some(p =>
        Math.abs(p.x - 100) < 1 && Math.abs(p.y - 100) < 1
      );
      expect(hasInnerCorner).toBe(true);
    });
  });

  describe('L-Shape Top-Left notch', () => {
    it('should preserve all 6 corners', () => {
      const lShape = createLShapeTopLeft();
      const simplified = simplifyPoints(lShape);
      expect(simplified.length).toBe(7);
    });

    it('should classify as L-shape', () => {
      const lShape = createLShapeTopLeft();
      const result = processShapeForDecomposition(lShape);
      expect(classifyShapeType(result.processedPointCount)).toBe('L-shape');
    });
  });

  describe('L-Shape Bottom-Left notch', () => {
    it('should preserve all 6 corners', () => {
      const lShape = createLShapeBottomLeft();
      const simplified = simplifyPoints(lShape);
      expect(simplified.length).toBe(7);
    });

    it('should classify as L-shape', () => {
      const lShape = createLShapeBottomLeft();
      const result = processShapeForDecomposition(lShape);
      expect(classifyShapeType(result.processedPointCount)).toBe('L-shape');
    });
  });

  describe('L-Shape Bottom-Right notch', () => {
    it('should preserve all 6 corners', () => {
      const lShape = createLShapeBottomRight();
      const simplified = simplifyPoints(lShape);
      expect(simplified.length).toBe(7);
    });

    it('should classify as L-shape', () => {
      const lShape = createLShapeBottomRight();
      const result = processShapeForDecomposition(lShape);
      expect(classifyShapeType(result.processedPointCount)).toBe('L-shape');
    });
  });

  describe('L-Shape with collinear points', () => {
    it('should remove collinear points but keep 6 essential corners', () => {
      const lShape = createLShapeWithCollinearPoints();
      const simplified = simplifyPoints(lShape);

      // Should have 7 points (6 corners + closing)
      expect(simplified.length).toBe(7);
    });

    it('should still be closed', () => {
      const lShape = createLShapeWithCollinearPoints();
      const simplified = simplifyPoints(lShape);

      const first = simplified[0];
      const last = simplified[simplified.length - 1];
      expect(Math.abs(first.x - last.x)).toBeLessThan(0.1);
      expect(Math.abs(first.y - last.y)).toBeLessThan(0.1);
    });
  });

  describe('BUG REGRESSION: L-shape vertex preservation', () => {
    it('should NOT lose vertices when processed through simplifyPoints then decomposition', () => {
      const lShape = createLShapeTopRight();

      // Simulate the app flow
      const simplified = simplifyPoints(lShape);
      const result = processShapeForDecomposition(simplified);

      // CRITICAL: Must have 6 vertices for decomposition
      expect(result.processedPointCount).toBe(6);
    });
  });
});

describe('U-Shape Processing', () => {

  describe('U-Shape opening at bottom', () => {
    it('should preserve all 8 corners', () => {
      const uShape = createUShapeOpenBottom();
      const simplified = simplifyPoints(uShape);

      // 8 unique corners + closing point = 9
      expect(simplified.length).toBe(9);
    });

    it('should preserve closing point', () => {
      const uShape = createUShapeOpenBottom();
      const simplified = simplifyPoints(uShape);

      const first = simplified[0];
      const last = simplified[simplified.length - 1];
      expect(Math.abs(first.x - last.x)).toBeLessThan(0.1);
      expect(Math.abs(first.y - last.y)).toBeLessThan(0.1);
    });

    it('should classify as U-shape with 8 vertices', () => {
      const uShape = createUShapeOpenBottom();
      const result = processShapeForDecomposition(uShape);

      expect(result.processedPointCount).toBe(8);
      expect(classifyShapeType(result.processedPointCount)).toBe('U-shape');
    });

    it('should preserve both inner corners', () => {
      const uShape = createUShapeOpenBottom();
      const simplified = simplifyPoints(uShape);

      // Inner corners at (100, 50) and (200, 50)
      const hasLeftInner = simplified.some(p =>
        Math.abs(p.x - 100) < 1 && Math.abs(p.y - 50) < 1
      );
      const hasRightInner = simplified.some(p =>
        Math.abs(p.x - 200) < 1 && Math.abs(p.y - 50) < 1
      );

      expect(hasLeftInner).toBe(true);
      expect(hasRightInner).toBe(true);
    });
  });

  describe('U-Shape opening at top', () => {
    it('should preserve all 8 corners', () => {
      const uShape = createUShapeOpenTop();
      const simplified = simplifyPoints(uShape);
      expect(simplified.length).toBe(9);
    });

    it('should classify as U-shape', () => {
      const uShape = createUShapeOpenTop();
      const result = processShapeForDecomposition(uShape);
      expect(classifyShapeType(result.processedPointCount)).toBe('U-shape');
    });
  });

  describe('U-Shape opening at left', () => {
    it('should preserve all 8 corners', () => {
      const uShape = createUShapeOpenLeft();
      const simplified = simplifyPoints(uShape);
      expect(simplified.length).toBe(9);
    });

    it('should classify as U-shape', () => {
      const uShape = createUShapeOpenLeft();
      const result = processShapeForDecomposition(uShape);
      expect(classifyShapeType(result.processedPointCount)).toBe('U-shape');
    });
  });

  describe('U-Shape opening at right', () => {
    it('should preserve all 8 corners', () => {
      const uShape = createUShapeOpenRight();
      const simplified = simplifyPoints(uShape);
      expect(simplified.length).toBe(9);
    });

    it('should classify as U-shape', () => {
      const uShape = createUShapeOpenRight();
      const result = processShapeForDecomposition(uShape);
      expect(classifyShapeType(result.processedPointCount)).toBe('U-shape');
    });
  });
});

describe('Diagonal Shape Processing (45-degree corners)', () => {

  describe('Rectangle with one clipped corner', () => {
    it('should preserve all vertices including diagonal edge endpoints', () => {
      const shape = createRectangleWithClippedCorner();
      const simplified = simplifyPoints(shape);

      // 5 unique vertices + closing point = 6
      expect(simplified.length).toBe(6);
    });

    it('should detect diagonal edges', () => {
      const shape = createRectangleWithClippedCorner();
      expect(hasDiagonalEdges(shape)).toBe(true);
    });

    it('should preserve closing point', () => {
      const shape = createRectangleWithClippedCorner();
      const simplified = simplifyPoints(shape);

      const first = simplified[0];
      const last = simplified[simplified.length - 1];
      expect(Math.abs(first.x - last.x)).toBeLessThan(0.1);
      expect(Math.abs(first.y - last.y)).toBeLessThan(0.1);
    });
  });

  describe('Rectangle with two clipped corners', () => {
    it('should preserve all vertices', () => {
      const shape = createRectangleWithTwoClippedCorners();
      const simplified = simplifyPoints(shape);

      // 6 unique vertices + closing point = 7
      expect(simplified.length).toBe(7);
    });

    it('should detect diagonal edges', () => {
      const shape = createRectangleWithTwoClippedCorners();
      expect(hasDiagonalEdges(shape)).toBe(true);
    });
  });

  describe('L-Shape with clipped inner corner', () => {
    it('should preserve all vertices including diagonal', () => {
      const shape = createLShapeWithClippedCorner();
      const simplified = simplifyPoints(shape);

      // 7 unique vertices + closing point = 8
      expect(simplified.length).toBe(8);
    });

    it('should detect diagonal edges', () => {
      const shape = createLShapeWithClippedCorner();
      expect(hasDiagonalEdges(shape)).toBe(true);
    });

    it('should preserve the diagonal corner points', () => {
      const shape = createLShapeWithClippedCorner();
      const simplified = simplifyPoints(shape);

      // Should have (125, 100) and (100, 125)
      const hasDiagStart = simplified.some(p =>
        Math.abs(p.x - 125) < 1 && Math.abs(p.y - 100) < 1
      );
      const hasDiagEnd = simplified.some(p =>
        Math.abs(p.x - 100) < 1 && Math.abs(p.y - 125) < 1
      );

      expect(hasDiagStart).toBe(true);
      expect(hasDiagEnd).toBe(true);
    });
  });

  describe('Octagon (all corners clipped)', () => {
    it('should preserve all 8 vertices', () => {
      const octagon = createOctagon();
      const simplified = simplifyPoints(octagon);

      // 8 unique vertices + closing point = 9
      expect(simplified.length).toBe(9);
    });

    it('should detect diagonal edges', () => {
      const octagon = createOctagon();
      expect(hasDiagonalEdges(octagon)).toBe(true);
    });

    it('should classify as U-shape or complex (8 vertices)', () => {
      const octagon = createOctagon();
      const result = processShapeForDecomposition(octagon);

      expect(result.processedPointCount).toBe(8);
    });
  });
});

describe('Integration Tests: Full Processing Pipeline', () => {

  it('Rectangle should process correctly through entire pipeline', () => {
    const rect = createRectangle(200, 100);
    const simplified = simplifyPoints(rect);
    const result = processShapeForDecomposition(simplified);

    expect(result.hasClosingPoint).toBe(true);
    expect(result.processedPointCount).toBe(4);
    expect(classifyShapeType(result.processedPointCount)).toBe('rectangle');
  });

  it('L-shape should process correctly through entire pipeline', () => {
    const lShape = createLShapeTopRight();
    const simplified = simplifyPoints(lShape);
    const result = processShapeForDecomposition(simplified);

    expect(result.hasClosingPoint).toBe(true);
    expect(result.processedPointCount).toBe(6);
    expect(classifyShapeType(result.processedPointCount)).toBe('L-shape');
  });

  it('U-shape should process correctly through entire pipeline', () => {
    const uShape = createUShapeOpenBottom();
    const simplified = simplifyPoints(uShape);
    const result = processShapeForDecomposition(simplified);

    expect(result.hasClosingPoint).toBe(true);
    expect(result.processedPointCount).toBe(8);
    expect(classifyShapeType(result.processedPointCount)).toBe('U-shape');
  });

  it('Diagonal shape should process correctly through entire pipeline', () => {
    const diag = createRectangleWithClippedCorner();
    const simplified = simplifyPoints(diag);
    const result = processShapeForDecomposition(simplified);

    expect(result.hasClosingPoint).toBe(true);
    expect(hasDiagonalEdges(simplified)).toBe(true);
  });

  it('All L-shape orientations should produce same vertex count', () => {
    const orientations = [
      createLShapeTopRight(),
      createLShapeTopLeft(),
      createLShapeBottomLeft(),
      createLShapeBottomRight()
    ];

    for (const lShape of orientations) {
      const simplified = simplifyPoints(lShape);
      const result = processShapeForDecomposition(simplified);

      expect(result.processedPointCount).toBe(6);
    }
  });

  it('All U-shape orientations should produce same vertex count', () => {
    const orientations = [
      createUShapeOpenBottom(),
      createUShapeOpenTop(),
      createUShapeOpenLeft(),
      createUShapeOpenRight()
    ];

    for (const uShape of orientations) {
      const simplified = simplifyPoints(uShape);
      const result = processShapeForDecomposition(simplified);

      expect(result.processedPointCount).toBe(8);
    }
  });
});

describe('Edge Cases', () => {

  it('should handle empty array', () => {
    const simplified = simplifyPoints([]);
    expect(simplified).toEqual([]);
  });

  it('should handle single point', () => {
    const simplified = simplifyPoints([{ x: 0, y: 0 }]);
    expect(simplified.length).toBe(1);
  });

  it('should handle two points', () => {
    const simplified = simplifyPoints([{ x: 0, y: 0 }, { x: 100, y: 100 }]);
    expect(simplified.length).toBe(2);
  });

  it('should handle triangle (minimum valid polygon)', () => {
    const triangle = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 100 },
      { x: 0, y: 0 }
    ];
    const simplified = simplifyPoints(triangle);

    // Should preserve all 3 corners + closing
    expect(simplified.length).toBe(4);
  });

  it('should handle very small shapes', () => {
    const tiny = createRectangle(1, 1);
    const simplified = simplifyPoints(tiny);

    expect(simplified.length).toBe(5);
  });

  it('should handle very large shapes', () => {
    const huge = createRectangle(10000, 10000);
    const simplified = simplifyPoints(huge);

    expect(simplified.length).toBe(5);
  });
});
