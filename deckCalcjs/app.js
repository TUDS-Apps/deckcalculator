// app.js - Main Application Logic (v6 - Panning & Button Relocation)

// --- Module Imports ---
import * as config from "./config.js";
import * as utils from "./utils.js";
import * as dataManager from "./dataManager.js";
import * as uiController from "./uiController.js";
import * as deckCalculations from "./deckCalculations.js";
import * as stairCalculations from "./stairCalculations.js";
import * as canvasLogic from "./canvasLogic.js";
import * as bomCalculations from "./bomCalculations.js";
import * as shapeValidator from "./shapeValidator.js";
import * as shapeDecomposer from "./shapeDecomposer.js";

// --- Application State ---
const appState = {
  points: [],
  isDrawing: false,
  isShapeClosed: false,
  currentMousePos: null,
  currentModelMousePos: null,
  wallSelectionMode: false,
  selectedWallIndices: [], // Array of selected wall indices for ledger attachment
  stairPlacementMode: false,
  selectedStairIndex: -1,
  isDraggingStairs: false,
  draggedStairIndex: -1,
  dragStartX: 0, // For stair dragging (view space)
  dragStartY: 0, // For stair dragging (view space)
  dragInitialStairX: 0, // model space
  dragInitialStairY: 0, // model space
  deckDimensions: null,
  structuralComponents: null,
  stairs: [],
  bom: [],
  isPrinting: false,

  // Complex shape decomposition
  rectangularSections: [], // Will store the decomposed rectangles
  showDecompositionShading: false, // For testing visualization (initially off)

  // Viewport State
  viewportScale: 1.0,
  viewportOffsetX: 0,
  viewportOffsetY: 0,

  // Panning state
  isPanning: false,
  panStartViewX: 0, // Mouse position in VIEW SPACE where panning started
  panStartViewY: 0,
  panInitialViewportOffsetX: 0, // Viewport offset when panning started
  panInitialViewportOffsetY: 0,
  
  // Manual dimension input state
  isDimensionInputActive: false,
  pendingDimensionStartPoint: null,
  
  // Blueprint mode state
  isBlueprintMode: false, // Toggle between simple lines and to-scale components
  
  // Contextual panel state
  currentPanelMode: 'drawing' // 'drawing', 'wall-selection', 'specification', 'plan-generated', 'stair-config'
};

// --- DOM Element References ---
const generatePlanBtn = document.getElementById("generatePlanBtn");
const addStairsBtn = document.getElementById("addStairsBtn");
const cancelStairsBtn = document.getElementById("cancelStairsBtn");
const clearCanvasBtn = document.getElementById("clearCanvasBtn");
const deckCanvas = document.getElementById("deckCanvas");
const canvasContainer = document.getElementById("canvasContainer");
const printBomBtn = document.getElementById("printBomBtn");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const centerFitBtn = document.getElementById("centerFitBtn");
const blueprintToggleBtn = document.getElementById("blueprintToggleBtn");
const toggleDecompositionBtn = document.getElementById("toggleDecompositionBtn");

// Legend elements
const blueprintLegend = document.getElementById("blueprintLegend");
const dimensionsLegend = document.getElementById("dimensionsLegend");

// Dimension input elements
const dimensionInputContainer = document.getElementById("dimensionInputContainer");
const dimensionFeetInput = document.getElementById("dimensionFeetInput");
const dimensionInchesInput = document.getElementById("dimensionInchesInput");
const applyDimensionBtn = document.getElementById("applyDimensionBtn");
const cancelDimensionBtn = document.getElementById("cancelDimensionBtn");

// --- Viewport and Coordinate Transformation ---
function getModelMousePosition(viewMouseX, viewMouseY) {
  if (appState.viewportScale === 0) return { x: 0, y: 0 };
  const modelX =
    (viewMouseX - appState.viewportOffsetX) / appState.viewportScale;
  const modelY =
    (viewMouseY - appState.viewportOffsetY) / appState.viewportScale;
  return { x: modelX, y: modelY };
}

function initializeViewport() {
  if (!deckCanvas || !canvasContainer) {
    console.error("Canvas or container not ready for viewport initialization.");
    return;
  }
  appState.viewportScale = 1.0;
  const canvasWidth = deckCanvas.width;
  const canvasHeight = deckCanvas.height;
  const initialViewModelWidth =
    config.INITIAL_VIEW_WIDTH_FEET * config.PIXELS_PER_FOOT;
  const initialViewModelHeight =
    config.INITIAL_VIEW_HEIGHT_FEET * config.PIXELS_PER_FOOT;

  appState.viewportOffsetX =
    (canvasWidth - initialViewModelWidth * appState.viewportScale) / 2;
  appState.viewportOffsetY =
    (canvasHeight - initialViewModelHeight * appState.viewportScale) / 2;
}


// --- Contextual Panel Management Functions ---
function getCurrentPanelMode() {
  if (appState.stairPlacementMode) {
    return 'stair-config';
  }
  if (appState.structuralComponents && !appState.structuralComponents.error) {
    return 'plan-generated';
  }
  if (appState.isShapeClosed && appState.selectedWallIndices.length === 0) {
    return 'wall-selection';
  }
  if (appState.isShapeClosed && appState.selectedWallIndices.length > 0) {
    return 'wall-selection'; // Still show wall selection panel since it now has Generate Plan button
  }
  return 'drawing';
}

function updateContextualPanel() {
  const newMode = getCurrentPanelMode();
  if (newMode !== appState.currentPanelMode) {
    appState.currentPanelMode = newMode;
    showContextualPanel(newMode);
  }
}

function showContextualPanel(mode) {
  // Hide all panel sections
  const panels = [
    'drawing-mode-panel',
    'wall-selection-panel', 
    'plan-generated-panel',
    'stair-config-panel'
  ];
  
  panels.forEach(panelId => {
    const panel = document.getElementById(panelId);
    if (panel) {
      panel.classList.add('hidden');
      panel.classList.remove('active');
    }
  });

  // Show the appropriate panel with animation
  const targetPanelId = `${mode.replace('-', '-')}-panel`;
  const targetPanel = document.getElementById(targetPanelId);
  
  if (targetPanel) {
    // Add entrance animation
    targetPanel.classList.remove('hidden');
    setTimeout(() => {
      targetPanel.classList.add('active');
    }, 50); // Small delay for CSS transition
  }

  // Update panel-specific content
  updatePanelContent(mode);
}

function updatePanelContent(mode) {
  switch(mode) {
    case 'drawing':
      updateDrawingInstructions();
      break;
    case 'wall-selection':
      updateWallSelectionInstructions();
      enableGenerateButton();
      break;
    case 'plan-generated':
      highlightPlanActions();
      break;
    case 'stair-config':
      focusStairConfiguration();
      break;
  }
}

function updateDrawingInstructions() {
  const instructionElement = document.querySelector('#drawing-mode-panel .instruction-text');
  if (instructionElement) {
    const pointCount = appState.points ? appState.points.length : 0;
    let instruction = '';
    
    if (pointCount === 0) {
      instruction = 'Click on the grid to place your first point. The first point will snap to 1-foot increments.';
    } else if (pointCount === 1) {
      instruction = 'Click to place your second point. Type numbers while drawing for precise measurements.';
    } else if (pointCount >= 2) {
      instruction = 'Continue adding points or click near the starting point to close your deck shape.';
    }
    
    instructionElement.textContent = instruction;
  }
}

function updateWallSelectionInstructions() {
  // Wall selection instructions are static in HTML, but we could enhance them here
}

function enableGenerateButton() {
  const generateBtn = document.getElementById('generatePlanBtn');
  if (generateBtn) {
    generateBtn.disabled = false;
    generateBtn.classList.remove('opacity-50', 'cursor-not-allowed');
  }
}


function highlightPlanActions() {
  // Show project summary and highlight next actions
  const summarySection = document.querySelector('#plan-generated-panel #summarySection');
  if (summarySection) {
    summarySection.classList.remove('hidden');
  }
}

function focusStairConfiguration() {
  // Focus on stair configuration
  const stairWidth = document.getElementById('stairWidth');
  if (stairWidth) {
    stairWidth.focus();
  }
}

