// app.js - Main Application Logic (v6 - Panning & Button Relocation)

// --- Module Imports ---
import * as config from "./config.js?v=8";
import * as utils from "./utils.js?v=8";
import * as dataManager from "./dataManager.js?v=8";
import * as uiController from "./uiController.js?v=8";
import * as deckCalculations from "./deckCalculations.js?v=8";
import * as stairCalculations from "./stairCalculations.js?v=8";
import * as canvasLogic from "./canvasLogic.js?v=8";
import * as bomCalculations from "./bomCalculations.js?v=8";
import * as shapeValidator from "./shapeValidator.js?v=8";
import * as shapeDecomposer from "./shapeDecomposer.js?v=8";

import * as multiSectionCalculations from "./multiSectionCalculations.js?v=8";

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
  hoveredStairIndex: -1,
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

  // Layer visibility state
  layerVisibility: {
    outline: true,
    ledger: true,
    joists: true,
    beams: true,
    posts: true,
    blocking: true,
    dimensions: true,
    stairs: true
  },

  // Contextual panel state
  currentPanelMode: 'drawing', // 'drawing', 'wall-selection', 'specification', 'plan-generated', 'stair-config'

  // Undo/Redo History
  history: [],
  historyIndex: -1,
  maxHistorySize: 50,
  isUndoRedoAction: false // Flag to prevent saving during undo/redo
};

// Make appState available globally for section tab debugging
window.appState = appState;

// --- DOM Element References ---
const generatePlanBtn = document.getElementById("generatePlanBtn");
const addStairsBtn = document.getElementById("addStairsBtn");
const clearCanvasBtn = document.getElementById("clearCanvasBtn");
const deckCanvas = document.getElementById("deckCanvas");
const canvasContainer = document.getElementById("canvasContainer");
const printBomBtn = document.getElementById("printBomBtn");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const centerFitBtn = document.getElementById("centerFitBtn");
const blueprintToggleBtn = document.getElementById("blueprintToggleBtn");
const toggleDecompositionBtn = document.getElementById("toggleDecompositionBtn");

// Get form element references
const joistSpacing = document.getElementById("joistSpacing");
const attachmentType = document.getElementById("attachmentType");
const beamType = document.getElementById("beamType");
const pictureFrame = document.getElementById("pictureFrame");
const joistProtection = document.getElementById("joistProtection");
const fasteners = document.getElementById("fasteners");

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
  const targetPanelId = mode === 'drawing' ? 'drawing-mode-panel' : 
                        mode === 'wall-selection' ? 'wall-selection-panel' :
                        mode === 'plan-generated' ? 'plan-generated-panel' :
                        mode === 'stair-config' ? 'stair-config-panel' : '';
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
 * Validates selected walls
 * Note: Parallel requirement removed to support bay window configurations
 * where diagonal edges (following bay window shape) are also ledgers
 * @param {Array<number>} wallIndices - Array of selected wall indices
 * @param {Array<{x: number, y: number}>} points - Array of polygon points
 * @returns {{isValid: boolean, error?: string}} Validation result
 */
function validateSelectedWalls(wallIndices, points) {
  if (wallIndices.length === 0) {
    return { isValid: false, error: "No walls selected" };
  }

  // Any combination of edges can be selected as ledgers
  // First selected edge determines joist direction
  return { isValid: true };
}

// --- Shape Analysis Functions ---

/**
 * Determines if the current shape is complex (requires multi-section calculations)
 * @returns {boolean} True if shape requires multi-section calculations
 */
function isComplexShape() {
  // Use multi-section calculations if we have multiple rectangular sections
  return appState.rectangularSections && 
         appState.rectangularSections.length > 1;
}

/**
 * Determines if shape has only one rectangular section (simple rectangle)
 * @returns {boolean} True if shape is a simple rectangle
 */
