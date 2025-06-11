// canvasLogic.js (v9 - Fix Interactive Grid, Print Grid Coverage, Larger Print Icons/Fonts, Dim Padding)
import * as config from "./config.js";
import * as utils from "./utils.js";

// --- Module State (Private) ---
let ctx = null;
let canvasElement = null;
let canvasContainerElement = null;

// Callbacks to app.js
let onCanvasClickCallback = null;
let onMouseMoveCallback = null;
let onMouseDownCallback = null;
let onMouseUpCallback = null;
let onCanvasResizeCallback = null;

// --- Initialization ---
export function initializeCanvas(
  canvasEl,
  containerEl,
  onClick,
  onMouseMove,
  onMouseDown,
  onMouseUp,
  onResize
) {
  if (!canvasEl || !containerEl) {
    console.error(
      "Canvas or Container element not provided for initialization."
    );
    return;
  }
  canvasElement = canvasEl;
  canvasContainerElement = containerEl;
  ctx = canvasElement.getContext("2d");

  onCanvasClickCallback = onClick;
  onMouseMoveCallback = onMouseMove;
  onMouseDownCallback = onMouseDown;
  onMouseUpCallback = onMouseUp;
  onCanvasResizeCallback = onResize;

  if (!ctx) {
    console.error("Failed to get 2D context from canvas.");
    return;
  }

  resizeCanvas();

  if (!canvasElement.dataset.listenersAdded) {
    canvasElement.addEventListener("click", handleCanvasClickInternal);
    canvasElement.addEventListener("mousemove", handleMouseMoveInternal);
    canvasElement.addEventListener("mousedown", handleMouseDownInternal);
    canvasElement.addEventListener("mouseup", handleMouseUpInternal);

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const newWidth = Math.round(entry.contentRect.width);
        const newHeight = Math.round(entry.contentRect.height);
        if (
          canvasElement.width !== newWidth ||
          canvasElement.height !== newHeight
        ) {
          resizeCanvas();
          if (onCanvasResizeCallback) {
            onCanvasResizeCallback();
          }
        }
      }
    });
    resizeObserver.observe(canvasContainerElement);
    canvasElement.dataset.listenersAdded = "true";
  }
}

function resizeCanvas() {
  if (!canvasContainerElement || !canvasElement || !ctx) return;

  const containerWidth = canvasContainerElement.offsetWidth;
  const containerHeight = canvasContainerElement.offsetHeight;

  if (containerWidth > 0 && containerHeight > 0) {
    if (
      canvasElement.width !== containerWidth ||
      canvasElement.height !== containerHeight
    ) {
      canvasElement.width = containerWidth;
      canvasElement.height = containerHeight;
    }
  }
}

// --- Drawing Functions ---
function drawGrid(
  currentCtx,
  scale,
  modelMinX,
  modelMaxX,
  modelMinY,
  modelMaxY,
  isPrint = false
) {
  if (!currentCtx || scale === 0) return;

  currentCtx.save();
  
  // 1" grid lines are now invisible as requested, but we'll keep the grid calculation 
  // logic for snapping functionality
  const fineGridStep = config.GRID_SPACING_PIXELS;
  
  // Calculate grid bounds (used only for snapping, not drawing)
  const startGridX = Math.floor(modelMinX / fineGridStep) * fineGridStep;
  const endGridX = Math.ceil(modelMaxX / fineGridStep) * fineGridStep;
  const startGridY = Math.floor(modelMinY / fineGridStep) * fineGridStep;
  const endGridY = Math.ceil(modelMaxY / fineGridStep) * fineGridStep;

  // Draw the 12" grid lines (major grid for foot increments)
  const footGridStep = config.PIXELS_PER_FOOT; // 24 pixels = 1 foot
  const majorDesiredLineWidth = isPrint ? 0.75 : 0.8;
  currentCtx.lineWidth = Math.max(0.2, majorDesiredLineWidth / scale);
  currentCtx.strokeStyle = isPrint ? "#DDDDDD" : "#E0E0E0"; // Lighter gray for foot grid

  // Calculate start/end for foot grid
  const startFootX = Math.floor(modelMinX / footGridStep) * footGridStep;
  const endFootX = Math.ceil(modelMaxX / footGridStep) * footGridStep;
  const startFootY = Math.floor(modelMinY / footGridStep) * footGridStep;
  const endFootY = Math.ceil(modelMaxY / footGridStep) * footGridStep;

  // Draw 12" (1 foot) grid lines
  for (
    let currentModelX = startFootX;
    currentModelX <= endFootX;
    currentModelX += footGridStep
  ) {
    currentCtx.beginPath();
    currentCtx.moveTo(currentModelX, startFootY);
    currentCtx.lineTo(currentModelX, endFootY);
    currentCtx.stroke();
  }
  for (
    let currentModelY = startFootY;
    currentModelY <= endFootY;
    currentModelY += footGridStep
  ) {
    currentCtx.beginPath();
    currentCtx.moveTo(startFootX, currentModelY);
    currentCtx.lineTo(endFootX, currentModelY);
    currentCtx.stroke();
  }

  currentCtx.restore();
}


function drawDeckContent(currentCtx, state) {
  const {
    points = [],
    isShapeClosed = false,
    selectedWallIndices = [],
    wallSelectionMode = false,
    structuralComponents = null,
    stairs = [],
    isDraggingStairs = false,
    draggedStairIndex = -1,
    selectedStairIndex = -1,
    deckDimensions = null,
    currentModelMousePos,
    isDrawing = false,
    viewportScale,
    isScaledForPrint = false,
  } = state;

  const effectiveScale = isScaledForPrint
    ? state.printArgs?.scale || viewportScale
    : viewportScale;
  if (effectiveScale === 0) return;

  const scaledLineWidth = (width) =>
    Math.max(0.5 / effectiveScale, width / effectiveScale);

  if (points.length > 0) {
    currentCtx.strokeStyle = config.DECK_OUTLINE_COLOR;
    currentCtx.lineWidth = scaledLineWidth(2);
    currentCtx.beginPath();
    currentCtx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++)
      currentCtx.lineTo(points[i].x, points[i].y);

    if (isShapeClosed) {
      currentCtx.closePath();
      currentCtx.stroke();
      if (selectedWallIndices.length > 0) {
        // Highlight all selected walls (both during and after selection)
        selectedWallIndices.forEach(wallIndex => {
          highlightWall(
            currentCtx,
            points,
            wallIndex,
            false,
            effectiveScale
          );
        });
      }
    } else {
      currentCtx.stroke();
      if (
        isDrawing &&
        currentModelMousePos &&
        points.length > 0 &&
        !isScaledForPrint
      ) {
        currentCtx.strokeStyle = config.DECK_OUTLINE_COLOR;
        currentCtx.lineWidth = scaledLineWidth(1);
        currentCtx.setLineDash([scaledLineWidth(5), scaledLineWidth(5)]);
        currentCtx.beginPath();
        currentCtx.moveTo(
          points[points.length - 1].x,
          points[points.length - 1].y
        );
        const snappedPreviewPos = getSnappedPos(
          currentModelMousePos.x,
          currentModelMousePos.y,
          points,
          isShapeClosed
        );
        currentCtx.lineTo(snappedPreviewPos.x, snappedPreviewPos.y);
        currentCtx.stroke();
        currentCtx.setLineDash([]);
        displayDimension(
          currentCtx,
          points[points.length - 1],
          snappedPreviewPos,
          deckDimensions,
          effectiveScale,
          isScaledForPrint
        );
      }
    }
  }

  if (!isScaledForPrint && points.length > 0) {
    currentCtx.fillStyle = config.DECK_OUTLINE_COLOR;
    const pointRadiusModel = 3 / effectiveScale;
    points.forEach((p) => {
      currentCtx.beginPath();
      currentCtx.arc(p.x, p.y, pointRadiusModel, 0, Math.PI * 2);
      currentCtx.fill();
    });
  }

  // Draw decomposition shading (behind structural elements but above grid)
  if (isShapeClosed && state.showDecompositionShading && state.rectangularSections && state.rectangularSections.length > 0) {
    drawDecompositionShading(
      currentCtx,
      state.rectangularSections,
      effectiveScale
    );
  }

  if (points.length >= 2) {
    drawAllDimensions(
      currentCtx,
      points,
      isShapeClosed,
      deckDimensions,
      effectiveScale,
      isScaledForPrint
    );
  }
  if (isShapeClosed && structuralComponents && !structuralComponents.error) {
    drawStructuralComponentsInternal(
      currentCtx,
      structuralComponents,
      effectiveScale,
      isScaledForPrint,
      state.isBlueprintMode
    );
  }
  if (stairs && stairs.length > 0 && deckDimensions) {
    drawStairsInternal(
      currentCtx,
      stairs,
      isDraggingStairs,
      draggedStairIndex,
      selectedStairIndex,
      deckDimensions,
      effectiveScale,
      isScaledForPrint,
      currentModelMousePos,
      state.hoveredStairIndex || -1,
      structuralComponents,
      points
    );
  }
}

