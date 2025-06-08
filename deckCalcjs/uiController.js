// uiController.js (v3 - Enhanced Summary)
// import { getParsedStockData } from "./dataManager.js"; // Not strictly needed for these changes
import { decimalToFraction, formatFeetInches } from "./utils.js";

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

const bomSection = document.getElementById("bomSection");
const bomTableBody = document.getElementById("bomTableBody");
const summarySection = document.getElementById("summarySection");
const summaryList = document.getElementById("summaryList");
const canvasStatusElement = document.getElementById("canvasStatus");

// --- UI Update Functions ---
export function updateCanvasStatus(message) {
  if (canvasStatusElement) {
    canvasStatusElement.textContent = message;
  } else {
    console.log("UI Status Update:", message);
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
    inputs["stringerType"] = stringerTypeSelect.value;
    inputs["landingType"] = landingTypeSelect.value;
  } else {
    // Provide defaults, also useful if form inputs are read before stair section is active
    inputs["stairWidth"] = parseInt(stairWidthSelect.options[0].value, 10);
    inputs["stringerType"] = stringerTypeSelect.options[0].value;
    inputs["landingType"] = landingTypeSelect.options[0].value;
  }
  return inputs;
}

export function populateBOMTable(bomData, errorMessage = null) {
  // ... (same as v27)
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
    return;
  }

  bomData.forEach((item) => {
    const row = bomTableBody.insertRow();
    const cellQty = row.insertCell();
    const cellItem = row.insertCell();
    const cellDesc = row.insertCell();
    
    // We'll still create these cells but they'll be hidden by CSS
    const cellUnitPrice = row.insertCell();
    const cellTotalPrice = row.insertCell();

    const unitPrice = item.unitPrice || 0;
    const lineTotal = (item.qty || 0) * unitPrice;
    totalCost += lineTotal;

    cellQty.textContent = item.qty || 0;
    cellQty.classList.add("qty-col");
    cellItem.textContent = item.item || "N/A";
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