function isSimpleRectangle() {
  return multiSectionCalculations.isSimpleRectangle(appState.rectangularSections);
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
  const widthFeet = widthModelPixels / config.PIXELS_PER_FOOT;
  const heightFeet = heightModelPixels / config.PIXELS_PER_FOOT;

  // Calculate actual area from rectangular sections (for complex shapes like L, U)
  let actualAreaSqFt = 0;
  if (appState.rectangularSections && appState.rectangularSections.length > 0) {
    appState.rectangularSections.forEach(section => {
      const sectionDims = multiSectionCalculations.calculateSectionDimensions(section);
      actualAreaSqFt += sectionDims.widthFeet * sectionDims.heightFeet;
    });
  } else {
    // Simple rectangle - use bounding box
    actualAreaSqFt = widthFeet * heightFeet;
  }

  appState.deckDimensions = {
    widthFeet: widthFeet,
    heightFeet: heightFeet,
    actualAreaSqFt: actualAreaSqFt,
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
    // Populate structural specifications section
    uiController.populateStructuralSpecs(
      appState.structuralComponents,
      uiController.getFormInputs(),
      appState.deckDimensions
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
  
  // Update stair management UI
  updateStairList();
}

// Update Blueprint Mode UI elements
function updateBlueprintModeUI() {
  // Get the canvas container for blueprint styling
  const canvasWrapper = document.getElementById('canvasContainerWrapper');

  if (appState.isBlueprintMode) {
    // Update button state
    if (blueprintToggleBtn) {
      blueprintToggleBtn.classList.add('btn-primary');
      blueprintToggleBtn.classList.remove('btn-secondary');
    }

    // Add blueprint mode class to container for CSS styling
    if (canvasWrapper) canvasWrapper.classList.add('blueprint-mode');
    document.body.classList.add('blueprint-enabled');

    // Don't show legends in blueprint mode as requested (if they exist)
    if (blueprintLegend) blueprintLegend.classList.add('hidden');
    if (dimensionsLegend) dimensionsLegend.classList.add('hidden');
  } else {
    // Update button state
    if (blueprintToggleBtn) {
      blueprintToggleBtn.classList.add('btn-secondary');
      blueprintToggleBtn.classList.remove('btn-primary');
    }

    // Remove blueprint mode class
    if (canvasWrapper) canvasWrapper.classList.remove('blueprint-mode');
    document.body.classList.remove('blueprint-enabled');

    // Keep legends hidden (if they exist)
    if (blueprintLegend) blueprintLegend.classList.add('hidden');
    if (dimensionsLegend) dimensionsLegend.classList.add('hidden');
  }
}

function resetAppState() {
  // Clear undo/redo history
  clearHistory();

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
  appState.hoveredStairIndex = -1;
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
  
  // Force contextual panel to drawing mode
  appState.currentPanelMode = 'drawing';
  showContextualPanel('drawing'); // Directly show drawing panel
  
  // Reset all form inputs to their default values
  resetAllFormInputs();

  initializeViewport();

  uiController.resetUIOutputs();
  uiController.toggleStairsInputSection(false);
  
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
  saveHistoryState('Add dimension point');
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
      saveHistoryState('Close shape');
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
    // Check if we should use multi-section calculations
    if (isComplexShape()) {
      console.log("Using multi-section calculations for complex shape");
      appState.structuralComponents = multiSectionCalculations.calculateMultiSectionStructure(
        appState.rectangularSections,
        inputs,
        appState.selectedWallIndices,
        appState.points
      );
    } else {
      console.log("Using standard calculations for simple shape");
      appState.structuralComponents = deckCalculations.calculateStructure(
        appState.points,
        appState.selectedWallIndices, // Pass all selected ledger edges
        inputs,
        appState.deckDimensions
      );
    }
    
    // Log calculation results for debugging
    console.log("Structural calculation result:", appState.structuralComponents);
    
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
      // Disable wall selection mode after successful plan generation
      appState.wallSelectionMode = false;
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

function handleFinishStairs() {
  appState.stairPlacementMode = false;
  uiController.toggleStairsInputSection(false);
  updateContextualPanel();
  
  // Keep the stair management section visible
  const stairSection = document.getElementById('stairManagementSection');
  const mainBtn = document.getElementById('mainStairsBtn');
  if (stairSection && mainBtn) {
    stairSection.classList.remove('hidden');
    mainBtn.classList.add('active');
  }
  
  // Recalculate BOM to include all stairs
  recalculateAndUpdateBOM();
  
  uiController.updateCanvasStatus(`Finished adding stairs. Total: ${appState.stairs.length} sets. You can now drag stairs to reposition them.`);
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
  
  // Handle Escape key for stair placement mode
  if (event.key === "Escape" && appState.stairPlacementMode) {
    event.preventDefault();
    handleCancelStairs();
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
      updateStairList(); // Update the stair management UI
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
  
  // Delete button clicks are now handled through the UI panel, not canvas clicks
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
          saveHistoryState('Select wall');
          uiController.updateCanvasStatus(
            `${appState.selectedWallIndices.length} wall(s) selected for ledger attachment.`
          );
        } else {
          uiController.updateCanvasStatus(`Error: ${validation.error}`);
        }
      } else {
        // Wall already selected - remove it
        appState.selectedWallIndices.splice(currentIndex, 1);
        saveHistoryState('Deselect wall');
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

        saveHistoryState('Close shape');
        updateContextualPanel();
      } else {
        // Simply add the point - we'll let keyboard input activate dimension entry if needed
        appState.points.push(snappedModelPos);
        appState.isDrawing = true;
        saveHistoryState('Add point');
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
        saveHistoryState('Add point');
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
      saveHistoryState('Add stairs');
      // Keep the stair configuration panel visible so user can add more or finish
      // Don't exit placement mode yet - let user click "Add More" or "Finish"

      // Keep the stair management section visible
      const stairSection = document.getElementById('stairManagementSection');
      const mainBtn = document.getElementById('mainStairsBtn');
      if (stairSection && mainBtn) {
        stairSection.classList.remove('hidden');
        mainBtn.classList.add('active');
      }

      uiController.updateCanvasStatus(
        `Stairs added. Total: ${appState.stairs.length}. Click another edge to add more stairs or "Finish Adding" when done.`
      );
      updateStairList(); // Update the stair management UI
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

  // Update hovered stair index when not dragging
  if (!appState.isDraggingStairs && !appState.stairPlacementMode && appState.isShapeClosed) {
    let newHoveredIndex = -1;
    
    if (appState.stairs.length > 0) {
      newHoveredIndex = canvasLogic.findHoveredStairIndex(
        modelMouse.x,
        modelMouse.y,
        appState.stairs,
        appState.deckDimensions,
        appState.viewportScale
      );
    }
    
    if (newHoveredIndex !== appState.hoveredStairIndex) {
      appState.hoveredStairIndex = newHoveredIndex;
      
      // Set cursor to pointer when hovering over stairs for selection
      if (deckCanvas) {
        deckCanvas.style.cursor = newHoveredIndex >= 0 ? "pointer" : "default";
      }
      
      redrawApp();
      return; // Redraw triggered
    }
  }

  if (
    appState.isDrawing ||
    appState.wallSelectionMode ||
    appState.isDraggingStairs ||
    appState.stairPlacementMode ||
    appState.selectedStairIndex !== -1 ||
    appState.hoveredStairIndex !== -1
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
  
  // Move BOM outside of main-content-panel for proper print layout
  const bomSection = document.getElementById('bomSection');
  const structureContent = document.getElementById('structure-content');
  
  if (bomSection && structureContent) {
    // Store original parent for restoration
    appState.bomOriginalParent = bomSection.parentNode;
    
    // Move BOM to be a direct child of structure-content (after main-layout-container)
    structureContent.appendChild(bomSection);
  }
  
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
  
  // Restore BOM to its original location
  const bomSection = document.getElementById('bomSection');
  if (bomSection && appState.bomOriginalParent) {
    appState.bomOriginalParent.appendChild(bomSection);
    delete appState.bomOriginalParent;
  }
  
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

// --- Form Reset Function ---
function resetAllFormInputs() {
  // Get form elements
  const deckHeightFeetInput = document.getElementById("deckHeightFeet");
  const deckHeightInchesInput = document.getElementById("deckHeightInches");
  const footingTypeSelect = document.getElementById("footingType");
  const joistSpacing = document.getElementById("joistSpacing");
  const attachmentType = document.getElementById("attachmentType");
  const beamType = document.getElementById("beamType");
  const pictureFrame = document.getElementById("pictureFrame");
  const joistProtection = document.getElementById("joistProtection");
  const fasteners = document.getElementById("fasteners");
  const stairWidthSelect = document.getElementById("stairWidth");
  const stringerTypeSelect = document.getElementById("stringerType");
  const landingTypeSelect = document.getElementById("landingType");
  
  // Reset main form inputs to their default values
  if (deckHeightFeetInput) deckHeightFeetInput.value = "4"; // Default to 4'
  if (deckHeightInchesInput) deckHeightInchesInput.value = "0"; // Default to 0"
  if (footingTypeSelect) footingTypeSelect.value = "gh_levellers"; // Default to first option
  if (joistSpacing) joistSpacing.value = "16"; // Default to 16" OC
  if (attachmentType) attachmentType.value = "house_rim"; // Default to House Rim
  if (beamType) beamType.value = "drop"; // Default to Drop Beam
  if (pictureFrame) pictureFrame.value = "none"; // Default to None
  if (joistProtection) joistProtection.value = "none"; // Default to None
  if (fasteners) fasteners.value = "screws_3in"; // Default to 3" Deck Screws
  
  // Reset stair form inputs
  if (stairWidthSelect) stairWidthSelect.value = "4"; // Default to 4' 0"
  if (stringerTypeSelect) stringerTypeSelect.value = "pylex_steel"; // Default to Pylex Steel
  if (landingTypeSelect) landingTypeSelect.value = "existing"; // Default to Existing Surface
  
  // Reset modify form inputs (these mirror the main form)
  const modifyHeightFeet = document.getElementById('modifyHeightFeet');
  const modifyHeightInches = document.getElementById('modifyHeightInches');
  const modifyFootingType = document.getElementById('modifyFootingType');
  const modifyJoistSpacing = document.getElementById('modifyJoistSpacing');
  const modifyAttachmentType = document.getElementById('modifyAttachmentType');
  const modifyBeamType = document.getElementById('modifyBeamType');
  const modifyPictureFrame = document.getElementById('modifyPictureFrame');
  const modifyJoistProtection = document.getElementById('modifyJoistProtection');
  const modifyFasteners = document.getElementById('modifyFasteners');
  
  if (modifyHeightFeet) modifyHeightFeet.value = "4";
  if (modifyHeightInches) modifyHeightInches.value = "0";
  if (modifyFootingType) modifyFootingType.value = "gh_levellers";
  if (modifyJoistSpacing) modifyJoistSpacing.value = "16";
  if (modifyAttachmentType) modifyAttachmentType.value = "house_rim";
  if (modifyBeamType) modifyBeamType.value = "drop";
  if (modifyPictureFrame) modifyPictureFrame.value = "none";
  if (modifyJoistProtection) modifyJoistProtection.value = "none";
  if (modifyFasteners) modifyFasteners.value = "screws_3in";
  
  // Reset any other UI state
  const stairSection = document.getElementById('stairManagementSection');
  const mainBtn = document.getElementById('mainStairsBtn');
  if (stairSection) stairSection.classList.add('hidden');
  if (mainBtn) mainBtn.classList.remove('active');
  
  // Hide spec editor if it's open
  const editor = document.querySelector('.spec-editor');
  const summarySection = document.getElementById('summarySection');
  const topActionButtons = document.querySelector('.top-action-buttons');
  const modifyBtn = document.querySelector('.modify-specs-btn');
  
  if (editor) editor.classList.add('hidden');
  if (summarySection) summarySection.classList.remove('hidden');
  if (topActionButtons) topActionButtons.classList.remove('hidden');
  if (modifyBtn) modifyBtn.classList.remove('active');
}

// --- Visual Selector System ---
function initializeVisualSelectors() {
  const selectors = document.querySelectorAll('.visual-selector');

  selectors.forEach(selector => {
    // Skip if already initialized
    if (selector.dataset.initialized === 'true') return;
    selector.dataset.initialized = 'true';

    const options = selector.querySelectorAll('.visual-option');
    const hiddenSelect = selector.querySelector('select.hidden-select');
    const selectorName = selector.dataset.selector;

    options.forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event bubbling

        // Remove selected from all options in this selector
        options.forEach(opt => opt.classList.remove('selected'));

        // Add selected to clicked option
        option.classList.add('selected');

        // Update hidden select value
        const value = option.dataset.value;
        if (hiddenSelect) {
          hiddenSelect.value = value;
          // Dispatch change event for any listeners
          hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }

        console.log(`[Visual Selector] ${selectorName}: ${value}`);
      });
    });

    // Sync initial state from hidden select
    if (hiddenSelect) {
      const currentValue = hiddenSelect.value;
      options.forEach(opt => {
        if (opt.dataset.value === currentValue) {
          opt.classList.add('selected');
        } else {
          opt.classList.remove('selected');
        }
      });
    }
  });

  console.log(`[Visual Selectors] Initialized ${selectors.length} visual selectors`);
}

// Update visual selector from code (e.g., when resetting form)
window.updateVisualSelector = function(selectorName, value) {
  const selector = document.querySelector(`.visual-selector[data-selector="${selectorName}"]`);
  if (!selector) return;

  const options = selector.querySelectorAll('.visual-option');
  const hiddenSelect = selector.querySelector('select.hidden-select');

  options.forEach(opt => {
    if (opt.dataset.value === value) {
      opt.classList.add('selected');
    } else {
      opt.classList.remove('selected');
    }
  });

  if (hiddenSelect) {
    hiddenSelect.value = value;
  }
};

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
  
  // Add event listener for finish stairs button
  const finishStairsBtn = document.getElementById("finishStairsBtn");
  if (finishStairsBtn) finishStairsBtn.addEventListener("click", handleFinishStairs);
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

  // Initialize visual selectors
  initializeVisualSelectors();

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
  const topActionButtons = document.querySelector('.top-action-buttons');
  const button = document.querySelector('.modify-specs-btn');
  
  if (editor && summarySection && button) {
    const isHidden = editor.classList.contains('hidden');
    
    if (isHidden) {
      // Show the editor, hide the summary
      editor.classList.remove('hidden');
      summarySection.classList.add('hidden');
      // Hide top action buttons (stairs and modify) while editing
      if (topActionButtons) {
        topActionButtons.classList.add('hidden');
      }
      button.classList.add('active');
      
      // Sync current values to modify form
      syncModifySpecValues();
    } else {
      // Hide the editor, show the summary
      editor.classList.add('hidden');
      summarySection.classList.remove('hidden');
      // Show top action buttons again
      if (topActionButtons) {
        topActionButtons.classList.remove('hidden');
      }
      button.classList.remove('active');
    }
  }
};

window.regeneratePlan = function() {
  console.log("Regenerating plan with modified values");
  
  // Copy values from modify form back to main form
  syncMainSpecValues();
  
  // Close the spec editor
  window.toggleSpecEditor();
  
  // Add a small delay to ensure DOM updates are processed
  setTimeout(() => {
    // Regenerate the plan
    handleGeneratePlan();
  }, 10);
};

