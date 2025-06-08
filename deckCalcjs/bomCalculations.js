// bomCalculations.js (v33 - Updated Landing Depths/Qty Rules)
import { getParsedStockData } from "./dataManager.js";
import { EPSILON } from "./config.js";
import { formatFeetInches } from "./utils.js";

// --- Stock Selection Helper Functions ---
function findBestStockLength(requiredLengthFeet, availableStockForSize) {
  if (!availableStockForSize) return null;
  let bestFit = null;
  for (const item of availableStockForSize) {
    if (item.lumber_length_ft >= requiredLengthFeet - EPSILON) {
      if (!bestFit || item.lumber_length_ft < bestFit.lumber_length_ft) {
        bestFit = item;
      }
    }
  }
  return bestFit;
}

function applyLongLengthFallback(
  size,
  requiredLength,
  usageDesc,
  stockOptions,
  bomAdderFn
) {
  if (!stockOptions || stockOptions.length === 0) {
    const descForMissing = `${String(usageDesc)} - No ${size} Stock Options`;
    bomAdderFn(null, descForMissing, 1);
    return;
  }

  let currentRequiredLength = requiredLength;
  const sortedStockOptionsByLongest = [...stockOptions].sort(
    (a, b) => (b.lumber_length_ft || 0) - (a.lumber_length_ft || 0)
  );

  if (sortedStockOptionsByLongest.length > 0) {
    const longestAvailable = sortedStockOptionsByLongest[0];
    if (currentRequiredLength >= longestAvailable.lumber_length_ft) {
      const numLongestPieces = Math.floor(
        currentRequiredLength / longestAvailable.lumber_length_ft
      );
      if (numLongestPieces > 0) {
        bomAdderFn(longestAvailable, String(usageDesc), numLongestPieces);
        currentRequiredLength -=
          numLongestPieces * longestAvailable.lumber_length_ft;
      }
    }
  }

  if (currentRequiredLength > EPSILON) {
    const sortedStockOptionsByShortest = [...stockOptions].sort(
      (a, b) => (a.lumber_length_ft || 0) - (b.lumber_length_ft || 0)
    );
    const shortestFittingStock = findBestStockLength(
      currentRequiredLength,
      sortedStockOptionsByShortest
    );

    if (shortestFittingStock) {
      bomAdderFn(shortestFittingStock, String(usageDesc), 1);
    } else if (stockOptions.length > 0) {
      const smallestStockOverall = sortedStockOptionsByShortest[0];
      if (smallestStockOverall) {
        bomAdderFn(smallestStockOverall, String(usageDesc), 1);
      } else {
        const descForError = `${String(
          usageDesc
        )} - Remainder Unfulfilled Error`;
        bomAdderFn(null, descForError, 1);
      }
    } else {
      const descForNoStock = `${String(usageDesc)} - No Stock for Remainder`;
      bomAdderFn(null, descForNoStock, 1);
    }
  }
}

// --- BOM Item Aggregation Helper ---
function addItemToBOMAggregated(bomItems, stockItem, usage, qty = 1) {
  if (qty <= 0) {
    return;
  }
  let safeUsage = usage;
  if (typeof usage !== "string") {
    safeUsage = String(usage);
    // console.warn( "addItemToBOMAggregated: 'usage' was not a string. Original:", usage, "Converted to:", safeUsage);
  }

  if (!stockItem || !stockItem.system_id) {
    const errorId = `error_stock_${safeUsage
      .replace(/[\s\W]+/g, "_")
      .slice(0, 50)}`;
    if (!bomItems[errorId]) {
      bomItems[errorId] = {
        qty: 0,
        item: "Stock Item Missing",
        description: safeUsage,
        unitPrice: 0,
        totalPrice: 0,
        _usages: new Set([safeUsage]),
      };
    }
    bomItems[errorId].qty += Math.max(0, qty);
    return;
  }

  const id = stockItem.system_id;
  const unitPrice = stockItem.retail_price || 0;
  if (!bomItems[id]) {
    bomItems[id] = {
      qty: 0,
      item: stockItem.item,
      description: safeUsage,
      unitPrice: unitPrice,
      totalPrice: 0,
      _usages: new Set([safeUsage]),
    };
  }
  bomItems[id].qty += qty;
  if (!bomItems[id]._usages.has(safeUsage) && safeUsage) {
    bomItems[id]._usages.add(safeUsage);
    const usagesArray = Array.from(bomItems[id]._usages).filter(
      (u) => u && u.trim() !== ""
    );
    if (usagesArray.length > 0) {
      bomItems[id].description = usagesArray.sort().join("; ");
    } else {
      bomItems[id].description = stockItem.item;
    }
  } else if (!bomItems[id].description && safeUsage) {
    bomItems[id].description = safeUsage;
  }
}

