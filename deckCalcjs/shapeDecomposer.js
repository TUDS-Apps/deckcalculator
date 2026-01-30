// shapeDecomposer.js - Recursive rectangle decomposition for complex rectilinear shapes
// Decomposes any rectilinear polygon into non-overlapping rectangles using recursive splitting

import { EPSILON } from "./config.js";
import { distance } from "./utils.js";

/**
 * Decomposes a rectilinear polygon into rectangular sections using recursive splitting
 * @param {Array<{x: number, y: number}>} points - Array of points defining the shape (including closing point)
 * @param {number|Array<number>} ledgerWallIndex - Index or array of indices of walls that will have ledger attachment
 * @returns {Array<Object>} Array of rectangle objects
 */
export function decomposeShape(points, ledgerWallIndex) {
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

  // Handle both single index and array of indices
  const ledgerWallIndices = Array.isArray(ledgerWallIndex) ? ledgerWallIndex : [ledgerWallIndex];
  const primaryLedgerIndex = ledgerWallIndices[0]; // Use first wall for decomposition algorithm

  // Get all original ledger walls before decomposition
  const originalLedgerWalls = ledgerWallIndices.map(index => ({
    index: index,
    p1: points[index],
    p2: points[(index + 1) % points.length]
  }));

  // Use ledger projection decomposition algorithm with primary ledger wall
  const rawRectangles = recursivelyDecompose(shapePoints, primaryLedgerIndex);
  
  // Process the raw rectangles into the final format with all ledger walls
  const rectangles = processRawRectangles(rawRectangles, originalLedgerWalls);
  
  return rectangles;
}

/**
 * General greedy rectangle merging algorithm.
 * Phase 1: Create strips by merging contiguous cells along the primary axis.
 * Phase 2: Merge adjacent strips with identical secondary-axis spans.
 */
function greedyMerge(insideCells, xCoords, yCoords, mergeVerticalFirst) {
  if (insideCells.length === 0) return [];
  if (insideCells.length === 1) return [insideCells[0]];

  // Build a lookup: grid[col][row] = cell or null
  const maxCol = xCoords.length - 1;
  const maxRow = yCoords.length - 1;
  const grid = Array.from({ length: maxCol }, () => Array(maxRow).fill(null));
  for (const cell of insideCells) {
    grid[cell.col][cell.row] = cell;
  }

  const strips = [];

  if (mergeVerticalFirst) {
    // Phase 1: For each column, merge contiguous vertical runs
    for (let col = 0; col < maxCol; col++) {
      let runStart = null;
      for (let row = 0; row <= maxRow; row++) {
        if (row < maxRow && grid[col][row]) {
          if (runStart === null) runStart = row;
        } else {
          if (runStart !== null) {
            strips.push({
              x: xCoords[col],
              y: yCoords[runStart],
              width: xCoords[col + 1] - xCoords[col],
              height: yCoords[row] - yCoords[runStart],
              colStart: col, colEnd: col,
              rowStart: runStart, rowEnd: row - 1
            });
            runStart = null;
          }
        }
      }
    }

    // Phase 2: Merge horizontally adjacent strips with identical rowStart and rowEnd
    return mergeStrips(strips, 'horizontal');
  } else {
    // Phase 1: For each row, merge contiguous horizontal runs
    for (let row = 0; row < maxRow; row++) {
      let runStart = null;
      for (let col = 0; col <= maxCol; col++) {
        if (col < maxCol && grid[col][row]) {
          if (runStart === null) runStart = col;
        } else {
          if (runStart !== null) {
            strips.push({
              x: xCoords[runStart],
              y: yCoords[row],
              width: xCoords[col] - xCoords[runStart],
              height: yCoords[row + 1] - yCoords[row],
              colStart: runStart, colEnd: col - 1,
              rowStart: row, rowEnd: row
            });
            runStart = null;
          }
        }
      }
    }

    // Phase 2: Merge vertically adjacent strips with identical colStart and colEnd
    return mergeStrips(strips, 'vertical');
  }
}

/**
 * Merges adjacent strips that share the same span on the secondary axis.
 */
