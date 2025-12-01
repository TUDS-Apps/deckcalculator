// shapeValidator.js - Shape validation for complex deck shapes
// Validates deck shapes and ensures they can be decomposed into rectangles

import { EPSILON, PIXELS_PER_FOOT, MODEL_WIDTH_FEET } from "./config.js";
import { distance } from "./utils.js";

const MIN_DECK_DIM_FEET = 4; // Minimum 4 feet for both width and height
const MIN_SEGMENT_LENGTH_FEET = 0.25; // Minimum 3 inches for any segment (allows auto-corner points)
const MAX_SEGMENT_LENGTH_FEET = MODEL_WIDTH_FEET / 2; // Max segment length, e.g., half of model width

/**
 * Validates that the deck's bounding box meets minimum dimensions.
 * @param {Array<{x: number, y: number}>} points - Array of points defining the shape
 * @returns {{isValid: boolean, error: string | null}} Validation result
 */
function checkMinimumDeckDimensions(points) {
  if (points.length < 2) {
    return { isValid: true, error: null }; // Not enough points to form a dimension
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  const widthPixels = maxX - minX;
  const heightPixels = maxY - minY;

  const minDimPixels = MIN_DECK_DIM_FEET * PIXELS_PER_FOOT;

  if (widthPixels < minDimPixels - EPSILON || heightPixels < minDimPixels - EPSILON) {
    return {
      isValid: false,
      error: `Deck must be at least ${MIN_DECK_DIM_FEET}' x ${MIN_DECK_DIM_FEET}' (currently ${Math.round(widthPixels / PIXELS_PER_FOOT)}' x ${Math.round(heightPixels / PIXELS_PER_FOOT)}')`
    };
  }

  return { isValid: true, error: null };
}

/**
 * Validates that all segments are within minimum and maximum length constraints.
 * @param {Array<{x: number, y: number}>} points - Array of points defining the shape (without duplicate closing point)
 * @returns {{isValid: boolean, error: string | null}} Validation result
 */
function checkSegmentLengths(points) {
  if (points.length < 2) {
    return { isValid: true, error: null };
  }

  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const segmentLengthPixels = distance(p1, p2);
    const segmentLengthFeet = segmentLengthPixels / PIXELS_PER_FOOT;

    if (segmentLengthFeet < MIN_SEGMENT_LENGTH_FEET - EPSILON) {
      return {
        isValid: false,
        error: `Segment ${i + 1} is too short (min 3" required).`
      };
    }
    if (segmentLengthFeet > MAX_SEGMENT_LENGTH_FEET + EPSILON) {
      return {
        isValid: false,
        error: `Segment ${i + 1} is too long (max ${MAX_SEGMENT_LENGTH_FEET}' recommended).`
      };
    }
  }

  return { isValid: true, error: null };
}

/**
 * Validates a deck shape to ensure it can be decomposed into rectangles
 * @param {Array<{x: number, y: number}>} points - Array of points defining the shape
 * @returns {{isValid: boolean, error: string | null}} Validation result
 */
export function validateShape(points) {
  // Basic validation checks
  if (!points || !Array.isArray(points)) {
    return { isValid: false, error: "Invalid points array provided" };
  }

  if (points.length < 4) {
    return { isValid: false, error: "Shape must have at least 4 points to form a closed polygon" };
  }

  // Check if shape is closed (first and last points should be the same)
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  if (distance(firstPoint, lastPoint) > EPSILON) {
    return { isValid: false, error: "Shape is not properly closed" };
  }

  // Remove the duplicate closing point for validation
  const shapePoints = points.slice(0, -1);

  // Check for minimum points after removing closing point
  if (shapePoints.length < 3) {
    return { isValid: false, error: "Shape must have at least 3 unique points" };
  }

  // Check for self-intersections
  const selfIntersectionCheck = checkSelfIntersections(shapePoints);
  if (!selfIntersectionCheck.isValid) {
    return selfIntersectionCheck;
  }

  // Check that all corners are 90-degree angles
  const rightAngleCheck = hasOnlyRightAngles(shapePoints);
  if (!rightAngleCheck.isValid) {
    return rightAngleCheck;
  }

  // Minimum Deck Dimensions Check
  const minDimCheck = checkMinimumDeckDimensions(shapePoints);
  if (!minDimCheck.isValid) {
    return minDimCheck;
  }

  // Segment Lengths Check
  const segmentLengthCheck = checkSegmentLengths(shapePoints);
  if (!segmentLengthCheck.isValid) {
    return segmentLengthCheck;
  }

  // Check if shape can be decomposed into rectangles
  const decompositionCheck = canBeDecomposedIntoRectangles(shapePoints);
  if (!decompositionCheck.isValid) {
    return decompositionCheck;
  }

  return { isValid: true, error: null };
}

