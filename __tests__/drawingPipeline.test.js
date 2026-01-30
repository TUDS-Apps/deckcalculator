/**
 * Integration Tests for the Drawing Pipeline
 *
 * Tests the core pipeline: simplifyPoints → validateShape → decomposeShape
 * Uses real source imports (no copy-paste).
 */

import { simplifyPoints } from '../deckCalcjs/utils.js';
import { validateShape } from '../deckCalcjs/shapeValidator.js';
import { decomposeShape, isPointInsidePolygon } from '../deckCalcjs/shapeDecomposer.js';
import { PIXELS_PER_FOOT } from '../deckCalcjs/config.js';

// Suppress console.log noise from shapeDecomposer
const originalLog = console.log;
const originalWarn = console.warn;
beforeAll(() => {
  console.log = () => {};
  console.warn = () => {};
});
afterAll(() => {
  console.log = originalLog;
  console.warn = originalWarn;
});

// Helper: feet to pixels
const ft = (feet) => feet * PIXELS_PER_FOOT;

// ============================================================================
// TEST SHAPES (all coordinates in pixels, using PIXELS_PER_FOOT = 24)
// ============================================================================

/** 10' x 12' rectangle with closing point */
function createRectangle() {
  return [
    { x: 0, y: 0 },
    { x: ft(12), y: 0 },
    { x: ft(12), y: ft(10) },
    { x: 0, y: ft(10) },
    { x: 0, y: 0 }  // closing point
  ];
}

/** L-shape: 12' wide top, 6' wide bottom leg, 10' tall total, 5' notch depth */
function createLShape() {
  return [
    { x: 0, y: 0 },
    { x: ft(12), y: 0 },
    { x: ft(12), y: ft(5) },
    { x: ft(6), y: ft(5) },
    { x: ft(6), y: ft(10) },
    { x: 0, y: ft(10) },
    { x: 0, y: 0 }  // closing point
  ];
}

/** U-shape: 14' wide, 10' tall, center cutout 6' wide x 5' deep */
function createUShape() {
  return [
    { x: 0, y: 0 },
    { x: ft(14), y: 0 },
    { x: ft(14), y: ft(10) },
    { x: ft(10), y: ft(10) },
    { x: ft(10), y: ft(5) },
    { x: ft(4), y: ft(5) },
    { x: ft(4), y: ft(10) },
    { x: 0, y: ft(10) },
    { x: 0, y: 0 }  // closing point
  ];
}

/** T-shape: 14' wide top bar, 6' wide stem, arranged as T */
function createTShape() {
  return [
    { x: 0, y: 0 },
    { x: ft(14), y: 0 },
    { x: ft(14), y: ft(5) },
    { x: ft(10), y: ft(5) },
    { x: ft(10), y: ft(10) },
    { x: ft(4), y: ft(10) },
    { x: ft(4), y: ft(5) },
    { x: 0, y: ft(5) },
    { x: 0, y: 0 }  // closing point
  ];
}

/** Rectangle with one 45-degree clipped corner (pentagon) */
function create45DegreeShape() {
  return [
    { x: 0, y: 0 },
    { x: ft(10), y: 0 },
    { x: ft(12), y: ft(2) },   // 45-degree clip
    { x: ft(12), y: ft(10) },
    { x: 0, y: ft(10) },
    { x: 0, y: 0 }  // closing point
  ];
}

/** L-shape with extra collinear midpoints that simplifyPoints should remove */
function createLShapeWithCollinear() {
  return [
    { x: 0, y: 0 },
    { x: ft(6), y: 0 },        // collinear midpoint on top edge
    { x: ft(12), y: 0 },
    { x: ft(12), y: ft(5) },
    { x: ft(6), y: ft(5) },
    { x: ft(6), y: ft(10) },
    { x: 0, y: ft(10) },
    { x: 0, y: ft(5) },        // collinear midpoint on left edge
    { x: 0, y: 0 }             // closing point
  ];
}

// ============================================================================
// TESTS
// ============================================================================

