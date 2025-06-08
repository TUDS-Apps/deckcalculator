// utils.js
import { EPSILON } from "./config.js"; // Make sure EPSILON is imported if needed here, or pass it

/**
 * Calculates the Euclidean distance between two points.
 * @param {object} p1 - The first point {x, y}.
 * @param {object} p2 - The second point {x, y}.
 * @returns {number} The distance between p1 and p2.
 */
export function distance(p1, p2) {
  if (
    !p1 ||
    !p2 ||
    typeof p1.x !== "number" ||
    typeof p1.y !== "number" ||
    typeof p2.x !== "number" ||
    typeof p2.y !== "number"
  ) {
    // console.warn("Invalid input to distance function:", p1, p2);
    return 0;
  }
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Parses a feet-inches string (e.g., "3'6\"") or a range ("3'6\" - 4'") into decimal feet.
 * For ranges, returns an object { start: number, end: number }.
 * For single values, returns a number. Returns null if parsing fails.
 * @param {string} feetInchesString The string to parse.
 * @returns {number|object|null} Decimal feet, range object, or null.
 */
export function parseFeetInches(feetInchesString) {
  if (!feetInchesString || typeof feetInchesString !== "string") return null;

  const parseSingle = (val) => {
    if (!val) return null;
    val = val.trim();
    const match = val.match(/^(?:(\d+)')?\s*(?:(\d+)(?:''|"|\\")?)?$/);
    if (match && (match[1] || match[2])) {
      const feet = parseInt(match[1], 10) || 0;
      const inches = parseInt(match[2], 10) || 0;
      if (!match[1] && match[2]) {
        return inches / 12;
      }
      return feet + inches / 12;
    }
    const feetOnlyMatch = val.match(/^(\d+)$/);
    if (feetOnlyMatch) {
      return parseInt(feetOnlyMatch[1], 10);
    }
    return null;
  };

  const rangeMatch = feetInchesString.match(/(.+?)\s*[–-]\s*(.+)/);
  if (rangeMatch) {
    const start = parseSingle(rangeMatch[1]);
    const end = parseSingle(rangeMatch[2]);
    if (start !== null && end !== null) {
      return { start: Math.min(start, end), end: Math.max(start, end) };
    } else {
      return null;
    }
  }

  const singleValue = parseSingle(feetInchesString);
  if (singleValue !== null) {
    return singleValue;
  }

  // console.warn(`Could not parse feet-inches string: "${feetInchesString}"`);
  return null;
}

/**
 * Converts a decimal number (representing inches) into a string
 * with whole inches and a reduced fraction (e.g., "7 5/16").
 * Accuracy is to the nearest 1/denominator.
 * @param {number} decimalValue - The decimal value in inches.
 * @param {number} denominator - The base denominator for the fraction (e.g., 16 for 1/16ths).
 * @returns {string} Formatted string (e.g., "7 5/16"). Returns "0" if input is invalid/zero.
 */
export function decimalToFraction(decimalValue, denominator = 16) {
  if (isNaN(decimalValue) || denominator <= 0) {
    return "0";
  }
  // Use a small epsilon for floating point comparisons near zero
  // Ensure EPSILON is defined/imported or use a small number directly
  const epsilon = typeof EPSILON !== "undefined" ? EPSILON / 100 : 0.0001;
  if (Math.abs(decimalValue) < epsilon) {
    return "0";
  }

  const wholeInches = Math.floor(decimalValue);
  const fractionalPart = decimalValue - wholeInches;

  if (Math.abs(fractionalPart) < epsilon) {
    return `${wholeInches}`; // Return only whole inches
  }

  // Calculate numerator based on the desired denominator
  const numerator = Math.round(fractionalPart * denominator);

  // If rounding makes the numerator 0 or equal to the denominator, adjust
  if (numerator === 0) {
    return `${wholeInches}`; // Fraction rounded to zero
  }
  if (numerator === denominator) {
    return `${wholeInches + 1}`; // Fraction rounded up to the next whole inch
  }

  // Greatest Common Divisor (GCD) function for reducing fractions
  const gcd = (a, b) => {
    a = Math.abs(a);
    b = Math.abs(b);
    if (b === 0) return a;
    return gcd(b, a % b);
  };

  // Reduce the fraction
  const commonDivisor = gcd(numerator, denominator);
  const reducedNumerator = numerator / commonDivisor;
  const reducedDenominator = denominator / commonDivisor;

  let result = "";
  if (wholeInches !== 0) {
    // Include whole part unless it's zero
    result += String(wholeInches) + " ";
  } else if (reducedNumerator < 0) {
    // Handle negative fractions like -1/2 when whole is 0
    result += "-";
  }

  // Add the fractional part
  result +=
    String(Math.abs(reducedNumerator)) + "/" + String(reducedDenominator);

  return result;
}

/**
 * Formats a decimal feet value into a string like "X' Y\"".
 * @param {number} decimalFeet - The length in decimal feet.
 * @returns {string} Formatted string.
 */
export function formatFeetInches(decimalFeet) {
  if (isNaN(decimalFeet) || decimalFeet < 0) return "0' 0\"";
  const totalInches = decimalFeet * 12;
  const feet = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches % 12); // Use let as it might change

  let displayFeet = feet;
  if (inches === 12) {
    displayFeet = feet + 1;
    inches = 0;
  }
  return `${displayFeet}' ${inches}"`;
}

/**
 * Simplifies a polygon outline by removing collinear points.
 * Handles closing point correctly.
 * @param {Array<Object>} pointArray - Array of {x, y} points.
 * @returns {Array<Object>} A new array with redundant points removed.
 */
export function simplifyPoints(pointArray) {
  if (!pointArray || pointArray.length < 3) {
    return [...pointArray]; // No simplification possible/needed
  }

  const simplified = [pointArray[0]]; // Start with the first point

  const tolerance = 0.1; // Tolerance for collinearity check

  // Check points 1 to n-2 against their neighbors
  for (let i = 1; i < pointArray.length - 1; i++) {
    const p1 = simplified[simplified.length - 1]; // Last added point
    const p2 = pointArray[i]; // Current point being checked
    const p3 = pointArray[i + 1]; // Next point

    // Calculate cross product to check for collinearity
    const crossProduct =
      (p2.y - p1.y) * (p3.x - p2.x) - (p2.x - p1.x) * (p3.y - p2.y);

    // Add p2 if it's not collinear with the last added point and the next point
    if (Math.abs(crossProduct) > tolerance) {
      // Avoid adding duplicate points (if user clicked twice in same spot)
      if (p2.x !== p1.x || p2.y !== p1.y) {
        simplified.push(p2);
      }
    }
  }

  // Add the last point of the original array
  const lastOriginalPoint = pointArray[pointArray.length - 1];
  const lastSimplifiedPoint = simplified[simplified.length - 1];
  if (
    lastOriginalPoint.x !== lastSimplifiedPoint.x ||
    lastOriginalPoint.y !== lastSimplifiedPoint.y
  ) {
    simplified.push(lastOriginalPoint);
  }

  // Final checks for collinearity involving the start/end points
  if (simplified.length >= 3) {
    // Check if the last point is collinear with the second-to-last and the first point
    const pN_1 = simplified[simplified.length - 2]; // Second to last
    const pN = simplified[simplified.length - 1]; // Last
    const p1 = simplified[0]; // First
    let crossProductEnd =
      (pN.y - pN_1.y) * (p1.x - pN.x) - (pN.x - pN_1.x) * (p1.y - pN.y);
    if (Math.abs(crossProductEnd) <= tolerance) {
      simplified.pop(); // Remove the last point if collinear
    }

    // Check again in case removing the last point made the new last point collinear
    if (simplified.length >= 3) {
      // Check if the first point is collinear with the (new) last and the second point
      const pN_new = simplified[simplified.length - 1]; // New Last
      const p1_new = simplified[0]; // First
      const p2_new = simplified[1]; // Second
      let crossProductStart =
        (p1_new.y - pN_new.y) * (p2_new.x - p1_new.x) -
        (p1_new.x - pN_new.x) * (p2_new.y - p1_new.y);
      if (Math.abs(crossProductStart) <= tolerance) {
        simplified.shift(); // Remove the first point if collinear
      }
    }
  }

  // Final check: if the last point added is now identical to the first point, remove the last one.
  if (simplified.length > 1) {
    const firstP = simplified[0];
    const lastP = simplified[simplified.length - 1];
    if (
      Math.abs(lastP.x - firstP.x) < tolerance &&
      Math.abs(lastP.y - firstP.y) < tolerance
    ) {
      simplified.pop();
    }
  }

  return simplified;
}

/**
 * Calculates the area of a polygon using the shoelace formula.
 * @param {Array<Object>} points - Array of {x, y} points defining the polygon.
 * @returns {number} The area of the polygon.
 */
export function calculatePolygonArea(points) {
  if (!points || points.length < 3) {
    return 0;
  }

  let area = 0;
  const n = points.length;
  
  // Handle both closed (last point = first point) and open polygons
  const isClosedPolygon = points[0].x === points[n-1].x && points[0].y === points[n-1].y;
  const endIndex = isClosedPolygon ? n - 1 : n;
  
  for (let i = 0; i < endIndex; i++) {
    const j = (i + 1) % endIndex;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  
  return Math.abs(area) / 2;
}

/**
 * Calculates the perimeter of a polygon.
 * @param {Array<Object>} points - Array of {x, y} points defining the polygon.
 * @returns {number} The perimeter of the polygon.
 */
export function calculatePolygonPerimeter(points) {
  if (!points || points.length < 2) {
    return 0;
  }

  let perimeter = 0;
  const n = points.length;
  
  // Handle both closed (last point = first point) and open polygons
  const isClosedPolygon = points[0].x === points[n-1].x && points[0].y === points[n-1].y;
  const endIndex = isClosedPolygon ? n - 1 : n;
  
  for (let i = 0; i < endIndex; i++) {
    const j = (i + 1) % endIndex;
    perimeter += distance(points[i], points[j]);
  }
  
  return perimeter;
}

/**
 * Determines if a point is inside a polygon using the ray casting algorithm.
 * @param {Object} point - The point to test {x, y}.
 * @param {Array<Object>} polygon - Array of {x, y} points defining the polygon.
 * @returns {boolean} True if the point is inside the polygon.
 */
export function isPointInPolygon(point, polygon) {
  if (!point || !polygon || polygon.length < 3) {
    return false;
  }

  const x = point.x;
  const y = point.y;
  let inside = false;
  const n = polygon.length;
  
  // Handle both closed and open polygons
  const isClosedPolygon = polygon[0].x === polygon[n-1].x && polygon[0].y === polygon[n-1].y;
  const endIndex = isClosedPolygon ? n - 1 : n;

  for (let i = 0, j = endIndex - 1; i < endIndex; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Gets the bounding box of a polygon.
 * @param {Array<Object>} points - Array of {x, y} points.
 * @returns {Object} Bounding box with {minX, maxX, minY, maxY, width, height}.
 */
export function getPolygonBounds(points) {
  if (!points || points.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Finds intersection points between a line segment and a polygon.
 * @param {Object} lineStart - Start point of line {x, y}
 * @param {Object} lineEnd - End point of line {x, y}
 * @param {Array<Object>} polygon - Array of {x, y} points defining the polygon
 * @returns {Array<Object>} Array of intersection points with additional info
 */
export function getLinePolygonIntersections(lineStart, lineEnd, polygon) {
  const intersections = [];
  if (!lineStart || !lineEnd || !polygon || polygon.length < 3) {
    return intersections;
  }

  const n = polygon.length;
  const isClosedPolygon = polygon[0].x === polygon[n-1].x && polygon[0].y === polygon[n-1].y;
  const endIndex = isClosedPolygon ? n - 1 : n;

  for (let i = 0; i < endIndex; i++) {
    const j = (i + 1) % endIndex;
    const segStart = polygon[i];
    const segEnd = polygon[j];
    
    const intersection = getLineIntersection(lineStart, lineEnd, segStart, segEnd);
    if (intersection) {
      intersections.push({
        point: intersection,
        polygonEdgeIndex: i,
        distanceFromLineStart: distance(lineStart, intersection)
      });
    }
  }

  // Sort intersections by distance from line start
  intersections.sort((a, b) => a.distanceFromLineStart - b.distanceFromLineStart);
  return intersections;
}

/**
 * Finds intersection point between two line segments.
 * @param {Object} p1 - Start of first line {x, y}
 * @param {Object} p2 - End of first line {x, y}
 * @param {Object} p3 - Start of second line {x, y}
 * @param {Object} p4 - End of second line {x, y}
 * @returns {Object|null} Intersection point or null if no intersection
 */
export function getLineIntersection(p1, p2, p3, p4) {
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;
  const x4 = p4.x, y4 = p4.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  
  if (Math.abs(denom) < 1e-10) {
    return null; // Lines are parallel
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1)
    };
  }

  return null; // No intersection within line segments
}

/**
 * Gets the segments of a line that fall within a polygon.
 * @param {Object} lineStart - Start point of line {x, y}
 * @param {Object} lineEnd - End point of line {x, y}
 * @param {Array<Object>} polygon - Array of {x, y} points defining the polygon
 * @returns {Array<Object>} Array of line segments inside the polygon
 */
export function getLineSegmentsInPolygon(lineStart, lineEnd, polygon) {
  const segments = [];
  const intersections = getLinePolygonIntersections(lineStart, lineEnd, polygon);
  
  if (intersections.length === 0) {
    // No intersections - line is either completely inside or completely outside
    const midPoint = {
      x: (lineStart.x + lineEnd.x) / 2,
      y: (lineStart.y + lineEnd.y) / 2
    };
    
    if (isPointInPolygon(midPoint, polygon)) {
      segments.push({ start: lineStart, end: lineEnd });
    }
    return segments;
  }

  // Check if line start is inside polygon
  const startInside = isPointInPolygon(lineStart, polygon);
  let currentlyInside = startInside;
  let segmentStart = startInside ? lineStart : null;

  for (const intersection of intersections) {
    if (currentlyInside && segmentStart) {
      // End current segment at intersection
      segments.push({ start: segmentStart, end: intersection.point });
      segmentStart = null;
    } else if (!currentlyInside) {
      // Start new segment at intersection
      segmentStart = intersection.point;
    }
    currentlyInside = !currentlyInside;
  }

  // Handle final segment if we're still inside
  if (currentlyInside && segmentStart) {
    segments.push({ start: segmentStart, end: lineEnd });
  }

  return segments;
}