/**
 * Checks that all corners in the shape have valid angles (90° or 45°/135°)
 * @param {Array<{x: number, y: number}>} points - Array of points defining the shape
 * @returns {{isValid: boolean, error: string | null}} Validation result
 */
export function hasOnlyRightAngles(points) {
  if (points.length < 3) {
    return { isValid: false, error: "Need at least 3 points to check angles" };
  }

  for (let i = 0; i < points.length; i++) {
    const prevPoint = points[(i - 1 + points.length) % points.length];
    const currentPoint = points[i];
    const nextPoint = points[(i + 1) % points.length];

    // Calculate vectors from current point
    const v1 = { x: prevPoint.x - currentPoint.x, y: prevPoint.y - currentPoint.y };
    const v2 = { x: nextPoint.x - currentPoint.x, y: nextPoint.y - currentPoint.y };

    // Calculate dot product
    const dotProduct = v1.x * v2.x + v1.y * v2.y;
    const magnitude1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const magnitude2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    if (magnitude1 < EPSILON || magnitude2 < EPSILON) {
      continue; // Skip if vectors are too small
    }

    const cosAngle = dotProduct / (magnitude1 * magnitude2);

    // Valid angles for deck shapes (interior angles):
    // 0° = collinear edges pointing same direction (cosine ≈ 1)
    // 45° = sharp corner (cosine ≈ 0.707)
    // 90° = perpendicular edges (cosine ≈ 0)
    // 135° = obtuse corner (cosine ≈ -0.707)
    // 180° = collinear edges pointing opposite directions (cosine ≈ -1)

    const tolerance = 0.15; // Slightly increased tolerance for 45° angles
    const cos45 = Math.SQRT1_2; // ~0.707

    const is0Degree = Math.abs(cosAngle - 1) < tolerance; // cosine near 1
    const is45Degree = Math.abs(Math.abs(cosAngle) - cos45) < tolerance; // cosine near ±0.707
    const is90Degree = Math.abs(cosAngle) < tolerance; // cosine near 0
    const is135Degree = Math.abs(cosAngle + cos45) < tolerance; // cosine near -0.707
    const is180Degree = Math.abs(cosAngle + 1) < tolerance; // cosine near -1

    if (!is0Degree && !is45Degree && !is90Degree && !is135Degree && !is180Degree) {
      // This is not a valid angle
      const angleInRadians = Math.acos(Math.min(1, Math.max(-1, Math.abs(cosAngle))));
      const angleInDegrees = angleInRadians * 180 / Math.PI;
      return {
        isValid: false,
        error: `Invalid angle at point ${i + 1}: ${angleInDegrees.toFixed(1)}°. Only 90° and 45°/135° corners are supported.`
      };
    }
  }

  return { isValid: true, error: null };
}

/**
 * Checks if the polygon has any self-intersections
 * @param {Array<{x: number, y: number}>} points - Array of points defining the shape
 * @returns {{isValid: boolean, error: string | null}} Validation result
 */
function checkSelfIntersections(points) {
  const edges = [];
  
  // Create edges from consecutive points
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    edges.push({ p1, p2, index: i });
  }

  // Check each edge pair for intersections
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 2; j < edges.length; j++) {
      // Don't check adjacent edges or the closing edge with the first edge
      if (j === edges.length - 1 && i === 0) continue;
      
      const edge1 = edges[i];
      const edge2 = edges[j];
      
      if (doLinesIntersect(edge1.p1, edge1.p2, edge2.p1, edge2.p2)) {
        return { 
          isValid: false, 
          error: `Shape has self-intersecting lines. Edge ${i + 1} intersects with edge ${j + 1}.` 
        };
      }
    }
  }

  return { isValid: true, error: null };
}

/**
 * Checks if the shape can be decomposed into sections (rectangles and triangular corners)
 * @param {Array<{x: number, y: number}>} points - Array of points defining the shape
 * @returns {{isValid: boolean, error: string | null}} Validation result
 */
function canBeDecomposedIntoRectangles(points) {
  // For a polygon to be decomposable, it must be:
  // 1. Have valid angles (90° or 45°/135°) - already checked
  // 2. Simple (no self-intersections) - already checked

  // Check that the shape forms a valid polygon with allowed edge types
  // All edges must be either horizontal, vertical, or 45-degree diagonal
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];

    const edgeType = classifyEdge(p1, p2);

    if (edgeType === 'other') {
      return {
        isValid: false,
        error: `Edge ${i + 1} is not aligned to a valid angle. Edges must be horizontal, vertical, or at 45°.`
      };
    }
  }

  // Accept polygons with valid edge types
  return { isValid: true, error: null };
}

