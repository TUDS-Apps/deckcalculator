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

// Framing menu stair configuration elements
const defaultStringerTypeSelect = document.getElementById("defaultStringerType");
const defaultLandingTypeSelect = document.getElementById("defaultLandingType");
const stairCountDisplay = document.getElementById("stair-count-display");
const individualStairConfig = document.getElementById("individual-stair-config");
const stairConfigList = document.getElementById("stair-config-list");

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
  // Console logging for debugging purposes - canvas status panel removed
  console.log("UI Status Update:", message);
  
  // Also send to the main status system if available
  if (window.showStatusMessage) {
    // Determine message type based on content
    let type = 'info';
    if (message.includes('Error:') || message.includes('error')) type = 'error';
    else if (message.includes('✅') || message.includes('Success') || message.includes('successfully')) type = 'success';
    else if (message.includes('🎯') || message.includes('MODE:')) type = 'info';
    
    window.showStatusMessage(message, type, 3000); // Show for 3 seconds
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

export function populateBOMTable(bomData, errorMessage = null) {
  bomTableBody.innerHTML = "";
  let totalCost = 0;

  if (errorMessage) {
    bomTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-500 py-4">${errorMessage}</td></tr>`;
    bomSection.classList.remove("hidden");
    return;
  }

  if (!bomData || bomData.length === 0) {
    const msg = "No materials calculated. Generate a plan or add components.";
    bomTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-500 py-4">${msg}</td></tr>`;
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
      const row = bomTableBody.insertRow();
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
  const totalRow = bomTableBody.insertRow();
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
  bomSection.classList.remove("hidden");
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
      // Get selected text from dropdown for stringerType
      const stringerTypeOption = Array.from(stringerTypeSelect.options).find(
        (opt) => opt.value === stair.stringerType
      );
      stringerTypeText = stringerTypeOption
        ? stringerTypeOption.text
        : stair.stringerType;
      addIndentedItem("Stringer Type", stringerTypeText);

      addIndentedItem("Stringer Qty", stair.calculatedStringerQty);

      let landingTypeText = "N/A";
      // Get selected text from dropdown for landingType
      const landingTypeOption = Array.from(landingTypeSelect.options).find(
        (opt) => opt.value === stair.landingType
      );
      landingTypeText = landingTypeOption
        ? landingTypeOption.text
        : stair.landingType;
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
  if (!stairCountDisplay) return;
  
  const stairCount = stairs ? stairs.length : 0;
  
  if (stairCount === 0) {
    stairCountDisplay.textContent = "No stairs placed yet. Add stairs in the Draw Shape menu first.";
    stairCountDisplay.className = "text-sm font-medium text-blue-700";
    if (individualStairConfig) individualStairConfig.classList.add("hidden");
  } else {
    stairCountDisplay.textContent = `${stairCount} stair set${stairCount > 1 ? 's' : ''} placed. Configure structural details below.`;
    stairCountDisplay.className = "text-sm font-medium text-green-700";
    if (individualStairConfig) individualStairConfig.classList.remove("hidden");
    populateIndividualStairConfig(stairs);
  }
}

export function populateIndividualStairConfig(stairs) {
  if (!stairConfigList || !stairs) return;
  
  stairConfigList.innerHTML = "";
  
  stairs.forEach((stair, index) => {
    const stairConfigDiv = document.createElement("div");
    stairConfigDiv.className = "p-4 border border-gray-200 rounded-lg bg-white";
    stairConfigDiv.innerHTML = `
      <div class="flex justify-between items-center mb-3">
        <h5 class="font-medium text-gray-800">Stair Set ${index + 1}</h5>
        <span class="text-sm text-gray-600">${stair.widthFt}' wide</span>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
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
      </div>
    `;
    
    stairConfigList.appendChild(stairConfigDiv);
  });
}

// Global function for individual stair config updates
window.updateIndividualStairConfig = function(stairIndex, property, value) {
  if (window.appState && window.appState.stairs && window.appState.stairs[stairIndex]) {
    window.appState.stairs[stairIndex][property] = value;
    
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
