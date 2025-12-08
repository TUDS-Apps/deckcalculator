// dataManager.js
import { parseFeetInches } from "./utils.js"; // For parsing "X' Y"" strings in manualSpanRules

// --- Raw Data (Embedded) ---
// This data will eventually come from Shopify or other external sources,
// but for now, it's embedded here as per our current approach.

const rawManualSpansCSV = `Joist Length Range,Joist Spacing,Recommended Joist,Special Instructions
"3'6"" – 4'","12"" OC",2x6 8',Cut in Recommend Joist in half and count as 2.
"3'6"" – 4'","16"" OC",2x6 8',Cut in Recommend Joist in half and count as 2.
"4'6"" – 5'","12"" OC",2x6 10',Cut in Recommend Joist in half and count as 2.
"4'6"" – 5'","16"" OC",2x6 10',Cut in Recommend Joist in half and count as 2.
"5'6"" – 6'","12"" OC",2x6 12',Cut in Recommend Joist in half and count as 2.
"5'6"" – 6'","16"" OC",2x6 12',Cut in Recommend Joist in half and count as 2.
"6'6"" – 8'","12"" OC",2x8 8',
"6'6"" – 8'","16"" OC",2x8 8',
"8'6"" – 10'","12"" OC",2x8 10',
"8'6"" – 10'","16"" OC",2x8 10',
"10'6"" – 12'","12"" OC",2x8 12',
"10'6"" – 12'","16"" OC",2x8 12',
"12'6"" – 14'","12"" OC",2x10 14',
"12'6"" – 14'","16"" OC",2x10 14',
"14'6"" – 16'","12"" OC",2x10 16',
"14'6"" – 16'","16"" OC",2x10 16',
"16'6"" – 20'","12"" OC",2x10 20',
"16'6"" – 20'","16"" OC",2x10 20',
"20'6"" – 24'","12"" OC",2x8 12',Add another beam in the middle of the span and double the joist count.
"20'6"" – 24'","16"" OC",2x8 12',Add another beam in the middle of the span and double the joist count.
"24'6"" – 28'","12"" OC",2x10 14',Add another beam in the middle of the span and double the joist count.
"24'6"" – 28'","16"" OC",2x10 14',Add another beam in the middle of the span and double the joist count.
"28'6"" – 30'","12"" OC",2x10 16',Add another beam in the middle of the span and double the joist count.
"28'6"" – 30'","16"" OC",2x10 16',Add another beam in the middle of the span and double the joist count.
"30'6"" – 100'",N/A,N/A,Display a warning that a manual take-off is required.`;