function mergeStrips(strips, direction) {
  if (strips.length <= 1) return strips;

  // Sort strips for merge order
  if (direction === 'horizontal') {
    strips.sort((a, b) => a.rowStart - b.rowStart || a.colStart - b.colStart);
  } else {
    strips.sort((a, b) => a.colStart - b.colStart || a.rowStart - b.rowStart);
  }

  const merged = [strips[0]];

  for (let i = 1; i < strips.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = strips[i];

    if (direction === 'horizontal') {
      // Merge if same row span and horizontally adjacent
      if (curr.rowStart === prev.rowStart && curr.rowEnd === prev.rowEnd &&
          Math.abs(curr.x - (prev.x + prev.width)) < EPSILON) {
        prev.width = (curr.x + curr.width) - prev.x;
        prev.colEnd = curr.colEnd;
        continue;
      }
    } else {
      // Merge if same column span and vertically adjacent
      if (curr.colStart === prev.colStart && curr.colEnd === prev.colEnd &&
          Math.abs(curr.y - (prev.y + prev.height)) < EPSILON) {
        prev.height = (curr.y + curr.height) - prev.y;
        prev.rowEnd = curr.rowEnd;
        continue;
      }
    }

    merged.push(curr);
  }

  // Clean up: remove grid metadata, keep only x, y, width, height
  return merged.map(r => ({ x: r.x, y: r.y, width: r.width, height: r.height }));
}

/**
 * Decomposes a polygon into non-overlapping rectangles using grid-based sweep line algorithm
 * @param {Array<{x: number, y: number}>} points - Array of polygon corner points
 * @param {number} wallIndex - Index of which edge is the ledger (0-based)
 * @returns {Array<{x: number, y: number, width: number, height: number}>} Array of rectangle objects
 */
function decomposePolygonIntoRectangles(points, wallIndex) {
  // Remove duplicate closing point if present
  let workingPoints = points;
  if (points.length > 3) {
    const first = points[0];
    const last = points[points.length - 1];
    if (Math.abs(first.x - last.x) < EPSILON && Math.abs(first.y - last.y) < EPSILON) {
      workingPoints = points.slice(0, -1);
    }
  }

  // NOTE: Shapes with diagonal edges are now handled through grid decomposition.
  // The grid is created from vertex coordinates, and cells are tested for inclusion
  // in the actual polygon (respecting diagonal edges). Structural calculations
  // handle diagonal edge trimming for joists, rim joists, and beams.
  // This allows proper L-shape decomposition even when diagonal corners exist.
  const hasDiagonal = hasDiagonalEdge(workingPoints);


  // Step 1: Find all unique X and Y coordinates to create a grid
  const xCoords = [...new Set(workingPoints.map(p => p.x))].sort((a, b) => a - b);
  const yCoords = [...new Set(workingPoints.map(p => p.y))].sort((a, b) => a - b);

  // Step 2: Create grid cells and test which ones are inside the polygon
  const insideCells = [];
  
  for (let i = 0; i < xCoords.length - 1; i++) {
    for (let j = 0; j < yCoords.length - 1; j++) {
      const x = xCoords[i];
      const y = yCoords[j];
      const width = xCoords[i + 1] - x;
      const height = yCoords[j + 1] - y;
      
      // Test center point of cell
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      
      if (isPointInsidePolygon({ x: centerX, y: centerY }, workingPoints)) {
        insideCells.push({ x, y, width, height, col: i, row: j });
      }
    }
  }
  
  // Determine merge direction from ledger wall
  const ledgerStart = workingPoints[wallIndex % workingPoints.length];
  const ledgerEnd = workingPoints[(wallIndex + 1) % workingPoints.length];
  const isLedgerHorizontal = Math.abs(ledgerStart.y - ledgerEnd.y) < EPSILON;

  // General greedy merge
  const mergedRectangles = greedyMerge(insideCells, xCoords, yCoords, isLedgerHorizontal);
  return mergedRectangles;
}

/**
 * Merges adjacent rectangles to minimize the total number of rectangles
 * @param {Array<{x: number, y: number, width: number, height: number}>} rectangles - Array of rectangles
 * @returns {Array<{x: number, y: number, width: number, height: number}>} Merged rectangles
 */
