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
  // Remove closing point for processing
  const shapePoints = points.slice(0, -1);
  
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
  if (hasDiagonal) {
    console.log("Shape has diagonal edges - will decompose using grid method and handle diagonal trimming in structural calculations");
  }

  // Step 1: Find all unique X and Y coordinates to create a grid
  const xCoords = [...new Set(workingPoints.map(p => p.x))].sort((a, b) => a - b);
  const yCoords = [...new Set(workingPoints.map(p => p.y))].sort((a, b) => a - b);
  
  console.log("Grid X coordinates:", xCoords);
  console.log("Grid Y coordinates:", yCoords);

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
        insideCells.push({ x, y, width, height });
      }
    }
  }
  
  console.log(`Found ${insideCells.length} cells inside polygon`);
  console.log("Inside cells:", insideCells);

  // Step 3: Smart merging based on shape complexity
  // For L-shapes (3 cells), we need to be careful about which cells to merge
  let mergedRectangles;
  
  if (insideCells.length === 2) {
    console.log("Exactly 2 cells - keeping them separate");
    mergedRectangles = insideCells;
  } else if (insideCells.length === 3) {
    console.log("3 cells detected - L-shape pattern, using selective merging");
    
    // Determine ledger orientation to decide merge direction
    const ledgerStart = workingPoints[wallIndex];
    const ledgerEnd = workingPoints[(wallIndex + 1) % workingPoints.length];
    const isLedgerHorizontal = Math.abs(ledgerStart.y - ledgerEnd.y) < EPSILON;
    
    console.log(`Ledger is ${isLedgerHorizontal ? 'horizontal' : 'vertical'}`);
    
    // Find which cells are horizontally adjacent (same Y) vs vertically adjacent (same X)
    const cellsByRow = {};
    const cellsByCol = {};
    
    insideCells.forEach((cell, index) => {
      const rowKey = `${cell.y}_${cell.height}`;
      const colKey = `${cell.x}_${cell.width}`;
      
      if (!cellsByRow[rowKey]) cellsByRow[rowKey] = [];
      if (!cellsByCol[colKey]) cellsByCol[colKey] = [];
      
      cellsByRow[rowKey].push(index);
      cellsByCol[colKey].push(index);
    });
    
    mergedRectangles = [];
    const merged = new Set();
    
    if (isLedgerHorizontal) {
      // For horizontal ledger (top/bottom), merge cells VERTICALLY (same column)
      Object.values(cellsByCol).forEach(indices => {
        if (indices.length > 1 && !indices.some(i => merged.has(i))) {
          // Merge these cells vertically
          const cellsToMerge = indices.map(i => insideCells[i]);
          const minY = Math.min(...cellsToMerge.map(c => c.y));
          const maxY = Math.max(...cellsToMerge.map(c => c.y + c.height));
          const x = cellsToMerge[0].x;
          const width = cellsToMerge[0].width;
          
          mergedRectangles.push({
            x: x,
            y: minY,
            width: width,
            height: maxY - minY
          });
          
          indices.forEach(i => merged.add(i));
        }
      });
    } else {
      // For vertical ledger (left/right), merge cells HORIZONTALLY (same row)
      Object.values(cellsByRow).forEach(indices => {
        if (indices.length > 1 && !indices.some(i => merged.has(i))) {
          // Merge these cells horizontally
          const cellsToMerge = indices.map(i => insideCells[i]);
          const minX = Math.min(...cellsToMerge.map(c => c.x));
          const maxX = Math.max(...cellsToMerge.map(c => c.x + c.width));
          const y = cellsToMerge[0].y;
          const height = cellsToMerge[0].height;
          
          mergedRectangles.push({
            x: minX,
            y: y,
            width: maxX - minX,
            height: height
          });
          
          indices.forEach(i => merged.add(i));
        }
      });
    }
    
    // Add any unmerged cells
    insideCells.forEach((cell, index) => {
      if (!merged.has(index)) {
        mergedRectangles.push(cell);
      }
    });
    
  } else if (insideCells.length === 6) {
    console.log("6 cells detected - U-shape pattern, using special merging");
    
    // Determine ledger orientation
    const ledgerStart = workingPoints[wallIndex];
    const ledgerEnd = workingPoints[(wallIndex + 1) % workingPoints.length];
    const isLedgerHorizontal = Math.abs(ledgerStart.y - ledgerEnd.y) < EPSILON;
    
    console.log(`U-shape with ${isLedgerHorizontal ? 'horizontal' : 'vertical'} ledger`);
    
    mergedRectangles = [];
    const merged = new Set();
    
    if (isLedgerHorizontal) {
      // For horizontal ledger (top/bottom), create 3 vertical strips
      // Group cells by their X position
      const columnGroups = {};
      insideCells.forEach((cell, index) => {
        const xKey = cell.x;
        if (!columnGroups[xKey]) columnGroups[xKey] = [];
        columnGroups[xKey].push({ cell, index });
      });
      
      // Merge cells within each column (vertical merging only)
      Object.values(columnGroups).forEach(group => {
        if (group.length > 1) {
          // Sort by Y position
          group.sort((a, b) => a.cell.y - b.cell.y);
          
          // Merge all cells in this column
          const cells = group.map(g => g.cell);
          const minY = Math.min(...cells.map(c => c.y));
          const maxY = Math.max(...cells.map(c => c.y + c.height));
          const x = cells[0].x;
          const width = cells[0].width;
          
          mergedRectangles.push({
            x: x,
            y: minY,
            width: width,
            height: maxY - minY
          });
          
          group.forEach(g => merged.add(g.index));
        } else {
          // Single cell in this column
          mergedRectangles.push(group[0].cell);
          merged.add(group[0].index);
        }
      });
    } else {
      // For vertical ledger (left/right), create 3 horizontal strips
      // Group cells by their Y position
      const rowGroups = {};
      insideCells.forEach((cell, index) => {
        const yKey = cell.y;
        if (!rowGroups[yKey]) rowGroups[yKey] = [];
        rowGroups[yKey].push({ cell, index });
      });
      
      // Merge cells within each row (horizontal merging only)
      Object.values(rowGroups).forEach(group => {
        if (group.length > 1) {
          // Sort by X position
          group.sort((a, b) => a.cell.x - b.cell.x);
          
          // Merge all cells in this row
          const cells = group.map(g => g.cell);
          const minX = Math.min(...cells.map(c => c.x));
          const maxX = Math.max(...cells.map(c => c.x + c.width));
          const y = cells[0].y;
          const height = cells[0].height;
          
          mergedRectangles.push({
            x: minX,
            y: y,
            width: maxX - minX,
            height: height
          });
          
          group.forEach(g => merged.add(g.index));
        } else {
          // Single cell in this row
          mergedRectangles.push(group[0].cell);
          merged.add(group[0].index);
        }
      });
    }
    
  } else if (insideCells.length >= 8) {
    console.log(`${insideCells.length} cells detected - Complex shape, using column-based merging`);
    
    // For complex shapes like W, we should merge by columns to avoid spanning notches
    // Determine ledger orientation
    const ledgerStart = workingPoints[wallIndex];
    const ledgerEnd = workingPoints[(wallIndex + 1) % workingPoints.length];
    const isLedgerHorizontal = Math.abs(ledgerStart.y - ledgerEnd.y) < EPSILON;
    
    console.log(`Complex shape with ${isLedgerHorizontal ? 'horizontal' : 'vertical'} ledger`);
    
    mergedRectangles = [];
    
    if (isLedgerHorizontal) {
      // For horizontal ledger, merge cells vertically within columns
      const columnGroups = {};
      insideCells.forEach((cell) => {
        const xKey = cell.x;
        if (!columnGroups[xKey]) columnGroups[xKey] = [];
        columnGroups[xKey].push(cell);
      });
      
      // Merge cells within each column
      Object.values(columnGroups).forEach(column => {
        if (column.length > 1) {
          // Sort by Y position
          column.sort((a, b) => a.y - b.y);
          
          // Check for gaps and merge continuous sections
          let currentGroup = [column[0]];
          
          for (let i = 1; i < column.length; i++) {
            const prevCell = column[i-1];
            const currCell = column[i];
            
            // Check if cells are adjacent (no gap)
            if (Math.abs((prevCell.y + prevCell.height) - currCell.y) < EPSILON) {
              currentGroup.push(currCell);
            } else {
              // Gap found - merge current group and start new one
              if (currentGroup.length > 0) {
                const minY = Math.min(...currentGroup.map(c => c.y));
                const maxY = Math.max(...currentGroup.map(c => c.y + c.height));
                mergedRectangles.push({
                  x: currentGroup[0].x,
                  y: minY,
                  width: currentGroup[0].width,
                  height: maxY - minY
                });
              }
              currentGroup = [currCell];
            }
          }
          
          // Merge final group
          if (currentGroup.length > 0) {
            const minY = Math.min(...currentGroup.map(c => c.y));
            const maxY = Math.max(...currentGroup.map(c => c.y + c.height));
            mergedRectangles.push({
              x: currentGroup[0].x,
              y: minY,
              width: currentGroup[0].width,
              height: maxY - minY
            });
          }
        } else {
          mergedRectangles.push(column[0]);
        }
      });
    } else {
      // For vertical ledger, merge cells horizontally within rows
      const rowGroups = {};
      insideCells.forEach((cell) => {
        const yKey = cell.y;
        if (!rowGroups[yKey]) rowGroups[yKey] = [];
        rowGroups[yKey].push(cell);
      });
      
      // Merge cells within each row
      Object.values(rowGroups).forEach(row => {
        if (row.length > 1) {
          // Sort by X position
          row.sort((a, b) => a.x - b.x);
          
          // Check for gaps and merge continuous sections
          let currentGroup = [row[0]];
          
          for (let i = 1; i < row.length; i++) {
            const prevCell = row[i-1];
            const currCell = row[i];
            
            // Check if cells are adjacent (no gap)
            if (Math.abs((prevCell.x + prevCell.width) - currCell.x) < EPSILON) {
              currentGroup.push(currCell);
            } else {
              // Gap found - merge current group and start new one
              if (currentGroup.length > 0) {
                const minX = Math.min(...currentGroup.map(c => c.x));
                const maxX = Math.max(...currentGroup.map(c => c.x + c.width));
                mergedRectangles.push({
                  x: minX,
                  y: currentGroup[0].y,
                  width: maxX - minX,
                  height: currentGroup[0].height
                });
              }
              currentGroup = [currCell];
            }
          }
          
          // Merge final group
          if (currentGroup.length > 0) {
            const minX = Math.min(...currentGroup.map(c => c.x));
            const maxX = Math.max(...currentGroup.map(c => c.x + c.width));
            mergedRectangles.push({
              x: minX,
              y: currentGroup[0].y,
              width: maxX - minX,
              height: currentGroup[0].height
            });
          }
        } else {
          mergedRectangles.push(row[0]);
        }
      });
    }
    
  } else {
    mergedRectangles = mergeAdjacentRectangles(insideCells);
  }
  
  console.log(`Merged into ${mergedRectangles.length} rectangles`);
  console.log("Final rectangles:", mergedRectangles);
  
  return mergedRectangles;
}