export function redrawCanvas(state) {
  if (!ctx || !canvasElement) {
    console.error("Canvas context or element not available for redraw.");
    return;
  }
  const canvasWidth = canvasElement.width;
  const canvasHeight = canvasElement.height;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  
  // Get blueprint mode setting from state
  const blueprintMode = state.isBlueprintMode || false;

  if (state.isPrinting) {
    console.log("[Print Mode] Active");
    let contentMinX = Infinity,
      contentMaxX = -Infinity,
      contentMinY = Infinity,
      contentMaxY = -Infinity;
    let hasPrintableContent = false;
    const printPadding = config.PIXELS_PER_FOOT * 2.5;

    if (state.deckDimensions && state.points.length > 0) {
      contentMinX = Math.min(contentMinX, state.deckDimensions.minX);
      contentMaxX = Math.max(contentMaxX, state.deckDimensions.maxX);
      contentMinY = Math.min(contentMinY, state.deckDimensions.minY);
      contentMaxY = Math.max(contentMaxY, state.deckDimensions.maxY);
      hasPrintableContent = true;
    }
    if (state.stairs && state.stairs.length > 0) {
      state.stairs.forEach((stair) => {
        if (
          stair.rimP1 &&
          stair.rimP2 &&
          typeof stair.calculatedTotalRunInches === "number" &&
          typeof stair.positionX === "number"
        ) {
          hasPrintableContent = true;
          const stairWidthModel = stair.widthFt * config.PIXELS_PER_FOOT;
          const totalRunModel =
            (stair.calculatedTotalRunInches / 12) * config.PIXELS_PER_FOOT;
          const rimP1 = stair.rimP1;
          const rimP2 = stair.rimP2;
          const rimDx = rimP2.x - rimP1.x;
          const rimDy = rimP2.y - rimP1.y;
          const rimLength =
            Math.sqrt(rimDx * rimDx + rimDy * rimDy) || config.EPSILON;
          let perpX = -rimDy / rimLength;
          let perpY = rimDx / rimLength;
          if (state.deckDimensions) {
            const deckCenterX =
              (state.deckDimensions.minX + state.deckDimensions.maxX) / 2;
            const deckCenterY =
              (state.deckDimensions.minY + state.deckDimensions.maxY) / 2;
            const vecToStairAttachX = stair.positionX - deckCenterX;
            const vecToStairAttachY = stair.positionY - deckCenterY;
            if (perpX * vecToStairAttachX + perpY * vecToStairAttachY < 0) {
              perpX *= -1;
              perpY *= -1;
            }
          }
          const sHalfWidthX = ((rimDx / rimLength) * stairWidthModel) / 2;
          const sHalfWidthY = ((rimDy / rimLength) * stairWidthModel) / 2;
          const corners = [
            {
              x: stair.positionX - sHalfWidthX,
              y: stair.positionY - sHalfWidthY,
            },
            {
              x: stair.positionX + sHalfWidthX,
              y: stair.positionY + sHalfWidthY,
            },
          ];
          corners.push({
            x: corners[0].x + perpX * totalRunModel,
            y: corners[0].y + perpY * totalRunModel,
          });
          corners.push({
            x: corners[1].x + perpX * totalRunModel,
            y: corners[1].y + perpY * totalRunModel,
          });
          corners.forEach((p) => {
            contentMinX = Math.min(contentMinX, p.x);
            contentMaxX = Math.max(contentMaxX, p.x);
            contentMinY = Math.min(contentMinY, p.y);
            contentMaxY = Math.max(contentMaxY, p.y);
          });
        }
      });
    }

    const paddedContentMinX = contentMinX - printPadding;
    const paddedContentMaxX = contentMaxX + printPadding;
    const paddedContentMinY = contentMinY - printPadding;
    const paddedContentMaxY = contentMaxY + printPadding;

    const contentWidth = paddedContentMaxX - paddedContentMinX;
    const contentHeight = paddedContentMaxY - paddedContentMinY;
    console.log(
      `[Print Mode] hasPrintableContent: ${hasPrintableContent}, paddedContentWidth: ${contentWidth}, paddedContentHeight: ${contentHeight}`
    );

    if (
      !hasPrintableContent ||
      contentWidth <= config.EPSILON ||
      contentHeight <= config.EPSILON
    ) {
      console.warn(
        "[Print Mode] No printable content or zero dimensions after padding. Attempting fallback."
      );
      ctx.save();
      ctx.translate(state.viewportOffsetX, state.viewportOffsetY);
      ctx.scale(state.viewportScale, state.viewportScale);
      const modelViewWidth = canvasWidth / state.viewportScale;
      const modelViewHeight = canvasHeight / state.viewportScale;
      
      // Constrain grid to model bounds to match drawable area
      const modelMaxX = config.MODEL_WIDTH_FEET * config.PIXELS_PER_FOOT;
      const modelMaxY = config.MODEL_HEIGHT_FEET * config.PIXELS_PER_FOOT;
      
      drawGrid(
        ctx,
        state.viewportScale,
        0,
        Math.min(modelViewWidth, modelMaxX),
        0,
        Math.min(modelViewHeight, modelMaxY),
        true
      ); // Use 0,0 for offset within transformed context
      drawDeckContent(ctx, {
        ...state,
        isScaledForPrint: true,
        printArgs: { scale: state.viewportScale },
      });
      ctx.restore();
      return;
    }

    const scalePrintX = canvasWidth / contentWidth;
    const scalePrintY = canvasHeight / contentHeight;
    const finalPrintScale = Math.min(scalePrintX, scalePrintY) * 0.9;
    console.log(`[Print Mode] finalPrintScale: ${finalPrintScale}`);

    if (finalPrintScale <= config.EPSILON / 100) {
      console.error(
        "[Print Mode] Calculated print scale is too small or zero. Aborting print draw."
      );
      ctx.font = "16px Arial";
      ctx.fillStyle = "red";
      ctx.textAlign = "center";
      ctx.fillText(
        "Error: Content too large or no content to print.",
        canvasWidth / 2,
        canvasHeight / 2
      );
      return;
    }

    const translateXPrint =
      (canvasWidth - contentWidth * finalPrintScale) / 2 -
      paddedContentMinX * finalPrintScale;
    const translateYPrint =
      (canvasHeight - contentHeight * finalPrintScale) / 2 -
      paddedContentMinY * finalPrintScale;
    console.log(
      `[Print Mode] translateXPrint: ${translateXPrint}, translateYPrint: ${translateYPrint}`
    );

    ctx.save();
    ctx.translate(translateXPrint, translateYPrint);
    ctx.scale(finalPrintScale, finalPrintScale);

    // Draw grid covering the exact model area being printed
    drawGrid(
      ctx,
      finalPrintScale,
      paddedContentMinX,
      paddedContentMaxX,
      paddedContentMinY,
      paddedContentMaxY,
      true
    );

    console.log(
      "[Print Mode] state.points[0] before drawDeckContent:",
      state.points[0]
    );
    drawDeckContent(ctx, {
      ...state,
      isScaledForPrint: true,
      printArgs: { scale: finalPrintScale },
      isBlueprintMode: blueprintMode
    });
    ctx.restore();
  } else {
    // Interactive Mode
    ctx.save();
    ctx.translate(state.viewportOffsetX, state.viewportOffsetY);
    ctx.scale(state.viewportScale, state.viewportScale);
    // Calculate model boundaries visible in interactive mode for grid drawing
    const modelVisibleMinX = (0 - state.viewportOffsetX) / state.viewportScale;
    const modelVisibleMinY = (0 - state.viewportOffsetY) / state.viewportScale;
    const modelVisibleMaxX =
      (canvasWidth - state.viewportOffsetX) / state.viewportScale;
    const modelVisibleMaxY =
      (canvasHeight - state.viewportOffsetY) / state.viewportScale;
      
    // Constrain grid to model bounds to match drawable area
    const modelMaxX = config.MODEL_WIDTH_FEET * config.PIXELS_PER_FOOT;
    const modelMaxY = config.MODEL_HEIGHT_FEET * config.PIXELS_PER_FOOT;
    
    drawGrid(
      ctx,
      state.viewportScale,
      Math.max(0, modelVisibleMinX),
      Math.min(modelVisibleMaxX, modelMaxX),
      Math.max(0, modelVisibleMinY),
      Math.min(modelVisibleMaxY, modelMaxY),
      false
    );
    drawDeckContent(ctx, {
      ...state,
      isBlueprintMode: blueprintMode
    });
    ctx.restore();
  }
}

