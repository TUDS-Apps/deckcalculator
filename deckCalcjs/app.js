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
import * as shopifyService from "./shopifyService.js?v=8";

import * as multiSectionCalculations from "./multiSectionCalculations.js?v=8";

// ================================================
// WIZARD STEP CONFIGURATION
// ================================================
const WIZARD_STEPS = [
  { id: 'draw', name: 'Draw Shape', shortName: 'Draw', icon: 'pencil' },
  { id: 'structure', name: 'Structure', shortName: 'Structure', icon: 'grid' },
  { id: 'stairs', name: 'Stairs', shortName: 'Stairs', icon: 'stairs' },
  { id: 'decking', name: 'Decking', shortName: 'Decking', icon: 'boards', comingSoon: true },
  { id: 'railing', name: 'Railing', shortName: 'Railing', icon: 'fence', comingSoon: true },
  { id: 'review', name: 'Review & Save', shortName: 'Review', icon: 'clipboard' }
];

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

  // Measurement tool state
  isMeasureMode: false, // Whether measurement mode is active
  measurePoint1: null, // First measurement point {x, y}
  measurePoint2: null, // Second measurement point {x, y}

  // Layer visibility state (user preferences - can toggle on/off)
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

  // Layer unlock state (progressive - unlocked by completing steps)
  unlockedLayers: {
    outline: true,      // Always visible
    dimensions: true,   // Always visible
    ledger: false,      // Unlocked by completing Structure step
    joists: false,      // Unlocked by completing Structure step
    beams: false,       // Unlocked by completing Structure step
    posts: false,       // Unlocked by completing Structure step
    blocking: false,    // Unlocked by completing Structure step
    stairs: false       // Unlocked when first stair is placed
  },

  // Contextual panel state (legacy - being replaced by wizard)
  currentPanelMode: 'drawing', // 'drawing', 'wall-selection', 'specification', 'plan-generated', 'stair-config'

  // Wizard state
  wizardStep: 'draw', // Current wizard step ID
  completedSteps: [], // Array of completed step IDs

  // Undo/Redo History
  history: [],
  historyIndex: -1,
  maxHistorySize: 50,
  isUndoRedoAction: false // Flag to prevent saving during undo/redo
};

// Make appState available globally for section tab debugging
window.appState = appState;

// ================================================
// PROJECT SAVE/LOAD FUNCTIONALITY
// ================================================

const PROJECTS_STORAGE_KEY = 'tuds_deck_projects';
const STORE_CONFIG_KEY = 'tuds_store_config';
const USER_PREFS_KEY = 'tuds_user_prefs';

// Default store configuration
const DEFAULT_STORE_CONFIG = {
  stores: ['Regina', 'Saskatoon'],
  salespeople: {
    'Regina': ['Dale', 'Justin', 'Ricky Lee'],
    'Saskatoon': ['Roberta', 'Megan']
  }
};

// Store badge colors
const STORE_COLORS = {
  'Regina': { bg: '#3B82F6', text: '#ffffff' },      // Blue
  'Saskatoon': { bg: '#10B981', text: '#ffffff' }    // Green
};

// Get store configuration from localStorage
function getStoreConfig() {
  try {
    const data = localStorage.getItem(STORE_CONFIG_KEY);
    return data ? JSON.parse(data) : { ...DEFAULT_STORE_CONFIG };
  } catch (e) {
    console.error('Error reading store config:', e);
    return { ...DEFAULT_STORE_CONFIG };
  }
}

// Save store configuration to localStorage
function saveStoreConfig(config) {
  try {
    localStorage.setItem(STORE_CONFIG_KEY, JSON.stringify(config));
    return true;
  } catch (e) {
    console.error('Error saving store config:', e);
    return false;
  }
}

// Get user preferences from localStorage
function getUserPrefs() {
  try {
    const data = localStorage.getItem(USER_PREFS_KEY);
    return data ? JSON.parse(data) : { lastStore: '', lastSalesperson: '' };
  } catch (e) {
    return { lastStore: '', lastSalesperson: '' };
  }
}