// --- Helper Function for Optimized Lumber Cutting ---
function optimizeLumberCutting(
  piecesToCutInput,
  materialSize,
  availableStockForSizeAll,
  bomItems,
  bomAdderFn
) {
  let remainingPiecesToCut = [...piecesToCutInput];
  const availableStockSortedShortest = [...availableStockForSizeAll].sort(
    (a, b) => a.lumber_length_ft - b.lumber_length_ft
  );

  const tempPiecesForExactMatch = [...remainingPiecesToCut];
  remainingPiecesToCut = [];

  for (const piece of tempPiecesForExactMatch) {
    const exactMatchStock = availableStockSortedShortest.find(
      (stock) => Math.abs(stock.lumber_length_ft - piece.length) < EPSILON
    );
    if (exactMatchStock) {
      bomAdderFn(
        exactMatchStock,
        `${piece.usage} (${materialSize}, ${formatFeetInches(piece.length)})`,
        1
      );
    } else {
      remainingPiecesToCut.push(piece);
    }
  }

  if (remainingPiecesToCut.length === 0) {
    return;
  }
  remainingPiecesToCut.sort((a, b) => b.length - a.length);
  let piecesToCutForOptimizer = [...remainingPiecesToCut];

  while (piecesToCutForOptimizer.length > 0) {
    let bestStockItemChoice = null;
    let cutsMadeFromBestStock = [];
    let bestOverallWaste = Infinity;

    for (const currentStockOption of availableStockForSizeAll) {
      let tempRemainingStockLength = currentStockOption.lumber_length_ft;
      const tempCutsFromThisStockOption = [];
      const tempPiecesPoolForThisStock = [...piecesToCutForOptimizer];

      for (const piece of tempPiecesPoolForThisStock) {
        if (tempRemainingStockLength >= piece.length - EPSILON) {
          tempRemainingStockLength -= piece.length;
          tempCutsFromThisStockOption.push(piece);
        }
      }

      if (tempCutsFromThisStockOption.length > 0) {
        const totalLengthCut = tempCutsFromThisStockOption.reduce(
          (sum, p) => sum + p.length,
          0
        );
        const currentWaste =
          currentStockOption.lumber_length_ft - totalLengthCut;
        let currentChoiceIsBetter = false;
        if (bestStockItemChoice === null) {
          currentChoiceIsBetter = true;
        } else if (currentWaste < bestOverallWaste - EPSILON) {
          currentChoiceIsBetter = true;
        } else if (Math.abs(currentWaste - bestOverallWaste) < EPSILON) {
          if (
            tempCutsFromThisStockOption.length > cutsMadeFromBestStock.length
          ) {
            currentChoiceIsBetter = true;
          } else if (
            tempCutsFromThisStockOption.length === cutsMadeFromBestStock.length
          ) {
            if (
              currentStockOption.lumber_length_ft <
              bestStockItemChoice.lumber_length_ft
            ) {
              currentChoiceIsBetter = true;
            } else if (
              currentStockOption.lumber_length_ft ===
              bestStockItemChoice.lumber_length_ft
            ) {
              if (
                (currentStockOption.retail_price || Infinity) <
                (bestStockItemChoice.retail_price || Infinity)
              ) {
                currentChoiceIsBetter = true;
              }
            }
          }
        }
        if (currentChoiceIsBetter) {
          bestStockItemChoice = currentStockOption;
          cutsMadeFromBestStock = tempCutsFromThisStockOption;
          bestOverallWaste = currentWaste;
        }
      }
    }

    if (bestStockItemChoice && cutsMadeFromBestStock.length > 0) {
      const cutDetails = cutsMadeFromBestStock
        .map((p) => `${formatFeetInches(p.length)} ${p.usage}`)
        .join("; ");
      const detailedUsageDesc = `Cut ${materialSize} for: ${cutDetails}`;
      bomAdderFn(bestStockItemChoice, detailedUsageDesc, 1);

      cutsMadeFromBestStock.forEach((cutPieceMade) => {
        const indexToRemove = piecesToCutForOptimizer.findIndex(
          (p) =>
            Math.abs(p.length - cutPieceMade.length) < EPSILON &&
            p.usage === cutPieceMade.usage
        );
        if (indexToRemove !== -1) {
          piecesToCutForOptimizer.splice(indexToRemove, 1);
        } else {
          const indexToRemoveByLengthOnly = piecesToCutForOptimizer.findIndex(
            (p) => Math.abs(p.length - cutPieceMade.length) < EPSILON
          );
          if (indexToRemoveByLengthOnly !== -1) {
            piecesToCutForOptimizer.splice(indexToRemoveByLengthOnly, 1);
          }
        }
      });
      if (piecesToCutForOptimizer.length > 0) {
        piecesToCutForOptimizer.sort((a, b) => b.length - a.length);
      }
    } else if (piecesToCutForOptimizer.length > 0) {
      const longestRemainingPiece = piecesToCutForOptimizer.shift();
      const bestFitForLongest = findBestStockLength(
        longestRemainingPiece.length,
        availableStockForSizeAll
      );
      if (bestFitForLongest) {
        const formattedLength = formatFeetInches(longestRemainingPiece.length);
        if (
          Math.abs(
            bestFitForLongest.lumber_length_ft - longestRemainingPiece.length
          ) < EPSILON
        ) {
          bomAdderFn(
            bestFitForLongest,
            `${longestRemainingPiece.usage} (${materialSize}, ${formattedLength})`,
            1
          );
        } else {
          bomAdderFn(
            bestFitForLongest,
            `Cut for ${longestRemainingPiece.usage} (${materialSize}, ${formattedLength})`,
            1
          );
        }
      } else {
        applyLongLengthFallback(
          materialSize,
          longestRemainingPiece.length,
          `${longestRemainingPiece.usage} (${materialSize}, ${formatFeetInches(
            longestRemainingPiece.length
          )})`,
          availableStockForSizeAll,
          bomAdderFn
        );
      }
    } else {
      break;
    }
  }
}

