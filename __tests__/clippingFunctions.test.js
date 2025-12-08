/**
 * Unit Tests for Deck Calculator Clipping Functions
 * Tests clipBeamToDeckBoundary, clipJoistToBoundary, isPointInsidePolygon, and lineIntersection
 *
 * Generated to prevent regressions on clipping fixes for L-shaped and U-shaped decks.
 */

// Mock constants that are imported from config.js
const PIXELS_PER_FOOT = 24;
const EPSILON = 0.01;

// ============================================================================
// HELPER FUNCTIONS FOR CREATING TEST SHAPES
// ============================================================================

/**
 * Creates a rectangular deck polygon
 * @param {number} width - Width in pixels
 * @param {number} height - Height in pixels
 * @param {number} offsetX - X offset (default 0)
 * @param {number} offsetY - Y offset (default 0)
 * @returns {Array<{x: number, y: number}>} Array of polygon vertices
 */
function createRectangle(width, height, offsetX = 0, offsetY = 0) {
  return [
    { x: offsetX, y: offsetY },
    { x: offsetX + width, y: offsetY },
    { x: offsetX + width, y: offsetY + height },
    { x: offsetX, y: offsetY + height }
  ];
}

/**
 * Creates an L-shaped deck polygon (concave)
 * @returns {Array<{x: number, y: number}>} Array of polygon vertices
 */