// Save user preferences to localStorage
function saveUserPrefs(prefs) {
  try {
    localStorage.setItem(USER_PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.error('Error saving user prefs:', e);
  }
}

// Get all saved projects from localStorage
function getSavedProjects() {
  try {
    const data = localStorage.getItem(PROJECTS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error reading saved projects:', e);
    return [];
  }
}

// Save projects array to localStorage
function saveProjectsToStorage(projects) {
  try {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    return true;
  } catch (e) {
    console.error('Error saving projects:', e);
    return false;
  }
}

// Get current form inputs
function getFormInputs() {
  return {
    deckHeightFeet: document.getElementById('deckHeightFeet')?.value || '4',
    deckHeightInches: document.getElementById('deckHeightInchesInput')?.value || '0',
    footingType: document.getElementById('footingType')?.value || 'gh_levellers',
    postSize: document.getElementById('postSize')?.value || 'auto',
    joistSpacing: document.getElementById('joistSpacing')?.value || '16',
    attachmentType: document.getElementById('attachmentType')?.value || 'house_rim',
    beamType: document.getElementById('beamType')?.value || 'drop',
    pictureFrame: document.getElementById('pictureFrame')?.value || 'none',
    joistProtection: document.getElementById('joistProtection')?.value || 'none',
    fasteners: document.getElementById('fasteners')?.value || 'screws_3in'
  };
}

// Restore form inputs from saved data
function restoreFormInputs(inputs) {
  if (!inputs) return;

  // Helper to set select value and trigger visual selector update
  const setSelectValue = (id, value) => {
    const select = document.getElementById(id);
    if (select && value !== undefined) {
      select.value = value;
      // Trigger change event for visual selectors
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  // Helper to update visual selector UI
  const updateVisualSelector = (selectorName, value) => {
    const container = document.querySelector(`[data-selector="${selectorName}"]`);
    if (container) {
      container.querySelectorAll('.visual-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.value === value);
      });
    }
  };

  setSelectValue('deckHeightFeet', inputs.deckHeightFeet);
  setSelectValue('deckHeightInchesInput', inputs.deckHeightInches);
  setSelectValue('footingType', inputs.footingType);
  setSelectValue('postSize', inputs.postSize);
  setSelectValue('joistSpacing', inputs.joistSpacing);
  setSelectValue('attachmentType', inputs.attachmentType);
  setSelectValue('beamType', inputs.beamType);
  setSelectValue('pictureFrame', inputs.pictureFrame);
  setSelectValue('joistProtection', inputs.joistProtection);
  setSelectValue('fasteners', inputs.fasteners);

  // Update visual selectors
  updateVisualSelector('footingType', inputs.footingType);
  updateVisualSelector('postSize', inputs.postSize);
  updateVisualSelector('joistSpacing', inputs.joistSpacing);
  updateVisualSelector('attachmentType', inputs.attachmentType);
  updateVisualSelector('beamType', inputs.beamType);
  updateVisualSelector('pictureFrame', inputs.pictureFrame);
  updateVisualSelector('joistProtection', inputs.joistProtection);
  updateVisualSelector('fasteners', inputs.fasteners);
}

// Create project data object from current state
function createProjectData(projectName, store, salesperson, customerInfo = null) {
  return {
    id: Date.now().toString(),
    name: projectName,
    store: store || 'Unknown',
    salesperson: salesperson || 'Unknown',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customerInfo: customerInfo,
    deckData: {
      points: [...appState.points],
      selectedWallIndices: [...appState.selectedWallIndices],
      stairs: JSON.parse(JSON.stringify(appState.stairs)),
      isShapeClosed: appState.isShapeClosed,
      deckDimensions: appState.deckDimensions ? { ...appState.deckDimensions } : null,
      rectangularSections: appState.rectangularSections ? [...appState.rectangularSections] : []
    },
    formInputs: getFormInputs(),
    viewport: {
      scale: appState.viewportScale,
      offsetX: appState.viewportOffsetX,
      offsetY: appState.viewportOffsetY
    }
  };
}

// Save current project
function saveProject(projectName, store, salesperson, customerInfo = null) {
  if (!projectName || projectName.trim() === '') {
    alert('Please enter a project name.');
    return false;
  }

  if (!store || !salesperson) {
    alert('Please select a store and salesperson.');
    return false;
  }

  const projects = getSavedProjects();
  const projectData = createProjectData(projectName.trim(), store, salesperson, customerInfo);

  // Save user preferences for next time
  saveUserPrefs({ lastStore: store, lastSalesperson: salesperson });

  // Check if project with same name exists
  const existingIndex = projects.findIndex(p => p.name.toLowerCase() === projectName.trim().toLowerCase());
  if (existingIndex >= 0) {
    if (confirm(`A project named "${projectName}" already exists. Do you want to overwrite it?`)) {
      projectData.id = projects[existingIndex].id;
      projectData.createdAt = projects[existingIndex].createdAt;
      projects[existingIndex] = projectData;
    } else {
      return false;
    }
  } else {
    projects.unshift(projectData); // Add to beginning
  }

  if (saveProjectsToStorage(projects)) {
    uiController.updateCanvasStatus(`Project "${projectName}" saved successfully!`);
    return true;
  }
  return false;
}

// Load a saved project
function loadProject(projectId) {
  const projects = getSavedProjects();
  const project = projects.find(p => p.id === projectId);

  if (!project) {
    alert('Project not found.');
    return false;
  }

  // Clear current state
  clearCanvas();

  // Restore deck data
  if (project.deckData) {
    appState.points = project.deckData.points || [];
    appState.selectedWallIndices = project.deckData.selectedWallIndices || [];
    appState.stairs = project.deckData.stairs || [];
    appState.isShapeClosed = project.deckData.isShapeClosed || false;
    appState.rectangularSections = project.deckData.rectangularSections || [];
  }

  // Restore viewport
  if (project.viewport) {
    appState.viewportScale = project.viewport.scale || 1.0;
    appState.viewportOffsetX = project.viewport.offsetX || 0;
    appState.viewportOffsetY = project.viewport.offsetY || 0;
  }

  // Restore form inputs
  restoreFormInputs(project.formInputs);

  // Redraw canvas
  redrawApp();

  // If shape was closed, regenerate the plan
  if (appState.isShapeClosed && appState.points.length >= 3) {
    // Trigger wall selection mode or generate plan
    if (appState.selectedWallIndices.length > 0) {
      generatePlan();
    } else {
      appState.wallSelectionMode = true;
      setPanelMode('wall-selection');
    }
  }

  uiController.updateCanvasStatus(`Project "${project.name}" loaded successfully!`);
  closeProjectsModal();
  return true;
}

// Delete a saved project
function deleteProject(projectId) {
  const projects = getSavedProjects();
  const project = projects.find(p => p.id === projectId);

  if (!project) return false;

  if (confirm(`Are you sure you want to delete "${project.name}"?`)) {
    const filtered = projects.filter(p => p.id !== projectId);
    if (saveProjectsToStorage(filtered)) {
      renderProjectsList();
      uiController.updateCanvasStatus(`Project "${project.name}" deleted.`);
      return true;
    }
  }
  return false;
}

// Render the projects list in the modal
// Get current filter values
function getCurrentFilters() {
  return {
    store: document.getElementById('filterStore')?.value || 'all',
    salesperson: document.getElementById('filterSalesperson')?.value || 'all',
    year: document.getElementById('filterYear')?.value || 'all'
  };
}

// Filter projects based on current filters
function filterProjects(projects, filters) {
  return projects.filter(p => {
    if (filters.store && filters.store !== 'all' && p.store !== filters.store) return false;
    if (filters.salesperson && filters.salesperson !== 'all' && p.salesperson !== filters.salesperson) return false;
    if (filters.year && filters.year !== 'all') {
      const projectYear = new Date(p.createdAt).getFullYear().toString();
      if (projectYear !== filters.year) return false;
    }
    return true;
  });
}

// Get unique years from projects
function getProjectYears(projects) {
  const years = new Set();
  projects.forEach(p => {
    if (p.createdAt) {
      years.add(new Date(p.createdAt).getFullYear().toString());
    }
  });
  return Array.from(years).sort().reverse();
}

// Get store badge HTML
function getStoreBadgeHtml(store) {
  const colors = STORE_COLORS[store] || { bg: '#6B7280', text: '#ffffff' };
  return `<span class="store-badge" style="background-color: ${colors.bg}; color: ${colors.text}">${escapeHtml(store || 'Unknown')}</span>`;
}

function renderProjectsList() {
  const listContainer = document.getElementById('projectsList');
  const countSpan = document.getElementById('projectsCount');
  if (!listContainer) return;

  const allProjects = getSavedProjects();
  const filters = getCurrentFilters();
  const projects = filterProjects(allProjects, filters);

  // Update count display
  if (countSpan) {
    if (allProjects.length === 0) {
      countSpan.textContent = '';
    } else if (projects.length === allProjects.length) {
      countSpan.textContent = `(${allProjects.length})`;
    } else {
      countSpan.textContent = `(${projects.length} of ${allProjects.length})`;
    }
  }

  if (allProjects.length === 0) {
    listContainer.innerHTML = `
      <div class="no-projects">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-12 h-12">
          <path d="M2 4.75C2 3.784 2.784 3 3.75 3h4.836c.464 0 .909.184 1.237.513l1.414 1.414a.25.25 0 00.177.073h4.836c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0116.25 17H3.75A1.75 1.75 0 012 15.25V4.75z" />
        </svg>
        <p>No saved projects yet</p>
        <span>Save your current design to access it later</span>
      </div>
    `;
    return;
  }

  if (projects.length === 0) {
    listContainer.innerHTML = `
      <div class="no-projects">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-12 h-12">
          <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" />
        </svg>
        <p>No projects found</p>
        <span>Try adjusting your filters</span>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = projects.map(project => {
    const date = new Date(project.updatedAt).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
    const customerInfo = project.customerInfo;
    const hasCustomer = customerInfo && (customerInfo.name || customerInfo.phone || customerInfo.email);

    // Build store/salesperson meta line
    const storeBadge = getStoreBadgeHtml(project.store);
    const salespersonName = project.salesperson || 'Unknown';
    const metaHtml = `<div class="project-card-meta">${storeBadge}<span class="project-salesperson">${escapeHtml(salespersonName)}</span><span class="project-date">${date}</span></div>`;

    // Build customer info section if available
    let customerHtml = '';
    if (hasCustomer) {
      const parts = [];
      if (customerInfo.name) parts.push(`<strong>${escapeHtml(customerInfo.name)}</strong>`);
      if (customerInfo.phone) parts.push(escapeHtml(customerInfo.phone));
      if (customerInfo.email) parts.push(escapeHtml(customerInfo.email));
      if (customerInfo.address) parts.push(escapeHtml(customerInfo.address));
      customerHtml = `<div class="project-card-customer">${parts.join(' • ')}</div>`;
    }

    return `
      <div class="project-card" data-project-id="${project.id}">
        <div class="project-card-header">
          <div class="project-card-info">
            <h4 class="project-card-name">${escapeHtml(project.name)}</h4>
            ${metaHtml}
          </div>
          <div class="project-card-actions">
            <button type="button" class="btn btn-primary btn-sm" onclick="loadProject('${project.id}')">
              Load
            </button>
            <button type="button" class="btn btn-delete" onclick="deleteProject('${project.id}')" title="Delete project">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
        ${customerHtml}
      </div>
    `;
  }).join('');
}

// Helper to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Populate store dropdown for save form
function populateSaveStoreDropdown() {
  const storeSelect = document.getElementById('saveProjectStore');
  if (!storeSelect) return;

  const config = getStoreConfig();
  const prefs = getUserPrefs();

  storeSelect.innerHTML = '<option value="">Select Store...</option>' +
    config.stores.map(store =>
      `<option value="${escapeHtml(store)}"${store === prefs.lastStore ? ' selected' : ''}>${escapeHtml(store)}</option>`
    ).join('');

  // Trigger salesperson update if a store is pre-selected
  if (prefs.lastStore && config.stores.includes(prefs.lastStore)) {
    updateSalespersonDropdown();
  }
}

// Update salesperson dropdown based on selected store (for save form)
function updateSalespersonDropdown() {
  const storeSelect = document.getElementById('saveProjectStore');
  const salespersonSelect = document.getElementById('saveProjectSalesperson');
  if (!storeSelect || !salespersonSelect) return;

  const selectedStore = storeSelect.value;
  const config = getStoreConfig();
  const prefs = getUserPrefs();

  if (!selectedStore) {
    salespersonSelect.innerHTML = '<option value="">Select Person...</option>';
    return;
  }

  const people = config.salespeople[selectedStore] || [];
  salespersonSelect.innerHTML = '<option value="">Select Person...</option>' +
    people.map(person =>
      `<option value="${escapeHtml(person)}"${person === prefs.lastSalesperson ? ' selected' : ''}>${escapeHtml(person)}</option>`
    ).join('');
}

// Populate filter dropdowns
function populateFilterDropdowns() {
  const config = getStoreConfig();
  const projects = getSavedProjects();
  const years = getProjectYears(projects);

  // Store filter
  const storeFilter = document.getElementById('filterStore');
  if (storeFilter) {
    const currentValue = storeFilter.value;
    storeFilter.innerHTML = '<option value="all">All Stores</option>' +
      config.stores.map(store =>
        `<option value="${escapeHtml(store)}">${escapeHtml(store)}</option>`
      ).join('');
    if (currentValue && config.stores.includes(currentValue)) {
      storeFilter.value = currentValue;
    }
  }

  // Update salesperson filter based on store filter
  updateSalespersonFilter();

  // Year filter
  const yearFilter = document.getElementById('filterYear');
  if (yearFilter) {
    const currentValue = yearFilter.value;
    yearFilter.innerHTML = '<option value="all">All Years</option>' +
      years.map(year =>
        `<option value="${year}">${year}</option>`
      ).join('');
    if (currentValue && years.includes(currentValue)) {
      yearFilter.value = currentValue;
    }
  }
}

// Update salesperson filter based on store filter selection
function updateSalespersonFilter() {
  const storeFilter = document.getElementById('filterStore');
  const salespersonFilter = document.getElementById('filterSalesperson');
  if (!salespersonFilter) return;

  const config = getStoreConfig();
  const selectedStore = storeFilter?.value;
  const currentValue = salespersonFilter.value;

  let people = [];
  if (!selectedStore || selectedStore === 'all') {
    // Show all salespeople from all stores
    Object.values(config.salespeople).forEach(storePeople => {
      people = people.concat(storePeople);
    });
    people = [...new Set(people)]; // Remove duplicates
  } else {
    people = config.salespeople[selectedStore] || [];
  }

  salespersonFilter.innerHTML = '<option value="all">All</option>' +
    people.map(person =>
      `<option value="${escapeHtml(person)}">${escapeHtml(person)}</option>`
    ).join('');

  if (currentValue && (currentValue === 'all' || people.includes(currentValue))) {
    salespersonFilter.value = currentValue;
  }
}

// Handle store filter change
function onStoreFilterChange() {
  updateSalespersonFilter();
  renderProjectsList();
}

// Open projects modal
function openProjectsModal() {
  const modal = document.getElementById('projectsModal');
  if (modal) {
    modal.classList.remove('hidden');
    populateSaveStoreDropdown();
    populateFilterDropdowns();
    renderProjectsList();
    document.getElementById('saveProjectName')?.focus();
  }
}

// Close projects modal
function closeProjectsModal() {
  const modal = document.getElementById('projectsModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Handle save project form submission
function handleSaveProject(e) {
  if (e) e.preventDefault();
  const nameInput = document.getElementById('saveProjectName');
  const storeSelect = document.getElementById('saveProjectStore');
  const salespersonSelect = document.getElementById('saveProjectSalesperson');

  const name = nameInput?.value?.trim();
  const store = storeSelect?.value;
  const salesperson = salespersonSelect?.value;

  if (!appState.points || appState.points.length < 3) {
    alert('Please draw a deck shape first before saving.');
    return;
  }

  if (!store) {
    alert('Please select a store.');
    storeSelect?.focus();
    return;
  }

  if (!salesperson) {
    alert('Please select a salesperson.');
    salespersonSelect?.focus();
    return;
  }

  // Collect customer info if checkbox is checked
  let customerInfo = null;
  const includeCustomer = document.getElementById('includeCustomerInfo')?.checked;
  if (includeCustomer) {
    customerInfo = {
      name: document.getElementById('customerName')?.value?.trim() || '',
      phone: document.getElementById('customerPhone')?.value?.trim() || '',
      email: document.getElementById('customerEmail')?.value?.trim() || '',
      address: document.getElementById('customerAddress')?.value?.trim() || ''
    };
    // Only include if at least one field is filled
    if (!customerInfo.name && !customerInfo.phone && !customerInfo.email && !customerInfo.address) {
      customerInfo = null;
    }
  }

  if (saveProject(name, store, salesperson, customerInfo)) {
    // Clear form fields
    nameInput.value = '';
    const customerNameInput = document.getElementById('customerName');
    const customerPhoneInput = document.getElementById('customerPhone');
    const customerEmailInput = document.getElementById('customerEmail');
    const customerAddressInput = document.getElementById('customerAddress');
    const includeCheckbox = document.getElementById('includeCustomerInfo');

    if (customerNameInput) customerNameInput.value = '';
    if (customerPhoneInput) customerPhoneInput.value = '';
    if (customerEmailInput) customerEmailInput.value = '';
    if (customerAddressInput) customerAddressInput.value = '';
    if (includeCheckbox) includeCheckbox.checked = false;

    toggleCustomerInfoFields();
    renderProjectsList();
  }
}

// Toggle customer info fields visibility
function toggleCustomerInfoFields() {
  const checkbox = document.getElementById('includeCustomerInfo');
  const fields = document.getElementById('customerInfoFields');
  if (checkbox && fields) {
    fields.classList.toggle('hidden', !checkbox.checked);
  }
}

// ================================================
// Admin Login & Settings Modal Functions
// ================================================

// Admin password storage key and default
const ADMIN_PASSWORD_KEY = 'tuds_admin_password';
const DEFAULT_ADMIN_PASSWORD = 'tuds2025';

// Get or initialize admin password
function getAdminPassword() {
  return localStorage.getItem(ADMIN_PASSWORD_KEY) || DEFAULT_ADMIN_PASSWORD;
}

// Set admin password
function setAdminPassword(newPassword) {
  localStorage.setItem(ADMIN_PASSWORD_KEY, newPassword);
}

// Open admin login prompt
function openAdminLogin() {
  const password = prompt('Enter Admin Password:');
  if (password === null) return; // User cancelled

  if (password === getAdminPassword()) {
    openSettingsModal();
  } else {
    alert('Incorrect password. Access denied.');
  }
}

// Open settings modal
function openSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.classList.remove('hidden');
    renderStoresList();
  }
}

// Close settings modal
function closeSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Render the stores list in the settings modal
function renderStoresList() {
  const container = document.getElementById('storesList');
  if (!container) return;

  const config = getStoreConfig();

  if (config.stores.length === 0) {
    container.innerHTML = '<p class="no-stores">No stores configured. Add a store to get started.</p>';
    return;
  }

  container.innerHTML = config.stores.map(store => {
    const people = config.salespeople[store] || [];
    const colors = STORE_COLORS[store] || { bg: '#6B7280', text: '#ffffff' };

    const peopleHtml = people.length === 0
      ? '<p class="no-salespeople">No salespeople in this store</p>'
      : people.map(person => `
          <div class="salesperson-item">
            <span class="salesperson-name">${escapeHtml(person)}</span>
            <button type="button" class="btn-icon btn-delete-small" onclick="handleRemoveSalesperson('${escapeHtml(store)}', '${escapeHtml(person)}')" title="Remove ${escapeHtml(person)}">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        `).join('');

    return `
      <div class="store-item" data-store="${escapeHtml(store)}">
        <div class="store-header">
          <div class="store-title">
            <span class="store-badge-large" style="background-color: ${colors.bg}; color: ${colors.text}">${escapeHtml(store)}</span>
            <span class="store-count">(${people.length} ${people.length === 1 ? 'person' : 'people'})</span>
          </div>
          <button type="button" class="btn-icon btn-delete-small" onclick="handleRemoveStore('${escapeHtml(store)}')" title="Remove store">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
              <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
        <div class="salespeople-list">
          ${peopleHtml}
        </div>
        <div class="add-salesperson-row">
          <input type="text" class="add-salesperson-input" id="newSalesperson_${escapeHtml(store)}" placeholder="Add salesperson..." maxlength="50" onkeydown="if(event.key==='Enter'){handleAddSalesperson('${escapeHtml(store)}');event.preventDefault();}" />
          <button type="button" class="btn btn-secondary btn-xs" onclick="handleAddSalesperson('${escapeHtml(store)}')">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Add
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Handle adding a new store
function handleAddStore() {
  const input = document.getElementById('newStoreName');
  const storeName = input?.value?.trim();

  if (!storeName) {
    alert('Please enter a store name.');
    input?.focus();
    return;
  }

  const config = getStoreConfig();

  // Check if store already exists
  if (config.stores.some(s => s.toLowerCase() === storeName.toLowerCase())) {
    alert(`A store named "${storeName}" already exists.`);
    input?.focus();
    return;
  }

  // Add the new store
  config.stores.push(storeName);
  config.salespeople[storeName] = [];

  // Generate a color for the new store
  const colors = ['#8B5CF6', '#EC4899', '#F59E0B', '#14B8A6', '#6366F1', '#EF4444'];
  const usedColors = Object.values(STORE_COLORS).map(c => c.bg);
  const availableColor = colors.find(c => !usedColors.includes(c)) || colors[config.stores.length % colors.length];
  STORE_COLORS[storeName] = { bg: availableColor, text: '#ffffff' };

  if (saveStoreConfig(config)) {
    input.value = '';
    renderStoresList();
  }
}

// Handle adding a salesperson to a store
function handleAddSalesperson(store) {
  const input = document.getElementById(`newSalesperson_${store}`);
  const personName = input?.value?.trim();

  if (!personName) {
    alert('Please enter a name.');
    input?.focus();
    return;
  }

  const config = getStoreConfig();

  if (!config.salespeople[store]) {
    config.salespeople[store] = [];
  }

  // Check if person already exists in this store
  if (config.salespeople[store].some(p => p.toLowerCase() === personName.toLowerCase())) {
    alert(`${personName} is already in ${store}.`);
    input?.focus();
    return;
  }

  config.salespeople[store].push(personName);

  if (saveStoreConfig(config)) {
    input.value = '';
    renderStoresList();
  }
}

// Handle removing a salesperson
function handleRemoveSalesperson(store, person) {
  if (!confirm(`Remove ${person} from ${store}?\n\nTheir existing projects will show as "Unknown" until reassigned.`)) {
    return;
  }

  const config = getStoreConfig();

  if (config.salespeople[store]) {
    config.salespeople[store] = config.salespeople[store].filter(p => p !== person);
  }

  if (saveStoreConfig(config)) {
    renderStoresList();
  }
}

// Handle removing a store
function handleRemoveStore(store) {
  const config = getStoreConfig();
  const peopleCount = (config.salespeople[store] || []).length;

  let message = `Remove the ${store} store?`;
  if (peopleCount > 0) {
    message += `\n\nThis will also remove ${peopleCount} salesperson${peopleCount === 1 ? '' : 's'}.`;
  }
  message += '\n\nExisting projects will show as "Unknown" until reassigned.';

  if (!confirm(message)) {
    return;
  }

  config.stores = config.stores.filter(s => s !== store);
  delete config.salespeople[store];
  delete STORE_COLORS[store];

  if (saveStoreConfig(config)) {
    renderStoresList();
  }
}

// Handle changing admin password
function handleChangePassword() {
  const newPassword = document.getElementById('newAdminPassword')?.value || '';
  const confirmPassword = document.getElementById('confirmAdminPassword')?.value || '';

  if (!newPassword || !confirmPassword) {
    alert('Please enter and confirm your new password.');
    return;
  }

  if (newPassword.length < 4) {
    alert('Password must be at least 4 characters long.');
    return;
  }

  if (newPassword !== confirmPassword) {
    alert('Passwords do not match. Please try again.');
    return;
  }

  setAdminPassword(newPassword);
  alert('Admin password updated successfully.');

  // Clear the password fields
  document.getElementById('newAdminPassword').value = '';
  document.getElementById('confirmAdminPassword').value = '';
}

// ================================================
// PDF Export Functionality
// ================================================
async function exportToPDF() {
  // Check if plan has been generated
  if (!appState.points || appState.points.length < 3) {
    alert('Please draw a deck and generate a plan before exporting to PDF.');
    return;
  }

  // Check if jsPDF is loaded
  if (typeof window.jspdf === 'undefined') {
    alert('PDF library is still loading. Please try again in a moment.');
    return;
  }

  const { jsPDF } = window.jspdf;

  // Show loading indicator
  const exportBtn = document.getElementById('exportPdfBtn');
  const originalTitle = exportBtn?.title;
  if (exportBtn) {
    exportBtn.title = 'Generating PDF...';
    exportBtn.disabled = true;
    exportBtn.style.opacity = '0.6';
  }

  try {
    // Create PDF document (Letter size, portrait)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    });

    const pageWidth = 215.9; // Letter width in mm
    const pageHeight = 279.4; // Letter height in mm
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    let yPos = margin;

    // ---- PAGE 1: Layout & Summary ----

    // Header
    pdf.setFillColor(19, 58, 82); // TUDS Navy
    pdf.rect(0, 0, pageWidth, 25, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('TUDS Pro Deck Estimator', margin, 16);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('The Ultimate Deck Shop', pageWidth - margin - 45, 16);

    yPos = 35;

    // Project Title & Date
    pdf.setTextColor(19, 58, 82);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    const projectName = document.getElementById('saveProjectName')?.value || 'Deck Design';
    pdf.text('Deck Layout Design', margin, yPos);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    pdf.text(`Generated: ${dateStr}`, pageWidth - margin - 50, yPos);
    yPos += 10;

    // Capture canvas as image
    const canvas = document.getElementById('deckCanvas');
    if (canvas) {
      // Create a temporary canvas for a clean export
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      const scale = 2; // Higher resolution
      tempCanvas.width = canvas.width * scale;
      tempCanvas.height = canvas.height * scale;
      tempCtx.scale(scale, scale);

      // Draw white background
      tempCtx.fillStyle = 'white';
      tempCtx.fillRect(0, 0, canvas.width, canvas.height);

      // Copy the original canvas
      tempCtx.drawImage(canvas, 0, 0);

      const canvasImg = tempCanvas.toDataURL('image/png', 1.0);

      // Calculate image dimensions preserving aspect ratio
      const canvasAspect = canvas.width / canvas.height;
      const maxImgHeight = 100; // Max 100mm height for the image
      const maxImgWidth = contentWidth;

      let imgWidth, imgHeight;

      // Calculate dimensions that fit within bounds while preserving aspect ratio
      if (maxImgWidth / canvasAspect <= maxImgHeight) {
        // Width is the constraining dimension
        imgWidth = maxImgWidth;
        imgHeight = maxImgWidth / canvasAspect;
      } else {
        // Height is the constraining dimension
        imgHeight = maxImgHeight;
        imgWidth = maxImgHeight * canvasAspect;
      }

      // Center the image horizontally if it doesn't fill the width
      const imgX = margin + (contentWidth - imgWidth) / 2;

      // Add border around canvas image
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.5);
      pdf.rect(imgX - 1, yPos - 1, imgWidth + 2, imgHeight + 2);

      pdf.addImage(canvasImg, 'PNG', imgX, yPos, imgWidth, imgHeight);
      yPos += imgHeight + 10;
    }

    // Project Summary Section
    pdf.setFillColor(245, 247, 250);
    pdf.rect(margin, yPos, contentWidth, 45, 'F');
    pdf.setDrawColor(200, 200, 200);
    pdf.rect(margin, yPos, contentWidth, 45, 'S');

    yPos += 6;
    pdf.setTextColor(19, 58, 82);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Project Summary', margin + 5, yPos);
    yPos += 6;

    // Get summary data
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(60, 60, 60);

    const summaryItems = [
      { label: 'Dimensions', value: document.getElementById('summaryDimensions')?.textContent || '--' },
      { label: 'Total Area', value: document.getElementById('summaryArea')?.textContent || '--' },
      { label: 'Deck Height', value: document.getElementById('summaryHeight')?.textContent || '--' },
      { label: 'Joist Size', value: document.getElementById('summaryJoistSize')?.textContent || '--' },
      { label: 'Joist Spacing', value: document.getElementById('summaryJoistSpacing')?.textContent || '--' },
      { label: 'Beam Configuration', value: document.getElementById('summaryBeamConfig')?.textContent || '--' },
      { label: 'Post Size', value: document.getElementById('summaryPostSize')?.textContent || '--' },
      { label: 'Footing Type', value: document.getElementById('summaryFootingType')?.textContent || '--' }
    ];

    // Two column layout
    const col1X = margin + 5;
    const col2X = margin + contentWidth / 2;
    let summaryY = yPos;

    summaryItems.forEach((item, idx) => {
      const x = idx < 4 ? col1X : col2X;
      const y = summaryY + (idx % 4) * 8;
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${item.label}:`, x, y);
      pdf.setFont('helvetica', 'normal');
      pdf.text(item.value, x + 35, y);
    });

    yPos += 42;

    // ---- PAGE 2: Bill of Materials ----
    pdf.addPage();
    yPos = margin;

    // Header on page 2
    pdf.setFillColor(19, 58, 82);
    pdf.rect(0, 0, pageWidth, 20, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Bill of Materials', margin, 13);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(dateStr, pageWidth - margin - 35, 13);

    yPos = 28;

    // BOM Table Headers
    pdf.setFillColor(45, 106, 106); // TUDS Teal
    pdf.rect(margin, yPos, contentWidth, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');

    const colWidths = [80, 25, 30, 30, 20]; // Description, Size, Length, Qty, Price
    let colX = margin + 3;
    ['Description', 'Size', 'Length', 'Qty', 'Price'].forEach((header, i) => {
      pdf.text(header, colX, yPos + 5.5);
      colX += colWidths[i];
    });
    yPos += 10;

    // Get BOM data from the table
    pdf.setTextColor(40, 40, 40);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);

    const bomTable = document.getElementById('bomTable');
    if (bomTable) {
      const rows = bomTable.querySelectorAll('tbody tr');
      let rowCount = 0;
      let altRow = false;

      rows.forEach(row => {
        // Check if we need a new page
        if (yPos > pageHeight - 30) {
          pdf.addPage();
          yPos = margin + 10;

          // Add header on new page
          pdf.setFillColor(45, 106, 106);
          pdf.rect(margin, yPos, contentWidth, 8, 'F');
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');
          colX = margin + 3;
          ['Description', 'Size', 'Length', 'Qty', 'Price'].forEach((header, i) => {
            pdf.text(header, colX, yPos + 5.5);
            colX += colWidths[i];
          });
          yPos += 10;
          pdf.setTextColor(40, 40, 40);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7.5);
        }

        // Alternate row background
        if (altRow) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin, yPos - 1, contentWidth, 7, 'F');
        }
        altRow = !altRow;

        const cells = row.querySelectorAll('td');
        if (cells.length >= 5) {
          colX = margin + 3;

          // Description (truncate if too long)
          let desc = cells[0]?.textContent?.trim() || '';
          if (desc.length > 45) desc = desc.substring(0, 42) + '...';
          pdf.text(desc, colX, yPos + 4);
          colX += colWidths[0];

          // Size
          pdf.text(cells[1]?.textContent?.trim() || '', colX, yPos + 4);
          colX += colWidths[1];

          // Length
          pdf.text(cells[2]?.textContent?.trim() || '', colX, yPos + 4);
          colX += colWidths[2];

          // Qty
          pdf.text(cells[3]?.textContent?.trim() || '', colX, yPos + 4);
          colX += colWidths[3];

          // Price
          pdf.text(cells[4]?.textContent?.trim() || '', colX, yPos + 4);

          yPos += 7;
          rowCount++;
        }
      });

      // Total row
      if (rowCount > 0) {
        yPos += 3;
        pdf.setLineWidth(0.5);
        pdf.setDrawColor(19, 58, 82);
        pdf.line(margin, yPos, margin + contentWidth, yPos);
        yPos += 6;

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        const totalEl = document.getElementById('bomTotal');
        const totalText = totalEl?.textContent || 'Total: --';
        pdf.text(totalText, pageWidth - margin - 50, yPos);
      }
    }

    // Footer
    yPos = pageHeight - 15;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    pdf.setFontSize(7);
    pdf.setTextColor(120, 120, 120);
    pdf.setFont('helvetica', 'italic');
    pdf.text('Generated by TUDS Pro Deck Estimator - www.tuds.ca', margin, yPos + 5);
    pdf.text('Prices and availability subject to change', pageWidth - margin - 55, yPos + 5);

    // Save the PDF
    const fileName = `deck-estimate-${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);

    // Show success message
    updateStatusMessage('PDF exported successfully!');

  } catch (error) {
    console.error('PDF Export Error:', error);
    alert('Error generating PDF. Please try again.');
  } finally {
    // Restore button state
    if (exportBtn) {
      exportBtn.title = originalTitle || 'Export PDF';
      exportBtn.disabled = false;
      exportBtn.style.opacity = '1';
    }
  }
}

// Make functions globally available
window.saveProject = saveProject;
window.loadProject = loadProject;
window.deleteProject = deleteProject;
window.openProjectsModal = openProjectsModal;
window.closeProjectsModal = closeProjectsModal;
window.handleSaveProject = handleSaveProject;
window.toggleCustomerInfoFields = toggleCustomerInfoFields;
window.exportToPDF = exportToPDF;

// Store/Salesperson dropdown functions
window.updateSalespersonDropdown = updateSalespersonDropdown;
window.onStoreFilterChange = onStoreFilterChange;
window.renderProjectsList = renderProjectsList;

// Admin login and settings modal functions
window.openAdminLogin = openAdminLogin;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.handleAddStore = handleAddStore;
window.handleAddSalesperson = handleAddSalesperson;
window.handleRemoveSalesperson = handleRemoveSalesperson;
window.handleRemoveStore = handleRemoveStore;
window.handleChangePassword = handleChangePassword;

// Wizard navigation functions
window.setWizardStep = setWizardStep;
window.goToNextStep = goToNextStep;
window.goToPreviousStep = goToPreviousStep;
window.handleWizardStepClick = handleWizardStepClick;
window.initializeWizard = initializeWizard;
window.renderWizardStepList = renderWizardStepList;
window.triggerAutoCalculation = triggerAutoCalculation;

// Structure sub-step navigation
let currentStructureSubstep = 1;

window.setStructureSubstep = function(substep) {
  currentStructureSubstep = substep;
  const structureStep = document.getElementById('wizard-step-structure');
  if (!structureStep) return;

  // Update data attribute for CSS
  structureStep.setAttribute('data-substep', substep);

  // Update sub-step content visibility
  document.querySelectorAll('.structure-substep').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-substep') === String(substep));
  });

  // Update indicator dots
  document.querySelectorAll('.substep-dot').forEach(dot => {
    const dotSubstep = parseInt(dot.getAttribute('data-substep'));
    dot.classList.remove('active', 'complete');
    if (dotSubstep === substep) {
      dot.classList.add('active');
    } else if (dotSubstep < substep) {
      dot.classList.add('complete');
    }
  });

  // Update connector colors
  document.querySelectorAll('.substep-connector').forEach((conn, idx) => {
    conn.style.background = idx < substep - 1 ? 'var(--tuds-green-dark)' : 'var(--gray-300)';
  });
};

window.nextStructureSubstep = function() {
  if (currentStructureSubstep < 3) {
    setStructureSubstep(currentStructureSubstep + 1);
  }
};

window.prevStructureSubstep = function() {
  if (currentStructureSubstep > 1) {
    setStructureSubstep(currentStructureSubstep - 1);
  } else {
    // If on first sub-step, go back to Draw step
    goToPreviousStep();
  }
};

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


// ================================================
// WIZARD STEP MANAGEMENT FUNCTIONS
// ================================================

// Get step object by ID
function getStepById(stepId) {
  return WIZARD_STEPS.find(s => s.id === stepId);
}

// Get step index by ID
function getStepIndex(stepId) {
  return WIZARD_STEPS.findIndex(s => s.id === stepId);
}

// Check if a step is complete
function isStepComplete(stepId) {
  return appState.completedSteps.includes(stepId);
}

// Mark a step as complete
function markStepComplete(stepId) {
  if (!appState.completedSteps.includes(stepId)) {
    appState.completedSteps.push(stepId);
  }
  renderWizardStepList();
}

// Mark a step as incomplete
function markStepIncomplete(stepId) {
  appState.completedSteps = appState.completedSteps.filter(s => s !== stepId);
  renderWizardStepList();
}

// ================================================
// PROGRESSIVE LAYER VISIBILITY
// ================================================

// Check if a layer is visible (must be both unlocked AND user preference on)
function isLayerVisible(layerId) {
  return appState.unlockedLayers[layerId] && appState.layerVisibility[layerId];
}

// Unlock layers when a step is completed
function onStepComplete(stepId) {
  console.log(`[onStepComplete] Step "${stepId}" completed, unlocking layers...`);

  switch(stepId) {
    case 'draw':
      // No new layers (outline/dimensions always visible)
      break;
    case 'structure':
      // Unlock all framing layers
      appState.unlockedLayers.ledger = true;
      appState.unlockedLayers.joists = true;
      appState.unlockedLayers.beams = true;
      appState.unlockedLayers.posts = true;
      appState.unlockedLayers.blocking = true;
      console.log('[onStepComplete] Framing layers unlocked');
      break;
    case 'stairs':
      appState.unlockedLayers.stairs = true;
      console.log('[onStepComplete] Stairs layer unlocked');
      break;
    // Future: decking, railing
  }
  redrawApp();
}

// Update BOM visibility based on current step
function updateBOMVisibility(stepId) {
  const bomSection = document.getElementById('bomSection');
  const bomPlaceholder = document.getElementById('bomPlaceholder');

  if (stepId === 'draw') {
    // In Draw step: Hide BOM, show placeholder message
    if (bomSection) {
      bomSection.style.display = 'none';
      bomSection.classList.add('hidden');
    }
    if (bomPlaceholder) {
      bomPlaceholder.style.display = 'block';
      bomPlaceholder.classList.remove('hidden');
    }
  } else {
    // Past Draw step: Show BOM, hide placeholder
    if (bomSection) {
      bomSection.style.display = 'block';
      bomSection.classList.remove('hidden');
    }
    if (bomPlaceholder) {
      bomPlaceholder.style.display = 'none';
      bomPlaceholder.classList.add('hidden');
    }
  }
}

// Check if a step is available (can be navigated to)
function isStepAvailable(stepId) {
  // Step 1 (draw) is always available
  if (stepId === 'draw') return true;

  // All other steps require Step 1 to be complete (shape closed)
  return appState.isShapeClosed;
}

// Navigate to a specific step
function setWizardStep(stepId) {
  if (!isStepAvailable(stepId)) {
    // Show tooltip or notification that step is not available
    console.log(`Step "${stepId}" is not available. Complete the drawing first.`);
    return false;
  }

  const previousStep = appState.wizardStep;
  appState.wizardStep = stepId;
  showWizardStepContent(stepId);
  renderWizardStepList();

  // Update BOM visibility based on step (PROGRESSIVE RENDERING)
  updateBOMVisibility(stepId);

  // Handle special behaviors for certain steps
  handleStepEntry(stepId, previousStep);

  return true;
}

// Handle special logic when entering a step
function handleStepEntry(stepId, previousStep) {
  switch(stepId) {
    case 'draw':
      // Ensure edit shape panel visibility is updated when returning to draw step
      // This fixes the edit button not appearing after navigating away and back
      redrawApp();
      break;
    case 'structure':
      // PROGRESSIVE RENDERING: Trigger calculation when entering Structure step
      // This is when framing gets calculated and displayed
      if (appState.isShapeClosed) {
        // Unlock framing layers
        onStepComplete('structure');
        // Trigger calculation (will now run since we're past 'draw' step)
        triggerAutoCalculation();
      }

      // Ensure wall selection UI shows if needed
      if (appState.isShapeClosed && getAttachmentType() === 'house_rim' && appState.selectedWallIndices.length === 0) {
        // Show wall selection prompt within structure step
      }
      break;
    case 'stairs':
      // Unlock stairs layer directly (don't call onStepComplete to avoid redraw loop)
      appState.unlockedLayers.stairs = true;
      // Enable stair placement mode
      appState.stairPlacementMode = true;
      // Ensure structure is calculated if jumping directly here
      if (!appState.structuralComponents && appState.isShapeClosed) {
        onStepComplete('structure');
        triggerAutoCalculation();
      }
      redrawApp();
      break;
    case 'decking':
    case 'railing':
      // Coming soon - just show placeholder
      break;
    case 'review':
      // Trigger auto-calculation if not already done
      triggerAutoCalculation();
      break;
  }
}

// Get the current attachment type from form
function getAttachmentType() {
  const select = document.getElementById('attachmentType');
  return select ? select.value : 'house_rim';
}

// Go to the next step
function goToNextStep() {
  const currentIndex = getStepIndex(appState.wizardStep);
  if (currentIndex < WIZARD_STEPS.length - 1) {
    const nextStep = WIZARD_STEPS[currentIndex + 1];

    // Mark current step as complete before advancing
    markStepComplete(appState.wizardStep);

    setWizardStep(nextStep.id);
  }
}

// Go to the previous step
function goToPreviousStep() {
  const currentIndex = getStepIndex(appState.wizardStep);
  if (currentIndex > 0) {
    const prevStep = WIZARD_STEPS[currentIndex - 1];
    setWizardStep(prevStep.id);
  }
}

// Show content for a specific wizard step
function showWizardStepContent(stepId) {
  // Hide all step content panels
  const stepPanels = document.querySelectorAll('.wizard-step-content');
  stepPanels.forEach(panel => {
    panel.classList.add('hidden');
    panel.classList.remove('active');
  });

  // Show the target step content
  const targetPanel = document.getElementById(`wizard-step-${stepId}`);
  if (targetPanel) {
    targetPanel.classList.remove('hidden');
    setTimeout(() => {
      targetPanel.classList.add('active');
    }, 50);
  }

  // Update the Next button text based on current step
  updateWizardNextButton(stepId);
}

// Update the Next button text/state
function updateWizardNextButton(stepId) {
  const nextBtn = document.getElementById('wizardNextBtn');
  if (!nextBtn) return;

  const currentIndex = getStepIndex(stepId);
  const isLastStep = currentIndex === WIZARD_STEPS.length - 1;

  if (isLastStep) {
    nextBtn.style.display = 'none';
  } else {
    nextBtn.style.display = '';
    const nextStep = WIZARD_STEPS[currentIndex + 1];
    nextBtn.innerHTML = `
      <span>Next: ${nextStep.shortName}</span>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
        <path fill-rule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clip-rule="evenodd" />
      </svg>
    `;

    // Disable if current step not complete (Step 1 has special requirements)
    if (stepId === 'draw') {
      const attachmentType = getAttachmentType();
      const shapeComplete = appState.isShapeClosed;
      // For house_rim (ledger) attachment, also require wall selection
      const wallsComplete = attachmentType !== 'house_rim' || appState.selectedWallIndices.length > 0;

      if (!shapeComplete || !wallsComplete) {
        nextBtn.disabled = true;
        nextBtn.classList.add('disabled');
      } else {
        nextBtn.disabled = false;
        nextBtn.classList.remove('disabled');
      }
    } else {
      nextBtn.disabled = false;
      nextBtn.classList.remove('disabled');
    }
  }
}

// Render the wizard step list navigation
function renderWizardStepList() {
  const stepList = document.getElementById('wizardStepList');
  if (!stepList) return;

  stepList.innerHTML = WIZARD_STEPS.map((step, index) => {
    const isActive = appState.wizardStep === step.id;
    const isComplete = isStepComplete(step.id);
    const isAvailable = isStepAvailable(step.id);

    let statusClass = '';
    if (isActive) statusClass = 'active';
    else if (isComplete) statusClass = 'complete';
    else if (!isAvailable) statusClass = 'unavailable';

    const comingSoonBadge = step.comingSoon ? '<span class="step-coming-soon">Soon</span>' : '';

    return `
      <li class="wizard-step-item ${statusClass}"
          data-step="${step.id}"
          onclick="handleWizardStepClick('${step.id}')"
          ${!isAvailable ? 'title="Complete drawing first"' : ''}>
        <span class="step-number">
          ${isComplete ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" /></svg>' : (index + 1)}
        </span>
        <span class="step-name">${step.shortName}</span>
        ${comingSoonBadge}
      </li>
    `;
  }).join('');
}

// Handle click on wizard step item
function handleWizardStepClick(stepId) {
  if (isStepAvailable(stepId)) {
    setWizardStep(stepId);
  }
}

// Trigger auto-calculation of structural components and BOM
function triggerAutoCalculation() {
  // PROGRESSIVE RENDERING: Don't calculate if still in Draw step
  // Framing should only be calculated once user advances to Structure step
  if (appState.wizardStep === 'draw') {
    console.log('[triggerAutoCalculation] Skipping - still in Draw step');
    return;
  }

  // Only calculate if we have a closed shape
  if (!appState.isShapeClosed || appState.points.length < 3) {
    return;
  }

  // Get form inputs
  const formInputs = uiController.getFormInputs();

  // Calculate deck dimensions if not done
  if (!appState.deckDimensions) {
    calculateAndUpdateDeckDimensions();
  }

  // Check if we need walls for house_rim (ledger) attachment
  if (formInputs.attachmentType === 'house_rim' && appState.selectedWallIndices.length === 0) {
    // Can't calculate without wall selection
    return;
  }

  // Perform structural calculation
  try {
    console.log('[triggerAutoCalculation] Starting calculation with inputs:', formInputs);
    const result = calculateStructuralComponents(formInputs);
    console.log('[triggerAutoCalculation] Result:', result ? 'Got result' : 'No result', 'Error:', result?.error);
    if (result && !result.error) {
      appState.structuralComponents = result;
      recalculateAndUpdateBOM();
      redrawApp();
      console.log('[triggerAutoCalculation] Structure generated successfully');
    } else if (result?.error) {
      console.error('[triggerAutoCalculation] Calculation returned error:', result.error);
    } else {
      console.warn('[triggerAutoCalculation] Calculation returned no result');
    }
  } catch (error) {
    console.error('[triggerAutoCalculation] Exception:', error);
  }
}

// Calculate structural components (wrapper)
function calculateStructuralComponents(formInputs) {
  // Check if complex shape
  if (appState.rectangularSections && appState.rectangularSections.length > 1) {
    return multiSectionCalculations.calculateMultiSectionStructure(
      appState.rectangularSections,
      formInputs,
      appState.selectedWallIndices,
      appState.points
    );
  } else {
    return deckCalculations.calculateStructure(
      appState.points,              // shapePoints
      appState.selectedWallIndices, // ledgerIndices
      formInputs,                   // inputs
      appState.deckDimensions       // deckDimensions
    );
  }
}

// Initialize wizard on page load
function initializeWizard() {
  renderWizardStepList();
  showWizardStepContent('draw');
  updateWizardNextButton('draw');
}

// --- Contextual Panel Management Functions (Legacy) ---
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

  // Update Edit Shape panel visibility based on shape state
  updateEditShapePanelVisibility();

  // PROGRESSIVE RENDERING: Compute effective layer visibility
  // A layer is only visible if it's both unlocked AND user preference is on
  const effectiveLayerVisibility = {};
  for (const layer of Object.keys(appState.layerVisibility)) {
    effectiveLayerVisibility[layer] = isLayerVisible(layer);
  }

  // Pass the blueprint mode and effective visibility to canvas logic
  canvasLogic.redrawCanvas({
    ...appState,
    layerVisibility: effectiveLayerVisibility, // Override with effective visibility
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
  const htmlScaleIndicator = document.querySelector('.grid-scale-indicator');

  if (appState.isBlueprintMode) {
    // Update button state
    if (blueprintToggleBtn) {
      blueprintToggleBtn.classList.add('btn-primary');
      blueprintToggleBtn.classList.remove('btn-secondary');
    }

    // Add blueprint mode class to container for CSS styling
    if (canvasWrapper) canvasWrapper.classList.add('blueprint-mode');
    document.body.classList.add('blueprint-enabled');

    // Hide HTML scale indicator - blueprint mode draws its own on canvas
    if (htmlScaleIndicator) htmlScaleIndicator.style.display = 'none';

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

    // Show HTML scale indicator when not in blueprint mode
    if (htmlScaleIndicator) htmlScaleIndicator.style.display = '';

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

  // Reset shape edit mode state
  appState.shapeEditMode = false;
  appState.editMode = null;
  appState.hoveredVertexIndex = -1;
  appState.hoveredEdgeIndex = -1;
  appState.hoveredIconType = null;
  appState.selectedVertexIndex = -1;
  appState.draggedVertexIndex = -1;
  appState.draggedEdgeIndex = -1;
  appState.wasEditingOnMouseUp = false;

  // Reset decomposition state
  appState.rectangularSections = [];
  appState.showDecompositionShading = false;
  
  // Reset dimension input state
  appState.isDimensionInputActive = false;
  appState.pendingDimensionStartPoint = null;
  hideDimensionInput();

  // Always start with blueprint mode off - user can enable it via the button if needed
  appState.isBlueprintMode = false;

  // Reset measurement tool state
  appState.isMeasureMode = false;
  appState.measurePoint1 = null;
  appState.measurePoint2 = null;
  // Reset measure tool button appearance
  const measureToolBtn = document.getElementById('measureToolBtn');
  if (measureToolBtn) {
    measureToolBtn.classList.add('btn-secondary');
    measureToolBtn.classList.remove('btn-primary');
  }

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
      // Enrich BOM with live Shopify prices if available
      appState.bom = shopifyService.isLoaded()
        ? shopifyService.enrichBomWithShopifyData(bomResult)
        : bomResult;
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

  // Handle Escape key for measurement mode
  if (event.key === "Escape" && appState.isMeasureMode) {
    event.preventDefault();
    handleMeasureToolToggle(); // Turn off measurement mode
    return;
  }

  // Handle Delete key for vertex removal (only in Draw step when edit mode is active)
  // Allow during wall selection - edit mode temporarily pauses wall selection
  if ((event.key === "Delete" || event.key === "Backspace") &&
      appState.selectedVertexIndex >= 0 &&
      appState.isShapeClosed &&
      appState.shapeEditMode &&
      appState.wizardStep === 'draw') {
    event.preventDefault();
    const success = removeVertex(appState.selectedVertexIndex);
    if (success) {
      saveHistoryState('Remove vertex');
      recalculateShapeAfterEdit();
      uiController.updateCanvasStatus('Vertex removed.');
      redrawApp();
    }
    return;
  }

  // Handle Escape key to deselect vertex
  if (event.key === "Escape" &&
      appState.selectedVertexIndex >= 0 &&
      appState.wizardStep === 'draw') {
    event.preventDefault();
    appState.selectedVertexIndex = -1;
    redrawApp();
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

  // If vertex/edge dragging was just completed, don't process a click
  // This prevents accidental vertex removal after a drag
  if (appState.wasEditingOnMouseUp) {
    appState.wasEditingOnMouseUp = false; // Reset flag
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

  // Handle measurement tool clicks
  if (appState.isMeasureMode) {
    if (handleMeasureClick(modelMouse.x, modelMouse.y)) {
      return; // Measurement handled the click
    }
  }

  if (appState.stairPlacementMode) {
    handleStairPlacementClick(modelMouse.x, modelMouse.y);
    return;
  }

  // Handle icon clicks for add/remove vertices (unified edit mode)
  if (appState.isShapeClosed &&
      appState.shapeEditMode &&
      appState.hoveredIconType &&
      appState.wizardStep === 'draw') {

    // Debounce: prevent rapid clicks from triggering multiple operations
    const now = Date.now();
    if (appState.lastVertexEditTime && (now - appState.lastVertexEditTime) < 200) {
      return; // Ignore clicks within 200ms of the last edit
    }
    appState.lastVertexEditTime = now;

    // Click on delete icon to REMOVE vertex
    if (appState.hoveredIconType === 'delete' && appState.hoveredVertexIndex >= 0) {
      const success = removeVertex(appState.hoveredVertexIndex);
      if (success) {
        saveHistoryState('Remove vertex');
        recalculateShapeAfterEdit();
        uiController.updateCanvasStatus('Point removed.');
      }
      appState.hoveredIconType = null; // Reset after action
      redrawApp();
      return;
    }

    // Click on add icon to ADD a vertex
    if (appState.hoveredIconType === 'add' && appState.hoveredEdgeIndex >= 0) {
      const success = insertVertexOnEdge(appState.hoveredEdgeIndex, modelMouse);
      if (success) {
        saveHistoryState('Add vertex');
        recalculateShapeAfterEdit();
        uiController.updateCanvasStatus('Point added.');
      }
      appState.hoveredIconType = null; // Reset after action
      redrawApp();
      return;
    }
  }

  // Delete button clicks are now handled through the UI panel, not canvas clicks
  // Skip wall selection handling when in shape edit mode
  if (appState.wallSelectionMode && !appState.shapeEditMode) {
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
        // Trigger auto-calculation to generate framing plan
        triggerAutoCalculation();
      } else {
        appState.rectangularSections = [];
      }

      // Update the wizard Next button state
      updateWizardNextButton(appState.wizardStep);

      // Only exit wall selection mode when Generate Plan is clicked
      // Keep wall selection mode active for multi-selection
      updateContextualPanel();
      redrawApp();
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
    // Prevent concurrent click processing (for synthetic events)
    if (appState.isProcessingClick) {
      return;
    }
    appState.isProcessingClick = true;

    // Debounce: prevent rapid clicks from triggering multiple point additions
    const now = Date.now();
    if (appState.lastPointAddTime && (now - appState.lastPointAddTime) < 100) {
      appState.isProcessingClick = false;
      return; // Ignore clicks within 100ms of the last point add
    }
    appState.lastPointAddTime = now;

    // First, check if we're trying to close the shape by clicking near the first point
    // We need to check this BEFORE orthogonal snapping, since the snapping might
    // push the position away from the first point
    const modelSnapTolerance =
      config.SNAP_TOLERANCE_PIXELS / appState.viewportScale;

    let snappedModelPos;
    let isClosingClick = false;

    // Check if clicking near first point to close shape (using raw mouse position)
    if (appState.points.length >= 3) {
      const distanceToFirstPoint = utils.distance(modelMouse, appState.points[0]);
      // Use a generous tolerance for closing detection (3x the normal snap tolerance)
      // This makes it easier for users to close shapes by clicking near the first point
      if (distanceToFirstPoint < modelSnapTolerance * 3) {
        // Snap directly to the first point for closing
        snappedModelPos = { ...appState.points[0] };
        isClosingClick = true;
      }
    }

    // If not a closing click, use normal snapping
    if (!isClosingClick) {
      snappedModelPos = canvasLogic.getSnappedPos(
        modelMouse.x,
        modelMouse.y,
        appState.points,
        appState.isShapeClosed
      );
    }

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
    if (appState.points.length >= 3 && isClosingClick) {
      // Closing click detected - close the shape
      // Create a temporary shape for validation that includes corner point and closing
      let tempPoints = [...appState.points];

      // Create orthogonal closing path if needed
      const lastPoint = tempPoints[tempPoints.length - 1];
      const startPoint = tempPoints[0];

      // Minimum segment length in pixels (3 inches = 0.25 feet)
      // Used to auto-correct small misalignments that would create invalid short segments
      const minSegmentPixels = 0.25 * config.PIXELS_PER_FOOT;

      let dx = Math.abs(lastPoint.x - startPoint.x);
      let dy = Math.abs(lastPoint.y - startPoint.y);

      // Auto-correct small misalignments to prevent creating invalid short segments
      // If the x/y difference is smaller than minimum segment length, snap to alignment
      if (dx > config.EPSILON && dx < minSegmentPixels) {
        // Small x misalignment - snap last point's x to start point's x
        console.log(`[CLOSE] Auto-correcting small X misalignment (${dx.toFixed(2)}px < ${minSegmentPixels.toFixed(2)}px min)`);
        tempPoints[tempPoints.length - 1] = { ...lastPoint, x: startPoint.x };
        dx = 0;
      }
      if (dy > config.EPSILON && dy < minSegmentPixels) {
        // Small y misalignment - snap last point's y to start point's y
        console.log(`[CLOSE] Auto-correcting small Y misalignment (${dy.toFixed(2)}px < ${minSegmentPixels.toFixed(2)}px min)`);
        tempPoints[tempPoints.length - 1] = { ...tempPoints[tempPoints.length - 1], y: startPoint.y };
        dy = 0;
      }

      if (dx > config.EPSILON && dy > config.EPSILON) {
        // We need to add a corner point to ensure 90-degree angles
        // (only if both dx and dy are significant after auto-correction)

        // Get the potentially updated last point (may have been auto-corrected above)
        const updatedLastPoint = tempPoints[tempPoints.length - 1];

        // Calculate both possible corner points
        const cornerOption1 = { x: startPoint.x, y: updatedLastPoint.y }; // Go horizontal first
        const cornerOption2 = { x: updatedLastPoint.x, y: startPoint.y }; // Go vertical first

        // Check if either corner option already exists in the points array
        const option1Exists = tempPoints.some(p =>
          Math.abs(p.x - cornerOption1.x) < config.EPSILON &&
          Math.abs(p.y - cornerOption1.y) < config.EPSILON
        );
        const option2Exists = tempPoints.some(p =>
          Math.abs(p.x - cornerOption2.x) < config.EPSILON &&
          Math.abs(p.y - cornerOption2.y) < config.EPSILON
        );

        // Choose the corner point that doesn't already exist
        // If both exist or neither exist, fall back to the shorter distance heuristic
        let cornerPoint;
        if (option1Exists && !option2Exists) {
          cornerPoint = cornerOption2;
        } else if (option2Exists && !option1Exists) {
          cornerPoint = cornerOption1;
        } else if (!option1Exists && !option2Exists) {
          // Neither exists, use the shorter distance heuristic
          cornerPoint = dx < dy ? cornerOption1 : cornerOption2;
        } else {
          // Both exist - this means we don't need a corner point
          // (the shape can close directly through existing points)
          cornerPoint = null;
        }

        // Add the corner point to temp array if needed
        if (cornerPoint) {
          tempPoints.push(cornerPoint);
        }
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
      // First, apply any auto-corrections to the last point
      const originalLastIndex = appState.points.length - 1;
      const correctedLastPoint = tempPoints[originalLastIndex];
      if (correctedLastPoint.x !== appState.points[originalLastIndex].x ||
          correctedLastPoint.y !== appState.points[originalLastIndex].y) {
        // Last point was auto-corrected for small misalignment
        appState.points[originalLastIndex] = correctedLastPoint;
      }

      // Add corner point if one was added
      if (tempPoints.length > appState.points.length + 1) {
        // Corner point was added (it's the second-to-last point before closing)
        appState.points.push(tempPoints[tempPoints.length - 2]);
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

      // Check if we need wall selection based on attachment type
      const currentAttachmentType = getAttachmentType();
      if (currentAttachmentType === 'house_rim') {
        // House rim (ledger) attachment requires wall selection
        appState.wallSelectionMode = true;
        uiController.updateCanvasStatus("Click wall edges to select for ledger attachment.");
      } else {
        // Non-ledger types (concrete, floating) don't need wall selection
        appState.wallSelectionMode = false;
        // Decompose shape with no walls (will use default orientation)
        decomposeClosedShape();
        // Trigger auto-calculation immediately
        triggerAutoCalculation();
      }

      // Update the wizard Next button state
      updateWizardNextButton(appState.wizardStep);

      saveHistoryState('Close shape');
      updateContextualPanel();
    } else if (appState.points.length >= 3) {
      // 3+ points but not a closing click - add another point
      if (utils.distance(snappedModelPos, appState.points[appState.points.length - 1]) > config.EPSILON) {
        appState.points.push(snappedModelPos);
        appState.isDrawing = true;
        saveHistoryState('Add point');
        updateContextualPanel();
      }
    } else {
      // First or second point
      if (
        appState.points.length === 0 ||
        utils.distance(
          snappedModelPos,
          appState.points[appState.points.length - 1]
        ) > config.EPSILON
      ) {
        appState.points.push(snappedModelPos);
        appState.isDrawing = true;
        saveHistoryState('Add point');
        updateContextualPanel();
      }
    }

    // Reset processing flag
    appState.isProcessingClick = false;
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
      // Ensure stairs layer is unlocked so they render
      if (!appState.unlockedLayers.stairs) {
        appState.unlockedLayers.stairs = true;
      }
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

  // Vertex dragging - update vertex position
  if (appState.vertexEditMode === 'dragging' && appState.draggedVertexIndex >= 0) {
    // Snap to 1-foot grid (simple grid snap, no angle constraints for vertex editing)
    const footGridStep = config.PIXELS_PER_FOOT; // 24 pixels = 1 foot
    const snappedX = Math.round(modelMouse.x / footGridStep) * footGridStep;
    const snappedY = Math.round(modelMouse.y / footGridStep) * footGridStep;
    const snappedPos = { x: snappedX, y: snappedY };
    appState.points[appState.draggedVertexIndex] = snappedPos;

    // Update closing point if dragging first vertex
    if (appState.draggedVertexIndex === 0) {
      appState.points[appState.points.length - 1] = { ...snappedPos };
    }

    redrawApp();
    return;
  }

  // Edge dragging - move both connected vertices perpendicular to edge
  if (appState.vertexEditMode === 'edge-dragging' && appState.draggedEdgeIndex >= 0) {
    const edgeIdx = appState.draggedEdgeIndex;
    const p1Idx = edgeIdx;
    const p2Idx = (edgeIdx + 1) % (appState.points.length - 1);

    // Get edge direction and perpendicular
    const edgeDx = appState.edgeDragStartP2.x - appState.edgeDragStartP1.x;
    const edgeDy = appState.edgeDragStartP2.y - appState.edgeDragStartP1.y;
    const edgeLength = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy);

    if (edgeLength > config.EPSILON) {
      // Perpendicular direction (normalized)
      const perpX = -edgeDy / edgeLength;
      const perpY = edgeDx / edgeLength;

      // Calculate mouse movement along perpendicular
      const mouseDx = modelMouse.x - appState.edgeDragStartMouse.x;
      const mouseDy = modelMouse.y - appState.edgeDragStartMouse.y;
      const perpDist = mouseDx * perpX + mouseDy * perpY;

      // Move both vertices perpendicular to edge
      const newP1 = {
        x: appState.edgeDragStartP1.x + perpDist * perpX,
        y: appState.edgeDragStartP1.y + perpDist * perpY
      };
      const newP2 = {
        x: appState.edgeDragStartP2.x + perpDist * perpX,
        y: appState.edgeDragStartP2.y + perpDist * perpY
      };

      // Snap to 1-foot grid (simple grid snap for edge editing)
      const footGridStep = config.PIXELS_PER_FOOT;
      const snappedP1 = {
        x: Math.round(newP1.x / footGridStep) * footGridStep,
        y: Math.round(newP1.y / footGridStep) * footGridStep
      };
      const snappedP2 = {
        x: Math.round(newP2.x / footGridStep) * footGridStep,
        y: Math.round(newP2.y / footGridStep) * footGridStep
      };

      appState.points[p1Idx] = snappedP1;
      appState.points[p2Idx] = snappedP2;

      // Update closing point if dragging edge that includes first vertex
      if (p1Idx === 0) {
        appState.points[appState.points.length - 1] = { ...snappedP1 };
      }
    }

    redrawApp();
    return;
  }

  // Vertex/edge hover detection (only when shape edit mode is active)
  // Allow during wall selection - edit mode temporarily pauses wall selection
  if (appState.isShapeClosed &&
      appState.shapeEditMode &&
      !appState.stairPlacementMode &&
      !appState.isDraggingStairs &&
      appState.wizardStep === 'draw') {

    // Icon detection constants
    const iconRadius = 9;
    const iconHitRadius = iconRadius * 1.8; // Slightly larger hit area
    const iconOffsetX = 14;
    const iconOffsetY = -14;
    const scale = appState.viewportScale;
    const canDelete = appState.points.length > 5;

    // Check icon hovers FIRST (icons have priority for clicks)
    let newHoveredIconType = null;
    let iconVertexIndex = -1;
    let iconEdgeIndex = -1;

    // Check delete icons near all vertices
    if (canDelete) {
      for (let i = 0; i < appState.points.length - 1; i++) {
        const p = appState.points[i];
        const vertexViewX = (p.x + appState.viewportOffsetX) * scale;
        const vertexViewY = (p.y + appState.viewportOffsetY) * scale;
        const iconX = vertexViewX + iconOffsetX;
        const iconY = vertexViewY + iconOffsetY;
        const dx = viewMouseX - iconX;
        const dy = viewMouseY - iconY;
        if (dx * dx + dy * dy <= iconHitRadius * iconHitRadius) {
          newHoveredIconType = 'delete';
          iconVertexIndex = i;
          break;
        }
      }
    }

    // Check add icons at all edge midpoints (only if no delete icon hovered)
    if (!newHoveredIconType) {
      for (let i = 0; i < appState.points.length - 1; i++) {
        const p1 = appState.points[i];
        const p2 = appState.points[(i + 1) % (appState.points.length - 1)];
        const midX = ((p1.x + p2.x) / 2 + appState.viewportOffsetX) * scale;
        const midY = ((p1.y + p2.y) / 2 + appState.viewportOffsetY) * scale;
        const iconX = midX + iconOffsetX;
        const iconY = midY + iconOffsetY;
        const dx = viewMouseX - iconX;
        const dy = viewMouseY - iconY;
        if (dx * dx + dy * dy <= iconHitRadius * iconHitRadius) {
          newHoveredIconType = 'add';
          iconEdgeIndex = i;
          break;
        }
      }
    }

    // Determine vertex/edge hover based on icon or direct hover
    let newHoveredVertex = -1;
    let newHoveredEdge = -1;

    if (newHoveredIconType === 'delete') {
      newHoveredVertex = iconVertexIndex;
    } else if (newHoveredIconType === 'add') {
      newHoveredEdge = iconEdgeIndex;
    } else {
      // No icon hover - check vertex/edge directly
      newHoveredVertex = findNearestVertex(modelMouse, 15);
      newHoveredEdge = newHoveredVertex === -1 ? findNearestEdge(modelMouse, 10) : -1;
    }

    // Update state if changed
    if (newHoveredVertex !== appState.hoveredVertexIndex ||
        newHoveredEdge !== appState.hoveredEdgeIndex ||
        newHoveredIconType !== appState.hoveredIconType) {
      appState.hoveredVertexIndex = newHoveredVertex;
      appState.hoveredEdgeIndex = newHoveredEdge;
      appState.hoveredIconType = newHoveredIconType;

      // Update cursor based on what's hovered
      if (deckCanvas) {
        if (newHoveredIconType === 'delete') {
          deckCanvas.style.cursor = 'pointer';
        } else if (newHoveredIconType === 'add') {
          deckCanvas.style.cursor = 'cell';
        } else if (newHoveredVertex >= 0) {
          deckCanvas.style.cursor = 'grab';
        } else if (newHoveredEdge >= 0) {
          deckCanvas.style.cursor = 'move';
        } else {
          deckCanvas.style.cursor = 'default';
        }
      }

      redrawApp();
      return;
    }
  } else {
    // Reset vertex hover state when not in Draw step
    if (appState.hoveredVertexIndex !== -1 || appState.hoveredEdgeIndex !== -1 || appState.hoveredIconType !== null) {
      appState.hoveredVertexIndex = -1;
      appState.hoveredEdgeIndex = -1;
      appState.hoveredIconType = null;
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
    appState.hoveredStairIndex !== -1 ||
    (appState.isMeasureMode && appState.measurePoint1 && !appState.measurePoint2) // Preview measurement line
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

  // In stair placement mode, check if clicking on existing stair to drag it
  if (appState.stairPlacementMode && appState.stairs.length > 0) {
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

  if (
    appState.isDrawing ||
    appState.stairPlacementMode ||
    appState.isDraggingStairs
  )
    return;

  // Skip other mousedown handling during wall selection (unless in edit mode)
  if (appState.wallSelectionMode && !appState.shapeEditMode)
    return;

  // Start vertex dragging (only when not clicking on an icon)
  if (appState.hoveredVertexIndex >= 0 &&
      appState.isShapeClosed &&
      appState.shapeEditMode &&
      !appState.hoveredIconType &&
      appState.wizardStep === 'draw') {
    appState.vertexEditMode = 'dragging';
    appState.draggedVertexIndex = appState.hoveredVertexIndex;
    appState.selectedVertexIndex = appState.hoveredVertexIndex;
    if (deckCanvas) deckCanvas.style.cursor = 'grabbing';
    event.preventDefault();
    redrawApp();
    return;
  }

  // Start edge dragging (move both connected vertices perpendicular to edge)
  if (appState.hoveredEdgeIndex >= 0 &&
      appState.isShapeClosed &&
      appState.shapeEditMode &&
      !appState.hoveredIconType &&
      appState.wizardStep === 'draw') {
    appState.vertexEditMode = 'edge-dragging';
    appState.draggedEdgeIndex = appState.hoveredEdgeIndex;
    // Store initial positions for both vertices
    const p1 = appState.points[appState.hoveredEdgeIndex];
    const p2Idx = (appState.hoveredEdgeIndex + 1) % (appState.points.length - 1);
    const p2 = appState.points[p2Idx];
    appState.edgeDragStartP1 = { ...p1 };
    appState.edgeDragStartP2 = { ...p2 };
    appState.edgeDragStartMouse = { ...modelMouse };
    if (deckCanvas) deckCanvas.style.cursor = 'move';
    event.preventDefault();
    redrawApp();
    return;
  }

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

  // Flag to prevent click after vertex/edge drag
  appState.wasEditingOnMouseUp = (appState.vertexEditMode === 'dragging' || appState.vertexEditMode === 'edge-dragging');

  if (appState.isPanning) {
    appState.isPanning = false;
    if (deckCanvas) deckCanvas.style.cursor = "default"; // Or "grab" if pannable mode is toggleable
    redrawApp(); // May not be needed if mousemove already redrew
  }

  // Complete vertex dragging
  if (appState.vertexEditMode === 'dragging') {
    appState.vertexEditMode = null;
    appState.draggedVertexIndex = -1;
    if (deckCanvas) deckCanvas.style.cursor = appState.hoveredVertexIndex >= 0 ? 'grab' : 'default';

    // Recalculate shape after edit
    recalculateShapeAfterEdit();

    // Save to history
    saveHistoryState('Move vertex');

    redrawApp();
  }

  // Complete edge dragging
  if (appState.vertexEditMode === 'edge-dragging') {
    appState.vertexEditMode = null;
    appState.draggedEdgeIndex = -1;
    appState.edgeDragStartP1 = null;
    appState.edgeDragStartP2 = null;
    appState.edgeDragStartMouse = null;
    if (deckCanvas) deckCanvas.style.cursor = appState.hoveredEdgeIndex >= 0 ? 'ew-resize' : 'default';

    // Recalculate shape after edit
    recalculateShapeAfterEdit();

    // Save to history
    saveHistoryState('Move edge');

    redrawApp();
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
  const summaryList = document.getElementById('reviewSummaryList');
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

// --- Add to Cart Handler (Shopify Integration) ---
async function handleAddToCart() {
  if (!shopifyService.isLoaded()) {
    alert("Shopify is not available. Please try again in a moment.");
    return;
  }

  if (!appState.bom || appState.bom.length === 0) {
    alert("No materials to add. Please generate a deck plan first.");
    return;
  }

  const addToCartBtn = document.getElementById("addToCartBtn");

  // Show loading state
  const originalText = addToCartBtn.innerHTML;
  addToCartBtn.innerHTML = `
    <svg class="animate-spin w-4 h-4 inline-block mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    Creating Cart...
  `;
  addToCartBtn.disabled = true;

  try {
    // Filter items that have Shopify variant IDs
    const shopifyItems = appState.bom.filter(item =>
      item.shopifyVariantId && item.shopifyStatus === 'available' && item.qty > 0
    );

    if (shopifyItems.length === 0) {
      alert("No items in the BOM are available in Shopify. Please ensure your Shopify products have matching SKUs (system_id values).");
      return;
    }

    // Create checkout
    const checkout = await shopifyService.createCheckout(shopifyItems);

    // Open checkout in new tab
    window.open(checkout.webUrl, '_blank');

    uiController.updateCanvasStatus(`Cart created with ${shopifyItems.length} items. Opening checkout...`);

  } catch (error) {
    console.error("Error creating checkout:", error);
    alert(`Error creating cart: ${error.message}`);
  } finally {
    // Restore button state
    addToCartBtn.innerHTML = originalText;
    addToCartBtn.disabled = false;
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

// --- Measurement Tool Toggle ---
function handleMeasureToolToggle() {
  const btn = document.getElementById('measureToolBtn');

  // Toggle measurement mode
  appState.isMeasureMode = !appState.isMeasureMode;

  // Clear any existing measurement points when toggling
  appState.measurePoint1 = null;
  appState.measurePoint2 = null;

  // Update button appearance
  if (appState.isMeasureMode) {
    btn.classList.add('btn-primary');
    btn.classList.remove('btn-secondary');
    uiController.updateCanvasStatus("Measure mode: Click two points to measure distance");

    // Change cursor to crosshair
    const canvas = document.getElementById('deckCanvas');
    if (canvas) canvas.style.cursor = 'crosshair';
  } else {
    btn.classList.add('btn-secondary');
    btn.classList.remove('btn-primary');
    uiController.updateCanvasStatus("Measure mode disabled");

    // Reset cursor
    const canvas = document.getElementById('deckCanvas');
    if (canvas) canvas.style.cursor = '';
  }

  redrawApp();
}

// --- Measurement Tool Click Handler ---
function handleMeasureClick(modelX, modelY) {
  if (!appState.isMeasureMode) return false;

  // Snap to grid for precise measurement
  const snappedPos = canvasLogic.getSnappedPos(modelX, modelY, [], false, false, false);

  if (!appState.measurePoint1) {
    // Set first point
    appState.measurePoint1 = { x: snappedPos.x, y: snappedPos.y };
    uiController.updateCanvasStatus("Measure mode: Click second point");
  } else if (!appState.measurePoint2) {
    // Set second point and calculate distance
    appState.measurePoint2 = { x: snappedPos.x, y: snappedPos.y };

    // Calculate and display the distance
    const dx = appState.measurePoint2.x - appState.measurePoint1.x;
    const dy = appState.measurePoint2.y - appState.measurePoint1.y;
    const distancePixels = Math.sqrt(dx * dx + dy * dy);
    const distanceFeet = distancePixels / config.PIXELS_PER_FOOT;
    const formattedDistance = utils.formatFeetInches(distanceFeet);

    uiController.updateCanvasStatus(`Distance: ${formattedDistance} - Click to start new measurement`);
  } else {
    // Clear and start new measurement
    appState.measurePoint1 = { x: snappedPos.x, y: snappedPos.y };
    appState.measurePoint2 = null;
    uiController.updateCanvasStatus("Measure mode: Click second point");
  }

  redrawApp();
  return true; // Indicate we handled the click
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

  // Initialize Shopify integration (async, non-blocking)
  shopifyService.initializeShopify().then(result => {
    if (result.success) {
      console.log(`Shopify loaded: ${result.productCount} products`);

      // Show the Add to Cart button when Shopify is available
      const addToCartBtn = document.getElementById("addToCartBtn");
      if (addToCartBtn) addToCartBtn.classList.remove("hidden");

      // If BOM is already displayed, refresh it with Shopify prices
      if (appState.bom && appState.bom.length > 0) {
        appState.bom = shopifyService.enrichBomWithShopifyData(appState.bom);
        uiController.populateBOMTable(appState.bom);
      }
    } else {
      console.warn('Shopify integration not available:', result.reason || result.error);
    }
  });

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

  // Add to Cart button (Shopify integration)
  const addToCartBtn = document.getElementById("addToCartBtn");
  if (addToCartBtn) addToCartBtn.addEventListener("click", handleAddToCart);

  if (zoomInBtn) zoomInBtn.addEventListener("click", () => handleZoom(true));
  if (zoomOutBtn) zoomOutBtn.addEventListener("click", () => handleZoom(false));
  if (centerFitBtn) centerFitBtn.addEventListener("click", handleCenterFit);
  if (blueprintToggleBtn) blueprintToggleBtn.addEventListener("click", handleBlueprintToggle);
  const measureToolBtn = document.getElementById("measureToolBtn");
  if (measureToolBtn) measureToolBtn.addEventListener("click", handleMeasureToolToggle);
  if (toggleDecompositionBtn) toggleDecompositionBtn.addEventListener("click", handleToggleDecomposition);

  // Add dimension input button event listeners
  if (applyDimensionBtn) applyDimensionBtn.addEventListener("click", handleDimensionInputApply);
  if (cancelDimensionBtn) cancelDimensionBtn.addEventListener("click", handleDimensionInputCancel);

  document.addEventListener("keydown", handleKeyDown);
  window.addEventListener("beforeprint", beforePrintHandler);
  window.addEventListener("afterprint", afterPrintHandler);

  // Initialize visual selectors
  initializeVisualSelectors();

  // Initialize wizard step navigation
  initializeWizard();

  resetAppState();
  updateContextualPanel(); // Initialize contextual panel (legacy - will be replaced by wizard)

  // PROGRESSIVE RENDERING: Set initial BOM visibility based on wizard step
  updateBOMVisibility(appState.wizardStep);

  console.log("Deck Calculator App Initialized with Wizard-based workflow.");
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

  // Also get wizard elements
  const wizardStairList = document.getElementById('wizardStairListItems');
  const wizardStairCount = document.getElementById('wizardStairCount');

  // Update stair count
  const count = appState.stairs.length;
  const countText = count === 1 ? '1 set' : `${count} sets`;

  // Update main panel elements if they exist
  if (stairCount) stairCount.textContent = countText;

  // Update wizard elements if they exist
  if (wizardStairCount) wizardStairCount.textContent = countText;

  // Don't automatically show/hide the section - let the toggle button control visibility

  // Clear and repopulate main stair list
  if (stairList) {
    stairList.innerHTML = '';
    appState.stairs.forEach((stair, index) => {
      const stairItem = createStairListItem(stair, index);
      stairList.appendChild(stairItem);
    });
  }

  // Clear and repopulate wizard stair list
  if (wizardStairList) {
    wizardStairList.innerHTML = '';
    if (count === 0) {
      wizardStairList.innerHTML = '<p class="text-gray-500 text-sm">Click on a deck edge to add stairs</p>';
    } else {
      appState.stairs.forEach((stair, index) => {
        const stairItem = createStairListItem(stair, index);
        wizardStairList.appendChild(stairItem);
      });
    }
  }
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

// Track current draw input method
// Note: drawInputMode removed - all input methods are now always visible

// Vertex editing state
appState.shapeEditMode = false;       // Whether shape edit mode is active (button-triggered)
appState.vertexEditMode = null;       // 'dragging' | 'edge-dragging' | null
appState.selectedVertexIndex = -1;    // Currently selected vertex
appState.draggedEdgeIndex = -1;       // Index of edge being dragged
appState.draggedVertexIndex = -1;     // Currently dragged vertex
appState.hoveredVertexIndex = -1;     // Vertex under mouse
appState.hoveredEdgeIndex = -1;       // Edge under mouse (for add vertex)
appState.hoveredIconType = null;      // 'delete' | 'add' | null - which icon is being hovered

// Note: selectDrawMethod removed - all input methods are now always visible

// Create rectangle from dimension inputs
window.createRectangleFromDimensions = function() {
  const widthInput = document.getElementById('deckWidthInput');
  const depthInput = document.getElementById('deckDepthInput');

  const width = parseFloat(widthInput?.value) || 16;
  const depth = parseFloat(depthInput?.value) || 12;

  // Validate dimensions
  if (width < 4 || depth < 4) {
    uiController.updateCanvasStatus('Deck must be at least 4\' x 4\'');
    return;
  }

  if (width > 100 || depth > 100) {
    uiController.updateCanvasStatus('Deck dimensions cannot exceed 100\'');
    return;
  }

  // Clear history for fresh start
  clearHistory();

  // Clear current state
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

  // Create rectangle points (in feet, then convert to pixels)
  const offsetX = 5; // 5 feet from left edge
  const offsetY = 5; // 5 feet from top edge

  const points = [
    { x: 0, y: 0 },      // Top-left
    { x: 0, y: depth },  // Bottom-left
    { x: width, y: depth }, // Bottom-right
    { x: width, y: 0 },  // Top-right
  ];

  points.forEach(pt => {
    appState.points.push({
      x: (pt.x + offsetX) * config.PIXELS_PER_FOOT,
      y: (pt.y + offsetY) * config.PIXELS_PER_FOOT
    });
  });

  // Close the shape by adding first point at end
  appState.points.push({ ...appState.points[0] });
  appState.isShapeClosed = true;
  appState.isDrawing = false;

  // Calculate deck dimensions
  calculateAndUpdateDeckDimensions();

  // Center and fit the shape in viewport
  centerAndFitShape();

  // Reset UI
  uiController.resetUIOutputs();
  uiController.toggleStairsInputSection(false);

  // Check if we need wall selection based on attachment type
  const currentAttachmentType = getAttachmentType();
  if (currentAttachmentType === 'house_rim') {
    appState.wallSelectionMode = true;
    appState.currentPanelMode = 'wall-selection';
    showContextualPanel('wall-selection');
    uiController.updateCanvasStatus(
      `${width}' x ${depth}' deck created. Click wall edge(s) to mark as ledger attachment.`
    );
  } else {
    appState.wallSelectionMode = false;
    decomposeClosedShape();
    triggerAutoCalculation();
    uiController.updateCanvasStatus(
      `${width}' x ${depth}' deck created. Framing plan generated.`
    );
  }

  // Update the wizard Next button state
  updateWizardNextButton(appState.wizardStep);

  // Save initial state for undo
  saveHistoryState('Create deck from dimensions');

  redrawApp();

  console.log(`Rectangle ${width}' x ${depth}' created from dimension input`);
};

// ================================================
// VERTEX EDITING FUNCTIONS
// ================================================

// Find nearest vertex to model position (within tolerance in pixels)
function findNearestVertex(modelPos, tolerancePixels) {
  if (!appState.isShapeClosed || appState.points.length < 4) return -1;

  const tolerance = tolerancePixels / appState.viewportScale;

  // Check all vertices except the closing duplicate
  for (let i = 0; i < appState.points.length - 1; i++) {
    const dx = modelPos.x - appState.points[i].x;
    const dy = modelPos.y - appState.points[i].y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < tolerance) {
      return i;
    }
  }
  return -1;
}

// Find nearest edge to model position (within tolerance in pixels)
function findNearestEdge(modelPos, tolerancePixels) {
  if (!appState.isShapeClosed || appState.points.length < 4) return -1;

  const tolerance = tolerancePixels / appState.viewportScale;

  // Check all edges
  for (let i = 0; i < appState.points.length - 1; i++) {
    const p1 = appState.points[i];
    const p2 = appState.points[(i + 1) % (appState.points.length - 1)];

    // Calculate distance from point to line segment
    const dist = pointToLineSegmentDistance(modelPos, p1, p2);
    if (dist < tolerance && dist !== Infinity) {
      return i;
    }
  }
  return -1;
}

// Calculate distance from point to line segment
function pointToLineSegmentDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq < config.EPSILON) return Infinity;

  // Project point onto line, clamped to segment
  let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  // Find nearest point on segment
  const nearestX = lineStart.x + t * dx;
  const nearestY = lineStart.y + t * dy;

  // Don't count if too close to endpoints (within 15% of edge)
  if (t < 0.15 || t > 0.85) return Infinity;

  // Return distance to nearest point
  const distX = point.x - nearestX;
  const distY = point.y - nearestY;
  return Math.sqrt(distX * distX + distY * distY);
}

// Insert a new vertex on an edge
function insertVertexOnEdge(edgeIndex, clickModelPos) {
  const p1 = appState.points[edgeIndex];
  const p2 = appState.points[(edgeIndex + 1) % (appState.points.length - 1)];

  // Project click position onto edge
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq < config.EPSILON) return false;

  let t = ((clickModelPos.x - p1.x) * dx + (clickModelPos.y - p1.y) * dy) / lengthSq;
  t = Math.max(0.1, Math.min(0.9, t)); // Keep away from endpoints

  // Calculate new point position on the edge
  const newX = p1.x + t * dx;
  const newY = p1.y + t * dy;

  // Snap to grid - for vertex insertion, just snap to 1-inch grid without angle constraints
  const GSP = config.GRID_SPACING_PIXELS;
  const snappedPoint = {
    x: Math.round(newX / GSP) * GSP,
    y: Math.round(newY / GSP) * GSP
  };

  // Insert new point after edgeIndex
  appState.points.splice(edgeIndex + 1, 0, snappedPoint);

  // Update closing point
  appState.points[appState.points.length - 1] = { ...appState.points[0] };

  return true;
}

// Remove a vertex from the shape
function removeVertex(vertexIndex) {
  // Minimum 4 unique vertices (5 with closing point)
  if (appState.points.length <= 5) {
    uiController.updateCanvasStatus('Cannot remove vertex: shape must have at least 4 vertices.');
    return false;
  }

  // Remove the vertex
  appState.points.splice(vertexIndex, 1);

  // Update closing point
  if (vertexIndex === 0) {
    // If we removed the first point, update the closing point
    appState.points[appState.points.length - 1] = { ...appState.points[0] };
  }

  // Reset selection state
  appState.selectedVertexIndex = -1;
  appState.hoveredVertexIndex = -1;

  return true;
}

// Recalculate shape after vertex edit
function recalculateShapeAfterEdit() {
  // Update closing point to match first point
  if (appState.points.length > 1) {
    appState.points[appState.points.length - 1] = { ...appState.points[0] };
  }

  // Validate shape
  const validation = shapeValidator.validateShape(appState.points);
  if (!validation.isValid) {
    uiController.updateCanvasStatus(`Warning: ${validation.error}`);
  }

  // Recalculate dimensions
  calculateAndUpdateDeckDimensions();

  // Clear selected walls after editing since edges have changed
  // User needs to reselect ledger walls after shape modification
  if (appState.selectedWallIndices.length > 0) {
    appState.selectedWallIndices = [];
    appState.rectangularSections = [];
    uiController.updateCanvasStatus('Shape modified. Please reselect ledger walls.');
  }

  // Keep wall selection mode active if it was before
  // (user still needs to select walls for ledger attachment)
}

// Reset vertex editing state
function resetVertexEditState() {
  appState.vertexEditMode = null;
  appState.selectedVertexIndex = -1;
  appState.draggedVertexIndex = -1;
  appState.hoveredVertexIndex = -1;
  appState.hoveredEdgeIndex = -1;
  appState.hoveredIconType = null;
  appState.draggedEdgeIndex = -1;
  appState.edgeDragStartP1 = null;
  appState.edgeDragStartP2 = null;
  appState.edgeDragStartMouse = null;
  appState.wasEditingOnMouseUp = false;
}

// Draw vertex edit handles on canvas
function drawVertexEditHandles(ctx) {
  if (!appState.isShapeClosed || appState.points.length < 4) return;
  if (appState.stairPlacementMode) return;
  if (appState.wizardStep !== 'draw') return; // Only show handles in Draw step
  if (!appState.shapeEditMode) return; // Only show when edit mode is active

  const scale = appState.viewportScale;
  const offsetX = appState.viewportOffsetX;
  const offsetY = appState.viewportOffsetY;
  const canDelete = appState.points.length > 5; // Need at least 4 unique vertices (5 with closing point)

  // Helper to convert model coords to screen coords
  // Canvas transform: translate(offset) then scale, so screenPos = modelPos * scale + offset
  const toScreen = (x, y) => ({
    x: x * scale + offsetX,
    y: y * scale + offsetY
  });

  // Draw vertex handles
  for (let i = 0; i < appState.points.length - 1; i++) {
    const p = appState.points[i];
    const screenPos = toScreen(p.x, p.y);
    const viewX = screenPos.x;
    const viewY = screenPos.y;

    const isHovered = i === appState.hoveredVertexIndex;
    const isSelected = i === appState.selectedVertexIndex;
    const isDragging = i === appState.draggedVertexIndex;

    // Outer glow for hovered/selected
    if (isHovered || isSelected || isDragging) {
      ctx.beginPath();
      ctx.arc(viewX, viewY, 12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(45, 106, 106, 0.2)';
      ctx.fill();
    }

    // Main handle circle
    ctx.beginPath();
    ctx.arc(viewX, viewY, isHovered ? 8 : 6, 0, Math.PI * 2);
    ctx.fillStyle = isDragging ? '#1a5050' : '#2d6a6a';
    ctx.fill();

    // Border
    ctx.strokeStyle = isSelected ? '#f59e0b' : '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw delete icon (×) offset from hovered vertex (only if we can delete)
    if (isHovered && canDelete) {
      const iconOffsetX = 14;
      const iconOffsetY = -14;
      const iconX = viewX + iconOffsetX;
      const iconY = viewY + iconOffsetY;
      const iconRadius = 9;
      const isIconHovered = appState.hoveredIconType === 'delete';

      // Icon background
      ctx.beginPath();
      ctx.arc(iconX, iconY, iconRadius, 0, Math.PI * 2);
      ctx.fillStyle = isIconHovered ? '#dc2626' : '#ef4444';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw × sign
      ctx.beginPath();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.moveTo(iconX - 4, iconY - 4);
      ctx.lineTo(iconX + 4, iconY + 4);
      ctx.moveTo(iconX + 4, iconY - 4);
      ctx.lineTo(iconX - 4, iconY + 4);
      ctx.stroke();
    }
  }

  // Draw edge highlight and plus icon
  if (appState.hoveredEdgeIndex >= 0 && appState.hoveredVertexIndex === -1) {
    const i = appState.hoveredEdgeIndex;
    const p1 = appState.points[i];
    const p2 = appState.points[(i + 1) % (appState.points.length - 1)];

    const p1View = toScreen(p1.x, p1.y);
    const p2View = toScreen(p2.x, p2.y);
    const midX = (p1View.x + p2View.x) / 2;
    const midY = (p1View.y + p2View.y) / 2;

    // Highlight edge for dragging
    ctx.beginPath();
    ctx.moveTo(p1View.x, p1View.y);
    ctx.lineTo(p2View.x, p2View.y);
    ctx.strokeStyle = '#2d6a6a';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Draw move indicator at midpoint
    ctx.beginPath();
    ctx.arc(midX, midY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#2d6a6a';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw plus icon offset from edge midpoint for adding vertex
    const iconOffsetX = 14;
    const iconOffsetY = -14;
    const iconX = midX + iconOffsetX;
    const iconY = midY + iconOffsetY;
    const iconRadius = 9;
    const isIconHovered = appState.hoveredIconType === 'add';

    // Icon background
    ctx.beginPath();
    ctx.arc(iconX, iconY, iconRadius, 0, Math.PI * 2);
    ctx.fillStyle = isIconHovered ? '#059669' : '#10b981';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw + sign
    ctx.beginPath();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.moveTo(iconX - 4, iconY);
    ctx.lineTo(iconX + 4, iconY);
    ctx.moveTo(iconX, iconY - 4);
    ctx.lineTo(iconX, iconY + 4);
    ctx.stroke();
  }
}

// Expose drawVertexEditHandles for canvasLogic
window.drawVertexEditHandles = drawVertexEditHandles;

// Toggle shape edit mode
window.toggleShapeEditMode = function() {
  appState.shapeEditMode = !appState.shapeEditMode;

  // Update button appearance
  const editBtn = document.getElementById('editShapeBtn');
  const editHint = document.getElementById('editShapeHint');
  const addRemoveBtn = document.getElementById('addRemoveBtn');

  if (editBtn) {
    editBtn.classList.toggle('active', appState.shapeEditMode);
    editBtn.querySelector('span').textContent = appState.shapeEditMode ? 'Done Editing' : 'Edit Shape';
  }

  if (editHint) {
    editHint.classList.toggle('hidden', !appState.shapeEditMode);
  }

  // Reset vertex edit state when exiting edit mode
  if (!appState.shapeEditMode) {
    resetVertexEditState();
  }

  // Update canvas status
  if (appState.shapeEditMode) {
    uiController.updateCanvasStatus('Edit mode: Drag to move, click icons to add/remove points.');
  } else {
    uiController.updateCanvasStatus('Shape editing complete.');
  }

  redrawApp();
};

// Show/hide draw step panels based on shape state
function updateEditShapePanelVisibility() {
  const editPanel = document.getElementById('editShapePanel');
  const instructionsPanel = document.getElementById('drawInstructionsPanel');
  const dimensionsPanel = document.getElementById('quickDimensionsPanel');
  const templatePanel = document.getElementById('templatePanel');
  const wallSelectionPanel = document.getElementById('drawStepWallSelection');

  // Hide input panels when shape is closed (regardless of wall selection mode)
  const hasClosedShape = appState.isShapeClosed && appState.wizardStep === 'draw';

  // Show edit panel when shape is closed and in Draw step
  // (allow editing even during wall selection - edit mode will temporarily pause wall selection)
  const canEditShape = hasClosedShape;

  // Wall selection mode is active when shape is closed and we need wall selection
  const showWallSelection = hasClosedShape && appState.wallSelectionMode && !appState.shapeEditMode;

  // Toggle visibility - show input panels when no shape, hide when shape exists
  if (instructionsPanel) instructionsPanel.classList.toggle('hidden', hasClosedShape);
  if (dimensionsPanel) dimensionsPanel.classList.toggle('hidden', hasClosedShape);
  if (templatePanel) templatePanel.classList.toggle('hidden', hasClosedShape);

  // Edit panel shows whenever shape is closed
  if (editPanel) editPanel.classList.toggle('hidden', !canEditShape);

  // Wall selection panel shows when we need to select walls
  if (wallSelectionPanel) {
    wallSelectionPanel.classList.toggle('hidden', !showWallSelection);

    // Update wall selection instructions based on attachment type
    if (showWallSelection) {
      const attachmentType = getAttachmentType();
      const instructionBox = wallSelectionPanel.querySelector('.instruction-box p');
      if (instructionBox) {
        if (attachmentType === 'house_rim') {
          instructionBox.textContent = 'Click the wall edge(s) that will be attached to your house with a ledger board. You can select multiple parallel walls.';
        } else {
          // Floating deck or other type - select for joist orientation
          instructionBox.textContent = 'Click a wall edge to set the primary joist direction. Joists will run perpendicular to the selected wall.';
        }
      }
    }
  }

  // Update the hint text based on mode
  const editHint = document.getElementById('editShapeHint');
  if (editHint && appState.shapeEditMode) {
    // Note: Hint text is now set in HTML since we have unified edit mode
    // Just add wall selection note if applicable
    if (appState.wallSelectionMode) {
      editHint.innerHTML = 'Editing pauses wall selection. Drag corners to move • Drag edges to resize • Click <span class="icon-hint">+</span> to add point • Click <span class="icon-hint">×</span> to remove';
    }
  }
}

// Expose for external use
window.updateEditShapePanelVisibility = updateEditShapePanelVisibility;

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

  // Calculate deck dimensions
  calculateAndUpdateDeckDimensions();

  // Center and fit the shape in viewport
  centerAndFitShape();

  // Reset UI
  uiController.resetUIOutputs();
  uiController.toggleStairsInputSection(false);

  // Check if we need wall selection based on attachment type
  const currentAttachmentType = getAttachmentType();
  if (currentAttachmentType === 'house_rim') {
    // House rim (ledger) attachment requires wall selection
    appState.wallSelectionMode = true;
    appState.currentPanelMode = 'wall-selection';
    showContextualPanel('wall-selection');
    uiController.updateCanvasStatus(
      `Template "${template.name}" loaded. Click wall edge(s) to mark as ledger attachment.`
    );
  } else {
    // Non-ledger types don't need wall selection
    appState.wallSelectionMode = false;
    decomposeClosedShape();
    triggerAutoCalculation();
    uiController.updateCanvasStatus(
      `Template "${template.name}" loaded. Framing plan generated.`
    );
  }

  // Update the wizard Next button state
  updateWizardNextButton(appState.wizardStep);

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

// Debounce tracking for history saves
let lastHistorySaveTime = 0;
let lastHistoryStateHash = '';
const HISTORY_DEBOUNCE_MS = 100; // Minimum ms between saves

// Helper to create a simple hash of current state for duplicate detection
function getStateHash() {
  return JSON.stringify({
    points: appState.points.map(p => `${Math.round(p.x)},${Math.round(p.y)}`).join('|'),
    closed: appState.isShapeClosed,
    walls: appState.selectedWallIndices.join(','),
    stairs: appState.stairs.length
  });
}

// Save current state to history
window.saveHistoryState = function(actionName = 'action') {
  // Don't save during undo/redo operations
  if (appState.isUndoRedoAction) return;

  // Debounce: prevent rapid-fire saves (fixes infinite loop issue)
  const now = Date.now();
  if (now - lastHistorySaveTime < HISTORY_DEBOUNCE_MS) {
    return; // Skip this save, too soon after last one
  }

  // Duplicate detection: don't save if state hasn't changed
  const currentHash = getStateHash();
  if (currentHash === lastHistoryStateHash && appState.history.length > 0) {
    return; // Skip this save, state is identical
  }

  // Update tracking
  lastHistorySaveTime = now;
  lastHistoryStateHash = currentHash;

  // Create a snapshot of the relevant state
  const snapshot = {
    points: JSON.parse(JSON.stringify(appState.points)),
    isShapeClosed: appState.isShapeClosed,
    selectedWallIndices: [...appState.selectedWallIndices],
    stairs: JSON.parse(JSON.stringify(appState.stairs)),
    currentPanelMode: appState.currentPanelMode,
    actionName: actionName,
    timestamp: now
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
  // Reset debounce tracking
  lastHistorySaveTime = 0;
  lastHistoryStateHash = '';
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
    target: '#templatePanel',
    title: "Quick Start Templates",
    description: "Choose from pre-built deck shapes like Rectangle, L-Shape, or Wrap-Around to quickly start your design. Perfect for common deck layouts.",
    position: 'right'
  },
  {
    target: '#quickDimensionsPanel',
    title: "Quick Rectangle",
    description: "Enter width and depth to instantly create a rectangular deck. Great for simple deck designs when you know your dimensions.",
    position: 'right'
  },
  {
    target: '#canvasContainer',
    title: "Drawing Canvas",
    description: "This is where your deck takes shape. Click to place points and create your deck outline. The grid helps you align dimensions precisely.",
    position: 'left'
  },
  {
    target: '#wizardStepList',
    title: "Workflow Steps",
    description: "Follow these steps from Draw to Materials. Each step guides you through the deck planning process, from shape design to final cost estimate.",
    position: 'right'
  },
  {
    target: '#floatingLegend',
    title: "Layer Controls",
    description: "Show or hide different parts of your plan. Toggle visibility for outline, dimensions, ledger, joists, beams, blocking, and posts.",
    position: 'left'
  },
  {
    target: '#blueprintToggleBtn',
    title: "Blueprint View",
    description: "Switch to a professional blueprint-style view for a cleaner look. Great for sharing plans with contractors or for permit applications.",
    position: 'bottom'
  },
  {
    target: '#cutListModeBtn',
    title: "Cut List",
    description: "Generate a detailed cut list showing every piece of lumber needed with labels. Essential for accurate material purchasing and construction.",
    position: 'bottom'
  },
  {
    target: '#projectsBtn',
    title: "Save & Load Projects",
    description: "Save your deck designs to work on later, or load previously saved projects. Your projects are stored locally in your browser.",
    position: 'bottom'
  },
  {
    target: '#exportPdfBtn',
    title: "Export to PDF",
    description: "Generate a professional PDF of your deck plan including the framing layout, cut list, and bill of materials.",
    position: 'bottom'
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


