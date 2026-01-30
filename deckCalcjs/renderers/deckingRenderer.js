// deckingRenderer.js - Decking board rendering functions
// Extracted from canvasLogic.js for better modularity

import * as config from "../config.js";

// ================================================
// MAIN ENTRY POINT
// ================================================

/**
 * Draw decking boards on the canvas
 * @param {CanvasRenderingContext2D} currentCtx - Canvas context
 * @param {Array} points - Deck polygon points
 * @param {Object} deckDimensions - Deck dimensions {minX, maxX, minY, maxY}
 * @param {Object} deckingState - Decking configuration state
 * @param {number} scale - Current viewport scale
 * @param {boolean} isScaledForPrint - Whether rendering for print
 */
export function drawDeckingBoards(currentCtx, points, deckDimensions, deckingState, scale, isScaledForPrint) {
  if (!points || points.length < 3 || !deckDimensions || !deckingState) return;
  if (!deckingState.showBoardLines) return;

  const { material, boardDirection, pictureFrame, breakerBoards = [] } = deckingState;
  const { minX, maxX, minY, maxY } = deckDimensions;

  // Board dimensions (5/4x6 = 5.5" actual width)
  const boardWidthInches = 5.5;
  const gapInches = 0.1875; // 3/16" gap between boards
  const boardWidthPx = boardWidthInches / 12 * config.PIXELS_PER_FOOT;
  const gapPx = gapInches / 12 * config.PIXELS_PER_FOOT;
  const boardSpacing = boardWidthPx + gapPx;

  // Picture frame border width (one board width per layer)
  const pictureFrameWidth = boardWidthPx + gapPx;
  const pictureFrameOffset = pictureFrame === 'double' ? pictureFrameWidth * 2 :
                             pictureFrame === 'single' ? pictureFrameWidth : 0;

  // Material-specific colors
  const materialColors = getMaterialColors(material);

  const scaledLineWidth = (width) => Math.max(0.5 / scale, width / scale);

  currentCtx.save();

  // Create clipping path from deck polygon
  currentCtx.beginPath();
  currentCtx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    currentCtx.lineTo(points[i].x, points[i].y);
  }
  currentCtx.closePath();
  currentCtx.clip();

  // Draw main deck boards
  if (boardDirection === 'horizontal') {
    drawHorizontalBoards(currentCtx, minX, maxX, minY, maxY, pictureFrameOffset,
                         boardWidthPx, gapPx, materialColors, scale);
  } else if (boardDirection === 'diagonal') {
    drawDiagonalBoardsClipped(currentCtx, points, minX, maxX, minY, maxY, pictureFrameOffset,
                              boardWidthPx, gapPx, materialColors, scale);
  }

  // Draw picture frame border
  if (pictureFrame !== 'none') {
    drawPictureFrameBorderClipped(currentCtx, points, pictureFrame, materialColors, scaledLineWidth);
  }

  // Draw breaker boards
  if (breakerBoards.length > 0) {
    drawBreakerBoards(currentCtx, breakerBoards, deckDimensions, scale, scaledLineWidth);
  }

  currentCtx.restore();
}

// ================================================
// MATERIAL COLORS
// ================================================

/**
 * Get material-specific colors and patterns
 * @param {string} material - Material type ('pt', 'cedar', 'composite')
 * @returns {Object} Color configuration object
 */
export function getMaterialColors(material) {
  const colors = {
    pt: {
      boardFill: 'rgb(139, 105, 70)',
      boardVariance: 15,
      boardStroke: 'rgb(101, 75, 50)',
      grainColor: 'rgba(90, 65, 40, 0.3)',
      knotColor: 'rgba(70, 50, 30, 0.5)',
      hasKnots: true,
      hasGrain: true,
      grainIntensity: 0.4
    },
    cedar: {
      boardFill: 'rgb(180, 130, 90)',
      boardVariance: 20,
      boardStroke: 'rgb(140, 95, 60)',
      grainColor: 'rgba(120, 80, 50, 0.35)',
      knotColor: 'rgba(100, 65, 35, 0.5)',
      hasKnots: true,
      hasGrain: true,
      grainIntensity: 0.5
    },
    composite: {
      boardFill: 'rgb(120, 100, 85)',
      boardVariance: 5,
      boardStroke: 'rgb(90, 75, 60)',
      grainColor: 'rgba(100, 85, 70, 0.15)',
      knotColor: null,
      hasKnots: false,
      hasGrain: true,
      grainIntensity: 0.2
    }
  };
  return colors[material] || colors.pt;
}