function mergeAdjacentRectangles(rectangles) {
  if (rectangles.length <= 1) return rectangles;

  let merged = [...rectangles];
  let changed = true;

  while (changed) {
    changed = false;
    const newMerged = [];

    for (let i = 0; i < merged.length; i++) {
      const rect1 = merged[i];
      let wasMerged = false;

      // Try to merge with any rectangle that comes after this one
      for (let j = i + 1; j < merged.length; j++) {
        const rect2 = merged[j];
        const mergedRect = tryMergeRectangles(rect1, rect2);

        if (mergedRect) {
          // Successfully merged - add the merged rectangle
          newMerged.push(mergedRect);
          
          // Add all remaining rectangles except the two we just merged
          for (let k = 0; k < merged.length; k++) {
            if (k !== i && k !== j) {
              newMerged.push(merged[k]);
            }
          }
          
          wasMerged = true;
          changed = true;
          break;
        }
      }

      if (!wasMerged && newMerged.indexOf(rect1) === -1) {
        newMerged.push(rect1);
      }

      if (changed) break; // Start over with the new merged list
    }

    merged = newMerged;
  }

  return merged;
}

/**
 * Attempts to merge two rectangles if they are adjacent
 * @param {Object} rect1 - First rectangle {x, y, width, height}
 * @param {Object} rect2 - Second rectangle {x, y, width, height}  
 * @returns {Object|null} Merged rectangle or null if they can't be merged
 */
function tryMergeRectangles(rect1, rect2) {
  // Check if rectangles can be merged horizontally (same height, adjacent horizontally)
  if (Math.abs(rect1.y - rect2.y) < EPSILON && 
      Math.abs(rect1.height - rect2.height) < EPSILON) {
    
    // rect1 is to the left of rect2
    if (Math.abs((rect1.x + rect1.width) - rect2.x) < EPSILON) {
      return {
        x: rect1.x,
        y: rect1.y,
        width: rect1.width + rect2.width,
        height: rect1.height
      };
    }
    
    // rect2 is to the left of rect1  
    if (Math.abs((rect2.x + rect2.width) - rect1.x) < EPSILON) {
      return {
        x: rect2.x,
        y: rect1.y,
        width: rect1.width + rect2.width,
        height: rect1.height
      };
    }
  }

  // Check if rectangles can be merged vertically (same width, adjacent vertically)
  if (Math.abs(rect1.x - rect2.x) < EPSILON && 
      Math.abs(rect1.width - rect2.width) < EPSILON) {
    
    // rect1 is above rect2
    if (Math.abs((rect1.y + rect1.height) - rect2.y) < EPSILON) {
      return {
        x: rect1.x,
        y: rect1.y,
        width: rect1.width,
        height: rect1.height + rect2.height
      };
    }
    
    // rect2 is above rect1
    if (Math.abs((rect2.y + rect2.height) - rect1.y) < EPSILON) {
      return {
        x: rect1.x,
        y: rect2.y,
        width: rect1.width,
        height: rect1.height + rect2.height
      };
    }
  }

  return null; // Cannot merge
}

/**
 * Converts rectangles from {x, y, width, height} format to corner points format
 * @param {Array<{x: number, y: number, width: number, height: number}>} rectangles
 * @returns {Array<Array<{x: number, y: number}>>} Array of rectangle corner arrays
 */
function convertRectanglesToCorners(rectangles) {
  return rectangles.map(rect => [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height }
  ]);
}

/**
 * Main decomposition function using ledger projection algorithm
 * @param {Array<{x: number, y: number}>} polygon - Array of points defining the polygon
 * @param {number} ledgerWallIndex - Index of the ledger wall
 * @returns {Array<Array<{x: number, y: number}>>} Array of rectangle corner arrays
 */
function recursivelyDecompose(polygon, ledgerWallIndex = 0) {
  // Use the ledger projection algorithm to decompose into rectangles
  const rectangles = decomposePolygonIntoRectangles(polygon, ledgerWallIndex);
  
  // Convert back to corner points format for compatibility
  return convertRectanglesToCorners(rectangles);
}

/**
 * Processes raw rectangles into the final format with IDs, adjacency, and ledger information
 * @param {Array<Array<{x: number, y: number}>>} rawRectangles - Array of rectangle corner arrays
 * @param {Array<Object>} originalLedgerWalls - Array of original ledger wall objects
 * @returns {Array<Object>} Array of formatted rectangle objects
 */