/**
 * Finds corners adjacent to a given corner in the polygon
 * @param {Object} corner - The corner point {x, y}
 * @param {Array<Object>} points - All polygon points
 * @returns {Array<Object>} Adjacent corner points
 */
function findAdjacentCorners(corner, points) {
  const index = points.findIndex(p => 
    Math.abs(p.x - corner.x) < EPSILON && Math.abs(p.y - corner.y) < EPSILON
  );
  
  if (index === -1) return [];
  
  const prev = points[(index - 1 + points.length) % points.length];
  const next = points[(index + 1) % points.length];
  
  return [prev, next];
}

/**
 * Fallback decomposition for non-axis-aligned ledgers
 * @param {Array<Object>} points - Polygon points
 * @returns {Array<Object>} Single rectangle covering the polygon bounds
 */
function fallbackDecomposition(points) {
  const bounds = getPolygonBounds(points);
  return [{
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY
  }];
}

/**
 * Removes overlaps and merges adjacent rectangles
 * @param {Array<Object>} rectangles - Array of rectangles
 * @returns {Array<Object>} Non-overlapping rectangles
 */
function removeOverlapsAndMerge(rectangles) {
  if (rectangles.length <= 1) return rectangles;
  
  // For now, just return the rectangles as-is
  // In a more complex implementation, we would:
  // 1. Detect overlapping rectangles
  // 2. Split overlapping areas
  // 3. Merge adjacent non-overlapping rectangles
  
  return mergeAdjacentRectangles(rectangles);
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
 * Checks if a polygon is a rectangle (4 or 5 points with last being duplicate)
 * @param {Array<{x: number, y: number}>} polygon - Polygon points
 * @returns {boolean} True if polygon is a rectangle
 */
function isRectangle(polygon) {
  // Handle case where last point is duplicate of first
  let workingPolygon = polygon;
  if (polygon.length === 5) {
    const first = polygon[0];
    const last = polygon[4];
    if (Math.abs(first.x - last.x) < EPSILON && Math.abs(first.y - last.y) < EPSILON) {
      workingPolygon = polygon.slice(0, 4);
    }
  }

  if (workingPolygon.length !== 4) {
    return false;
  }

  // Check that all edges are horizontal or vertical
  for (let i = 0; i < 4; i++) {
    const p1 = workingPolygon[i];
    const p2 = workingPolygon[(i + 1) % 4];
    
    const isHorizontal = Math.abs(p1.y - p2.y) < EPSILON;
    const isVertical = Math.abs(p1.x - p2.x) < EPSILON;
    
    if (!isHorizontal && !isVertical) {
      return false;
    }
  }

  return true;
}

/**
 * Finds a concave vertex and determines the optimal split line
 * @param {Array<{x: number, y: number}>} polygon - Polygon points
 * @returns {Object|null} Object with concaveVertex and splitLine, or null if no valid split found
 */
function findConcaveVertexAndSplitLine(polygon) {
  const concaveVertices = findAllConcaveVertices(polygon);
  
  if (concaveVertices.length === 0) {
    return null;
  }

  // Try each concave vertex to find a valid split
  for (const concaveVertex of concaveVertices) {
    const splitLine = createSplitLineFromConcaveVertex(polygon, concaveVertex);
    
    if (splitLine && isValidSplitLine(polygon, splitLine)) {
      return {
        concaveVertex: concaveVertex,
        splitLine: splitLine
      };
    }
  }

  return null;
}

/**
 * Classifies all vertices in a polygon as convex, concave, or collinear
 * @param {Array<{x: number, y: number}>} polygon - Polygon points
 * @returns {Array<Object>} Array of vertex objects with point, index, and type
 */
function classifyAllVertices(polygon) {
  const vertices = [];
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const prev = polygon[(i - 1 + n) % n];
    const curr = polygon[i];
    const next = polygon[(i + 1) % n];

    // Calculate vectors from current vertex
    const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };

    // Calculate cross product (for counter-clockwise polygon, negative means concave)
    const crossProduct = v1.x * v2.y - v1.y * v2.x;

    let type;
    if (crossProduct < -EPSILON) {
      type = 'concave';
    } else if (crossProduct > EPSILON) {
      type = 'convex';
    } else {
      type = 'collinear';
    }

    vertices.push({
      point: curr,
      index: i,
      type: type
    });
  }

  return vertices;
}