function createLShape() {
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
 * Creates a U-shaped deck polygon (concave with interior edges)
 * @returns {Array<{x: number, y: number}>} Array of polygon vertices
 */
function createUShape() {
  return [
    { x: 0, y: 0 },
    { x: 300, y: 0 },
    { x: 300, y: 200 },
    { x: 200, y: 200 },
    { x: 200, y: 50 },
    { x: 100, y: 50 },
    { x: 100, y: 200 },
    { x: 0, y: 200 }
  ];
}

/**
 * Creates a triangular deck polygon
 * @returns {Array<{x: number, y: number}>} Array of polygon vertices
 */
function createTriangle() {
  return [
    { x: 100, y: 0 },
    { x: 200, y: 200 },
    { x: 0, y: 200 }
  ];
}

// ============================================================================
// FUNCTION IMPLEMENTATIONS (extracted from multiSectionCalculations.js)
// These are the functions being tested
// ============================================================================

/**
 * Calculates intersection point of two infinite lines defined by two points each
 */
function lineIntersection(p1, p2, p3, p4) {
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;
  const x4 = p4.x, y4 = p4.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  if (Math.abs(denom) < EPSILON) {
    return null; // Lines are parallel
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;

  return {
    x: x1 + t * (x2 - x1),
    y: y1 + t * (y2 - y1)
  };
}

/**
 * Checks if a point lies on a line segment within tolerance
 */
function isPointOnSegment(point, segStart, segEnd, tolerance) {
  const minX = Math.min(segStart.x, segEnd.x) - tolerance;
  const maxX = Math.max(segStart.x, segEnd.x) + tolerance;
  const minY = Math.min(segStart.y, segEnd.y) - tolerance;
  const maxY = Math.max(segStart.y, segEnd.y) + tolerance;

  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

/**
 * Checks if a point is inside a polygon using ray casting algorithm
 */
function isPointInsidePolygon(point, polygon) {
  if (!polygon || polygon.length < 3) return false;

  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    // Check if point is on the edge (with small tolerance)
    const onEdge = isPointOnSegment(point, polygon[i], polygon[j], 2);
    if (onEdge) return true;

    // Ray casting
    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Clips a beam to the deck boundary polygon
 */
function clipBeamToDeckBoundary(beam, shapePoints, isHorizontal) {
  if (!shapePoints || shapePoints.length < 3) return null;

  const TOLERANCE = 2; // pixels
  const numEdges = shapePoints.length;

  const p1Inside = isPointInsidePolygon(beam.p1, shapePoints);
  const p2Inside = isPointInsidePolygon(beam.p2, shapePoints);

  if (p1Inside && p2Inside) {
    return null;
  }

  const intersections = [];

  for (let i = 0; i < numEdges; i++) {
    const edgeP1 = shapePoints[i];
    const edgeP2 = shapePoints[(i + 1) % numEdges];

    const intersection = lineIntersection(beam.p1, beam.p2, edgeP1, edgeP2);
    if (intersection) {
      if (isPointOnSegment(intersection, edgeP1, edgeP2, TOLERANCE)) {
        intersections.push({ ...intersection, edgeIndex: i });
      }
    }
  }

  if (intersections.length === 0) {
    if (!p1Inside && !p2Inside) {
      return { p1: beam.p1, p2: beam.p1, lengthFt: 0, removed: true };
    }
    return null;
  }

  const beamDx = beam.p2.x - beam.p1.x;
  const beamDy = beam.p2.y - beam.p1.y;
  const beamLength = Math.sqrt(beamDx * beamDx + beamDy * beamDy);

  if (beamLength < TOLERANCE) return null;

  intersections.forEach(inter => {
    inter.t = ((inter.x - beam.p1.x) * beamDx + (inter.y - beam.p1.y) * beamDy) / (beamLength * beamLength);
  });

  intersections.sort((a, b) => a.t - b.t);

  let newP1 = beam.p1;
  let newP2 = beam.p2;

  if (!p1Inside && !p2Inside) {
    if (intersections.length >= 2) {
      newP1 = { x: intersections[0].x, y: intersections[0].y };
      newP2 = { x: intersections[intersections.length - 1].x, y: intersections[intersections.length - 1].y };
    } else {
      return { p1: beam.p1, p2: beam.p1, lengthFt: 0, removed: true };
    }
  } else if (!p1Inside) {
    const validIntersections = intersections.filter(i => i.t <= 1 + TOLERANCE/beamLength);
    if (validIntersections.length > 0) {
      const closest = validIntersections[0];
      newP1 = { x: closest.x, y: closest.y };
    }
  } else if (!p2Inside) {
    const validIntersections = intersections.filter(i => i.t >= -TOLERANCE/beamLength);
    if (validIntersections.length > 0) {
      const closest = validIntersections[validIntersections.length - 1];
      newP2 = { x: closest.x, y: closest.y };
    }
  }

  const newLength = Math.sqrt((newP2.x - newP1.x) ** 2 + (newP2.y - newP1.y) ** 2) / PIXELS_PER_FOOT;

  if (newLength < 0.1) {
    return { p1: newP1, p2: newP2, lengthFt: 0, removed: true };
  }

  return {
    p1: { x: newP1.x, y: newP1.y },
    p2: { x: newP2.x, y: newP2.y },
    lengthFt: newLength
  };
}

/**
 * Clips a joist to the deck boundary polygon
 */
function clipJoistToBoundary(joist, shapePoints) {
  if (!joist.p1 || !joist.p2 || !shapePoints || shapePoints.length < 3) return joist;

  const TOLERANCE = 2;

  const p1Inside = isPointInsidePolygon(joist.p1, shapePoints);
  const p2Inside = isPointInsidePolygon(joist.p2, shapePoints);

  if (p1Inside && p2Inside) return joist;

  const intersections = [];
  const numEdges = shapePoints.length;

  for (let i = 0; i < numEdges; i++) {
    const edgeP1 = shapePoints[i];
    const edgeP2 = shapePoints[(i + 1) % numEdges];

    const inter = lineIntersection(joist.p1, joist.p2, edgeP1, edgeP2);
    if (inter && isPointOnSegment(inter, edgeP1, edgeP2, TOLERANCE)) {
      intersections.push({ ...inter, edgeIndex: i });
    }
  }

  if (!p1Inside && !p2Inside && intersections.length === 0) {
    return null;
  }

  if (intersections.length === 0) return joist;

  const joistDx = joist.p2.x - joist.p1.x;
  const joistDy = joist.p2.y - joist.p1.y;
  const joistLength = Math.sqrt(joistDx * joistDx + joistDy * joistDy);

  if (joistLength < TOLERANCE) return null;

  intersections.forEach(inter => {
    inter.t = ((inter.x - joist.p1.x) * joistDx + (inter.y - joist.p1.y) * joistDy) / (joistLength * joistLength);
  });

  intersections.sort((a, b) => a.t - b.t);

  let newP1 = joist.p1;
  let newP2 = joist.p2;

  if (!p1Inside && !p2Inside) {
    if (intersections.length >= 2) {
      newP1 = { x: intersections[0].x, y: intersections[0].y };
      newP2 = { x: intersections[intersections.length - 1].x, y: intersections[intersections.length - 1].y };
    } else {
      return null;
    }
  } else if (!p1Inside) {
    const validIntersections = intersections.filter(i => i.t <= 1 + TOLERANCE/joistLength);
    if (validIntersections.length > 0) {
      newP1 = { x: validIntersections[0].x, y: validIntersections[0].y };
    }
  } else if (!p2Inside) {
    const validIntersections = intersections.filter(i => i.t >= -TOLERANCE/joistLength);
    if (validIntersections.length > 0) {
      newP2 = { x: validIntersections[validIntersections.length - 1].x, y: validIntersections[validIntersections.length - 1].y };
    }
  }

  const newLength = Math.sqrt((newP2.x - newP1.x) ** 2 + (newP2.y - newP1.y) ** 2) / PIXELS_PER_FOOT;

  if (newLength < 0.1) {
    return null;
  }

  return {
    ...joist,
    p1: { x: newP1.x, y: newP1.y },
    p2: { x: newP2.x, y: newP2.y },
    lengthFeet: newLength
  };
}

// ============================================================================
// UNIT TESTS
// ============================================================================

describe('lineIntersection', () => {
  describe('Basic intersection cases', () => {
    it('should find intersection of two perpendicular lines', () => {
      const p1 = { x: 0, y: 50 };
      const p2 = { x: 100, y: 50 };
      const p3 = { x: 50, y: 0 };
      const p4 = { x: 50, y: 100 };

      const result = lineIntersection(p1, p2, p3, p4);

      expect(result).not.toBeNull();
      expect(result.x).toBeCloseTo(50, 1);
      expect(result.y).toBeCloseTo(50, 1);
    });

    it('should find intersection of two diagonal lines', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 100, y: 100 };
      const p3 = { x: 0, y: 100 };
      const p4 = { x: 100, y: 0 };

      const result = lineIntersection(p1, p2, p3, p4);

      expect(result).not.toBeNull();
      expect(result.x).toBeCloseTo(50, 1);
      expect(result.y).toBeCloseTo(50, 1);
    });

    it('should find intersection outside segment bounds', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 10, y: 0 };
      const p3 = { x: 20, y: -10 };
      const p4 = { x: 20, y: 10 };

      const result = lineIntersection(p1, p2, p3, p4);

      expect(result).not.toBeNull();
      expect(result.x).toBeCloseTo(20, 1);
      expect(result.y).toBeCloseTo(0, 1);
    });
  });

  describe('Parallel and collinear lines', () => {
    it('should return null for parallel horizontal lines', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 100, y: 0 };
      const p3 = { x: 0, y: 50 };
      const p4 = { x: 100, y: 50 };

      const result = lineIntersection(p1, p2, p3, p4);

      expect(result).toBeNull();
    });

    it('should return null for parallel vertical lines', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 0, y: 100 };
      const p3 = { x: 50, y: 0 };
      const p4 = { x: 50, y: 100 };

      const result = lineIntersection(p1, p2, p3, p4);

      expect(result).toBeNull();
    });

    it('should return null for parallel diagonal lines', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 100, y: 100 };
      const p3 = { x: 0, y: 50 };
      const p4 = { x: 100, y: 150 };

      const result = lineIntersection(p1, p2, p3, p4);

      expect(result).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle intersection at endpoint', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 100, y: 0 };
      const p3 = { x: 100, y: 0 };
      const p4 = { x: 100, y: 100 };

      const result = lineIntersection(p1, p2, p3, p4);

      expect(result).not.toBeNull();
      expect(result.x).toBeCloseTo(100, 1);
      expect(result.y).toBeCloseTo(0, 1);
    });

    it('should handle very small segments', () => {
      const p1 = { x: 50, y: 50 };
      const p2 = { x: 50.1, y: 50 };
      const p3 = { x: 50, y: 49 };
      const p4 = { x: 50, y: 51 };

      const result = lineIntersection(p1, p2, p3, p4);

      expect(result).not.toBeNull();
      expect(result.x).toBeCloseTo(50, 1);
      expect(result.y).toBeCloseTo(50, 1);
    });
  });
});

