// structuralValidator.js - Validates structural components stay within deck boundary
// Use this to catch rendering issues early and debug geometry problems

import * as config from "./config.js";

const PIXELS_PER_FOOT = config.PIXELS_PER_FOOT;
const TOLERANCE_PIXELS = 5; // Allow 5 pixels of margin for floating point errors

// ================================================
// POINT-IN-POLYGON (CANONICAL IMPLEMENTATION)
// ================================================

/**
 * Canonical point-in-polygon test using ray casting algorithm.
 * This should be the ONLY implementation used throughout the app.
 * @param {Object} point - Point to test {x, y}
 * @param {Array} polygon - Array of polygon vertices [{x, y}, ...]
 * @returns {boolean} True if point is inside polygon
 */
export function isPointInsidePolygon(point, polygon) {
  if (!point || !polygon || polygon.length < 3) return false;

  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Check if a point is on or near a polygon edge
 * @param {Object} point - Point to test
 * @param {Array} polygon - Polygon vertices
 * @param {number} tolerance - Distance tolerance in pixels
 * @returns {boolean} True if point is on or near an edge
 */
export function isPointOnPolygonEdge(point, polygon, tolerance = TOLERANCE_PIXELS) {
  if (!point || !polygon || polygon.length < 2) return false;

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];

    const dist = pointToSegmentDistance(point, p1, p2);
    if (dist <= tolerance) return true;
  }

  return false;
}

/**
 * Calculate distance from point to line segment
 */