const rawStockListCSV = `System ID,Item,Retail Price
210000000948,GH Deck Leveller,$24.99
210000000947,Deck Slab 16x16x2,$15.79
210000001896,"Pylex 50"" Screw Pile",$39.99
210000001051,"Helical Screw Pile Installed (Includes Windlift Adapter and Cap) 2-3/8""",$484.99
210000000876,2x10 S4S Brown 12',$38.29
210000002506,2x10 S4S Brown 14',$44.69
210000000877,2x10 S4S Brown 16',$51.09
210000000878,2x10 S4S Brown 20',$79.69
210000000879,2x12 S4S Brown 12',$53.59
210000000880,2x12 S4S Brown 16',$71.39
210000006046,2x4 S4S Brown 10',$11.09
210000000882,2x4 S4S Brown 12',$13.39
210000002790,2x4 S4S Brown 16',$17.79
210000000883,2x4 S4S Brown 8',$8.89
210000003505,2x6 S4S Brown 10',$16.99
210000000884,2x6 S4S Brown 12',$20.39
210000000885,2x6 S4S Brown 16',$27.09
210000006093,2x6 S4S Brown 8',$13.59
210000000886,2x8 S4S Brown 10',$24.39
210000000887,2x8 S4S Brown 12',$29.19
210000000888,2x8 S4S Brown 16',$38.89
210000005287,2x8 S4S Brown 20',$62.99
210000004979,2x8 S4S Brown 8',$19.49
210000000889,4x4 S4S Brown 10',$24.39
210000000890,4x4 S4S Brown 12',$29.29
210000000891,4x4 S4S Brown 8',$19.49
210000002502,4x4 S4S Brown 9',$21.99
210000005288,4x6 Rough Brown 16',$61.89
210000000895,6x6 Rough Brown  10',$58.29
210000000896,6x6 Rough Brown  12',$69.89
210000002670,6x6 Rough Brown  16',$93.19
210000003042,6x6 Rough Brown  8',$46.59
210000003881,Simpson Reinforcing Angle Zmax L50Z,$4.39
210000000286,Simpson Reinforcing Angle Zmax L70Z,$5.69
210000003882,Simpson Reinforcing Angle Zmax L90Z,$7.59
210000000287,Simpson Reinforcing Angle Zmax LS50Z,$4.89
210000003883,Simpson Reinforcing Angle Zmax LS70Z,$7.79
210000003884,Simpson Reinforcing Angle Zmax LS90Z,$9.89
210000000302,"Simpson SD Connector Screw Galv #9 1-1/2"" 100ct",$14.29
210000003887,"Simpson SD Connector Screw Galv #9 1-1/2"" 3000ct",$330.79
210000000303,"Simpson SD Connector Screw Galv #9 1-1/2"" 500ct",$64.19
210000000304,"Simpson SD Connector Screw Galv #9 2-1/2"" 100ct",$19.69
210000003889,"Simpson SD Connector Screw Galv #9 2-1/2"" 2000ct",$322.69
210000000305,"Simpson SD Connector Screw Galv #9 2-1/2"" 500ct",$93.59
210000000288,Simpson Skewed Left Hanger SUL210Z (2x10),$18.59
210000000292,Simpson Skewed Left Hanger SUL26Z (2x6),$14.39
210000000290,Simpson Skewed Right Hanger SUR210Z (2x10),$18.59
210000000293,Simpson Skewed Right Hanger SUR26Z (2x6),$14.39
210000005749,Titen HD MG 1/2 X 6 Single,$4.39
210000005747,Titen HD MG 1/2X4 Single,$2.99
210000000242,"GRK Rugged Structural Screws 5/16 x 4"" Gold 100ct",$85.99
210000000241,"GRK Rugged Structural Screws 5/16 x 4"" Gold 25ct",$25.99
210000000240,"GRK Rugged Structural Screws 5/16 x 4"" Gold Single",$1.09
210000003714,"U2 Universal Screw #9 x 3 1/8"" 100ct",$21.59
210000003716,"U2 Universal Screw #9 x 3 1/8"" 1500ct",$234.89
210000003715,"U2 Universal Screw #9 x 3 1/8"" 330ct",$60.99
210000001889,"Paslode 3-1/4"" Hot Dipped Galvanized Strip Nails",$124.99
210000000479,"Brown Deck Screw #8 3"" per LB",$4.99
210000001046,Protect-A-Cut End Cut Sealer Brown,$19.99
210000005014,"Bennett 3"" Polyester Stain Brush",$3.99
210000006023,Fastenmaster Deck Frame Coating,$129.99
210000003004,"G-Tape 3035BK Paperless Joist Tape 2"" 65-ft",$29.39
210000003005,"G-Tape 3035BK Paperless Joist Tape 4"" 65-ft",$49.69
210000000257,"G-Tape 3040BK Joist Tape 6"" 65-ft",$83.09
210000001078,"Pylex Steel Stringer 10-1/4"" Run 1 Step",$9.99
210000001079,"Pylex Steel Stringer 10-1/4"" Run 2 Step",$19.99
210000001080,"Pylex Steel Stringer 10-1/4"" Run 3 Step",$29.99
210000001081,"Pylex Steel Stringer 10-1/4"" Run 4 Step",$39.99
210000001082,"Pylex Steel Stringer 10-1/4"" Run 5 Step",$49.99
210000001083,"Pylex Steel Stringer 10-1/4"" Run 6 Step",$64.99
210000001084,"Pylex Steel Stringer 10-1/4"" Run 7 Step",$79.99
210000001905,Pylex Steel Stair Stringer Connector Bracket,$54.99
210000002158,Pressure Treated LVL Stair Stringer 2 Step,$20.99
210000002159,Pressure Treated LVL Stair Stringer 3 Step,$31.49
210000002160,Pressure Treated LVL Stair Stringer 4 Step,$41.99
210000002161,Pressure Treated LVL Stair Stringer 5 Step,$52.49
210000002162,Pressure Treated LVL Stair Stringer 6 Step,$62.99
210000002163,Pressure Treated LVL Stair Stringer 7 Step,$104.99
210000002164,Pressure Treated LVL Stair Stringer 8 Step,$119.99
210000000276,Simpson LUS210Z 2x10 Face Mount Hanger Z-MAX 1 Ply,$2.59
210000000280,Simpson LUS26Z 2x6 Face Mount Hanger Z-MAX 1 Ply,$1.79
210000000282,Simpson LUS28Z 2x8 Face Mount Hanger Z-MAX 1 Ply,$2.39
210000000264,Simpson BCS Post Cap  BCS2-2/4Z,$11.79
210000000265,Simpson BCS Post Cap  BCS2-3/6Z,$19.49
210000000267,Simpson Hurricane  H2.5AZ Flush Tie,$1.19
210000005241,Quikrete 30kg Ready-to-Use Concrete Mix,$12.59
210000000929,Simpson LSCZ Adjustable Stair Stringer Connector Z-MAX,$5.39
210000010001,"5/4x6 PT Brown Deck Board 8'",$11.99
210000010002,"5/4x6 PT Brown Deck Board 10'",$14.99
210000010003,"5/4x6 PT Brown Deck Board 12'",$17.99
210000010004,"5/4x6 PT Brown Deck Board 14'",$20.99
210000010005,"5/4x6 PT Brown Deck Board 16'",$23.99
210000010011,"5/4x6 Cedar Deck Board 8'",$18.99
210000010012,"5/4x6 Cedar Deck Board 10'",$23.99
210000010013,"5/4x6 Cedar Deck Board 12'",$28.99
210000010014,"5/4x6 Cedar Deck Board 14'",$33.99
210000010015,"5/4x6 Cedar Deck Board 16'",$38.99
210000010021,"5/4x5 Cedar Deck Board 8'",$15.99
210000010022,"5/4x5 Cedar Deck Board 10'",$19.99
210000010023,"5/4x5 Cedar Deck Board 12'",$23.99
210000010024,"5/4x5 Cedar Deck Board 14'",$27.99
210000010025,"5/4x5 Cedar Deck Board 16'",$31.99
210000010101,"DSB Deck Screw 2-1/2"" 100ct",$12.99
210000010102,"DSB Deck Screw 2-1/2"" 350ct",$39.99
210000010103,"DSB Deck Screw 2-1/2"" 1000ct",$99.99
210000010111,"DSB Deck Screw 3"" 100ct",$14.99
210000010112,"DSB Deck Screw 3"" 350ct",$44.99
210000010113,"DSB Deck Screw 3"" 1000ct",$109.99
210000010201,"Camo Hidden Deck Screw 2-3/8"" 100ct",$29.99
210000010202,"Camo Hidden Deck Screw 2-3/8"" 350ct",$89.99
210000010203,"Camo Hidden Deck Screw 2-3/8"" 700ct",$169.99`;