function processRawRectangles(rawRectangles, originalLedgerWalls) {
  const rectangles = [];

  // Create rectangle objects with unique IDs
  for (let i = 0; i < rawRectangles.length; i++) {
    const corners = rawRectangles[i];
    const rectId = `rect_${i}`;

    // Check if this rectangle contains part of any ledger wall
    let isLedgerRectangle = false;
    let ledgerWalls = [];

    originalLedgerWalls.forEach((originalWall, wallIndex) => {
      const ledgerInfo = findLedgerWallInRectangle(corners, originalWall);
      if (ledgerInfo.isLedgerRectangle) {
        isLedgerRectangle = true;
        ledgerWalls.push(ledgerInfo.ledgerWall);
      }
    });

    const rectangle = {
      id: rectId,
      corners: ensureClockwiseOrder(corners),
      ledgerWall: ledgerWalls.length > 0 ? ledgerWalls[0] : null, // Keep first for backward compatibility
      ledgerWalls: ledgerWalls, // All ledger walls in this rectangle
      isLedgerRectangle: isLedgerRectangle,
      adjacentRectangles: [], // Will be populated below
      sharedEdges: [] // Will be populated below
    };

    rectangles.push(rectangle);
  }

  // Calculate adjacency information
  calculateAdjacencyInformation(rectangles);

  return rectangles;
}

/**
 * Determines if a rectangle contains part of the original ledger wall
 * @param {Array<{x: number, y: number}>} corners - Rectangle corners
 * @param {Object} originalLedgerWall - Original ledger wall object
 * @returns {Object} Object with ledgerWall and isLedgerRectangle properties
 */
function findLedgerWallInRectangle(corners, originalLedgerWall) {
  const bounds = getPolygonBounds(corners);
  const ledgerStart = originalLedgerWall.p1;
  const ledgerEnd = originalLedgerWall.p2;

  // Check if the ledger wall segment intersects with any edge of the rectangle
  for (let i = 0; i < corners.length; i++) {
    const edgeStart = corners[i];
    const edgeEnd = corners[(i + 1) % corners.length];
    
    // Check if the ledger wall overlaps with this edge
    const overlap = findLineSegmentOverlap(ledgerStart, ledgerEnd, edgeStart, edgeEnd);
    
    if (overlap) {
      // Calculate the actual length of the overlapping segment
      return {
        ledgerWall: overlap,
        isLedgerRectangle: true
      };
    }
  }

  // Enhanced detection for L-shaped decks: Check if this rectangle should be part of 
  // a continuous ledger structure
  const ledgerDirection = {
    x: ledgerEnd.x - ledgerStart.x,
    y: ledgerEnd.y - ledgerStart.y
  };
  
  const isLedgerHorizontal = Math.abs(ledgerDirection.x) > Math.abs(ledgerDirection.y);

  // For L-shaped decks, check if this rectangle is collinear with the ledger
  // and should be considered part of the continuous ledger structure
  if (isLedgerHorizontal) {
    // For horizontal ledgers, check if rectangle has an edge at the same Y coordinate
    const ledgerY = ledgerStart.y;
    const tolerance = 2.0; // 2 pixel tolerance
    
    for (let i = 0; i < corners.length; i++) {
      const edgeStart = corners[i];
      const edgeEnd = corners[(i + 1) % corners.length];
      
      // Check if this is a horizontal edge at the ledger's Y coordinate
      if (Math.abs(edgeStart.y - edgeEnd.y) < EPSILON && 
          Math.abs(edgeStart.y - ledgerY) < tolerance) {
        
        // Check if this edge could be a continuation of the ledger
        const edgeMinX = Math.min(edgeStart.x, edgeEnd.x);
        const edgeMaxX = Math.max(edgeStart.x, edgeEnd.x);
        const ledgerMinX = Math.min(ledgerStart.x, ledgerEnd.x);
        const ledgerMaxX = Math.max(ledgerStart.x, ledgerEnd.x);
        
        // Check if edges are adjacent or overlapping (could be continuous ledger)
        const gap = Math.min(Math.abs(edgeMinX - ledgerMaxX), Math.abs(ledgerMinX - edgeMaxX));
        
        if (gap < tolerance || (edgeMaxX >= ledgerMinX && edgeMinX <= ledgerMaxX)) {
          return {
            ledgerWall: {
              p1: edgeStart,
              p2: edgeEnd
            },
            isLedgerRectangle: true
          };
        }
      }
    }
  } else {
    // For vertical ledgers, check if rectangle has an edge at the same X coordinate
    const ledgerX = ledgerStart.x;
    const tolerance = 2.0; // 2 pixel tolerance
    
    for (let i = 0; i < corners.length; i++) {
      const edgeStart = corners[i];
      const edgeEnd = corners[(i + 1) % corners.length];
      
      // Check if this is a vertical edge at the ledger's X coordinate
      if (Math.abs(edgeStart.x - edgeEnd.x) < EPSILON && 
          Math.abs(edgeStart.x - ledgerX) < tolerance) {
        
        // Check if this edge could be a continuation of the ledger
        const edgeMinY = Math.min(edgeStart.y, edgeEnd.y);
        const edgeMaxY = Math.max(edgeStart.y, edgeEnd.y);
        const ledgerMinY = Math.min(ledgerStart.y, ledgerEnd.y);
        const ledgerMaxY = Math.max(ledgerStart.y, ledgerEnd.y);
        
        // Check if edges are adjacent or overlapping (could be continuous ledger)
        const gap = Math.min(Math.abs(edgeMinY - ledgerMaxY), Math.abs(ledgerMinY - edgeMaxY));
        
        if (gap < tolerance || (edgeMaxY >= ledgerMinY && edgeMinY <= ledgerMaxY)) {
          return {
            ledgerWall: {
              p1: edgeStart,
              p2: edgeEnd
            },
            isLedgerRectangle: true
          };
        }
      }
    }
  }
  
  // Legacy check for adjacent rectangles (keeping for compatibility)
  for (const corner of corners) {
    const distanceToLedgerLine = distanceFromPointToLine(corner, ledgerStart, ledgerEnd);
    
    if (distanceToLedgerLine < 1.0) { // Within 1 pixel tolerance
      // Check if this corner is along the extension of the ledger
      const isAlongLedgerExtension = isPointAlongLineExtension(corner, ledgerStart, ledgerEnd);
      
      if (isAlongLedgerExtension) {
        // Create a virtual ledger segment for this rectangle along the adjacent edge
        const adjacentEdge = findAdjacentEdgeToLedger(corners, ledgerStart, ledgerEnd);
        
        if (adjacentEdge) {
          return {
            ledgerWall: adjacentEdge,
            isLedgerRectangle: true
          };
        }
      }
    }
  }

  return {
    ledgerWall: null,
    isLedgerRectangle: false
  };
}