// --- Multi-Wall Selection Functions ---

/**
 * Checks if two walls are parallel (within EPSILON tolerance)
 * @param {number} wallIndex1 - Index of first wall
 * @param {number} wallIndex2 - Index of second wall
 * @param {Array<{x: number, y: number}>} points - Array of polygon points
 * @returns {boolean} True if walls are parallel
 */
function areWallsParallel(wallIndex1, wallIndex2, points) {
  if (wallIndex1 === wallIndex2) return true; // Same wall
  
  const wall1P1 = points[wallIndex1];
  const wall1P2 = points[(wallIndex1 + 1) % points.length];
  const wall2P1 = points[wallIndex2];
  const wall2P2 = points[(wallIndex2 + 1) % points.length];
  
  // Calculate direction vectors
  const dir1 = {
    x: wall1P2.x - wall1P1.x,
    y: wall1P2.y - wall1P1.y
  };
  const dir2 = {
    x: wall2P2.x - wall2P1.x,
    y: wall2P2.y - wall2P1.y
  };
  
  // Normalize vectors
  const len1 = Math.sqrt(dir1.x * dir1.x + dir1.y * dir1.y);
  const len2 = Math.sqrt(dir2.x * dir2.x + dir2.y * dir2.y);
  
  if (len1 < config.EPSILON || len2 < config.EPSILON) return false;
  
  dir1.x /= len1;
  dir1.y /= len1;
  dir2.x /= len2;
  dir2.y /= len2;
  
  // Check if vectors are parallel (dot product close to ±1)
  const dotProduct = Math.abs(dir1.x * dir2.x + dir1.y * dir2.y);
  return Math.abs(dotProduct - 1.0) < config.EPSILON;
}

/**
 * Validates that all selected walls are parallel
 * @param {Array<number>} wallIndices - Array of selected wall indices
 * @param {Array<{x: number, y: number}>} points - Array of polygon points
 * @returns {{isValid: boolean, error?: string}} Validation result
 */
function validateSelectedWalls(wallIndices, points) {
  if (wallIndices.length === 0) {
    return { isValid: false, error: "No walls selected" };
  }
  
  if (wallIndices.length === 1) {
    return { isValid: true }; // Single wall is always valid
  }
  
  // Check that all walls are parallel to the first one
  const firstWallIndex = wallIndices[0];
  for (let i = 1; i < wallIndices.length; i++) {
    if (!areWallsParallel(firstWallIndex, wallIndices[i], points)) {
      return { 
        isValid: false, 
        error: "All selected walls must be parallel to each other" 
      };
    }
  }
  
  return { isValid: true };
}

// --- Core Application Logic Functions ---

function decomposeClosedShape() {
  if (!appState.isShapeClosed || appState.points.length < 4) {
    appState.rectangularSections = [];
    return;
  }

  try {
    // Ensure we have a properly closed polygon for decomposition
    let pointsForDecomposition = [...appState.points];
    
    // Check if the shape is properly closed (first and last points should be the same)
    const firstPoint = pointsForDecomposition[0];
    const lastPoint = pointsForDecomposition[pointsForDecomposition.length - 1];
    const distance = Math.sqrt(
      Math.pow(firstPoint.x - lastPoint.x, 2) + Math.pow(firstPoint.y - lastPoint.y, 2)
    );
    
    if (distance > 0.1) { // If not closed, add closing point
      pointsForDecomposition.push({ ...firstPoint });
    }
    
    // Use selected wall indices if available, otherwise default to first wall
    const ledgerWallIndices = appState.selectedWallIndices.length > 0 ? appState.selectedWallIndices : [0];
    
    // Decompose the shape into rectangles with all selected ledger walls
    appState.rectangularSections = shapeDecomposer.decomposeShape(pointsForDecomposition, ledgerWallIndices);
    
    console.log(`Shape decomposed into ${appState.rectangularSections.length} rectangular sections`);
    
  } catch (error) {
    console.error("Shape decomposition failed:", error);
    appState.rectangularSections = [];
    uiController.updateCanvasStatus("Warning: Could not decompose shape into rectangles. Using simplified calculations.");
  }
}

function calculateAndUpdateDeckDimensions() {
  if (!appState.isShapeClosed || appState.points.length < 3) {
    appState.deckDimensions = null;
    return;
  }
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (let i = 0; i < appState.points.length; i++) {
    minX = Math.min(minX, appState.points[i].x);
    maxX = Math.max(maxX, appState.points[i].x);
    minY = Math.min(minY, appState.points[i].y);
    maxY = Math.max(maxY, appState.points[i].y);
  }
  const widthModelPixels = maxX - minX;
  const heightModelPixels = maxY - minY;
  appState.deckDimensions = {
    widthFeet: widthModelPixels / config.PIXELS_PER_FOOT,
    heightFeet: heightModelPixels / config.PIXELS_PER_FOOT,
    minX: minX,
    maxX: maxX,
    minY: minY,
    maxY: maxY,
  };
}

// Update UI CSS classes based on current application state
function updateUIClasses() {
  const canvasWrapper = document.getElementById('canvasContainerWrapper');
  
  // Reset interaction mode classes
  canvasWrapper.classList.remove('wall-selection-mode');
  canvasWrapper.classList.remove('stair-placement-mode');
  document.body.classList.remove('wall-selection-active');
  document.body.classList.remove('stair-placement-active');
  
  // Apply appropriate class based on current state
  if (appState.wallSelectionMode) {
    canvasWrapper.classList.add('wall-selection-mode');
    document.body.classList.add('wall-selection-active');
  } else if (appState.stairPlacementMode) {
    canvasWrapper.classList.add('stair-placement-mode');
    document.body.classList.add('stair-placement-active');
  }
}

function redrawApp() {
  // Update the blueprint mode UI elements
  updateBlueprintModeUI();
  
  // Update UI classes based on current interaction mode
  updateUIClasses();
  
  // Pass the blueprint mode to canvas logic
  canvasLogic.redrawCanvas({ 
    ...appState, 
    deckCanvasElement: deckCanvas,
    isBlueprintMode: appState.isBlueprintMode
  });
  
  if (appState.structuralComponents && !appState.structuralComponents.error) {
    uiController.populateBOMTable(appState.bom);
    uiController.populateSummaryCard(
      appState.structuralComponents,
      uiController.getFormInputs(),
      appState.deckDimensions,
      appState.stairs
    );
  } else if (appState.structuralComponents?.error) {
    uiController.populateBOMTable(null, appState.structuralComponents.error);
    uiController.populateSummaryCard(
      null,
      uiController.getFormInputs(),
      null,
      null,
      appState.structuralComponents.error
    );
  } else {
    uiController.resetUIOutputs();
  }
}

// Update Blueprint Mode UI elements
function updateBlueprintModeUI() {
  // Get the canvas container for blueprint styling
  const canvasWrapper = document.getElementById('canvasContainerWrapper');
  
  if (appState.isBlueprintMode) {
    // Update button state
    blueprintToggleBtn.classList.add('btn-primary');
    blueprintToggleBtn.classList.remove('btn-secondary');
    
    // Add blueprint mode class to container for CSS styling
    canvasWrapper.classList.add('blueprint-mode');
    document.body.classList.add('blueprint-enabled');
    
    // Don't show legends in blueprint mode as requested
    blueprintLegend.classList.add('hidden');
    dimensionsLegend.classList.add('hidden');
  } else {
    // Update button state
    blueprintToggleBtn.classList.add('btn-secondary');
    blueprintToggleBtn.classList.remove('btn-primary');
    
    // Remove blueprint mode class
    canvasWrapper.classList.remove('blueprint-mode');
    document.body.classList.remove('blueprint-enabled');
    
    // Keep legends hidden
    blueprintLegend.classList.add('hidden');
    dimensionsLegend.classList.add('hidden');
  }
}