/**
 * Finds all concave vertices in a polygon
 * @param {Array<{x: number, y: number}>} polygon - Polygon points
 * @returns {Array<Object>} Array of concave vertex objects with point and index
 */
function findAllConcaveVertices(polygon) {
  const allVertices = classifyAllVertices(polygon);
  return allVertices.filter(vertex => vertex.type === 'concave');
}

/**
 * Determines if a vertex is concave (interior angle > 180 degrees)
 * @param {Object} prev - Previous vertex {x, y}
 * @param {Object} curr - Current vertex {x, y}  
 * @param {Object} next - Next vertex {x, y}
 * @returns {boolean} True if vertex is concave
 */
function isConcaveVertex(prev, curr, next) {
  // Calculate vectors from current vertex
  const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
  const v2 = { x: next.x - curr.x, y: next.y - curr.y };

  // Calculate cross product (for counter-clockwise polygon, negative means concave)
  const crossProduct = v1.x * v2.y - v1.y * v2.x;

  // For rectilinear polygons assumed to be counter-clockwise, concave vertices have negative cross product
  return crossProduct < -EPSILON;
}

/**
 * Creates a split line from a concave vertex extending into the polygon
 * @param {Array<{x: number, y: number}>} polygon - Polygon points
 * @param {Object} concaveVertex - Concave vertex object with point and index
 * @returns {Object|null} Split line object or null if no valid line can be created
 */