/**
 * Finds the overlap between two line segments
 * @param {Object} line1Start - Start of first line segment
 * @param {Object} line1End - End of first line segment
 * @param {Object} line2Start - Start of second line segment  
 * @param {Object} line2End - End of second line segment
 * @returns {Object|null} Overlap segment or null if no overlap
 */
function findLineSegmentOverlap(line1Start, line1End, line2Start, line2End) {
  // Check if lines are collinear
  const crossProduct1 = (line1End.x - line1Start.x) * (line2Start.y - line1Start.y) - 
                       (line1End.y - line1Start.y) * (line2Start.x - line1Start.x);
  const crossProduct2 = (line1End.x - line1Start.x) * (line2End.y - line1Start.y) - 
                       (line1End.y - line1Start.y) * (line2End.x - line1Start.x);

  if (Math.abs(crossProduct1) > EPSILON || Math.abs(crossProduct2) > EPSILON) {
    return null; // Not collinear
  }

  // Find overlap for collinear segments
  let overlap = null;
  
  // Check if segments are horizontal
  if (Math.abs(line1Start.y - line1End.y) < EPSILON) {
    const minX1 = Math.min(line1Start.x, line1End.x);
    const maxX1 = Math.max(line1Start.x, line1End.x);
    const minX2 = Math.min(line2Start.x, line2End.x);
    const maxX2 = Math.max(line2Start.x, line2End.x);
    
    const overlapStart = Math.max(minX1, minX2);
    const overlapEnd = Math.min(maxX1, maxX2);
    
    if (overlapStart <= overlapEnd) {
      overlap = {
        p1: { x: overlapStart, y: line1Start.y },
        p2: { x: overlapEnd, y: line1Start.y }
      };
    }
  } else {
    // Vertical segments
    const minY1 = Math.min(line1Start.y, line1End.y);
    const maxY1 = Math.max(line1Start.y, line1End.y);
    const minY2 = Math.min(line2Start.y, line2End.y);
    const maxY2 = Math.max(line2Start.y, line2End.y);
    
    const overlapStart = Math.max(minY1, minY2);
    const overlapEnd = Math.min(maxY1, maxY2);
    
    if (overlapStart <= overlapEnd) {
      overlap = {
        p1: { x: line1Start.x, y: overlapStart },
        p2: { x: line1Start.x, y: overlapEnd }
      };
    }
  }

  return overlap;
}

/**
 * Ensures rectangle corners are in clockwise order
 * @param {Array<{x: number, y: number}>} corners - Rectangle corners
 * @returns {Array<{x: number, y: number}>} Corners in clockwise order
 */
