// drawingStateMachine.js - Deterministic state machine for canvas click handling
// All state handlers are pure functions: they receive state and return action objects.
// State mutation happens only in app.js via applyDrawingAction().

import { validateShape } from './shapeValidator.js';
import { simplifyPoints, distance } from './utils.js';
import {
  PIXELS_PER_FOOT, GRID_SPACING_PIXELS, SNAP_TOLERANCE_PIXELS,
  EPSILON, MODEL_WIDTH_FEET, MODEL_HEIGHT_FEET
} from './config.js';

// ============================================================================
// STATE ENUM
// ============================================================================

export const DrawingState = Object.freeze({
  IDLE:           'IDLE',
  DRAWING:        'DRAWING',
  SHAPE_CLOSED:   'SHAPE_CLOSED',
  WALL_SELECT:    'WALL_SELECT',
  CALCULATED:     'CALCULATED',
  EDITING:        'EDITING',
  STAIR_PLACE:    'STAIR_PLACE',
  MEASURING:      'MEASURING',
  BREAKER_PLACE:  'BREAKER_PLACE',
});

// ============================================================================
// ACTION TYPES
// ============================================================================

export const ActionType = Object.freeze({
  NONE:                 'NONE',
  ADD_POINT:            'ADD_POINT',
  CLOSE_SHAPE:          'CLOSE_SHAPE',
  CLOSE_SHAPE_FAILED:   'CLOSE_SHAPE_FAILED',
  OUT_OF_BOUNDS:        'OUT_OF_BOUNDS',
  SELECT_WALL:          'SELECT_WALL',
  DESELECT_WALL:        'DESELECT_WALL',
  REMOVE_VERTEX:        'REMOVE_VERTEX',
  ADD_VERTEX:           'ADD_VERTEX',
  DELEGATE_MEASURE:     'DELEGATE_MEASURE',
  DELEGATE_STAIR:       'DELEGATE_STAIR',
  DELEGATE_BREAKER:     'DELEGATE_BREAKER',
});

// ============================================================================
// STATE DETERMINATION
// ============================================================================

/**
 * Derives the current drawing state from appState boolean flags.
 * Priority order matches the existing if/else chain in handleCanvasClick.
 * Pure function — reads only.
 */
export function getCurrentState(appState) {
  if (appState.isMeasureMode) return DrawingState.MEASURING;

  if (appState.decking && appState.decking.breakerPlacementMode)
    return DrawingState.BREAKER_PLACE;

  if (appState.stairPlacementMode) return DrawingState.STAIR_PLACE;

  if (appState.isShapeClosed && appState.shapeEditMode)
    return DrawingState.EDITING;

  if (appState.isShapeClosed && appState.wallSelectionMode && !appState.shapeEditMode)
    return DrawingState.WALL_SELECT;

  if (appState.isShapeClosed && appState.structuralComponents && !appState.structuralComponents.error)
    return DrawingState.CALCULATED;

  if (appState.isShapeClosed) return DrawingState.SHAPE_CLOSED;

  if (appState.isDrawing || (appState.points && appState.points.length > 0))
    return DrawingState.DRAWING;

  return DrawingState.IDLE;
}

// ============================================================================
// SNAPPING PIPELINE
// ============================================================================

/**
 * Snaps coordinates to the nearest grid point.
 */
export function snapToGrid(x, y, gridSize) {
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize
  };
}

/** Standard allowed snap angles in degrees */
const ALLOWED_ANGLES = [0, 45, 90, 135, 180, -45, -90, -135, -180];

/**
 * Snaps a position to the nearest allowed angle relative to a previous point,
 * then re-snaps to grid while preserving the angle constraint.
 */