// Max Joist Span Data Structure (this would ideally come from a CSV too, but embedded for now)
const maxJoistSpansData = [
  { size: "2x6", spacing: 12, maxSpanFt: 9 + 10 / 12 }, // 9'10" = 9.833 ft
  { size: "2x6", spacing: 16, maxSpanFt: 9 + 1 / 12 }, // 9'1"  = 9.083 ft
  { size: "2x8", spacing: 12, maxSpanFt: 13 + 2 / 12 }, // 13'2" = 13.167 ft
  { size: "2x8", spacing: 16, maxSpanFt: 10 + 6 / 12 }, // 10'6" = 10.5 ft (IRC R507.5)
  { size: "2x10", spacing: 12, maxSpanFt: 16.0 }, // 16'0" = 16.0 ft
  { size: "2x10", spacing: 16, maxSpanFt: 15 + 2 / 12 }, // 15'2" = 15.167 ft
  { size: "2x12", spacing: 12, maxSpanFt: 16.0 }, // 16'0" = 16.0 ft (Assuming 16' based on prev data)
  { size: "2x12", spacing: 16, maxSpanFt: 16.0 }, // 16'0" = 16.0 ft (Assuming 16' based on prev data)
];

// IRC Table R507.6 - Maximum Beam Spans (Southern Pine #2, 40 PSF live + 10 PSF dead)
// Organized by beam ply count, beam size, and joist span (tributary width)
// Values are in feet
const maxBeamSpansData = {
  // 2-ply beams (for 4x4 posts)
  2: {
    "2x6": [
      { joistSpanFt: 6, maxBeamSpanFt: 6 + 2/12 },   // 6'2"
      { joistSpanFt: 8, maxBeamSpanFt: 5 + 4/12 },   // 5'4"
      { joistSpanFt: 10, maxBeamSpanFt: 4 + 9/12 },  // 4'9"
      { joistSpanFt: 12, maxBeamSpanFt: 4 + 4/12 },  // 4'4"
    ],
    "2x8": [
      { joistSpanFt: 6, maxBeamSpanFt: 8 + 2/12 },   // 8'2"
      { joistSpanFt: 8, maxBeamSpanFt: 7 + 1/12 },   // 7'1"
      { joistSpanFt: 10, maxBeamSpanFt: 6 + 4/12 },  // 6'4"
      { joistSpanFt: 12, maxBeamSpanFt: 5 + 9/12 },  // 5'9"
    ],
    "2x10": [
      { joistSpanFt: 6, maxBeamSpanFt: 10 + 5/12 },  // 10'5"
      { joistSpanFt: 8, maxBeamSpanFt: 9 + 0/12 },   // 9'0"
      { joistSpanFt: 10, maxBeamSpanFt: 8 + 1/12 },  // 8'1"
      { joistSpanFt: 12, maxBeamSpanFt: 7 + 4/12 },  // 7'4"
    ],
    "2x12": [
      { joistSpanFt: 6, maxBeamSpanFt: 12 + 8/12 },  // 12'8"
      { joistSpanFt: 8, maxBeamSpanFt: 11 + 0/12 },  // 11'0"
      { joistSpanFt: 10, maxBeamSpanFt: 9 + 10/12 }, // 9'10"
      { joistSpanFt: 12, maxBeamSpanFt: 8 + 11/12 }, // 8'11"
    ],
  },
  // 3-ply beams (for 6x6 posts)
  3: {
    "2x6": [
      { joistSpanFt: 6, maxBeamSpanFt: 7 + 9/12 },   // 7'9"
      { joistSpanFt: 8, maxBeamSpanFt: 6 + 9/12 },   // 6'9"
      { joistSpanFt: 10, maxBeamSpanFt: 6 + 0/12 },  // 6'0"
      { joistSpanFt: 12, maxBeamSpanFt: 5 + 6/12 },  // 5'6"
    ],
    "2x8": [
      { joistSpanFt: 6, maxBeamSpanFt: 10 + 2/12 },  // 10'2"
      { joistSpanFt: 8, maxBeamSpanFt: 8 + 10/12 },  // 8'10"
      { joistSpanFt: 10, maxBeamSpanFt: 7 + 11/12 }, // 7'11"
      { joistSpanFt: 12, maxBeamSpanFt: 7 + 3/12 },  // 7'3"
    ],
    "2x10": [
      { joistSpanFt: 6, maxBeamSpanFt: 13 + 0/12 },  // 13'0"
      { joistSpanFt: 8, maxBeamSpanFt: 11 + 3/12 },  // 11'3"
      { joistSpanFt: 10, maxBeamSpanFt: 10 + 1/12 }, // 10'1"
      { joistSpanFt: 12, maxBeamSpanFt: 9 + 2/12 },  // 9'2"
    ],
    "2x12": [
      { joistSpanFt: 6, maxBeamSpanFt: 15 + 10/12 }, // 15'10"
      { joistSpanFt: 8, maxBeamSpanFt: 13 + 8/12 },  // 13'8"
      { joistSpanFt: 10, maxBeamSpanFt: 12 + 3/12 }, // 12'3"
      { joistSpanFt: 12, maxBeamSpanFt: 11 + 2/12 }, // 11'2"
    ],
  }
};