window.handleMainStairsButton = function() {
  const stairSection = document.getElementById('stairManagementSection');
  const mainBtn = document.getElementById('mainStairsBtn');
  
  if (stairSection && mainBtn) {
    const isHidden = stairSection.classList.contains('hidden');
    
    if (isHidden) {
      // Show the stair management section first
      stairSection.classList.remove('hidden');
      mainBtn.classList.add('active');
      updateStairList();
      
      // Then immediately enter stair adding mode
      handleAddStairs();
    } else {
      // Hide the stair management section
      stairSection.classList.add('hidden');
      mainBtn.classList.remove('active');
      
      // Also deselect any selected stairs
      appState.selectedStairIndex = -1;
      redrawApp();
    }
  }
};

window.toggleStairsManagement = function() {
  const stairSection = document.getElementById('stairManagementSection');
  const mainBtn = document.getElementById('mainStairsBtn');
  
  if (stairSection && mainBtn) {
    const isHidden = stairSection.classList.contains('hidden');
    
    if (isHidden) {
      // Show the stair management section
      stairSection.classList.remove('hidden');
      mainBtn.classList.add('active');
      
      // Update the stair list display
      updateStairList();
    } else {
      // Hide the stair management section
      stairSection.classList.add('hidden');
      mainBtn.classList.remove('active');
      
      // Also deselect any selected stairs
      appState.selectedStairIndex = -1;
      redrawApp();
    }
  }
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
  
  // Add post size sync
  const postSize = document.getElementById('postSize');
  const modifyPostSize = document.getElementById('modifyPostSize');
  if (postSize && modifyPostSize) modifyPostSize.value = postSize.value;
}

function syncMainSpecValues() {
  console.log("Syncing modify form values to main form");
  
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
    console.log(`Syncing height feet: ${modifyHeightFeet.value} -> ${heightFeet.id}`);
    heightFeet.value = modifyHeightFeet.value;
  }
  
  if (modifyHeightInches && heightInches) {
    console.log(`Syncing height inches: ${modifyHeightInches.value} -> ${heightInches.id}`);
    heightInches.value = modifyHeightInches.value;
  }
  
  if (modifyFootingType && footingType) {
    console.log(`Syncing footing type: ${modifyFootingType.value} -> ${footingType.id}`);
    footingType.value = modifyFootingType.value;
  }
  
  if (modifyJoistSpacing && joistSpacing) {
    console.log(`Syncing joist spacing: ${modifyJoistSpacing.value} -> ${joistSpacing.id}`);
    joistSpacing.value = modifyJoistSpacing.value;
  }
  
  if (modifyAttachmentType && attachmentType) {
    console.log(`Syncing attachment type: ${modifyAttachmentType.value} -> ${attachmentType.id}`);
    attachmentType.value = modifyAttachmentType.value;
  }
  
  if (modifyBeamType && beamType) {
    console.log(`Syncing beam type: ${modifyBeamType.value} -> ${beamType.id}`);
    beamType.value = modifyBeamType.value;
  }
  
  if (modifyPictureFrame && pictureFrame) {
    console.log(`Syncing picture frame: ${modifyPictureFrame.value} -> ${pictureFrame.id}`);
    pictureFrame.value = modifyPictureFrame.value;
  }
  
  if (modifyJoistProtection && joistProtection) {
    console.log(`Syncing joist protection: ${modifyJoistProtection.value} -> ${joistProtection.id}`);
    joistProtection.value = modifyJoistProtection.value;
  }
  
  if (modifyFasteners && fasteners) {
    console.log(`Syncing fasteners: ${modifyFasteners.value} -> ${fasteners.id}`);
    fasteners.value = modifyFasteners.value;
  }
  
  // Add post size sync
  const modifyPostSize = document.getElementById('modifyPostSize');
  const postSize = document.getElementById('postSize');
  if (modifyPostSize && postSize) {
    console.log(`Syncing post size: ${modifyPostSize.value} -> ${postSize.id}`);
    postSize.value = modifyPostSize.value;
  }
  
  console.log("Sync complete");
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

// --- Stair Management Functions ---

function updateStairList() {
  const stairList = document.getElementById('stairList');
  const stairCount = document.getElementById('stairCount');
  
  if (!stairList || !stairCount) return;
  
  // Update stair count
  const count = appState.stairs.length;
  stairCount.textContent = count === 1 ? '1 set' : `${count} sets`;
  
  // Don't automatically show/hide the section - let the toggle button control visibility
  
  // Clear existing stairs
  stairList.innerHTML = '';
  
  // Add each stair to the list
  appState.stairs.forEach((stair, index) => {
    const stairItem = createStairListItem(stair, index);
    stairList.appendChild(stairItem);
  });
  
}

function createStairListItem(stair, index) {
  const item = document.createElement('div');
  item.className = `stair-item ${appState.selectedStairIndex === index ? 'selected' : ''}`;
  item.dataset.stairIndex = index;
  
  // Format stair information
  const widthText = `${stair.widthFt || 4}' wide`;
  const stepInfo = stair.calculatedNumSteps ? `${stair.calculatedNumSteps} steps` : 'Steps: TBD';
  const stringerInfo = stair.calculatedStringerQty ? `${stair.calculatedStringerQty} stringers` : 'Stringers: TBD';
  
  item.innerHTML = `
    <div class="stair-item-header">
      <div class="stair-item-title">Stairs ${index + 1}</div>
      <div class="stair-item-actions">
        <button class="btn btn-secondary btn-icon stair-action-btn" 
                data-action="edit" data-stair-index="${index}"
                title="Edit stair properties">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button class="btn btn-danger btn-icon stair-action-btn" 
                data-action="delete" data-stair-index="${index}"
                title="Delete this stair set">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
    <div class="stair-item-info">
      ${widthText} • ${stepInfo} • ${stringerInfo}
    </div>
  `;
  
  // Add click listener for selection
  item.addEventListener('click', (e) => {
    // Don't select if clicking on action buttons
    if (e.target.closest('.stair-action-btn')) return;
    
    selectStair(index);
  });
  
  // Add action button listeners
  const editBtn = item.querySelector('[data-action="edit"]');
  const deleteBtn = item.querySelector('[data-action="delete"]');
  
  editBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    editStair(index);
  });
  
  deleteBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteStair(index);
  });
  
  return item;
}

function selectStair(index) {
  // Select the stair in app state
  appState.selectedStairIndex = appState.selectedStairIndex === index ? -1 : index;
  
  // Update the stair list display
  updateStairList();
  
  // Redraw canvas to show selection
  redrawApp();
}


function editStair(index) {
  if (index < 0 || index >= appState.stairs.length) return;
  
  // For now, we'll implement a simple prompt-based editor
  // In a more advanced implementation, you could create a modal or inline editor
  const stair = appState.stairs[index];
  
  const newWidth = prompt(`Edit stair width (current: ${stair.widthFt}'):`, stair.widthFt);
  if (newWidth && !isNaN(newWidth) && newWidth > 0) {
    stair.widthFt = parseFloat(newWidth);
    
    // Recalculate stair details
    const inputs = uiController.getFormInputs();
    const deckHeight = inputs.deckHeight;
    if (typeof deckHeight === "number" && deckHeight > 0) {
      stairCalculations.calculateStairDetails(stair, deckHeight);
    }
    
    // Update UI and recalculate BOM
    updateStairList();
    recalculateAndUpdateBOM();
    redrawApp();
    
    uiController.updateCanvasStatus(`Stair ${index + 1} updated to ${newWidth}' wide.`);
  }
}

function deleteStair(index) {
  if (index < 0 || index >= appState.stairs.length) return;

  if (confirm(`Delete Stairs ${index + 1}?`)) {
    appState.stairs.splice(index, 1);
    saveHistoryState('Delete stairs');

    // Adjust selected index if necessary
    if (appState.selectedStairIndex === index) {
      appState.selectedStairIndex = -1;
    } else if (appState.selectedStairIndex > index) {
      appState.selectedStairIndex--;
    }

    // Update UI
    updateStairList();
    recalculateAndUpdateBOM();
    redrawApp();

    uiController.updateCanvasStatus(`Stair set deleted. Remaining: ${appState.stairs.length}.`);
  }
}

// ================================================
// TEMPLATE GALLERY SYSTEM
// ================================================