// --- Component Processing Functions ---
function processLumber(structure, inputs, bomItems, parsedStockData) {
  const allLumberPieces = [
    ...(structure.ledger
      ? [
          {
            ...structure.ledger,
            usage: "Ledger",
            lengthFeet: structure.ledger.lengthFeet,
          },
        ]
      : []),
    ...structure.beams.flatMap((beam) =>
      Array(beam.ply || 1)
        .fill(null)
        .map(() => ({
          size: beam.size,
          lengthFeet: beam.lengthFeet,
          usage: beam.usage || "Beam",
        }))
    ),
    ...structure.joists.map((j) => ({ ...j, usage: j.usage || "Joist" })),
    ...structure.rimJoists.map((r) => ({
      ...r,
      usage: r.usage || "Rim/End Joist",
    })),
    ...structure.posts.map((p) => ({
      size: p.size,
      lengthFeet: p.heightFeet,
      usage: "Post",
    })),
    ...structure.midSpanBlocking.flatMap((block) =>
      Array(block.boardCount || 1)
        .fill(null)
        .map(() => ({
          size: block.size,
          lengthFeet: block.lengthFeet,
          usage: block.usage || "Mid-Span Blocking",
        }))
    ),
    ...structure.pictureFrameBlocking.map((pf) => ({
      ...pf,
      usage: "Picture Frame Blocking",
    })),
  ].filter((p) => p && p.lengthFeet > EPSILON && p.size);

  const requiredLumberByMaterialSize = allLumberPieces.reduce((acc, piece) => {
    if (!acc[piece.size]) {
      acc[piece.size] = [];
    }
    acc[piece.size].push({ length: piece.lengthFeet, usage: piece.usage });
    return acc;
  }, {});

  const wrappedBomAdder = (stock, usage, qty) =>
    addItemToBOMAggregated(bomItems, stock, usage, qty);

  for (const materialSize in requiredLumberByMaterialSize) {
    let piecesToCutForThisSize = [
      ...requiredLumberByMaterialSize[materialSize],
    ];

    const availableStockForThisSize = parsedStockData
      .filter(
        (item) =>
          item.lumber_size === materialSize &&
          typeof item.lumber_length_ft === "number" &&
          item.lumber_length_ft > 0
      )
      .sort((a, b) => {
        if (a.lumber_length_ft !== b.lumber_length_ft) {
          return a.lumber_length_ft - b.lumber_length_ft;
        }
        return (a.retail_price || Infinity) - (b.retail_price || Infinity);
      });

    if (availableStockForThisSize.length === 0) {
      piecesToCutForThisSize.forEach((piece) =>
        addItemToBOMAggregated(
          bomItems,
          null,
          `${piece.usage} (${materialSize}) - No Stock`,
          1
        )
      );
      continue;
    }

    if (
      materialSize === "2x8" &&
      structure.totalDepthFeet > 18.0 + EPSILON &&
      structure.totalDepthFeet <= 20.0 + EPSILON
    ) {
      const stock20ft_2x8 = availableStockForThisSize.find(
        (s) => Math.abs(s.lumber_length_ft - 20.0) < EPSILON
      );
      if (stock20ft_2x8) {
        const tempForOverrideProcessing = [...piecesToCutForThisSize];
        piecesToCutForThisSize = [];

        tempForOverrideProcessing.forEach((piece) => {
          if (
            (piece.usage === "Joist" ||
              piece.usage === "Rim/End Joist" ||
              piece.usage === "Outer Rim Joist" ||
              piece.usage === "Picture Frame Joist") &&
            piece.length > 17.5
          ) {
            addItemToBOMAggregated(
              bomItems,
              stock20ft_2x8,
              `${piece.usage} (${materialSize}, ${formatFeetInches(
                piece.length
              )}) using 20ft Override`,
              1
            );
          } else {
            piecesToCutForThisSize.push(piece);
          }
        });
      }
    }

    if (piecesToCutForThisSize.length > 0) {
      optimizeLumberCutting(
        piecesToCutForThisSize,
        materialSize,
        availableStockForThisSize,
        bomItems,
        wrappedBomAdder
      );
    }
  }
}

function processFootings(structure, inputs, bomItems, parsedStockData) {
  const footingCount = structure.footings?.length || 0;
  if (footingCount > 0) {
    const footingType = inputs.footingType;
    let footingItem = null,
      slabItem = null,
      footingDesc = "Footing";
    if (footingType === "gh_levellers") {
      footingItem = parsedStockData.find((i) =>
        i.item?.toLowerCase().includes("gh deck leveller")
      );
      slabItem = parsedStockData.find((i) =>
        i.item?.toLowerCase().includes("deck slab 16x16")
      );
      footingDesc = "GH Leveller + Slab";
    } else if (footingType === "pylex") {
      footingItem = parsedStockData.find((i) =>
        i.item?.toLowerCase().includes('pylex 50" screw pile')
      );
      footingDesc = 'Pylex 50" Screw Pile';
    } else if (footingType === "helical") {
      footingItem = parsedStockData.find((i) =>
        i.item?.toLowerCase().includes("helical screw pile installed")
      );
      footingDesc = "Helical Pile (Installed)";
    }
    addItemToBOMAggregated(bomItems, footingItem, footingDesc, footingCount);
    if (slabItem)
      addItemToBOMAggregated(
        bomItems,
        slabItem,
        "Deck Slab 16x16",
        footingCount
      );
  }
}

