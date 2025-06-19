// uiController.js (v3 - Enhanced Summary)
// import { getParsedStockData } from "./dataManager.js"; // Not strictly needed for these changes
import { decimalToFraction, formatFeetInches } from "./utils.js";

// Store reference to current BOM data for editable functionality
let currentBOMData = null;


// --- DOM Element References ---
const deckSpecsForm = document.getElementById("deckSpecsForm");
const deckHeightFeetInput = document.getElementById("deckHeightFeet");
const deckHeightInchesInput = document.getElementById("deckHeightInchesInput");
const footingTypeSelect = document.getElementById("footingType");
const beamTypeSelect = document.getElementById("beamType");
const pictureFrameSelect = document.getElementById("pictureFrame");
const joistProtectionSelect = document.getElementById("joistProtection");

const stairsInputSection = document.getElementById("drawShape-stair-config");
const stairWidthSelect = document.getElementById("stairWidth");

// Framing menu stair configuration elements (removed from UI)

const bomSection = document.getElementById("bomSection");
const bomTableBody = document.getElementById("bomTableBody");
const summarySection = document.getElementById("summarySection");
const summaryList = document.getElementById("summaryList");

// --- BOM Interactive Functions ---
function createQuantityControls(item, globalIndex) {
  const isModified = item.qty !== item.originalQty;
  const modifiedClass = isModified ? 'qty-modified' : '';
  
  return `
    <div class="qty-controls ${modifiedClass}">
      <input 
        type="number" 
        class="qty-input ${modifiedClass}" 
        value="${item.qty || 0}" 
        min="0" 
        onchange="updateQuantity(${globalIndex}, this.value)"
        onblur="validateQuantity(${globalIndex}, this)"
        title="Use spinner controls or type quantity. Enter 0 to remove item."
      />
    </div>
    ${isModified ? `<div class="qty-original">Original: ${item.originalQty}</div>` : ''}
  `;
}

function updateQuantity(index, newValue) {
  if (!currentBOMData || index >= currentBOMData.length) return;
  
  const qty = Math.max(0, parseInt(newValue) || 0);
  
  // If quantity is 0, remove the item
  if (qty === 0) {
    currentBOMData.splice(index, 1);
  } else {
    currentBOMData[index].qty = qty;
  }
  
  // Update the app state
  updateAppStateBOM();
  
  // Refresh the BOM table
  populateBOMTable(currentBOMData);
}

function validateQuantity(index, input) {
  const value = parseInt(input.value) || 0;
  if (value < 0) {
    input.value = 0;
  }
  updateQuantity(index, value);
}

function resetAllQuantities() {
  if (!currentBOMData) return;
  
  if (confirm('Reset all quantities to original calculated values?')) {
    currentBOMData.forEach(item => {
      item.qty = item.originalQty;
    });
    
    // Update the app state
    updateAppStateBOM();
    
    // Refresh the BOM table
    populateBOMTable(currentBOMData);
  }
}

function updateAppStateBOM() {
  // Update the global app state if it exists
  if (window.appState && window.appState.bom) {
    window.appState.bom = [...currentBOMData];
  }
}

// Copy item name function
function copyItemName(itemText, iconElement) {
  // Use the modern clipboard API if available
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(itemText).then(() => {
      showCopyFeedback(iconElement);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      fallbackCopyTextToClipboard(itemText, iconElement);
    });
  } else {
    // Fallback for older browsers or non-secure contexts
    fallbackCopyTextToClipboard(itemText, iconElement);
  }
}

function fallbackCopyTextToClipboard(text, iconElement) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  
  // Avoid scrolling to bottom
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";
  
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    const successful = document.execCommand('copy');
    if (successful) {
      showCopyFeedback(iconElement);
    }
  } catch (err) {
    console.error('Fallback: Oops, unable to copy', err);
  }
  
  document.body.removeChild(textArea);
}