function resetAppState() {
  appState.points = [];
  appState.isDrawing = false;
  appState.isShapeClosed = false;
  appState.currentMousePos = null;
  appState.currentModelMousePos = null;
  appState.wallSelectionMode = false;
  appState.selectedWallIndices = [];
  appState.stairPlacementMode = false;
  appState.selectedStairIndex = -1;
  appState.isDraggingStairs = false;
  appState.draggedStairIndex = -1;
  appState.deckDimensions = null;
  appState.structuralComponents = null;
  appState.stairs = [];
  appState.bom = [];
  appState.isPanning = false; // Reset panning state
  
  // Reset decomposition state
  appState.rectangularSections = [];
  appState.showDecompositionShading = false;
  
  // Reset dimension input state
  appState.isDimensionInputActive = false;
  appState.pendingDimensionStartPoint = null;
  hideDimensionInput();

  // Always start with blueprint mode off - user can enable it via the button if needed
  appState.isBlueprintMode = false;
  
  // Reset contextual panel state
  appState.currentPanelMode = 'drawing';

  initializeViewport();

  uiController.resetUIOutputs();
  uiController.toggleStairsInputSection(false);
  
  // Update contextual panel
  updateContextualPanel();
  
  redrawApp();
}

// --- Dimension Input Handling ---
function showDimensionInput() {
  if (dimensionInputContainer) {
    // Clear both inputs to avoid any stale values
    dimensionFeetInput.value = "";
    dimensionInchesInput.value = "";
    
    // Show the container and focus on feet input
    dimensionInputContainer.classList.remove("hidden");
    
    // Show helpful instruction for better usability
    uiController.updateCanvasStatus(
      "Enter feet, press Tab for inches. Press Enter when done or Escape to cancel."
    );
  }
}

function hideDimensionInput() {
  if (dimensionInputContainer) {
    dimensionInputContainer.classList.add("hidden");
    dimensionFeetInput.value = "";
    dimensionInchesInput.value = "";
  }
}

function handleDimensionInputCancel() {
  appState.isDimensionInputActive = false;
  appState.pendingDimensionStartPoint = null;
  hideDimensionInput();
  uiController.updateCanvasStatus("Click for next point, or type a number for precise measurement.");
}

function handleDimensionInputApply() {
  if (!appState.pendingDimensionStartPoint) {
    handleDimensionInputCancel();
    return;
  }
  
  // Get exact user input in feet and inches
  const feet = parseInt(dimensionFeetInput.value) || 0;
  const inches = parseInt(dimensionInchesInput.value) || 0;
  
  // Validation - must have a non-zero value
  if (feet === 0 && inches === 0) {
    dimensionFeetInput.classList.add('input-error');
    dimensionInchesInput.classList.add('input-error');
    dimensionInputContainer.classList.add('shake-animation');
    
    setTimeout(() => {
      dimensionFeetInput.classList.remove('input-error');
      dimensionInchesInput.classList.remove('input-error');
      dimensionInputContainer.classList.remove('shake-animation');
    }, 600);
    
    uiController.updateCanvasStatus("Please enter a valid dimension greater than 0.");
    return;
  }
  
  // ABSOLUTELY HARDCODED PIXEL VALUES
  // 24 pixels = 1 foot
  const pixelsPerFoot = 24;
  
  // Calculate the EXACT length in pixels based on user input
  const totalInches = (feet * 12) + inches;
  const exactPixels = (totalInches / 12) * pixelsPerFoot;
  
  // We need to know the starting point and mouse position for direction only
  const start = appState.pendingDimensionStartPoint;
  const mouse = appState.currentModelMousePos;
  
  if (!mouse) {
    handleDimensionInputCancel();
    return;
  }
  
  uiController.updateCanvasStatus(`Drawing line of exactly ${feet}' ${inches}"`);
  
  // Determine horizontal vs vertical based on mouse position
  const dx = mouse.x - start.x;
  const dy = mouse.y - start.y;
  const isHorizontal = Math.abs(dx) >= Math.abs(dy);
  
  // CREATE A COMPLETELY NEW POINT OBJECT
  const newPoint = {
    isManualDimension: true,  // Special flag to prevent ANY post-processing
    exactFeet: feet,          // Store the original values for reference
    exactInches: inches,
    exactPixels: exactPixels  // Store the exact pixel value
  };
  
  // FORCE EXACT DIMENSIONS WITH DIRECT MATH
  if (isHorizontal) {
    // HORIZONTAL LINE - EXACT X COORDINATE
    newPoint.x = dx >= 0 ? 
                (start.x + exactPixels) : // Right
                (start.x - exactPixels);  // Left
    newPoint.y = start.y; // EXACT same Y
    
    console.log(`HORIZONTAL ${dx >= 0 ? 'RIGHT' : 'LEFT'} LINE: ${feet}'${inches}" = ${totalInches} inches = ${exactPixels} pixels`);
  } else {
    // VERTICAL LINE - EXACT Y COORDINATE
    newPoint.x = start.x; // EXACT same X
    newPoint.y = dy >= 0 ? 
               (start.y + exactPixels) : // Down
               (start.y - exactPixels);  // Up
    
    console.log(`VERTICAL ${dy >= 0 ? 'DOWN' : 'UP'} LINE: ${feet}'${inches}" = ${totalInches} inches = ${exactPixels} pixels`);
  }
  
  // The dimension this point will show when drawn
  newPoint.displayDimension = `${feet}'${inches}"`;
  
  // VERIFY our dimension is EXACTLY as specified
  console.log(`Start: (${start.x}, ${start.y})`);
  console.log(`End: (${newPoint.x}, ${newPoint.y})`);
  
  if (isHorizontal) {
    const actualX = Math.abs(newPoint.x - start.x);
    console.log(`HORIZONTAL - X distance: ${actualX} pixels = ${actualX/pixelsPerFoot} feet`);
    if (Math.abs(actualX - exactPixels) > 0.01) {
      console.error("ERROR IN X DIMENSION!");
    }
  } else {
    const actualY = Math.abs(newPoint.y - start.y);
    console.log(`VERTICAL - Y distance: ${actualY} pixels = ${actualY/pixelsPerFoot} feet`);
    if (Math.abs(actualY - exactPixels) > 0.01) {
      console.error("ERROR IN Y DIMENSION!");
    }
  }
  
  // Visual feedback for success
  dimensionInputContainer.classList.add('success-animation');
  
  // Add the EXACT dimension point to our array
  appState.points.push(newPoint);
  console.log("ADDED EXACT DIMENSION POINT:", newPoint);
  
  if (appState.points.length >= 3) {
    // Check if we're close to the starting point to auto-close
    const modelSnapTolerance = config.SNAP_TOLERANCE_PIXELS / appState.viewportScale;
    if (utils.distance(exactPoint, appState.points[0]) < modelSnapTolerance) {
      // Add an exact copy of the first point to close the shape
      appState.points.push({ ...appState.points[0] });
      appState.isShapeClosed = true;
      appState.isDrawing = false;
      appState.currentMousePos = null;
      appState.currentModelMousePos = null;
      
      // Skip simplifying points with manual dimensions
      // appState.points = utils.simplifyPoints(appState.points);
      
      calculateAndUpdateDeckDimensions();
      appState.wallSelectionMode = true;
      uiController.updateCanvasStatus("Shape closed. Select the wall attached to structure.");
    } else {
      uiController.updateCanvasStatus("Next point or click near start to close.");
    }
  } else {
    uiController.updateCanvasStatus("Next point or click near start to close.");
  }
  
  // Reset dimension input state after a brief delay to allow the animation to complete
  setTimeout(() => {
    appState.isDimensionInputActive = false;
    appState.pendingDimensionStartPoint = null;
    hideDimensionInput();
    dimensionInputContainer.classList.remove('success-animation');
  }, 300);
  
  redrawApp();
}

function recalculateAndUpdateBOM() {
  if (appState.structuralComponents && !appState.structuralComponents.error) {
    const currentInputs = uiController.getFormInputs();
    const bomResult = bomCalculations.calculateBOM(
      appState.structuralComponents,
      currentInputs,
      appState.stairs,
      appState.deckDimensions
    );
    if (bomResult.error) {
      appState.bom = [];
      console.error("BOM Calculation Error:", bomResult.error);
      uiController.populateBOMTable(null, bomResult.error);
    } else {
      appState.bom = bomResult;
      uiController.populateBOMTable(appState.bom);
    }
    uiController.populateSummaryCard(
      appState.structuralComponents,
      currentInputs,
      appState.deckDimensions,
      appState.stairs
    );
  } else {
    appState.bom = [];
    uiController.populateBOMTable(appState.bom);
  }
}

