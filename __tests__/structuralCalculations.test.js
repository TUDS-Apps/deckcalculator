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

describe('L-shape structural validation', () => {
  let result;
  beforeAll(() => {
    // L-shape: 12' wide top, 6' wide bottom leg, 10' tall
    const points = [
      { x: 0, y: 0 },
      { x: ft(12), y: 0 },
      { x: ft(12), y: ft(5) },
      { x: ft(6), y: ft(5) },
      { x: ft(6), y: ft(10) },
      { x: 0, y: ft(10) },
    ];
    const dims = {
      widthFeet: 12,
      heightFeet: 10,
      minX: 0,
      maxX: ft(12),
      minY: 0,
      maxY: ft(10),
    };
    result = calculateStructure(points, [0], standardInputs, dims);
  });

  it('should not return an error', () => {
    expect(result.error).toBeNull();
  });

  it('should have joists and beams', () => {
    expect(result.joists.length).toBeGreaterThan(0);
    expect(result.beams.length).toBeGreaterThan(0);
  });

  it('should have all beams within deck bounds', () => {
    for (const beam of result.beams) {
      expect(beam.p1.x).toBeGreaterThanOrEqual(-1);
      expect(beam.p1.x).toBeLessThanOrEqual(ft(12) + 1);
      expect(beam.p1.y).toBeGreaterThanOrEqual(-1);
      expect(beam.p1.y).toBeLessThanOrEqual(ft(10) + 1);
      expect(beam.p2.x).toBeGreaterThanOrEqual(-1);
      expect(beam.p2.x).toBeLessThanOrEqual(ft(12) + 1);
      expect(beam.p2.y).toBeGreaterThanOrEqual(-1);
      expect(beam.p2.y).toBeLessThanOrEqual(ft(10) + 1);
    }
  });

  it('should not have overlapping beams', () => {
    for (let i = 0; i < result.beams.length; i++) {
      for (let j = i + 1; j < result.beams.length; j++) {
        const b1 = result.beams[i];
        const b2 = result.beams[j];
        // Two beams overlap if they're on the same line and their ranges intersect
        const sameHorizontal = Math.abs(b1.p1.y - b1.p2.y) < 1 &&
                                Math.abs(b2.p1.y - b2.p2.y) < 1 &&
                                Math.abs(b1.p1.y - b2.p1.y) < 1;
        const sameVertical = Math.abs(b1.p1.x - b1.p2.x) < 1 &&
                              Math.abs(b2.p1.x - b2.p2.x) < 1 &&
                              Math.abs(b1.p1.x - b2.p1.x) < 1;
        if (sameHorizontal) {
          const b1MinX = Math.min(b1.p1.x, b1.p2.x);
          const b1MaxX = Math.max(b1.p1.x, b1.p2.x);
          const b2MinX = Math.min(b2.p1.x, b2.p2.x);
          const b2MaxX = Math.max(b2.p1.x, b2.p2.x);
          const overlap = Math.min(b1MaxX, b2MaxX) - Math.max(b1MinX, b2MinX);
          // Allow small overlap at endpoints (1px tolerance)
          expect(overlap).toBeLessThan(2);
        }
        if (sameVertical) {
          const b1MinY = Math.min(b1.p1.y, b1.p2.y);
          const b1MaxY = Math.max(b1.p1.y, b1.p2.y);
          const b2MinY = Math.min(b2.p1.y, b2.p2.y);
          const b2MaxY = Math.max(b2.p1.y, b2.p2.y);
          const overlap = Math.min(b1MaxY, b2MaxY) - Math.max(b1MinY, b2MinY);
          expect(overlap).toBeLessThan(2);
        }
      }
    }
  });
});

describe('U-shape structural validation', () => {
  let result;
  beforeAll(() => {
    // U-shape: 14' wide, 10' tall, center cutout 6' wide x 5' deep
    const points = [
      { x: 0, y: 0 },
      { x: ft(14), y: 0 },
      { x: ft(14), y: ft(10) },
      { x: ft(10), y: ft(10) },
      { x: ft(10), y: ft(5) },
      { x: ft(4), y: ft(5) },
      { x: ft(4), y: ft(10) },
      { x: 0, y: ft(10) },
    ];
    const dims = {
      widthFeet: 14,
      heightFeet: 10,
      minX: 0,
      maxX: ft(14),
      minY: 0,
      maxY: ft(10),
    };
    result = calculateStructure(points, [0], standardInputs, dims);
  });

  it('should not return an error', () => {
    expect(result.error).toBeNull();
  });

  it('should have joists and beams', () => {
    expect(result.joists.length).toBeGreaterThan(0);
    expect(result.beams.length).toBeGreaterThan(0);
  });

  it('should have all joists running in the same direction', () => {
    // For a horizontal ledger, all joists should be roughly vertical (perpendicular to ledger)
    const verticalJoists = result.joists.filter(j => Math.abs(j.p1.x - j.p2.x) < 2);
    const horizontalJoists = result.joists.filter(j => Math.abs(j.p1.y - j.p2.y) < 2);
    // One direction should dominate
    const dominantCount = Math.max(verticalJoists.length, horizontalJoists.length);
    expect(dominantCount).toBe(result.joists.length);
  });
});