function showCopyFeedback(iconElement) {
  // Change icon temporarily to show success
  const originalSVG = iconElement.innerHTML;
  iconElement.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20,6 9,17 4,12"/>
    </svg>
  `;
  iconElement.style.color = '#10b981'; // Green color for success
  
  setTimeout(() => {
    iconElement.innerHTML = originalSVG;
    iconElement.style.color = ''; // Reset color
  }, 1000);
}


// Make functions globally available
window.updateQuantity = updateQuantity;
window.validateQuantity = validateQuantity;
window.resetAllQuantities = resetAllQuantities;
window.copyItemName = copyItemName;

// --- UI Update Functions ---
export function updateCanvasStatus(message) {
  // Console logging for debugging purposes
  console.log("UI Status Update:", message);
  
  // Send to the floating message system
  if (window.showFloatingMessage) {
    // Determine message type based on content
    let type = 'info';
    if (message.includes('Error:') || message.includes('error')) type = 'error';
    else if (message.includes('✅') || message.includes('Success') || message.includes('successfully')) type = 'success';
    else if (message.includes('⚠️') || message.includes('Warning') || message.includes('warning')) type = 'warning';
    else if (message.includes('🎯') || message.includes('MODE:')) type = 'info';
    
    window.showFloatingMessage(message, type);
  }
}

export function getFormInputs() {
  const formData = new FormData(deckSpecsForm);
  const inputs = {};
  let totalDeckHeightInches = 0;

  for (const [key, value] of formData.entries()) {
    inputs[key] = isNaN(value) || value === "" ? value : parseFloat(value);
  }

  const feet = parseInt(deckHeightFeetInput.value, 10) || 0;
  const inches = parseInt(deckHeightInchesInput.value, 10) || 0;
  totalDeckHeightInches = feet * 12 + inches;
  inputs["deckHeight"] = totalDeckHeightInches;
  inputs["deckHeightFormatted"] = formatFeetInches(totalDeckHeightInches / 12); // Store formatted

  delete inputs["deckHeightFeet"];
  delete inputs["deckHeightInchesInput"];

  if (stairsInputSection && !stairsInputSection.classList.contains("hidden")) {
    inputs["stairWidth"] = parseInt(stairWidthSelect.value, 10);
  } else {
    // Provide default width if stair section is not active
    inputs["stairWidth"] = parseInt(stairWidthSelect?.value || "6", 10);
  }
  
  // Get default structural values from Framing menu
  const defaultStringerTypeSelect = document.getElementById("defaultStringerType");
  const defaultLandingTypeSelect = document.getElementById("defaultLandingType");
  
  if (defaultStringerTypeSelect && defaultLandingTypeSelect) {
    inputs["stringerType"] = defaultStringerTypeSelect.value;
    inputs["landingType"] = defaultLandingTypeSelect.value;
  } else {
    // Fallback defaults if elements don't exist yet
    inputs["stringerType"] = "pylex_steel";
    inputs["landingType"] = "existing";
  }
  return inputs;
}

export function populateBOMTable(bomData, errorMessage = null, targetTableBody = null, targetBomSection = null) {
  // Use provided elements or fall back to defaults
  const tableBody = targetTableBody || window.bomTableBody || bomTableBody;
  const section = targetBomSection || window.bomSection || bomSection;
  
  if (!tableBody) return;
  
  tableBody.innerHTML = "";
  let totalCost = 0;

  if (errorMessage) {
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-500 py-4">${errorMessage}</td></tr>`;
    if (section) section.classList.remove("hidden");
    return;
  }

  if (!bomData || bomData.length === 0) {
    const msg = "No materials calculated. Generate a plan or add components.";
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-500 py-4">${msg}</td></tr>`;
    currentBOMData = null;
    return;
  }

  // Store current BOM data for editing
  currentBOMData = bomData.map(item => ({...item})); // Deep copy
  
  // Add global indices to all items for tracking
  currentBOMData.forEach((item, globalIndex) => {
    item.globalIndex = globalIndex;
    item.originalGlobalIndex = globalIndex;
  });

  // Display all items without categorization
  currentBOMData.forEach((item) => {
      const row = tableBody.insertRow();
      const cellQty = row.insertCell();
      const cellItem = row.insertCell();
      const cellDesc = row.insertCell();
      
      // We'll still create these cells but they'll be hidden by CSS
      const cellUnitPrice = row.insertCell();
      const cellTotalPrice = row.insertCell();

      // Store original quantity if not already stored
      if (item.originalQty === undefined) {
        item.originalQty = item.qty || 0;
      }

      const unitPrice = item.unitPrice || 0;
      const lineTotal = (item.qty || 0) * unitPrice;
      totalCost += lineTotal;

      // Create interactive quantity controls using global index
      const quantityHTML = createQuantityControls(item, item.globalIndex);
      cellQty.innerHTML = quantityHTML;
      cellQty.classList.add("qty-col");
      
      // Add data attribute for print quantity
      cellQty.setAttribute('data-print-qty', item.qty || 0);
      
      // Add copy icon and item text
      const itemText = item.item || "N/A";
      cellItem.innerHTML = `
        <span class="copy-icon" onclick="copyItemName('${itemText.replace(/'/g, "\\'")}', this)" title="Copy item name">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </span>
        ${itemText}
      `;
      cellDesc.textContent = item.description || "N/A";
      
      // Still set the text content but they'll be hidden
      cellUnitPrice.textContent = unitPrice.toLocaleString("en-CA", {
        style: "currency",
        currency: "CAD",
      });
      cellUnitPrice.classList.add("price-col");
      cellTotalPrice.textContent = lineTotal.toLocaleString("en-CA", {
        style: "currency",
        currency: "CAD",
      });
      cellTotalPrice.classList.add("price-col");
  });

  // We'll still create the total row but it'll be hidden by CSS
  const totalRow = tableBody.insertRow();
  totalRow.classList.add("font-semibold", "bg-gray-100");
  const labelCell = totalRow.insertCell();
  labelCell.colSpan = 4;
  labelCell.textContent = "Estimated Material Total:";
  labelCell.classList.add("text-right", "pr-4");
  const totalValCell = totalRow.insertCell();
  totalValCell.textContent = totalCost.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });
  totalValCell.classList.add("price-col");
  if (section) section.classList.remove("hidden");
}