function createSplitLineFromConcaveVertex(polygon, concaveVertex) {
  const point = concaveVertex.point;
  const index = concaveVertex.index;
  const n = polygon.length;

  // Get adjacent edges
  const prevPoint = polygon[(index - 1 + n) % n];
  const nextPoint = polygon[(index + 1) % n];

  // Determine edge directions
  const edge1 = { x: point.x - prevPoint.x, y: point.y - prevPoint.y };
  const edge2 = { x: nextPoint.x - point.x, y: nextPoint.y - point.y };

  // Normalize edges to determine direction
  const isEdge1Horizontal = Math.abs(edge1.y) < EPSILON;
  const isEdge2Horizontal = Math.abs(edge2.y) < EPSILON;

  let splitLine = null;

  // Create split line perpendicular to one of the edges
  if (isEdge1Horizontal && !isEdge2Horizontal) {
    // Edge1 is horizontal, create vertical split line
    splitLine = createVerticalSplitLine(polygon, point);
  } else if (!isEdge1Horizontal && isEdge2Horizontal) {
    // Edge2 is horizontal, create horizontal split line  
    splitLine = createHorizontalSplitLine(polygon, point);
  } else {
    // Try both directions and pick the one that creates a valid split
    const verticalSplit = createVerticalSplitLine(polygon, point);
    const horizontalSplit = createHorizontalSplitLine(polygon, point);
    
    if (verticalSplit && isValidSplitLine(polygon, verticalSplit)) {
      splitLine = verticalSplit;
    } else if (horizontalSplit && isValidSplitLine(polygon, horizontalSplit)) {
      splitLine = horizontalSplit;
    }
  }

  return splitLine;
}

