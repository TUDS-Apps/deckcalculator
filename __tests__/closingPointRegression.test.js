/**
 * Regression Tests for Closing Point Preservation
 *
 * These tests ensure that:
 * 1. simplifyPoints() preserves closing points when the original shape was closed
 * 2. decomposeShape() correctly handles shapes with and without closing points
 *
 * Bug fixed: L-shapes were losing a vertex because simplifyPoints removed the
 * closing point, then decomposeShape did slice(0,-1) assuming it existed.
 */

const EPSILON = 0.01;

// ============================================================================
// FUNCTION IMPLEMENTATIONS (copied from source files for testing)
// ============================================================================

/**
 * Simplifies a polygon outline by removing collinear points.
 * CRITICAL: Must preserve closing point if original shape was closed.
 */
function simplifyPoints(pointArray) {
  if (!pointArray || pointArray.length < 3) {
    return [...pointArray];
  }

  const simplified = [pointArray[0]];
  const tolerance = 0.1;

  for (let i = 1; i < pointArray.length - 1; i++) {
    const p1 = simplified[simplified.length - 1];
    const p2 = pointArray[i];
    const p3 = pointArray[i + 1];

    const crossProduct =
      (p2.y - p1.y) * (p3.x - p2.x) - (p2.x - p1.x) * (p3.y - p2.y);

    if (Math.abs(crossProduct) > tolerance) {
      if (p2.x !== p1.x || p2.y !== p1.y) {
        simplified.push(p2);
      }
    }
  }

  const lastOriginalPoint = pointArray[pointArray.length - 1];
  const lastSimplifiedPoint = simplified[simplified.length - 1];
  if (
    lastOriginalPoint.x !== lastSimplifiedPoint.x ||
    lastOriginalPoint.y !== lastSimplifiedPoint.y
  ) {
    simplified.push(lastOriginalPoint);
  }

  if (simplified.length >= 3) {
    const pN_1 = simplified[simplified.length - 2];
    const pN = simplified[simplified.length - 1];
    const p1 = simplified[0];
    let crossProductEnd =
      (pN.y - pN_1.y) * (p1.x - pN.x) - (pN.x - pN_1.x) * (p1.y - pN.y);
    if (Math.abs(crossProductEnd) <= tolerance) {
      simplified.pop();
    }

    if (simplified.length >= 3) {
      const pN_new = simplified[simplified.length - 1];
      const p1_new = simplified[0];
      const p2_new = simplified[1];
      let crossProductStart =
        (p1_new.y - pN_new.y) * (p2_new.x - p1_new.x) -
        (p1_new.x - pN_new.x) * (p2_new.y - p1_new.y);
      if (Math.abs(crossProductStart) <= tolerance) {
        simplified.shift();
      }
    }
  }

  // CRITICAL FIX: Preserve the closing point if the original shape was closed
  if (simplified.length > 1 && pointArray.length > 1) {
    const origFirst = pointArray[0];
    const origLast = pointArray[pointArray.length - 1];
    const wasClosedShape = Math.abs(origLast.x - origFirst.x) < tolerance &&
                           Math.abs(origLast.y - origFirst.y) < tolerance;

    if (wasClosedShape) {
      const simpFirst = simplified[0];
      const simpLast = simplified[simplified.length - 1];
      const isAlreadyClosed = Math.abs(simpLast.x - simpFirst.x) < tolerance &&
                              Math.abs(simpLast.y - simpFirst.y) < tolerance;

      if (!isAlreadyClosed) {
        simplified.push({ ...simplified[0] });
      }
    }
  }

  return simplified;
}

/**
 * Mock decomposeShape that demonstrates proper closing point handling
 */
function decomposeShape(points, ledgerWallIndex) {
  // Check if the shape has a closing point (first and last points are the same)
  let shapePoints;
  if (points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];
    const hasClosingPoint = Math.abs(first.x - last.x) < 0.1 && Math.abs(first.y - last.y) < 0.1;

    if (hasClosingPoint) {
      // Remove closing point for processing
      shapePoints = points.slice(0, -1);
    } else {
      // No closing point - use all points as-is
      shapePoints = [...points];
    }
  } else {
    shapePoints = [...points];
  }

  if (shapePoints.length < 4) {
    throw new Error("Shape must have at least 4 points for decomposition");
  }

  return {
    originalPointCount: points.length,
    processedPointCount: shapePoints.length,
    hasClosingPoint: points.length > shapePoints.length,
    shapePoints: shapePoints
  };
}

// ============================================================================
// TEST SHAPES
// ============================================================================

/**
 * Creates an L-shape with closing point (7 points total)
 * Shape looks like:
 *    ┌────┐
 *    │    │
 *    │  ┌─┘
 *    │  │
 *    └──┘
 */
function createLShapeWithClosingPoint() {
  return [
    { x: 0, y: 0 },       // 0: top-left
    { x: 200, y: 0 },     // 1: top-right of upper section
    { x: 200, y: 100 },   // 2: inner corner top
    { x: 100, y: 100 },   // 3: inner corner bottom
    { x: 100, y: 200 },   // 4: bottom-left of lower section
    { x: 0, y: 200 },     // 5: bottom-left
    { x: 0, y: 0 }        // 6: closing point (same as 0)
  ];
}