// Template definitions - points in feet, counter-clockwise orientation
// Origin (0,0) is top-left, X increases right, Y increases down
const DECK_TEMPLATES = {
  'rectangle-12x16': {
    name: 'Rectangle 12x16',
    description: '12\' x 16\' basic rectangle',
    // Points define a 12ft deep x 16ft wide rectangle
    points: [
      { x: 0, y: 0 },      // Top-left
      { x: 0, y: 12 },     // Bottom-left
      { x: 16, y: 12 },    // Bottom-right
      { x: 16, y: 0 },     // Top-right
    ]
  },
  'rectangle-16x20': {
    name: 'Large Rectangle 16x20',
    description: '16\' x 20\' large rectangle',
    points: [
      { x: 0, y: 0 },
      { x: 0, y: 16 },
      { x: 20, y: 16 },
      { x: 20, y: 0 },
    ]
  },
  'l-shape-left': {
    name: 'L-Shape Left',
    description: 'L-shaped deck with extension on left',
    // 20ft wide main section, 12ft deep
    // 8ft extension on left side, 8ft additional depth
    points: [
      { x: 0, y: 0 },      // Top-left
      { x: 0, y: 20 },     // Bottom of left extension
      { x: 8, y: 20 },     // Inner corner bottom
      { x: 8, y: 12 },     // Inner corner
      { x: 20, y: 12 },    // Bottom-right
      { x: 20, y: 0 },     // Top-right
    ]
  },
  'l-shape-right': {
    name: 'L-Shape Right',
    description: 'L-shaped deck with extension on right',
    points: [
      { x: 0, y: 0 },      // Top-left
      { x: 0, y: 12 },     // Bottom-left
      { x: 12, y: 12 },    // Inner corner
      { x: 12, y: 20 },    // Inner corner bottom
      { x: 20, y: 20 },    // Bottom of right extension
      { x: 20, y: 0 },     // Top-right
    ]
  },
  'u-shape': {
    name: 'U-Shape Wrap',
    description: 'U-shaped wraparound deck',
    // Main: 24ft wide, wraps around 8ft deep on sides, 6ft corridor in middle
    points: [
      { x: 0, y: 0 },      // Top-left
      { x: 0, y: 16 },     // Bottom-left
      { x: 24, y: 16 },    // Bottom-right
      { x: 24, y: 0 },     // Top-right outer
      { x: 18, y: 0 },     // Top-right inner
      { x: 18, y: 10 },    // Inner corner right
      { x: 6, y: 10 },     // Inner corner left
      { x: 6, y: 0 },      // Top-left inner
    ]
  },
  'notched': {
    name: 'Notched Corner',
    description: 'Rectangle with corner notch',
    // 16x14 rectangle with 6x6 notch in top-right
    points: [
      { x: 0, y: 0 },      // Top-left
      { x: 0, y: 14 },     // Bottom-left
      { x: 16, y: 14 },    // Bottom-right
      { x: 16, y: 6 },     // Notch bottom
      { x: 10, y: 6 },     // Notch corner
      { x: 10, y: 0 },     // Notch top
    ]
  },
  'diagonal-corners': {
    name: 'Diagonal Corners',
    description: 'Rectangle with 45° clipped corners',
    // 18x11 rectangle with 4x4 diagonal clips at top corners
    // For 45°, dx must equal dy
    points: [
      { x: 0, y: 11 },     // Bottom-left
      { x: 18, y: 11 },    // Bottom-right
      { x: 18, y: 4 },     // Right side (before diagonal)
      { x: 14, y: 0 },     // Top-right (after diagonal) - true 45° line (dx=4, dy=4)
      { x: 4, y: 0 },      // Top-left (after diagonal)
      { x: 0, y: 4 },      // Left side (before diagonal) - true 45° line (dx=4, dy=4)
    ]
  }
};

// Load a template shape onto the canvas
window.loadTemplate = function(templateId) {
  const template = DECK_TEMPLATES[templateId];
  if (!template) {
    console.error(`Template '${templateId}' not found`);
    return;
  }

  // Clear history for fresh start with template
  clearHistory();

  // Clear current state but don't show drawing panel yet
  appState.points = [];
  appState.isDrawing = false;
  appState.isShapeClosed = false;
  appState.wallSelectionMode = false;
  appState.selectedWallIndices = [];
  appState.stairPlacementMode = false;
  appState.selectedStairIndex = -1;
  appState.deckDimensions = null;
  appState.structuralComponents = null;
  appState.stairs = [];
  appState.bom = [];
  appState.rectangularSections = [];
  appState.showDecompositionShading = false;
  appState.isDimensionInputActive = false;
  appState.pendingDimensionStartPoint = null;
  appState.isBlueprintMode = false;

  // Convert template points from feet to model coordinates (pixels)
  // Add offset so shape is nicely positioned on canvas
  const offsetX = 5; // 5 feet from left edge
  const offsetY = 5; // 5 feet from top edge

  template.points.forEach(pt => {
    appState.points.push({
      x: (pt.x + offsetX) * config.PIXELS_PER_FOOT,
      y: (pt.y + offsetY) * config.PIXELS_PER_FOOT
    });
  });

  // Close the shape by adding first point at end
  if (appState.points.length > 0) {
    appState.points.push({ ...appState.points[0] });
  }

  appState.isShapeClosed = true;
  appState.isDrawing = false;

  // Center and fit the shape in viewport
  centerAndFitShape();

  // Reset UI
  uiController.resetUIOutputs();
  uiController.toggleStairsInputSection(false);

  // Switch to wall selection mode
  appState.currentPanelMode = 'wall-selection';
  showContextualPanel('wall-selection');

  // Update status
  uiController.updateCanvasStatus(
    `Template "${template.name}" loaded. Click wall edge(s) to mark as ledger attachment, then Generate Plan.`
  );

  // Save initial state for undo
  saveHistoryState('Load template');

  redrawApp();

  console.log(`Template '${templateId}' loaded with ${template.points.length} points`);
};

// Center and fit the current shape in the viewport
function centerAndFitShape() {
  if (appState.points.length < 2) return;

  // Find bounds of the shape
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  appState.points.forEach(pt => {
    minX = Math.min(minX, pt.x);
    maxX = Math.max(maxX, pt.x);
    minY = Math.min(minY, pt.y);
    maxY = Math.max(maxY, pt.y);
  });

  const shapeWidth = maxX - minX;
  const shapeHeight = maxY - minY;
  const shapeCenterX = minX + shapeWidth / 2;
  const shapeCenterY = minY + shapeHeight / 2;

  // Get canvas dimensions
  const canvasWidth = deckCanvas.width;
  const canvasHeight = deckCanvas.height;

  // Calculate scale to fit shape with padding
  const padding = 60; // pixels of padding around shape
  const scaleX = (canvasWidth - padding * 2) / shapeWidth;
  const scaleY = (canvasHeight - padding * 2) / shapeHeight;
  const newScale = Math.min(scaleX, scaleY, 2.0); // Cap at 2x zoom

  // Update viewport
  appState.viewportScale = newScale;
  appState.viewportOffsetX = canvasWidth / 2 - shapeCenterX * newScale;
  appState.viewportOffsetY = canvasHeight / 2 - shapeCenterY * newScale;
}

// Toggle template gallery visibility
window.toggleTemplateGallery = function() {
  const gallery = document.querySelector('.template-gallery');
  if (gallery) {
    gallery.classList.toggle('collapsed');
  }
};

// Toggle layer visibility
window.toggleLayerVisibility = function(layerName) {
  if (appState.layerVisibility.hasOwnProperty(layerName)) {
    appState.layerVisibility[layerName] = !appState.layerVisibility[layerName];

    // Update checkbox visual state
    const checkbox = document.getElementById(`layer-${layerName}`);
    if (checkbox) {
      checkbox.checked = appState.layerVisibility[layerName];
    }

    // Redraw canvas to reflect visibility change
    canvasLogic.redrawCanvas(appState);

    console.log(`Layer '${layerName}' visibility: ${appState.layerVisibility[layerName]}`);
  }
};

// Toggle all layers on/off
window.toggleAllLayers = function(visible) {
  Object.keys(appState.layerVisibility).forEach(layer => {
    appState.layerVisibility[layer] = visible;
    const checkbox = document.getElementById(`layer-${layer}`);
    if (checkbox) {
      checkbox.checked = visible;
    }
  });
  canvasLogic.redrawCanvas(appState);
};

// ============================================
// UNDO/REDO SYSTEM
// ============================================

// Save current state to history
window.saveHistoryState = function(actionName = 'action') {
  // Don't save during undo/redo operations
  if (appState.isUndoRedoAction) return;

  // Create a snapshot of the relevant state
  const snapshot = {
    points: JSON.parse(JSON.stringify(appState.points)),
    isShapeClosed: appState.isShapeClosed,
    selectedWallIndices: [...appState.selectedWallIndices],
    stairs: JSON.parse(JSON.stringify(appState.stairs)),
    currentPanelMode: appState.currentPanelMode,
    actionName: actionName,
    timestamp: Date.now()
  };

  // If we're not at the end of history, remove future states
  if (appState.historyIndex < appState.history.length - 1) {
    appState.history = appState.history.slice(0, appState.historyIndex + 1);
  }

  // Add new state
  appState.history.push(snapshot);

  // Limit history size
  if (appState.history.length > appState.maxHistorySize) {
    appState.history.shift();
  } else {
    appState.historyIndex++;
  }

  // Update UI buttons
  updateUndoRedoButtons();

  console.log(`[History] Saved: "${actionName}" (${appState.historyIndex + 1}/${appState.history.length})`);
};

// Undo last action
window.undo = function() {
  if (appState.historyIndex <= 0) {
    console.log('[History] Nothing to undo');
    return false;
  }

  appState.isUndoRedoAction = true;

  // Move back in history
  appState.historyIndex--;
  const snapshot = appState.history[appState.historyIndex];

  // Restore state
  restoreFromSnapshot(snapshot);

  appState.isUndoRedoAction = false;
  updateUndoRedoButtons();

  console.log(`[History] Undo to: "${snapshot.actionName}" (${appState.historyIndex + 1}/${appState.history.length})`);
  return true;
};

// Redo last undone action
window.redo = function() {
  if (appState.historyIndex >= appState.history.length - 1) {
    console.log('[History] Nothing to redo');
    return false;
  }

  appState.isUndoRedoAction = true;

  // Move forward in history
  appState.historyIndex++;
  const snapshot = appState.history[appState.historyIndex];

  // Restore state
  restoreFromSnapshot(snapshot);

  appState.isUndoRedoAction = false;
  updateUndoRedoButtons();

  console.log(`[History] Redo to: "${snapshot.actionName}" (${appState.historyIndex + 1}/${appState.history.length})`);
  return true;
};