export function populateSummaryCard(
  structure,
  inputs, // Now contains deckHeightFormatted
  deckDimensions,
  stairs,
  errorMsg = null
) {
  summaryList.innerHTML = "";

  if (errorMsg) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = "Error:";
    dd.textContent = errorMsg;
    dd.classList.add("text-red-600");
    summaryList.appendChild(dt);
    summaryList.appendChild(dd);
    summarySection.classList.remove("hidden");
    return;
  }

  if (!structure || !inputs || !deckDimensions) {
    summaryList.innerHTML = "<dt>Status:</dt><dd>Please generate a plan.</dd>";
    return;
  }

  const addSummaryItem = (label, value, isHtml = false) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = `${label}:`;
      if (isHtml) {
        dd.innerHTML = value;
      } else {
        dd.textContent = value;
      }
      summaryList.appendChild(dt);
      summaryList.appendChild(dd);
    }
  };

  // --- Deck Section ---
  addSummaryItem(
    "Deck Height",
    inputs.deckHeightFormatted || formatFeetInches(inputs.deckHeight / 12)
  );
  addSummaryItem(
    "Overall Dimensions",
    `${deckDimensions.widthFeet.toFixed(
      1
    )}' W x ${deckDimensions.heightFeet.toFixed(1)}' D`
  );
  addSummaryItem(
    "Total Area",
    `${(deckDimensions.widthFeet * deckDimensions.heightFeet).toFixed(
      1
    )} sq. ft.`
  );

  const joistInfo =
    structure.joists?.[0]?.size || structure.ledger?.size || "N/A";
  addSummaryItem("Joists", `${joistInfo} @ ${inputs.joistSpacing}" OC`);

  let beamTypeInputText =
    beamTypeSelect.options[beamTypeSelect.selectedIndex]?.text ||
    inputs.beamType;
  addSummaryItem("Beam Type", beamTypeInputText);

  let beamSummary = "N/A";
  if (structure.beams?.length > 0) {
    // The (Flush) or (Drop) is now part of the general Beam Type.
    // So, just show ply, size, and usage.
    beamSummary = structure.beams
      .map((b) => `${b.ply}-ply ${b.size} ${b.usage}`)
      .join("<br>");
  }
  addSummaryItem("Beams", beamSummary, true);

  if (structure.beams?.some((b) => b.usage === "Mid Beam")) {
    addSummaryItem("Note", "Mid-beam added due to deck depth.");
  }

  const postInfo = structure.posts?.[0]?.size || "N/A";
  addSummaryItem("Posts", postInfo);
  addSummaryItem(
    "Footings",
    footingTypeSelect.options[footingTypeSelect.selectedIndex]?.text ||
      inputs.footingType
  );

  let attachmentText = "N/A";
  if (inputs.attachmentType === "house_rim")
    attachmentText = "Ledger to House Rim";
  else if (inputs.attachmentType === "concrete")
    attachmentText = "To Concrete Foundation";
  else if (inputs.attachmentType === "floating")
    attachmentText = "Floating Deck";
  addSummaryItem("Attachment", attachmentText);

  addSummaryItem(
    "Picture Framing",
    pictureFrameSelect.options[pictureFrameSelect.selectedIndex]?.text || "N/A"
  );
  addSummaryItem(
    "Joist Protection",
    joistProtectionSelect.options[joistProtectionSelect.selectedIndex]?.text ||
      "N/A"
  );

  // --- Stairs Section ---
  if (stairs && stairs.length > 0) {
    const dtSpacer = document.createElement("dt"); // Create a dt for spacing
    dtSpacer.innerHTML = "&nbsp;"; // Non-breaking space for spacing
    summaryList.appendChild(dtSpacer);
    const ddSpacerForDt = document.createElement("dd"); // Corresponding dd for the spacer dt
    summaryList.appendChild(ddSpacerForDt);

    const dtStairHeader = document.createElement("dt");
    dtStairHeader.textContent = "Stairs:";
    // Make header span if using a grid, or just bold
    dtStairHeader.className = "font-semibold col-span-2 pt-2 border-t mt-2";
    summaryList.appendChild(dtStairHeader);
    // Add an empty dd to keep dt/dd pairs if your dl styling expects it
    const ddForStairHeader = document.createElement("dd");
    summaryList.appendChild(ddForStairHeader);

    stairs.forEach((stair, index) => {
      const riseInches = stair.calculatedRisePerStepInches || 0;
      const runInches = stair.calculatedRunPerStepInches || 10.5;
      const riseFractionStr = decimalToFraction(riseInches);
      const runFractionStr = decimalToFraction(runInches);

      let stairLabel = stairs.length > 1 ? `Stair ${index + 1}` : "Details";
      const dtSubHeader = document.createElement("dt");
      dtSubHeader.textContent = stairLabel;
      dtSubHeader.className = "font-medium text-gray-700 italic mt-1";
      summaryList.appendChild(dtSubHeader);
      const ddForSubHeader = document.createElement("dd"); // Corresponding dd
      summaryList.appendChild(ddForSubHeader);

      // Use existing addSummaryItem for indented items, or create new dd elements
      const addIndentedItem = (label, value) => {
        const dt = document.createElement("dt");
        const dd = document.createElement("dd");
        dt.textContent = `${label}:`;
        dt.style.paddingLeft = "1em"; // Indent label
        dd.textContent = value;
        dd.style.paddingLeft = "1em"; // Indent value
        summaryList.appendChild(dt);
        summaryList.appendChild(dd);
      };

      addIndentedItem("Width", `${stair.widthFt}' 0"`);
      addIndentedItem("Rise / Run", `${riseFractionStr}" / ${runFractionStr}"`);

      let stringerTypeText = "N/A";
      // Get text for stringer type
      const stringerTypeSelect = document.getElementById("stringerType");
      if (stringerTypeSelect) {
        const stringerTypeOption = Array.from(stringerTypeSelect.options).find(
          (opt) => opt.value === stair.stringerType
        );
        stringerTypeText = stringerTypeOption
          ? stringerTypeOption.text
          : stair.stringerType;
      } else {
        // Fallback to descriptive text
        const stringerTypeMap = {
          'pylex_steel': 'Pylex Steel (Pre-fab)',
          'lvl_wood': 'LVL Wood (Pre-fab)',
          'custom_2x12': 'Custom Cut 2x12'
        };
        stringerTypeText = stringerTypeMap[stair.stringerType] || stair.stringerType;
      }
      addIndentedItem("Stringer Type", stringerTypeText);

      addIndentedItem("Stringer Qty", stair.calculatedStringerQty);

      let landingTypeText = "N/A";
      // Get text for landing type
      const landingTypeSelect = document.getElementById("landingType");
      if (landingTypeSelect) {
        const landingTypeOption = Array.from(landingTypeSelect.options).find(
          (opt) => opt.value === stair.landingType
        );
        landingTypeText = landingTypeOption
          ? landingTypeOption.text
          : stair.landingType;
      } else {
        // Fallback to descriptive text
        const landingTypeMap = {
          'existing': 'Existing Surface',
          'slabs': '16"x16" Slabs',
          'concrete': 'Poured Concrete Pad'
        };
        landingTypeText = landingTypeMap[stair.landingType] || stair.landingType;
      }
      addIndentedItem("Landing", landingTypeText);
    });
  }
  summarySection.classList.remove("hidden");
}