// --- Event Handler Functions ---
function handleGeneratePlan() {
  if (!appState.isShapeClosed) {
    uiController.updateCanvasStatus(
      "Error: Please draw a complete deck outline first."
    );
    return;
  }
  if (appState.selectedWallIndices.length === 0) {
    uiController.updateCanvasStatus(
      "Error: Please select the attached wall(s) first."
    );
    return;
  }
  if (dataManager.getParsedStockData().length === 0) {
    uiController.updateCanvasStatus(
      "Error: Essential data not loaded. Check console."
    );
    return;
  }
  uiController.updateCanvasStatus("Calculating structure and materials...");
  uiController.resetUIOutputs();
  const inputs = uiController.getFormInputs();
  if (!appState.deckDimensions) calculateAndUpdateDeckDimensions();

  if (!appState.deckDimensions) {
    uiController.updateCanvasStatus(
      "Error: Could not calculate deck dimensions."
    );
    return;
  }
  try {
    appState.structuralComponents = deckCalculations.calculateStructure(
      appState.points,
      appState.selectedWallIndices[0], // Use first selected wall for now
      inputs,
      appState.deckDimensions
    );
    if (appState.structuralComponents && !appState.structuralComponents.error) {
      recalculateAndUpdateBOM();
    } else {
      appState.bom = [];
      const errorMsg =
        appState.structuralComponents?.error ||
        "Unknown structure calculation error.";
      uiController.populateBOMTable(null, errorMsg);
      uiController.populateSummaryCard(null, inputs, null, null, errorMsg);
    }
    redrawApp();
    
    // Update contextual panel if plan generation was successful
    if (appState.structuralComponents && !appState.structuralComponents.error) {
      updateContextualPanel();
    } else {
      uiController.updateCanvasStatus(
        `Error: ${appState.structuralComponents.error}`
      );
    }
  } catch (error) {
    console.error("Error during Generate Plan process:", error);
    uiController.updateCanvasStatus(
      "Error: An unexpected error occurred. Check console."
    );
    appState.structuralComponents = {
      error: "Unexpected error during generation.",
    };
    appState.bom = [];
    redrawApp();
  }
}

function handleAddStairs() {
  if (
    !appState.isShapeClosed ||
    !appState.structuralComponents ||
    appState.structuralComponents.error
  ) {
    uiController.updateCanvasStatus(
      "Error: Please generate a valid deck plan first."
    );
    return;
  }
  appState.stairPlacementMode = true;
  appState.selectedStairIndex = -1;
  uiController.toggleStairsInputSection(true);
  updateContextualPanel();
  uiController.updateCanvasStatus(
    "Configure stair details, then click a deck edge (rim joist) to place stairs."
  );
  redrawApp();
}

function handleCancelStairs() {
  appState.stairPlacementMode = false;
  uiController.toggleStairsInputSection(false);
  updateContextualPanel();
  uiController.updateCanvasStatus("Stair placement cancelled.");
  redrawApp();
}

function handleClearCanvas() {
  if (confirm("Are you sure you want to clear the drawing and all results?")) {
    resetAppState();
  }
}

function handleKeyDown(event) {
  // Handle Enter key for dimension input
  if (event.key === "Enter" && appState.isDimensionInputActive) {
    event.preventDefault();
    handleDimensionInputApply();
    return;
  }
  
  // Handle Escape key for dimension input
  if (event.key === "Escape" && appState.isDimensionInputActive) {
    event.preventDefault();
    handleDimensionInputCancel();
    return;
  }
  
  // Start dimension input if user is typing numbers while drawing
  if (
    appState.isDrawing &&
    !appState.isShapeClosed &&
    !appState.wallSelectionMode &&
    !appState.isDimensionInputActive &&
    appState.points.length > 0 &&
    (/^[0-9]$/.test(event.key) || event.key === ".")
  ) {
    // If the user starts typing a number, activate dimension input
    appState.isDimensionInputActive = true;
    appState.pendingDimensionStartPoint = appState.points[appState.points.length - 1];
    
    // First, make sure the input values are cleared
    dimensionFeetInput.value = "";
    dimensionInchesInput.value = "";
    
    // Then show the input container
    dimensionInputContainer.classList.remove("hidden");
    
    // AFTER the container is visible, set the value
    if (/^[0-9]$/.test(event.key)) {
      // Delay setting the value slightly to avoid browser input events
      setTimeout(() => {
        dimensionFeetInput.value = event.key;
        dimensionFeetInput.focus();
        try {
          dimensionFeetInput.setSelectionRange(
            dimensionFeetInput.value.length,
            dimensionFeetInput.value.length
          );
        } catch (e) {
          console.error("Could not set selection range", e);
        }
      }, 10);
    }
    
    uiController.updateCanvasStatus("Enter dimension or move mouse to set direction. Click to place point normally.");
    event.preventDefault(); // Prevent the key from being processed further
    return;
  }
  
  // Handle Tab key to switch between feet and inches inputs
  if (event.key === "Tab" && appState.isDimensionInputActive) {
    // We don't prevent default here to allow normal tabbing behavior
    // between the feet and inches input fields
  }
  
  if (
    event.key === "Backspace" &&
    appState.isDrawing &&
    !appState.isShapeClosed &&
    !appState.wallSelectionMode &&
    !appState.isDimensionInputActive &&
    appState.points.length > 0
  ) {
    event.preventDefault();
    appState.points.pop();
    if (appState.points.length === 0) appState.isDrawing = false;
    uiController.updateCanvasStatus(
      appState.points.length > 0 ? "Next point or close." : "Draw outline."
    );
    redrawApp();
  } else if (
    (event.key === "Delete" || event.key === "Del") &&
    appState.selectedStairIndex !== -1
  ) {
    event.preventDefault();
    if (confirm("Delete the selected stair set?")) {
      appState.stairs.splice(appState.selectedStairIndex, 1);
      appState.selectedStairIndex = -1;
      uiController.updateCanvasStatus(`Stair set deleted.`);
      recalculateAndUpdateBOM();
      redrawApp();
    }
  }
}

