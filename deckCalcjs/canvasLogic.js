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
    layerVisibility = {
      outline: true,
      ledger: true,
      joists: true,
      beams: true,
      posts: true,
      blocking: true,
      dimensions: true,
      stairs: true
    }
  } = state;

  const effectiveScale = isScaledForPrint
    ? state.printArgs?.scale || viewportScale
    : viewportScale;
  if (effectiveScale === 0) return;

  const scaledLineWidth = (width) =>
    Math.max(0.5 / effectiveScale, width / effectiveScale);

  // Draw outline if visible
  if (points.length > 0 && layerVisibility.outline) {
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
        if (layerVisibility.dimensions) {
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
  }

  // Draw vertex points (tied to outline visibility)
  if (!isScaledForPrint && points.length > 0 && layerVisibility.outline) {
    currentCtx.fillStyle = config.DECK_OUTLINE_COLOR;
    const pointRadiusModel = 3 / effectiveScale;
    points.forEach((p) => {
      currentCtx.beginPath();
      currentCtx.arc(p.x, p.y, pointRadiusModel, 0, Math.PI * 2);
      currentCtx.fill();
    });

    // Draw "close zone" indicator around first point when drawing with 3+ points
    // This helps users know where to click to close the shape
    if (isDrawing && !isShapeClosed && points.length >= 3) {
      const firstPoint = points[0];
      // Close zone radius: 3x snap tolerance (30 screen pixels converted to model coords)
      const closeZoneRadius = (config.SNAP_TOLERANCE_PIXELS * 3) / effectiveScale;

      // Draw a pulsing circle around the first point
      currentCtx.beginPath();
      currentCtx.arc(firstPoint.x, firstPoint.y, closeZoneRadius, 0, Math.PI * 2);
      currentCtx.strokeStyle = '#10b981'; // Green color for "close here"
      currentCtx.lineWidth = 2 / effectiveScale;
      currentCtx.setLineDash([5 / effectiveScale, 5 / effectiveScale]);
      currentCtx.stroke();
      currentCtx.setLineDash([]);

      // Draw a filled circle at first point to make it more prominent
      currentCtx.beginPath();
      currentCtx.arc(firstPoint.x, firstPoint.y, pointRadiusModel * 1.5, 0, Math.PI * 2);
      currentCtx.fillStyle = '#10b981';
      currentCtx.fill();
    }
  }

  // Draw decomposition shading (behind structural elements but above grid)
  if (isShapeClosed && state.showDecompositionShading && state.rectangularSections && state.rectangularSections.length > 0) {
    drawDecompositionShading(
      currentCtx,
      state.rectangularSections,
      effectiveScale
    );
  }

  // Draw dimensions if visible (but NOT in blueprint mode - blueprint has its own dimension system)
  if (points.length >= 2 && layerVisibility.dimensions && !state.isBlueprintMode) {
    drawAllDimensions(
      currentCtx,
      points,
      isShapeClosed,
      deckDimensions,
      effectiveScale,
      isScaledForPrint
    );
  }
  // Draw structural components with layer visibility
  if (isShapeClosed && structuralComponents && !structuralComponents.error) {
    drawStructuralComponentsInternal(
      currentCtx,
      structuralComponents,
      effectiveScale,
      isScaledForPrint,
      state.isBlueprintMode,
      layerVisibility
    );
  }
  // Draw stairs if visible
  if (stairs && stairs.length > 0 && deckDimensions && layerVisibility.stairs) {
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

// Draw blueprint scale indicator in screen coordinates (bottom-left corner)
function drawBlueprintScaleIndicator(currentCtx, canvasWidth, canvasHeight, viewportScale) {
  const padding = 20;
  const boxWidth = 140;
  const boxHeight = 50;
  const x = padding;
  const y = canvasHeight - padding - boxHeight;

  // Draw background box
  currentCtx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  currentCtx.strokeStyle = config.BLUEPRINT_LINE_MEDIUM;
  currentCtx.lineWidth = 1;
  currentCtx.beginPath();
  currentCtx.rect(x, y, boxWidth, boxHeight);
  currentCtx.fill();
  currentCtx.stroke();

  // Calculate current scale
  // At viewportScale = 1, 24 pixels = 1 foot, which is roughly 1/4" = 1'
  // We'll show an approximate architectural scale
  const pixelsPerInch = config.PIXELS_PER_FOOT / 12;
  const screenPixelsPerFoot = config.PIXELS_PER_FOOT * viewportScale;

  // Determine scale text based on viewport scale
  let scaleText;
  if (viewportScale >= 2) {
    scaleText = '1/2" = 1\'-0"';
  } else if (viewportScale >= 1) {
    scaleText = '1/4" = 1\'-0"';
  } else if (viewportScale >= 0.5) {
    scaleText = '1/8" = 1\'-0"';
  } else if (viewportScale >= 0.25) {
    scaleText = '1/16" = 1\'-0"';
  } else {
    scaleText = 'NTS'; // Not to scale
  }

  // Draw scale text
  currentCtx.font = 'bold 11px Arial';
  currentCtx.fillStyle = config.BLUEPRINT_TEXT;
  currentCtx.textAlign = 'left';
  currentCtx.textBaseline = 'top';
  currentCtx.fillText(`SCALE: ${scaleText}`, x + 8, y + 6);

  // Draw graphic scale bar
  const barY = y + 28;
  const barStartX = x + 8;
  const feetToShow = viewportScale >= 0.5 ? 4 : 8; // Show 4' or 8' depending on zoom
  const barLength = feetToShow * config.PIXELS_PER_FOOT * viewportScale;
  const maxBarLength = boxWidth - 16;
  const actualBarLength = Math.min(barLength, maxBarLength);
  const feetPerSegment = feetToShow / 4;
  const segmentLength = actualBarLength / 4;

  // Draw alternating segments
  for (let i = 0; i < 4; i++) {
    currentCtx.fillStyle = i % 2 === 0 ? config.BLUEPRINT_LINE_HEAVY : '#ffffff';
    currentCtx.strokeStyle = config.BLUEPRINT_LINE_HEAVY;
    currentCtx.lineWidth = 1;
    currentCtx.beginPath();
    currentCtx.rect(barStartX + i * segmentLength, barY, segmentLength, 6);
    currentCtx.fill();
    currentCtx.stroke();
  }

  // Draw tick labels
  currentCtx.font = '9px Arial';
  currentCtx.fillStyle = config.BLUEPRINT_TEXT;
  currentCtx.textAlign = 'center';
  currentCtx.textBaseline = 'top';

  for (let i = 0; i <= 4; i++) {
    const labelX = barStartX + i * segmentLength;
    const feet = i * feetPerSegment;
    currentCtx.fillText(`${feet}'`, labelX, barY + 8);
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

    // Draw measurement overlay (only in measure mode)
    if (state.isMeasureMode && (state.measurePoint1 || state.measurePoint2)) {
      drawMeasurementOverlay(
        ctx,
        state.measurePoint1,
        state.measurePoint2,
        state.currentModelMousePos,
        state.viewportScale
      );
    }

    ctx.restore();

    // Draw blueprint scale indicator (in screen coordinates, after restore)
    if (blueprintMode && state.structuralComponents && !state.structuralComponents.error) {
      drawBlueprintScaleIndicator(ctx, canvasWidth, canvasHeight, state.viewportScale);
    }

    // Draw vertex edit handles (only in interactive mode, Draw step)
    if (window.drawVertexEditHandles && state.wizardStep === 'draw') {
      window.drawVertexEditHandles(ctx);
    }
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
  forceOrthogonal = true,
  allow45Degrees = true // New parameter to enable 45-degree snapping
) {
  // For the first point, snap to 12" (1 foot) grid
  if (!modelPoints || modelPoints.length === 0) {
    const footGridStep = config.PIXELS_PER_FOOT; // 24 pixels = 1 foot
    let snappedX = Math.round(modelMouseX / footGridStep) * footGridStep;
    let snappedY = Math.round(modelMouseY / footGridStep) * footGridStep;
    return { x: snappedX, y: snappedY };
  }

  // For subsequent points, use the 1" grid and enforce angle snapping if needed
  const GSP = config.GRID_SPACING_PIXELS;
  let snappedX = Math.round(modelMouseX / GSP) * GSP;
  let snappedY = Math.round(modelMouseY / GSP) * GSP;

  if (modelPoints && modelPoints.length > 0 && !isShapeClosed && forceOrthogonal) {
    const prevPoint = modelPoints[modelPoints.length - 1];
    const dx = snappedX - prevPoint.x;
    const dy = snappedY - prevPoint.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (allow45Degrees) {
      // Calculate angle from previous point to current snapped position
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 5) { // Only snap if far enough from previous point
        // Calculate current angle in degrees (-180 to 180)
        const angleRad = Math.atan2(dy, dx);
        const angleDeg = angleRad * (180 / Math.PI);

        // Valid snap angles: 0, 45, 90, 135, 180, -45, -90, -135
        const snapAngles = [0, 45, 90, 135, 180, -45, -90, -135, -180];
        const snapThreshold = 22.5; // Degrees - halfway between snap angles

        // Find nearest snap angle
        let nearestAngle = 0;
        let minDiff = Infinity;
        for (const snap of snapAngles) {
          const diff = Math.abs(angleDeg - snap);
          if (diff < minDiff) {
            minDiff = diff;
            nearestAngle = snap;
          }
        }

        // Calculate snapped position at the nearest valid angle
        const snappedAngleRad = nearestAngle * (Math.PI / 180);
        const snappedDx = distance * Math.cos(snappedAngleRad);
        const snappedDy = distance * Math.sin(snappedAngleRad);

        // Apply to get new snapped position
        snappedX = prevPoint.x + snappedDx;
        snappedY = prevPoint.y + snappedDy;

        // Re-snap to grid while maintaining angle
        // For orthogonal lines, snap both coordinates
        // For 45-degree lines, snap one coordinate and calculate the other
        if (Math.abs(nearestAngle) === 0 || Math.abs(nearestAngle) === 180) {
          // Horizontal line - snap X, keep Y at previous
          snappedX = Math.round(snappedX / GSP) * GSP;
          snappedY = prevPoint.y;
        } else if (Math.abs(nearestAngle) === 90) {
          // Vertical line - snap Y, keep X at previous
          snappedX = prevPoint.x;
          snappedY = Math.round(snappedY / GSP) * GSP;
        } else {
          // 45-degree line - snap to grid while maintaining 45° angle
          // Snap X first, then calculate Y to maintain 45° angle
          snappedX = Math.round(snappedX / GSP) * GSP;
          const gridDx = snappedX - prevPoint.x;
          // For 45°, |dy| should equal |dx|
          const sign = (nearestAngle > 0 && nearestAngle < 180) ? 1 : -1;
          const diagonal45 = (nearestAngle === 45 || nearestAngle === -135);
          if (diagonal45) {
            snappedY = prevPoint.y + Math.abs(gridDx) * Math.sign(dy);
          } else {
            snappedY = prevPoint.y - Math.abs(gridDx) * Math.sign(dy) * -1;
          }
          // Ensure the 45° relationship: |dx| = |dy|
          snappedY = prevPoint.y + Math.abs(gridDx) * Math.sign(snappedY - prevPoint.y);
        }
      }
    } else {
      // Original orthogonal-only logic
      if (absDx < absDy) {
        snappedX = prevPoint.x;
      } else {
        snappedY = prevPoint.y;
      }
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
  isBlueprintMode = false,
  layerVisibility = { ledger: true, joists: true, beams: true, posts: true, blocking: true }
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
    diagonalLedgers = [],
  } = components;
  const scaledLineWidth = (width) => Math.max(0.5 / scale, width / scale);
  
  // Make isBlueprintMode available to all nested functions
  // Default to false if not explicitly provided
  const blueprintMode = isBlueprintMode || false;
  
  // Actual lumber dimensions in pixels (based on actual 1.5" thickness for 2x lumber)
  const LUMBER_THICKNESS_INCHES = 1.5;
  const LUMBER_THICKNESS_FEET = LUMBER_THICKNESS_INCHES / 12;
  const LUMBER_THICKNESS_PIXELS = LUMBER_THICKNESS_FEET * config.PIXELS_PER_FOOT;

  // Blueprint styling helper - returns element-specific styling for CAD-style rendering
  function getBlueprintStyles(elementType) {
    const styles = {
      deckOutline: {
        weight: config.BLUEPRINT_LINE_WEIGHT_HEAVY,
        color: config.BLUEPRINT_LINE_HEAVY,
        dash: []
      },
      ledger: {
        weight: config.BLUEPRINT_LINE_WEIGHT_HEAVY,
        color: config.BLUEPRINT_LINE_HEAVY,
        dash: []
      },
      beam: {
        weight: config.BLUEPRINT_LINE_WEIGHT_MEDIUM,
        color: config.BLUEPRINT_LINE_HEAVY,
        dash: []
      },
      rimJoist: {
        weight: config.BLUEPRINT_LINE_WEIGHT_MEDIUM,
        color: config.BLUEPRINT_LINE_MEDIUM,
        dash: []
      },
      joist: {
        weight: config.BLUEPRINT_LINE_WEIGHT_LIGHT,
        color: config.BLUEPRINT_LINE_MEDIUM,
        dash: []
      },
      blocking: {
        weight: config.BLUEPRINT_LINE_WEIGHT_LIGHT,
        color: config.BLUEPRINT_LINE_LIGHT,
        dash: config.BLUEPRINT_DASH_BLOCKING
      },
      post: {
        weight: config.BLUEPRINT_LINE_WEIGHT_MEDIUM,
        color: config.BLUEPRINT_LINE_HEAVY,
        fill: '#ffffff'
      },
      footing: {
        weight: config.BLUEPRINT_LINE_WEIGHT_LIGHT,
        color: config.BLUEPRINT_LINE_HIDDEN,
        dash: config.BLUEPRINT_DASH_HIDDEN
      }
    };
    return styles[elementType] || styles.joist;
  }

  // Draw to-scale components based on their actual dimensions
  function drawToScaleLine(p1, p2, width, color, isDashed = false, lineWidthMultiplier = 1.0, elementType = null) {
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
    
    // In blueprint mode, draw hollow to-scale components with CAD-style rendering
    if (blueprintMode) {
      // Get blueprint-specific styling if element type provided
      const bpStyle = elementType ? getBlueprintStyles(elementType) : null;
      const strokeColor = bpStyle ? bpStyle.color : color;
      const lineWeight = bpStyle ? bpStyle.weight : 1;
      const dashPattern = bpStyle ? bpStyle.dash : (isDashed ? [4, 4] : []);

      // Draw outline only (no fill) - to-scale width components
      currentCtx.strokeStyle = strokeColor;
      currentCtx.lineWidth = Math.max(0.5 / scale, (lineWeight * lineWidthMultiplier) / scale);
      currentCtx.beginPath();
      currentCtx.moveTo(corners[0].x, corners[0].y);
      currentCtx.lineTo(corners[1].x, corners[1].y);
      currentCtx.lineTo(corners[2].x, corners[2].y);
      currentCtx.lineTo(corners[3].x, corners[3].y);
      currentCtx.closePath();

      if (isDashed || (dashPattern && dashPattern.length > 0)) {
        const scaledDash = (dashPattern && dashPattern.length > 0)
          ? dashPattern.map(d => scaledLineWidth(d))
          : [scaledLineWidth(4), scaledLineWidth(4)];
        currentCtx.setLineDash(scaledDash);
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
  function drawMultiplyBoard(p1, p2, plyCount, color, isMerged = false, elementType = 'beam') {
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
        drawToScaleLine(offsetP1, offsetP2, LUMBER_THICKNESS_PIXELS, color, false, 1.5, elementType);
      } else {
        drawToScaleLine(offsetP1, offsetP2, LUMBER_THICKNESS_PIXELS, color, false, 1.0, elementType);
      }
    }
  }

  // Draw ledger (typically a single 2x board against the house)
  if (ledger && layerVisibility.ledger) {
    drawToScaleLine(ledger.p1, ledger.p2, LUMBER_THICKNESS_PIXELS, config.LEDGER_COLOR, false, 1.0, 'ledger');
  }

  // Draw diagonal ledgers (for bay window configurations where diagonals attach to house)
  if (diagonalLedgers.length > 0 && layerVisibility.ledger) {
    diagonalLedgers.forEach((diagLedger) => {
      if (diagLedger.p1 && diagLedger.p2) {
        drawToScaleLine(diagLedger.p1, diagLedger.p2, LUMBER_THICKNESS_PIXELS, config.LEDGER_COLOR, false, 1.0, 'ledger');
      }
    });
  }

  // Draw beams (typically 2-ply or 3-ply)
  // Enhanced for multi-section: merged beams may be longer and span multiple sections
  if (layerVisibility.beams) {
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
  }

  // Draw joists (single 2x boards)
  // Enhanced for multi-section: joists may span sections or be section-specific
  if (layerVisibility.joists) {
    currentCtx.strokeStyle = config.JOIST_RIM_COLOR;
    joists.forEach((joist) => {
      // Check if this joist spans multiple sections (indicated by extended length)
      const joistLength = Math.sqrt(
        Math.pow(joist.p2.x - joist.p1.x, 2) + Math.pow(joist.p2.y - joist.p1.y, 2)
      );

      // Draw joist with appropriate styling
      if (joist.spansSections) {
        // Draw spanning joists with slightly thicker line to indicate continuity
        drawToScaleLine(joist.p1, joist.p2, LUMBER_THICKNESS_PIXELS, config.JOIST_RIM_COLOR, false, 1.2, 'joist');
      } else {
        drawToScaleLine(joist.p1, joist.p2, LUMBER_THICKNESS_PIXELS, config.JOIST_RIM_COLOR, false, 1.0, 'joist');
      }
    });

    // Draw rim joists (typically single 2x boards around the perimeter)
    // Enhanced for multi-section: rim joists may be merged across sections
    rimJoists.forEach((rim) => {
      if (rim.isMerged) {
        // Draw merged rim joists with enhanced styling to show continuity
        drawToScaleLine(rim.p1, rim.p2, LUMBER_THICKNESS_PIXELS, config.JOIST_RIM_COLOR, false, 1.3, 'rimJoist');
      } else {
        drawToScaleLine(rim.p1, rim.p2, LUMBER_THICKNESS_PIXELS, config.JOIST_RIM_COLOR, false, 1.0, 'rimJoist');
      }
    });
  }

  // Draw blocking (typically single 2x boards between joists)
  if (layerVisibility.blocking) {
    midSpanBlocking.forEach((block) => {
      drawToScaleLine(block.p1, block.p2, LUMBER_THICKNESS_PIXELS, config.BLOCKING_COLOR, true, 1.0, 'blocking');
    });

    // Draw picture frame blocking
    pictureFrameBlocking.forEach((block) => {
      drawToScaleLine(block.p1, block.p2, LUMBER_THICKNESS_PIXELS, config.BLOCKING_COLOR, true, 1.0, 'blocking');
    });
  }

  // Draw footings and posts (combined under posts visibility)
  // Enhanced for multi-section: footings are deduplicated at shared locations
  if (layerVisibility.posts) {
    const footingScreenRadius = isScaledForPrint ? 7 : 8;
    const footingModelRadius = footingScreenRadius / scale;
    const footingStyle = getBlueprintStyles('footing');
    const postStyle = getBlueprintStyles('post');

    footings.forEach((f) => {
      currentCtx.beginPath();

      if (blueprintMode) {
        // In blueprint mode, draw a circle with CAD-style dashed line (below grade)
        currentCtx.arc(f.x, f.y, footingModelRadius, 0, Math.PI * 2);
        currentCtx.strokeStyle = footingStyle.color;
        const weight = f.isShared ? footingStyle.weight * 1.5 : footingStyle.weight;
        currentCtx.lineWidth = Math.max(0.5 / scale, weight / scale);
        // Use dashed line for footings (below grade indication)
        const dashPattern = footingStyle.dash.map(d => Math.max(d / scale, 1));
        currentCtx.setLineDash(dashPattern);
        currentCtx.stroke();
        currentCtx.setLineDash([]);

        // Add visual indicator for shared footings
        if (f.isShared) {
          currentCtx.beginPath();
          currentCtx.arc(f.x, f.y, footingModelRadius * 1.2, 0, Math.PI * 2);
          currentCtx.strokeStyle = footingStyle.color;
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
        // In blueprint mode, draw an outline square with white fill (solid, above grade)
        currentCtx.beginPath();
        currentCtx.rect(
          p.x - postSizePixels / 2,
          p.y - postSizePixels / 2,
          postSizePixels,
          postSizePixels
        );
        // Fill with white first
        currentCtx.fillStyle = postStyle.fill;
        currentCtx.fill();
        // Then stroke with CAD-style line
        currentCtx.strokeStyle = postStyle.color;
        const weight = p.isShared ? postStyle.weight * 1.5 : postStyle.weight;
        currentCtx.lineWidth = Math.max(0.5 / scale, weight / scale);
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
          currentCtx.strokeStyle = postStyle.color;
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

  // ==================== BLUEPRINT MODE ANNOTATIONS & DIMENSIONS ====================

  // Helper: Format dimension in architectural format (12'-6", 3'-0", 10½")
  function formatArchitecturalDimension(feet) {
    const totalInches = Math.round(feet * 12);
    const ft = Math.floor(totalInches / 12);
    const inches = totalInches % 12;

    if (ft === 0) {
      return `${inches}"`;
    } else if (inches === 0) {
      return `${ft}'-0"`;
    } else {
      return `${ft}'-${inches}"`;
    }
  }

  // Draw a dimension line with tick terminators (architectural style)
  function drawDimensionLine(x1, y1, x2, y2, offset, labelText, side = 'top') {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length < config.EPSILON) return;

    // Normalized direction and perpendicular
    const dirX = dx / length;
    const dirY = dy / length;
    const perpX = -dirY;
    const perpY = dirX;

    // Offset multiplier based on side
    const offsetMult = (side === 'bottom' || side === 'right') ? 1 : -1;
    const offsetDist = offset / scale;

    // Dimension line endpoints (offset from the object)
    const dimX1 = x1 + perpX * offsetDist * offsetMult;
    const dimY1 = y1 + perpY * offsetDist * offsetMult;
    const dimX2 = x2 + perpX * offsetDist * offsetMult;
    const dimY2 = y2 + perpY * offsetDist * offsetMult;

    // Extension line gap and overshoot
    const gapDist = 3 / scale;      // Gap from object
    const overshoot = 4 / scale;    // Overshoot past dimension line

    // Draw extension lines
    currentCtx.strokeStyle = config.BLUEPRINT_DIMENSION;
    currentCtx.lineWidth = Math.max(0.5 / scale, config.BLUEPRINT_LINE_WEIGHT_HAIRLINE / scale);
    currentCtx.setLineDash([]);

    // Extension line 1
    const ext1StartX = x1 + perpX * gapDist * offsetMult;
    const ext1StartY = y1 + perpY * gapDist * offsetMult;
    const ext1EndX = dimX1 + perpX * overshoot * offsetMult;
    const ext1EndY = dimY1 + perpY * overshoot * offsetMult;

    currentCtx.beginPath();
    currentCtx.moveTo(ext1StartX, ext1StartY);
    currentCtx.lineTo(ext1EndX, ext1EndY);
    currentCtx.stroke();

    // Extension line 2
    const ext2StartX = x2 + perpX * gapDist * offsetMult;
    const ext2StartY = y2 + perpY * gapDist * offsetMult;
    const ext2EndX = dimX2 + perpX * overshoot * offsetMult;
    const ext2EndY = dimY2 + perpY * overshoot * offsetMult;

    currentCtx.beginPath();
    currentCtx.moveTo(ext2StartX, ext2StartY);
    currentCtx.lineTo(ext2EndX, ext2EndY);
    currentCtx.stroke();

    // Draw dimension line
    currentCtx.beginPath();
    currentCtx.moveTo(dimX1, dimY1);
    currentCtx.lineTo(dimX2, dimY2);
    currentCtx.stroke();

    // Draw tick marks at ends (architectural style - 45° slashes)
    const tickSize = 4 / scale;
    const tickAngle = Math.PI / 4; // 45 degrees

    // Tick 1
    currentCtx.beginPath();
    currentCtx.moveTo(dimX1 - tickSize * Math.cos(tickAngle + Math.atan2(dirY, dirX)),
                      dimY1 - tickSize * Math.sin(tickAngle + Math.atan2(dirY, dirX)));
    currentCtx.lineTo(dimX1 + tickSize * Math.cos(tickAngle + Math.atan2(dirY, dirX)),
                      dimY1 + tickSize * Math.sin(tickAngle + Math.atan2(dirY, dirX)));
    currentCtx.stroke();

    // Tick 2
    currentCtx.beginPath();
    currentCtx.moveTo(dimX2 - tickSize * Math.cos(tickAngle + Math.atan2(dirY, dirX)),
                      dimY2 - tickSize * Math.sin(tickAngle + Math.atan2(dirY, dirX)));
    currentCtx.lineTo(dimX2 + tickSize * Math.cos(tickAngle + Math.atan2(dirY, dirX)),
                      dimY2 + tickSize * Math.sin(tickAngle + Math.atan2(dirY, dirX)));
    currentCtx.stroke();

    // Draw dimension text
    const midX = (dimX1 + dimX2) / 2;
    const midY = (dimY1 + dimY2) / 2;

    const fontSize = Math.max(8, 10 / scale);
    currentCtx.font = `${fontSize}px Arial`;
    currentCtx.fillStyle = config.BLUEPRINT_TEXT;
    currentCtx.textAlign = 'center';
    currentCtx.textBaseline = 'middle';

    // Offset text slightly from the line
    const textOffset = 8 / scale;
    const textX = midX + perpX * textOffset * offsetMult;
    const textY = midY + perpY * textOffset * offsetMult;

    // Save context for rotation
    currentCtx.save();
    currentCtx.translate(textX, textY);

    // Rotate text to align with dimension line (keep readable)
    let angle = Math.atan2(dirY, dirX);
    if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
      angle += Math.PI;
    }
    currentCtx.rotate(angle);
    currentCtx.fillText(labelText, 0, 0);
    currentCtx.restore();
  }

  // Draw annotation label for lumber/structural element with white background for legibility
  function drawBlueprintAnnotation(x, y, text, angle = 0, forceHorizontal = false) {
    const fontSize = Math.max(7, 9 / scale);
    currentCtx.font = `bold ${fontSize}px Arial`;
    currentCtx.textAlign = 'center';
    currentCtx.textBaseline = 'middle';

    // Measure text for background
    const textMetrics = currentCtx.measureText(text);
    const textWidth = textMetrics.width;
    const textHeight = fontSize * 1.2;
    const padding = 2 / scale;

    currentCtx.save();
    currentCtx.translate(x, y);

    // Adjust rotation to keep text readable (right-side up)
    let adjustedAngle = forceHorizontal ? 0 : angle;
    if (!forceHorizontal && (adjustedAngle > Math.PI / 2 || adjustedAngle < -Math.PI / 2)) {
      adjustedAngle += Math.PI;
    }
    currentCtx.rotate(adjustedAngle);

    // Draw white background for legibility
    currentCtx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    currentCtx.fillRect(
      -textWidth / 2 - padding,
      -textHeight / 2 - padding,
      textWidth + padding * 2,
      textHeight + padding * 2
    );

    // Draw text
    currentCtx.fillStyle = config.BLUEPRINT_TEXT;
    currentCtx.fillText(text, 0, 0);
    currentCtx.restore();
  }

  // ==================== BLUEPRINT MODE RENDERING ====================

  if (blueprintMode) {
    // Draw structural annotations with improved positioning
    // Calculate ledger direction for positioning other elements
    let ledgerAngle = 0;
    let ledgerPerpX = 0;
    let ledgerPerpY = 1; // Default: perpendicular is downward

    if (ledger) {
      ledgerAngle = Math.atan2(ledger.p2.y - ledger.p1.y, ledger.p2.x - ledger.p1.x);
      ledgerPerpX = -Math.sin(ledgerAngle);
      ledgerPerpY = Math.cos(ledgerAngle);
    }

    // Ledger annotation - position inside the deck near the top
    if (ledger && layerVisibility.ledger) {
      const midX = (ledger.p1.x + ledger.p2.x) / 2;
      const midY = (ledger.p1.y + ledger.p2.y) / 2;
      // Offset label toward deck interior (positive perpendicular, closer to center)
      const offsetDist = 10 / scale;
      const labelX = midX + ledgerPerpX * offsetDist;
      const labelY = midY + ledgerPerpY * offsetDist;
      drawBlueprintAnnotation(labelX, labelY, '2x10 LEDGER', ledgerAngle);
    }

    // Beam annotations - position above the beam line
    if (layerVisibility.beams) {
      beams.forEach((beam, idx) => {
        const midX = (beam.p1.x + beam.p2.x) / 2;
        const midY = (beam.p1.y + beam.p2.y) / 2;
        const angle = Math.atan2(beam.p2.y - beam.p1.y, beam.p2.x - beam.p1.x);
        const plyCount = beam.ply || 2;
        const plyText = plyCount > 1 ? ` (${plyCount}-PLY)` : '';
        // Offset label toward ledger (negative perpendicular from beam)
        const offsetDist = 10 / scale;
        const perpX = -Math.sin(angle);
        const perpY = Math.cos(angle);
        const labelX = midX - perpX * offsetDist;
        const labelY = midY - perpY * offsetDist;
        // Only label first beam
        if (idx === 0) {
          drawBlueprintAnnotation(labelX, labelY, `2x10 BEAM${plyText}`, angle);
        }
      });
    }

    // Joist annotation - use HORIZONTAL text positioned in open area of deck
    if (layerVisibility.joists && joists.length > 0) {
      // Find a joist around 1/3 from the start for better placement
      const joistIdx = Math.floor(joists.length / 3);
      const joist = joists[joistIdx];
      if (joist) {
        // Position at 40% along the joist length, horizontally
        const t = 0.4;
        const labelX = joist.p1.x + (joist.p2.x - joist.p1.x) * t;
        const labelY = joist.p1.y + (joist.p2.y - joist.p1.y) * t;
        // Force horizontal text for better readability
        drawBlueprintAnnotation(labelX, labelY, '2x8 JOISTS @ 16" O.C. (TYP.)', 0, true);
      }
    }

    // Rim joist annotation - find the side rim joist and label it
    if (layerVisibility.joists && rimJoists.length > 0) {
      // Find a side rim joist (perpendicular to ledger direction)
      let sideRim = null;
      rimJoists.forEach(rim => {
        if (!rim || !rim.p1 || !rim.p2) return;
        const rimAngle = Math.atan2(rim.p2.y - rim.p1.y, rim.p2.x - rim.p1.x);
        // Check if this rim is roughly perpendicular to ledger (side rim)
        const angleDiff = Math.abs(rimAngle - ledgerAngle);
        if (Math.abs(angleDiff - Math.PI / 2) < 0.3 || Math.abs(angleDiff - 3 * Math.PI / 2) < 0.3) {
          sideRim = rim;
        }
      });

      // If found a side rim, use it; otherwise use first rim
      const rim = sideRim || rimJoists[0];
      if (rim) {
        const midX = (rim.p1.x + rim.p2.x) / 2;
        const midY = (rim.p1.y + rim.p2.y) / 2;
        const rimAngle = Math.atan2(rim.p2.y - rim.p1.y, rim.p2.x - rim.p1.x);
        // Offset label to outside of deck
        const offsetDist = 15 / scale;
        const perpX = -Math.sin(rimAngle);
        const perpY = Math.cos(rimAngle);
        // Position outside the deck (away from center)
        const labelX = midX - perpX * offsetDist;
        const labelY = midY - perpY * offsetDist;
        drawBlueprintAnnotation(labelX, labelY, '2x8 RIM', rimAngle);
      }
    }

    // Post annotations - label first post with size, positioned below
    if (layerVisibility.posts && posts.length > 0) {
      const post = posts[0];
      const postSize = post.size || '4x4';
      // Position below the post
      const labelX = post.x;
      const labelY = post.y + 15 / scale;
      drawBlueprintAnnotation(labelX, labelY, `${postSize.toUpperCase()} POST`, 0, true);
    }

    // Draw comprehensive architectural dimensions
    if (ledger) {
      // Calculate ledger direction vectors
      const ledgerDx = ledger.p2.x - ledger.p1.x;
      const ledgerDy = ledger.p2.y - ledger.p1.y;
      const ledgerLength = Math.sqrt(ledgerDx * ledgerDx + ledgerDy * ledgerDy);
      const ledgerFeet = ledgerLength / config.PIXELS_PER_FOOT;

      // Normalized ledger direction and perpendicular
      const ledgerDirX = ledgerDx / ledgerLength;
      const ledgerDirY = ledgerDy / ledgerLength;
      const perpX = -ledgerDirY;
      const perpY = ledgerDirX;

      // Find the outer rim joist (the one opposite to the ledger - farthest away)
      let outerRimJoist = null;
      let maxDist = 0;
      const ledgerMidX = (ledger.p1.x + ledger.p2.x) / 2;
      const ledgerMidY = (ledger.p1.y + ledger.p2.y) / 2;

      rimJoists.forEach(rim => {
        if (!rim || !rim.p1 || !rim.p2) return;
        const rimMidX = (rim.p1.x + rim.p2.x) / 2;
        const rimMidY = (rim.p1.y + rim.p2.y) / 2;
        const dist = Math.sqrt(Math.pow(rimMidX - ledgerMidX, 2) + Math.pow(rimMidY - ledgerMidY, 2));
        if (dist > maxDist) {
          maxDist = dist;
          outerRimJoist = rim;
        }
      });

      // === DIMENSION 1: Ledger/Overall Width (at top) ===
      drawDimensionLine(
        ledger.p1.x, ledger.p1.y,
        ledger.p2.x, ledger.p2.y,
        30,
        formatArchitecturalDimension(ledgerFeet),
        'top'
      );

      // === DIMENSION 2: Overall Depth (full height on left side, outside deck) ===
      if (outerRimJoist) {
        const outerRimMidX = (outerRimJoist.p1.x + outerRimJoist.p2.x) / 2;
        const outerRimMidY = (outerRimJoist.p1.y + outerRimJoist.p2.y) / 2;

        // Project to find the actual perpendicular depth
        const fullDepthPixels = Math.abs(
          (outerRimMidX - ledgerMidX) * perpX + (outerRimMidY - ledgerMidY) * perpY
        );
        const fullDepthFeet = fullDepthPixels / config.PIXELS_PER_FOOT;

        // Calculate outer rim P1 position (projected from ledger.p1 perpendicular)
        const outerP1X = ledger.p1.x + perpX * fullDepthPixels;
        const outerP1Y = ledger.p1.y + perpY * fullDepthPixels;

        // Draw full depth dimension on left side (outside the deck)
        drawDimensionLine(
          ledger.p1.x, ledger.p1.y,
          outerP1X, outerP1Y,
          40,
          formatArchitecturalDimension(fullDepthFeet),
          'left'
        );

        // === DIMENSION 3: Distance to Beam (stacked inside the overall) ===
        if (beams.length > 0) {
          const beam = beams[0];
          const beamMidX = (beam.p1.x + beam.p2.x) / 2;
          const beamMidY = (beam.p1.y + beam.p2.y) / 2;

          // Calculate perpendicular distance from ledger to beam
          const beamDistPixels = Math.abs(
            (beamMidX - ledgerMidX) * perpX + (beamMidY - ledgerMidY) * perpY
          );
          const beamDistFeet = beamDistPixels / config.PIXELS_PER_FOOT;

          // Beam P1 projected from ledger
          const beamP1X = ledger.p1.x + perpX * beamDistPixels;
          const beamP1Y = ledger.p1.y + perpY * beamDistPixels;

          // Draw ledger-to-beam dimension (stacked closer to deck)
          drawDimensionLine(
            ledger.p1.x, ledger.p1.y,
            beamP1X, beamP1Y,
            25,
            formatArchitecturalDimension(beamDistFeet),
            'left'
          );

          // === DIMENSION 4: Cantilever (from beam to outer edge) ===
          const cantileverPixels = fullDepthPixels - beamDistPixels;
          if (cantileverPixels > config.PIXELS_PER_FOOT * 0.25) { // Only show if > 3 inches
            const cantileverFeet = cantileverPixels / config.PIXELS_PER_FOOT;

            // Draw cantilever dimension on right side
            const beamP2X = ledger.p2.x + perpX * beamDistPixels;
            const beamP2Y = ledger.p2.y + perpY * beamDistPixels;
            const outerP2X = ledger.p2.x + perpX * fullDepthPixels;
            const outerP2Y = ledger.p2.y + perpY * fullDepthPixels;

            drawDimensionLine(
              beamP2X, beamP2Y,
              outerP2X, outerP2Y,
              25,
              formatArchitecturalDimension(cantileverFeet),
              'right'
            );
          }

          // === DIMENSION 5: Post spacing along beam ===
          if (posts.length >= 2) {
            // Sort posts by position along the beam
            const beamDx = beam.p2.x - beam.p1.x;
            const beamDy = beam.p2.y - beam.p1.y;
            const beamLen = Math.sqrt(beamDx * beamDx + beamDy * beamDy);
            const beamDirX = beamDx / beamLen;
            const beamDirY = beamDy / beamLen;

            // Get posts with their position along beam
            const postsWithPos = posts.map(post => {
              const dx = post.x - beam.p1.x;
              const dy = post.y - beam.p1.y;
              const pos = dx * beamDirX + dy * beamDirY;
              return { post, pos };
            }).sort((a, b) => a.pos - b.pos);

            // Draw spacing between first two posts (typical spacing)
            if (postsWithPos.length >= 2) {
              const post1 = postsWithPos[0].post;
              const post2 = postsWithPos[1].post;
              const spacingPixels = Math.sqrt(
                Math.pow(post2.x - post1.x, 2) + Math.pow(post2.y - post1.y, 2)
              );
              const spacingFeet = spacingPixels / config.PIXELS_PER_FOOT;

              // Draw post spacing dimension below the beam
              drawDimensionLine(
                post1.x, post1.y,
                post2.x, post2.y,
                20,
                formatArchitecturalDimension(spacingFeet) + ' TYP.',
                'bottom'
              );
            }
          }
        }
      }
    }
  }
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

// --- Measurement Tool Drawing ---
export function drawMeasurementOverlay(currentCtx, measurePoint1, measurePoint2, currentMousePos, scale) {
  if (!currentCtx || scale === 0) return;
  if (!measurePoint1) return; // No measurement to draw

  const scaledLineWidth = (width) => Math.max(0.5 / scale, width / scale);

  // Draw the first point marker
  currentCtx.save();

  // Draw first point (always visible when measuring)
  currentCtx.fillStyle = '#EF4444'; // Red
  currentCtx.beginPath();
  currentCtx.arc(measurePoint1.x, measurePoint1.y, Math.max(6 / scale, 4 / scale), 0, Math.PI * 2);
  currentCtx.fill();

  // Draw crosshair at first point
  const crosshairSize = Math.max(12 / scale, 8 / scale);
  currentCtx.strokeStyle = '#EF4444';
  currentCtx.lineWidth = scaledLineWidth(2);
  currentCtx.beginPath();
  currentCtx.moveTo(measurePoint1.x - crosshairSize, measurePoint1.y);
  currentCtx.lineTo(measurePoint1.x + crosshairSize, measurePoint1.y);
  currentCtx.moveTo(measurePoint1.x, measurePoint1.y - crosshairSize);
  currentCtx.lineTo(measurePoint1.x, measurePoint1.y + crosshairSize);
  currentCtx.stroke();

  // Determine the end point (either second point or current mouse position)
  let endPoint = measurePoint2;
  const isPreview = !measurePoint2 && currentMousePos;

  if (isPreview && currentMousePos) {
    // Snap mouse position to grid for preview
    endPoint = getSnappedPos(currentMousePos.x, currentMousePos.y, [], false, false, false);
  }

  if (endPoint) {
    // Draw measurement line
    currentCtx.strokeStyle = isPreview ? 'rgba(239, 68, 68, 0.6)' : '#EF4444';
    currentCtx.lineWidth = scaledLineWidth(isPreview ? 1.5 : 2);
    currentCtx.setLineDash(isPreview ? [scaledLineWidth(6), scaledLineWidth(4)] : []);
    currentCtx.beginPath();
    currentCtx.moveTo(measurePoint1.x, measurePoint1.y);
    currentCtx.lineTo(endPoint.x, endPoint.y);
    currentCtx.stroke();
    currentCtx.setLineDash([]);

    // Draw second point marker
    currentCtx.fillStyle = isPreview ? 'rgba(239, 68, 68, 0.6)' : '#EF4444';
    currentCtx.beginPath();
    currentCtx.arc(endPoint.x, endPoint.y, Math.max(6 / scale, 4 / scale), 0, Math.PI * 2);
    currentCtx.fill();

    // Calculate distance
    const dx = endPoint.x - measurePoint1.x;
    const dy = endPoint.y - measurePoint1.y;
    const distancePixels = Math.sqrt(dx * dx + dy * dy);
    const distanceFeet = distancePixels / config.PIXELS_PER_FOOT;

    // Format the distance
    const formattedDistance = utils.formatFeetInches(distanceFeet);

    // Draw measurement label at midpoint
    const midX = (measurePoint1.x + endPoint.x) / 2;
    const midY = (measurePoint1.y + endPoint.y) / 2;

    // Calculate perpendicular offset for label
    const angle = Math.atan2(dy, dx);
    const perpX = -Math.sin(angle);
    const perpY = Math.cos(angle);
    const labelOffset = Math.max(25 / scale, 18 / scale);

    const labelX = midX + perpX * labelOffset;
    const labelY = midY + perpY * labelOffset;

    // Draw label background
    const fontSize = Math.max(14, 14 / scale);
    currentCtx.font = `bold ${fontSize}px Arial`;
    const textMetrics = currentCtx.measureText(formattedDistance);
    const padding = Math.max(6 / scale, 4 / scale);
    const bgWidth = textMetrics.width + padding * 2;
    const bgHeight = fontSize + padding * 2;

    currentCtx.save();
    currentCtx.translate(labelX, labelY);

    // Rotate to align with the line
    let textAngle = angle;
    if (textAngle > Math.PI / 2 || textAngle < -Math.PI / 2) {
      textAngle += Math.PI;
    }
    currentCtx.rotate(textAngle);

    // Draw background
    currentCtx.fillStyle = isPreview ? 'rgba(255, 255, 255, 0.9)' : 'white';
    currentCtx.strokeStyle = isPreview ? 'rgba(239, 68, 68, 0.6)' : '#EF4444';
    currentCtx.lineWidth = scaledLineWidth(1.5);
    currentCtx.beginPath();
    currentCtx.roundRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, Math.max(4 / scale, 2 / scale));
    currentCtx.fill();
    currentCtx.stroke();

    // Draw text
    currentCtx.fillStyle = isPreview ? 'rgba(239, 68, 68, 0.8)' : '#EF4444';
    currentCtx.textAlign = 'center';
    currentCtx.textBaseline = 'middle';
    currentCtx.fillText(formattedDistance, 0, 0);

    currentCtx.restore();
  }

  currentCtx.restore();
}