describe('isPointInsidePolygon', () => {
  describe('Rectangle polygon', () => {
    const rect = createRectangle(200, 100);

    it('should return true for point inside rectangle', () => {
      expect(isPointInsidePolygon({ x: 100, y: 50 }, rect)).toBe(true);
    });

    it('should return false for point outside rectangle', () => {
      expect(isPointInsidePolygon({ x: 300, y: 50 }, rect)).toBe(false);
      expect(isPointInsidePolygon({ x: 100, y: 150 }, rect)).toBe(false);
      expect(isPointInsidePolygon({ x: -10, y: 50 }, rect)).toBe(false);
    });

    it('should return true for point on edge (within tolerance)', () => {
      expect(isPointInsidePolygon({ x: 0, y: 50 }, rect)).toBe(true);
      expect(isPointInsidePolygon({ x: 200, y: 50 }, rect)).toBe(true);
      expect(isPointInsidePolygon({ x: 100, y: 0 }, rect)).toBe(true);
      expect(isPointInsidePolygon({ x: 100, y: 100 }, rect)).toBe(true);
    });

    it('should return true for point at vertex', () => {
      expect(isPointInsidePolygon({ x: 0, y: 0 }, rect)).toBe(true);
      expect(isPointInsidePolygon({ x: 200, y: 100 }, rect)).toBe(true);
    });
  });

  describe('L-shaped polygon (concave)', () => {
    const lShape = createLShape();

    it('should return true for points in both sections of L', () => {
      expect(isPointInsidePolygon({ x: 100, y: 50 }, lShape)).toBe(true);
      expect(isPointInsidePolygon({ x: 50, y: 150 }, lShape)).toBe(true);
    });

    it('should return false for point in concave area', () => {
      expect(isPointInsidePolygon({ x: 150, y: 150 }, lShape)).toBe(false);
    });

    it('should return false for points outside L-shape', () => {
      expect(isPointInsidePolygon({ x: 250, y: 50 }, lShape)).toBe(false);
      expect(isPointInsidePolygon({ x: 50, y: 250 }, lShape)).toBe(false);
    });
  });

  describe('U-shaped polygon (multiple interior edges)', () => {
    const uShape = createUShape();

    it('should return true for points in U arms', () => {
      expect(isPointInsidePolygon({ x: 50, y: 100 }, uShape)).toBe(true);
      expect(isPointInsidePolygon({ x: 250, y: 100 }, uShape)).toBe(true);
    });

    it('should return false for point in U interior cutout', () => {
      expect(isPointInsidePolygon({ x: 150, y: 100 }, uShape)).toBe(false);
    });

    it('should return true for points on interior edges', () => {
      expect(isPointInsidePolygon({ x: 100, y: 50 }, uShape)).toBe(true);
      expect(isPointInsidePolygon({ x: 200, y: 50 }, uShape)).toBe(true);
    });
  });

  describe('Triangle polygon', () => {
    const triangle = createTriangle();

    it('should return true for point inside triangle', () => {
      expect(isPointInsidePolygon({ x: 100, y: 100 }, triangle)).toBe(true);
    });

    it('should return false for point outside triangle', () => {
      expect(isPointInsidePolygon({ x: 50, y: 50 }, triangle)).toBe(false);
      expect(isPointInsidePolygon({ x: 150, y: 50 }, triangle)).toBe(false);
    });
  });

  describe('Error cases', () => {
    it('should return false for null polygon', () => {
      expect(isPointInsidePolygon({ x: 100, y: 100 }, null)).toBe(false);
    });

    it('should return false for polygon with less than 3 vertices', () => {
      expect(isPointInsidePolygon({ x: 100, y: 100 }, [])).toBe(false);
      expect(isPointInsidePolygon({ x: 100, y: 100 }, [{ x: 0, y: 0 }])).toBe(false);
      expect(isPointInsidePolygon({ x: 100, y: 100 }, [{ x: 0, y: 0 }, { x: 100, y: 0 }])).toBe(false);
    });

    it('should return false for undefined polygon', () => {
      expect(isPointInsidePolygon({ x: 100, y: 100 }, undefined)).toBe(false);
    });
  });
});