// ================================================
// BOARD DRAWING FUNCTIONS
// ================================================

/**
 * Draw horizontal deck boards
 */
function drawHorizontalBoards(ctx, minX, maxX, minY, maxY, offset, boardWidth, gap, colors, scale) {
  const startX = minX + offset;
  const endX = maxX - offset;
  const startY = minY + offset;
  const endY = maxY - offset;
  const boardSpacing = boardWidth + gap;

  let boardIndex = 0;
  let y = startY;

  while (y < endY) {
    const boardEndY = Math.min(y + boardWidth, endY);
    drawSingleBoard(ctx, startX - 50, y, endX - startX + 100, boardEndY - y,
                    colors, boardIndex, scale, 'horizontal');
    boardIndex++;
    y += boardSpacing;
  }
}

/**
 * Draw diagonal deck boards with clipping
 */
function drawDiagonalBoardsClipped(ctx, points, minX, maxX, minY, maxY, offset, boardWidth, gap, colors, scale) {
  const startY = minY + offset;
  const endY = maxY - offset;
  const startX = minX + offset;
  const endX = maxX - offset;

  const boardSpacing = boardWidth + gap;
  const deckWidth = endX - startX;
  const deckHeight = endY - startY;
  const totalDiagDistance = deckWidth + deckHeight;

  let boardIndex = 0;

  for (let diagOffset = 0; diagOffset < totalDiagDistance + boardWidth * 2; diagOffset += boardSpacing) {
    const perpOffsetX = boardWidth / Math.sqrt(2);
    const perpOffsetY = boardWidth / Math.sqrt(2);

    let x1Start, y1Start;
    if (diagOffset < deckHeight) {
      x1Start = startX;
      y1Start = startY + diagOffset;
    } else {
      x1Start = startX + (diagOffset - deckHeight);
      y1Start = endY;
    }

    const lineLength = Math.min(endX - x1Start, y1Start - startY);
    const safeExtension = Math.min(boardWidth, Math.min(endX - x1Start - lineLength, y1Start - startY - lineLength));
    let x1End = x1Start + lineLength + Math.max(0, safeExtension);
    let y1End = y1Start - lineLength - Math.max(0, safeExtension);

    drawDiagonalBoard(ctx, x1Start, y1Start, x1End, y1End, boardWidth, colors, boardIndex, scale);
    boardIndex++;
  }
}

/**
 * Draw a single horizontal board with texture
 */