function displayDimension(
  currentCtx,
  p1,
  p2,
  deckDimensions,
  scale,
  isScaledForPrint = false
) {
  if (!currentCtx || !p1 || !p2 || scale === 0) return;
  
  // Calculate midpoint
  const midXModel = (p1.x + p2.x) / 2;
  const midYModel = (p1.y + p2.y) / 2;
  
  // Calculate delta
  const dxModel = p2.x - p1.x;
  const dyModel = p2.y - p1.y;
  
  // Calculate length and format dimension text
  let lengthModelPixels;
  let dimText;
  
  // Special handling for manual dimension points
  if (p2.isManualDimension === true) {
    // For manual dimensions, use EXACTLY the display dimension that was stored
    if (p2.displayDimension) {
      // Use the exact dimension that was specified by the user
      dimText = p2.displayDimension;
      console.log("DISPLAYING STORED DIMENSION:", dimText);
    } else {
      // Fallback if displayDimension wasn't stored
      if (Math.abs(dyModel) < 0.001) {
        // Pure horizontal line - use X distance only
        lengthModelPixels = Math.abs(dxModel);
      } else if (Math.abs(dxModel) < 0.001) {
        // Pure vertical line - use Y distance only
        lengthModelPixels = Math.abs(dyModel);
      } else {
        // Diagonal line (shouldn't happen with manual dimensions)
        lengthModelPixels = Math.sqrt(dxModel * dxModel + dyModel * dyModel);
      }
      
      // Just use the already calculated exact pixels value if available
      if (p2.exactPixels) {
        lengthModelPixels = p2.exactPixels;
      }
      
      const lengthFeet = lengthModelPixels / config.PIXELS_PER_FOOT;
      dimText = `${Math.floor(lengthFeet)}' ${Math.round((lengthFeet % 1) * 12)}"`;
      console.log("DISPLAYING CALCULATED MANUAL DIMENSION:", dimText);
    }
  } else {
    // Standard dimension calculation for normal points
    lengthModelPixels = Math.sqrt(dxModel * dxModel + dyModel * dyModel);
    
    if (lengthModelPixels < 5 / scale) return;
    
    const lengthFeet = lengthModelPixels / config.PIXELS_PER_FOOT;
    dimText = utils.formatFeetInches(lengthFeet);
  }

  // --- MODIFICATION: Dimension font sizes ---
  const desiredScreenFontSize = isScaledForPrint ? 12 : 14; // Screen: 14, Print: 12
  // --- END MODIFICATION ---
  const actualFontSizeToSet = Math.max(1, desiredScreenFontSize / scale);
  currentCtx.font = `${actualFontSizeToSet}px Arial`;
  currentCtx.fillStyle = "#333333";
  currentCtx.textAlign = "center";
  currentCtx.textBaseline = "bottom";

  const angle = Math.atan2(dyModel, dxModel);
  // --- MODIFICATION: Dimension padding ---
  const screenOffsetDist = isScaledForPrint ? 18 : 22; // Screen: 22, Print: 18
  // --- END MODIFICATION ---
  const modelOffsetDist = screenOffsetDist / scale;

  let perpX = -Math.sin(angle);
  let perpY = Math.cos(angle);

  if (deckDimensions && typeof deckDimensions.minX === "number") {
    const deckCenterX = (deckDimensions.minX + deckDimensions.maxX) / 2;
    const deckCenterY = (deckDimensions.minY + deckDimensions.maxY) / 2;
    const vecToMidX = midXModel - deckCenterX;
    const vecToMidY = midYModel - deckCenterY;
    if (perpX * vecToMidX + perpY * vecToMidY < 0) {
      perpX *= -1;
      perpY *= -1;
    }
  }

  const textXModel = midXModel + perpX * modelOffsetDist;
  const textYModel = midYModel + perpY * modelOffsetDist;

  currentCtx.save();
  currentCtx.translate(textXModel, textYModel);
  let rotationAngle = angle;
  if (rotationAngle > Math.PI / 2 || rotationAngle < -Math.PI / 2) {
    rotationAngle += Math.PI;
  }
  currentCtx.rotate(rotationAngle);
  currentCtx.fillText(dimText, 0, -Math.max(0.5, 2 / scale));
  currentCtx.restore();
}

function drawAllDimensions(
  currentCtx,
  points,
  isShapeClosed,
  deckDimensions,
  scale,
  isScaledForPrint = false
) {
  if (!currentCtx || points.length < 2) return;
  const numSegments = isShapeClosed ? points.length : points.length - 1;
  for (let i = 0; i < numSegments; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    displayDimension(
      currentCtx,
      p1,
      p2,
      deckDimensions,
      scale,
      isScaledForPrint
    );
  }
}

function highlightWall(currentCtx, points, index, isHover, scale) {
  if (!currentCtx || index < 0 || index >= points.length || scale === 0) return;
  const p1 = points[index];
  const p2 = points[(index + 1) % points.length];
  currentCtx.beginPath();
  currentCtx.moveTo(p1.x, p1.y);
  currentCtx.lineTo(p2.x, p2.y);
  currentCtx.strokeStyle = isHover ? "#FFA500" : config.LEDGER_COLOR;
  currentCtx.lineWidth = Math.max(0.5 / scale, 4 / scale);
  currentCtx.stroke();
}

export function getSnappedPos(
  modelMouseX,
  modelMouseY,
  modelPoints,
  isShapeClosed,
  forceOrthogonal = true
) {
  // For the first point, snap to 12" (1 foot) grid
  if (!modelPoints || modelPoints.length === 0) {
    const footGridStep = config.PIXELS_PER_FOOT; // 24 pixels = 1 foot
    let snappedX = Math.round(modelMouseX / footGridStep) * footGridStep;
    let snappedY = Math.round(modelMouseY / footGridStep) * footGridStep;
    return { x: snappedX, y: snappedY };
  }
  
  // For subsequent points, use the 1" grid and enforce orthogonal if needed
  const GSP = config.GRID_SPACING_PIXELS;
  let snappedX = Math.round(modelMouseX / GSP) * GSP;
  let snappedY = Math.round(modelMouseY / GSP) * GSP;

  if (modelPoints && modelPoints.length > 0 && !isShapeClosed && forceOrthogonal) {
    const prevPoint = modelPoints[modelPoints.length - 1];
    const dx = Math.abs(snappedX - prevPoint.x);
    const dy = Math.abs(snappedY - prevPoint.y);
    if (dx < dy) {
      snappedX = prevPoint.x;
    } else {
      snappedY = prevPoint.y;
    }
  }
  return { x: snappedX, y: snappedY };
}