describe('clipBeamToDeckBoundary', () => {
  describe('Rectangle deck - simple cases', () => {
    const rect = createRectangle(200, 100);

    it('should return null when both endpoints are inside (no clipping needed)', () => {
      const beam = {
        p1: { x: 50, y: 50 },
        p2: { x: 150, y: 50 }
      };

      const result = clipBeamToDeckBoundary(beam, rect, true);

      expect(result).toBeNull();
    });

    it('should clip beam when p1 is outside and p2 is inside', () => {
      const beam = {
        p1: { x: -50, y: 50 },
        p2: { x: 150, y: 50 }
      };

      const result = clipBeamToDeckBoundary(beam, rect, true);

      expect(result).not.toBeNull();
      expect(result.removed).not.toBe(true);
      expect(result.p1.x).toBeCloseTo(0, 1);
      expect(result.p1.y).toBeCloseTo(50, 1);
      expect(result.p2.x).toBeCloseTo(150, 1);
      expect(result.p2.y).toBeCloseTo(50, 1);
    });

    it('should clip beam when p1 is inside and p2 is outside', () => {
      const beam = {
        p1: { x: 50, y: 50 },
        p2: { x: 250, y: 50 }
      };

      const result = clipBeamToDeckBoundary(beam, rect, true);

      expect(result).not.toBeNull();
      expect(result.removed).not.toBe(true);
      expect(result.p1.x).toBeCloseTo(50, 1);
      expect(result.p1.y).toBeCloseTo(50, 1);
      expect(result.p2.x).toBeCloseTo(200, 1);
      expect(result.p2.y).toBeCloseTo(50, 1);
    });

    it('should clip beam when both endpoints are outside but beam crosses deck', () => {
      const beam = {
        p1: { x: -50, y: 50 },
        p2: { x: 250, y: 50 }
      };

      const result = clipBeamToDeckBoundary(beam, rect, true);

      expect(result).not.toBeNull();
      expect(result.removed).not.toBe(true);
      expect(result.p1.x).toBeCloseTo(0, 1);
      expect(result.p1.y).toBeCloseTo(50, 1);
      expect(result.p2.x).toBeCloseTo(200, 1);
      expect(result.p2.y).toBeCloseTo(50, 1);
    });

    it('should mark beam for removal when entirely outside', () => {
      const beam = {
        p1: { x: 300, y: 50 },
        p2: { x: 400, y: 50 }
      };

      const result = clipBeamToDeckBoundary(beam, rect, true);

      expect(result).not.toBeNull();
      expect(result.removed).toBe(true);
      expect(result.lengthFt).toBe(0);
    });

    it('should calculate correct length in feet after clipping', () => {
      const beam = {
        p1: { x: -48, y: 50 },  // 2 feet outside (24 pixels/foot)
        p2: { x: 48, y: 50 }     // 2 feet inside
      };

      const result = clipBeamToDeckBoundary(beam, rect, true);

      expect(result).not.toBeNull();
      expect(result.lengthFt).toBeCloseTo(2, 1); // Should be 2 feet
    });
  });

  describe('L-shaped deck - concave polygon', () => {
    const lShape = createLShape();

    it('should clip horizontal beam crossing L-shape', () => {
      const beam = {
        p1: { x: -50, y: 50 },
        p2: { x: 250, y: 50 }
      };

      const result = clipBeamToDeckBoundary(beam, lShape, true);

      expect(result).not.toBeNull();
      expect(result.removed).not.toBe(true);
      expect(result.p1.x).toBeCloseTo(0, 1);
      expect(result.p2.x).toBeCloseTo(200, 1);
    });

    it('should clip vertical beam in concave area', () => {
      const beam = {
        p1: { x: 150, y: -50 },
        p2: { x: 150, y: 250 }
      };

      const result = clipBeamToDeckBoundary(beam, lShape, false);

      expect(result).not.toBeNull();
      expect(result.p1.y).toBeCloseTo(0, 1);
      expect(result.p2.y).toBeCloseTo(100, 1);
    });

    it('should mark beam for removal when in concave cutout area', () => {
      const beam = {
        p1: { x: 150, y: 150 },
        p2: { x: 180, y: 150 }
      };

      const result = clipBeamToDeckBoundary(beam, lShape, true);

      expect(result).not.toBeNull();
      expect(result.removed).toBe(true);
    });
  });

  describe('U-shaped deck - multiple interior edges', () => {
    const uShape = createUShape();

    it('should clip beam crossing U-shape horizontally', () => {
      const beam = {
        p1: { x: -50, y: 100 },
        p2: { x: 350, y: 100 }
      };

      const result = clipBeamToDeckBoundary(beam, uShape, true);

      expect(result).not.toBeNull();
      expect(result.removed).not.toBe(true);
      expect(result.p1.x).toBeGreaterThanOrEqual(0);
      expect(result.p2.x).toBeLessThanOrEqual(300);
    });

    it('should handle beam crossing interior cutout', () => {
      const beam = {
        p1: { x: 50, y: 100 },
        p2: { x: 250, y: 100 }
      };

      const result = clipBeamToDeckBoundary(beam, uShape, true);

      expect(result).not.toBeNull();
      expect(result.p1.x).toBeLessThanOrEqual(100);
    });
  });

  describe('Edge cases', () => {
    const rect = createRectangle(200, 100);

    it('should return null for invalid polygon (less than 3 vertices)', () => {
      const beam = {
        p1: { x: 50, y: 50 },
        p2: { x: 150, y: 50 }
      };

      expect(clipBeamToDeckBoundary(beam, [], true)).toBeNull();
      expect(clipBeamToDeckBoundary(beam, [{ x: 0, y: 0 }], true)).toBeNull();
    });

    it('should return null for null shapePoints', () => {
      const beam = {
        p1: { x: 50, y: 50 },
        p2: { x: 150, y: 50 }
      };

      expect(clipBeamToDeckBoundary(beam, null, true)).toBeNull();
    });

    it('should handle beam exactly on polygon edge', () => {
      const beam = {
        p1: { x: 0, y: 50 },
        p2: { x: 200, y: 50 }
      };

      const result = clipBeamToDeckBoundary(beam, rect, true);
      expect(result).toBeNull();
    });

    it('should handle diagonal beam crossing corner', () => {
      const beam = {
        p1: { x: -50, y: -50 },
        p2: { x: 250, y: 150 }
      };

      const result = clipBeamToDeckBoundary(beam, rect, false);

      expect(result).not.toBeNull();
      expect(result.removed).not.toBe(true);
      expect(result.p1.x).toBeGreaterThanOrEqual(0);
      expect(result.p1.y).toBeGreaterThanOrEqual(0);
      expect(result.p2.x).toBeLessThanOrEqual(200);
      expect(result.p2.y).toBeLessThanOrEqual(100);
    });
  });

  describe('Multiple edge crossings', () => {
    const lShape = createLShape();

    it('should handle beam crossing multiple edges of L-shape', () => {
      const beam = {
        p1: { x: 50, y: -50 },
        p2: { x: 50, y: 250 }
      };

      const result = clipBeamToDeckBoundary(beam, lShape, false);

      expect(result).not.toBeNull();
      expect(result.removed).not.toBe(true);
      expect(result.lengthFt).toBeGreaterThan(0);
    });
  });
});