function handleCanvasClick(viewMouseX, viewMouseY) {
  // If panning was just completed on mouseup, don't process a click immediately
  if (appState.wasPanningOnMouseUp) {
    appState.wasPanningOnMouseUp = false; // Reset flag
    return;
  }
  const modelMouse = getModelMousePosition(viewMouseX, viewMouseY);
  appState.currentModelMousePos = modelMouse;

  // If dimension input is active, cancel it but DON'T place a point
  // This prevents double points when canceling dimension input
  if (appState.isDimensionInputActive) {
    handleDimensionInputCancel();
    return; // Skip placing a point on this click
  }

  if (appState.stairPlacementMode) {
    handleStairPlacementClick(modelMouse.x, modelMouse.y);
    return;
  }
  if (appState.wallSelectionMode) {
    const clickedWallIndex = canvasLogic.findClickedWallIndex(
      modelMouse.x,
      modelMouse.y,
      appState.points,
      appState.viewportScale
    );
    if (clickedWallIndex !== -1) {
      // Handle multi-wall selection
      const currentIndex = appState.selectedWallIndices.indexOf(clickedWallIndex);
      
      if (currentIndex === -1) {
        // Wall not selected - add it if parallel validation passes
        const tempIndices = [...appState.selectedWallIndices, clickedWallIndex];
        const validation = validateSelectedWalls(tempIndices, appState.points);
        
        if (validation.isValid) {
          appState.selectedWallIndices.push(clickedWallIndex);
          uiController.updateCanvasStatus(
            `${appState.selectedWallIndices.length} wall(s) selected for ledger attachment.`
          );
        } else {
          uiController.updateCanvasStatus(`Error: ${validation.error}`);
        }
      } else {
        // Wall already selected - remove it
        appState.selectedWallIndices.splice(currentIndex, 1);
        uiController.updateCanvasStatus(
          appState.selectedWallIndices.length > 0 
            ? `${appState.selectedWallIndices.length} wall(s) selected for ledger attachment.`
            : "Click wall edges to select for ledger attachment."
        );
      }
      
      // Update decomposition if we have at least one wall selected
      if (appState.selectedWallIndices.length > 0) {
        decomposeClosedShape();
      } else {
        appState.rectangularSections = [];
      }
      
      // Only exit wall selection mode when Generate Plan is clicked
      // Keep wall selection mode active for multi-selection
      updateContextualPanel();
    }
  } else if (
    !appState.isDrawing &&
    appState.isShapeClosed &&
    appState.stairs.length > 0
  ) {
    let didClickOnStair = false;
    for (let i = 0; i < appState.stairs.length; i++) {
      if (
        canvasLogic.isPointInStairBounds(
          modelMouse.x,
          modelMouse.y,
          appState.stairs[i],
          appState.deckDimensions,
          appState.viewportScale
        )
      ) {
        appState.selectedStairIndex =
          appState.selectedStairIndex === i ? -1 : i;
        didClickOnStair = true;
        break;
      }
    }
    if (
      !didClickOnStair &&
      appState.selectedStairIndex !== -1 &&
      !appState.isDraggingStairs
    ) {
      appState.selectedStairIndex = -1;
    }
    if (didClickOnStair && appState.isDraggingStairs) {
      /* Already handled by mousedown */
    } else if (didClickOnStair) {
      redrawApp();
      return;
    }
  }

  if (
    appState.isShapeClosed &&
    !appState.stairPlacementMode &&
    appState.selectedStairIndex === -1 &&
    !appState.isDraggingStairs
  ) {
    const clickedWallIdx = canvasLogic.findClickedWallIndex(
      modelMouse.x,
      modelMouse.y,
      appState.points,
      appState.viewportScale
    );
    if (
      clickedWallIdx !== -1 &&
      !appState.selectedWallIndices.includes(clickedWallIdx)
    ) {
      appState.wallSelectionMode = true;
      appState.selectedWallIndices = [];
      appState.structuralComponents = null;
      appState.bom = [];
      uiController.resetUIOutputs();
      updateContextualPanel();
    }
  }

  if (!appState.isShapeClosed && !appState.wallSelectionMode) {
    const snappedModelPos = canvasLogic.getSnappedPos(
      modelMouse.x,
      modelMouse.y,
      appState.points,
      appState.isShapeClosed
    );

    const modelLimitX = config.MODEL_WIDTH_FEET * config.PIXELS_PER_FOOT;
    const modelLimitY = config.MODEL_HEIGHT_FEET * config.PIXELS_PER_FOOT;
    if (
      snappedModelPos.x < 0 ||
      snappedModelPos.x > modelLimitX ||
      snappedModelPos.y < 0 ||
      snappedModelPos.y > modelLimitY
    ) {
      uiController.updateCanvasStatus(
        "Cannot draw outside the designated area (100ft x 100ft)."
      );
      redrawApp();
      return;
    }

    // Process new point or close shape
    if (appState.points.length >= 3) {
      const modelSnapTolerance =
        config.SNAP_TOLERANCE_PIXELS / appState.viewportScale;
      if (
        utils.distance(snappedModelPos, appState.points[0]) < modelSnapTolerance
      ) {
        // Create a temporary shape for validation that includes corner point and closing
        let tempPoints = [...appState.points];
        
        // Create orthogonal closing path if needed
        const lastPoint = tempPoints[tempPoints.length - 1];
        const startPoint = tempPoints[0];
        
        if (Math.abs(lastPoint.x - startPoint.x) > config.EPSILON && 
            Math.abs(lastPoint.y - startPoint.y) > config.EPSILON) {
          // We need to add a corner point to ensure 90-degree angles
          const dx = Math.abs(lastPoint.x - startPoint.x);
          const dy = Math.abs(lastPoint.y - startPoint.y);
          
          // Add the corner point - choose the direction based on the shorter distance
          const cornerPoint = {...lastPoint}; // start with a copy of the last point
          if (dx < dy) {
            // Go horizontally first
            cornerPoint.x = startPoint.x;
          } else {
            // Go vertically first
            cornerPoint.y = startPoint.y;
          }
          
          // Add the corner point to temp array
          tempPoints.push(cornerPoint);
        }
        
        // Add closing point to temp array
        tempPoints.push({ ...tempPoints[0] });
        
        // Validate the complete shape before accepting it
        const validation = shapeValidator.validateShape(tempPoints);
        if (!validation.isValid) {
          uiController.updateCanvasStatus(`Shape validation failed: ${validation.error}`);
          redrawApp();
          return;
        }
        
        // If validation passed, actually apply the changes
        if (tempPoints.length > appState.points.length + 1) {
          // Corner point was added
          appState.points.push(tempPoints[tempPoints.length - 2]); // Add corner point
          uiController.updateCanvasStatus(
            "Added corner point to maintain 90-degree angles."
          );
        }
        
        // Now close the shape
        appState.points.push({ ...appState.points[0] });
        
        appState.isShapeClosed = true;
        appState.isDrawing = false;
        appState.currentMousePos = null;
        appState.currentModelMousePos = null;
        
        // Only simplify points if no manual dimensions are present
        const hasManualDimensions = appState.points.some(p => p.isManualDimension === true);
        if (!hasManualDimensions) {
          appState.points = utils.simplifyPoints(appState.points);
        } else {
          console.log("IMPORTANT: Skipping simplification because manual dimensions are present");
        }
        
        calculateAndUpdateDeckDimensions();
        
        // Reset decomposition since no wall is selected yet
        appState.rectangularSections = [];
        
        appState.wallSelectionMode = true;
        
        updateContextualPanel();
      } else {
        // Simply add the point - we'll let keyboard input activate dimension entry if needed
        appState.points.push(snappedModelPos);
        appState.isDrawing = true;
        updateContextualPanel();
      }
    } else {
      if (
        appState.points.length === 0 ||
        utils.distance(
          snappedModelPos,
          appState.points[appState.points.length - 1]
        ) > config.EPSILON
      ) {
        // Add the first or second point
        appState.points.push(snappedModelPos);
        appState.isDrawing = true;
        updateContextualPanel();
      }
    }
  }
  redrawApp();
}

function handleStairPlacementClick(modelMouseX, modelMouseY) {
  if (
    !appState.structuralComponents ||
    !appState.structuralComponents.rimJoists
  )
    return;
  const clickedRimIndex = canvasLogic.findClickedRimJoistIndex(
    modelMouseX,
    modelMouseY,
    appState.structuralComponents.rimJoists,
    appState.structuralComponents.ledger,
    appState.viewportScale
  );
  if (clickedRimIndex !== -1) {
    const clickedRim = appState.structuralComponents.rimJoists[clickedRimIndex];
    const inputs = uiController.getFormInputs();
    const deckHeight = inputs.deckHeight;
    if (typeof deckHeight !== "number" || deckHeight <= 0) {
      uiController.updateCanvasStatus(
        "Error: Please select a valid Deck Height."
      );
      return;
    }
    const newStair = {
      rimJoistIndex: clickedRimIndex,
      rimP1: { ...clickedRim.p1 },
      rimP2: { ...clickedRim.p2 },
      fullEdgeP1: { ...(clickedRim.fullEdgeP1 || clickedRim.p1) },
      fullEdgeP2: { ...(clickedRim.fullEdgeP2 || clickedRim.p2) },
      widthFt: inputs.stairWidth,
      stringerType: inputs.stringerType,
      landingType: inputs.landingType,
      positionX: (clickedRim.p1.x + clickedRim.p2.x) / 2,
      positionY: (clickedRim.p1.y + clickedRim.p2.y) / 2,
    };
    stairCalculations.calculateStairDetails(newStair, deckHeight);
    if (newStair.calculationError) {
      uiController.updateCanvasStatus(`Error: ${newStair.calculationError}`);
    } else {
      appState.stairs.push(newStair);
      appState.stairPlacementMode = false;
      uiController.toggleStairsInputSection(false);
      updateContextualPanel(); // Return to plan-generated panel
      uiController.updateCanvasStatus(
        `Stairs added. Total: ${appState.stairs.length}.`
      );
      recalculateAndUpdateBOM();
    }
  } else {
    uiController.updateCanvasStatus(
      "Click a deck edge (rim joist) to place stairs."
    );
  }
  redrawApp();
}