/**
 * Classifies an edge as horizontal, vertical, diagonal (45°), or other
 * @param {Object} p1 - Start point {x, y}
 * @param {Object} p2 - End point {x, y}
 * @param {number} tolerance - Angle tolerance in degrees (default 2°)
 * @returns {string} 'horizontal', 'vertical', 'diagonal', or 'other'
 */
export function classifyEdge(p1, p2, tolerance = 2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  // Check for zero-length edge
  if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) {
    return 'other';
  }

  // Calculate angle in degrees (0-180 range for classification)
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
 * Gets the angle of an edge in radians
 * @param {Object} p1 - Start point {x, y}
 * @param {Object} p2 - End point {x, y}
 * @returns {number} Angle in radians
 */
export function getEdgeAngle(p1, p2) {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

/**
 * Gets the length of an edge
 * @param {Object} p1 - Start point {x, y}
 * @param {Object} p2 - End point {x, y}
 * @returns {number} Edge length
 */
export function getEdgeLength(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Checks if an edge is diagonal (45°)
 * @param {Object} p1 - Start point {x, y}
 * @param {Object} p2 - End point {x, y}
 * @returns {boolean} True if edge is at 45°
 */
export function isDiagonalEdge(p1, p2) {
  return classifyEdge(p1, p2) === 'diagonal';
}

/**
 * Gets all edges with their classifications from a set of points
 * @param {Array<{x: number, y: number}>} points - Array of points defining the shape
 * @returns {Array<{p1: Object, p2: Object, type: string, angle: number, length: number, index: number}>}
 */
export function getClassifiedEdges(points) {
  const edges = [];
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    edges.push({
      p1,
      p2,
      type: classifyEdge(p1, p2),
      angle: getEdgeAngle(p1, p2),
      length: getEdgeLength(p1, p2),
      index: i
    });
  }
  return edges;
}

/**
 * Calculates the angle at a vertex defined by three points
 * @param {Object} p1 - Previous point {x, y}
 * @param {Object} p2 - Current point {x, y}
 * @param {Object} p3 - Next point {x, y}
 * @returns {number} Angle in radians
 */
function calculateAngle(p1, p2, p3) {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
  
  const dot = v1.x * v2.x + v1.y * v2.y;
  const det = v1.x * v2.y - v1.y * v2.x;
  
  return Math.atan2(det, dot);
}

/**
 * Checks if two line segments intersect
 * @param {Object} p1 - Start of first line {x, y}
 * @param {Object} p2 - End of first line {x, y}
 * @param {Object} p3 - Start of second line {x, y}
 * @param {Object} p4 - End of second line {x, y}
 * @returns {boolean} True if lines intersect
 */
function doLinesIntersect(p1, p2, p3, p4) {
  const denominator = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
  
  // Lines are parallel
  if (Math.abs(denominator) < EPSILON) {
    return false;
  }
  
  const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denominator;
  const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denominator;
  
  // Use tolerance to avoid edge touching being considered intersection
  const tolerance = 0.001;
  
  // Check if intersection point lies within both line segments (excluding endpoints)
  return ua > tolerance && ua < (1 - tolerance) && ub > tolerance && ub < (1 - tolerance);
}

/**
 * Counts the number of convex vertices in the polygon
 * @param {Array<{x: number, y: number}>} points - Array of points defining the shape
 * @returns {number} Number of convex vertices
 */
function countConvexVertices(points) {
  let convexCount = 0;
  
  for (let i = 0; i < points.length; i++) {
    const p1 = points[(i - 1 + points.length) % points.length];
    const p2 = points[i];
    const p3 = points[(i + 1) % points.length];
    
    const crossProduct = (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x);
    
    // In a clockwise polygon, convex vertices have positive cross product
    if (crossProduct > EPSILON) {
      convexCount++;
    }
  }
  
  return convexCount;
}

/**
 * Validates that a point array forms a simple closed polygon
 * @param {Array<{x: number, y: number}>} points - Array of points defining the shape
 * @returns {{isValid: boolean, error: string | null}} Validation result
 */
export function isSimplePolygon(points) {
  if (!points || points.length < 4) {
    return { isValid: false, error: "Need at least 4 points for a closed polygon" };
  }
  
  // Check for duplicate consecutive points
  for (let i = 0; i < points.length - 1; i++) {
    if (distance(points[i], points[i + 1]) < EPSILON) {
      return { 
        isValid: false, 
        error: `Duplicate consecutive points found at position ${i + 1}` 
      };
    }
  }
  
  return checkSelfIntersections(points.slice(0, -1));
}

/**
 * Gets a human-readable description of shape validation requirements
 * @returns {string} Description of validation requirements
 */
export function getValidationRequirements() {
  return `Deck shapes must meet the following requirements:
• At least 3 unique corner points
• All corners must be 90° or 45°/135° angles
• All edges must be horizontal, vertical, or at 45°
• No self-intersecting lines
• Shape must be a simple closed polygon`;
}