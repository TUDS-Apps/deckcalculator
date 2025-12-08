// domHelpers.js - Cached DOM Element Access and Utilities
// Reduces repeated document.getElementById calls for better performance

// ================================================
// ELEMENT CACHE
// ================================================

// Cache for frequently accessed elements
const elementCache = new Map();

// Elements that should be cached on first access
const CACHEABLE_ELEMENTS = new Set([
  // Canvas
  'mainCanvas',
  'deckCanvas',

  // Tier controls
  'tierControls',
  'upperTierTab',
  'lowerTierTab',
  'activeTierLabel',
  'addTierContainer',
  'structureTierControls',
  'structureUpperTierTab',
  'structureLowerTierTab',
  'activeTierHeightLabel',

  // Form inputs - Structure
  'deckHeightFeet',
  'deckHeightInchesInput',
  'footingType',
  'postSize',
  'joistSpacing',
  'attachmentType',
  'beamType',
  'joistProtection',
  'fasteners',

  // Form inputs - Decking
  'pictureFrame',
  'deckingMaterial',
  'cedarSize',
  'boardDirection',

  // Stair controls
  'stairTargetContainer',
  'stairWidthFeet',
  'stairWidthInches',
  'stairRiserHeight',
  'stairTreadDepth',
  'stairStringerType',

  // Projects modal
  'projectsModal',
  'projectsList',
  'projectsCount',
  'saveProjectName',
  'saveProjectStore',
  'saveProjectSalesperson',
  'filterSalesperson',
  'filterSort',

  // Customer info
  'includeCustomerInfo',
  'customerInfoFields',
  'customerName',
  'customerPhone',
  'customerEmail',
  'customerAddress',

  // Wizard panels
  'drawPanel',
  'structurePanel',
  'stairsPanel',
  'deckingPanel',
  'railingPanel',
  'reviewPanel',

  // Status and info displays
  'canvasStatus',
  'deckInfo',
  'bomContainer',
  'bomList',
  'totalCostDisplay',

  // Modals
  'templateModal',
  'storeAdminModal',
  'helpModal',
  'cartOptionsModal',

  // 3D viewer
  'viewer3DContainer',
  'viewer3DCanvas'
]);

// ================================================
// CORE FUNCTIONS
// ================================================

/**
 * Gets an element by ID with optional caching
 * @param {string} id - Element ID
 * @param {boolean} useCache - Whether to use cache (default: true for cacheable elements)
 * @returns {HTMLElement|null} The element or null
 */
export function getElement(id, useCache = true) {
  // Check cache first for cacheable elements
  if (useCache && CACHEABLE_ELEMENTS.has(id)) {
    if (elementCache.has(id)) {
      const cached = elementCache.get(id);
      // Verify element is still in DOM
      if (cached && document.contains(cached)) {
        return cached;
      }
      // Element was removed, clear cache
      elementCache.delete(id);
    }

    // Fetch and cache
    const element = document.getElementById(id);
    if (element) {
      elementCache.set(id, element);
    }
    return element;
  }

  // Non-cacheable or cache disabled
  return document.getElementById(id);
}

/**
 * Gets an element's value by ID
 * @param {string} id - Element ID
 * @param {string} defaultValue - Default value if element not found
 * @returns {string} The element's value or default
 */
export function getValue(id, defaultValue = '') {
  const element = getElement(id);
  return element?.value ?? defaultValue;
}

/**
 * Sets an element's value by ID
 * @param {string} id - Element ID
 * @param {string} value - Value to set
 * @returns {boolean} True if successful
 */
export function setValue(id, value) {
  const element = getElement(id);
  if (element) {
    element.value = value;
    return true;
  }
  return false;
}

/**
 * Gets a checkbox's checked state
 * @param {string} id - Checkbox element ID
 * @returns {boolean} Checked state
 */
export function isChecked(id) {
  const element = getElement(id);
  return element?.checked ?? false;
}

/**
 * Sets a checkbox's checked state
 * @param {string} id - Checkbox element ID
 * @param {boolean} checked - Checked state
 */
export function setChecked(id, checked) {
  const element = getElement(id);
  if (element) {
    element.checked = checked;
  }
}

/**
 * Shows an element (removes 'hidden' class and sets display)
 * @param {string} id - Element ID
 * @param {string} displayType - CSS display value (default: 'block')
 */
export function showElement(id, displayType = 'block') {
  const element = getElement(id);
  if (element) {
    element.classList.remove('hidden');
    element.style.display = displayType;
  }
}

/**
 * Hides an element (adds 'hidden' class and sets display: none)
 * @param {string} id - Element ID
 */
export function hideElement(id) {
  const element = getElement(id);
  if (element) {
    element.classList.add('hidden');
    element.style.display = 'none';
  }
}

/**
 * Toggles element visibility
 * @param {string} id - Element ID
 * @param {boolean} visible - Whether to show or hide
 * @param {string} displayType - CSS display value when visible
 */
export function toggleElement(id, visible, displayType = 'block') {
  if (visible) {
    showElement(id, displayType);
  } else {
    hideElement(id);
  }
}

/**
 * Sets element's innerHTML
 * @param {string} id - Element ID
 * @param {string} html - HTML content
 */