function ensureClockwiseOrder(corners) {
  // Calculate signed area to determine orientation
  let signedArea = 0;
  for (let i = 0; i < corners.length; i++) {
    const curr = corners[i];
    const next = corners[(i + 1) % corners.length];
    signedArea += (next.x - curr.x) * (next.y + curr.y);
  }
  
  // If signed area is negative, corners are counter-clockwise, so reverse them
  return signedArea < 0 ? [...corners].reverse() : [...corners];
}

/**
 * Calculates adjacency information between rectangles
 * @param {Array<Object>} rectangles - Array of rectangle objects
 */
function calculateAdjacencyInformation(rectangles) {
  for (let i = 0; i < rectangles.length; i++) {
    for (let j = i + 1; j < rectangles.length; j++) {
      const sharedEdge = findSharedEdge(rectangles[i], rectangles[j]);
      
      if (sharedEdge) {
        // Add adjacency information
        rectangles[i].adjacentRectangles.push(rectangles[j].id);
        rectangles[j].adjacentRectangles.push(rectangles[i].id);
        
        // Add shared edge information
        rectangles[i].sharedEdges.push({
          rectangleId: rectangles[j].id,
          edge: sharedEdge
        });
        rectangles[j].sharedEdges.push({
          rectangleId: rectangles[i].id,
          edge: sharedEdge
        });
      }
    }
  }
}

/**
 * Finds shared edge between two rectangles
 * @param {Object} rect1 - First rectangle
 * @param {Object} rect2 - Second rectangle
 * @returns {Object|null} Shared edge or null if no shared edge
 */
function findSharedEdge(rect1, rect2) {
  // Check each edge of rect1 against each edge of rect2
  for (let i = 0; i < rect1.corners.length; i++) {
    const edge1Start = rect1.corners[i];
    const edge1End = rect1.corners[(i + 1) % rect1.corners.length];
    
    for (let j = 0; j < rect2.corners.length; j++) {
      const edge2Start = rect2.corners[j];
      const edge2End = rect2.corners[(j + 1) % rect2.corners.length];
      
      const overlap = findLineSegmentOverlap(edge1Start, edge1End, edge2Start, edge2End);
      
      if (overlap && getLineSegmentLength(overlap.p1, overlap.p2) > EPSILON) {
        return overlap;
      }
    }
  }
  
  return null;
}

/**
 * Calculates the length of a line segment
 * @param {Object} p1 - Start point {x, y}
 * @param {Object} p2 - End point {x, y}
 * @returns {number} Length of line segment
 */
function getLineSegmentLength(p1, p2) {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

/**
 * Creates visualization data for decomposed rectangles
 * @param {Array<Object>} rectangles - Array of rectangle objects
 * @returns {Object} Visualization data with colors and shading information
 */
export function visualizeDecomposition(rectangles) {
  const colors = [
    'rgba(255,0,0,0.1)',   // Red
    'rgba(0,255,0,0.1)',   // Green
    'rgba(0,0,255,0.1)',   // Blue
    'rgba(255,255,0,0.1)', // Yellow
    'rgba(255,0,255,0.1)', // Magenta
    'rgba(0,255,255,0.1)', // Cyan
    'rgba(255,128,0,0.1)', // Orange
    'rgba(128,0,255,0.1)'  // Purple
  ];
  
  return rectangles.map((rect, index) => ({
    rectangleId: rect.id,
    corners: rect.corners,
    color: colors[index % colors.length],
    strokeColor: colors[index % colors.length].replace('0.1', '0.5'),
    isLedgerRectangle: rect.isLedgerRectangle,
    label: `R${index + 1}${rect.isLedgerRectangle ? ' (Ledger)' : ''}`
  }));
}

// Helper functions

/**
 * Checks if any edge in the polygon is a diagonal (45-degree) edge
 * @param {Array<{x: number, y: number}>} points - Array of polygon points
 * @returns {boolean} True if polygon has at least one diagonal edge
 */
function hasDiagonalEdge(points) {
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];

    const dx = Math.abs(p2.x - p1.x);
    const dy = Math.abs(p2.y - p1.y);

    // Skip zero-length edges
    if (dx < EPSILON && dy < EPSILON) continue;

    // Check if edge is neither horizontal nor vertical (i.e., it's diagonal)
    const isHorizontal = dy < EPSILON;
    const isVertical = dx < EPSILON;

    if (!isHorizontal && !isVertical) {
      // It's a diagonal edge
      return true;
    }
  }
  return false;
}