export function toggleStairsInputSection(show) {
  if (stairsInputSection) {
    if (show) {
      stairsInputSection.classList.remove("hidden");
    } else {
      stairsInputSection.classList.add("hidden");
    }
  }
}

export function resetUIOutputs() {
  if (bomSection) bomSection.classList.add("hidden");
  if (bomTableBody)
    bomTableBody.innerHTML =
      '<tr><td colspan="5" class="text-center text-gray-500">Generate a plan to see the materials list.</td></tr>';
  if (summarySection) summarySection.classList.add("hidden");
  if (summaryList)
    summaryList.innerHTML = "<dt>Status:</dt><dd>Please generate a plan.</dd>";
}

// --- Stair Configuration Functions for Framing Menu ---
export function updateStairConfigDisplay(stairs) {
  const stairList = document.getElementById('framing-stair-list');
  if (!stairList) return;
  
  // Clear existing cards
  stairList.innerHTML = '';
  
  // Add cards for each stair
  if (stairs && stairs.length > 0) {
    stairs.forEach((stair, index) => {
      const stairCard = createStairCard(stair, index);
      stairList.appendChild(stairCard);
    });
  }
}

export function populateIndividualStairConfig(stairs) {
  // Function no longer needed - stair configuration section removed from UI
  return;
}

