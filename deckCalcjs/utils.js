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

  // IMPORTANT: Preserve the closing point if the original shape was closed
  // Many downstream functions (decomposition, validation) expect closed shapes
  // to have a duplicate first/last point
  if (simplified.length > 1 && pointArray.length > 1) {
    const origFirst = pointArray[0];
    const origLast = pointArray[pointArray.length - 1];
    const wasClosedShape = Math.abs(origLast.x - origFirst.x) < tolerance &&
                           Math.abs(origLast.y - origFirst.y) < tolerance;

    if (wasClosedShape) {
      // Ensure simplified shape ends with a copy of the first point
      const simpFirst = simplified[0];
      const simpLast = simplified[simplified.length - 1];
      const isAlreadyClosed = Math.abs(simpLast.x - simpFirst.x) < tolerance &&
                              Math.abs(simpLast.y - simpFirst.y) < tolerance;

      if (!isAlreadyClosed) {
        // Add closing point
        simplified.push({ ...simplified[0] });
      }
    }
  }

  return simplified;
}