function handleCanvasClickInternal(event) {
  if (onCanvasClickCallback) {
    const rect = canvasElement.getBoundingClientRect();
    onCanvasClickCallback(event.clientX - rect.left, event.clientY - rect.top);
  }
}
function handleMouseMoveInternal(event) {
  if (onMouseMoveCallback) {
    const rect = canvasElement.getBoundingClientRect();
    onMouseMoveCallback(event.clientX - rect.left, event.clientY - rect.top);
  }
}
function handleMouseDownInternal(event) {
  if (onMouseDownCallback) {
    const rect = canvasElement.getBoundingClientRect();
    onMouseDownCallback(
      event.clientX - rect.left,
      event.clientY - rect.top,
      event
    );
  }
}
function handleMouseUpInternal(event) {
  if (onMouseUpCallback) {
    onMouseUpCallback(event);
  }
}

export function findClickedWallIndex(
  modelMouseX,
  modelMouseY,
  modelPoints,
  viewportScale
) {
  if (!modelPoints || modelPoints.length < 2 || viewportScale === 0) return -1;
  const modelTolerance = config.SNAP_TOLERANCE_PIXELS / viewportScale;

  for (let i = 0; i < modelPoints.length; i++) {
    const p1 = modelPoints[i];
    const p2 = modelPoints[(i + 1) % modelPoints.length];
    const minX = Math.min(p1.x, p2.x) - modelTolerance;
    const maxX = Math.max(p1.x, p2.x) + modelTolerance;
    const minY = Math.min(p1.y, p2.y) - modelTolerance;
    const maxY = Math.max(p1.y, p2.y) + modelTolerance;

    if (
      modelMouseX >= minX &&
      modelMouseX <= maxX &&
      modelMouseY >= minY &&
      modelMouseY <= maxY
    ) {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < (config.EPSILON * config.EPSILON) / viewportScale) {
        if (
          utils.distance({ x: modelMouseX, y: modelMouseY }, p1) <
          modelTolerance
        )
          return i;
        continue;
      }
      let t = ((modelMouseX - p1.x) * dx + (modelMouseY - p1.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const closestX = p1.x + t * dx;
      const closestY = p1.y + t * dy;
      if (
        utils.distance(
          { x: modelMouseX, y: modelMouseY },
          { x: closestX, y: closestY }
        ) < modelTolerance
      )
        return i;
    }
  }
  return -1;
}

function drawDecompositionShading(currentCtx, rectangularSections, scale) {
  if (!currentCtx || !rectangularSections || rectangularSections.length === 0 || scale === 0) return;

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

  rectangularSections.forEach((rect, index) => {
    if (!rect.corners || rect.corners.length < 3) return;

    // Fill the rectangle area
    currentCtx.fillStyle = colors[index % colors.length];
    currentCtx.beginPath();
    currentCtx.moveTo(rect.corners[0].x, rect.corners[0].y);
    for (let i = 1; i < rect.corners.length; i++) {
      currentCtx.lineTo(rect.corners[i].x, rect.corners[i].y);
    }
    currentCtx.closePath();
    currentCtx.fill();

    // Draw rectangle border
    currentCtx.strokeStyle = colors[index % colors.length].replace('0.1', '0.5');
    currentCtx.lineWidth = Math.max(0.5 / scale, 2 / scale);
    currentCtx.setLineDash([]);
    currentCtx.stroke();

    // Draw label
    const centerX = rect.corners.reduce((sum, corner) => sum + corner.x, 0) / rect.corners.length;
    const centerY = rect.corners.reduce((sum, corner) => sum + corner.y, 0) / rect.corners.length;
    
    currentCtx.fillStyle = colors[index % colors.length].replace('0.1', '0.8');
    currentCtx.font = `${Math.max(8, 12 / scale)}px Arial`;
    currentCtx.textAlign = 'center';
    currentCtx.textBaseline = 'middle';
    
    const label = `R${index + 1}${rect.isLedgerRectangle ? ' (Ledger)' : ''}`;
    currentCtx.fillText(label, centerX, centerY);
  });
}

function drawRectangleShading(currentCtx, rectangle, colorIndex, scale) {
  if (!currentCtx || !rectangle || !rectangle.corners || scale === 0) return;

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

  const color = colors[colorIndex % colors.length];
  const opacity = Math.min(0.3, Math.max(0.05, 0.2 / scale)); // Adjust opacity based on scale

  currentCtx.fillStyle = color.replace('0.1', opacity.toString());
  currentCtx.beginPath();
  currentCtx.moveTo(rectangle.corners[0].x, rectangle.corners[0].y);
  
  for (let i = 1; i < rectangle.corners.length; i++) {
    currentCtx.lineTo(rectangle.corners[i].x, rectangle.corners[i].y);
  }
  
  currentCtx.closePath();
  currentCtx.fill();
}

function drawStructuralComponentsInternal(
  currentCtx,
  components,
  scale,
  isScaledForPrint,
  isBlueprintMode = false
) {
  if (!currentCtx || !components || components.error || scale === 0) return;
  
  // Performance optimization: early exit for very small scale
  if (scale < 0.01 && !isScaledForPrint) {
    console.log("Skipping detailed structural rendering at very small scale");
    return;
  }
  const {
    ledger,
    beams = [],
    joists = [],
    posts = [],
    footings = [],
    rimJoists = [],
    midSpanBlocking = [],
    pictureFrameBlocking = [],
  } = components;
  const scaledLineWidth = (width) => Math.max(0.5 / scale, width / scale);
  
  // Make isBlueprintMode available to all nested functions
  // Default to false if not explicitly provided
  const blueprintMode = isBlueprintMode || false;
  
  // Actual lumber dimensions in pixels (based on actual 1.5" thickness for 2x lumber)
  const LUMBER_THICKNESS_INCHES = 1.5;
  const LUMBER_THICKNESS_FEET = LUMBER_THICKNESS_INCHES / 12;
  const LUMBER_THICKNESS_PIXELS = LUMBER_THICKNESS_FEET * config.PIXELS_PER_FOOT;
  
  // Draw to-scale components based on their actual dimensions
  function drawToScaleLine(p1, p2, width, color, isDashed = false, lineWidthMultiplier = 1.0) {
    if (!p1 || !p2) return;
    
    // Calculate perpendicular unit vector for thickness
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length < config.EPSILON) return;
    
    // Normalized perpendicular vector
    const perpX = -dy / length;
    const perpY = dx / length;
    
    // Half width for offset calculation
    const halfWidth = width / 2;
    
    // Calculate the four corners of the rectangle
    const corners = [
      { x: p1.x + perpX * halfWidth, y: p1.y + perpY * halfWidth },
      { x: p2.x + perpX * halfWidth, y: p2.y + perpY * halfWidth },
      { x: p2.x - perpX * halfWidth, y: p2.y - perpY * halfWidth },
      { x: p1.x - perpX * halfWidth, y: p1.y - perpY * halfWidth }
    ];
    
    // In blueprint mode, draw hollow to-scale components; otherwise draw simple lines
    if (blueprintMode) {
      // Draw outline only (no fill) - to-scale width components
      currentCtx.strokeStyle = color;
      currentCtx.lineWidth = Math.max(0.5 / scale, (1 * lineWidthMultiplier) / scale);
      currentCtx.beginPath();
      currentCtx.moveTo(corners[0].x, corners[0].y);
      currentCtx.lineTo(corners[1].x, corners[1].y);
      currentCtx.lineTo(corners[2].x, corners[2].y);
      currentCtx.lineTo(corners[3].x, corners[3].y);
      currentCtx.closePath();
      
      if (isDashed) {
        currentCtx.setLineDash([scaledLineWidth(4), scaledLineWidth(4)]);
      } else {
        currentCtx.setLineDash([]);
      }
      currentCtx.stroke();
      currentCtx.setLineDash([]);
    } else {
      // Draw simple centerline (default mode)
      currentCtx.strokeStyle = color;
      currentCtx.lineWidth = Math.max(0.5 / scale, (1.5 * lineWidthMultiplier) / scale);
      
      if (isDashed) {
        currentCtx.setLineDash([scaledLineWidth(4), scaledLineWidth(4)]);
      } else {
        currentCtx.setLineDash([]);
      }
      
      currentCtx.beginPath();
      currentCtx.moveTo(p1.x, p1.y);
      currentCtx.lineTo(p2.x, p2.y);
      currentCtx.stroke();
      currentCtx.setLineDash([]);
    }
  }
  
  // Draw multiple boards side by side (for multi-ply beams)
  function drawMultiplyBoard(p1, p2, plyCount, color, isMerged = false) {
    if (!p1 || !p2 || plyCount < 1) return;
    
    // Direction vector along the board
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length < config.EPSILON) return;
    
    // Normalized perpendicular vector
    const perpX = -dy / length;
    const perpY = dx / length;
    
    // Draw each ply
    for (let i = 0; i < plyCount; i++) {
      // Offset each board by its thickness
      const offset = i * LUMBER_THICKNESS_PIXELS;
      const offsetP1 = {
        x: p1.x + perpX * offset,
        y: p1.y + perpY * offset
      };
      const offsetP2 = {
        x: p2.x + perpX * offset,
        y: p2.y + perpY * offset
      };
      
      // Draw individual board with enhanced styling for merged beams
      if (isMerged && i === 0) {
        // Draw first ply of merged beam with slightly thicker line to indicate merging
        drawToScaleLine(offsetP1, offsetP2, LUMBER_THICKNESS_PIXELS, color, false, 1.5);
      } else {
        drawToScaleLine(offsetP1, offsetP2, LUMBER_THICKNESS_PIXELS, color);
      }
    }
  }

  // Draw ledger (typically a single 2x board against the house)
  if (ledger) {
    drawToScaleLine(ledger.p1, ledger.p2, LUMBER_THICKNESS_PIXELS, config.LEDGER_COLOR);
  }
  
  // Draw beams (typically 2-ply or 3-ply)
  // Enhanced for multi-section: merged beams may be longer and span multiple sections
  beams.forEach((beam) => {
    // Default to 2-ply if not specified
    const plyCount = beam.ply || 2;
    
    // Enhanced beam rendering for multi-section structures
    if (beam.isMerged) {
      // Draw merged beams with slightly different styling to indicate they span sections
      drawMultiplyBoard(beam.p1, beam.p2, plyCount, config.BEAM_COLOR, true);
    } else {
      drawMultiplyBoard(beam.p1, beam.p2, plyCount, config.BEAM_COLOR);
    }
  });

  // Draw joists (single 2x boards)
  // Enhanced for multi-section: joists may span sections or be section-specific
  currentCtx.strokeStyle = config.JOIST_RIM_COLOR;
  joists.forEach((joist) => {
    // Check if this joist spans multiple sections (indicated by extended length)
    const joistLength = Math.sqrt(
      Math.pow(joist.p2.x - joist.p1.x, 2) + Math.pow(joist.p2.y - joist.p1.y, 2)
    );
    
    // Draw joist with appropriate styling
    if (joist.spansSections) {
      // Draw spanning joists with slightly thicker line to indicate continuity
      drawToScaleLine(joist.p1, joist.p2, LUMBER_THICKNESS_PIXELS, config.JOIST_RIM_COLOR, false, 1.2);
    } else {
      drawToScaleLine(joist.p1, joist.p2, LUMBER_THICKNESS_PIXELS, config.JOIST_RIM_COLOR);
    }
  });
  
  // Draw rim joists (typically single 2x boards around the perimeter)
  // Enhanced for multi-section: rim joists may be merged across sections
  rimJoists.forEach((rim) => {
    if (rim.isMerged) {
      // Draw merged rim joists with enhanced styling to show continuity
      drawToScaleLine(rim.p1, rim.p2, LUMBER_THICKNESS_PIXELS, config.JOIST_RIM_COLOR, false, 1.3);
    } else {
      drawToScaleLine(rim.p1, rim.p2, LUMBER_THICKNESS_PIXELS, config.JOIST_RIM_COLOR);
    }
  });

  // Draw blocking (typically single 2x boards between joists)
  midSpanBlocking.forEach((block) => {
    drawToScaleLine(block.p1, block.p2, LUMBER_THICKNESS_PIXELS, config.BLOCKING_COLOR, true);
  });
  
  // Draw picture frame blocking
  pictureFrameBlocking.forEach((block) => {
    drawToScaleLine(block.p1, block.p2, LUMBER_THICKNESS_PIXELS, config.BLOCKING_COLOR, true);
  });

  // Draw footings
  // Enhanced for multi-section: footings are deduplicated at shared locations
  const footingScreenRadius = isScaledForPrint ? 7 : 8;
  const footingModelRadius = footingScreenRadius / scale;
  footings.forEach((f) => {
    currentCtx.beginPath();
    
    if (blueprintMode) {
      // In blueprint mode, draw a circle representing the footing
      currentCtx.arc(f.x, f.y, footingModelRadius, 0, Math.PI * 2);
      currentCtx.strokeStyle = config.FOOTING_STROKE_COLOR;
      currentCtx.lineWidth = Math.max(0.5 / scale, (f.isShared ? 1.5 : 1) / scale);
      currentCtx.stroke();
      
      // Add visual indicator for shared footings
      if (f.isShared) {
        currentCtx.beginPath();
        currentCtx.arc(f.x, f.y, footingModelRadius * 1.2, 0, Math.PI * 2);
        currentCtx.strokeStyle = config.FOOTING_STROKE_COLOR;
        currentCtx.lineWidth = Math.max(0.3 / scale, 0.5 / scale);
        currentCtx.setLineDash([Math.max(2 / scale, 1), Math.max(2 / scale, 1)]);
        currentCtx.stroke();
        currentCtx.setLineDash([]);
      }
    } else {
      // Normal mode - draw a simple small square
      const smallSize = Math.max(5 / scale, 3 / scale);
      const sizeMultiplier = f.isShared ? 1.2 : 1;
      currentCtx.rect(
        f.x - (smallSize * sizeMultiplier) / 2,
        f.y - (smallSize * sizeMultiplier) / 2,
        smallSize * sizeMultiplier,
        smallSize * sizeMultiplier
      );
      currentCtx.strokeStyle = config.FOOTING_STROKE_COLOR;
      currentCtx.lineWidth = Math.max(0.5 / scale, (f.isShared ? 1.5 : 1) / scale);
      currentCtx.stroke();
    }
  });

  // Draw posts - using actual post dimensions (typically 4x4 or 6x6)
  // Enhanced for multi-section: posts are deduplicated at shared locations
  posts.forEach((p) => {
    // Default to 4x4 if not specified (actual dimensions 3.5" x 3.5")
    const postSizeInches = p.size ? (p.size === "6x6" ? 5.5 : 3.5) : 3.5;
    const postSizeFeet = postSizeInches / 12;
    const postSizePixels = postSizeFeet * config.PIXELS_PER_FOOT;
    
    if (blueprintMode) {
      // In blueprint mode, draw an outline square representing actual post dimensions
      currentCtx.beginPath();
      currentCtx.rect(
        p.x - postSizePixels / 2,
        p.y - postSizePixels / 2,
        postSizePixels,
        postSizePixels
      );
      currentCtx.strokeStyle = config.POST_STROKE_COLOR;
      currentCtx.lineWidth = Math.max(0.5 / scale, (p.isShared ? 1.5 : 1) / scale);
      currentCtx.stroke();
      
      // Add visual indicator for shared posts (from multiple sections)
      if (p.isShared) {
        currentCtx.beginPath();
        currentCtx.rect(
          p.x - (postSizePixels * 1.1) / 2,
          p.y - (postSizePixels * 1.1) / 2,
          postSizePixels * 1.1,
          postSizePixels * 1.1
        );
        currentCtx.strokeStyle = config.POST_STROKE_COLOR;
        currentCtx.lineWidth = Math.max(0.3 / scale, 0.5 / scale);
        currentCtx.setLineDash([Math.max(2 / scale, 1), Math.max(2 / scale, 1)]);
        currentCtx.stroke();
        currentCtx.setLineDash([]);
      }
    } else {
      // Normal mode - draw a small square
      const smallSize = Math.max(6 / scale, 4 / scale);
      const sizeMultiplier = p.isShared ? 1.2 : 1;
      currentCtx.beginPath();
      currentCtx.rect(
        p.x - (smallSize * sizeMultiplier) / 2,
        p.y - (smallSize * sizeMultiplier) / 2,
        smallSize * sizeMultiplier,
        smallSize * sizeMultiplier
      );
      currentCtx.strokeStyle = config.POST_STROKE_COLOR;
      currentCtx.lineWidth = Math.max(0.5 / scale, (p.isShared ? 1.5 : 1) / scale);
      currentCtx.stroke();
    }
  });
}

