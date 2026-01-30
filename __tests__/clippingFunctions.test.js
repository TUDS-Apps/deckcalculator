/**
 * Unit Tests for Deck Calculator Clipping Functions
 * Tests clipBeamToDeckBoundary, clipJoistToBoundary, isPointInsidePolygon, and lineIntersection
 *
 * Generated to prevent regressions on clipping fixes for L-shaped and U-shaped decks.
 */

import { PIXELS_PER_FOOT, EPSILON } from '../deckCalcjs/config.js';
import {
  clipBeamToDeckBoundary,
  clipJoistToBoundary,
  isPointInsidePolygon,
  isPointOnSegment,
  lineIntersection
} from '../deckCalcjs/multiSectionCalculations.js';

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
