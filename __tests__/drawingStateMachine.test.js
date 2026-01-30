/**
 * Unit Tests for Drawing State Machine
 * Tests all pure functions: getCurrentState, snapping pipeline, tryCloseShape, state handlers
 */

import {
  getCurrentState, DrawingState, ActionType,
  handleClick, handleDrawingClick, handleIdleClick, handleWallSelectClick, handleEditingClick,
  tryCloseShape,
  snapToGrid, snapToAngle, detectCloseClick, getSnappedPosition
} from '../deckCalcjs/drawingStateMachine.js';
import {
  PIXELS_PER_FOOT, GRID_SPACING_PIXELS, EPSILON,
  SNAP_TOLERANCE_PIXELS, MODEL_WIDTH_FEET, MODEL_HEIGHT_FEET
} from '../deckCalcjs/config.js';

// Suppress console noise
const originalLog = console.log;
const originalWarn = console.warn;
beforeAll(() => { console.log = () => {}; console.warn = () => {}; });
afterAll(() => { console.log = originalLog; console.warn = originalWarn; });

const testConfig = {
  PIXELS_PER_FOOT, GRID_SPACING_PIXELS, EPSILON,
  SNAP_TOLERANCE_PIXELS, MODEL_WIDTH_FEET, MODEL_HEIGHT_FEET
};

const ft = (f) => f * PIXELS_PER_FOOT;

// ============================================================================
// getCurrentState
// ============================================================================

describe('getCurrentState', () => {
  const baseState = {
    isDrawing: false,
    isShapeClosed: false,
    wallSelectionMode: false,
    stairPlacementMode: false,
    shapeEditMode: false,
    isMeasureMode: false,
    decking: null,
    structuralComponents: null,
    points: [],
  };

  it('should return IDLE for empty state', () => {
    expect(getCurrentState(baseState)).toBe(DrawingState.IDLE);
  });

  it('should return DRAWING when isDrawing is true', () => {
    expect(getCurrentState({ ...baseState, isDrawing: true })).toBe(DrawingState.DRAWING);
  });

  it('should return DRAWING when points exist but isDrawing is false', () => {
    expect(getCurrentState({ ...baseState, points: [{ x: 0, y: 0 }] })).toBe(DrawingState.DRAWING);
  });

  it('should return SHAPE_CLOSED when shape is closed', () => {
    expect(getCurrentState({ ...baseState, isShapeClosed: true })).toBe(DrawingState.SHAPE_CLOSED);
  });

  it('should return WALL_SELECT when wall selection mode is active', () => {
    expect(getCurrentState({ ...baseState, isShapeClosed: true, wallSelectionMode: true })).toBe(DrawingState.WALL_SELECT);
  });

  it('should return EDITING when shape edit mode is active', () => {
    expect(getCurrentState({ ...baseState, isShapeClosed: true, shapeEditMode: true })).toBe(DrawingState.EDITING);
  });

  it('should return MEASURING when measure mode is active', () => {
    expect(getCurrentState({ ...baseState, isMeasureMode: true })).toBe(DrawingState.MEASURING);
  });

  it('should return STAIR_PLACE when stair placement is active', () => {
    expect(getCurrentState({ ...baseState, stairPlacementMode: true })).toBe(DrawingState.STAIR_PLACE);
  });

  it('should return BREAKER_PLACE when breaker placement is active', () => {
    expect(getCurrentState({ ...baseState, decking: { breakerPlacementMode: true } })).toBe(DrawingState.BREAKER_PLACE);
  });

  it('should return CALCULATED when structural components exist', () => {
    expect(getCurrentState({
      ...baseState, isShapeClosed: true, structuralComponents: { error: null }
    })).toBe(DrawingState.CALCULATED);
  });

  it('MEASURING should take priority over SHAPE_CLOSED', () => {
    expect(getCurrentState({ ...baseState, isMeasureMode: true, isShapeClosed: true })).toBe(DrawingState.MEASURING);
  });

  it('EDITING should take priority over WALL_SELECT', () => {
    expect(getCurrentState({
      ...baseState, isShapeClosed: true, shapeEditMode: true, wallSelectionMode: true
    })).toBe(DrawingState.EDITING);
  });
});