/**
 * Gets the maximum allowable beam span based on IRC Table R507.6
 * @param {string} beamSize - Beam lumber size (e.g., "2x8", "2x10")
 * @param {number} beamPly - Number of plies (2 or 3)
 * @param {number} joistSpanFt - The joist span in feet (tributary width for the beam)
 * @returns {number|null} Maximum beam span in feet, or null if not found
 */
function getMaxBeamSpan(beamSize, beamPly, joistSpanFt) {
  const plyData = maxBeamSpansData[beamPly];
  if (!plyData) {
    console.warn(`[getMaxBeamSpan] Invalid beam ply count: ${beamPly}`);
    return null;
  }

  const sizeData = plyData[beamSize];
  if (!sizeData) {
    console.warn(`[getMaxBeamSpan] Unknown beam size: ${beamSize} for ${beamPly}-ply`);
    return null;
  }

  // Find the appropriate joist span entry (interpolate or use closest)
  // Sort by joist span ascending
  const sortedData = [...sizeData].sort((a, b) => a.joistSpanFt - b.joistSpanFt);

  // If joist span is smaller than smallest table entry, use smallest entry (conservative)
  if (joistSpanFt <= sortedData[0].joistSpanFt) {
    return sortedData[0].maxBeamSpanFt;
  }

  // If joist span is larger than largest table entry, use largest entry (conservative)
  if (joistSpanFt >= sortedData[sortedData.length - 1].joistSpanFt) {
    return sortedData[sortedData.length - 1].maxBeamSpanFt;
  }

  // Linear interpolation between table values
  for (let i = 0; i < sortedData.length - 1; i++) {
    const lower = sortedData[i];
    const upper = sortedData[i + 1];

    if (joistSpanFt >= lower.joistSpanFt && joistSpanFt <= upper.joistSpanFt) {
      // Interpolate
      const ratio = (joistSpanFt - lower.joistSpanFt) / (upper.joistSpanFt - lower.joistSpanFt);
      return lower.maxBeamSpanFt + ratio * (upper.maxBeamSpanFt - lower.maxBeamSpanFt);
    }
  }

  return null;
}

