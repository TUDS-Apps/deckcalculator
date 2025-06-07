// stairCalculations.js

// --- Constants (Consider moving to config.js if used elsewhere) ---
const IDEAL_RISE_INCHES = 7.5;
const STANDARD_RUN_PER_STEP_INCHES = 10.5;
const MIN_STRINGERS = 2;
// Max stringer spacing isn't directly used in the quantity rules from the brief,
// but could be a fallback or for validation later.
// const MAX_STRINGER_SPACING_INCHES = 16;

/**
 * Calculates detailed properties for a single stair object based on deck height and user inputs.
 * Modifies the passed stairObject directly by adding calculated properties.
 *
 * @param {Object} stairObject - The basic stair object containing at least { widthFt, stringerType, landingType }.
 * @param {number} deckHeightInches - The total deck height from ground to top of deck floor in inches.
 * @returns {Object} The modified stairObject with added calculated properties, or the original object if calculation fails.
 */
export function calculateStairDetails(stairObject, deckHeightInches) {
  // console.log(`Calculating details for stairs, deck height: ${deckHeightInches}"`);

  if (
    !stairObject ||
    typeof deckHeightInches !== "number" ||
    deckHeightInches <= 0
  ) {
    console.error(
      "Invalid input for stair calculation: Missing stair object or invalid deck height.",
      stairObject,
      deckHeightInches
    );
    // Add error state to stair object? Or return null? For now, just log and return original.
    stairObject.calculationError = "Invalid input for calculation.";
    return stairObject;
  }

  // Store the height used for calculation
  stairObject.deckHeightInches = deckHeightInches;

  // --- Rise and Run Calculations ---
  const numRisers = Math.ceil(deckHeightInches / IDEAL_RISE_INCHES); // Round up
  // Ensure numRisers is at least 1 to avoid division by zero
  const actualNumRisers = Math.max(1, numRisers);
  const actualRisePerStepInches = deckHeightInches / actualNumRisers;
  // Number of treads is one less than the number of risers
  const numSteps = Math.max(0, actualNumRisers - 1); // Can be 0 for very short heights
  const totalRunInches = numSteps * STANDARD_RUN_PER_STEP_INCHES;

  stairObject.calculatedNumRisers = actualNumRisers;
  stairObject.calculatedRisePerStepInches = parseFloat(
    actualRisePerStepInches.toFixed(2)
  ); // Store with precision
  stairObject.calculatedNumSteps = numSteps;
  stairObject.calculatedRunPerStepInches = STANDARD_RUN_PER_STEP_INCHES; // Store the standard run used
  stairObject.calculatedTotalRunInches = totalRunInches;

  // console.log(`  - Risers: ${actualNumRisers}, Rise/Step: ${actualRisePerStepInches.toFixed(2)}", Steps: ${numSteps}, Total Run: ${totalRunInches.toFixed(1)}"`);

  // --- Stringer Quantity Calculation (Based on Development Brief Rules) ---
  const stairWidthFt = stairObject.widthFt || 4; // Default to 4ft if missing
  const stringerType = stairObject.stringerType;
  let calculatedNumStringers;
  let spacingLogicNote = "";

  if (stringerType === "pylex_steel") {
    // Rule: Qty = Width (ft)
    calculatedNumStringers = stairWidthFt;
    spacingLogicNote = "Rule: Qty = Width (ft)";
  } else if (stringerType === "lvl_wood" || stringerType === "custom_2x12") {
    // Rule: Qty = Width (ft) + 1
    calculatedNumStringers = stairWidthFt + 1;
    spacingLogicNote = "Rule: Qty = Width (ft) + 1";
  } else {
    // Fallback if type is unknown (shouldn't happen with select dropdown)
    // Use a reasonable default like spacing calculation
    // calculatedNumStringers = Math.ceil((stairWidthFt * 12) / MAX_STRINGER_SPACING_INCHES) + 1;
    // For now, let's default to the LVL/Custom rule as a safer fallback
    calculatedNumStringers = stairWidthFt + 1;
    spacingLogicNote = `Unknown type (${stringerType}), using fallback: Width (ft) + 1`;
    console.warn(
      `Unknown stringer type "${stringerType}" encountered during calculation.`
    );
  }

  // Ensure minimum number of stringers and round result
  calculatedNumStringers = Math.max(
    MIN_STRINGERS,
    Math.round(calculatedNumStringers)
  );

  stairObject.calculatedStringerQty = calculatedNumStringers;
  stairObject.stringerSpacingLogic = spacingLogicNote; // Store how qty was derived

  // console.log(`  - Stringer Type: ${stringerType}, Width: ${stairWidthFt}', Qty Needed: ${calculatedNumStringers} (${spacingLogicNote})`);

  // --- Landing Material Placeholder ---
  // The actual BOM calculation will handle finding stock items and quantities.
  // This just flags the requirement based on the selected type.
  const landingType = stairObject.landingType;
  let landingReq = {
    type: landingType,
    requiresPad: false,
    requiresSlabs: false,
  }; // Simplified structure

  if (landingType === "slabs_16x16") {
    landingReq.requiresSlabs = true;
    // console.log("  - Landing: 16x16 Slabs required (Qty TBD in BOM).");
  } else if (landingType === "concrete_pad") {
    landingReq.requiresPad = true;
    // console.log("  - Landing: Poured concrete pad required (Materials TBD in BOM).");
  } else {
    // existing surface
    // console.log("  - Landing: Using existing surface.");
  }

  stairObject.calculatedLandingReq = landingReq;
  stairObject.calculationError = null; // Clear any previous error

  return stairObject; // Return the modified object
}
