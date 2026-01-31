// stateManager.js - Centralized Application State Management
// Extracted from app.js to improve maintainability

// ================================================
// WIZARD STEP CONFIGURATION
// ================================================
export const WIZARD_STEPS = [
  { id: 'mode', name: 'Build Mode', shortName: 'Mode', icon: 'mode' },
  { id: 'draw', name: 'Draw Shape', shortName: 'Draw', icon: 'pencil' },
  { id: 'structure', name: 'Structure', shortName: 'Structure', icon: 'grid' },
  { id: 'stairs', name: 'Stairs', shortName: 'Stairs', icon: 'stairs' },
  { id: 'decking', name: 'Decking', shortName: 'Decking', icon: 'boards' },
  { id: 'railing', name: 'Railing', shortName: 'Railing', icon: 'fence', comingSoon: true },
  { id: 'review', name: 'Review & Save', shortName: 'Review', icon: 'clipboard' }
];

// ================================================
// DEFAULT STATE FACTORY
// ================================================

/**
 * Creates a fresh tier state object
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Tier state object
 */
export function createTierState(overrides = {}) {
  return {
    id: 'tier',
    name: 'Tier',
    heightFeet: 4,
    heightInches: 0,
    points: [],
    selectedWallIndices: [],
    structuralComponents: null,
    rectangularSections: [],
    deckDimensions: null,
    isShapeClosed: false,
    isDrawing: false,
    color: '#4A90E2',
    zOrder: 0,
    ...overrides
  };
}

/**
 * Creates the default decking state
 * @returns {Object} Decking state object
 */
export function createDeckingState() {
  return {
    material: 'pt',           // 'pt' | 'cedar' | 'composite'
    cedarSize: '5/4x6',       // '5/4x6' | '5/4x5' (only for cedar)
    boardDirection: 'horizontal', // 'horizontal' | 'diagonal'
    pictureFrame: 'none',     // 'none' | 'single' | 'double'
    breakerBoards: [],        // Array of {position: number (feet from ledger), id: string}
    breakerPlacementMode: false,
    showBoardLines: true
  };
}

/**
 * Creates the default layer visibility state
 * @returns {Object} Layer visibility state
 */
export function createLayerVisibility() {
  return {
    outline: true,
    ledger: true,
    joists: true,
    beams: true,
    posts: true,
    blocking: true,
    dimensions: true,
    stairs: true,
    decking: true
  };
}

/**
 * Creates the default unlocked layers state
 * @returns {Object} Unlocked layers state
 */
export function createUnlockedLayers() {
  return {
    outline: true,      // Always visible
    dimensions: true,   // Always visible
    ledger: false,      // Unlocked by completing Structure step
    joists: false,      // Unlocked by completing Structure step
    beams: false,       // Unlocked by completing Structure step
    posts: false,       // Unlocked by completing Structure step
    blocking: false,    // Unlocked by completing Structure step
    stairs: false,      // Unlocked when first stair is placed
    decking: false      // Unlocked when entering Decking step
  };
}

/**
 * Creates the complete initial application state
 * @returns {Object} Application state object
 */