function handleCanvasMouseMove(viewMouseX, viewMouseY) {
  appState.currentMousePos = { x: viewMouseX, y: viewMouseY };
  const modelMouse = getModelMousePosition(viewMouseX, viewMouseY);
  appState.currentModelMousePos = modelMouse;

  if (appState.isPanning) {
    const deltaViewX = viewMouseX - appState.panStartViewX;
    const deltaViewY = viewMouseY - appState.panStartViewY;
    appState.viewportOffsetX = appState.panInitialViewportOffsetX + deltaViewX;
    appState.viewportOffsetY = appState.panInitialViewportOffsetY + deltaViewY;
    redrawApp();
    return; // Don't do other mouse move logic while panning
  }

  if (appState.isDraggingStairs && appState.draggedStairIndex !== -1) {
    const draggedStair = appState.stairs[appState.draggedStairIndex];
    if (!draggedStair || !draggedStair.fullEdgeP1 || !draggedStair.fullEdgeP2) {
      appState.isDraggingStairs = false;
      return;
    }
    const dragEdgeP1 = draggedStair.fullEdgeP1;
    const dragEdgeP2 = draggedStair.fullEdgeP2;
    const rimDx = dragEdgeP2.x - dragEdgeP1.x;
    const rimDy = dragEdgeP2.y - dragEdgeP1.y;
    const rimLengthSq = rimDx * rimDx + rimDy * rimDy;

    if (rimLengthSq > config.EPSILON * config.EPSILON) {
      let t =
        ((modelMouse.x - dragEdgeP1.x) * rimDx +
          (modelMouse.y - dragEdgeP1.y) * rimDy) /
        rimLengthSq;
      const stairWidthModelPixels =
        (draggedStair.widthFt || 0) * config.PIXELS_PER_FOOT;
      const rimLengthModel = Math.sqrt(rimLengthSq);
      let minT = 0,
        maxT = 1;
      if (rimLengthModel > stairWidthModelPixels + config.EPSILON) {
        const halfWidthRatio = stairWidthModelPixels / 2 / rimLengthModel;
        minT = halfWidthRatio;
        maxT = 1 - halfWidthRatio;
      }
      t = Math.max(minT, Math.min(maxT, t));
      draggedStair.positionX = dragEdgeP1.x + t * rimDx;
      draggedStair.positionY = dragEdgeP1.y + t * rimDy;
    }
  }

  if (
    appState.isDrawing ||
    appState.wallSelectionMode ||
    appState.isDraggingStairs ||
    appState.stairPlacementMode ||
    appState.selectedStairIndex !== -1
  ) {
    redrawApp();
  }
}

function handleCanvasMouseDown(viewMouseX, viewMouseY, event) {
  // Panning with middle mouse button (button code 1)
  if (
    event.button === 1 &&
    !appState.isDrawing &&
    !appState.stairPlacementMode
  ) {
    appState.isPanning = true;
    appState.panStartViewX = viewMouseX;
    appState.panStartViewY = viewMouseY;
    appState.panInitialViewportOffsetX = appState.viewportOffsetX;
    appState.panInitialViewportOffsetY = appState.viewportOffsetY;
    if (deckCanvas) deckCanvas.style.cursor = "grabbing";
    event.preventDefault();
    return;
  }

  // Only process left clicks (button 0) for other actions if not already drawing/placing stairs etc.
  if (event.button !== 0) return;

  const modelMouse = getModelMousePosition(viewMouseX, viewMouseY);
  appState.currentModelMousePos = modelMouse;

  if (
    appState.isDrawing ||
    appState.stairPlacementMode ||
    appState.wallSelectionMode ||
    appState.isDraggingStairs
  )
    return;

  if (appState.isShapeClosed && appState.stairs.length > 0) {
    for (let i = 0; i < appState.stairs.length; i++) {
      if (
        canvasLogic.isPointInStairBounds(
          modelMouse.x,
          modelMouse.y,
          appState.stairs[i],
          appState.deckDimensions,
          appState.viewportScale
        )
      ) {
        appState.isDraggingStairs = true;
        appState.draggedStairIndex = i;
        appState.selectedStairIndex = i;
        appState.dragStartX = viewMouseX;
        appState.dragStartY = viewMouseY;
        appState.dragInitialStairX = appState.stairs[i].positionX;
        appState.dragInitialStairY = appState.stairs[i].positionY;
        if (deckCanvas) deckCanvas.style.cursor = "grabbing";
        event.preventDefault();
        redrawApp();
        return;
      }
    }
  }
}

function handleCanvasMouseUp(event) {
  appState.wasPanningOnMouseUp = appState.isPanning; // Flag to prevent click after pan

  if (appState.isPanning) {
    appState.isPanning = false;
    if (deckCanvas) deckCanvas.style.cursor = "default"; // Or "grab" if pannable mode is toggleable
    redrawApp(); // May not be needed if mousemove already redrew
  }
  if (appState.isDraggingStairs) {
    appState.isDraggingStairs = false;
    if (deckCanvas) deckCanvas.style.cursor = "default";
    recalculateAndUpdateBOM();
    redrawApp();
  }
}

function handleCanvasResize() {
  const oldCanvasWidth = deckCanvas.width;
  const oldCanvasHeight = deckCanvas.height;
  const modelPtAtOldCenter = getModelMousePosition(
    oldCanvasWidth / 2,
    oldCanvasHeight / 2
  );

  // CanvasLogic will resize the canvas element via its observer
  // After resize, get new dimensions
  const newCanvasWidth = deckCanvas.width;
  const newCanvasHeight = deckCanvas.height;

  // Adjust viewport offset to keep the same model point at the center of the new canvas size
  if (oldCanvasWidth > 0 && oldCanvasHeight > 0) {
    // Avoid issues if initial size was 0
    appState.viewportOffsetX =
      newCanvasWidth / 2 - modelPtAtOldCenter.x * appState.viewportScale;
    appState.viewportOffsetY =
      newCanvasHeight / 2 - modelPtAtOldCenter.y * appState.viewportScale;
  } else {
    initializeViewport(); // Fallback if old dimensions were invalid
  }
  redrawApp();
}

// --- Zoom and Fit Handlers ---
function calculateMinUsableScale() {
  if (!deckCanvas) return config.MIN_ZOOM_SCALE;
  
  const canvasWidth = deckCanvas.width;
  const canvasHeight = deckCanvas.height;
  const modelLimitPixelsX = config.MODEL_WIDTH_FEET * config.PIXELS_PER_FOOT;
  const modelLimitPixelsY = config.MODEL_HEIGHT_FEET * config.PIXELS_PER_FOOT;
  
  // Calculate scale where 100ft x 100ft area fits comfortably in canvas
  const scaleX = (canvasWidth * 0.85) / modelLimitPixelsX;  // 85% to leave margin
  const scaleY = (canvasHeight * 0.85) / modelLimitPixelsY;
  
  return Math.min(scaleX, scaleY);
}

function handleZoom(zoomIn) {
  const oldScale = appState.viewportScale;
  let newScale;
  if (zoomIn) {
    newScale = oldScale * config.ZOOM_INCREMENT_FACTOR;
  } else {
    newScale = oldScale / config.ZOOM_INCREMENT_FACTOR;
  }
  // Calculate minimum zoom scale to keep 100ft x 100ft area visible
  const minUsableScale = calculateMinUsableScale();
  
  newScale = Math.max(
    minUsableScale,  // Don't zoom out past where 100ft area is visible
    Math.min(newScale, config.MAX_ZOOM_SCALE)
  );

  if (Math.abs(newScale - oldScale) < config.EPSILON / 100) return;

  const canvasCenterX = deckCanvas.width / 2;
  const canvasCenterY = deckCanvas.height / 2;

  const modelPtAtCanvasCenterX =
    (canvasCenterX - appState.viewportOffsetX) / oldScale;
  const modelPtAtCanvasCenterY =
    (canvasCenterY - appState.viewportOffsetY) / oldScale;

  appState.viewportScale = newScale;
  appState.viewportOffsetX =
    canvasCenterX - modelPtAtCanvasCenterX * appState.viewportScale;
  appState.viewportOffsetY =
    canvasCenterY - modelPtAtCanvasCenterY * appState.viewportScale;

  redrawApp();
}