export function snapToAngle(pos, prevPoint, allowedAngles, gridSize) {
  const dx = pos.x - prevPoint.x;
  const dy = pos.y - prevPoint.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist <= 5) return pos;

  const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);

  let nearestAngle = 0;
  let minDiff = Infinity;
  for (const snap of allowedAngles) {
    let diff = Math.abs(angleDeg - snap);
    if (diff > 180) diff = 360 - diff;
    if (diff < minDiff) { minDiff = diff; nearestAngle = snap; }
  }

  const snappedAngleRad = nearestAngle * (Math.PI / 180);
  let snappedX = prevPoint.x + dist * Math.cos(snappedAngleRad);
  let snappedY = prevPoint.y + dist * Math.sin(snappedAngleRad);

  const absAngle = Math.abs(nearestAngle);
  if (absAngle === 0 || absAngle === 180) {
    // Horizontal: lock Y to previous, snap X to grid
    snappedX = Math.round(snappedX / gridSize) * gridSize;
    snappedY = prevPoint.y;
  } else if (absAngle === 90) {
    // Vertical: lock X to previous, snap Y to grid
    snappedX = prevPoint.x;
    snappedY = Math.round(snappedY / gridSize) * gridSize;
  } else {
    // 45/135 degree: snap X to grid, derive Y to maintain |dx| = |dy|
    snappedX = Math.round(snappedX / gridSize) * gridSize;
    const gridDx = snappedX - prevPoint.x;
    snappedY = prevPoint.y + Math.abs(gridDx) * Math.sign(snappedY - prevPoint.y);
  }

  return { x: snappedX, y: snappedY };
}

/**
 * Detects whether a click is close enough to the first point to close the shape.
 */
export function detectCloseClick(pos, firstPoint, tolerance) {
  return distance(pos, firstPoint) < tolerance;
}

/**
 * Composed snapping pipeline for a drawing click.
 * Close-detection runs FIRST (before angle snapping can push away from first point).
 */
export function getSnappedPosition(rawModelPos, points, configObj, viewportScale) {
  if (!points || points.length === 0) {
    return { ...snapToGrid(rawModelPos.x, rawModelPos.y, configObj.PIXELS_PER_FOOT), isClosingClick: false };
  }

  const closeTolerance = (configObj.SNAP_TOLERANCE_PIXELS / (viewportScale || 1)) * 3;
  if (points.length >= 3 && detectCloseClick(rawModelPos, points[0], closeTolerance)) {
    return { x: points[0].x, y: points[0].y, isClosingClick: true };
  }

  const gridSnapped = snapToGrid(rawModelPos.x, rawModelPos.y, configObj.GRID_SPACING_PIXELS);
  const angleSnapped = snapToAngle(gridSnapped, points[points.length - 1], ALLOWED_ANGLES, configObj.GRID_SPACING_PIXELS);
  return { x: angleSnapped.x, y: angleSnapped.y, isClosingClick: false };
}

// ============================================================================
// tryCloseShape — CRITICAL PURE FUNCTION
// ============================================================================

/**
 * Attempts to close a shape from the current points.
 * Does NOT mutate the input.
 *
 * @param {Array<{x,y}>} points - Current drawing points (no closing point yet)
 * @param {Object} configObj - Config constants object or module
 * @returns {{ success: boolean, closedPoints: Array|null, cornerAdded: boolean,
 *             simplifiedPoints: Array|null, error: string|null }}
 */
