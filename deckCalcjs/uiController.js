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

const stairsInputSection = document.getElementById("stairsInputSection");
const stairWidthSelect = document.getElementById("stairWidth");
const stringerTypeSelect = document.getElementById("stringerType");
const landingTypeSelect = document.getElementById("landingType");
const stairTargetSelect = document.getElementById("stairTarget");

const bomSection = document.getElementById("bomSection");
const bomTableBody = document.getElementById("bomTableBody");
const summarySection = document.getElementById("reviewSummarySection");
const summaryList = document.getElementById("reviewSummaryList");

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
    inputs["stringerType"] = stringerTypeSelect.value;
    inputs["landingType"] = landingTypeSelect.value;
    inputs["stairTarget"] = stairTargetSelect ? stairTargetSelect.value : "ground";
  } else {
    // Provide defaults, also useful if form inputs are read before stair section is active
    inputs["stairWidth"] = parseInt(stairWidthSelect.options[0].value, 10);
    inputs["stringerType"] = stringerTypeSelect.options[0].value;
    inputs["landingType"] = landingTypeSelect.options[0].value;
    inputs["stairTarget"] = "ground";
  }
  return inputs;
}

// Define category display order
const BOM_CATEGORY_ORDER = [
  "FRAMING",
  "BEAMS & POSTS",
  "STAIRS",
  "DECKING",
  "RAILING",
  "HARDWARE"
];

// Track collapsed state for categories (persists during session)
const collapsedCategories = {};

// Toggle category collapse state
function toggleBOMCategory(categoryId) {
  collapsedCategories[categoryId] = !collapsedCategories[categoryId];
  const rows = document.querySelectorAll(`[data-category="${categoryId}"]`);
  const headerRow = document.querySelector(`[data-category-header="${categoryId}"]`);
  const icon = headerRow?.querySelector('.category-toggle-icon');

  rows.forEach(row => {
    if (collapsedCategories[categoryId]) {
      row.classList.add('collapsed');
    } else {
      row.classList.remove('collapsed');
    }
  });

  if (icon) {
    icon.classList.toggle('rotated', !collapsedCategories[categoryId]);
  }
}

// Expose to window for onclick handlers
window.toggleBOMCategory = toggleBOMCategory;