function handleCenterFit() {
  if (!deckCanvas || deckCanvas.width === 0 || deckCanvas.height === 0) return;

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  let hasContent = false;

  if (appState.points.length > 0) {
    appState.points.forEach((p) => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
      hasContent = true;
    });
  }

  if (appState.stairs.length > 0) {
    appState.stairs.forEach((stair) => {
      if (
        stair.rimP1 &&
        stair.rimP2 &&
        typeof stair.calculatedTotalRunInches === "number"
      ) {
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

        if (appState.deckDimensions) {
          const deckCenterX =
            (appState.deckDimensions.minX + appState.deckDimensions.maxX) / 2;
          const deckCenterY =
            (appState.deckDimensions.minY + appState.deckDimensions.maxY) / 2;
          const vecToStairAttachX = stair.positionX - deckCenterX;
          const vecToStairAttachY = stair.positionY - deckCenterY;
          if (perpX * vecToStairAttachX + perpY * vecToStairAttachY < 0) {
            perpX *= -1;
            perpY *= -1;
          }
        }

        const sPoints = [
          {
            x: stair.positionX - ((rimDx / rimLength) * stairWidthModel) / 2,
            y: stair.positionY - ((rimDy / rimLength) * stairWidthModel) / 2,
          },
          {
            x: stair.positionX + ((rimDx / rimLength) * stairWidthModel) / 2,
            y: stair.positionY + ((rimDy / rimLength) * stairWidthModel) / 2,
          },
        ];
        sPoints.push({
          x: sPoints[0].x + perpX * totalRunModel,
          y: sPoints[0].y + perpY * totalRunModel,
        });
        sPoints.push({
          x: sPoints[1].x + perpX * totalRunModel,
          y: sPoints[1].y + perpY * totalRunModel,
        });

        sPoints.forEach((p) => {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
          hasContent = true;
        });
      }
    });
  }

  if (!hasContent) {
    initializeViewport();
    redrawApp();
    return;
  }

  const paddingModel = config.PIXELS_PER_FOOT * 2;
  minX -= paddingModel;
  minY -= paddingModel;
  maxX += paddingModel;
  maxY += paddingModel;

  const contentWidthModel = maxX - minX;
  const contentHeightModel = maxY - minY;

  if (
    contentWidthModel < config.EPSILON ||
    contentHeightModel < config.EPSILON
  ) {
    appState.viewportScale = 1.0;
  } else {
    const canvasWidth = deckCanvas.width;
    const canvasHeight = deckCanvas.height;
    const scaleX = (canvasWidth * 0.9) / contentWidthModel; // MODIFIED: Target 90% of view
    const scaleY = (canvasHeight * 0.9) / contentHeightModel; // MODIFIED: Target 90% of view
    appState.viewportScale = Math.min(scaleX, scaleY);
  }

  appState.viewportScale = Math.max(
    config.MIN_ZOOM_SCALE,
    Math.min(appState.viewportScale, config.MAX_ZOOM_SCALE)
  );

  const contentCenterXModel = (minX + maxX) / 2;
  const contentCenterYModel = (minY + maxY) / 2;

  appState.viewportOffsetX =
    deckCanvas.width / 2 - contentCenterXModel * appState.viewportScale;
  appState.viewportOffsetY =
    deckCanvas.height / 2 - contentCenterYModel * appState.viewportScale;

  redrawApp();
}

// --- Print Event Handlers ---
function beforePrintHandler() {
  appState.isPrinting = true;
  
  // Format today's date for printing
  const now = new Date();
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  const formattedDate = now.toLocaleDateString('en-US', options);
  
  // Add current date to the body for print styles to use
  document.body.setAttribute('data-print-date', formattedDate);
  
  // Add classes for print styling
  document.body.classList.add('is-printing');
  
  redrawApp();
}

// --- Print Button Handler with Project Name Prompt ---
function handlePrintPage() {
  // Check if there's a plan generated with summary data
  const summaryList = document.getElementById('summaryList');
  if (!summaryList || summaryList.children.length === 0) {
    alert("Please generate a deck plan first before printing.");
    return;
  }
  
  // Prompt for project name
  const projectName = prompt("Enter project name for this deck plan:", "My Deck Project");
  
  if (projectName !== null) { // User didn't cancel
    // Store the project name for use in print styles
    document.body.setAttribute('data-project-name', projectName.trim() || 'Unnamed Project');
    
    // Ensure the summary section is visible for printing
    const summarySection = document.getElementById('summarySection');
    if (summarySection) {
      summarySection.classList.remove('hidden');
    }
    
    // Trigger print
    window.print();
    
    // Clean up after printing
    setTimeout(() => {
      document.body.removeAttribute('data-project-name');
    }, 1000);
  }
}

function afterPrintHandler() {
  appState.isPrinting = false;
  
  // Remove print-specific attributes and classes
  document.body.removeAttribute('data-print-date');
  document.body.classList.remove('is-printing');
  
  redrawApp();
}

// --- Blueprint Mode Toggle ---
function handleBlueprintToggle() {
  // Add animation class before toggling
  const canvas = document.getElementById('deckCanvas');
  const canvasWrapper = document.getElementById('canvasContainerWrapper');
  
  canvas.classList.add('mode-transition');
  
  // Add ripple effect to the button
  const btn = document.getElementById('blueprintToggleBtn');
  btn.classList.add('ripple-effect');
  
  // Toggle blueprint mode
  appState.isBlueprintMode = !appState.isBlueprintMode;
  
  // Add transition class to canvas container for enhanced visual feedback
  canvasWrapper.classList.add('mode-changing');
  
  // Update UI and redraw
  redrawApp();
  
  // Update status message with appropriate guidance
  if (appState.isBlueprintMode) {
    uiController.updateCanvasStatus("Blueprint mode: Components shown with actual dimensions");
  } else {
    uiController.updateCanvasStatus("Standard view: Simple line drawing");
  }
  
  // Remove animation classes after transitions complete
  setTimeout(() => {
    canvas.classList.remove('mode-transition');
    canvasWrapper.classList.remove('mode-changing');
    btn.classList.remove('ripple-effect');
  }, 500);
}

// --- Decomposition Visualization Toggle ---
function handleToggleDecomposition() {
  appState.showDecompositionShading = !appState.showDecompositionShading;
  
  // Update button appearance
  if (appState.showDecompositionShading) {
    toggleDecompositionBtn.classList.add('btn-primary');
    toggleDecompositionBtn.classList.remove('btn-secondary');
    uiController.updateCanvasStatus("Decomposition view: Showing rectangle decomposition");
  } else {
    toggleDecompositionBtn.classList.add('btn-secondary');
    toggleDecompositionBtn.classList.remove('btn-primary');
    uiController.updateCanvasStatus("Standard view: Rectangle decomposition hidden");
  }
  
  redrawApp();
}

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  dataManager.loadAndParseData();
  if (deckCanvas && canvasContainer) {
    canvasLogic.initializeCanvas(
      deckCanvas,
      canvasContainer,
      handleCanvasClick,
      handleCanvasMouseMove,
      handleCanvasMouseDown,
      handleCanvasMouseUp,
      handleCanvasResize
    );
    // initializeViewport is called within resetAppState after canvas might have initial size
  } else {
    console.error("Canvas or container element not found!");
    return;
  }

  if (generatePlanBtn)
    generatePlanBtn.addEventListener("click", handleGeneratePlan);
  if (addStairsBtn) addStairsBtn.addEventListener("click", handleAddStairs);
  if (cancelStairsBtn)
    cancelStairsBtn.addEventListener("click", handleCancelStairs);
  if (clearCanvasBtn)
    clearCanvasBtn.addEventListener("click", handleClearCanvas);
  if (printBomBtn) printBomBtn.addEventListener("click", handlePrintPage);

  if (zoomInBtn) zoomInBtn.addEventListener("click", () => handleZoom(true));
  if (zoomOutBtn) zoomOutBtn.addEventListener("click", () => handleZoom(false));
  if (centerFitBtn) centerFitBtn.addEventListener("click", handleCenterFit);
  if (blueprintToggleBtn) blueprintToggleBtn.addEventListener("click", handleBlueprintToggle);
  if (toggleDecompositionBtn) toggleDecompositionBtn.addEventListener("click", handleToggleDecomposition);

  // Add dimension input button event listeners
  if (applyDimensionBtn) applyDimensionBtn.addEventListener("click", handleDimensionInputApply);
  if (cancelDimensionBtn) cancelDimensionBtn.addEventListener("click", handleDimensionInputCancel);

  document.addEventListener("keydown", handleKeyDown);
  window.addEventListener("beforeprint", beforePrintHandler);
  window.addEventListener("afterprint", afterPrintHandler);

  resetAppState();
  updateContextualPanel(); // Initialize contextual panel
  console.log("Deck Calculator App Initialized with Zoom/Pan features, Dimension Input, Blueprint mode, and Contextual Panels.");
});