function drawStairsInternal(
  currentCtx,
  stairsData,
  isBeingDragged,
  draggedIndex,
  selectedIndex,
  deckDimensions,
  scale,
  isScaledForPrint,
  currentModelMousePos,
  hoveredStairIndex = -1,
  structuralComponents = null,
  deckPoints = null
) {
  if (!currentCtx || !stairsData || !deckDimensions || scale === 0) return;
  const scaledLineWidth = (width) => Math.max(0.5 / scale, width / scale);
  const desiredScreenFontSize = isScaledForPrint ? 12 : 14; // Matched to dimensions
  const actualFontSizeToSet = Math.max(1, desiredScreenFontSize / scale);

  stairsData.forEach((stair, index) => {
    if (!stair.rimP1 || !stair.rimP2 || typeof stair.positionX !== "number")
      return;

    const stairWidthPixelsModel = (stair.widthFt || 4) * config.PIXELS_PER_FOOT;
    const totalRunPixelsModel =
      (stair.calculatedTotalRunInches / 12) * config.PIXELS_PER_FOOT;
    const numStringers = stair.calculatedStringerQty;
    const numSteps = stair.calculatedNumSteps;

    const midRimX = stair.positionX;
    const midRimY = stair.positionY;
    
    // Get rim joist direction - ensure consistent ordering
    let rimDx = stair.rimP2.x - stair.rimP1.x;
    let rimDy = stair.rimP2.y - stair.rimP1.y;
    
    // For debugging - log the original rim direction
    if (index === 0 && !isScaledForPrint) {
      console.log(`Original rim P1: (${stair.rimP1.x.toFixed(0)}, ${stair.rimP1.y.toFixed(0)})`);
      console.log(`Original rim P2: (${stair.rimP2.x.toFixed(0)}, ${stair.rimP2.y.toFixed(0)})`);
    }
    
    const rimLength =
      Math.sqrt(rimDx * rimDx + rimDy * rimDy) || config.EPSILON;
    const rimUnitX = rimDx / rimLength;
    const rimUnitY = rimDy / rimLength;

    // Calculate initial perpendicular vector
    // The cross product of rim direction gives us a perpendicular
    // We'll determine the correct direction in the next step
    let perpX = -rimUnitY;
    let perpY = rimUnitX;
    
    // Determine stair direction by testing which side is actually inside the deck polygon
    // We need access to the deck points to do proper point-in-polygon testing
    if (deckPoints && deckPoints.length >= 3) {
      
      // Test points on both sides of the stair edge
      const testDistance = 12; // 0.5 foot in model pixels - closer test point for more accurate detection
      const testPoint1X = midRimX + perpX * testDistance;
      const testPoint1Y = midRimY + perpY * testDistance;
      const testPoint2X = midRimX - perpX * testDistance;
      const testPoint2Y = midRimY - perpY * testDistance;
      
      // Point-in-polygon test function
      function isPointInPolygon(x, y, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
          const xi = polygon[i].x, yi = polygon[i].y;
          const xj = polygon[j].x, yj = polygon[j].y;
          
          if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
            inside = !inside;
          }
        }
        return inside;
      }
      
      const point1Inside = isPointInPolygon(testPoint1X, testPoint1Y, deckPoints);
      const point2Inside = isPointInPolygon(testPoint2X, testPoint2Y, deckPoints);
      
      // Debug logging for stair orientation
      if (index === 0 && !isScaledForPrint) { // Only log for first stair to avoid spam
        console.log(`Stair ${index} orientation debug:`);
        console.log(`  Rim direction: (${rimDx.toFixed(2)}, ${rimDy.toFixed(2)})`);
        console.log(`  Initial perp: (${perpX.toFixed(2)}, ${perpY.toFixed(2)})`);
        console.log(`  Test point 1 (${testPoint1X.toFixed(0)}, ${testPoint1Y.toFixed(0)}): ${point1Inside ? 'INSIDE' : 'OUTSIDE'} deck`);
        console.log(`  Test point 2 (${testPoint2X.toFixed(0)}, ${testPoint2Y.toFixed(0)}): ${point2Inside ? 'INSIDE' : 'OUTSIDE'} deck`);
      }
      
      // Point stairs toward whichever test point is NOT inside the deck polygon
      // The initial perpendicular (perpX, perpY) points to test point 1
      // If test point 1 is INSIDE the deck, we need to flip to point outside
      if (point1Inside && !point2Inside) {
        // Test point 1 is inside, test point 2 is outside
        // We need to flip the perpendicular to point toward test point 2 (outside)
        perpX *= -1;
        perpY *= -1;
        if (index === 0 && !isScaledForPrint) {
          console.log(`  Flipping direction - stairs will point toward test point 2 (outside)`);
        }
      } else if (!point1Inside && point2Inside) {
        // Test point 1 is outside, test point 2 is inside
        // Keep the current direction (already pointing toward test point 1 which is outside)
        if (index === 0 && !isScaledForPrint) {
          console.log(`  Keeping direction - stairs will point toward test point 1 (outside)`);
        }
      } else if (!point1Inside && !point2Inside) {
        // Both points are outside - this might happen at corners
        // Use a more sophisticated approach: check which direction faces away from the deck center
        const deckCenterX = (deckDimensions.minX + deckDimensions.maxX) / 2;
        const deckCenterY = (deckDimensions.minY + deckDimensions.maxY) / 2;
        
        // Vector from deck center to stair position
        const centerToStairX = midRimX - deckCenterX;
        const centerToStairY = midRimY - deckCenterY;
        
        // Dot product to determine if perpendicular is pointing outward
        const dotProduct = perpX * centerToStairX + perpY * centerToStairY;
        
        // If dot product is negative, perpendicular is pointing inward - flip it
        if (dotProduct < 0) {
          perpX *= -1;
          perpY *= -1;
          if (index === 0 && !isScaledForPrint) {
            console.log(`  Both outside - flipping to point outward from deck center`);
          }
        } else {
          if (index === 0 && !isScaledForPrint) {
            console.log(`  Both outside - keeping direction toward test point 1 (farther from center)`);
          }
        }
      } else {
        // Both points are inside - this shouldn't normally happen
        // Fallback to the vector from deck center method
        const deckCenterX = (deckDimensions.minX + deckDimensions.maxX) / 2;
        const deckCenterY = (deckDimensions.minY + deckDimensions.maxY) / 2;
        const vecToRimX = midRimX - deckCenterX;
        const vecToRimY = midRimY - deckCenterY;
        
        // If perpendicular points inward (toward center), flip it
        if (perpX * vecToRimX + perpY * vecToRimY < 0) {
          perpX *= -1;
          perpY *= -1;
          if (index === 0 && !isScaledForPrint) {
            console.log(`  Both inside (unusual) - flipping based on center vector`);
          }
        } else {
          if (index === 0 && !isScaledForPrint) {
            console.log(`  Both inside (unusual) - keeping direction based on center vector`);
          }
        }
      }
      
      if (index === 0 && !isScaledForPrint) {
        console.log(`  Final perp direction: (${perpX.toFixed(2)}, ${perpY.toFixed(2)})`);
      }
    } else {
      // Fallback method when no deck points available
      const deckCenterX = (deckDimensions.minX + deckDimensions.maxX) / 2;
      const deckCenterY = (deckDimensions.minY + deckDimensions.maxY) / 2;
      const vecToRimX = midRimX - deckCenterX;
      const vecToRimY = midRimY - deckCenterY;
      if (perpX * vecToRimX + perpY * vecToRimY < 0) {
        perpX *= -1;
        perpY *= -1;
      }
    }

    const stairRimP1Model = {
      x: midRimX - (rimUnitX * stairWidthPixelsModel) / 2,
      y: midRimY - (rimUnitY * stairWidthPixelsModel) / 2,
    };
    const stairRimP2Model = {
      x: midRimX + (rimUnitX * stairWidthPixelsModel) / 2,
      y: midRimY + (rimUnitY * stairWidthPixelsModel) / 2,
    };

    currentCtx.lineWidth = scaledLineWidth(index === selectedIndex ? 2 : 1);
    currentCtx.strokeStyle =
      index === selectedIndex
        ? config.STAIR_SELECTED_COLOR
        : config.STAIR_STRINGER_COLOR;
    const stringerEndRunOffsetPixelsModel =
      totalRunPixelsModel *
      (stair.calculatedNumRisers > 0
        ? numSteps / stair.calculatedNumRisers
        : 1);
    for (let i = 0; i < numStringers; i++) {
      let attachX, attachY;
      if (numStringers <= 1) {
        attachX = midRimX;
        attachY = midRimY;
      } else {
        const fraction = i / (numStringers - 1);
        attachX =
          stairRimP1Model.x + rimUnitX * stairWidthPixelsModel * fraction;
        attachY =
          stairRimP1Model.y + rimUnitY * stairWidthPixelsModel * fraction;
      }
      const stringerBottomX = attachX + perpX * stringerEndRunOffsetPixelsModel;
      const stringerBottomY = attachY + perpY * stringerEndRunOffsetPixelsModel;
      currentCtx.beginPath();
      currentCtx.moveTo(attachX, attachY);
      currentCtx.lineTo(stringerBottomX, stringerBottomY);
      currentCtx.stroke();
    }
    currentCtx.strokeStyle =
      index === selectedIndex
        ? config.STAIR_SELECTED_COLOR
        : config.STAIR_TREAD_COLOR;
    for (let j = 0; j < numSteps; j++) {
      const runOffsetModel =
        (totalRunPixelsModel * (j + 1)) / (stair.calculatedNumRisers || 1);
      const treadStartX = stairRimP1Model.x + perpX * runOffsetModel;
      const treadStartY = stairRimP1Model.y + perpY * runOffsetModel;
      const treadEndX = stairRimP2Model.x + perpX * runOffsetModel;
      const treadEndY = stairRimP2Model.y + perpY * runOffsetModel;
      currentCtx.beginPath();
      currentCtx.moveTo(treadStartX, treadStartY);
      currentCtx.lineTo(treadEndX, treadEndY);
      currentCtx.stroke();
    }

    currentCtx.font = `${actualFontSizeToSet}px Arial`;
    currentCtx.fillStyle = "#333333";
    currentCtx.textAlign = "center";
    currentCtx.textBaseline = "middle";
    const stairBottomP1 = {
      x: stairRimP1Model.x + perpX * totalRunPixelsModel,
      y: stairRimP1Model.y + perpY * totalRunPixelsModel,
    };
    const stairBottomP2 = {
      x: stairRimP2Model.x + perpX * totalRunPixelsModel,
      y: stairRimP2Model.y + perpY * totalRunPixelsModel,
    };
    const bottomCenterX = (stairBottomP1.x + stairBottomP2.x) / 2;
    const bottomCenterY = (stairBottomP1.y + stairBottomP2.y) / 2;
    const widthText = utils.formatFeetInches(stair.widthFt || 0);
    const modelTextOffset = (isScaledForPrint ? 18 : 22) / scale; // Matching dimension padding
    const textPosX = bottomCenterX + perpX * modelTextOffset;
    const textPosY = bottomCenterY + perpY * modelTextOffset;
    let textAngle = Math.atan2(rimUnitY, rimUnitX);
    if (textAngle > Math.PI / 2 || textAngle < -Math.PI / 2)
      textAngle += Math.PI;
    currentCtx.save();
    currentCtx.translate(textPosX, textPosY);
    currentCtx.rotate(textAngle);
    currentCtx.fillText(widthText, 0, 0);
    currentCtx.restore();

    if (
      isBeingDragged &&
      index === draggedIndex &&
      !isScaledForPrint &&
      currentModelMousePos
    ) {
      const edgeP1 = stair.fullEdgeP1 || stair.rimP1;
      const edgeP2 = stair.fullEdgeP2 || stair.rimP2;
      if (!edgeP1 || !edgeP2) return;
      const distP1ToLeftEdgePixels = utils.distance(edgeP1, {
        x: stairRimP1Model.x,
        y: stairRimP1Model.y,
      });
      const distRightEdgeToP2Pixels = utils.distance(
        { x: stairRimP2Model.x, y: stairRimP2Model.y },
        edgeP2
      );
      const dim1Text = utils.formatFeetInches(
        distP1ToLeftEdgePixels / config.PIXELS_PER_FOOT
      );
      const dim2Text = utils.formatFeetInches(
        distRightEdgeToP2Pixels / config.PIXELS_PER_FOOT
      );
      const dragDimModelOffset = 25 / scale;

      currentCtx.save();
      currentCtx.translate(
        edgeP1.x + perpX * dragDimModelOffset - rimUnitX * (20 / scale),
        edgeP1.y + perpY * dragDimModelOffset - rimUnitY * (20 / scale)
      );
      currentCtx.rotate(textAngle);
      currentCtx.textAlign = "left";
      currentCtx.fillText(dim1Text, 0, -Math.max(0.5, 2 / scale));
      currentCtx.restore();

      currentCtx.save();
      currentCtx.translate(
        edgeP2.x + perpX * dragDimModelOffset + rimUnitX * (20 / scale),
        edgeP2.y + perpY * dragDimModelOffset + rimUnitY * (20 / scale)
      );
      currentCtx.rotate(textAngle);
      currentCtx.textAlign = "right";
      currentCtx.fillText(dim2Text, 0, -Math.max(0.5, 2 / scale));
      currentCtx.restore();
    }

    // Enhanced visual feedback for selected stairs
    if (index === selectedIndex && !isScaledForPrint) {
      // Draw selection outline around the entire stair area
      const outlineCorners = [
        { x: stairRimP1Model.x, y: stairRimP1Model.y },
        { x: stairRimP2Model.x, y: stairRimP2Model.y },
        { x: stairRimP2Model.x + perpX * totalRunPixelsModel, y: stairRimP2Model.y + perpY * totalRunPixelsModel },
        { x: stairRimP1Model.x + perpX * totalRunPixelsModel, y: stairRimP1Model.y + perpY * totalRunPixelsModel }
      ];
      
      currentCtx.save();
      
      // Draw subtle selection background
      currentCtx.fillStyle = "rgba(59, 130, 246, 0.1)"; // Blue with low opacity
      currentCtx.beginPath();
      currentCtx.moveTo(outlineCorners[0].x, outlineCorners[0].y);
      for (let i = 1; i < outlineCorners.length; i++) {
        currentCtx.lineTo(outlineCorners[i].x, outlineCorners[i].y);
      }
      currentCtx.closePath();
      currentCtx.fill();
      
      // Draw selection border
      currentCtx.strokeStyle = config.STAIR_SELECTED_COLOR;
      currentCtx.lineWidth = scaledLineWidth(2);
      currentCtx.setLineDash([scaledLineWidth(8), scaledLineWidth(4)]);
      currentCtx.stroke();
      
      // Draw selection indicator at the top-left corner
      const indicatorSize = Math.max(12 / scale, 8 / scale);
      currentCtx.fillStyle = config.STAIR_SELECTED_COLOR;
      currentCtx.setLineDash([]);
      currentCtx.beginPath();
      currentCtx.arc(outlineCorners[0].x, outlineCorners[0].y, indicatorSize, 0, Math.PI * 2);
      currentCtx.fill();
      
      // Add stair number in the selection indicator
      currentCtx.fillStyle = "white";
      currentCtx.font = `${Math.max(8, 10 / scale)}px Arial`;
      currentCtx.textAlign = "center";
      currentCtx.textBaseline = "middle";
      currentCtx.fillText(index + 1, outlineCorners[0].x, outlineCorners[0].y);
      
      currentCtx.restore();
    } else if (index === hoveredStairIndex && !isScaledForPrint && !isBeingDragged) {
      // Draw subtle hover effect
      const outlineCorners = [
        { x: stairRimP1Model.x, y: stairRimP1Model.y },
        { x: stairRimP2Model.x, y: stairRimP2Model.y },
        { x: stairRimP2Model.x + perpX * totalRunPixelsModel, y: stairRimP2Model.y + perpY * totalRunPixelsModel },
        { x: stairRimP1Model.x + perpX * totalRunPixelsModel, y: stairRimP1Model.y + perpY * totalRunPixelsModel }
      ];
      
      currentCtx.save();
      currentCtx.strokeStyle = "rgba(59, 130, 246, 0.6)";
      currentCtx.lineWidth = scaledLineWidth(1.5);
      currentCtx.setLineDash([scaledLineWidth(4), scaledLineWidth(2)]);
      currentCtx.beginPath();
      currentCtx.moveTo(outlineCorners[0].x, outlineCorners[0].y);
      for (let i = 1; i < outlineCorners.length; i++) {
        currentCtx.lineTo(outlineCorners[i].x, outlineCorners[i].y);
      }
      currentCtx.closePath();
      currentCtx.stroke();
      currentCtx.restore();
    }
    
    // Clear delete button bounds (no longer using hover-based delete)
    stair.deleteButtonBounds = null;
  });
}