/**
 * Validates if a beam span is within IRC code limits
 * @param {number} actualBeamSpanFt - The actual beam span between posts in feet
 * @param {string} beamSize - Beam lumber size (e.g., "2x8")
 * @param {number} beamPly - Number of plies (2 or 3)
 * @param {number} joistSpanFt - The joist span in feet
 * @returns {{valid: boolean, maxSpan: number, message: string}}
 */
function validateBeamSpan(actualBeamSpanFt, beamSize, beamPly, joistSpanFt) {
  const maxSpan = getMaxBeamSpan(beamSize, beamPly, joistSpanFt);

  if (maxSpan === null) {
    return {
      valid: false,
      maxSpan: null,
      message: `Cannot validate beam span: unknown configuration (${beamPly}-ply ${beamSize} with ${joistSpanFt}' joist span)`
    };
  }

  const isValid = actualBeamSpanFt <= maxSpan + 0.1; // Small tolerance for rounding

  return {
    valid: isValid,
    maxSpan: maxSpan,
    message: isValid
      ? `Beam span ${actualBeamSpanFt.toFixed(1)}' is within IRC limit of ${maxSpan.toFixed(1)}'`
      : `WARNING: Beam span ${actualBeamSpanFt.toFixed(1)}' exceeds IRC limit of ${maxSpan.toFixed(1)}' for ${beamPly}-ply ${beamSize} with ${joistSpanFt.toFixed(1)}' joist span`
  };
}

/**
 * Recommends a beam size based on required span and joist span
 * @param {number} requiredBeamSpanFt - Required beam span between posts
 * @param {number} joistSpanFt - Joist span (tributary width)
 * @param {number} beamPly - Number of plies (2 or 3)
 * @returns {{size: string, maxSpan: number}|null} Recommended beam size or null if none adequate
 */