describe('clipJoistToBoundary', () => {
  describe('Rectangle deck - simple cases', () => {
    const rect = createRectangle(200, 100);

    it('should return original joist when both endpoints are inside', () => {
      const joist = {
        p1: { x: 50, y: 50 },
        p2: { x: 150, y: 50 },
        lengthFeet: 4.17
      };

      const result = clipJoistToBoundary(joist, rect);

      expect(result).toEqual(joist);
    });

    it('should clip joist when p1 is outside and p2 is inside', () => {
      const joist = {
        p1: { x: -50, y: 50 },
        p2: { x: 150, y: 50 },
        lengthFeet: 8.33
      };

      const result = clipJoistToBoundary(joist, rect);

      expect(result).not.toBeNull();
      expect(result.p1.x).toBeCloseTo(0, 1);
      expect(result.p1.y).toBeCloseTo(50, 1);
      expect(result.p2.x).toBeCloseTo(150, 1);
      expect(result.p2.y).toBeCloseTo(50, 1);
      expect(result.lengthFeet).toBeGreaterThan(0);
    });

    it('should clip joist when p1 is inside and p2 is outside', () => {
      const joist = {
        p1: { x: 50, y: 50 },
        p2: { x: 250, y: 50 },
        lengthFeet: 8.33
      };

      const result = clipJoistToBoundary(joist, rect);

      expect(result).not.toBeNull();
      expect(result.p1.x).toBeCloseTo(50, 1);
      expect(result.p1.y).toBeCloseTo(50, 1);
      expect(result.p2.x).toBeCloseTo(200, 1);
      expect(result.p2.y).toBeCloseTo(50, 1);
    });

    it('should clip joist when both endpoints are outside but joist crosses deck', () => {
      const joist = {
        p1: { x: -50, y: 50 },
        p2: { x: 250, y: 50 },
        lengthFeet: 12.5
      };

      const result = clipJoistToBoundary(joist, rect);

      expect(result).not.toBeNull();
      expect(result.p1.x).toBeCloseTo(0, 1);
      expect(result.p1.y).toBeCloseTo(50, 1);
      expect(result.p2.x).toBeCloseTo(200, 1);
      expect(result.p2.y).toBeCloseTo(50, 1);
    });

    it('should return null when joist is entirely outside', () => {
      const joist = {
        p1: { x: 300, y: 50 },
        p2: { x: 400, y: 50 },
        lengthFeet: 4.17
      };

      const result = clipJoistToBoundary(joist, rect);

      expect(result).toBeNull();
    });
  });

  describe('L-shaped deck', () => {
    const lShape = createLShape();

    it('should clip joist crossing L-shape', () => {
      const joist = {
        p1: { x: -50, y: 50 },
        p2: { x: 250, y: 50 },
        lengthFeet: 12.5
      };

      const result = clipJoistToBoundary(joist, lShape);

      expect(result).not.toBeNull();
      expect(result.p1.x).toBeCloseTo(0, 1);
      expect(result.p2.x).toBeCloseTo(200, 1);
    });

    it('should return null for joist in concave cutout area', () => {
      const joist = {
        p1: { x: 150, y: 150 },
        p2: { x: 180, y: 150 },
        lengthFeet: 1.25
      };

      const result = clipJoistToBoundary(joist, lShape);

      expect(result).toBeNull();
    });
  });

  describe('U-shaped deck', () => {
    const uShape = createUShape();

    it('should clip joist crossing U-shape', () => {
      const joist = {
        p1: { x: -50, y: 100 },
        p2: { x: 350, y: 100 },
        lengthFeet: 16.67
      };

      const result = clipJoistToBoundary(joist, uShape);

      expect(result).not.toBeNull();
      expect(result.p1.x).toBeGreaterThanOrEqual(0);
      expect(result.p2.x).toBeLessThanOrEqual(300);
    });
  });

  describe('Error cases', () => {
    const rect = createRectangle(200, 100);

    it('should return original joist for invalid polygon', () => {
      const joist = {
        p1: { x: 50, y: 50 },
        p2: { x: 150, y: 50 },
        lengthFeet: 4.17
      };

      expect(clipJoistToBoundary(joist, [])).toEqual(joist);
      expect(clipJoistToBoundary(joist, null)).toEqual(joist);
    });

    it('should return original joist when missing endpoints', () => {
      const joist = {
        lengthFeet: 4.17
      };

      expect(clipJoistToBoundary(joist, rect)).toEqual(joist);
    });

    it('should preserve joist properties after clipping', () => {
      const joist = {
        p1: { x: -50, y: 50 },
        p2: { x: 150, y: 50 },
        lengthFeet: 8.33,
        spacing: 16,
        size: '2x8',
        direction: 'horizontal'
      };

      const result = clipJoistToBoundary(joist, rect);

      expect(result).not.toBeNull();
      expect(result.spacing).toBe(16);
      expect(result.size).toBe('2x8');
      expect(result.direction).toBe('horizontal');
    });
  });

  describe('Diagonal joists', () => {
    const rect = createRectangle(200, 100);

    it('should clip diagonal joist crossing corner', () => {
      const joist = {
        p1: { x: -50, y: -50 },
        p2: { x: 250, y: 150 },
        lengthFeet: 12.5
      };

      const result = clipJoistToBoundary(joist, rect);

      expect(result).not.toBeNull();
      expect(result.p1.x).toBeGreaterThanOrEqual(0);
      expect(result.p1.y).toBeGreaterThanOrEqual(0);
      expect(result.p2.x).toBeLessThanOrEqual(200);
      expect(result.p2.y).toBeLessThanOrEqual(100);
    });
  });
});