export function createInitialState() {
  const state = {
    // Drawing state — tier-specific fields are accessed via Object.defineProperty aliases below
    currentMousePos: null,
    currentModelMousePos: null,

    // Wall selection
    wallSelectionMode: false,

    // Stair state
    stairPlacementMode: false,
    selectedStairIndex: -1,
    isDraggingStairs: false,
    draggedStairIndex: -1,
    hoveredStairIndex: -1,
    dragStartX: 0,
    dragStartY: 0,
    dragInitialStairX: 0,
    dragInitialStairY: 0,

    // Shape dragging state
    isDraggingShape: false,
    shapeDragStartMouse: null,
    shapeDragInitialPoints: [],

    // Calculation results
    stairs: [],
    bom: [],
    isPrinting: false,

    // Complex shape decomposition
    showDecompositionShading: false,

    // Viewport state
    viewportScale: 1.0,
    viewportOffsetX: 0,
    viewportOffsetY: 0,

    // Panning state
    isPanning: false,
    panStartViewX: 0,
    panStartViewY: 0,
    panInitialViewportOffsetX: 0,
    panInitialViewportOffsetY: 0,

    // Manual dimension input
    isDimensionInputActive: false,
    pendingDimensionStartPoint: null,

    // View modes
    isBlueprintMode: false,
    viewMode: '2d',
    viewer3D: null,

    // Measurement tool
    isMeasureMode: false,
    measurePoint1: null,
    measurePoint2: null,

    // Layer states
    layerVisibility: createLayerVisibility(),
    unlockedLayers: createUnlockedLayers(),

    // Build mode selection
    buildMode: 'full_build', // 'full_build' | 'framing_only' | 'decking_only' | 'railing_only' | 'custom'
    customComponents: { framing: true, decking: true, railing: true },

    // Layer toggle visibility (for Review step legend)
    visibleLayers: { outline: true, framing: true, decking: true, railing: true, stairs: true },

    // Panel/wizard state
    currentPanelMode: 'drawing',
    wizardStep: 'mode',
    completedSteps: [],

    // Undo/Redo
    history: [],
    historyIndex: -1,
    maxHistorySize: 50,
    isUndoRedoAction: false,

    // Decking
    decking: createDeckingState(),

    // Multi-tier
    tiersEnabled: true,
    activeTierId: 'upper',
    tiers: {
      upper: createTierState({
        id: 'upper',
        name: 'Upper Tier',
        heightFeet: 4,
        heightInches: 0,
        color: '#4A90E2',
        zOrder: 1
      }),
      lower: createTierState({
        id: 'lower',
        name: 'Lower Tier',
        heightFeet: 1,
        heightInches: 6,
        color: '#10B981',
        zOrder: 0
      })
    }
  };

  // Legacy property aliases — read/write from active tier for backwards compatibility
  // This allows canvasLogic.js, drawingStateMachine.js, and HTML onclick handlers
  // to keep using appState.points etc. and it automatically resolves to the active tier.
  Object.defineProperty(state, 'points', {
    get() { return state.tiers[state.activeTierId].points; },
    set(v) { state.tiers[state.activeTierId].points = v; },
    configurable: true,
    enumerable: true
  });
  Object.defineProperty(state, 'isShapeClosed', {
    get() { return state.tiers[state.activeTierId].isShapeClosed; },
    set(v) { state.tiers[state.activeTierId].isShapeClosed = v; },
    configurable: true,
    enumerable: true
  });
  Object.defineProperty(state, 'isDrawing', {
    get() { return state.tiers[state.activeTierId].isDrawing; },
    set(v) { state.tiers[state.activeTierId].isDrawing = v; },
    configurable: true,
    enumerable: true
  });
  Object.defineProperty(state, 'selectedWallIndices', {
    get() { return state.tiers[state.activeTierId].selectedWallIndices; },
    set(v) { state.tiers[state.activeTierId].selectedWallIndices = v; },
    configurable: true,
    enumerable: true
  });
  Object.defineProperty(state, 'rectangularSections', {
    get() { return state.tiers[state.activeTierId].rectangularSections; },
    set(v) { state.tiers[state.activeTierId].rectangularSections = v; },
    configurable: true,
    enumerable: true
  });
  Object.defineProperty(state, 'structuralComponents', {
    get() { return state.tiers[state.activeTierId].structuralComponents; },
    set(v) { state.tiers[state.activeTierId].structuralComponents = v; },
    configurable: true,
    enumerable: true
  });
  Object.defineProperty(state, 'deckDimensions', {
    get() { return state.tiers[state.activeTierId].deckDimensions; },
    set(v) { state.tiers[state.activeTierId].deckDimensions = v; },
    configurable: true,
    enumerable: true
  });

  return state;
}

// ================================================
// SINGLETON STATE INSTANCE
// ================================================

// The actual application state - mutable singleton
const appState = createInitialState();

// Export the state object (for backwards compatibility)
export { appState };

// Also expose on window for legacy HTML handlers and debugging
if (typeof window !== 'undefined') {
  window.appState = appState;
}

// ================================================
// STATE ACCESS HELPERS
// ================================================

/**
 * Gets the currently active tier
 * @returns {Object} Active tier state
 */
export function getActiveTier() {
  return appState.tiers[appState.activeTierId];
}

/**
 * Gets a specific tier by ID
 * @param {string} tierId - Tier ID ('upper' or 'lower')
 * @returns {Object|null} Tier state or null if not found
 */
export function getTier(tierId) {
  return appState.tiers[tierId] || null;
}

/**
 * Gets all tier IDs
 * @returns {string[]} Array of tier IDs
 */
export function getTierIds() {
  return Object.keys(appState.tiers);
}

/**
 * Checks if a tier has a completed shape
 * @param {string} tierId - Tier ID to check
 * @returns {boolean} True if tier shape is closed
 */
export function isTierComplete(tierId) {
  const tier = appState.tiers[tierId];
  return tier && tier.isShapeClosed && tier.points.length >= 3;
}

/**
 * Gets the deck height in total inches for a tier
 * @param {string} tierId - Tier ID
 * @returns {number} Height in inches
 */
export function getTierHeightInches(tierId) {
  const tier = appState.tiers[tierId];
  if (!tier) return 0;
  return (tier.heightFeet * 12) + tier.heightInches;
}

// ================================================
// ACTIVE TIER ACCESSOR FUNCTIONS
// ================================================

/** Gets the points array for the active tier */
export function getActivePoints(state) {
  return state.tiers[state.activeTierId].points;
}