function recommendBeamSize(requiredBeamSpanFt, joistSpanFt, beamPly) {
  const sizes = ["2x6", "2x8", "2x10", "2x12"];

  for (const size of sizes) {
    const maxSpan = getMaxBeamSpan(size, beamPly, joistSpanFt);
    if (maxSpan && maxSpan >= requiredBeamSpanFt) {
      return { size, maxSpan };
    }
  }

  // If no single beam works, return the largest with a note
  const largestSize = sizes[sizes.length - 1];
  const largestMaxSpan = getMaxBeamSpan(largestSize, beamPly, joistSpanFt);

  return {
    size: largestSize,
    maxSpan: largestMaxSpan,
    needsMorePosts: true,
    message: `Maximum ${beamPly}-ply ${largestSize} span is ${largestMaxSpan?.toFixed(1)}' - additional posts required`
  };
}

// --- Parsed Data Storage (will be populated by loadAndParseData) ---
let parsedStockDataInternal = [];
let manualSpanRulesInternal = [];

// --- Data Parsing Functions ---

/**
 * Parses a CSV string into an array of objects.
 * Handles quoted fields containing commas.
 * @param {string} csvString The raw CSV data.
 * @param {number} expectedColumns The number of columns expected.
 * @returns {Array<Object>} An array of objects representing the CSV data.
 */
function parseCSV(csvString, expectedColumns = -1) {
  const lines = csvString.trim().split("\n");
  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map((h) =>
    h
      .trim()
      .replace(/^"|"$/g, "")
      .replace(/[\s\W]+/g, "_")
      .toLowerCase()
  );
  const data = [];

  if (expectedColumns === -1) {
    expectedColumns = headers.length;
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "") continue;

    const values = [];
    let currentVal = "";
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        if (inQuotes && line[j + 1] === '"') {
          currentVal += '"';
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        values.push(currentVal.trim());
        currentVal = "";
      } else {
        currentVal += char;
      }
    }
    values.push(currentVal.trim());

    if (
      values.length !== expectedColumns ||
      !values[0] ||
      values[0].toLowerCase().includes("joist size") ||
      values[0].toLowerCase().includes("additional logic")
    ) {
      // console.warn(
      //   `Skipping CSV line ${i + 1}: Cols: ${values.length}/${expectedColumns}, Empty Cell: ${!values[0]}, Header Word: ${values[0]?.toLowerCase().includes('joist size') || values[0]?.toLowerCase().includes('additional logic')}. Line: "${line}"`
      // );
      continue;
    }

    const rowObject = {};
    for (let k = 0; k < headers.length; k++) {
      const headerKey = headers[k];
      let value = values[k];
      rowObject[headerKey] = value;
    }
    data.push(rowObject);
  }
  return data;
}

/**
 * Parses the item description in the stock list to extract lumber size and length.
 * @param {string} itemDescription - The item description string.
 * @returns {object|null} Object { size: '2x8', length: 16 } or null.
 */