export function populateBOMTable(bomData, errorMessage = null) {
  // Preserve scroll position before DOM modifications
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  bomTableBody.innerHTML = "";
  let totalCost = 0;

  if (errorMessage) {
    bomTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-500 py-4">${errorMessage}</td></tr>`;
    bomSection.classList.remove("hidden");
    // Restore scroll position after DOM update
    window.scrollTo(scrollX, scrollY);
    return;
  }

  if (!bomData || bomData.length === 0) {
    const msg = "No materials calculated. Generate a plan or add components.";
    bomTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-500 py-4">${msg}</td></tr>`;
    currentBOMData = null;
    // Restore scroll position after DOM update
    window.scrollTo(scrollX, scrollY);
    return;
  }

  // Store current BOM data for editing
  currentBOMData = bomData.map(item => ({...item})); // Deep copy

  // Add global indices to all items for tracking
  currentBOMData.forEach((item, globalIndex) => {
    item.globalIndex = globalIndex;
    item.originalGlobalIndex = globalIndex;
  });

  // Group items by category
  const categorizedItems = {};
  currentBOMData.forEach((item) => {
    const category = item.category || "FRAMING";
    if (!categorizedItems[category]) {
      categorizedItems[category] = [];
    }
    categorizedItems[category].push(item);
  });

  // Render items by category in defined order
  BOM_CATEGORY_ORDER.forEach(category => {
    const items = categorizedItems[category];
    if (!items || items.length === 0) return;

    // Calculate category subtotal
    let categoryTotal = 0;
    items.forEach(item => {
      const unitPrice = item.shopifyPrice || item.unitPrice || 0;
      categoryTotal += (item.qty || 0) * unitPrice;
    });
    totalCost += categoryTotal;

    // Create category header row
    const categoryId = category.replace(/\s+/g, '-').toLowerCase();
    const isCollapsed = collapsedCategories[categoryId] || false;
    const headerRow = bomTableBody.insertRow();
    headerRow.classList.add('bom-category-header');
    headerRow.setAttribute('data-category-header', categoryId);
    headerRow.onclick = () => toggleBOMCategory(categoryId);

    const headerCell = headerRow.insertCell();
    headerCell.colSpan = 6;
    headerCell.innerHTML = `
      <div class="category-header-content">
        <span class="category-toggle-icon ${isCollapsed ? '' : 'rotated'}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </span>
        <span class="category-name">${category}</span>
        <span class="category-count">(${items.length} item${items.length !== 1 ? 's' : ''})</span>
        <span class="category-subtotal">${categoryTotal.toLocaleString("en-CA", { style: "currency", currency: "CAD" })}</span>
      </div>
    `;

    // Render items in this category
    items.forEach((item) => {
      const row = bomTableBody.insertRow();
      row.setAttribute('data-category', categoryId);
      row.setAttribute('data-global-index', item.globalIndex);
      if (isCollapsed) {
        row.classList.add('collapsed');
      }

      // Checkbox cell (hidden by default, shown in selection mode)
      const cellCheckbox = row.insertCell();
      cellCheckbox.classList.add('checkbox-col', 'hidden');
      const isAvailable = item.shopifyVariantId && item.shopifyStatus === 'available';
      cellCheckbox.innerHTML = `<input type="checkbox"
        data-index="${item.globalIndex}"
        onchange="handleBomItemSelect(${item.globalIndex}, this.checked)"
        ${!isAvailable ? 'disabled title="Not available in Shopify"' : ''}
      >`;

      const cellQty = row.insertCell();
      const cellItem = row.insertCell();
      const cellDesc = row.insertCell();
      const cellUnitPrice = row.insertCell();
      const cellTotalPrice = row.insertCell();

      // Store original quantity if not already stored
      if (item.originalQty === undefined) {
        item.originalQty = item.qty || 0;
      }

      // Use Shopify price if available, fallback to local unitPrice
      const unitPrice = item.shopifyPrice || item.unitPrice || 0;
      const lineTotal = (item.qty || 0) * unitPrice;

      // Create interactive quantity controls using global index
      const quantityHTML = createQuantityControls(item, item.globalIndex);
      cellQty.innerHTML = quantityHTML;
      cellQty.classList.add("qty-col");

      // Add data attribute for print quantity
      cellQty.setAttribute('data-print-qty', item.qty || 0);

      // Add copy icon and item text
      const itemText = item.item || "N/A";
      cellItem.innerHTML = `
        <span class="copy-icon" onclick="event.stopPropagation(); copyItemName('${itemText.replace(/'/g, "\\'")}', this)" title="Copy item name">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </span>
        ${itemText}
      `;
      cellDesc.textContent = item.description || "N/A";

      // Show price columns with Shopify prices
      cellUnitPrice.textContent = unitPrice.toLocaleString("en-CA", {
        style: "currency",
        currency: "CAD",
      });
      cellUnitPrice.classList.add("price-col", "text-right");
      cellTotalPrice.textContent = lineTotal.toLocaleString("en-CA", {
        style: "currency",
        currency: "CAD",
      });
      cellTotalPrice.classList.add("price-col", "text-right");
    });
  });

  // Add total row at the bottom
  const totalRow = bomTableBody.insertRow();
  totalRow.classList.add("font-semibold", "bg-gray-100", "bom-total-row");
  const labelCell = totalRow.insertCell();
  labelCell.colSpan = 5;
  labelCell.textContent = "Estimated Material Total:";
  labelCell.classList.add("text-right", "pr-4");
  const totalValCell = totalRow.insertCell();
  totalValCell.textContent = totalCost.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });
  totalValCell.classList.add("price-col", "text-right", "font-bold");
  bomSection.classList.remove("hidden");

  // Restore scroll position after DOM update to prevent scroll snap
  window.scrollTo(scrollX, scrollY);
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

  // Hide view specs button (modal based)
  const viewSpecsBtn = document.getElementById("viewSpecsBtn");
  if (viewSpecsBtn) viewSpecsBtn.classList.add("hidden");
}