/**
 * Creates an L-shape WITHOUT closing point (6 points)
 */
function createLShapeWithoutClosingPoint() {
  return [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 100 },
    { x: 100, y: 100 },
    { x: 100, y: 200 },
    { x: 0, y: 200 }
  ];
}

/**
 * Creates a U-shape with closing point (9 points total)
 */
function createUShapeWithClosingPoint() {
  return [
    { x: 0, y: 0 },
    { x: 300, y: 0 },
    { x: 300, y: 200 },
    { x: 200, y: 200 },
    { x: 200, y: 50 },
    { x: 100, y: 50 },
    { x: 100, y: 200 },
    { x: 0, y: 200 },
    { x: 0, y: 0 }  // closing point
  ];
}

/**
 * Creates a simple rectangle with closing point (5 points)
 */
function createRectangleWithClosingPoint() {
  return [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 100 },
    { x: 0, y: 100 },
    { x: 0, y: 0 }  // closing point
  ];
}

/**
 * Creates an L-shape with collinear points that should be simplified
 * but still preserve the closing point
 */
function createLShapeWithCollinearPoints() {
  return [
    { x: 0, y: 0 },
    { x: 100, y: 0 },     // collinear with next
    { x: 200, y: 0 },
    { x: 200, y: 100 },
    { x: 100, y: 100 },
    { x: 100, y: 200 },
    { x: 0, y: 200 },
    { x: 0, y: 100 },     // collinear with next
    { x: 0, y: 0 }        // closing point
  ];
}

// ============================================================================
// UNIT TESTS
// ============================================================================