/**
 * Gets the bounding box of a polygon
 * @param {Array<{x: number, y: number}>} points - Array of points
 * @returns {Object} Bounding box with minX, maxX, minY, maxY
 */
function getPolygonBounds(points) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  points.forEach(point => {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  });
  
  return { minX, maxX, minY, maxY };
}

/**
 * Finds intersections between a line and polygon edges
 * @param {Object} lineStart - Start point of line {x, y}
 * @param {Object} lineEnd - End point of line {x, y}
 * @param {Array<{x: number, y: number}>} points - Array of polygon points
 * @returns {Array<Object>} Array of intersection points
 */
function findLinePolygonIntersections(lineStart, lineEnd, points) {
  const intersections = [];
  
  for (let i = 0; i < points.length; i++) {
    const edgeStart = points[i];
    const edgeEnd = points[(i + 1) % points.length];
    
    const intersection = findLineIntersection(lineStart, lineEnd, edgeStart, edgeEnd);
    if (intersection) {
      // Check if this intersection is already in the list (avoid duplicates)
      const isDuplicate = intersections.some(existing => 
        Math.abs(existing.x - intersection.x) < EPSILON && 
        Math.abs(existing.y - intersection.y) < EPSILON
      );
      
      if (!isDuplicate) {
        intersections.push(intersection);
      }
    }
  }
  
  return intersections;
}

/**
 * Finds intersection between two line segments
 * @param {Object} p1 - Start of first line {x, y}
 * @param {Object} p2 - End of first line {x, y}
 * @param {Object} p3 - Start of second line {x, y}
 * @param {Object} p4 - End of second line {x, y}
 * @returns {Object|null} Intersection point or null if no intersection
 */
function findLineIntersection(p1, p2, p3, p4) {
  const denominator = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
  
  if (Math.abs(denominator) < EPSILON) {
    return null; // Lines are parallel
  }
  
  const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denominator;
  const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denominator;
  
  // Check if intersection is within both line segments
  if (ua >= -EPSILON && ua <= 1 + EPSILON && ub >= -EPSILON && ub <= 1 + EPSILON) {
    return {
      x: p1.x + ua * (p2.x - p1.x),
      y: p1.y + ua * (p2.y - p1.y)
    };
  }
  
  return null;
}

/**
 * Checks if a point is inside a polygon using ray casting algorithm
 * @param {Object} point - Point to test {x, y}
 * @param {Array<{x: number, y: number}>} polygon - Polygon vertices
 * @returns {boolean} True if point is inside polygon
 */