function createStairCard(stair, index) {
  const cardDiv = document.createElement("div");
  cardDiv.className = "border border-gray-200 rounded-lg bg-white overflow-hidden";
  cardDiv.id = `stair-card-${index}`;
  
  // Get readable text for current settings
  const stringerText = getStringerTypeText(stair.stringerType);
  const landingText = getLandingTypeText(stair.landingType);
  
  cardDiv.innerHTML = `
    <!-- Card Header (always visible) -->
    <div class="p-4">
      <div class="flex justify-between items-center">
        <div>
          <h5 class="font-medium text-gray-800">Stair Set ${index + 1}</h5>
          <p class="text-sm text-gray-600">${stair.widthFt}' wide</p>
        </div>
        <div class="flex items-center space-x-2">
          <button 
            onclick="toggleStairCardEdit(${index})" 
            class="p-2 text-gray-400 hover:text-blue-600 transition-colors"
            title="Edit stair settings"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button 
            onclick="deleteStairConfig(${index})" 
            class="p-2 text-gray-400 hover:text-red-600 transition-colors"
            title="Delete stair"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Current Settings Summary -->
      <div class="mt-2 text-sm text-gray-600">
        <span class="inline-flex items-center">
          <span class="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
          ${stringerText}
        </span>
        <span class="mx-2">•</span>
        <span class="inline-flex items-center">
          <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
          ${landingText}
        </span>
      </div>
    </div>
    
    <!-- Expandable Edit Section (hidden by default) -->
    <div id="stair-edit-${index}" class="hidden bg-gray-50 border-t border-gray-200 p-4">
      <div class="space-y-3">
        <div>
          <label for="stair_${index}_width" class="form-label text-sm">Width</label>
          <select id="stair_${index}_width" class="form-select text-sm" onchange="updateIndividualStairConfig(${index}, 'widthFt', this.value)">
            <option value="4" ${stair.widthFt === 4 ? 'selected' : ''}>4 feet</option>
            <option value="5" ${stair.widthFt === 5 ? 'selected' : ''}>5 feet</option>
            <option value="6" ${stair.widthFt === 6 ? 'selected' : ''}>6 feet</option>
            <option value="7" ${stair.widthFt === 7 ? 'selected' : ''}>7 feet</option>
            <option value="8" ${stair.widthFt === 8 ? 'selected' : ''}>8 feet</option>
            <option value="9" ${stair.widthFt === 9 ? 'selected' : ''}>9 feet</option>
            <option value="10" ${stair.widthFt === 10 ? 'selected' : ''}>10 feet</option>
            <option value="11" ${stair.widthFt === 11 ? 'selected' : ''}>11 feet</option>
            <option value="12" ${stair.widthFt === 12 ? 'selected' : ''}>12 feet</option>
            <option value="13" ${stair.widthFt === 13 ? 'selected' : ''}>13 feet</option>
            <option value="14" ${stair.widthFt === 14 ? 'selected' : ''}>14 feet</option>
            <option value="15" ${stair.widthFt === 15 ? 'selected' : ''}>15 feet</option>
            <option value="16" ${stair.widthFt === 16 ? 'selected' : ''}>16 feet</option>
            <option value="17" ${stair.widthFt === 17 ? 'selected' : ''}>17 feet</option>
            <option value="18" ${stair.widthFt === 18 ? 'selected' : ''}>18 feet</option>
            <option value="19" ${stair.widthFt === 19 ? 'selected' : ''}>19 feet</option>
            <option value="20" ${stair.widthFt === 20 ? 'selected' : ''}>20 feet</option>
          </select>
        </div>
        
        <div>
          <label for="stair_${index}_stringer" class="form-label text-sm">Stringer Type</label>
          <select id="stair_${index}_stringer" class="form-select text-sm" onchange="updateIndividualStairConfig(${index}, 'stringerType', this.value)">
            <option value="pylex_steel" ${stair.stringerType === 'pylex_steel' ? 'selected' : ''}>Pylex Steel (Pre-fab)</option>
            <option value="lvl_wood" ${stair.stringerType === 'lvl_wood' ? 'selected' : ''}>LVL Wood (Pre-fab)</option>
            <option value="custom_2x12" ${stair.stringerType === 'custom_2x12' ? 'selected' : ''}>Custom Cut 2x12</option>
          </select>
        </div>
        
        <div>
          <label for="stair_${index}_landing" class="form-label text-sm">Landing Type</label>
          <select id="stair_${index}_landing" class="form-select text-sm" onchange="updateIndividualStairConfig(${index}, 'landingType', this.value)">
            <option value="existing" ${stair.landingType === 'existing' ? 'selected' : ''}>Existing Surface</option>
            <option value="slabs" ${stair.landingType === 'slabs' ? 'selected' : ''}>16"x16" Slabs</option>
            <option value="concrete" ${stair.landingType === 'concrete' ? 'selected' : ''}>Poured Concrete Pad</option>
          </select>
        </div>
        
        <div class="flex justify-end space-x-2 mt-4">
          <button 
            onclick="toggleStairCardEdit(${index})" 
            class="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  `;
  
  return cardDiv;
}