/**
 * Creates a horizontal split line through a point
 * @param {Array<{x: number, y: number}>} polygon - Polygon points
 * @param {Object} point - Point to create line through {x, y}
 * @returns {Object} Horizontal split line object
 */
function createHorizontalSplitLine(polygon, point) {
  const bounds = getPolygonBounds(polygon);
  return {
    type: 'horizontal',
    y: point.y,
    start: { x: bounds.minX - 1, y: point.y },
    end: { x: bounds.maxX + 1, y: point.y }
  };
}

/**
 * Creates a vertical split line through a point
 * @param {Array<{x: number, y: number}>} polygon - Polygon points
 * @param {Object} point - Point to create line through {x, y}
 * @returns {Object} Vertical split line object
 */
function createVerticalSplitLine(polygon, point) {
  const bounds = getPolygonBounds(polygon);
  return {
    type: 'vertical',
    x: point.x,
    start: { x: point.x, y: bounds.minY - 1 },
    end: { x: point.x, y: bounds.maxY + 1 }
  };
}

/**
 * Checks if a split line is valid for polygon splitting
 * @param {Array<{x: number, y: number}>} polygon - Polygon points
 * @param {Object} splitLine - Split line object
 * @returns {boolean} True if split line is valid
 */
function isValidSplitLine(polygon, splitLine) {
  const intersections = findLinePolygonIntersections(splitLine.start, splitLine.end, polygon);
  
  // A valid split line should intersect the polygon at exactly 2 points
  // and the line should pass through the interior of the polygon
  return intersections.length >= 2;
}


/**
 * Processes raw rectangles into the final format with IDs, adjacency, and ledger information
 * @param {Array<Array<{x: number, y: number}>>} rawRectangles - Array of rectangle corner arrays
 * @param {Array<Object>} originalLedgerWalls - Array of original ledger wall objects
 * @returns {Array<Object>} Array of formatted rectangle objects
 */