/** Sets the points array for the active tier */
export function setActivePoints(state, points) {
  state.tiers[state.activeTierId].points = points;
}

/** Gets isShapeClosed for the active tier */
export function isActiveShapeClosed(state) {
  return state.tiers[state.activeTierId].isShapeClosed;
}

/** Sets isShapeClosed for the active tier */
export function setActiveShapeClosed(state, closed) {
  state.tiers[state.activeTierId].isShapeClosed = closed;
}

/** Gets isDrawing for the active tier */
export function isActiveDrawing(state) {
  return state.tiers[state.activeTierId].isDrawing;
}

/** Sets isDrawing for the active tier */
export function setActiveDrawing(state, drawing) {
  state.tiers[state.activeTierId].isDrawing = drawing;
}

/** Gets selectedWallIndices for the active tier */
export function getActiveSelectedWallIndices(state) {
  return state.tiers[state.activeTierId].selectedWallIndices;
}

/** Sets selectedWallIndices for the active tier */
export function setActiveSelectedWallIndices(state, indices) {
  state.tiers[state.activeTierId].selectedWallIndices = indices;
}

/** Gets rectangularSections for the active tier */
export function getActiveRectangularSections(state) {
  return state.tiers[state.activeTierId].rectangularSections;
}

/** Sets rectangularSections for the active tier */
export function setActiveRectangularSections(state, sections) {
  state.tiers[state.activeTierId].rectangularSections = sections;
}

/** Gets structuralComponents for the active tier */
export function getActiveStructuralComponents(state) {
  return state.tiers[state.activeTierId].structuralComponents;
}

/** Sets structuralComponents for the active tier */
export function setActiveStructuralComponents(state, components) {
  state.tiers[state.activeTierId].structuralComponents = components;
}

/** Gets deckDimensions for the active tier */
export function getActiveDeckDimensions(state) {
  return state.tiers[state.activeTierId].deckDimensions;
}

/** Sets deckDimensions for the active tier */
export function setActiveDeckDimensions(state, dimensions) {
  state.tiers[state.activeTierId].deckDimensions = dimensions;
}

// ================================================
// STATE RESET FUNCTIONS
// ================================================

/**
 * Resets the application state to initial values
 */
export function resetState() {
  const initial = createInitialState();
  Object.keys(initial).forEach(key => {
    appState[key] = initial[key];
  });
  console.log('[STATE] Application state reset');
}

/**
 * Resets a specific tier to initial values
 * @param {string} tierId - Tier ID to reset
 */
export function resetTier(tierId) {
  const tier = appState.tiers[tierId];
  if (!tier) return;

  const defaults = tierId === 'upper'
    ? createTierState({ id: 'upper', name: 'Upper Tier', heightFeet: 4, heightInches: 0, color: '#4A90E2', zOrder: 1 })
    : createTierState({ id: 'lower', name: 'Lower Tier', heightFeet: 1, heightInches: 6, color: '#10B981', zOrder: 0 });

  Object.keys(defaults).forEach(key => {
    tier[key] = defaults[key];
  });

  console.log(`[STATE] Tier '${tierId}' reset`);
}

/**
 * Clears edit mode flags
 */
export function clearEditModes() {
  appState.shapeEditMode = false;
  appState.wallSelectionMode = false;
  appState.stairPlacementMode = false;
  appState.hoveredVertexIndex = -1;
  appState.hoveredEdgeIndex = -1;
  appState.isDraggingShape = false;
  appState.isDraggingStairs = false;
}

// ================================================
// LAYER MANAGEMENT
// ================================================

/**
 * Unlocks structure layers (called when structure step is completed)
 */
export function unlockStructureLayers() {
  appState.unlockedLayers.ledger = true;
  appState.unlockedLayers.joists = true;
  appState.unlockedLayers.beams = true;
  appState.unlockedLayers.posts = true;
  appState.unlockedLayers.blocking = true;
  console.log('[STATE] Structure layers unlocked');
}

/**
 * Unlocks stairs layer
 */
export function unlockStairsLayer() {
  appState.unlockedLayers.stairs = true;
  console.log('[STATE] Stairs layer unlocked');
}

/**
 * Unlocks decking layer
 */
export function unlockDeckingLayer() {
  appState.unlockedLayers.decking = true;
  console.log('[STATE] Decking layer unlocked');
}

/**
 * Sets visibility for a specific layer
 * @param {string} layerName - Layer name
 * @param {boolean} visible - Visibility state
 */
export function setLayerVisibility(layerName, visible) {
  if (layerName in appState.layerVisibility) {
    appState.layerVisibility[layerName] = visible;
  }
}

/**
 * Checks if a layer is both unlocked and visible
 * @param {string} layerName - Layer name
 * @returns {boolean} True if layer should be shown
 */
export function isLayerVisible(layerName) {
  return appState.unlockedLayers[layerName] && appState.layerVisibility[layerName];
}