function processHardwareAndAccessories(
  structure,
  inputs,
  bomItems,
  parsedStockData,
  deckDimensions
) {
  let totalScrews1_5 = 0;
  let totalScrews2_5 = 0;

  if (!structure || !deckDimensions) {
    return { totalScrews1_5, totalScrews2_5 };
  }

  const primaryJoistSize =
    structure.joists?.[0]?.size ||
    structure.rimJoists?.find(
      (rj) => rj.usage === "End Joist" || rj.usage === "Outer Rim Joist"
    )?.size ||
    structure.beams?.[0]?.size ||
    "2x8";

  if (inputs.attachmentType === "house_rim" && structure.ledger) {
    const lenIn = structure.ledger.lengthFeet * 12;
    const count = Math.max(4, Math.ceil(lenIn / 16) * 2);
    const item = parsedStockData.find(
      (i) =>
        i.item?.toLowerCase().includes("grk rugged") &&
        i.item?.includes('4"') &&
        i.item?.toLowerCase().includes("single")
    );
    addItemToBOMAggregated(bomItems, item, 'Ledger Fastener (GRK 4")', count);
  } else if (
    inputs.attachmentType === "concrete" &&
    structure.rimJoists?.some((r) => r.usage === "Wall Rim Joist")
  ) {
    const wallRim = structure.rimJoists.find(
      (r) => r.usage === "Wall Rim Joist"
    );
    if (wallRim) {
      const lenIn = wallRim.lengthFeet * 12;
      const count = Math.max(4, Math.ceil(lenIn / 16) * 2);
      const searchTerm = "titen hd mg 1/2x4 single";
      const item = parsedStockData.find(
        (i) => i.item?.toLowerCase() === searchTerm
      );
      addItemToBOMAggregated(
        bomItems,
        item,
        "Wall Rim Fastener (Titen HD 1/2X4)",
        count
      );
    }
  }

  let tieCount = 0;
  const mainAndPFJoists = structure.joists || [];
  tieCount += mainAndPFJoists.length;

  const endJoistSegments = (structure.rimJoists || []).filter(
    (r) => r.usage === "End Joist"
  );
  tieCount += endJoistSegments.length;

  if (tieCount > 0) {
    const h25Item = parsedStockData.find((i) =>
      i.item?.toLowerCase().includes("h2.5az")
    );
    addItemToBOMAggregated(bomItems, h25Item, "H2.5 Tie", tieCount);
    if (h25Item) totalScrews1_5 += tieCount * 10;
  }

  let hanger_count_final = 0;
  const candidateJoistSegmentsForHangers = (structure.joists || []).filter(
    (j) => j.usage === "Joist" || j.usage === "Picture Frame Joist"
  );

  if (candidateJoistSegmentsForHangers.length > 0) {
    let numCandidateJoistRuns = candidateJoistSegmentsForHangers.length;
    const hasMidBeam = structure.beams?.some(
      (b) => b.usage === "Mid Beam" && !b.isFlush
    );
    if (hasMidBeam && candidateJoistSegmentsForHangers.length > 1) {
      numCandidateJoistRuns = candidateJoistSegmentsForHangers.length / 2;
    }
    numCandidateJoistRuns = Math.ceil(numCandidateJoistRuns);

    if (inputs.beamType === "drop") {
      if (inputs.attachmentType === "house_rim" && structure.ledger) {
        hanger_count_final = numCandidateJoistRuns;
      } else if (
        inputs.attachmentType === "concrete" &&
        structure.rimJoists?.some((r) => r.usage === "Wall Rim Joist")
      ) {
        hanger_count_final = numCandidateJoistRuns;
      } else if (inputs.attachmentType === "floating") {
        const wallSideBeam = structure.beams?.find(
          (b) => b.usage === "Wall-Side Beam"
        );
        if (wallSideBeam && wallSideBeam.isFlush) {
          hanger_count_final = numCandidateJoistRuns;
        } else {
          hanger_count_final = 0;
        }
      } else {
        hanger_count_final = 0;
      }
    } else {
      // Flush beamType
      console.warn(
        "Hanger logic for 'flush' beam type for Joists/PF Joists is using candidateJoistSegmentsForHangers.length * 2. This assumes all ends connect to a flush member."
      );
      hanger_count_final = candidateJoistSegmentsForHangers.length * 2;
    }
  }

  if (hanger_count_final > 0) {
    let hangerLookup = "";
    let screws_1_5_per_hanger = 0;
    let screws_2_5_per_hanger = 0;
    if (primaryJoistSize === "2x6") {
      hangerLookup = "lus26z";
      screws_1_5_per_hanger = 4;
      screws_2_5_per_hanger = 4;
    } else if (primaryJoistSize === "2x8") {
      hangerLookup = "lus28z";
      screws_1_5_per_hanger = 6;
      screws_2_5_per_hanger = 4;
    } else if (primaryJoistSize === "2x10" || primaryJoistSize === "2x12") {
      hangerLookup = "lus210z";
      screws_1_5_per_hanger = 8;
      screws_2_5_per_hanger = 4;
    }
    if (hangerLookup) {
      const item = parsedStockData.find(
        (i) =>
          i.item?.toLowerCase().includes(hangerLookup) &&
          i.item?.toLowerCase().includes("lus")
      );
      addItemToBOMAggregated(
        bomItems,
        item,
        `Joist Hanger (${primaryJoistSize} for Joist/PF Joist)`,
        hanger_count_final
      );
      if (item) {
        totalScrews1_5 += hanger_count_final * screws_1_5_per_hanger;
        totalScrews2_5 += hanger_count_final * screws_2_5_per_hanger;
      }
    }
  }

  const postCount = structure.posts?.length || 0;
  if (postCount > 0 && structure.posts[0]?.size) {
    const pSize = structure.posts[0].size;
    const mainBeamConnectedToPosts = structure.beams?.find(
      (b) => b.usage !== "Ledger" && b.lengthFeet > 0
    );
    const beamPlyForConnector =
      mainBeamConnectedToPosts?.ply || (pSize === "6x6" ? 3 : 2);

    let connectorLookup = "";
    let screws_per_bcs = 0;

    if (pSize === "4x4" && beamPlyForConnector === 2) {
      connectorLookup = "bcs2-2/4z";
      screws_per_bcs = 12;
    } else if (pSize === "6x6" && beamPlyForConnector === 3) {
      connectorLookup = "bcs2-3/6z";
      screws_per_bcs = 16;
    }

    if (connectorLookup) {
      const item = parsedStockData.find(
        (i) =>
          i.item?.toLowerCase().includes(connectorLookup) &&
          i.item?.toLowerCase().includes("bcs")
      );
      addItemToBOMAggregated(
        bomItems,
        item,
        `Beam Connector (${pSize} Post, ${beamPlyForConnector}-ply Beam)`,
        postCount
      );
      if (item) totalScrews2_5 += postCount * screws_per_bcs;
    }
  }

  const numCornerAngles = 4;
  if (primaryJoistSize) {
    let angleLookup = "";
    let screws_per_angle = 0;
    if (primaryJoistSize === "2x6") {
      angleLookup = "l50z";
      screws_per_angle = 6;
    } else if (primaryJoistSize === "2x8") {
      angleLookup = "l70z";
      screws_per_angle = 8;
    } else if (primaryJoistSize === "2x10" || primaryJoistSize === "2x12") {
      angleLookup = "l90z";
      screws_per_angle = 10;
    }

    if (angleLookup) {
      const item = parsedStockData.find(
        (i) =>
          i.item?.toLowerCase().includes(angleLookup) &&
          !i.item?.toLowerCase().includes("ls") &&
          (i.item?.toLowerCase().includes(" zmax") ||
            i.item?.toLowerCase().includes(" angle"))
      );
      addItemToBOMAggregated(
        bomItems,
        item,
        `Corner Angle (${angleLookup.toUpperCase()})`,
        numCornerAngles
      );
      if (item) totalScrews1_5 += numCornerAngles * screws_per_angle;
    }
  }

  const deckAreaSqFt = deckDimensions.actualAreaSqFt;
  const estUnitsScrews = Math.max(100, Math.ceil(deckAreaSqFt * 5));
  const estLbsScrewsByWeight = Math.max(1, Math.ceil(deckAreaSqFt * 0.05));

  let fItem = null,
    fQty = 0,
    fDesc = "Framing Fasteners";
  if (inputs.fasteners === "screws_3in") {
    fItem = parsedStockData.find(
      (i) =>
        i.item?.toLowerCase().includes("brown deck screw") &&
        i.item?.includes('3"') &&
        i.pkg_unit?.toLowerCase() === "lb"
    );
    fQty = estLbsScrewsByWeight;
    fDesc = `Framing Screws (3" per lb estimate)`;
  } else if (inputs.fasteners === "u2_3_18") {
    const boxes = parsedStockData
      .filter(
        (i) =>
          i.item?.toLowerCase().includes("u2 universal screw") &&
          i.item?.includes('3 1/8"') &&
          i.pkg_unit === "box"
      )
      .sort((a, b) => (a.pkg_qty || 0) - (b.pkg_qty || 0));
    if (boxes.length > 0 && boxes[0].pkg_qty > 0) {
      fItem = boxes[0];
      fQty = Math.ceil(estUnitsScrews / fItem.pkg_qty);
      fDesc = `Framing Screws (U2 3-1/8" x${fItem.pkg_qty}ct)`;
    }
  } else if (inputs.fasteners === "paslode_3_14") {
    fItem = parsedStockData.find(
      (i) =>
        i.item?.toLowerCase().includes("paslode") && i.item?.includes('3-1/4"')
    );
    if (fItem) {
      const estNails = Math.max(200, Math.ceil(deckAreaSqFt * 10));
      fQty = Math.ceil(estNails / (fItem.pkg_qty || 2000));
      fDesc = `Framing Nails (Paslode 3-1/4")`;
    }
  }
  if (fItem && fQty > 0) addItemToBOMAggregated(bomItems, fItem, fDesc, fQty);
  else
    addItemToBOMAggregated(
      bomItems,
      null,
      `${fDesc} - No Stock Found or Zero Qty`,
      1
    );

  if (inputs.joistProtection !== "none") {
    let lfProtectJoistsRimsLedger =
      (structure.joists?.reduce((s, j) => s + j.lengthFeet, 0) || 0) +
      (structure.rimJoists?.reduce((s, r) => s + r.lengthFeet, 0) || 0) +
      (structure.ledger?.lengthFeet || 0);
    const rollFt = 65;

    if (inputs.joistProtection === "gtape") {
      if (lfProtectJoistsRimsLedger > 0) {
        const rolls = Math.ceil(lfProtectJoistsRimsLedger / rollFt);
        const item = parsedStockData.find(
          (i) =>
            i.item?.toLowerCase().includes("g-tape") && i.item?.includes('2"')
        );
        addItemToBOMAggregated(
          bomItems,
          item,
          'G-Tape (2" for Joists/Rims/Ledger)',
          rolls
        );
      }
      structure.beams?.forEach((b) => {
        const beamSurfaceLf = b.lengthFeet * b.ply;
        const tapeWidth = b.ply >= 3 ? '6"' : '4"';
        const rolls = Math.ceil(beamSurfaceLf / rollFt);
        if (rolls > 0) {
          const item = parsedStockData.find(
            (i) =>
              i.item?.toLowerCase().includes("g-tape") &&
              i.item?.includes(tapeWidth)
          );
          addItemToBOMAggregated(
            bomItems,
            item,
            `G-Tape (${tapeWidth} for ${b.usage})`,
            rolls
          );
        }
      });
    } else if (inputs.joistProtection === "coating") {
      let coatLf = lfProtectJoistsRimsLedger;
      structure.beams?.forEach((b) => (coatLf += b.lengthFeet * b.ply));

      if (coatLf > 0) {
        const pails = Math.ceil(coatLf / 450);
        const item = parsedStockData.find((i) =>
          i.item?.toLowerCase().includes("deck frame coating")
        );
        addItemToBOMAggregated(bomItems, item, "Deck Frame Coating", pails);
      }
    }
  }
  const needsLumber =
    (structure.joists?.length || 0) +
      (structure.beams?.length || 0) +
      (structure.posts?.length || 0) >
    0;
  if (needsLumber) {
    const sealer = parsedStockData.find((i) =>
      i.item?.toLowerCase().includes("end cut sealer")
    );
    addItemToBOMAggregated(bomItems, sealer, "End Cut Sealer", 1);

    if (sealer || inputs.joistProtection === "coating") {
      const brush = parsedStockData.find((i) =>
        i.item?.toLowerCase().includes("polyester stain brush")
      );
      addItemToBOMAggregated(bomItems, brush, "Applicator Brush", 1);
    }
  }
  return { totalScrews1_5, totalScrews2_5 };
}