function parseStockItemLumberDetails(itemDescription) {
  if (!itemDescription || typeof itemDescription !== "string") return null;
  const lumberMatch = itemDescription.match(/(\d+x\d+)\s+.*\s+(\d+)'?$/);
  if (lumberMatch) {
    return {
      size: lumberMatch[1],
      length: parseInt(lumberMatch[2], 10),
    };
  }
  return null;
}

/**
 * Loads and parses all necessary application data.
 * This function is called once on application startup.
 * It populates `parsedStockDataInternal` and `manualSpanRulesInternal`.
 */
export function loadAndParseData() {
  try {
    // Parse Stock List
    const rawStockData = parseCSV(rawStockListCSV, 3);
    // console.log("Stock List Data Parsed:", rawStockData.length, "items");

    parsedStockDataInternal = rawStockData.map((item) => {
      const lumberDetails = parseStockItemLumberDetails(item.item);
      let pkgQty = 1;
      let pkgUnit = "each";
      if (item.item?.toLowerCase().includes("ct")) {
        const match = item.item.match(/(\d+)ct/i);
        if (match) pkgQty = parseInt(match[1]);
        pkgUnit = "box";
      } else if (item.item?.toLowerCase().includes("lb")) {
        const match = item.item.match(/(\d+)lb/i);
        if (match) pkgQty = parseInt(match[1]);
        pkgUnit = "lb";
      } else if (item.item?.toLowerCase().includes("per lb")) {
        pkgQty = 1;
        pkgUnit = "lb";
      } else if (item.item?.toLowerCase().includes("single")) {
        pkgQty = 1;
        pkgUnit = "each";
      } else if (item.item?.toLowerCase().includes("ft")) {
        const match = item.item.match(/(\d+)-?ft/i);
        if (match) pkgQty = parseInt(match[1]);
        pkgUnit = "roll";
      }

      return {
        ...item,
        lumber_size: lumberDetails?.size || null,
        lumber_length_ft: lumberDetails?.length || null,
        pkg_qty: pkgQty,
        pkg_unit: pkgUnit,
        retail_price:
          parseFloat(String(item.retail_price).replace("$", "")) || 0,
      };
    });
    // console.log("Parsed Stock Data (with lumber & pkg details):", parsedStockDataInternal.length, "items processed");

    // Parse Manual Spans Recommendations
    const rawManualSpansData = parseCSV(rawManualSpansCSV, 4);
    // console.log("Raw Manual Spans Data Parsed:", rawManualSpansData.length, "rules");

    manualSpanRulesInternal = rawManualSpansData
      .map((row) => {
        if (
          !row ||
          typeof row !== "object" ||
          !row.joist_length_range ||
          !row.joist_spacing ||
          !row.recommended_joist
        ) {
          return null;
        }
        const range = parseFeetInches(row.joist_length_range); // Uses imported function
        const spacingMatch = String(row.joist_spacing).match(/(\d+)/);
        const spacing = spacingMatch ? parseInt(spacingMatch[1], 10) : null;
        const recJoistMatch = String(row.recommended_joist).match(
          /(\d+x\d+)\s+(\d+)'?/
        );
        const cutInHalf = String(row.special_instructions)
          ?.toLowerCase()
          .includes("cut in recommend joist in half");

        if (
          !range ||
          typeof range.start !== "number" ||
          typeof range.end !== "number" ||
          spacing === null ||
          !recJoistMatch ||
          recJoistMatch.length < 3
        ) {
          if (
            row.joist_length_range !== "N/A" &&
            row.recommended_joist !== "N/A"
          ) {
            // console.warn("Skipping manual span rule due to parsing issues:", row);
          }
          return null;
        }
        return {
          rangeStartFt: range.start,
          rangeEndFt: range.end,
          spacingInches: spacing,
          recommendedSize: recJoistMatch[1],
          recommendedLengthFt: parseInt(recJoistMatch[2], 10),
          cutInHalf: cutInHalf,
        };
      })
      .filter((rule) => rule !== null);
    // console.log("Processed Manual Span Rules:", manualSpanRulesInternal.length, "valid rules");

    // Logging to confirm data is loaded (can be removed in production)
    // console.log("Max Joist Span Data Defined:", maxJoistSpansData);

    if (parsedStockDataInternal.length === 0) {
      console.error("Error parsing stock list CSV data. Result is empty.");
      // Potentially update UI status here if an updateStatus function is available/imported
    }
    if (
      manualSpanRulesInternal.length === 0 &&
      rawManualSpansData.some((r) => r.joist_length_range !== "N/A")
    ) {
      console.warn(
        "Error parsing some manual span recommendations CSV data. Result is empty but source was not all N/A."
      );
    }
    if (maxJoistSpansData.length === 0) {
      console.error("Max joist span data is missing or empty.");
    }
  } catch (error) {
    console.error("Error loading or parsing data:", error);
    // Fallback to empty arrays to prevent further errors
    parsedStockDataInternal = [];
    manualSpanRulesInternal = [];
    // maxJoistSpansData is const, so it remains as defined.
  }
}

// --- Exported Data Accessors ---
// These functions allow other modules to get the parsed data.
export function getParsedStockData() {
  return parsedStockDataInternal;
}

export function getManualSpanRules() {
  return manualSpanRulesInternal;
}

export function getMaxJoistSpans() {
  return maxJoistSpansData; // Export the constant array directly
}

// Export beam span functions (IRC Table R507.6)
export { getMaxBeamSpan, validateBeamSpan, recommendBeamSize };

// ============================================
// FOOTING SIZE CALCULATIONS (IRC R403.1)
// ============================================

// Standard footing diameters available (inches)
const STANDARD_FOOTING_DIAMETERS = [12, 16, 18, 20, 24];

// Default soil bearing capacity (psf) - conservative value for unknown soil
const DEFAULT_SOIL_BEARING_CAPACITY = 1500;

// Design load for decks (psf): 40 live + 10 dead per IRC
const DECK_DESIGN_LOAD_PSF = 50;

/**
 * Calculate required footing diameter based on tributary load area
 * Per IRC R403.1, footing must be sized to support loads without exceeding soil bearing capacity
 *
 * @param {number} tributaryAreaSqFt - Tributary area supported by this footing (sq ft)
 * @param {number} soilBearingCapacity - Soil bearing capacity in psf (default 1500)
 * @returns {Object} { diameter: number, load: number, requiredArea: number, message: string }
 */
function calculateFootingDiameter(tributaryAreaSqFt, soilBearingCapacity = DEFAULT_SOIL_BEARING_CAPACITY) {
  // Calculate total load on footing
  const totalLoadLbs = tributaryAreaSqFt * DECK_DESIGN_LOAD_PSF;

  // Calculate required footing area (sq ft)
  const requiredAreaSqFt = totalLoadLbs / soilBearingCapacity;

  // Convert to required diameter (inches)
  // Area = π × r² = π × (d/2)² = π × d²/4
  // So d = √(4 × Area / π)
  // Area in sq ft needs to be converted to sq inches: multiply by 144
  const requiredAreaSqIn = requiredAreaSqFt * 144;
  const requiredDiameterIn = Math.sqrt(4 * requiredAreaSqIn / Math.PI);

  // Round up to next standard size
  let selectedDiameter = STANDARD_FOOTING_DIAMETERS[STANDARD_FOOTING_DIAMETERS.length - 1]; // Default to largest
  for (const stdDia of STANDARD_FOOTING_DIAMETERS) {
    if (stdDia >= requiredDiameterIn) {
      selectedDiameter = stdDia;
      break;
    }
  }

  // Warning if exceeds max standard size
  const warning = requiredDiameterIn > 24
    ? `Load exceeds standard footing capacity. Required: ${requiredDiameterIn.toFixed(1)}". Using 24" but consult engineer.`
    : null;

  return {
    diameter: selectedDiameter,
    load: totalLoadLbs,
    requiredArea: requiredAreaSqFt,
    calculatedDiameter: requiredDiameterIn,
    message: warning
  };
}

/**
 * Calculate tributary area for a post based on beam and joist spacing
 * Simplified: uses post spacing (beam span) × joist span / 2 for edge posts
 *
 * @param {number} postSpacingFt - Spacing between posts along beam (typically 8' max)
 * @param {number} joistSpanFt - Joist span (tributary width beam supports)
 * @param {boolean} isCorner - If true, uses 1/4 tributary; if false, uses 1/2 for edge posts
 * @returns {number} Tributary area in square feet
 */
function calculateTributaryArea(postSpacingFt, joistSpanFt, isCorner = false) {
  // Corner posts: 1/4 of the span area (half in each direction)
  // Edge posts: 1/2 of the span area on one side
  // Interior posts: full tributary (half on each side)

  const halfPostSpacing = postSpacingFt / 2;
  const halfJoistSpan = joistSpanFt / 2;

  if (isCorner) {
    // Corner: tributary extends half the post spacing × half the joist span
    return halfPostSpacing * halfJoistSpan;
  } else {
    // Edge/interior: tributary extends half the post spacing on each side × half joist span
    return postSpacingFt * halfJoistSpan;
  }
}

// Export footing functions
export { calculateFootingDiameter, calculateTributaryArea, DECK_DESIGN_LOAD_PSF, DEFAULT_SOIL_BEARING_CAPACITY };