describe('simplifyPoints - Closing Point Preservation', () => {

  describe('L-shape with closing point', () => {
    it('should preserve closing point after simplification', () => {
      const lShape = createLShapeWithClosingPoint();
      const simplified = simplifyPoints(lShape);

      const first = simplified[0];
      const last = simplified[simplified.length - 1];

      expect(Math.abs(first.x - last.x)).toBeLessThan(0.1);
      expect(Math.abs(first.y - last.y)).toBeLessThan(0.1);
    });

    it('should maintain at least 6 unique vertices for L-shape', () => {
      const lShape = createLShapeWithClosingPoint();
      const simplified = simplifyPoints(lShape);

      // L-shape needs 6 unique vertices + closing point = 7
      // After simplification, should still have at least 6 unique vertices
      const uniqueVertices = simplified.slice(0, -1);  // Exclude closing point

      expect(uniqueVertices.length).toBeGreaterThanOrEqual(6);
    });

    it('should not remove essential corner vertices', () => {
      const lShape = createLShapeWithClosingPoint();
      const simplified = simplifyPoints(lShape);

      // The inner corner at (100, 100) is essential and must be preserved
      const hasInnerCorner = simplified.some(p =>
        Math.abs(p.x - 100) < 1 && Math.abs(p.y - 100) < 1
      );

      expect(hasInnerCorner).toBe(true);
    });
  });

  describe('L-shape without closing point', () => {
    it('should NOT add closing point if original did not have one', () => {
      const lShape = createLShapeWithoutClosingPoint();
      const simplified = simplifyPoints(lShape);

      const first = simplified[0];
      const last = simplified[simplified.length - 1];

      // Should NOT be closed since original wasn't closed
      const isClosed = Math.abs(first.x - last.x) < 0.1 &&
                       Math.abs(first.y - last.y) < 0.1;

      expect(isClosed).toBe(false);
    });
  });

  describe('L-shape with collinear points', () => {
    it('should remove collinear points but preserve closing point', () => {
      const lShape = createLShapeWithCollinearPoints();
      const simplified = simplifyPoints(lShape);

      // Should be shorter due to collinear point removal
      expect(simplified.length).toBeLessThan(lShape.length);

      // But should still be closed
      const first = simplified[0];
      const last = simplified[simplified.length - 1];

      expect(Math.abs(first.x - last.x)).toBeLessThan(0.1);
      expect(Math.abs(first.y - last.y)).toBeLessThan(0.1);
    });
  });

  describe('U-shape with closing point', () => {
    it('should preserve closing point for U-shape', () => {
      const uShape = createUShapeWithClosingPoint();
      const simplified = simplifyPoints(uShape);

      const first = simplified[0];
      const last = simplified[simplified.length - 1];

      expect(Math.abs(first.x - last.x)).toBeLessThan(0.1);
      expect(Math.abs(first.y - last.y)).toBeLessThan(0.1);
    });

    it('should maintain at least 8 unique vertices for U-shape', () => {
      const uShape = createUShapeWithClosingPoint();
      const simplified = simplifyPoints(uShape);

      // U-shape needs 8 unique vertices + closing point = 9
      const uniqueVertices = simplified.slice(0, -1);

      expect(uniqueVertices.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe('Rectangle with closing point', () => {
    it('should preserve closing point for rectangle', () => {
      const rect = createRectangleWithClosingPoint();
      const simplified = simplifyPoints(rect);

      const first = simplified[0];
      const last = simplified[simplified.length - 1];

      expect(Math.abs(first.x - last.x)).toBeLessThan(0.1);
      expect(Math.abs(first.y - last.y)).toBeLessThan(0.1);
    });
  });
});

describe('decomposeShape - Closing Point Handling', () => {

  describe('L-shape with closing point', () => {
    it('should correctly detect and remove closing point', () => {
      const lShape = createLShapeWithClosingPoint();
      const result = decomposeShape(lShape, 0);

      expect(result.hasClosingPoint).toBe(true);
      expect(result.originalPointCount).toBe(7);  // Including closing point
      expect(result.processedPointCount).toBe(6); // Closing point removed
    });

    it('should have exactly 6 vertices after removing closing point', () => {
      const lShape = createLShapeWithClosingPoint();
      const result = decomposeShape(lShape, 0);

      expect(result.shapePoints.length).toBe(6);
    });
  });

  describe('L-shape without closing point', () => {
    it('should correctly detect NO closing point and keep all vertices', () => {
      const lShape = createLShapeWithoutClosingPoint();
      const result = decomposeShape(lShape, 0);

      expect(result.hasClosingPoint).toBe(false);
      expect(result.originalPointCount).toBe(6);
      expect(result.processedPointCount).toBe(6);  // All vertices kept
    });

    it('should NOT throw error for valid L-shape without closing point', () => {
      const lShape = createLShapeWithoutClosingPoint();

      expect(() => decomposeShape(lShape, 0)).not.toThrow();
    });
  });

  describe('Edge cases', () => {
    it('should throw error for shapes with less than 4 points', () => {
      const triangle = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 100 }
      ];

      expect(() => decomposeShape(triangle, 0)).toThrow("Shape must have at least 4 points");
    });

    it('should handle rectangle with closing point (5 points -> 4 vertices)', () => {
      const rect = createRectangleWithClosingPoint();
      const result = decomposeShape(rect, 0);

      expect(result.hasClosingPoint).toBe(true);
      expect(result.originalPointCount).toBe(5);
      expect(result.processedPointCount).toBe(4);
    });

    it('should handle U-shape with closing point (9 points -> 8 vertices)', () => {
      const uShape = createUShapeWithClosingPoint();
      const result = decomposeShape(uShape, 0);

      expect(result.hasClosingPoint).toBe(true);
      expect(result.originalPointCount).toBe(9);
      expect(result.processedPointCount).toBe(8);
    });
  });
});

describe('Integration: simplifyPoints -> decomposeShape', () => {

  it('should correctly process L-shape through both functions', () => {
    const lShape = createLShapeWithClosingPoint();

    // First simplify
    const simplified = simplifyPoints(lShape);

    // Verify still closed
    const first = simplified[0];
    const last = simplified[simplified.length - 1];
    expect(Math.abs(first.x - last.x)).toBeLessThan(0.1);
    expect(Math.abs(first.y - last.y)).toBeLessThan(0.1);

    // Then decompose
    const result = decomposeShape(simplified, 0);

    // Should have detected closing point
    expect(result.hasClosingPoint).toBe(true);

    // Should have 6 vertices for decomposition
    expect(result.processedPointCount).toBeGreaterThanOrEqual(6);
  });

  it('should correctly process L-shape with collinear points through both functions', () => {
    const lShape = createLShapeWithCollinearPoints();

    // First simplify (removes collinear points)
    const simplified = simplifyPoints(lShape);

    // Verify still closed
    const first = simplified[0];
    const last = simplified[simplified.length - 1];
    expect(Math.abs(first.x - last.x)).toBeLessThan(0.1);
    expect(Math.abs(first.y - last.y)).toBeLessThan(0.1);

    // Then decompose
    const result = decomposeShape(simplified, 0);

    // Should still work correctly
    expect(result.hasClosingPoint).toBe(true);
    expect(result.processedPointCount).toBeGreaterThanOrEqual(4);
  });

  it('BUG REGRESSION: L-shape should not lose vertices when processed', () => {
    // This is the specific bug that was occurring:
    // 1. User draws L-shape with 6 vertices + closing point = 7 points
    // 2. simplifyPoints was removing the closing point (bug)
    // 3. decomposeShape did slice(0,-1) assuming closing point, removing another vertex
    // 4. L-shape ended up with only 5 vertices, breaking decomposition

    const lShapeFromUser = createLShapeWithClosingPoint();

    // Simulate what happens in the app
    const simplified = simplifyPoints(lShapeFromUser);

    // CRITICAL: Should still have 7 points (6 vertices + closing point)
    // NOT 6 points (which would cause the bug)
    const hasClosingPoint = Math.abs(simplified[0].x - simplified[simplified.length - 1].x) < 0.1 &&
                            Math.abs(simplified[0].y - simplified[simplified.length - 1].y) < 0.1;

    expect(hasClosingPoint).toBe(true);

    // When decomposeShape runs, it should get 6 vertices (after removing closing point)
    const result = decomposeShape(simplified, 0);

    // CRITICAL: Must have exactly 6 vertices for L-shape decomposition
    expect(result.processedPointCount).toBe(6);
  });
});