function processStairs(
  stairs,
  bomItems,
  parsedStockData,
  deckHeightInches,
  initialScrews1_5,
  initialScrews2_5
) {
  let currentTotalScrews1_5 = initialScrews1_5;
  let currentTotalScrews2_5 = initialScrews2_5;
  let totalPylexStringerPiecesForFasteners = 0;
  const wrappedBomAdder = (stock, usage, qty) =>
    addItemToBOMAggregated(bomItems, stock, usage, qty);

  if (stairs && stairs.length > 0) {
    const allPylexStringerItems = parsedStockData.filter(
      (i) =>
        i.item?.toLowerCase().includes("pylex steel stringer") &&
        i.item?.toLowerCase().includes("step")
    );
    let maxAvailablePylexStepSize = 0;
    allPylexStringerItems.forEach((item) => {
      const match = item.item.match(/(\d+)\s*step/i);
      if (match)
        maxAvailablePylexStepSize = Math.max(
          maxAvailablePylexStepSize,
          parseInt(match[1])
        );
    });
    if (maxAvailablePylexStepSize === 0 && allPylexStringerItems.length > 0)
      maxAvailablePylexStepSize = 7;
    else if (allPylexStringerItems.length === 0) maxAvailablePylexStepSize = 0;

    stairs.forEach((stair, index) => {
      if (stair.calculationError) {
        addItemToBOMAggregated(
          bomItems,
          null,
          `Stair ${index + 1} - Error: ${stair.calculationError}`,
          1
        );
        return;
      }
      const stairDescSuffix = stairs.length > 1 ? ` (Stair ${index + 1})` : "";
      let needsPylexConnectorsForThisStairSet = false;

      if (
        stair.stringerType === "pylex_steel" &&
        stair.calculatedStringerQty > 0
      ) {
        totalPylexStringerPiecesForFasteners += stair.calculatedStringerQty;
        if (maxAvailablePylexStepSize === 0) {
          addItemToBOMAggregated(
            bomItems,
            null,
            `Pylex Stringers${stairDescSuffix} - No Pylex Stock Found`,
            stair.calculatedStringerQty
          );
        } else if (stair.calculatedNumSteps <= maxAvailablePylexStepSize) {
          const stepsToLookup = Math.min(
            maxAvailablePylexStepSize,
            Math.max(1, stair.calculatedNumSteps || 1)
          );
          const searchTerm = `${stepsToLookup} step`.toLowerCase();
          const pylexItem = allPylexStringerItems.find((i) =>
            i.item?.toLowerCase().includes(searchTerm)
          );
          addItemToBOMAggregated(
            bomItems,
            pylexItem,
            `Pylex Stringer (${stepsToLookup}-Step)${stairDescSuffix}`,
            stair.calculatedStringerQty
          );
        } else {
          needsPylexConnectorsForThisStairSet = true;
          let remainingStepsForThisStair = stair.calculatedNumSteps;
          const firstPartSteps = maxAvailablePylexStepSize;
          const firstPartSearchTerm = `${firstPartSteps} step`.toLowerCase();
          const firstPylexItem = allPylexStringerItems.find((i) =>
            i.item?.toLowerCase().includes(firstPartSearchTerm)
          );
          addItemToBOMAggregated(
            bomItems,
            firstPylexItem,
            `Pylex Stringer (${firstPartSteps}-Step Upper)${stairDescSuffix}`,
            stair.calculatedStringerQty
          );
          remainingStepsForThisStair -= firstPartSteps;
          if (remainingStepsForThisStair > 0) {
            const secondPartSteps = Math.min(
              maxAvailablePylexStepSize,
              Math.max(1, remainingStepsForThisStair)
            );
            const secondPartSearchTerm =
              `${secondPartSteps} step`.toLowerCase();
            const secondPylexItem = allPylexStringerItems.find((i) =>
              i.item?.toLowerCase().includes(secondPartSearchTerm)
            );
            addItemToBOMAggregated(
              bomItems,
              secondPylexItem,
              `Pylex Stringer (${secondPartSteps}-Step Lower)${stairDescSuffix}`,
              stair.calculatedStringerQty
            );
          }
        }
        if (needsPylexConnectorsForThisStairSet) {
          const connectorItem = parsedStockData.find((i) =>
            i.item
              ?.toLowerCase()
              .includes("pylex steel stair stringer connector bracket")
          );
          addItemToBOMAggregated(
            bomItems,
            connectorItem,
            `Pylex Stringer Connector${stairDescSuffix}`,
            stair.calculatedStringerQty
          );
        }
      } else if (
        stair.stringerType === "lvl_wood" &&
        stair.calculatedStringerQty > 0
      ) {
        const maxLVLSteps = 8;
        const stepsToLookup = Math.min(
          maxLVLSteps,
          Math.max(2, stair.calculatedNumSteps || 2)
        );
        const searchTerm = `${stepsToLookup} step`.toLowerCase();
        const lvlItem = parsedStockData.find(
          (i) =>
            i.item
              ?.toLowerCase()
              .includes("pressure treated lvl stair stringer") &&
            i.item?.toLowerCase().includes(searchTerm)
        );
        addItemToBOMAggregated(
          bomItems,
          lvlItem,
          `LVL Stringer (${stepsToLookup}-Step)${stairDescSuffix}`,
          stair.calculatedStringerQty
        );
      } else if (
        stair.stringerType === "custom_2x12" &&
        stair.calculatedStringerQty > 0
      ) {
        const totalRiseInchesForStringer =
          stair.deckHeightInches || deckHeightInches;
        const totalRunInchesForStringer = stair.calculatedTotalRunInches;
        const stringerLengthFeetEach =
          Math.sqrt(
            Math.pow(totalRiseInchesForStringer / 12, 2) +
              Math.pow(totalRunInchesForStringer / 12, 2)
          ) + 0.5;

        if (stringerLengthFeetEach > EPSILON) {
          const stringerPiecesForOptimization = [];
          for (let i = 0; i < stair.calculatedStringerQty; i++) {
            stringerPiecesForOptimization.push({
              length: stringerLengthFeetEach,
              usage: `Custom Stringer${stairDescSuffix}`,
            });
          }
          const available2x12Stock = parsedStockData
            .filter((i) => i.lumber_size === "2x12")
            .sort((a, b) => {
              if (a.lumber_length_ft !== b.lumber_length_ft) {
                return a.lumber_length_ft - b.lumber_length_ft;
              }
              return (
                (a.retail_price || Infinity) - (b.retail_price || Infinity)
              );
            });

          if (
            available2x12Stock.length > 0 &&
            stringerPiecesForOptimization.length > 0
          ) {
            optimizeLumberCutting(
              stringerPiecesForOptimization,
              "2x12",
              available2x12Stock,
              bomItems,
              wrappedBomAdder
            );
          } else if (stringerPiecesForOptimization.length > 0) {
            stringerPiecesForOptimization.forEach((piece) => {
              addItemToBOMAggregated(
                bomItems,
                null,
                `Custom 2x12 Stringer${stairDescSuffix} - No Stock`,
                1
              );
            });
          }
        }
      }

      // Landing Materials
      if (stair.landingType === "slabs_16x16") {
        const stairWidthInches = stair.widthFt * 12;
        const totalSlabs = Math.ceil(stairWidthInches / 16); // Rule: 1 slab per 16 inches of stair width.

        const slabItem = parsedStockData.find((i) =>
          i.item?.toLowerCase().includes("deck slab 16x16")
        );
        addItemToBOMAggregated(
          bomItems,
          slabItem,
          `Landing Slabs (16x16)${stairDescSuffix}`,
          totalSlabs
        );
      } else if (stair.landingType === "concrete_pad") {
        const landingDepthFt = 4.0; // Default depth is 4ft.

        const landingAreaSqFt = stair.widthFt * landingDepthFt;
        const bagsNeeded = Math.ceil(landingAreaSqFt); // Rule: 1 bag per sq ft.

        const concreteItem = parsedStockData.find((i) =>
          i.item?.toLowerCase().includes("quikrete 30kg")
        );
        addItemToBOMAggregated(
          bomItems,
          concreteItem,
          `Concrete Mix for Landing Pad (${stair.widthFt}'W x ${landingDepthFt}'D)${stairDescSuffix}`,
          bagsNeeded
        );

        const formLumberSize = "2x4";
        const perimeterFt = 2 * (stair.widthFt + landingDepthFt);
        const twoByFourStock = parsedStockData.filter(
          (i) => i.lumber_size === formLumberSize
        );
        if (twoByFourStock.length > 0 && perimeterFt > EPSILON) {
          applyLongLengthFallback(
            formLumberSize,
            perimeterFt,
            `2x4 Forms for Concrete Pad${stairDescSuffix}`,
            twoByFourStock,
            wrappedBomAdder
          );
        } else if (perimeterFt > EPSILON) {
          addItemToBOMAggregated(
            bomItems,
            null,
            `2x4 Forms for Concrete Pad${stairDescSuffix} - No 2x4 Stock`,
            1
          );
        }
      }

      if (
        stair.calculatedStringerQty > 0 &&
        (stair.stringerType === "lvl_wood" ||
          stair.stringerType === "custom_2x12")
      ) {
        const lsczItem = parsedStockData.find((i) =>
          i.item
            ?.toLowerCase()
            .includes("lscz adjustable stair stringer connector")
        );
        const numLSCZConnectors = stair.calculatedStringerQty * 2;
        addItemToBOMAggregated(
          bomItems,
          lsczItem,
          `Stair Stringer Connector (LSCZ)${stairDescSuffix}`,
          numLSCZConnectors
        );
        if (lsczItem) {
          currentTotalScrews1_5 += numLSCZConnectors * 12;
        }
      }
    });
  }
  if (totalPylexStringerPiecesForFasteners > 0) {
    const grkForItem = 'GRK Rugged Structural Screws 5/16 x 4" Gold Single';
    const grkStockItem = parsedStockData.find((i) => i.item === grkForItem);
    addItemToBOMAggregated(
      bomItems,
      grkStockItem,
      "GRK Fasteners for Pylex Stringers",
      totalPylexStringerPiecesForFasteners * 2
    );
  }

  return {
    totalScrews1_5: currentTotalScrews1_5,
    totalScrews2_5: currentTotalScrews2_5,
  };
}