function drawSingleBoard(ctx, x, y, width, height, colors, boardIndex, scale, direction) {
  const seed = boardIndex * 12345;
  const random = (offset) => {
    const val = Math.sin(seed + offset) * 10000;
    return val - Math.floor(val);
  };

  // Vary base color per board
  const variance = colors.boardVariance;
  const rVar = (random(1) - 0.5) * variance;
  const gVar = (random(2) - 0.5) * variance;
  const bVar = (random(3) - 0.5) * variance;

  const baseColor = parseRGB(colors.boardFill);
  const boardColor = `rgb(${clamp(baseColor.r + rVar, 0, 255)}, ${clamp(baseColor.g + gVar, 0, 255)}, ${clamp(baseColor.b + bVar, 0, 255)})`;

  // Draw board fill
  ctx.fillStyle = boardColor;
  ctx.fillRect(x, y, width, height);

  // Draw wood grain
  if (colors.hasGrain) {
    ctx.strokeStyle = colors.grainColor;
    ctx.lineWidth = Math.max(0.5, 1 / scale);

    const grainCount = Math.floor(height / 3) + 2;
    for (let i = 0; i < grainCount; i++) {
      const grainY = y + (i / grainCount) * height + (random(10 + i) - 0.5) * 2;
      const waveAmplitude = random(20 + i) * 3;

      ctx.beginPath();
      ctx.moveTo(x, grainY);
      for (let gx = x; gx < x + width; gx += 20) {
        const waveY = grainY + Math.sin(gx * 0.02 + random(30 + i) * 10) * waveAmplitude;
        ctx.lineTo(gx, waveY);
      }
      ctx.stroke();
    }
  }

  // Draw knots
  if (colors.hasKnots && random(100) > 0.7) {
    const knotX = x + random(101) * width * 0.8 + width * 0.1;
    const knotY = y + random(102) * height * 0.6 + height * 0.2;
    const knotRadius = (random(103) * 3 + 2) / scale;

    ctx.fillStyle = colors.knotColor;
    ctx.beginPath();
    ctx.ellipse(knotX, knotY, knotRadius * 1.2, knotRadius, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = colors.knotColor;
    ctx.lineWidth = Math.max(0.5, 0.8 / scale);
    ctx.beginPath();
    ctx.ellipse(knotX, knotY, knotRadius * 2, knotRadius * 1.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Draw board edge
  ctx.strokeStyle = colors.boardStroke;
  ctx.lineWidth = Math.max(1, 1.5 / scale);
  ctx.beginPath();
  ctx.moveTo(x, y + height);
  ctx.lineTo(x + width, y + height);
  ctx.stroke();
}

/**
 * Draw a single diagonal board as a parallelogram
 */
function drawDiagonalBoard(ctx, x1, y1, x2, y2, boardWidth, colors, boardIndex, scale) {
  const seed = boardIndex * 12345;
  const random = (offset) => {
    const val = Math.sin(seed + offset) * 10000;
    return val - Math.floor(val);
  };

  const perpX = boardWidth / Math.sqrt(2);
  const perpY = boardWidth / Math.sqrt(2);

  const corners = [
    { x: x1, y: y1 },
    { x: x2, y: y2 },
    { x: x2 + perpX, y: y2 + perpY },
    { x: x1 + perpX, y: y1 + perpY }
  ];

  // Vary base color
  const variance = colors.boardVariance;
  const rVar = (random(1) - 0.5) * variance;
  const gVar = (random(2) - 0.5) * variance;
  const bVar = (random(3) - 0.5) * variance;

  const baseColor = parseRGB(colors.boardFill);
  const boardColor = `rgb(${clamp(baseColor.r + rVar, 0, 255)}, ${clamp(baseColor.g + gVar, 0, 255)}, ${clamp(baseColor.b + bVar, 0, 255)})`;

  // Draw fill
  ctx.fillStyle = boardColor;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  ctx.lineTo(corners[1].x, corners[1].y);
  ctx.lineTo(corners[2].x, corners[2].y);
  ctx.lineTo(corners[3].x, corners[3].y);
  ctx.closePath();
  ctx.fill();

  // Draw grain
  if (colors.hasGrain) {
    ctx.strokeStyle = colors.grainColor;
    ctx.lineWidth = Math.max(0.5, 1 / scale);

    const grainCount = 4;
    for (let i = 0; i < grainCount; i++) {
      const t = (i + 0.5) / grainCount;
      const grainX1 = x1 + perpX * t + (random(10 + i) - 0.5) * 2;
      const grainY1 = y1 + perpY * t + (random(11 + i) - 0.5) * 2;
      const grainX2 = x2 + perpX * t + (random(12 + i) - 0.5) * 2;
      const grainY2 = y2 + perpY * t + (random(13 + i) - 0.5) * 2;

      ctx.beginPath();
      ctx.moveTo(grainX1, grainY1);
      ctx.lineTo(grainX2, grainY2);
      ctx.stroke();
    }
  }

  // Draw knots
  if (colors.hasKnots && random(100) > 0.75) {
    const t = random(101) * 0.6 + 0.2;
    const s = random(102) * 0.6 + 0.2;
    const knotX = x1 + (x2 - x1) * t + perpX * s;
    const knotY = y1 + (y2 - y1) * t + perpY * s;
    const knotRadius = (random(103) * 3 + 2) / scale;

    ctx.fillStyle = colors.knotColor;
    ctx.beginPath();
    ctx.ellipse(knotX, knotY, knotRadius * 1.2, knotRadius, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw edge
  ctx.strokeStyle = colors.boardStroke;
  ctx.lineWidth = Math.max(1, 1.5 / scale);
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  ctx.lineTo(corners[1].x, corners[1].y);
  ctx.stroke();
}

// ================================================
// PICTURE FRAME RENDERING
// ================================================

/**
 * Draw picture frame border with proper clipping
 */
function drawPictureFrameBorderClipped(currentCtx, points, pictureFrame, colors, scaledLineWidth) {
  const boardWidthInches = 5.5;
  const boardWidthPx = boardWidthInches / 12 * config.PIXELS_PER_FOOT;
  const gapWidthPx = 0.125 / 12 * config.PIXELS_PER_FOOT;

  const numBoards = pictureFrame === 'double' ? 2 : 1;

  // Darken colors for picture frame
  const baseColor = colors.boardFill || 'rgb(139, 105, 70)';
  const rgbMatch = baseColor.match(/\d+/g);
  const darkenFactor = 0.7;
  const boardFill = rgbMatch
    ? `rgb(${Math.round(rgbMatch[0] * darkenFactor)}, ${Math.round(rgbMatch[1] * darkenFactor)}, ${Math.round(rgbMatch[2] * darkenFactor)})`
    : 'rgb(97, 74, 49)';
  const boardStroke = rgbMatch
    ? `rgb(${Math.round(rgbMatch[0] * 0.5)}, ${Math.round(rgbMatch[1] * 0.5)}, ${Math.round(rgbMatch[2] * 0.5)})`
    : 'rgb(70, 53, 35)';

  // Determine winding order
  let windingSum = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    windingSum += (p2.x - p1.x) * (p2.y + p1.y);
  }
  const windingSign = windingSum >= 0 ? -1 : 1;

  // Draw boards
  for (let boardNum = 0; boardNum < numBoards; boardNum++) {
    const outerInset = boardNum * (boardWidthPx + gapWidthPx);
    const innerInset = (boardNum + 1) * (boardWidthPx + gapWidthPx) - gapWidthPx;

    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;

      const perpX = (-dy / len) * windingSign;
      const perpY = (dx / len) * windingSign;

      const outer1X = p1.x + perpX * outerInset;
      const outer1Y = p1.y + perpY * outerInset;
      const outer2X = p2.x + perpX * outerInset;
      const outer2Y = p2.y + perpY * outerInset;
      const inner1X = p1.x + perpX * innerInset;
      const inner1Y = p1.y + perpY * innerInset;
      const inner2X = p2.x + perpX * innerInset;
      const inner2Y = p2.y + perpY * innerInset;

      currentCtx.fillStyle = boardFill;
      currentCtx.beginPath();
      currentCtx.moveTo(outer1X, outer1Y);
      currentCtx.lineTo(outer2X, outer2Y);
      currentCtx.lineTo(inner2X, inner2Y);
      currentCtx.lineTo(inner1X, inner1Y);
      currentCtx.closePath();
      currentCtx.fill();

      currentCtx.strokeStyle = boardStroke;
      currentCtx.lineWidth = scaledLineWidth(1);
      currentCtx.setLineDash([]);
      currentCtx.stroke();
    }
  }

  // Draw inner edge line
  currentCtx.strokeStyle = boardStroke;
  currentCtx.lineWidth = scaledLineWidth(1.5);
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) continue;

    const perpX = (-dy / len) * windingSign;
    const perpY = (dx / len) * windingSign;
    const totalInset = numBoards * (boardWidthPx + gapWidthPx);

    currentCtx.beginPath();
    currentCtx.moveTo(p1.x + perpX * totalInset, p1.y + perpY * totalInset);
    currentCtx.lineTo(p2.x + perpX * totalInset, p2.y + perpY * totalInset);
    currentCtx.stroke();
  }
}

// ================================================
// BREAKER BOARDS
// ================================================

/**
 * Draw breaker board lines
 */
function drawBreakerBoards(currentCtx, breakerBoards, deckDimensions, scale, scaledLineWidth) {
  const { minX, maxX, minY } = deckDimensions;

  currentCtx.strokeStyle = 'rgba(45, 106, 106, 0.6)';
  currentCtx.lineWidth = scaledLineWidth(2);
  currentCtx.setLineDash([scaledLineWidth(8), scaledLineWidth(4)]);

  breakerBoards.forEach(breaker => {
    const y = minY + (breaker.position * config.PIXELS_PER_FOOT);

    currentCtx.beginPath();
    currentCtx.moveTo(minX - 5, y);
    currentCtx.lineTo(maxX + 5, y);
    currentCtx.stroke();

    // Draw label
    currentCtx.save();
    currentCtx.setLineDash([]);
    currentCtx.font = `${12 / scale}px sans-serif`;
    currentCtx.fillStyle = 'rgba(45, 106, 106, 0.8)';
    currentCtx.textAlign = 'right';
    currentCtx.fillText(`${breaker.position}' breaker`, minX - 10, y + 4 / scale);
    currentCtx.restore();
  });

  currentCtx.setLineDash([]);
}

// ================================================
// UTILITY FUNCTIONS
// ================================================

/**
 * Parse RGB color string to components
 */
function parseRGB(colorStr) {
  const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (match) {
    return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
  }
  return { r: 139, g: 105, b: 70 };
}

/**
 * Clamp value between min and max
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