// Restore state from a snapshot
function restoreFromSnapshot(snapshot) {
  appState.points = JSON.parse(JSON.stringify(snapshot.points));
  appState.isShapeClosed = snapshot.isShapeClosed;
  appState.selectedWallIndices = [...snapshot.selectedWallIndices];
  appState.stairs = JSON.parse(JSON.stringify(snapshot.stairs));

  // Set drawing state based on shape state
  appState.isDrawing = !snapshot.isShapeClosed && snapshot.points.length > 0;

  // Update wall selection mode
  appState.wallSelectionMode = snapshot.isShapeClosed && snapshot.selectedWallIndices.length === 0;

  // Reset structural components - will be recalculated when Generate Plan is clicked
  appState.structuralComponents = null;
  appState.bom = [];

  // Recalculate deck dimensions if shape is closed
  if (appState.isShapeClosed && appState.points.length >= 3) {
    calculateAndUpdateDeckDimensions();
  } else {
    appState.deckDimensions = null;
  }

  // Update panel mode and UI
  if (snapshot.currentPanelMode) {
    showContextualPanel(snapshot.currentPanelMode);
  }

  // Update stair list UI
  updateStairList();

  // Reset UI outputs since structural components need to be regenerated
  uiController.resetUIOutputs();

  // Redraw canvas
  canvasLogic.redrawCanvas(appState);
}

// Update undo/redo button states
function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');

  if (undoBtn) {
    undoBtn.disabled = appState.historyIndex <= 0;
    undoBtn.classList.toggle('btn-disabled', appState.historyIndex <= 0);
  }

  if (redoBtn) {
    redoBtn.disabled = appState.historyIndex >= appState.history.length - 1;
    redoBtn.classList.toggle('btn-disabled', appState.historyIndex >= appState.history.length - 1);
  }
}

// Clear history (called when clearing canvas)
window.clearHistory = function() {
  appState.history = [];
  appState.historyIndex = -1;
  updateUndoRedoButtons();
  console.log('[History] Cleared');
};

// Keyboard shortcuts for undo/redo
document.addEventListener('keydown', function(e) {
  // Ctrl+Z or Cmd+Z for undo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    undo();
  }
  // Ctrl+Y or Cmd+Shift+Z for redo
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault();
    redo();
  }
  // Escape to close modals
  if (e.key === 'Escape') {
    const specsModal = document.getElementById('specsModal');
    if (specsModal && !specsModal.classList.contains('hidden')) {
      closeSpecsModal();
      return;
    }
    const cutListModal = document.getElementById('cutListModal');
    if (cutListModal && !cutListModal.classList.contains('hidden')) {
      closeCutListModal();
      return;
    }
  }
});

// ================================================
// SPECIFICATIONS MODAL FUNCTIONS
// ================================================

// Open specifications modal
window.openSpecsModal = function() {
  const modal = document.getElementById('specsModal');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scroll
    console.log('[Modal] Specifications modal opened');
  }
};

// Close specifications modal
window.closeSpecsModal = function() {
  const modal = document.getElementById('specsModal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = ''; // Restore scroll
    console.log('[Modal] Specifications modal closed');
  }
};

// ================================================
// CUT LIST MODAL FUNCTIONS
// ================================================

// Cut list mode state
let cutListModeEnabled = false;
let cutListData = [];

// Toggle cut list mode (shows labels on canvas)
window.toggleCutListMode = function() {
  cutListModeEnabled = !cutListModeEnabled;
  const btn = document.getElementById('cutListModeBtn');

  if (btn) {
    btn.classList.toggle('active', cutListModeEnabled);
  }

  if (cutListModeEnabled) {
    // Generate cut list data and open modal
    generateCutListData();
    openCutListModal();

    // Trigger canvas redraw with labels
    if (typeof redrawCanvas === 'function') {
      redrawCanvas();
    }
    console.log('[Cut List] Mode enabled');
  } else {
    // Redraw canvas without labels
    if (typeof redrawCanvas === 'function') {
      redrawCanvas();
    }
    console.log('[Cut List] Mode disabled');
  }
};

// Check if cut list mode is enabled (for canvas rendering)
window.isCutListModeEnabled = function() {
  return cutListModeEnabled;
};

// Get cut list data (for canvas rendering)
window.getCutListData = function() {
  return cutListData;
};

// Open cut list modal
window.openCutListModal = function() {
  const modal = document.getElementById('cutListModal');
  if (modal) {
    generateCutListData(); // Refresh data
    populateCutListModal();
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    console.log('[Modal] Cut list modal opened');
  }
};

// Close cut list modal
window.closeCutListModal = function() {
  const modal = document.getElementById('cutListModal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    console.log('[Modal] Cut list modal closed');
  }

  // Disable cut list mode when closing
  if (cutListModeEnabled) {
    cutListModeEnabled = false;
    const btn = document.getElementById('cutListModeBtn');
    if (btn) btn.classList.remove('active');
    if (typeof redrawCanvas === 'function') {
      redrawCanvas();
    }
  }
};

// Format feet and inches nicely
function formatLength(lengthFeet) {
  if (lengthFeet === undefined || lengthFeet === null) return '--';
  const feet = Math.floor(lengthFeet);
  const inches = Math.round((lengthFeet - feet) * 12);
  if (inches === 0) {
    return `${feet}' 0"`;
  } else if (inches === 12) {
    return `${feet + 1}' 0"`;
  }
  return `${feet}' ${inches}"`;
}

// Generate cut list data from structural components
window.generateCutListData = function() {
  cutListData = [];

  // Get current structural components
  const structure = appState.structuralComponents;
  if (!structure || structure.error) {
    console.log('[Cut List] No valid structure available');
    return;
  }

  let labelCounters = {
    J: 0,   // Joists
    PF: 0,  // Picture Frame Joists
    EJ: 0,  // End Joists
    OR: 0,  // Outer Rim
    WR: 0,  // Wall Rim
    B: 0,   // Beams
    L: 0,   // Ledger
    BL: 0,  // Blocking
    P: 0,   // Posts
  };

  // Helper to add items
  const addItem = (component, type, prefix, labelClass) => {
    labelCounters[prefix]++;
    const label = `${prefix}${labelCounters[prefix]}`;

    cutListData.push({
      label: label,
      type: type,
      size: component.size || '--',
      lengthFeet: component.lengthFeet,
      lengthFormatted: formatLength(component.lengthFeet),
      labelClass: labelClass,
      component: component, // Reference for canvas labeling
    });

    return label;
  };

  // Add ledger if present
  if (structure.ledger) {
    addItem(structure.ledger, 'Ledger', 'L', 'label-ledger');
  }

  // Add beams
  if (structure.beams && structure.beams.length > 0) {
    structure.beams.forEach(beam => {
      const beamType = beam.usage || 'Beam';
      addItem(beam, beamType, 'B', 'label-beam');
    });
  }

  // Add rim joists (End Joists, Outer Rim, Wall Rim)
  if (structure.rimJoists && structure.rimJoists.length > 0) {
    structure.rimJoists.forEach(rim => {
      if (rim.usage === 'End Joist') {
        addItem(rim, 'End Joist', 'EJ', 'label-rim');
      } else if (rim.usage === 'Outer Rim Joist') {
        addItem(rim, 'Outer Rim Joist', 'OR', 'label-rim');
      } else if (rim.usage === 'Wall Rim Joist') {
        addItem(rim, 'Wall Rim Joist', 'WR', 'label-rim');
      } else {
        addItem(rim, rim.usage || 'Rim Joist', 'EJ', 'label-rim');
      }
    });
  }

  // Add joists (regular and picture frame)
  if (structure.joists && structure.joists.length > 0) {
    structure.joists.forEach(joist => {
      if (joist.usage === 'Picture Frame Joist') {
        addItem(joist, 'Picture Frame Joist', 'PF', 'label-joist');
      } else {
        addItem(joist, 'Joist', 'J', 'label-joist');
      }
    });
  }

  // Add blocking (mid-span and picture frame)
  if (structure.midSpanBlocking && structure.midSpanBlocking.length > 0) {
    structure.midSpanBlocking.forEach(block => {
      addItem(block, block.usage || 'Mid-Span Blocking', 'BL', 'label-blocking');
    });
  }

  if (structure.pictureFrameBlocking && structure.pictureFrameBlocking.length > 0) {
    structure.pictureFrameBlocking.forEach(block => {
      addItem(block, block.usage || 'PF Blocking', 'BL', 'label-blocking');
    });
  }

  console.log(`[Cut List] Generated ${cutListData.length} items`);
  return cutListData;
};

