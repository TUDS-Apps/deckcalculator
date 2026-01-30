/**
 * Structural Calculation Snapshot Tests
 *
 * Captures current structural output for known inputs so future refactoring
 * can be validated against known-good results.
 */

import { calculateStructure } from '../deckCalcjs/deckCalculations.js';
import { PIXELS_PER_FOOT } from '../deckCalcjs/config.js';

// Suppress console noise
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

// Standard inputs shared across tests
const standardInputs = {
  joistSpacing: 16,
  postSize: '6x6',
  deckHeight: 48,
  attachmentType: 'house_rim',
  beamType: 'flush',
  footingType: 'sono_tube',
};

function makeDims(widthFt, heightFt, offsetX = 0, offsetY = 0) {
  return {
    widthFeet: widthFt,
    heightFeet: heightFt,
    minX: offsetX,
    maxX: offsetX + ft(widthFt),
    minY: offsetY,
    maxY: offsetY + ft(heightFt),
  };
}

function makeRectPoints(widthFt, heightFt) {
  return [
    { x: 0, y: 0 },
    { x: ft(widthFt), y: 0 },
    { x: ft(widthFt), y: ft(heightFt) },
    { x: 0, y: ft(heightFt) },
  ];
}

describe('Structural Calculations', () => {

  describe('10x10 ft rectangle, ledger on edge 0 (top)', () => {
    let result;
    beforeAll(() => {
      const points = makeRectPoints(10, 10);
      const dims = makeDims(10, 10);
      result = calculateStructure(points, [0], standardInputs, dims);
    });

    it('should not return an error', () => {
      expect(result.error).toBeNull();
    });

    it('should have a ledger', () => {
      expect(result.ledger).not.toBeNull();
    });

    it('should have joists', () => {
      expect(result.joists.length).toBeGreaterThan(0);
    });

    it('should have beams', () => {
      expect(result.beams.length).toBeGreaterThan(0);
    });

    it('should have posts', () => {
      expect(result.posts.length).toBeGreaterThan(0);
    });

    it('should have all joist endpoints within deck bounds', () => {
      const minX = -1, maxX = ft(10) + 1;
      const minY = -1, maxY = ft(10) + 1;
      for (const joist of result.joists) {
        expect(joist.p1.x).toBeGreaterThanOrEqual(minX);
        expect(joist.p1.x).toBeLessThanOrEqual(maxX);
        expect(joist.p1.y).toBeGreaterThanOrEqual(minY);
        expect(joist.p1.y).toBeLessThanOrEqual(maxY);
        expect(joist.p2.x).toBeGreaterThanOrEqual(minX);
        expect(joist.p2.x).toBeLessThanOrEqual(maxX);
        expect(joist.p2.y).toBeGreaterThanOrEqual(minY);
        expect(joist.p2.y).toBeLessThanOrEqual(maxY);
      }
    });

    it('should have all beam positions within deck bounds', () => {
      const minX = -1, maxX = ft(10) + 1;
      const minY = -1, maxY = ft(10) + 1;
      for (const beam of result.beams) {
        expect(beam.p1.x).toBeGreaterThanOrEqual(minX);
        expect(beam.p1.x).toBeLessThanOrEqual(maxX);
        expect(beam.p1.y).toBeGreaterThanOrEqual(minY);
        expect(beam.p1.y).toBeLessThanOrEqual(maxY);
        expect(beam.p2.x).toBeGreaterThanOrEqual(minX);
        expect(beam.p2.x).toBeLessThanOrEqual(maxX);
        expect(beam.p2.y).toBeGreaterThanOrEqual(minY);
        expect(beam.p2.y).toBeLessThanOrEqual(maxY);
      }
    });
  });

  describe('20x12 ft rectangle, ledger on edge 0', () => {
    let result;
    beforeAll(() => {
      const points = makeRectPoints(20, 12);
      const dims = makeDims(20, 12);
      result = calculateStructure(points, [0], standardInputs, dims);
    });

    it('should not return an error', () => {
      expect(result.error).toBeNull();
    });

    it('should have joists and beams', () => {
      expect(result.joists.length).toBeGreaterThan(0);
      expect(result.beams.length).toBeGreaterThan(0);
    });

    it('should have more joists than the 10x10 deck', () => {
      const smallPoints = makeRectPoints(10, 10);
      const smallDims = makeDims(10, 10);
      const smallResult = calculateStructure(smallPoints, [0], standardInputs, smallDims);
      expect(result.joists.length).toBeGreaterThan(smallResult.joists.length);
    });
  });

  describe('10x10 ft rectangle, ledger on edge 2 (bottom)', () => {
    let result;
    beforeAll(() => {
      const points = makeRectPoints(10, 10);
      const dims = makeDims(10, 10);
      result = calculateStructure(points, [2], standardInputs, dims);
    });

    it('should not return an error', () => {
      expect(result.error).toBeNull();
    });

    it('should have a ledger', () => {
      expect(result.ledger).not.toBeNull();
    });

    it('should have joists and beams', () => {
      expect(result.joists.length).toBeGreaterThan(0);
      expect(result.beams.length).toBeGreaterThan(0);
    });
  });

  describe('Beams should not overlap with ledger', () => {
    it('should not have any beam at the same position as the ledger', () => {
      const points = makeRectPoints(10, 10);
      const dims = makeDims(10, 10);
      const result = calculateStructure(points, [0], standardInputs, dims);

      if (result.ledger && result.beams.length > 0) {
        const ledgerY = result.ledger.p1.y;
        for (const beam of result.beams) {
          // A beam directly on the ledger would be wrong
          const beamY = beam.p1.y;
          if (Math.abs(beam.p1.y - beam.p2.y) < 1) {
            // Horizontal beam — check it's not at ledger Y
            expect(Math.abs(beamY - ledgerY)).toBeGreaterThan(1);
          }
        }
      }
    });
  });

  describe('All structural components within deck bounds', () => {
    it('should have posts within deck bounds', () => {
      const points = makeRectPoints(10, 10);
      const dims = makeDims(10, 10);
      const result = calculateStructure(points, [0], standardInputs, dims);

      const tolerance = ft(1); // posts can be slightly inset
      for (const post of result.posts) {
        expect(post.x).toBeGreaterThanOrEqual(-tolerance);
        expect(post.x).toBeLessThanOrEqual(ft(10) + tolerance);
        expect(post.y).toBeGreaterThanOrEqual(-tolerance);
        expect(post.y).toBeLessThanOrEqual(ft(10) + tolerance);
      }
    });
  });

});