function pointToSegmentDistance(point, segP1, segP2) {
  const dx = segP2.x - segP1.x;
  const dy = segP2.y - segP1.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.sqrt((point.x - segP1.x) ** 2 + (point.y - segP1.y) ** 2);
  }

  let t = ((point.x - segP1.x) * dx + (point.y - segP1.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = segP1.x + t * dx;
  const closestY = segP1.y + t * dy;

  return Math.sqrt((point.x - closestX) ** 2 + (point.y - closestY) ** 2);
}

// ================================================
// COMPONENT VALIDATORS
// ================================================

/**
 * Validate a joist is within deck boundary
 * @param {Object} joist - Joist object with p1, p2 properties
 * @param {Array} deckPoints - Deck polygon vertices
 * @returns {Object} Validation result {valid, issues}
 */
export function validateJoist(joist, deckPoints) {
  const issues = [];

  if (!joist || !joist.p1 || !joist.p2) {
    return { valid: false, issues: ['Invalid joist object - missing p1 or p2'] };
  }

  const p1Valid = isPointInsidePolygon(joist.p1, deckPoints) ||
                  isPointOnPolygonEdge(joist.p1, deckPoints);
  const p2Valid = isPointInsidePolygon(joist.p2, deckPoints) ||
                  isPointOnPolygonEdge(joist.p2, deckPoints);

  if (!p1Valid) {
    issues.push(`Joist p1 (${joist.p1.x.toFixed(1)}, ${joist.p1.y.toFixed(1)}) is outside deck boundary`);
  }
  if (!p2Valid) {
    issues.push(`Joist p2 (${joist.p2.x.toFixed(1)}, ${joist.p2.y.toFixed(1)}) is outside deck boundary`);
  }

  // Check for zero-length joists
  const length = Math.sqrt((joist.p2.x - joist.p1.x) ** 2 + (joist.p2.y - joist.p1.y) ** 2);
  if (length < TOLERANCE_PIXELS) {
    issues.push(`Joist has near-zero length (${(length / PIXELS_PER_FOOT).toFixed(2)} ft)`);
  }

  // Check for excessively long joists (probably an error)
  const lengthFeet = length / PIXELS_PER_FOOT;
  if (lengthFeet > 30) {
    issues.push(`Joist is unusually long (${lengthFeet.toFixed(1)} ft) - possible calculation error`);
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Validate a beam is within deck boundary
 * @param {Object} beam - Beam object with p1, p2 properties
 * @param {Array} deckPoints - Deck polygon vertices
 * @returns {Object} Validation result {valid, issues}
 */
export function validateBeam(beam, deckPoints) {
  const issues = [];

  if (!beam || !beam.p1 || !beam.p2) {
    return { valid: false, issues: ['Invalid beam object - missing p1 or p2'] };
  }

  // Beams can extend slightly outside for cantilever, so use larger tolerance
  const beamTolerance = TOLERANCE_PIXELS + (2 * PIXELS_PER_FOOT); // Allow 2ft cantilever

  const p1Valid = isPointInsidePolygon(beam.p1, deckPoints) ||
                  isPointOnPolygonEdge(beam.p1, deckPoints, beamTolerance);
  const p2Valid = isPointInsidePolygon(beam.p2, deckPoints) ||
                  isPointOnPolygonEdge(beam.p2, deckPoints, beamTolerance);

  if (!p1Valid) {
    issues.push(`Beam p1 (${beam.p1.x.toFixed(1)}, ${beam.p1.y.toFixed(1)}) extends beyond deck boundary`);
  }
  if (!p2Valid) {
    issues.push(`Beam p2 (${beam.p2.x.toFixed(1)}, ${beam.p2.y.toFixed(1)}) extends beyond deck boundary`);
  }

  // Check beam length
  const length = Math.sqrt((beam.p2.x - beam.p1.x) ** 2 + (beam.p2.y - beam.p1.y) ** 2);
  const lengthFeet = length / PIXELS_PER_FOOT;

  if (lengthFeet > 40) {
    issues.push(`Beam is unusually long (${lengthFeet.toFixed(1)} ft) - possible calculation error`);
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Validate a rim joist is on the deck perimeter
 * @param {Object} rimJoist - Rim joist object with p1, p2 properties
 * @param {Array} deckPoints - Deck polygon vertices
 * @returns {Object} Validation result {valid, issues}
 */
export function validateRimJoist(rimJoist, deckPoints) {
  const issues = [];

  if (!rimJoist || !rimJoist.p1 || !rimJoist.p2) {
    return { valid: false, issues: ['Invalid rim joist object - missing p1 or p2'] };
  }

  // Rim joists should be ON the perimeter (on edges), not inside
  const p1OnEdge = isPointOnPolygonEdge(rimJoist.p1, deckPoints, TOLERANCE_PIXELS * 2);
  const p2OnEdge = isPointOnPolygonEdge(rimJoist.p2, deckPoints, TOLERANCE_PIXELS * 2);

  if (!p1OnEdge && !isPointInsidePolygon(rimJoist.p1, deckPoints)) {
    issues.push(`Rim joist p1 (${rimJoist.p1.x.toFixed(1)}, ${rimJoist.p1.y.toFixed(1)}) is outside deck boundary`);
  }
  if (!p2OnEdge && !isPointInsidePolygon(rimJoist.p2, deckPoints)) {
    issues.push(`Rim joist p2 (${rimJoist.p2.x.toFixed(1)}, ${rimJoist.p2.y.toFixed(1)}) is outside deck boundary`);
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Validate a post is within deck boundary
 * @param {Object} post - Post object with x, y properties
 * @param {Array} deckPoints - Deck polygon vertices
 * @returns {Object} Validation result {valid, issues}
 */
export function validatePost(post, deckPoints) {
  const issues = [];

  if (!post || post.x === undefined || post.y === undefined) {
    return { valid: false, issues: ['Invalid post object - missing x or y'] };
  }

  const postPoint = { x: post.x, y: post.y };
  const isValid = isPointInsidePolygon(postPoint, deckPoints) ||
                  isPointOnPolygonEdge(postPoint, deckPoints, TOLERANCE_PIXELS * 3);

  if (!isValid) {
    issues.push(`Post at (${post.x.toFixed(1)}, ${post.y.toFixed(1)}) is outside deck boundary`);
  }

  return { valid: issues.length === 0, issues };
}

// ================================================
// FULL STRUCTURE VALIDATION
// ================================================

/**
 * Validate all structural components against the deck boundary
 * @param {Object} components - Structural components object
 * @param {Array} deckPoints - Deck polygon vertices
 * @returns {Object} Validation report
 */
export function validateStructuralComponents(components, deckPoints) {
  const report = {
    valid: true,
    joistIssues: [],
    beamIssues: [],
    rimJoistIssues: [],
    postIssues: [],
    summary: ''
  };

  if (!components || !deckPoints || deckPoints.length < 3) {
    report.valid = false;
    report.summary = 'Invalid components or deck points';
    return report;
  }

  // Validate joists
  if (components.joists && Array.isArray(components.joists)) {
    components.joists.forEach((joist, index) => {
      const result = validateJoist(joist, deckPoints);
      if (!result.valid) {
        report.joistIssues.push({ index, issues: result.issues });
        report.valid = false;
      }
    });
  }

  // Validate beams
  if (components.beams && Array.isArray(components.beams)) {
    components.beams.forEach((beam, index) => {
      const result = validateBeam(beam, deckPoints);
      if (!result.valid) {
        report.beamIssues.push({ index, issues: result.issues });
        report.valid = false;
      }
    });
  }

  // Validate rim joists
  if (components.rimJoists && Array.isArray(components.rimJoists)) {
    components.rimJoists.forEach((rimJoist, index) => {
      const result = validateRimJoist(rimJoist, deckPoints);
      if (!result.valid) {
        report.rimJoistIssues.push({ index, issues: result.issues });
        report.valid = false;
      }
    });
  }

  // Validate posts
  if (components.posts && Array.isArray(components.posts)) {
    components.posts.forEach((post, index) => {
      const result = validatePost(post, deckPoints);
      if (!result.valid) {
        report.postIssues.push({ index, issues: result.issues });
        report.valid = false;
      }
    });
  }

  // Generate summary
  const totalIssues = report.joistIssues.length + report.beamIssues.length +
                      report.rimJoistIssues.length + report.postIssues.length;

  if (totalIssues === 0) {
    report.summary = 'All structural components validated successfully';
  } else {
    report.summary = `Found ${totalIssues} component(s) with boundary issues: ` +
      `${report.joistIssues.length} joists, ${report.beamIssues.length} beams, ` +
      `${report.rimJoistIssues.length} rim joists, ${report.postIssues.length} posts`;
  }

  return report;
}

// ================================================
// DEBUG VISUALIZATION
// ================================================

/**
 * Draw debug overlay highlighting problematic components
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} validationReport - Report from validateStructuralComponents
 * @param {Object} components - The structural components
 * @param {number} scale - Current viewport scale
 */
export function drawValidationDebugOverlay(ctx, validationReport, components, scale) {
  if (!validationReport || validationReport.valid) return;

  ctx.save();

  // Draw invalid joists in red
  if (validationReport.joistIssues.length > 0 && components.joists) {
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.lineWidth = Math.max(4, 4 / scale);
    ctx.setLineDash([10 / scale, 5 / scale]);

    validationReport.joistIssues.forEach(issue => {
      const joist = components.joists[issue.index];
      if (joist && joist.p1 && joist.p2) {
        ctx.beginPath();
        ctx.moveTo(joist.p1.x, joist.p1.y);
        ctx.lineTo(joist.p2.x, joist.p2.y);
        ctx.stroke();

        // Draw X at problem endpoints
        drawProblemMarker(ctx, joist.p1, scale);
        drawProblemMarker(ctx, joist.p2, scale);
      }
    });
  }

  // Draw invalid beams in orange
  if (validationReport.beamIssues.length > 0 && components.beams) {
    ctx.strokeStyle = 'rgba(255, 165, 0, 0.8)';
    ctx.lineWidth = Math.max(6, 6 / scale);
    ctx.setLineDash([15 / scale, 5 / scale]);

    validationReport.beamIssues.forEach(issue => {
      const beam = components.beams[issue.index];
      if (beam && beam.p1 && beam.p2) {
        ctx.beginPath();
        ctx.moveTo(beam.p1.x, beam.p1.y);
        ctx.lineTo(beam.p2.x, beam.p2.y);
        ctx.stroke();

        drawProblemMarker(ctx, beam.p1, scale);
        drawProblemMarker(ctx, beam.p2, scale);
      }
    });
  }

  // Draw invalid rim joists in magenta
  if (validationReport.rimJoistIssues.length > 0 && components.rimJoists) {
    ctx.strokeStyle = 'rgba(255, 0, 255, 0.8)';
    ctx.lineWidth = Math.max(3, 3 / scale);
    ctx.setLineDash([8 / scale, 4 / scale]);

    validationReport.rimJoistIssues.forEach(issue => {
      const rim = components.rimJoists[issue.index];
      if (rim && rim.p1 && rim.p2) {
        ctx.beginPath();
        ctx.moveTo(rim.p1.x, rim.p1.y);
        ctx.lineTo(rim.p2.x, rim.p2.y);
        ctx.stroke();

        drawProblemMarker(ctx, rim.p1, scale);
        drawProblemMarker(ctx, rim.p2, scale);
      }
    });
  }

  // Draw invalid posts as red circles
  if (validationReport.postIssues.length > 0 && components.posts) {
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.strokeStyle = 'rgba(255, 0, 0, 1)';
    ctx.lineWidth = 2 / scale;
    ctx.setLineDash([]);

    validationReport.postIssues.forEach(issue => {
      const post = components.posts[issue.index];
      if (post) {
        ctx.beginPath();
        ctx.arc(post.x, post.y, 15 / scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    });
  }

  ctx.restore();
}

/**
 * Draw an X marker at a problem point
 */
function drawProblemMarker(ctx, point, scale) {
  const size = 10 / scale;
  ctx.strokeStyle = 'rgba(255, 0, 0, 1)';
  ctx.lineWidth = 2 / scale;
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.moveTo(point.x - size, point.y - size);
  ctx.lineTo(point.x + size, point.y + size);
  ctx.moveTo(point.x + size, point.y - size);
  ctx.lineTo(point.x - size, point.y + size);
  ctx.stroke();
}

// ================================================
// CONSOLE LOGGING
// ================================================

/**
 * Log validation report to console with formatted output
 * @param {Object} report - Validation report
 */
export function logValidationReport(report) {
  if (report.valid) {
    console.log('%c✓ Structural Validation Passed', 'color: green; font-weight: bold');
    return;
  }

  console.group('%c⚠ Structural Validation Issues Found', 'color: orange; font-weight: bold');
  console.log(report.summary);

  if (report.joistIssues.length > 0) {
    console.group(`Joist Issues (${report.joistIssues.length})`);
    report.joistIssues.forEach(issue => {
      console.log(`Joist #${issue.index}:`, issue.issues.join(', '));
    });
    console.groupEnd();
  }

  if (report.beamIssues.length > 0) {
    console.group(`Beam Issues (${report.beamIssues.length})`);
    report.beamIssues.forEach(issue => {
      console.log(`Beam #${issue.index}:`, issue.issues.join(', '));
    });
    console.groupEnd();
  }

  if (report.rimJoistIssues.length > 0) {
    console.group(`Rim Joist Issues (${report.rimJoistIssues.length})`);
    report.rimJoistIssues.forEach(issue => {
      console.log(`Rim #${issue.index}:`, issue.issues.join(', '));
    });
    console.groupEnd();
  }

  if (report.postIssues.length > 0) {
    console.group(`Post Issues (${report.postIssues.length})`);
    report.postIssues.forEach(issue => {
      console.log(`Post #${issue.index}:`, issue.issues.join(', '));
    });
    console.groupEnd();
  }

  console.groupEnd();
}

// ================================================
// LINE-POLYGON INTERSECTION (for clipping)
// ================================================

/**
 * Find intersection point of two line segments
 * @param {Object} p1 - Start of first segment
 * @param {Object} p2 - End of first segment
 * @param {Object} p3 - Start of second segment
 * @param {Object} p4 - End of second segment
 * @returns {Object|null} Intersection point or null
 */
function lineSegmentIntersection(p1, p2, p3, p4) {
  const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
  if (Math.abs(denom) < 1e-10) return null; // Parallel lines

  const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
  const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;

  // Check if intersection is within both segments (with small tolerance)
  const tolerance = 0.001;
  if (ua >= -tolerance && ua <= 1 + tolerance && ub >= -tolerance && ub <= 1 + tolerance) {
    return {
      x: p1.x + ua * (p2.x - p1.x),
      y: p1.y + ua * (p2.y - p1.y),
      t: ua // Parameter along first segment
    };
  }
  return null;
}

/**
 * Find all intersections of a line segment with polygon edges
 * @param {Object} segP1 - Start point of segment
 * @param {Object} segP2 - End point of segment
 * @param {Array} polygon - Polygon vertices
 * @returns {Array} Array of intersection points with t parameter
 */
function findLinePolygonIntersections(segP1, segP2, polygon) {
  const intersections = [];

  for (let i = 0; i < polygon.length; i++) {
    const edgeP1 = polygon[i];
    const edgeP2 = polygon[(i + 1) % polygon.length];

    const intersection = lineSegmentIntersection(segP1, segP2, edgeP1, edgeP2);
    if (intersection) {
      intersection.edgeIndex = i;
      intersections.push(intersection);
    }
  }

  // Sort by t parameter (position along the segment)
  intersections.sort((a, b) => a.t - b.t);
  return intersections;
}

// ================================================
// AUTO-CORRECTION FUNCTIONS
// ================================================

/**
 * Clip a line segment to stay within polygon boundary
 * @param {Object} p1 - Start point
 * @param {Object} p2 - End point
 * @param {Array} polygon - Polygon vertices
 * @returns {Object|null} Clipped segment {p1, p2} or null if entirely outside
 */
export function clipSegmentToPolygon(p1, p2, polygon) {
  if (!p1 || !p2 || !polygon || polygon.length < 3) return null;

  const p1Inside = isPointInsidePolygon(p1, polygon) || isPointOnPolygonEdge(p1, polygon);
  const p2Inside = isPointInsidePolygon(p2, polygon) || isPointOnPolygonEdge(p2, polygon);

  // Both inside - no clipping needed
  if (p1Inside && p2Inside) {
    return { p1: { ...p1 }, p2: { ...p2 }, clipped: false };
  }

  // Find intersections with polygon edges
  const intersections = findLinePolygonIntersections(p1, p2, polygon);

  if (intersections.length === 0) {
    // No intersections - segment is entirely outside (or entirely inside which we already handled)
    if (!p1Inside && !p2Inside) {
      return null; // Entirely outside
    }
    return { p1: { ...p1 }, p2: { ...p2 }, clipped: false };
  }

  // One point inside, one outside - clip to intersection
  if (p1Inside && !p2Inside) {
    // Keep p1, clip p2 to first intersection going from p1 towards p2
    const closestIntersection = intersections[0];
    return {
      p1: { ...p1 },
      p2: { x: closestIntersection.x, y: closestIntersection.y },
      clipped: true,
      clippedEnd: 'p2'
    };
  }

  if (!p1Inside && p2Inside) {
    // Clip p1 to last intersection going from p1 towards p2
    const closestIntersection = intersections[intersections.length - 1];
    return {
      p1: { x: closestIntersection.x, y: closestIntersection.y },
      p2: { ...p2 },
      clipped: true,
      clippedEnd: 'p1'
    };
  }

  // Both outside but line passes through polygon
  if (intersections.length >= 2) {
    return {
      p1: { x: intersections[0].x, y: intersections[0].y },
      p2: { x: intersections[intersections.length - 1].x, y: intersections[intersections.length - 1].y },
      clipped: true,
      clippedEnd: 'both'
    };
  }

  return null;
}

/**
 * Auto-correct structural components that escape boundary
 * Returns new components object with corrections applied
 * @param {Object} components - Original structural components
 * @param {Array} deckPoints - Deck polygon vertices
 * @returns {Object} Corrected components and correction report
 */
export function autoCorrectComponents(components, deckPoints) {
  const corrections = {
    joistsClipped: 0,
    joistsRemoved: 0,
    beamsClipped: 0,
    beamsRemoved: 0,
    rimJoistsClipped: 0,
    rimJoistsRemoved: 0,
    postsRemoved: 0
  };

  if (!components || !deckPoints || deckPoints.length < 3) {
    return { components, corrections, success: false };
  }

  const corrected = { ...components };

  // Correct joists
  if (components.joists && Array.isArray(components.joists)) {
    corrected.joists = [];
    components.joists.forEach(joist => {
      if (!joist || !joist.p1 || !joist.p2) return;

      const clipped = clipSegmentToPolygon(joist.p1, joist.p2, deckPoints);
      if (clipped) {
        // Check minimum length (at least 6 inches)
        const length = Math.sqrt(
          (clipped.p2.x - clipped.p1.x) ** 2 +
          (clipped.p2.y - clipped.p1.y) ** 2
        );
        if (length >= PIXELS_PER_FOOT * 0.5) {
          corrected.joists.push({
            ...joist,
            p1: clipped.p1,
            p2: clipped.p2,
            _wasClipped: clipped.clipped
          });
          if (clipped.clipped) corrections.joistsClipped++;
        } else {
          corrections.joistsRemoved++;
        }
      } else {
        corrections.joistsRemoved++;
      }
    });
  }

  // Correct beams (allow slight extension for cantilever)
  if (components.beams && Array.isArray(components.beams)) {
    corrected.beams = [];
    components.beams.forEach(beam => {
      if (!beam || !beam.p1 || !beam.p2) return;

      // Create expanded polygon for beams (2ft cantilever allowance)
      const expandedPolygon = expandPolygon(deckPoints, 2 * PIXELS_PER_FOOT);
      const clipped = clipSegmentToPolygon(beam.p1, beam.p2, expandedPolygon);

      if (clipped) {
        const length = Math.sqrt(
          (clipped.p2.x - clipped.p1.x) ** 2 +
          (clipped.p2.y - clipped.p1.y) ** 2
        );
        if (length >= PIXELS_PER_FOOT) {
          corrected.beams.push({
            ...beam,
            p1: clipped.p1,
            p2: clipped.p2,
            _wasClipped: clipped.clipped
          });
          if (clipped.clipped) corrections.beamsClipped++;
        } else {
          corrections.beamsRemoved++;
        }
      } else {
        corrections.beamsRemoved++;
      }
    });
  }

  // Correct rim joists
  if (components.rimJoists && Array.isArray(components.rimJoists)) {
    corrected.rimJoists = [];
    components.rimJoists.forEach(rim => {
      if (!rim || !rim.p1 || !rim.p2) return;

      const clipped = clipSegmentToPolygon(rim.p1, rim.p2, deckPoints);
      if (clipped) {
        const length = Math.sqrt(
          (clipped.p2.x - clipped.p1.x) ** 2 +
          (clipped.p2.y - clipped.p1.y) ** 2
        );
        if (length >= PIXELS_PER_FOOT * 0.25) {
          corrected.rimJoists.push({
            ...rim,
            p1: clipped.p1,
            p2: clipped.p2,
            _wasClipped: clipped.clipped
          });
          if (clipped.clipped) corrections.rimJoistsClipped++;
        } else {
          corrections.rimJoistsRemoved++;
        }
      } else {
        corrections.rimJoistsRemoved++;
      }
    });
  }

  // Remove posts outside boundary
  if (components.posts && Array.isArray(components.posts)) {
    corrected.posts = components.posts.filter(post => {
      if (!post || post.x === undefined || post.y === undefined) return false;

      const postPoint = { x: post.x, y: post.y };
      const isValid = isPointInsidePolygon(postPoint, deckPoints) ||
                      isPointOnPolygonEdge(postPoint, deckPoints, TOLERANCE_PIXELS * 3);

      if (!isValid) corrections.postsRemoved++;
      return isValid;
    });
  }

  const totalCorrections = corrections.joistsClipped + corrections.joistsRemoved +
                           corrections.beamsClipped + corrections.beamsRemoved +
                           corrections.rimJoistsClipped + corrections.rimJoistsRemoved +
                           corrections.postsRemoved;

  return {
    components: corrected,
    corrections,
    success: true,
    hadCorrections: totalCorrections > 0
  };
}

/**
 * Expand polygon outward by a distance (for cantilever allowance)
 * Simple implementation - just offsets each vertex along the normal
 * @param {Array} polygon - Original polygon vertices
 * @param {number} distance - Distance to expand
 * @returns {Array} Expanded polygon
 */
function expandPolygon(polygon, distance) {
  if (!polygon || polygon.length < 3) return polygon;

  const expanded = [];
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const prev = polygon[(i - 1 + n) % n];
    const curr = polygon[i];
    const next = polygon[(i + 1) % n];

    // Calculate edge normals
    const edge1 = { x: curr.x - prev.x, y: curr.y - prev.y };
    const edge2 = { x: next.x - curr.x, y: next.y - curr.y };

    // Normalize and get outward normals (perpendicular)
    const len1 = Math.sqrt(edge1.x ** 2 + edge1.y ** 2) || 1;
    const len2 = Math.sqrt(edge2.x ** 2 + edge2.y ** 2) || 1;

    const normal1 = { x: -edge1.y / len1, y: edge1.x / len1 };
    const normal2 = { x: -edge2.y / len2, y: edge2.x / len2 };

    // Average the normals for the corner
    const avgNormal = {
      x: (normal1.x + normal2.x) / 2,
      y: (normal1.y + normal2.y) / 2
    };

    const avgLen = Math.sqrt(avgNormal.x ** 2 + avgNormal.y ** 2) || 1;

    expanded.push({
      x: curr.x + (avgNormal.x / avgLen) * distance,
      y: curr.y + (avgNormal.y / avgLen) * distance
    });
  }

  return expanded;
}

/**
 * Log auto-correction results
 * @param {Object} result - Result from autoCorrectComponents
 */
export function logAutoCorrections(result) {
  if (!result.hadCorrections) {
    console.log('%c✓ No auto-corrections needed', 'color: green');
    return;
  }

  const c = result.corrections;
  console.group('%c⚙ Auto-Corrections Applied', 'color: blue; font-weight: bold');

  if (c.joistsClipped > 0) console.log(`  Joists clipped: ${c.joistsClipped}`);
  if (c.joistsRemoved > 0) console.log(`  Joists removed (too short/outside): ${c.joistsRemoved}`);
  if (c.beamsClipped > 0) console.log(`  Beams clipped: ${c.beamsClipped}`);
  if (c.beamsRemoved > 0) console.log(`  Beams removed: ${c.beamsRemoved}`);
  if (c.rimJoistsClipped > 0) console.log(`  Rim joists clipped: ${c.rimJoistsClipped}`);
  if (c.rimJoistsRemoved > 0) console.log(`  Rim joists removed: ${c.rimJoistsRemoved}`);
  if (c.postsRemoved > 0) console.log(`  Posts removed: ${c.postsRemoved}`);

  console.groupEnd();
}