// Create simplified stair card for Draw Shape menu (width editing focused)
function createDrawShapeStairCard(stair, index) {
  const cardDiv = document.createElement("div");
  cardDiv.className = "border border-gray-200 rounded-lg bg-white overflow-hidden";
  cardDiv.id = `drawShape-stair-card-${index}`;
  
  cardDiv.innerHTML = `
    <!-- Card Header (always visible) -->
    <div class="p-4">
      <div class="flex justify-between items-center">
        <div>
          <h5 class="font-medium text-gray-800">Stair Set ${index + 1}</h5>
          <p class="text-sm text-gray-600">${stair.widthFt} feet wide · ${stair.calculatedNumSteps ? stair.calculatedNumSteps + ' steps' : 'Steps: TBD'}</p>
        </div>
        <div class="flex items-center space-x-2">
          <button 
            onclick="toggleDrawShapeStairEdit(${index})" 
            class="p-2 text-gray-400 hover:text-blue-600 transition-colors"
            title="Edit stair width"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button 
            onclick="deleteDrawShapeStair(${index})" 
            class="p-2 text-gray-400 hover:text-red-600 transition-colors"
            title="Delete stair"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Expandable Edit Section (hidden by default) -->
    <div id="drawShape-stair-edit-${index}" class="hidden bg-gray-50 border-t border-gray-200 p-4">
      <div class="space-y-3">
        <div>
          <label for="drawShape_stair_${index}_width_edit" class="form-label text-sm">Width</label>
          <select id="drawShape_stair_${index}_width_edit" class="form-select text-sm" onchange="updateDrawShapeStairWidth(${index}, this.value)">
            <option value="4" ${stair.widthFt === 4 ? 'selected' : ''}>4 feet</option>
            <option value="5" ${stair.widthFt === 5 ? 'selected' : ''}>5 feet</option>
            <option value="6" ${stair.widthFt === 6 ? 'selected' : ''}>6 feet</option>
            <option value="7" ${stair.widthFt === 7 ? 'selected' : ''}>7 feet</option>
            <option value="8" ${stair.widthFt === 8 ? 'selected' : ''}>8 feet</option>
            <option value="9" ${stair.widthFt === 9 ? 'selected' : ''}>9 feet</option>
            <option value="10" ${stair.widthFt === 10 ? 'selected' : ''}>10 feet</option>
            <option value="11" ${stair.widthFt === 11 ? 'selected' : ''}>11 feet</option>
            <option value="12" ${stair.widthFt === 12 ? 'selected' : ''}>12 feet</option>
            <option value="13" ${stair.widthFt === 13 ? 'selected' : ''}>13 feet</option>
            <option value="14" ${stair.widthFt === 14 ? 'selected' : ''}>14 feet</option>
            <option value="15" ${stair.widthFt === 15 ? 'selected' : ''}>15 feet</option>
            <option value="16" ${stair.widthFt === 16 ? 'selected' : ''}>16 feet</option>
            <option value="17" ${stair.widthFt === 17 ? 'selected' : ''}>17 feet</option>
            <option value="18" ${stair.widthFt === 18 ? 'selected' : ''}>18 feet</option>
            <option value="19" ${stair.widthFt === 19 ? 'selected' : ''}>19 feet</option>
            <option value="20" ${stair.widthFt === 20 ? 'selected' : ''}>20 feet</option>
          </select>
        </div>
        
        <div class="flex justify-end space-x-2 mt-4">
          <button 
            onclick="applyDrawShapeStairEdit(${index})" 
            class="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  `;
  
  return cardDiv;
}