export function isPointInsidePolygon(point, polygon) {
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    
    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

/**
 * Calculates the distance from a point to a line
 * @param {Object} point - Point {x, y}
 * @param {Object} lineStart - Start of line {x, y}
 * @param {Object} lineEnd - End of line {x, y}
 * @returns {number} Distance from point to line
 */
function distanceFromPointToLine(point, lineStart, lineEnd) {
  const A = lineEnd.x - lineStart.x;
  const B = lineEnd.y - lineStart.y;
  const C = lineStart.x - point.x;
  const D = lineStart.y - point.y;
  
  const dot = A * C + B * D;
  const lenSq = A * A + B * B;
  
  if (lenSq === 0) {
    // Line is actually a point
    return Math.sqrt(C * C + D * D);
  }
  
  const param = -dot / lenSq;
  
  let xx, yy;
  
  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * A;
    yy = lineStart.y + param * B;
  }
  
  const dx = point.x - xx;
  const dy = point.y - yy;
  
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Checks if a point is along the extension of a line
 * @param {Object} point - Point to test {x, y}
 * @param {Object} lineStart - Start of line {x, y}
 * @param {Object} lineEnd - End of line {x, y}
 * @returns {boolean} True if point is along line extension
 */
function isPointAlongLineExtension(point, lineStart, lineEnd) {
  // Calculate distance from point to line
  const distanceToLine = distanceFromPointToLine(point, lineStart, lineEnd);
  
  if (distanceToLine > 1.0) { // Not close enough to line
    return false;
  }
  
  // Check if point is along the same direction as the line
  const lineVector = {
    x: lineEnd.x - lineStart.x,
    y: lineEnd.y - lineStart.y
  };
  
  const pointVector1 = {
    x: point.x - lineStart.x,
    y: point.y - lineStart.y
  };
  
  const pointVector2 = {
    x: point.x - lineEnd.x,
    y: point.y - lineEnd.y
  };
  
  // If point is beyond the line segment in either direction, it's on the extension
  const dot1 = pointVector1.x * lineVector.x + pointVector1.y * lineVector.y;
  const dot2 = pointVector2.x * (-lineVector.x) + pointVector2.y * (-lineVector.y);
  
  return dot1 < 0 || dot2 < 0;
}

/**
 * Finds the edge of a rectangle that is adjacent to a ledger line
 * @param {Array<{x: number, y: number}>} corners - Rectangle corners
 * @param {Object} ledgerStart - Start of ledger line {x, y}
 * @param {Object} ledgerEnd - End of ledger line {x, y}
 * @returns {Object|null} Adjacent edge or null
 */
function findAdjacentEdgeToLedger(corners, ledgerStart, ledgerEnd) {
  const isLedgerHorizontal = Math.abs(ledgerStart.y - ledgerEnd.y) < EPSILON;
  
  // Look for an edge that is parallel to the ledger and close to it
  for (let i = 0; i < corners.length; i++) {
    const edgeStart = corners[i];
    const edgeEnd = corners[(i + 1) % corners.length];
    
    const isEdgeHorizontal = Math.abs(edgeStart.y - edgeEnd.y) < EPSILON;
    
    // Edge must be parallel to ledger
    if (isEdgeHorizontal === isLedgerHorizontal) {
      // Check if edge is close to the ledger line
      const edgeMidpoint = {
        x: (edgeStart.x + edgeEnd.x) / 2,
        y: (edgeStart.y + edgeEnd.y) / 2
      };
      
      const distanceToLedger = distanceFromPointToLine(edgeMidpoint, ledgerStart, ledgerEnd);
      
      if (distanceToLedger < 1.0) { // Within tolerance
        return {
          p1: edgeStart,
          p2: edgeEnd
        };
      }
    }
  }
  
  return null;
}

/**
 * Validates that a shape can be decomposed
 * @param {Array<{x: number, y: number}>} points - Array of points defining the shape
 * @returns {boolean} True if shape can be decomposed
 */
export function canDecomposeShape(points) {
  try {
    // Basic validation
    if (points.length < 4) return false;

    // Check if all edges are horizontal, vertical, or 45-degree diagonal
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      const edgeType = classifyEdgeType(p1, p2);

      if (edgeType === 'other') {
        return false;
      }
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Classifies an edge as horizontal, vertical, diagonal (45°), or other
 * @param {Object} p1 - Start point {x, y}
 * @param {Object} p2 - End point {x, y}
 * @param {number} tolerance - Angle tolerance in degrees (default 2°)
 * @returns {string} 'horizontal', 'vertical', 'diagonal', or 'other'
 */
function classifyEdgeType(p1, p2, tolerance = 2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  // Check for zero-length edge
  if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) {
    return 'other';
  }

  // Calculate angle in degrees (0-90 range for classification)
  const angleRad = Math.atan2(Math.abs(dy), Math.abs(dx));
  const angleDeg = angleRad * (180 / Math.PI);

  // Horizontal: angle near 0°
  if (angleDeg < tolerance) {
    return 'horizontal';
  }

  // Vertical: angle near 90°
  if (Math.abs(angleDeg - 90) < tolerance) {
    return 'vertical';
  }

  // Diagonal (45°): angle near 45°
  if (Math.abs(angleDeg - 45) < tolerance) {
    return 'diagonal';
  }

  return 'other';
}

/**
 * Checks if a shape has any diagonal (45°) edges
 * @param {Array<{x: number, y: number}>} points - Array of points defining the shape
 * @returns {boolean} True if shape has diagonal edges
 */
export function shapeHasDiagonalEdges(points) {
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    if (classifyEdgeType(p1, p2) === 'diagonal') {
      return true;
    }
  }
  return false;
}

/**
 * Gets all diagonal edges from a shape
 * @param {Array<{x: number, y: number}>} points - Array of points defining the shape
 * @returns {Array<Object>} Array of diagonal edge objects with p1, p2, index
 */
export function getDiagonalEdgesFromShape(points) {
  const diagonalEdges = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    if (classifyEdgeType(p1, p2) === 'diagonal') {
      diagonalEdges.push({
        p1,
        p2,
        index: i,
        angle: Math.atan2(p2.y - p1.y, p2.x - p1.x)
      });
    }
  }
  return diagonalEdges;
}