// --- Global Utility Functions for HTML ---
window.toggleCollapsible = function(button) {
  const content = button.nextElementSibling;
  const isExpanded = content.classList.contains('expanded');
  
  if (isExpanded) {
    content.classList.remove('expanded');
    button.classList.remove('expanded');
  } else {
    content.classList.add('expanded');
    button.classList.add('expanded');
  }
};

window.toggleSpecEditor = function() {
  const editor = document.querySelector('.spec-editor');
  const summarySection = document.getElementById('summarySection');
  const actionButtons = document.querySelector('.action-buttons');
  const button = document.querySelector('.modify-specs-btn');
  
  if (editor && summarySection && actionButtons && button) {
    const isHidden = editor.classList.contains('hidden');
    
    if (isHidden) {
      // Show the editor, hide the summary
      editor.classList.remove('hidden');
      summarySection.classList.add('hidden');
      actionButtons.classList.add('hidden');
      button.classList.add('active');
      
      // Sync current values to modify form
      syncModifySpecValues();
    } else {
      // Hide the editor, show the summary
      editor.classList.add('hidden');
      summarySection.classList.remove('hidden');
      actionButtons.classList.remove('hidden');
      button.classList.remove('active');
    }
  }
};

window.regeneratePlan = function() {
  // Copy values from modify form back to main form
  syncMainSpecValues();
  
  // Close the spec editor
  window.toggleSpecEditor();
  
  // Regenerate the plan
  handleGeneratePlan();
};

function syncModifySpecValues() {
  // Sync current values to modify form
  const heightFeet = document.getElementById('deckHeightFeet');
  const heightInches = document.getElementById('deckHeightInchesInput');
  const footingType = document.getElementById('footingType');
  const joistSpacing = document.getElementById('joistSpacing');
  const attachmentType = document.getElementById('attachmentType');
  const beamType = document.getElementById('beamType');
  const pictureFrame = document.getElementById('pictureFrame');
  const joistProtection = document.getElementById('joistProtection');
  const fasteners = document.getElementById('fasteners');
  
  const modifyHeightFeet = document.getElementById('modifyHeightFeet');
  const modifyHeightInches = document.getElementById('modifyHeightInches');
  const modifyFootingType = document.getElementById('modifyFootingType');
  const modifyJoistSpacing = document.getElementById('modifyJoistSpacing');
  const modifyAttachmentType = document.getElementById('modifyAttachmentType');
  const modifyBeamType = document.getElementById('modifyBeamType');
  const modifyPictureFrame = document.getElementById('modifyPictureFrame');
  const modifyJoistProtection = document.getElementById('modifyJoistProtection');
  const modifyFasteners = document.getElementById('modifyFasteners');
  
  if (heightFeet && modifyHeightFeet) modifyHeightFeet.value = heightFeet.value;
  if (heightInches && modifyHeightInches) modifyHeightInches.value = heightInches.value;
  if (footingType && modifyFootingType) modifyFootingType.value = footingType.value;
  if (joistSpacing && modifyJoistSpacing) modifyJoistSpacing.value = joistSpacing.value;
  if (attachmentType && modifyAttachmentType) modifyAttachmentType.value = attachmentType.value;
  if (beamType && modifyBeamType) modifyBeamType.value = beamType.value;
  if (pictureFrame && modifyPictureFrame) modifyPictureFrame.value = pictureFrame.value;
  if (joistProtection && modifyJoistProtection) modifyJoistProtection.value = joistProtection.value;
  if (fasteners && modifyFasteners) modifyFasteners.value = fasteners.value;
}

function syncMainSpecValues() {
  // Copy values from modify form back to main form
  const modifyHeightFeet = document.getElementById('modifyHeightFeet');
  const modifyHeightInches = document.getElementById('modifyHeightInches');
  const modifyFootingType = document.getElementById('modifyFootingType');
  const modifyJoistSpacing = document.getElementById('modifyJoistSpacing');
  const modifyAttachmentType = document.getElementById('modifyAttachmentType');
  const modifyBeamType = document.getElementById('modifyBeamType');
  const modifyPictureFrame = document.getElementById('modifyPictureFrame');
  const modifyJoistProtection = document.getElementById('modifyJoistProtection');
  const modifyFasteners = document.getElementById('modifyFasteners');
  
  const heightFeet = document.getElementById('deckHeightFeet');
  const heightInches = document.getElementById('deckHeightInchesInput');
  const footingType = document.getElementById('footingType');
  const joistSpacing = document.getElementById('joistSpacing');
  const attachmentType = document.getElementById('attachmentType');
  const beamType = document.getElementById('beamType');
  const pictureFrame = document.getElementById('pictureFrame');
  const joistProtection = document.getElementById('joistProtection');
  const fasteners = document.getElementById('fasteners');
  
  if (modifyHeightFeet && heightFeet) {
    heightFeet.value = modifyHeightFeet.value;
  }
  
  if (modifyHeightInches && heightInches) {
    heightInches.value = modifyHeightInches.value;
  }
  
  if (modifyFootingType && footingType) {
    footingType.value = modifyFootingType.value;
  }
  
  if (modifyJoistSpacing && joistSpacing) {
    joistSpacing.value = modifyJoistSpacing.value;
  }
  
  if (modifyAttachmentType && attachmentType) {
    attachmentType.value = modifyAttachmentType.value;
  }
  
  if (modifyBeamType && beamType) {
    beamType.value = modifyBeamType.value;
  }
  
  if (modifyPictureFrame && pictureFrame) {
    pictureFrame.value = modifyPictureFrame.value;
  }
  
  if (modifyJoistProtection && joistProtection) {
    joistProtection.value = modifyJoistProtection.value;
  }
  
  if (modifyFasteners && fasteners) {
    fasteners.value = modifyFasteners.value;
  }
}


// --- Tab Navigation Functions ---
window.switchTab = function(tabName) {
  // Hide all tab contents
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(content => {
    content.classList.remove('active');
  });
  
  // Remove active state from all tab buttons
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.classList.remove('active');
    button.setAttribute('aria-selected', 'false');
  });
  
  // Show the selected tab content
  const targetContent = document.getElementById(`${tabName}-content`);
  if (targetContent) {
    targetContent.classList.add('active');
  }
  
  // Activate the selected tab button
  const targetButton = document.getElementById(`${tabName}-tab`);
  if (targetButton) {
    targetButton.classList.add('active');
    targetButton.setAttribute('aria-selected', 'true');
  }
  
  // Handle any tab-specific initialization
  switch(tabName) {
    case 'structure':
      // Structure tab is active - no special handling needed
      break;
    case 'decking':
      // Future: Initialize decking calculator
      break;
    case 'railing':
      // Future: Initialize railing calculator
      break;
    case 'summary':
      // Future: Initialize enhanced summary view
      break;
  }
};