export function tryCloseShape(points, configObj) {
  if (!points || points.length < 3) {
    return { success: false, closedPoints: null, cornerAdded: false, simplifiedPoints: null, error: 'Need at least 3 points' };
  }

  const PPF = configObj.PIXELS_PER_FOOT || PIXELS_PER_FOOT;
  const EPS = configObj.EPSILON || EPSILON;
  const minSegmentPixels = 0.25 * PPF; // 3 inches

  // Step 1: Deep copy
  let tempPoints = points.map(p => ({ ...p }));

  // Step 2: Auto-correct small misalignments on last point
  const startPoint = tempPoints[0];
  const lastIdx = tempPoints.length - 1;
  let lastPoint = tempPoints[lastIdx];

  let dx = Math.abs(lastPoint.x - startPoint.x);
  let dy = Math.abs(lastPoint.y - startPoint.y);

  if (dx > EPS && dx < minSegmentPixels) {
    tempPoints[lastIdx] = { ...lastPoint, x: startPoint.x };
    dx = 0;
  }
  lastPoint = tempPoints[lastIdx];
  if (dy > EPS && dy < minSegmentPixels) {
    tempPoints[lastIdx] = { ...lastPoint, y: startPoint.y };
    dy = 0;
  }

  // Step 3: Add corner point if needed for 90-degree closure
  let cornerAdded = false;
  const updatedLast = tempPoints[tempPoints.length - 1];
  dx = Math.abs(updatedLast.x - startPoint.x);
  dy = Math.abs(updatedLast.y - startPoint.y);

  if (dx > EPS && dy > EPS) {
    const cornerOption1 = { x: startPoint.x, y: updatedLast.y };
    const cornerOption2 = { x: updatedLast.x, y: startPoint.y };

    const option1Exists = tempPoints.some(p =>
      Math.abs(p.x - cornerOption1.x) < EPS && Math.abs(p.y - cornerOption1.y) < EPS
    );
    const option2Exists = tempPoints.some(p =>
      Math.abs(p.x - cornerOption2.x) < EPS && Math.abs(p.y - cornerOption2.y) < EPS
    );

    let cornerPoint = null;
    if (option1Exists && !option2Exists) cornerPoint = cornerOption2;
    else if (option2Exists && !option1Exists) cornerPoint = cornerOption1;
    else if (!option1Exists && !option2Exists) cornerPoint = dx < dy ? cornerOption1 : cornerOption2;

    if (cornerPoint) {
      tempPoints.push(cornerPoint);
      cornerAdded = true;
    }
  }

  // Step 4: Add closing point
  tempPoints.push({ ...tempPoints[0] });

  // Step 5: Validate
  const validation = validateShape(tempPoints);
  if (!validation.isValid) {
    return { success: false, closedPoints: null, cornerAdded: false, simplifiedPoints: null, error: validation.error };
  }

  // Step 6: Simplify
  const hasManualDimensions = tempPoints.some(p => p.isManualDimension === true);
  const simplifiedPoints = hasManualDimensions ? [...tempPoints] : simplifyPoints(tempPoints);

  return {
    success: true,
    closedPoints: tempPoints,
    cornerAdded,
    simplifiedPoints,
    error: null
  };
}

// ============================================================================
// BOUNDS CHECK
// ============================================================================

function isWithinBounds(pos, configObj) {
  const limitX = (configObj.MODEL_WIDTH_FEET || MODEL_WIDTH_FEET) * (configObj.PIXELS_PER_FOOT || PIXELS_PER_FOOT);
  const limitY = (configObj.MODEL_HEIGHT_FEET || MODEL_HEIGHT_FEET) * (configObj.PIXELS_PER_FOOT || PIXELS_PER_FOOT);
  return pos.x >= 0 && pos.x <= limitX && pos.y >= 0 && pos.y <= limitY;
}

// ============================================================================
// STATE HANDLERS (Pure Functions)
// ============================================================================

export function handleIdleClick(pos, appState, configObj) {
  const snapped = snapToGrid(pos.x, pos.y, configObj.PIXELS_PER_FOOT || PIXELS_PER_FOOT);
  if (!isWithinBounds(snapped, configObj)) {
    return { type: ActionType.OUT_OF_BOUNDS, message: 'Cannot draw outside the designated area.' };
  }
  return { type: ActionType.ADD_POINT, point: snapped };
}