// --- Structural Specifications Population ---
export function populateStructuralSpecs(structure, inputs, deckDimensions, maxJoistSpanFt = null) {
  const viewSpecsBtn = document.getElementById("viewSpecsBtn");
  const specsModal = document.getElementById("specsModal");

  if (!structure || structure.error || !inputs || !deckDimensions) {
    // Hide the view specs button if no valid structure
    if (viewSpecsBtn) viewSpecsBtn.classList.add("hidden");
    return;
  }

  // Show the view specs button
  if (viewSpecsBtn) viewSpecsBtn.classList.remove("hidden");

  // Helper to safely set text content
  const setSpecValue = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value || "--";
  };

  // --- Joist System ---
  const joistSize = structure.joists?.[0]?.size || structure.ledger?.size || "N/A";
  setSpecValue("specJoistSize", joistSize);
  setSpecValue("specJoistSpacing", `${inputs.joistSpacing}" O.C.`);

  // Calculate actual joist span
  const actualSpan = structure.totalDepthFeet || deckDimensions.heightFeet || 0;
  setSpecValue("specJoistActualSpan", `${actualSpan.toFixed(1)}'`);

  // Set max allowable span if provided
  if (maxJoistSpanFt) {
    setSpecValue("specJoistMaxSpan", `${maxJoistSpanFt.toFixed(1)}'`);
  } else {
    // Estimate based on common span tables
    const estimatedMaxSpan = getEstimatedMaxSpan(joistSize, inputs.joistSpacing);
    setSpecValue("specJoistMaxSpan", estimatedMaxSpan ? `${estimatedMaxSpan}'` : "See span tables");
  }

  // Update compliance status
  const complianceStatus = document.getElementById("joistComplianceStatus");
  if (complianceStatus) {
    const maxSpan = maxJoistSpanFt || getEstimatedMaxSpan(joistSize, inputs.joistSpacing);
    complianceStatus.classList.remove("compliant", "warning", "non-compliant");

    if (maxSpan && actualSpan <= maxSpan) {
      complianceStatus.classList.add("compliant");
      complianceStatus.querySelector(".compliance-text").textContent = "Span within allowable limits";
    } else if (structure.beams?.some(b => b.usage === "Mid Beam")) {
      complianceStatus.classList.add("compliant");
      complianceStatus.querySelector(".compliance-text").textContent = "Mid-beam added for compliance";
    } else {
      complianceStatus.classList.add("warning");
      complianceStatus.querySelector(".compliance-text").textContent = "Verify with local code requirements";
    }
  }

  // --- Beam System ---
  if (structure.beams && structure.beams.length > 0) {
    const firstBeam = structure.beams[0];
    const beamConfig = `${firstBeam.ply}-ply ${firstBeam.size}`;
    setSpecValue("specBeamConfig", beamConfig);
    setSpecValue("specBeamType", firstBeam.isFlush ? "Flush Beam" : "Drop Beam");

    const totalBeamLength = structure.beams.reduce((sum, b) => sum + (b.lengthFeet || 0), 0);
    setSpecValue("specBeamLength", `${totalBeamLength.toFixed(1)}'`);
    setSpecValue("specBeamCount", structure.beams.length.toString());
  } else {
    setSpecValue("specBeamConfig", "N/A");
    setSpecValue("specBeamType", "N/A");
    setSpecValue("specBeamLength", "N/A");
    setSpecValue("specBeamCount", "0");
  }

  // --- Posts & Foundations ---
  const postSize = structure.posts?.[0]?.size || "N/A";
  setSpecValue("specPostSize", postSize);

  const postHeight = structure.posts?.[0]?.heightFeet;
  setSpecValue("specPostHeight", postHeight ? formatFeetInches(postHeight) : "N/A");
  setSpecValue("specPostCount", (structure.posts?.length || 0).toString());

  // Footing information
  const footingType = footingTypeSelect?.options[footingTypeSelect.selectedIndex]?.text || inputs.footingType || "N/A";
  setSpecValue("specFootingType", footingType);
  setSpecValue("specFootingCount", (structure.footings?.length || 0).toString());

  // --- Attachment Method ---
  let attachmentText = "N/A";
  if (inputs.attachmentType === "house_rim") attachmentText = "Ledger to House Rim";
  else if (inputs.attachmentType === "concrete") attachmentText = "To Concrete Foundation";
  else if (inputs.attachmentType === "floating") attachmentText = "Floating Deck";
  setSpecValue("specAttachmentType", attachmentText);

  // Ledger specifications
  if (structure.ledger) {
    setSpecValue("specLedgerSize", structure.ledger.size || "N/A");
    setSpecValue("specLedgerLength", `${structure.ledger.lengthFeet?.toFixed(1) || 0}'`);
  } else {
    setSpecValue("specLedgerSize", "N/A (Floating)");
    setSpecValue("specLedgerLength", "N/A");

    const ledgerNote = document.getElementById("specLedgerNote");
    if (ledgerNote) {
      ledgerNote.textContent = "Floating deck - no ledger attachment";
    }
  }

  // Set up print button handler
  const printBtn = document.getElementById("printSpecsBtn");
  if (printBtn && !printBtn.dataset.initialized) {
    printBtn.dataset.initialized = "true";
    printBtn.addEventListener("click", () => {
      window.print();
    });
  }
}

// Helper function to get estimated max span from common span tables
function getEstimatedMaxSpan(joistSize, spacingInches) {
  // Common span values for SPF #2 lumber at 40 PSF live load + 10 PSF dead load
  const spanTable = {
    "2x6": { 12: 9.5, 16: 8.5, 24: 7 },
    "2x8": { 12: 12.5, 16: 11.5, 24: 9.5 },
    "2x10": { 12: 16, 16: 14.5, 24: 12 },
    "2x12": { 12: 19, 16: 17.5, 24: 14.5 }
  };

  const sizes = spanTable[joistSize];
  if (sizes && sizes[spacingInches]) {
    return sizes[spacingInches];
  }
  return null;
}