export function findClickedRimJoistIndex(
  modelMouseX,
  modelMouseY,
  rimJoists,
  ledger,
  viewportScale
) {
  if (!rimJoists || rimJoists.length === 0 || viewportScale === 0) return -1;
  const modelTolerance = config.SNAP_TOLERANCE_PIXELS / viewportScale;
  let clickedIndex = -1;
  let minDistanceSq = Infinity;

  for (let i = 0; i < rimJoists.length; i++) {
    const rim = rimJoists[i];
    const p1 = rim.p1;
    const p2 = rim.p2;
    if (!p1 || !p2) continue;
    if (ledger) {
      if (
        (utils.distance(p1, ledger.p1) < config.EPSILON &&
          utils.distance(p2, ledger.p2) < config.EPSILON) ||
        (utils.distance(p1, ledger.p2) < config.EPSILON &&
          utils.distance(p2, ledger.p1) < config.EPSILON)
      ) {
        continue;
      }
    }
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < (config.EPSILON * config.EPSILON) / viewportScale) continue;
    let t = ((modelMouseX - p1.x) * dx + (modelMouseY - p1.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const closestX = p1.x + t * dx;
    const closestY = p1.y + t * dy;
    const distSq =
      (modelMouseX - closestX) ** 2 + (modelMouseY - closestY) ** 2;
    if (distSq <= modelTolerance * modelTolerance && distSq < minDistanceSq) {
      minDistanceSq = distSq;
      clickedIndex = i;
    }
  }
  return clickedIndex;
}

export function findHoveredStairIndex(
  modelMouseX,
  modelMouseY,
  stairs,
  deckDimensions,
  viewportScale
) {
  if (!stairs || stairs.length === 0 || !deckDimensions || viewportScale === 0) return -1;

  for (let i = 0; i < stairs.length; i++) {
    if (isPointInStairBounds(modelMouseX, modelMouseY, stairs[i], deckDimensions, viewportScale)) {
      return i;
    }
  }
  return -1;
}

export function isPointInStairDeleteButton(
  modelMouseX,
  modelMouseY,
  stair
) {
  if (!stair || !stair.deleteButtonBounds) return false;
  
  const bounds = stair.deleteButtonBounds;
  const distance = Math.sqrt(
    Math.pow(modelMouseX - bounds.centerX, 2) + 
    Math.pow(modelMouseY - bounds.centerY, 2)
  );
  
  return distance <= bounds.radius;
}

export function isPointInStairBounds(
  modelMouseX,
  modelMouseY,
  stair,
  deckDimensions,
  viewportScale
) {
  if (
    !stair ||
    !deckDimensions ||
    typeof stair.positionX !== "number" ||
    typeof stair.calculatedTotalRunInches !== "number" ||
    viewportScale === 0
  )
    return false;

  const modelClickTolerance =
    (config.SNAP_TOLERANCE_PIXELS * 0.75) / viewportScale;

  const stairWidthModel = (stair.widthFt || 4) * config.PIXELS_PER_FOOT;
  const totalRunModel =
    (stair.calculatedTotalRunInches / 12) * config.PIXELS_PER_FOOT;
  const midRimX = stair.positionX;
  const midRimY = stair.positionY;
  const rimP1 = stair.rimP1;
  const rimP2 = stair.rimP2;
  if (!rimP1 || !rimP2) return false;

  const rimDx = rimP2.x - rimP1.x;
  const rimDy = rimP2.y - rimP1.y;
  const rimLength = Math.sqrt(rimDx * rimDx + rimDy * rimDy) || config.EPSILON;
  const rimUnitX = rimDx / rimLength;
  const rimUnitY = rimDy / rimLength;

  let perpX = -rimUnitY;
  let perpY = rimUnitX;
  const deckCenterX = (deckDimensions.minX + deckDimensions.maxX) / 2;
  const deckCenterY = (deckDimensions.minY + deckDimensions.maxY) / 2;
  const vecToRimX = midRimX - deckCenterX;
  const vecToRimY = midRimY - deckCenterY;
  if (perpX * vecToRimX + perpY * vecToRimY < 0) {
    perpX *= -1;
    perpY *= -1;
  }

  const p = [
    {
      x:
        midRimX -
        (rimUnitX * stairWidthModel) / 2 -
        perpX * modelClickTolerance,
      y:
        midRimY -
        (rimUnitY * stairWidthModel) / 2 -
        perpY * modelClickTolerance,
    },
    {
      x:
        midRimX +
        (rimUnitX * stairWidthModel) / 2 -
        perpX * modelClickTolerance,
      y:
        midRimY +
        (rimUnitY * stairWidthModel) / 2 -
        perpY * modelClickTolerance,
    },
    {
      x:
        midRimX +
        (rimUnitX * stairWidthModel) / 2 +
        perpX * (totalRunModel + modelClickTolerance),
      y:
        midRimY +
        (rimUnitY * stairWidthModel) / 2 +
        perpY * (totalRunModel + modelClickTolerance),
    },
    {
      x:
        midRimX -
        (rimUnitX * stairWidthModel) / 2 +
        perpX * (totalRunModel + modelClickTolerance),
      y:
        midRimY -
        (rimUnitY * stairWidthModel) / 2 +
        perpY * (totalRunModel + modelClickTolerance),
    },
  ];

  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const xi = p[i].x,
      yi = p[i].y;
    const xj = p[j].x,
      yj = p[j].y;
    const intersect =
      yi > modelMouseY !== yj > modelMouseY &&
      modelMouseX < ((xj - xi) * (modelMouseY - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