export function handleDrawingClick(pos, appState, configObj) {
  const points = appState.points;
  const snapped = getSnappedPosition(pos, points, configObj, appState.viewportScale);

  if (snapped.isClosingClick) {
    const closeResult = tryCloseShape(points, configObj);
    if (closeResult.success) {
      return {
        type: ActionType.CLOSE_SHAPE,
        closedPoints: closeResult.closedPoints,
        cornerAdded: closeResult.cornerAdded,
        simplifiedPoints: closeResult.simplifiedPoints,
        hasManualDimensions: points.some(p => p.isManualDimension === true)
      };
    } else {
      return { type: ActionType.CLOSE_SHAPE_FAILED, error: closeResult.error };
    }
  }

  if (!isWithinBounds(snapped, configObj)) {
    return { type: ActionType.OUT_OF_BOUNDS, message: 'Cannot draw outside the designated area (100ft x 100ft).' };
  }

  const EPS = configObj.EPSILON || EPSILON;
  if (points.length > 0 && distance(snapped, points[points.length - 1]) <= EPS) {
    return { type: ActionType.NONE };
  }

  return { type: ActionType.ADD_POINT, point: { x: snapped.x, y: snapped.y } };
}

/**
 * Wall selection handler. Receives pre-computed clickedWallIndex from caller
 * (caller uses canvasLogic.findClickedWallIndex which is DOM-dependent).
 */
export function handleWallSelectClick(clickedWallIndex, appState) {
  if (clickedWallIndex === -1) return { type: ActionType.NONE };

  const currentIdx = appState.selectedWallIndices.indexOf(clickedWallIndex);
  if (currentIdx === -1) {
    return { type: ActionType.SELECT_WALL, wallIndex: clickedWallIndex };
  } else {
    return { type: ActionType.DESELECT_WALL, wallIndex: clickedWallIndex };
  }
}

export function handleEditingClick(pos, appState, configObj) {
  if (appState.hoveredIconType === 'delete' && appState.hoveredVertexIndex >= 0) {
    return { type: ActionType.REMOVE_VERTEX, vertexIndex: appState.hoveredVertexIndex };
  }
  if (appState.hoveredIconType === 'add' && appState.hoveredEdgeIndex >= 0) {
    return { type: ActionType.ADD_VERTEX, edgeIndex: appState.hoveredEdgeIndex, position: pos };
  }
  return { type: ActionType.NONE };
}

export function handleClosedShapeClick(pos, appState, configObj) {
  if (appState.stairs && appState.stairs.length > 0) {
    return { type: ActionType.NONE, _delegateStairSelect: true, position: pos };
  }
  return { type: ActionType.NONE, _delegateWallReenter: true, position: pos };
}

// ============================================================================
// MAIN DISPATCHER
// ============================================================================

/**
 * Main click dispatcher. Returns an action object.
 * Does NOT mutate appState.
 */
export function handleClick(modelMousePos, appState, configObj) {
  const state = getCurrentState(appState);

  switch (state) {
    case DrawingState.MEASURING:
      return { type: ActionType.DELEGATE_MEASURE, position: modelMousePos };

    case DrawingState.BREAKER_PLACE:
      return { type: ActionType.DELEGATE_BREAKER, position: modelMousePos };

    case DrawingState.STAIR_PLACE:
      return { type: ActionType.DELEGATE_STAIR, position: modelMousePos };

    case DrawingState.EDITING:
      return handleEditingClick(modelMousePos, appState, configObj);

    case DrawingState.WALL_SELECT:
      // Wall select is handled by caller with pre-computed wall index.
      // This path shouldn't be reached if caller handles WALL_SELECT separately.
      return { type: ActionType.NONE };

    case DrawingState.SHAPE_CLOSED:
    case DrawingState.CALCULATED:
      return handleClosedShapeClick(modelMousePos, appState, configObj);

    case DrawingState.DRAWING:
      return handleDrawingClick(modelMousePos, appState, configObj);

    case DrawingState.IDLE:
      return handleIdleClick(modelMousePos, appState, configObj);

    default:
      return { type: ActionType.NONE };
  }
}