// Update Draw Shape stair management display
export function updateDrawShapeStairDisplay(stairs) {
  const managementSection = document.getElementById('drawShape-stair-management');
  const stairCount = document.getElementById('drawShape-stair-count');
  const stairList = document.getElementById('drawShape-stair-list');
  
  if (!managementSection || !stairCount || !stairList) return;
  
  const count = stairs ? stairs.length : 0;
  
  if (count === 0) {
    managementSection.classList.add('hidden');
  } else {
    managementSection.classList.remove('hidden');
    stairCount.textContent = `${count} set${count > 1 ? 's' : ''}`;
    
    // Clear existing cards
    stairList.innerHTML = '';
    
    // Add cards for each stair
    stairs.forEach((stair, index) => {
      const stairCard = createDrawShapeStairCard(stair, index);
      stairList.appendChild(stairCard);
    });
  }
}

// Helper functions to get readable text for stair settings (made global for card updates)
window.getStringerTypeText = function(stringerType) {
  const types = {
    'pylex_steel': 'Pylex Steel',
    'lvl_wood': 'LVL Wood', 
    'custom_2x12': 'Custom 2x12'
  };
  return types[stringerType] || stringerType;
};

window.getLandingTypeText = function(landingType) {
  const types = {
    'existing': 'Existing Surface',
    'slabs': '16"x16" Slabs',
    'concrete': 'Concrete Pad'
  };
  return types[landingType] || landingType;
};

// Local references for use within this module
const getStringerTypeText = window.getStringerTypeText;
const getLandingTypeText = window.getLandingTypeText;

// Global functions for stair card management
window.toggleStairCardEdit = function(stairIndex) {
  const editSection = document.getElementById(`stair-edit-${stairIndex}`);
  if (editSection) {
    const isHidden = editSection.classList.contains('hidden');
    if (isHidden) {
      editSection.classList.remove('hidden');
    } else {
      editSection.classList.add('hidden');
    }
  }
};

window.deleteStairConfig = function(stairIndex) {
  if (confirm('Are you sure you want to delete this stair set?')) {
    if (window.appState && window.appState.stairs && window.appState.stairs[stairIndex]) {
      // Remove the stair from the array
      window.appState.stairs.splice(stairIndex, 1);
      
      // Update BOM and UI
      if (window.recalculateAndUpdateBOM) {
        window.recalculateAndUpdateBOM();
      }
      
      // Refresh the stair configuration display
      updateStairConfigDisplay(window.appState.stairs);
      
      if (window.redrawApp) {
        window.redrawApp();
      }
      
      // Show confirmation message
      if (window.uiController && window.uiController.updateCanvasStatus) {
        window.uiController.updateCanvasStatus(`Stair set deleted. Remaining: ${window.appState.stairs.length}.`);
      }
    }
  }
};

window.updateIndividualStairConfig = function(stairIndex, property, value) {
  if (window.appState && window.appState.stairs && window.appState.stairs[stairIndex]) {
    // Convert value to integer if it's widthFt
    if (property === 'widthFt') {
      value = parseInt(value);
    }
    
    window.appState.stairs[stairIndex][property] = value;
    
    // Update the card display to reflect the new settings
    const stairCard = document.getElementById(`stair-card-${stairIndex}`);
    if (stairCard) {
      // Update width display if width changed
      if (property === 'widthFt') {
        const widthDisplay = stairCard.querySelector('p.text-sm.text-gray-600');
        if (widthDisplay) {
          widthDisplay.textContent = `${value}' wide`;
        }
      }
      
      // Update settings summary
      const settingsSummary = stairCard.querySelector('.mt-2.text-sm');
      if (settingsSummary) {
        const stair = window.appState.stairs[stairIndex];
        const stringerText = window.getStringerTypeText(stair.stringerType);
        const landingText = window.getLandingTypeText(stair.landingType);
        
        settingsSummary.innerHTML = `
          <span class="inline-flex items-center">
            <span class="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
            ${stringerText}
          </span>
          <span class="mx-2">•</span>
          <span class="inline-flex items-center">
            <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
            ${landingText}
          </span>
        `;
      }
    }
    
    // Recalculate stair details with new configuration
    if (window.stairCalculations && window.stairCalculations.calculateStairDetails) {
      const inputs = getFormInputs();
      const deckHeight = inputs.deckHeight || 0;
      window.stairCalculations.calculateStairDetails(window.appState.stairs[stairIndex], deckHeight);
    }
    
    // Update BOM and UI
    if (window.recalculateAndUpdateBOM) {
      window.recalculateAndUpdateBOM();
    }
    if (window.redrawApp) {
      window.redrawApp();
    }
  }
};