describe('Drawing Pipeline Integration', () => {

  describe('Test 1: Simple rectangle', () => {
    it('should decompose into 1 rectangular section', () => {
      const points = createRectangle();
      const simplified = simplifyPoints(points);
      const validation = validateShape(simplified);
      expect(validation.isValid).toBe(true);

      const sections = decomposeShape(simplified, 0);
      expect(sections.length).toBe(1);
    });
  });

  describe('Test 2: L-shape', () => {
    it('should validate and decompose into 2 rectangular sections', () => {
      const points = createLShape();
      const simplified = simplifyPoints(points);
      const validation = validateShape(simplified);
      expect(validation.isValid).toBe(true);

      const sections = decomposeShape(simplified, 0);
      expect(sections.length).toBe(2);
    });
  });

  describe('Test 3: U-shape', () => {
    it('should validate and decompose into 3 rectangular sections', () => {
      const points = createUShape();
      const simplified = simplifyPoints(points);
      const validation = validateShape(simplified);
      expect(validation.isValid).toBe(true);

      const sections = decomposeShape(simplified, 0);
      expect(sections.length).toBe(3);
    });
  });

  describe('Test 4: T-shape', () => {
    it('should validate and decompose into rectangular sections', () => {
      const points = createTShape();
      const simplified = simplifyPoints(points);
      const validation = validateShape(simplified);
      expect(validation.isValid).toBe(true);

      const sections = decomposeShape(simplified, 0);
      expect(sections.length).toBeGreaterThanOrEqual(2);
      expect(sections.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Test 5: Shape with 45-degree corner', () => {
    it('should validate successfully with diagonal edge', () => {
      const points = create45DegreeShape();
      const simplified = simplifyPoints(points);
      const validation = validateShape(simplified);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('Test 6: simplifyPoints preserves closing point', () => {
    it('should remove collinear points but preserve closing point', () => {
      const points = createLShapeWithCollinear();

      // Verify input has collinear points (9 points including closing)
      expect(points.length).toBe(9);

      const simplified = simplifyPoints(points);

      // Should have fewer points (collinear removed)
      expect(simplified.length).toBeLessThan(points.length);

      // Closing point must be preserved
      const first = simplified[0];
      const last = simplified[simplified.length - 1];
      expect(Math.abs(first.x - last.x)).toBeLessThan(0.1);
      expect(Math.abs(first.y - last.y)).toBeLessThan(0.1);

      // Must still have enough vertices for L-shape (6 unique + closing = 7)
      expect(simplified.length).toBeGreaterThanOrEqual(7);
    });
  });

  describe('Test 7: simplifyPoints does not remove necessary corners', () => {
    it('should preserve all corners of an L-shape with no collinear points', () => {
      const points = createLShape();
      const simplified = simplifyPoints(points);

      // L-shape has 6 unique corners + closing = 7 points, none are collinear
      // So simplification should preserve all of them
      expect(simplified.length).toBe(7);
    });
  });

  describe('Test 8: Point-in-polygon for concave shapes', () => {
    it('should correctly identify points inside and outside an L-shape', () => {
      // L-shape without closing point for isPointInsidePolygon
      const lShape = [
        { x: 0, y: 0 },
        { x: ft(12), y: 0 },
        { x: ft(12), y: ft(5) },
        { x: ft(6), y: ft(5) },
        { x: ft(6), y: ft(10) },
        { x: 0, y: ft(10) }
      ];

      // Point in the main body (should be inside)
      expect(isPointInsidePolygon({ x: ft(3), y: ft(3) }, lShape)).toBe(true);

      // Point in the lower-left leg (should be inside)
      expect(isPointInsidePolygon({ x: ft(3), y: ft(8) }, lShape)).toBe(true);

      // Point in the concave cutout area (should be outside)
      expect(isPointInsidePolygon({ x: ft(9), y: ft(8) }, lShape)).toBe(false);

      // Point clearly outside the shape
      expect(isPointInsidePolygon({ x: ft(15), y: ft(5) }, lShape)).toBe(false);
    });
  });

});