function processRawRectangles(rawRectangles, originalLedgerWalls) {
  const rectangles = [];

  console.log(`\nProcessing ${rawRectangles.length} raw rectangles with ${originalLedgerWalls.length} original ledger walls...`);
  
  // Create rectangle objects with unique IDs
  for (let i = 0; i < rawRectangles.length; i++) {
    const corners = rawRectangles[i];
    const rectId = `rect_${i}`;
    
    console.log(`\nProcessing rectangle ${i + 1}/${rawRectangles.length} (${rectId}):`);
    
    // Check if this rectangle contains part of any ledger wall
    let isLedgerRectangle = false;
    let ledgerWalls = [];
    
    originalLedgerWalls.forEach((originalWall, wallIndex) => {
      console.log(`  Checking against ledger wall ${wallIndex + 1}/${originalLedgerWalls.length}:`);
      const ledgerInfo = findLedgerWallInRectangle(corners, originalWall);
      if (ledgerInfo.isLedgerRectangle) {
        isLedgerRectangle = true;
        ledgerWalls.push(ledgerInfo.ledgerWall);
        const ledgerLength = getLineSegmentLength(ledgerInfo.ledgerWall.p1, ledgerInfo.ledgerWall.p2) / 24;
        console.log(`    ✓ Rectangle ${rectId} contains ${ledgerLength.toFixed(2)}' of ledger`);
      } else {
        console.log(`    ✗ Rectangle ${rectId} does not contain this ledger wall`);
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
    
    console.log(`  Final: Rectangle ${rectId} - isLedgerRectangle: ${isLedgerRectangle}, ledgerWalls: ${ledgerWalls.length}`);
    
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

  console.log(`Checking rectangle for ledger wall: ledger from (${ledgerStart.x}, ${ledgerStart.y}) to (${ledgerEnd.x}, ${ledgerEnd.y})`);
  console.log(`Rectangle bounds: (${bounds.minX}, ${bounds.minY}) to (${bounds.maxX}, ${bounds.maxY})`);

  // Check if the ledger wall segment intersects with any edge of the rectangle
  for (let i = 0; i < corners.length; i++) {
    const edgeStart = corners[i];
    const edgeEnd = corners[(i + 1) % corners.length];
    
    // Check if the ledger wall overlaps with this edge
    const overlap = findLineSegmentOverlap(ledgerStart, ledgerEnd, edgeStart, edgeEnd);
    
    if (overlap) {
      // Calculate the actual length of the overlapping segment
      const overlapLength = getLineSegmentLength(overlap.p1, overlap.p2);
      
      console.log(`✓ Found direct ledger overlap: ${(overlapLength / 24).toFixed(2)} feet in rectangle`);
      
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
  console.log(`Ledger is ${isLedgerHorizontal ? 'horizontal' : 'vertical'}`);
  
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
          const edgeLength = getLineSegmentLength(edgeStart, edgeEnd);
          console.log(`✓ Found collinear ledger continuation: ${(edgeLength / 24).toFixed(2)} feet (horizontal)`);
          
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
          const edgeLength = getLineSegmentLength(edgeStart, edgeEnd);
          console.log(`✓ Found collinear ledger continuation: ${(edgeLength / 24).toFixed(2)} feet (vertical)`);
          
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
        console.log(`Rectangle is adjacent to extended ledger line - treating as ledger rectangle`);
        
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

  console.log(`✗ Rectangle does not contain ledger wall`);
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
      console.log(`Found diagonal edge from (${p1.x}, ${p1.y}) to (${p2.x}, ${p2.y})`);
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
 * Checks if a point lies on a line segment
 * @param {Object} point - Point to test {x, y}
 * @param {Object} lineStart - Start of line segment {x, y}
 * @param {Object} lineEnd - End of line segment {x, y}
 * @returns {boolean} True if point is on the line segment
 */
function isPointOnLineSegment(point, lineStart, lineEnd) {
  // Check if point is collinear with the line segment
  const crossProduct = (point.y - lineStart.y) * (lineEnd.x - lineStart.x) - 
                      (point.x - lineStart.x) * (lineEnd.y - lineStart.y);
  
  if (Math.abs(crossProduct) > EPSILON) {
    return false; // Not collinear
  }
  
  // Check if point is within the bounds of the line segment
  const minX = Math.min(lineStart.x, lineEnd.x);
  const maxX = Math.max(lineStart.x, lineEnd.x);
  const minY = Math.min(lineStart.y, lineEnd.y);
  const maxY = Math.max(lineStart.y, lineEnd.y);
  
  return point.x >= minX - EPSILON && point.x <= maxX + EPSILON &&
         point.y >= minY - EPSILON && point.y <= maxY + EPSILON;
}

/**
 * Checks if a point is inside a polygon using ray casting algorithm
 * @param {Object} point - Point to test {x, y}
 * @param {Array<{x: number, y: number}>} polygon - Polygon vertices
 * @returns {boolean} True if point is inside polygon
 */
function isPointInsidePolygon(point, polygon) {
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