// Global functions for Draw Shape stair management
window.toggleDrawShapeStairEdit = function(stairIndex) {
  const editSection = document.getElementById(`drawShape-stair-edit-${stairIndex}`);
  
  if (editSection) {
    editSection.classList.toggle('hidden');
  }
};

window.applyDrawShapeStairEdit = function(stairIndex) {
  // Get the current value from the width dropdown and apply it
  const widthSelect = document.getElementById(`drawShape_stair_${stairIndex}_width_edit`);
  if (widthSelect) {
    const newWidth = widthSelect.value;
    // Apply the width change
    updateDrawShapeStairWidth(stairIndex, newWidth);
  }
  
  // Close the edit section
  const editSection = document.getElementById(`drawShape-stair-edit-${stairIndex}`);
  if (editSection) {
    editSection.classList.add('hidden');
  }
};

window.deleteDrawShapeStair = function(stairIndex) {
  if (confirm('Are you sure you want to delete this stair set?')) {
    if (window.appState && window.appState.stairs && window.appState.stairs[stairIndex]) {
      // Remove the stair from the array
      window.appState.stairs.splice(stairIndex, 1);
      
      // Update Draw Shape stair display
      if (window.uiController && window.uiController.updateDrawShapeStairDisplay) {
        window.uiController.updateDrawShapeStairDisplay(window.appState.stairs);
      }
      
      // Update Framing menu stair display
      if (window.uiController && window.uiController.updateStairConfigDisplay) {
        window.uiController.updateStairConfigDisplay(window.appState.stairs);
      }
      
      // Redraw canvas
      if (window.redrawApp) {
        window.redrawApp();
      }
      
      // Show confirmation message
      if (window.uiController && window.uiController.updateCanvasStatus) {
        window.uiController.updateCanvasStatus(`Stair set deleted. Remaining: ${window.appState.stairs.length}.`);
      }
    }
  }
};

window.updateDrawShapeStairWidth = function(stairIndex, newWidth) {
  if (window.appState && window.appState.stairs && window.appState.stairs[stairIndex]) {
    const width = parseInt(newWidth);
    window.appState.stairs[stairIndex].widthFt = width;
    
    // Find the card's paragraph element and update it
    const card = document.getElementById(`drawShape-stair-card-${stairIndex}`);
    if (card) {
      const displayP = card.querySelector('p.text-sm.text-gray-600');
      if (displayP) {
        const stair = window.appState.stairs[stairIndex];
        displayP.textContent = `${width} feet wide · ${stair.calculatedNumSteps ? stair.calculatedNumSteps + ' steps' : 'Steps: TBD'}`;
      }
    }
    
    // Recalculate stair details with new width
    if (window.stairCalculations && window.stairCalculations.calculateStairDetails) {
      const inputs = getFormInputs();
      const deckHeight = inputs.deckHeight || 0;
      window.stairCalculations.calculateStairDetails(window.appState.stairs[stairIndex], deckHeight);
      
      // Get updated stair object
      const stair = window.appState.stairs[stairIndex];
      
      // Update display again with recalculated step count
      if (card) {
        const displayP = card.querySelector('p.text-sm.text-gray-600');
        if (displayP) {
          displayP.textContent = `${width} feet wide · ${stair.calculatedNumSteps ? stair.calculatedNumSteps + ' steps' : 'Steps: TBD'}`;
        }
      }
    }
    
    // Update BOM and UI
    if (window.recalculateAndUpdateBOM) {
      window.recalculateAndUpdateBOM();
    }
    if (window.redrawApp) {
      window.redrawApp();
    }
  }
};