// Populate the cut list modal with data
function populateCutListModal() {
  const tableBody = document.getElementById('cutListTableBody');
  const groupedContent = document.getElementById('cutListGroupedContent');
  const totalPieces = document.getElementById('cutListTotalPieces');
  const totalLF = document.getElementById('cutListTotalLF');
  const uniqueTypes = document.getElementById('cutListUniqueTypes');

  if (!tableBody) return;

  // Clear existing content
  tableBody.innerHTML = '';

  if (cutListData.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-8">No cut list data available. Generate a deck plan first.</td></tr>';
    if (totalPieces) totalPieces.textContent = '0';
    if (totalLF) totalLF.textContent = '0';
    if (uniqueTypes) uniqueTypes.textContent = '0';
    if (groupedContent) groupedContent.innerHTML = '';
    return;
  }

  // Build table rows
  let totalLinearFeet = 0;
  const sizeGroups = {};

  cutListData.forEach(item => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><span class="cut-list-label ${item.labelClass}">${item.label}</span></td>
      <td>
        <span class="cut-list-type">${item.type}</span>
      </td>
      <td>${item.size}</td>
      <td>${item.lengthFormatted}</td>
      <td class="qty-col">1</td>
    `;
    tableBody.appendChild(row);

    totalLinearFeet += item.lengthFeet || 0;

    // Group by size
    const sizeKey = item.size;
    if (!sizeGroups[sizeKey]) {
      sizeGroups[sizeKey] = { count: 0, totalLF: 0 };
    }
    sizeGroups[sizeKey].count++;
    sizeGroups[sizeKey].totalLF += item.lengthFeet || 0;
  });

  // Update summary stats
  if (totalPieces) totalPieces.textContent = cutListData.length;
  if (totalLF) totalLF.textContent = Math.round(totalLinearFeet);
  if (uniqueTypes) uniqueTypes.textContent = Object.keys(sizeGroups).length;

  // Build grouped summary
  if (groupedContent) {
    let groupedHtml = '<div class="cut-list-grouped-items">';
    Object.entries(sizeGroups).sort().forEach(([size, data]) => {
      groupedHtml += `
        <div class="cut-list-grouped-item">
          <span class="size-name">${size}</span>
          <span class="size-count"><strong>${data.count}</strong> pcs / ${Math.round(data.totalLF)} LF</span>
        </div>
      `;
    });
    groupedHtml += '</div>';
    groupedContent.innerHTML = groupedHtml;
  }
}

// Print cut list
window.printCutList = function() {
  window.print();
};

// ==========================================
// Help Wizard System
// ==========================================

let wizardCurrentStep = 0;
let wizardSteps = [];

// Define the wizard steps with target elements and content
const wizardStepDefinitions = [
  {
    target: null, // Welcome step - centered
    title: "Welcome to TUDS Pro Deck Estimator!",
    description: "This interactive tool helps you design and estimate materials for your deck project. Let's take a quick tour of the main features.",
    isWelcome: true
  },
  {
    target: '#templateGalleryBtn',
    title: "Quick Start Templates",
    description: "Choose from pre-built deck shapes like Rectangle, L-Shape, or Wrap-Around to quickly start your design. Perfect for common deck layouts.",
    position: 'bottom'
  },
  {
    target: '#deckCanvas',
    title: "Drawing Canvas",
    description: "This is where your deck takes shape. Click to place points and create your deck outline. The grid helps you align dimensions precisely.",
    position: 'top'
  },
  {
    target: '#generatePlanBtn',
    title: "Generate Plan",
    description: "Once you've drawn your deck shape, click this button to generate the complete framing plan with joists, beams, and structural details.",
    position: 'left'
  },
  {
    target: '#floatingLegend',
    title: "Layer Controls",
    description: "Show or hide different parts of your plan. Toggle visibility for outline, dimensions, ledger, joists, beams, blocking, and posts.",
    position: 'left'
  },
  {
    target: '#framingSpecsCard',
    title: "Framing Specifications",
    description: "Configure your joist size, spacing, beam specifications, and post options. These settings determine your structural requirements.",
    position: 'right'
  },
  {
    target: '#blueprintToggleBtn',
    title: "Blueprint View",
    description: "Switch to a professional blueprint-style view for a cleaner look. Great for sharing plans with contractors or for permit applications.",
    position: 'left'
  },
  {
    target: '#cutListModeBtn',
    title: "Cut List",
    description: "Generate a detailed cut list showing every piece of lumber needed with labels. Essential for accurate material purchasing and construction.",
    position: 'left'
  },
  {
    target: '#bom-results',
    title: "Bill of Materials",
    description: "View your complete materials list with quantities and costs. The BOM updates automatically as you modify your deck design.",
    position: 'left'
  },
  {
    target: '#helpWizardBtn',
    title: "Need Help Again?",
    description: "You can always restart this tutorial by clicking the Help button. Happy building!",
    position: 'bottom',
    isFinal: true
  }
];

// Check if user is first-time visitor
function checkFirstTimeUser() {
  const hasSeenWizard = localStorage.getItem('tuds-deck-wizard-seen');
  if (!hasSeenWizard) {
    // Show wizard after a short delay to let the page load
    setTimeout(() => {
      startHelpWizard();
    }, 1000);
  }
}

// Start the help wizard
window.startHelpWizard = function() {
  console.log('[Help Wizard] Starting wizard');

  wizardCurrentStep = 0;
  wizardSteps = wizardStepDefinitions.filter(step => {
    if (!step.target) return true; // Welcome step
    const el = document.querySelector(step.target);
    return el && el.offsetParent !== null; // Element exists and is visible
  });

  if (wizardSteps.length === 0) {
    console.warn('[Help Wizard] No valid steps found');
    return;
  }

  // Create progress dots
  createProgressDots();

  // Show overlay
  const overlay = document.getElementById('helpWizardOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
  }

  // Display first step
  displayWizardStep(0);

  // Add keyboard navigation
  document.addEventListener('keydown', handleWizardKeyboard);
};

// End the help wizard
window.endHelpWizard = function() {
  console.log('[Help Wizard] Ending wizard');

  const overlay = document.getElementById('helpWizardOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }

  // Mark as seen
  localStorage.setItem('tuds-deck-wizard-seen', 'true');

  // Remove keyboard listener
  document.removeEventListener('keydown', handleWizardKeyboard);

  // Reset spotlight
  const spotlight = document.getElementById('wizardSpotlight');
  if (spotlight) {
    spotlight.classList.remove('active');
    spotlight.style.cssText = '';
  }
};

// Navigate to next step
window.nextWizardStep = function() {
  if (wizardCurrentStep < wizardSteps.length - 1) {
    displayWizardStep(wizardCurrentStep + 1);
  } else {
    endHelpWizard();
  }
};

// Navigate to previous step
window.prevWizardStep = function() {
  if (wizardCurrentStep > 0) {
    displayWizardStep(wizardCurrentStep - 1);
  }
};

// Handle keyboard navigation
function handleWizardKeyboard(e) {
  if (e.key === 'Escape') {
    endHelpWizard();
  } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
    nextWizardStep();
  } else if (e.key === 'ArrowLeft') {
    prevWizardStep();
  }
}

// Create progress dots
function createProgressDots() {
  const dotsContainer = document.getElementById('wizardProgressDots');
  if (!dotsContainer) return;

  dotsContainer.innerHTML = '';
  wizardSteps.forEach((_, index) => {
    const dot = document.createElement('div');
    dot.className = 'wizard-progress-dot';
    dot.dataset.step = index;
    dot.onclick = () => displayWizardStep(index);
    dotsContainer.appendChild(dot);
  });
}

// Display a specific wizard step
function displayWizardStep(stepIndex) {
  wizardCurrentStep = stepIndex;
  const step = wizardSteps[stepIndex];

  if (!step) return;

  const tooltip = document.getElementById('wizardTooltip');
  const spotlight = document.getElementById('wizardSpotlight');
  const stepIndicator = document.getElementById('wizardStepIndicator');
  const title = document.getElementById('wizardTitle');
  const description = document.getElementById('wizardDescription');
  const prevBtn = document.getElementById('wizardPrevBtn');
  const nextBtn = document.getElementById('wizardNextBtn');

  if (!tooltip) return;

  // Update content
  stepIndicator.textContent = `Step ${stepIndex + 1} of ${wizardSteps.length}`;
  title.textContent = step.title;
  description.textContent = step.description;

  // Update navigation buttons
  if (prevBtn) {
    if (stepIndex > 0) {
      prevBtn.classList.add('visible');
    } else {
      prevBtn.classList.remove('visible');
    }
  }

  if (nextBtn) {
    if (step.isFinal) {
      nextBtn.innerHTML = `
        Finish
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
          <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" />
        </svg>
      `;
    } else {
      nextBtn.innerHTML = `
        Next
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
          <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
        </svg>
      `;
    }
  }

  // Update progress dots
  updateProgressDots(stepIndex);

  // Handle welcome step vs targeted steps
  if (step.isWelcome || !step.target) {
    // Center the tooltip for welcome step
    tooltip.classList.add('welcome-step');
    tooltip.removeAttribute('data-position');
    tooltip.style.cssText = '';

    // Hide spotlight
    if (spotlight) {
      spotlight.classList.remove('active');
      spotlight.style.cssText = '';
    }
  } else {
    tooltip.classList.remove('welcome-step');
    positionTooltipAndSpotlight(step);
  }
}

// Update progress dots
function updateProgressDots(currentStep) {
  const dots = document.querySelectorAll('.wizard-progress-dot');
  dots.forEach((dot, index) => {
    dot.classList.remove('active', 'completed');
    if (index === currentStep) {
      dot.classList.add('active');
    } else if (index < currentStep) {
      dot.classList.add('completed');
    }
  });
}

// Position tooltip and spotlight relative to target element
function positionTooltipAndSpotlight(step) {
  const targetEl = document.querySelector(step.target);
  if (!targetEl) {
    console.warn(`[Help Wizard] Target not found: ${step.target}`);
    return;
  }

  const tooltip = document.getElementById('wizardTooltip');
  const spotlight = document.getElementById('wizardSpotlight');

  if (!tooltip || !spotlight) return;

  // Get target bounds
  const targetRect = targetEl.getBoundingClientRect();
  const scrollY = window.scrollY || window.pageYOffset;
  const scrollX = window.scrollX || window.pageXOffset;

  // Scroll element into view if needed
  if (targetRect.top < 100 || targetRect.bottom > window.innerHeight - 100) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Wait for scroll and re-calculate
    setTimeout(() => positionTooltipAndSpotlight(step), 400);
    return;
  }

  // Position spotlight with padding
  const padding = 8;
  spotlight.style.left = `${targetRect.left + scrollX - padding}px`;
  spotlight.style.top = `${targetRect.top + scrollY - padding}px`;
  spotlight.style.width = `${targetRect.width + padding * 2}px`;
  spotlight.style.height = `${targetRect.height + padding * 2}px`;
  spotlight.classList.add('active');

  // Position tooltip based on preferred position
  const tooltipWidth = 360;
  const tooltipHeight = tooltip.offsetHeight || 200;
  const gap = 16;

  let tooltipLeft, tooltipTop;
  const position = step.position || 'bottom';

  switch (position) {
    case 'top':
      tooltipLeft = targetRect.left + scrollX + (targetRect.width - tooltipWidth) / 2;
      tooltipTop = targetRect.top + scrollY - tooltipHeight - gap;
      break;
    case 'bottom':
      tooltipLeft = targetRect.left + scrollX + (targetRect.width - tooltipWidth) / 2;
      tooltipTop = targetRect.bottom + scrollY + gap;
      break;
    case 'left':
      tooltipLeft = targetRect.left + scrollX - tooltipWidth - gap;
      tooltipTop = targetRect.top + scrollY + (targetRect.height - tooltipHeight) / 2;
      break;
    case 'right':
      tooltipLeft = targetRect.right + scrollX + gap;
      tooltipTop = targetRect.top + scrollY + (targetRect.height - tooltipHeight) / 2;
      break;
  }

  // Ensure tooltip stays within viewport
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (tooltipLeft < 16) tooltipLeft = 16;
  if (tooltipLeft + tooltipWidth > viewportWidth - 16) {
    tooltipLeft = viewportWidth - tooltipWidth - 16;
  }
  if (tooltipTop < scrollY + 16) tooltipTop = scrollY + 16;
  if (tooltipTop + tooltipHeight > scrollY + viewportHeight - 16) {
    tooltipTop = scrollY + viewportHeight - tooltipHeight - 16;
  }

  tooltip.style.left = `${tooltipLeft}px`;
  tooltip.style.top = `${tooltipTop}px`;
  tooltip.setAttribute('data-position', position);
}

// Initialize first-time user check on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Delay the check to ensure all elements are loaded
  setTimeout(checkFirstTimeUser, 2000);
});

// ==========================================
// 3D Preview System (Isometric View)
// ==========================================

let preview3DAngle = 'front-right';
let preview3DCanvas = null;
let preview3DCtx = null;

// Isometric transformation constants
const ISO_ANGLE = Math.PI / 6; // 30 degrees
const ISO_SCALE = 0.8;

// Open 3D Preview modal
window.open3DPreview = function() {
  const modal = document.getElementById('preview3DModal');
  if (!modal) return;

  // Check if we have structure data (stored in structuralComponents after plan generation)
  if (!appState.structuralComponents || appState.structuralComponents.error) {
    alert('Please generate a deck plan first before viewing the 3D preview.');
    return;
  }

  modal.classList.remove('hidden');

  // Initialize canvas
  preview3DCanvas = document.getElementById('preview3DCanvas');
  if (preview3DCanvas) {
    preview3DCtx = preview3DCanvas.getContext('2d');
    // Set canvas size based on container
    const container = preview3DCanvas.parentElement;
    preview3DCanvas.width = Math.min(800, container.clientWidth - 32);
    preview3DCanvas.height = Math.min(600, container.clientHeight - 32);
  }

  // Render the 3D preview
  update3DPreview();

  console.log('[3D Preview] Modal opened');
};

// Close 3D Preview modal
window.close3DPreview = function() {
  const modal = document.getElementById('preview3DModal');
  if (modal) {
    modal.classList.add('hidden');
  }
  console.log('[3D Preview] Modal closed');
};

// Set 3D view angle
window.set3DAngle = function(angle) {
  preview3DAngle = angle;

  // Update button states
  document.querySelectorAll('.angle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.angle === angle);
  });

  update3DPreview();
};

// Update 3D Preview rendering
window.update3DPreview = function() {
  if (!preview3DCanvas || !preview3DCtx || !appState.structuralComponents) return;

  const ctx = preview3DCtx;
  const canvas = preview3DCanvas;
  const structure = appState.structuralComponents;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw sky gradient background
  const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGradient.addColorStop(0, '#87CEEB');
  skyGradient.addColorStop(1, '#E0F4FF');
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Get layer visibility
  const showDecking = document.getElementById('show3d-decking')?.checked ?? true;
  const showJoists = document.getElementById('show3d-joists')?.checked ?? true;
  const showBeams = document.getElementById('show3d-beams')?.checked ?? true;
  const showPosts = document.getElementById('show3d-posts')?.checked ?? true;

  // Calculate deck bounds
  const bounds = getDeckBounds(structure);
  if (!bounds) return;

  // Calculate scale to fit canvas
  const maxDim = Math.max(bounds.width, bounds.depth);
  const scale = Math.min(canvas.width * 0.6, canvas.height * 0.6) / maxDim;

  // Center offset
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2 + 50;

  // Deck height in pixels (for posts)
  const deckHeightPx = (structure.deckHeight || 48) * scale / 12;
  const postHeight = Math.max(60, deckHeightPx);

  // Convert to isometric coordinates based on angle
  function toIso(x, y, z) {
    let isoX, isoY;

    switch (preview3DAngle) {
      case 'front-right':
        isoX = (x - y) * Math.cos(ISO_ANGLE);
        isoY = (x + y) * Math.sin(ISO_ANGLE) - z;
        break;
      case 'front-left':
        isoX = (y - x) * Math.cos(ISO_ANGLE);
        isoY = (x + y) * Math.sin(ISO_ANGLE) - z;
        break;
      case 'back-right':
        isoX = (x - y) * Math.cos(ISO_ANGLE);
        isoY = (-x - y) * Math.sin(ISO_ANGLE) - z + bounds.depth * scale;
        break;
      case 'back-left':
        isoX = (y - x) * Math.cos(ISO_ANGLE);
        isoY = (-x - y) * Math.sin(ISO_ANGLE) - z + bounds.depth * scale;
        break;
    }

    return {
      x: centerX + isoX * ISO_SCALE,
      y: centerY + isoY * ISO_SCALE
    };
  }

  // Draw ground shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
  const shadowOffset = 10;
  const corners = [
    toIso(0, 0, -shadowOffset),
    toIso(bounds.width * scale, 0, -shadowOffset),
    toIso(bounds.width * scale, bounds.depth * scale, -shadowOffset),
    toIso(0, bounds.depth * scale, -shadowOffset)
  ];
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  corners.forEach(c => ctx.lineTo(c.x, c.y));
  ctx.closePath();
  ctx.fill();

  // Draw posts first (they're behind everything)
  if (showPosts && structure.posts && structure.posts.length > 0) {
    structure.posts.forEach(post => {
      const px = (post.x - bounds.minX) * scale;
      const py = (post.y - bounds.minY) * scale;
      drawPost3D(ctx, toIso, px, py, postHeight, scale);
    });
  }

  // Draw beams
  if (showBeams && structure.beams && structure.beams.length > 0) {
    structure.beams.forEach(beam => {
      const bx1 = (beam.p1.x - bounds.minX) * scale;
      const by1 = (beam.p1.y - bounds.minY) * scale;
      const bx2 = (beam.p2.x - bounds.minX) * scale;
      const by2 = (beam.p2.y - bounds.minY) * scale;
      drawBeam3D(ctx, toIso, bx1, by1, bx2, by2, 0, scale);
    });
  }

  // Draw ledger
  if (structure.ledger) {
    const lx1 = (structure.ledger.p1.x - bounds.minX) * scale;
    const ly1 = (structure.ledger.p1.y - bounds.minY) * scale;
    const lx2 = (structure.ledger.p2.x - bounds.minX) * scale;
    const ly2 = (structure.ledger.p2.y - bounds.minY) * scale;
    drawLedger3D(ctx, toIso, lx1, ly1, lx2, ly2, 0, scale);
  }

  // Draw joists
  if (showJoists && structure.joists && structure.joists.length > 0) {
    structure.joists.forEach(joist => {
      const jx1 = (joist.p1.x - bounds.minX) * scale;
      const jy1 = (joist.p1.y - bounds.minY) * scale;
      const jx2 = (joist.p2.x - bounds.minX) * scale;
      const jy2 = (joist.p2.y - bounds.minY) * scale;
      drawJoist3D(ctx, toIso, jx1, jy1, jx2, jy2, 0, scale);
    });
  }

  // Draw rim joists / outer rim
  if (structure.rimJoists && structure.rimJoists.length > 0) {
    structure.rimJoists.forEach(rim => {
      const rx1 = (rim.p1.x - bounds.minX) * scale;
      const ry1 = (rim.p1.y - bounds.minY) * scale;
      const rx2 = (rim.p2.x - bounds.minX) * scale;
      const ry2 = (rim.p2.y - bounds.minY) * scale;
      drawRim3D(ctx, toIso, rx1, ry1, rx2, ry2, 0, scale);
    });
  }

  // Draw decking boards on top
  if (showDecking) {
    drawDecking3D(ctx, toIso, bounds, scale);
  }

  // Update dimensions info
  const dimInfo = document.getElementById('preview3dDimensions');
  if (dimInfo) {
    const widthFt = Math.round(bounds.width / 12);
    const depthFt = Math.round(bounds.depth / 12);
    dimInfo.textContent = `${widthFt}' × ${depthFt}' deck`;
  }
};

// Get deck bounds from structure
function getDeckBounds(structure) {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  // Check outline points
  if (appState.points && appState.points.length > 0) {
    appState.points.forEach(p => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });
  }

  // Also check joists
  if (structure.joists) {
    structure.joists.forEach(j => {
      minX = Math.min(minX, j.p1.x, j.p2.x);
      minY = Math.min(minY, j.p1.y, j.p2.y);
      maxX = Math.max(maxX, j.p1.x, j.p2.x);
      maxY = Math.max(maxY, j.p1.y, j.p2.y);
    });
  }

  if (!isFinite(minX)) return null;

  return {
    minX, minY, maxX, maxY,
    width: maxX - minX,
    depth: maxY - minY
  };
}

// Draw a 3D post
function drawPost3D(ctx, toIso, x, y, height, scale) {
  const postSize = 6 * scale / 12; // 6" post

  // Post color
  const postColor = '#8B4513';
  const postDark = '#654321';
  const postLight = '#A0522D';

  // Bottom corners
  const b1 = toIso(x - postSize/2, y - postSize/2, 0);
  const b2 = toIso(x + postSize/2, y - postSize/2, 0);
  const b3 = toIso(x + postSize/2, y + postSize/2, 0);
  const b4 = toIso(x - postSize/2, y + postSize/2, 0);

  // Top corners
  const t1 = toIso(x - postSize/2, y - postSize/2, height);
  const t2 = toIso(x + postSize/2, y - postSize/2, height);
  const t3 = toIso(x + postSize/2, y + postSize/2, height);
  const t4 = toIso(x - postSize/2, y + postSize/2, height);

  // Draw faces based on view angle
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;

  // Front face
  ctx.fillStyle = postColor;
  ctx.beginPath();
  ctx.moveTo(b1.x, b1.y);
  ctx.lineTo(b2.x, b2.y);
  ctx.lineTo(t2.x, t2.y);
  ctx.lineTo(t1.x, t1.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Side face
  ctx.fillStyle = postDark;
  ctx.beginPath();
  ctx.moveTo(b2.x, b2.y);
  ctx.lineTo(b3.x, b3.y);
  ctx.lineTo(t3.x, t3.y);
  ctx.lineTo(t2.x, t2.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Top face
  ctx.fillStyle = postLight;
  ctx.beginPath();
  ctx.moveTo(t1.x, t1.y);
  ctx.lineTo(t2.x, t2.y);
  ctx.lineTo(t3.x, t3.y);
  ctx.lineTo(t4.x, t4.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// Draw a 3D beam
function drawBeam3D(ctx, toIso, x1, y1, x2, y2, z, scale) {
  const beamHeight = 12 * scale / 12; // ~12" deep
  const beamWidth = 4 * scale / 12;  // ~4" wide

  const beamColor = '#B8860B';
  const beamDark = '#8B6914';

  // Calculate perpendicular offset for width
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx*dx + dy*dy);
  const nx = -dy / len * beamWidth / 2;
  const ny = dx / len * beamWidth / 2;

  // Top surface
  const t1 = toIso(x1 + nx, y1 + ny, z);
  const t2 = toIso(x1 - nx, y1 - ny, z);
  const t3 = toIso(x2 - nx, y2 - ny, z);
  const t4 = toIso(x2 + nx, y2 + ny, z);

  ctx.fillStyle = beamColor;
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(t1.x, t1.y);
  ctx.lineTo(t2.x, t2.y);
  ctx.lineTo(t3.x, t3.y);
  ctx.lineTo(t4.x, t4.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Front face
  const b2 = toIso(x1 - nx, y1 - ny, z - beamHeight);
  const b3 = toIso(x2 - nx, y2 - ny, z - beamHeight);

  ctx.fillStyle = beamDark;
  ctx.beginPath();
  ctx.moveTo(t2.x, t2.y);
  ctx.lineTo(t3.x, t3.y);
  ctx.lineTo(b3.x, b3.y);
  ctx.lineTo(b2.x, b2.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// Draw a 3D joist
function drawJoist3D(ctx, toIso, x1, y1, x2, y2, z, scale) {
  const joistHeight = 10 * scale / 12;
  const joistWidth = 2 * scale / 12;

  const joistColor = '#DEB887';
  const joistDark = '#D2B48C';

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx*dx + dy*dy) || 1;
  const nx = -dy / len * joistWidth / 2;
  const ny = dx / len * joistWidth / 2;

  // Top surface
  const t1 = toIso(x1 + nx, y1 + ny, z);
  const t2 = toIso(x1 - nx, y1 - ny, z);
  const t3 = toIso(x2 - nx, y2 - ny, z);
  const t4 = toIso(x2 + nx, y2 + ny, z);

  ctx.fillStyle = joistColor;
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(t1.x, t1.y);
  ctx.lineTo(t2.x, t2.y);
  ctx.lineTo(t3.x, t3.y);
  ctx.lineTo(t4.x, t4.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Side face
  const b3 = toIso(x2 - nx, y2 - ny, z - joistHeight);
  const b2 = toIso(x1 - nx, y1 - ny, z - joistHeight);

  ctx.fillStyle = joistDark;
  ctx.beginPath();
  ctx.moveTo(t2.x, t2.y);
  ctx.lineTo(t3.x, t3.y);
  ctx.lineTo(b3.x, b3.y);
  ctx.lineTo(b2.x, b2.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// Draw a 3D rim joist
function drawRim3D(ctx, toIso, x1, y1, x2, y2, z, scale) {
  const rimHeight = 10 * scale / 12;
  const rimWidth = 2 * scale / 12;

  const rimColor = '#A0522D';
  const rimDark = '#8B4513';

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx*dx + dy*dy) || 1;
  const nx = -dy / len * rimWidth / 2;
  const ny = dx / len * rimWidth / 2;

  // Top surface
  const t1 = toIso(x1 + nx, y1 + ny, z);
  const t2 = toIso(x1 - nx, y1 - ny, z);
  const t3 = toIso(x2 - nx, y2 - ny, z);
  const t4 = toIso(x2 + nx, y2 + ny, z);

  ctx.fillStyle = rimColor;
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(t1.x, t1.y);
  ctx.lineTo(t2.x, t2.y);
  ctx.lineTo(t3.x, t3.y);
  ctx.lineTo(t4.x, t4.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Outer face
  const b1 = toIso(x1 + nx, y1 + ny, z - rimHeight);
  const b4 = toIso(x2 + nx, y2 + ny, z - rimHeight);

  ctx.fillStyle = rimDark;
  ctx.beginPath();
  ctx.moveTo(t1.x, t1.y);
  ctx.lineTo(t4.x, t4.y);
  ctx.lineTo(b4.x, b4.y);
  ctx.lineTo(b1.x, b1.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// Draw 3D ledger
function drawLedger3D(ctx, toIso, x1, y1, x2, y2, z, scale) {
  const ledgerHeight = 10 * scale / 12;
  const ledgerWidth = 2 * scale / 12;

  const ledgerColor = '#F4A460';
  const ledgerDark = '#CD853F';

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx*dx + dy*dy) || 1;
  const nx = -dy / len * ledgerWidth / 2;
  const ny = dx / len * ledgerWidth / 2;

  // Top surface
  const t1 = toIso(x1 + nx, y1 + ny, z);
  const t2 = toIso(x1 - nx, y1 - ny, z);
  const t3 = toIso(x2 - nx, y2 - ny, z);
  const t4 = toIso(x2 + nx, y2 + ny, z);

  ctx.fillStyle = ledgerColor;
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(t1.x, t1.y);
  ctx.lineTo(t2.x, t2.y);
  ctx.lineTo(t3.x, t3.y);
  ctx.lineTo(t4.x, t4.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Front face
  const b2 = toIso(x1 - nx, y1 - ny, z - ledgerHeight);
  const b3 = toIso(x2 - nx, y2 - ny, z - ledgerHeight);

  ctx.fillStyle = ledgerDark;
  ctx.beginPath();
  ctx.moveTo(t2.x, t2.y);
  ctx.lineTo(t3.x, t3.y);
  ctx.lineTo(b3.x, b3.y);
  ctx.lineTo(b2.x, b2.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// Draw decking boards
function drawDecking3D(ctx, toIso, bounds, scale) {
  const boardWidth = 6 * scale / 12; // 6" wide boards
  const boardThickness = 1.5 * scale / 12;
  const gap = 0.5 * scale / 12;
  const z = boardThickness; // Slightly above joists

  const deckingColor = '#BC8F8F';
  const deckingDark = '#A67B5B';
  const deckingLight = '#D2B48C';

  // Draw boards across the width
  let currentY = 0;
  let boardIndex = 0;

  while (currentY < bounds.depth * scale) {
    // Alternate board colors slightly for realism
    const colorVariation = boardIndex % 3;
    let color;
    switch (colorVariation) {
      case 0: color = deckingColor; break;
      case 1: color = deckingDark; break;
      case 2: color = deckingLight; break;
    }

    const y1 = currentY;
    const y2 = Math.min(currentY + boardWidth, bounds.depth * scale);

    // Top of board
    const t1 = toIso(0, y1, z);
    const t2 = toIso(bounds.width * scale, y1, z);
    const t3 = toIso(bounds.width * scale, y2, z);
    const t4 = toIso(0, y2, z);

    ctx.fillStyle = color;
    ctx.strokeStyle = '#8B7355';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(t1.x, t1.y);
    ctx.lineTo(t2.x, t2.y);
    ctx.lineTo(t3.x, t3.y);
    ctx.lineTo(t4.x, t4.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    currentY += boardWidth + gap;
    boardIndex++;
  }
}

// Download 3D preview as image
window.download3DPreview = function() {
  if (!preview3DCanvas) return;

  const link = document.createElement('a');
  link.download = 'deck-3d-preview.png';
  link.href = preview3DCanvas.toDataURL('image/png');
  link.click();

  console.log('[3D Preview] Image downloaded');
};