// ============================================================================
// snapToGrid
// ============================================================================

describe('snapToGrid', () => {
  it('should snap to nearest grid point', () => {
    expect(snapToGrid(25, 25, 24)).toEqual({ x: 24, y: 24 });
  });

  it('should keep values already on grid', () => {
    expect(snapToGrid(48, 48, 24)).toEqual({ x: 48, y: 48 });
  });

  it('should handle zero', () => {
    expect(snapToGrid(0, 0, 24)).toEqual({ x: 0, y: 0 });
  });

  it('should snap to 1-inch grid (2px)', () => {
    expect(snapToGrid(13, 13, 2)).toEqual({ x: 14, y: 14 });
  });

  it('should snap 12 to 12 on 2px grid', () => {
    expect(snapToGrid(12, 12, 2)).toEqual({ x: 12, y: 12 });
  });
});

// ============================================================================
// snapToAngle
// ============================================================================

describe('snapToAngle', () => {
  const prev = { x: 0, y: 0 };
  const angles = [0, 45, 90, 135, 180, -45, -90, -135, -180];

  it('should snap to 0 degrees (horizontal right)', () => {
    const result = snapToAngle({ x: 100, y: 5 }, prev, angles, 2);
    expect(result.y).toBe(0); // locked to horizontal
    expect(result.x).toBeGreaterThan(0);
  });

  it('should snap to 90 degrees (vertical down)', () => {
    const result = snapToAngle({ x: 3, y: 100 }, prev, angles, 2);
    expect(result.x).toBe(0); // locked to vertical
    expect(result.y).toBeGreaterThan(0);
  });

  it('should snap to 45 degrees', () => {
    const result = snapToAngle({ x: 100, y: 95 }, prev, angles, 2);
    // At 45 degrees, |dx| should equal |dy|
    expect(Math.abs(result.x)).toBe(Math.abs(result.y));
  });

  it('should not snap when too close to previous point', () => {
    const closePos = { x: 2, y: 2 };
    const result = snapToAngle(closePos, prev, angles, 2);
    expect(result).toEqual(closePos);
  });
});

// ============================================================================
// detectCloseClick
// ============================================================================

describe('detectCloseClick', () => {
  const firstPoint = { x: 100, y: 100 };

  it('should return true when within tolerance', () => {
    expect(detectCloseClick({ x: 102, y: 102 }, firstPoint, 10)).toBe(true);
  });

  it('should return false when outside tolerance', () => {
    expect(detectCloseClick({ x: 200, y: 200 }, firstPoint, 10)).toBe(false);
  });

  it('should return true when exactly at first point', () => {
    expect(detectCloseClick({ x: 100, y: 100 }, firstPoint, 10)).toBe(true);
  });
});

// ============================================================================
// getSnappedPosition
// ============================================================================