export function calculateBOM(structure, inputs, stairs, deckDimensions) {
  const bomItems = {};
  const parsedStockData = getParsedStockData();

  if (!parsedStockData || parsedStockData.length === 0) {
    return { error: "Stock data unavailable. Cannot generate BOM." };
  }
  if (!structure || structure.error) {
    return {
      error:
        structure?.error ||
        "Structure calculation failed. Cannot generate BOM.",
    };
  }
  if (!inputs) {
    return { error: "Input specifications missing. Cannot generate BOM." };
  }
  if (!deckDimensions) {
    return { error: "Deck dimensions missing for BOM calculation." };
  }

  try {
    processLumber(structure, inputs, bomItems, parsedStockData);
    processFootings(structure, inputs, bomItems, parsedStockData);
    let screwCounts = processHardwareAndAccessories(
      structure,
      inputs,
      bomItems,
      parsedStockData,
      deckDimensions
    );
    screwCounts = processStairs(
      stairs,
      bomItems,
      parsedStockData,
      inputs.deckHeight,
      screwCounts.totalScrews1_5,
      screwCounts.totalScrews2_5
    );

    const findBestScrewBoxes = (
      totalNeeded,
      screwDesc,
      stockData,
      currentBomItems
    ) => {
      if (totalNeeded <= 0) return;
      const availableBoxes = stockData
        .filter(
          (i) =>
            i.item?.toLowerCase().includes("sd connector screw") &&
            i.item?.toLowerCase().includes(screwDesc.toLowerCase()) &&
            i.pkg_unit === "box" &&
            (i.pkg_qty || 0) > 0
        )
        .sort((a, b) => (a.pkg_qty || 0) - (b.pkg_qty || 0));

      let remainingNeeded = totalNeeded;
      if (availableBoxes.length > 0) {
        const chosenBox = availableBoxes[0];
        const numBoxes = Math.ceil(remainingNeeded / chosenBox.pkg_qty);
        addItemToBOMAggregated(
          currentBomItems,
          chosenBox,
          `SD Screws ${screwDesc} (Box of ${chosenBox.pkg_qty})`,
          numBoxes
        );
        remainingNeeded = 0;
      }

      if (remainingNeeded > 0) {
        const singleItem = stockData.find(
          (i) =>
            i.item?.toLowerCase().includes("sd connector screw") &&
            i.item?.toLowerCase().includes(screwDesc.toLowerCase()) &&
            i.pkg_unit !== "box"
        );
        if (singleItem) {
          addItemToBOMAggregated(
            currentBomItems,
            singleItem,
            `SD Screws ${screwDesc} (Singles)`,
            remainingNeeded
          );
        } else {
          addItemToBOMAggregated(
            currentBomItems,
            null,
            `SD Screws ${screwDesc} - No Suitable Stock/Singles`,
            remainingNeeded
          );
        }
      }
    };

    findBestScrewBoxes(
      screwCounts.totalScrews1_5,
      '1-1/2"',
      parsedStockData,
      bomItems
    );
    findBestScrewBoxes(
      screwCounts.totalScrews2_5,
      '2-1/2"',
      parsedStockData,
      bomItems
    );

    const finalBOM = Object.values(bomItems)
      .map((item) => {
        if (
          item.qty > 0 &&
          item.qty % 1 !== 0 &&
          item.pkg_unit !== "lb" &&
          !item.item?.toLowerCase().includes("override")
        ) {
          item.qty = Math.ceil(item.qty);
        }
        if (
          item.qty > 0 &&
          item.qty < 1 &&
          item.pkg_unit !== "lb" &&
          item.pkg_unit !== "roll" &&
          !item.item?.toLowerCase().includes("override")
        ) {
          item.qty = 1;
        }
        if (item.qty < 0) item.qty = 0;
        item.totalPrice = item.qty * item.unitPrice;
        delete item._usages;
        return item;
      })
      .filter((item) => item.qty > 0);

    return finalBOM.sort((a, b) => (a.item || "").localeCompare(b.item || ""));
  } catch (error) {
    console.error("Error during BOM Calculation:", error);
    return {
      error: `BOM Calculation Error: ${
        error.message || "Unknown error"
      }. Check console for details.`,
    };
  }
}