export function setHTML(id, html) {
  const element = getElement(id);
  if (element) {
    element.innerHTML = html;
  }
}

/**
 * Sets element's textContent
 * @param {string} id - Element ID
 * @param {string} text - Text content
 */
export function setText(id, text) {
  const element = getElement(id);
  if (element) {
    element.textContent = text;
  }
}

/**
 * Adds CSS class to element
 * @param {string} id - Element ID
 * @param {string} className - Class to add
 */
export function addClass(id, className) {
  const element = getElement(id);
  if (element) {
    element.classList.add(className);
  }
}

/**
 * Removes CSS class from element
 * @param {string} id - Element ID
 * @param {string} className - Class to remove
 */
export function removeClass(id, className) {
  const element = getElement(id);
  if (element) {
    element.classList.remove(className);
  }
}

/**
 * Toggles CSS class on element
 * @param {string} id - Element ID
 * @param {string} className - Class to toggle
 * @param {boolean} force - Optional force add/remove
 */
export function toggleClass(id, className, force) {
  const element = getElement(id);
  if (element) {
    element.classList.toggle(className, force);
  }
}

/**
 * Checks if element has CSS class
 * @param {string} id - Element ID
 * @param {string} className - Class to check
 * @returns {boolean} True if element has class
 */
export function hasClass(id, className) {
  const element = getElement(id);
  return element?.classList.contains(className) ?? false;
}

/**
 * Sets element's disabled state
 * @param {string} id - Element ID
 * @param {boolean} disabled - Disabled state
 */
export function setDisabled(id, disabled) {
  const element = getElement(id);
  if (element) {
    element.disabled = disabled;
  }
}

/**
 * Focuses an element
 * @param {string} id - Element ID
 */
export function focusElement(id) {
  const element = getElement(id);
  element?.focus();
}

// ================================================
// BATCH OPERATIONS
// ================================================

/**
 * Gets multiple elements by IDs
 * @param {string[]} ids - Array of element IDs
 * @returns {Object} Map of id -> element
 */
export function getElements(ids) {
  const result = {};
  for (const id of ids) {
    result[id] = getElement(id);
  }
  return result;
}

/**
 * Gets form input values as an object
 * @param {Object} fieldMap - Map of fieldName -> elementId
 * @returns {Object} Map of fieldName -> value
 */
export function getFormValues(fieldMap) {
  const result = {};
  for (const [fieldName, elementId] of Object.entries(fieldMap)) {
    result[fieldName] = getValue(elementId);
  }
  return result;
}

/**
 * Sets form input values from an object
 * @param {Object} fieldMap - Map of fieldName -> elementId
 * @param {Object} values - Map of fieldName -> value
 */
export function setFormValues(fieldMap, values) {
  for (const [fieldName, elementId] of Object.entries(fieldMap)) {
    if (fieldName in values) {
      setValue(elementId, values[fieldName]);
    }
  }
}

// ================================================
// CANVAS HELPERS
// ================================================

/**
 * Gets the main canvas element
 * @returns {HTMLCanvasElement|null}
 */
export function getMainCanvas() {
  return getElement('mainCanvas');
}

/**
 * Gets the main canvas 2D context
 * @returns {CanvasRenderingContext2D|null}
 */
export function getMainCanvasContext() {
  const canvas = getMainCanvas();
  return canvas?.getContext('2d') ?? null;
}

// ================================================
// MODAL HELPERS
// ================================================

/**
 * Opens a modal by ID
 * @param {string} id - Modal element ID
 */
export function openModal(id) {
  const modal = getElement(id);
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
}

/**
 * Closes a modal by ID
 * @param {string} id - Modal element ID
 */
export function closeModal(id) {
  const modal = getElement(id);
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

// ================================================
// CACHE MANAGEMENT
// ================================================

/**
 * Clears the element cache
 * Call this if DOM is significantly modified
 */
export function clearCache() {
  elementCache.clear();
}

/**
 * Removes a specific element from cache
 * @param {string} id - Element ID to remove from cache
 */
export function uncacheElement(id) {
  elementCache.delete(id);
}

/**
 * Pre-caches commonly used elements
 * Call this after DOM is ready
 */
export function preCacheElements() {
  for (const id of CACHEABLE_ELEMENTS) {
    getElement(id);
  }
}

/**
 * Gets cache statistics
 * @returns {Object} Cache stats
 */
export function getCacheStats() {
  return {
    cachedCount: elementCache.size,
    cacheableCount: CACHEABLE_ELEMENTS.size
  };
}

// ================================================
// QUERY SELECTOR HELPERS
// ================================================

/**
 * Wrapper for querySelector with optional context
 * @param {string} selector - CSS selector
 * @param {HTMLElement} context - Optional context element
 * @returns {HTMLElement|null}
 */
export function $(selector, context = document) {
  return context.querySelector(selector);
}

/**
 * Wrapper for querySelectorAll with optional context
 * @param {string} selector - CSS selector
 * @param {HTMLElement} context - Optional context element
 * @returns {NodeList}
 */
export function $$(selector, context = document) {
  return context.querySelectorAll(selector);
}