describe('getSnappedPosition', () => {
  it('should snap first point to 1-foot grid', () => {
    const result = getSnappedPosition({ x: 25, y: 25 }, [], testConfig, 1);
    expect(result.x).toBe(24);
    expect(result.y).toBe(24);
    expect(result.isClosingClick).toBe(false);
  });

  it('should detect closing click when near first point', () => {
    const points = [
      { x: 0, y: 0 },
      { x: ft(10), y: 0 },
      { x: ft(10), y: ft(10) }
    ];
    const result = getSnappedPosition({ x: 2, y: 2 }, points, testConfig, 1);
    expect(result.isClosingClick).toBe(true);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it('should not detect closing click with fewer than 3 points', () => {
    const points = [
      { x: 0, y: 0 },
      { x: ft(10), y: 0 }
    ];
    const result = getSnappedPosition({ x: 2, y: 2 }, points, testConfig, 1);
    expect(result.isClosingClick).toBe(false);
  });

  it('should angle-snap subsequent points', () => {
    const points = [{ x: 0, y: 0 }];
    const result = getSnappedPosition({ x: 100, y: 5 }, points, testConfig, 1);
    expect(result.y).toBe(0); // should snap horizontal
    expect(result.isClosingClick).toBe(false);
  });
});

// ============================================================================
// tryCloseShape
// ============================================================================

describe('tryCloseShape', () => {
  it('should close a rectangle successfully', () => {
    const points = [
      { x: 0, y: 0 },
      { x: ft(12), y: 0 },
      { x: ft(12), y: ft(10) },
      { x: 0, y: ft(10) }
    ];
    const result = tryCloseShape(points, testConfig);
    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
    expect(result.closedPoints.length).toBe(5); // 4 + closing
    expect(result.cornerAdded).toBe(false);
  });

  it('should close an L-shape successfully', () => {
    const points = [
      { x: 0, y: 0 },
      { x: ft(12), y: 0 },
      { x: ft(12), y: ft(5) },
      { x: ft(6), y: ft(5) },
      { x: ft(6), y: ft(10) },
      { x: 0, y: ft(10) }
    ];
    const result = tryCloseShape(points, testConfig);
    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
    expect(result.closedPoints.length).toBe(7); // 6 + closing
  });

  it('should auto-correct small X misalignment', () => {
    const points = [
      { x: 0, y: 0 },
      { x: ft(10), y: 0 },
      { x: ft(10), y: ft(10) },
      { x: 3, y: ft(10) }  // 3px off from 0 (< 3 inches = 6px)
    ];
    const result = tryCloseShape(points, testConfig);
    expect(result.success).toBe(true);
    // Last point should have been corrected to x=0
    const lastUniquePoint = result.closedPoints[3];
    expect(lastUniquePoint.x).toBe(0);
  });

  it('should add corner point when needed for 90-degree closure', () => {
    const points = [
      { x: 0, y: 0 },
      { x: ft(12), y: 0 },
      { x: ft(12), y: ft(5) },
      { x: ft(6), y: ft(5) },
      { x: ft(6), y: ft(10) }
      // Last point is at (144, 240), first is (0,0) — needs corner
    ];
    const result = tryCloseShape(points, testConfig);
    expect(result.success).toBe(true);
    expect(result.cornerAdded).toBe(true);
  });

  it('should fail with fewer than 3 points', () => {
    const result = tryCloseShape([{ x: 0, y: 0 }, { x: 100, y: 0 }], testConfig);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Need at least 3 points');
  });

  it('should not mutate input points', () => {
    const points = [
      { x: 0, y: 0 },
      { x: ft(10), y: 0 },
      { x: ft(10), y: ft(10) },
      { x: 0, y: ft(10) }
    ];
    const original = JSON.stringify(points);
    tryCloseShape(points, testConfig);
    expect(JSON.stringify(points)).toBe(original);
  });
});

// ============================================================================
// handleIdleClick
// ============================================================================

describe('handleIdleClick', () => {
  it('should return ADD_POINT with grid-snapped position', () => {
    const action = handleIdleClick({ x: 25, y: 25 }, {}, testConfig);
    expect(action.type).toBe(ActionType.ADD_POINT);
    expect(action.point).toEqual({ x: 24, y: 24 });
  });

  it('should return OUT_OF_BOUNDS for positions outside model area', () => {
    const action = handleIdleClick({ x: ft(150), y: 0 }, {}, testConfig);
    expect(action.type).toBe(ActionType.OUT_OF_BOUNDS);
  });
});

// ============================================================================
// handleDrawingClick
// ============================================================================

describe('handleDrawingClick', () => {
  it('should return ADD_POINT for normal drawing', () => {
    const state = { points: [{ x: 0, y: 0 }], viewportScale: 1 };
    const action = handleDrawingClick({ x: ft(10), y: 3 }, state, testConfig);
    expect(action.type).toBe(ActionType.ADD_POINT);
  });

  it('should return CLOSE_SHAPE when clicking near first point with 3+ points', () => {
    const state = {
      points: [
        { x: 0, y: 0 },
        { x: ft(10), y: 0 },
        { x: ft(10), y: ft(10) },
        { x: 0, y: ft(10) }
      ],
      viewportScale: 1
    };
    const action = handleDrawingClick({ x: 2, y: 2 }, state, testConfig);
    expect(action.type).toBe(ActionType.CLOSE_SHAPE);
    expect(action.closedPoints).toBeTruthy();
    expect(action.simplifiedPoints).toBeTruthy();
  });

  it('should return NONE for duplicate point', () => {
    const state = { points: [{ x: 0, y: 0 }, { x: ft(10), y: 0 }], viewportScale: 1 };
    const action = handleDrawingClick({ x: ft(10), y: 0 }, state, testConfig);
    expect(action.type).toBe(ActionType.NONE);
  });
});

// ============================================================================
// handleWallSelectClick
// ============================================================================

describe('handleWallSelectClick', () => {
  it('should return SELECT_WALL for unselected wall', () => {
    const state = { selectedWallIndices: [] };
    const action = handleWallSelectClick(0, state);
    expect(action.type).toBe(ActionType.SELECT_WALL);
    expect(action.wallIndex).toBe(0);
  });

  it('should return DESELECT_WALL for already selected wall', () => {
    const state = { selectedWallIndices: [0, 2] };
    const action = handleWallSelectClick(0, state);
    expect(action.type).toBe(ActionType.DESELECT_WALL);
    expect(action.wallIndex).toBe(0);
  });

  it('should return NONE when no wall clicked', () => {
    const action = handleWallSelectClick(-1, {});
    expect(action.type).toBe(ActionType.NONE);
  });
});

// ============================================================================
// handleEditingClick
// ============================================================================

describe('handleEditingClick', () => {
  it('should return REMOVE_VERTEX for delete icon hover', () => {
    const state = { hoveredIconType: 'delete', hoveredVertexIndex: 2, hoveredEdgeIndex: -1 };
    const action = handleEditingClick({ x: 0, y: 0 }, state, testConfig);
    expect(action.type).toBe(ActionType.REMOVE_VERTEX);
    expect(action.vertexIndex).toBe(2);
  });

  it('should return ADD_VERTEX for add icon hover', () => {
    const state = { hoveredIconType: 'add', hoveredVertexIndex: -1, hoveredEdgeIndex: 1 };
    const action = handleEditingClick({ x: 50, y: 50 }, state, testConfig);
    expect(action.type).toBe(ActionType.ADD_VERTEX);
    expect(action.edgeIndex).toBe(1);
  });

  it('should return NONE when no icon hovered', () => {
    const state = { hoveredIconType: null, hoveredVertexIndex: -1, hoveredEdgeIndex: -1 };
    const action = handleEditingClick({ x: 0, y: 0 }, state, testConfig);
    expect(action.type).toBe(ActionType.NONE);
  });
});

// ============================================================================
// handleClick (main dispatcher)
// ============================================================================

describe('handleClick', () => {
  it('should delegate to measure mode', () => {
    const state = { isMeasureMode: true, decking: null, stairPlacementMode: false,
      isShapeClosed: false, shapeEditMode: false, wallSelectionMode: false,
      structuralComponents: null, isDrawing: false, points: [] };
    const action = handleClick({ x: 50, y: 50 }, state, testConfig);
    expect(action.type).toBe(ActionType.DELEGATE_MEASURE);
  });

  it('should delegate to stair placement', () => {
    const state = { isMeasureMode: false, decking: null, stairPlacementMode: true,
      isShapeClosed: false, shapeEditMode: false, wallSelectionMode: false,
      structuralComponents: null, isDrawing: false, points: [] };
    const action = handleClick({ x: 50, y: 50 }, state, testConfig);
    expect(action.type).toBe(ActionType.DELEGATE_STAIR);
  });

  it('should return ADD_POINT in IDLE state', () => {
    const state = { isMeasureMode: false, decking: null, stairPlacementMode: false,
      isShapeClosed: false, shapeEditMode: false, wallSelectionMode: false,
      structuralComponents: null, isDrawing: false, points: [] };
    const action = handleClick({ x: 25, y: 25 }, state, testConfig);
    expect(action.type).toBe(ActionType.ADD_POINT);
  });
});
