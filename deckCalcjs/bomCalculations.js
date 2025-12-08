// bomCalculations.js (v33 - Updated Landing Depths/Qty Rules)
import { getParsedStockData } from "./dataManager.js?v=8";
import { EPSILON } from "./config.js?v=8";
import { formatFeetInches } from "./utils.js?v=8";

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
    bomAdderFn(null, descForMissing, 1, getCategoryForUsage(usageDesc));
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
        bomAdderFn(longestAvailable, String(usageDesc), numLongestPieces, getCategoryForUsage(usageDesc));
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
      bomAdderFn(shortestFittingStock, String(usageDesc), 1, getCategoryForUsage(usageDesc));
    } else if (stockOptions.length > 0) {
      const smallestStockOverall = sortedStockOptionsByShortest[0];
      if (smallestStockOverall) {
        bomAdderFn(smallestStockOverall, String(usageDesc), 1, getCategoryForUsage(usageDesc));
      } else {
        const descForError = `${String(
          usageDesc
        )} - Remainder Unfulfilled Error`;
        bomAdderFn(null, descForError, 1, getCategoryForUsage(usageDesc));
      }
    } else {
      const descForNoStock = `${String(usageDesc)} - No Stock for Remainder`;
      bomAdderFn(null, descForNoStock, 1, getCategoryForUsage(usageDesc));
    }
  }
}

// --- Helper function to map usage strings to BOM categories ---
function getCategoryForUsage(usage) {
  if (!usage) return "FRAMING";
  const usageStr = String(usage).toLowerCase();

  // Check for stairs first
  if (usageStr.includes("stair") || usageStr.includes("step") || usageStr.includes("stringer") ||
      usageStr.includes("landing") || usageStr.includes("lscz") || usageStr.includes("grk fasteners for pylex")) {
    return "STAIRS";
  }

  // Check for decking materials
  if (usageStr.includes("decking") || usageStr.includes("deck board") || usageStr.includes("fascia") ||
      usageStr.includes("picture frame")) {
    return "DECKING";
  }

  // Check for railing materials
  if (usageStr.includes("railing") || usageStr.includes("baluster") || usageStr.includes("handrail") ||
      usageStr.includes("spindle") || usageStr.includes("newel")) {
    return "RAILING";
  }

  // Check for hardware (screws, nails, fasteners, brackets, hangers)
  if (usageStr.includes("screw") || usageStr.includes("nail") || usageStr.includes("fastener") ||
      usageStr.includes("bracket") || usageStr.includes("hanger") || usageStr.includes("bolt") ||
      usageStr.includes("anchor") || usageStr.includes("tico") || usageStr.includes("simpson") ||
      usageStr.includes("lus") || usageStr.includes("lsc")) {
    return "HARDWARE";
  }

  // Check for beams, posts, footings
  if (usageStr.includes("beam") || usageStr.includes("post") || usageStr.includes("footing") ||
      usageStr.includes("ledger fastener") || usageStr.includes("wall rim fastener")) {
    return "BEAMS & POSTS";
  }

  // Default to framing (joists, ledger, rims, blocking)
  return "FRAMING";
}

// Simplify usage descriptions to just show component type (no cut dimensions)
function getSimplifiedUsage(usage) {
  if (!usage) return "";
  const usageStr = String(usage).toLowerCase();

  // Map usage strings to simple descriptions
  if (usageStr.includes("joist")) return "Joists";
  if (usageStr.includes("ledger")) return "Ledger";
  if (usageStr.includes("rim")) return "Rim Joists";
  if (usageStr.includes("blocking")) return "Blocking";
  if (usageStr.includes("beam")) return "Beams";
  if (usageStr.includes("post")) return "Posts";
  if (usageStr.includes("footing")) return "Footings";
  if (usageStr.includes("stringer")) return "Stair Stringers";
  if (usageStr.includes("stair") || usageStr.includes("step")) return "Stairs";
  if (usageStr.includes("landing")) return "Landing";
  if (usageStr.includes("fastener") || usageStr.includes("hardware")) return "Hardware";
  if (usageStr.includes("hanger")) return "Joist Hangers";
  if (usageStr.includes("bracket")) return "Brackets";
  if (usageStr.includes("anchor")) return "Anchors";
  if (usageStr.includes("screw") || usageStr.includes("nail")) return "Fasteners";
  if (usageStr.includes("tape")) return "Tape";
  if (usageStr.includes("decking")) return "Decking";

  // Return a cleaned up version if no specific match
  // Remove parenthetical details like "(2x8, 10'6")"
  return usage.replace(/\s*\([^)]*\)/g, '').trim();
}

// --- BOM Item Aggregation Helper ---
function addItemToBOMAggregated(bomItems, stockItem, usage, qty = 1, category = null) {
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

  // Use only the system_id as the key - no category separation
  const id = stockItem.system_id;

  // Get simplified usage (just component type like "Joists", "Beams", etc.)
  const simplifiedUsage = getSimplifiedUsage(safeUsage);

  const unitPrice = stockItem.retail_price || 0;
  // Determine the category from usage if not provided
  const itemCategory = category || getCategoryForUsage(safeUsage);

  if (!bomItems[id]) {
    bomItems[id] = {
      qty: 0,
      system_id: stockItem.system_id, // Include for Shopify integration
      item: stockItem.item,
      description: simplifiedUsage,
      unitPrice: unitPrice,
      totalPrice: 0,
      category: itemCategory, // Store category for grouped display
      _usages: new Set([simplifiedUsage]),
    };
  }
  bomItems[id].qty += qty;
  // Add simplified usage to set (avoids duplicates like "Joists" appearing multiple times)
  if (!bomItems[id]._usages.has(simplifiedUsage) && simplifiedUsage) {
    bomItems[id]._usages.add(simplifiedUsage);
    const usagesArray = Array.from(bomItems[id]._usages).filter(
      (u) => u && u.trim() !== ""
    );
    if (usagesArray.length > 0) {
      // Join unique simplified usages (e.g., "Joists; Blocking")
      bomItems[id].description = usagesArray.sort().join("; ");
    } else {
      bomItems[id].description = stockItem.item;
    }
  } else if (!bomItems[id].description && simplifiedUsage) {
    bomItems[id].description = simplifiedUsage;
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
        1,
        getCategoryForUsage(piece.usage)
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
      // Group identical cuts to avoid repetition in description
      const cutGroups = {};
      cutsMadeFromBestStock.forEach((p) => {
        const key = `${formatFeetInches(p.length)} ${p.usage}`;
        if (!cutGroups[key]) {
          cutGroups[key] = 0;
        }
        cutGroups[key]++;
      });
      
      const cutDetails = Object.entries(cutGroups)
        .map(([description, count]) => {
          if (count > 1) {
            // For multiple identical cuts, show count and pluralize usage
            const parts = description.split(' ');
            const length = parts[0];
            const usage = parts.slice(1).join(' ');
            const pluralUsage = usage.endsWith('g') ? usage : usage + 's'; // Simple pluralization
            return `(${count}) ${length} ${pluralUsage}`;
          } else {
            return description;
          }
        })
        .join("; ");
      const detailedUsageDesc = `Cut ${materialSize} for: ${cutDetails}`;
      bomAdderFn(bestStockItemChoice, detailedUsageDesc, 1, getCategoryForUsage(cutsMadeFromBestStock[0]?.usage));

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
            1,
            getCategoryForUsage(longestRemainingPiece.usage)
          );
        } else {
          bomAdderFn(
            bestFitForLongest,
            `Cut for ${longestRemainingPiece.usage} (${materialSize}, ${formattedLength})`,
            1,
            getCategoryForUsage(longestRemainingPiece.usage)
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
          (stock, usage, qty) => bomAdderFn(stock, usage, qty, getCategoryForUsage(longestRemainingPiece.usage))
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
          isAngled: beam.isAngled || false, // Track angled beams
        }))
    ),
    ...structure.joists.map((j) => {
      // Include cut angle info in usage description if present
      let usage = j.usage || "Joist";
      if (j.cutAngle && j.cutAngle !== 90) {
        usage = `${usage} (${j.cutAngle}° miter)`;
      }
      return { ...j, usage };
    }),
    ...structure.rimJoists.map((r) => {
      // Include cut angle info for rim joists too
      let usage = r.usage || "Rim/End Joist";
      if (r.cutAngle && r.cutAngle !== 90) {
        usage = `${usage} (${r.cutAngle}° miter)`;
      }
      return { ...r, usage };
    }),
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

  const wrappedBomAdder = (stock, usage, qty, category = null) =>
    addItemToBOMAggregated(bomItems, stock, usage, qty, category);

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
          1,
          getCategoryForUsage(piece.usage)
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
              1,
              getCategoryForUsage(piece.usage)
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
  console.log('[BOM Footings] Footing count:', footingCount, 'Footing type:', inputs?.footingType);
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
    
    addItemToBOMAggregated(bomItems, footingItem, footingDesc, footingCount, "BEAMS & POSTS");
    if (slabItem)
      addItemToBOMAggregated(
        bomItems,
        slabItem,
        "Deck Slab 16x16",
        footingCount,
        "BEAMS & POSTS"
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

  console.log('[BOM Hardware] Starting hardware processing...');
  console.log('[BOM Hardware] Structure:', {
    hasLedger: !!structure?.ledger,
    joistCount: structure?.joists?.length || 0,
    beamCount: structure?.beams?.length || 0,
    postCount: structure?.posts?.length || 0,
    rimJoistCount: structure?.rimJoists?.length || 0,
    cornerCount: structure?.cornerCount
  });
  console.log('[BOM Hardware] Inputs:', {
    attachmentType: inputs?.attachmentType,
    beamType: inputs?.beamType,
    fasteners: inputs?.fasteners,
    joistProtection: inputs?.joistProtection
  });

  if (!structure || !deckDimensions) {
    console.log('[BOM Hardware] Exiting early - no structure or deckDimensions');
    return { totalScrews1_5, totalScrews2_5 };
  }

  const primaryJoistSize =
    structure.joists?.[0]?.size ||
    structure.rimJoists?.find(
      (rj) => rj.usage === "End Joist" || rj.usage === "Outer Rim Joist"
    )?.size ||
    structure.beams?.[0]?.size ||
    "2x8";

  console.log('[BOM Hardware] Ledger fasteners check:', {
    attachmentType: inputs.attachmentType,
    hasLedger: !!structure.ledger,
    ledgerLength: structure.ledger?.lengthFeet
  });

  if (inputs.attachmentType === "house_rim" && structure.ledger) {
    const lenIn = structure.ledger.lengthFeet * 12;
    const count = Math.max(4, Math.ceil(lenIn / 16) * 2);
    const item = parsedStockData.find(
      (i) =>
        i.item?.toLowerCase().includes("grk rugged") &&
        i.item?.includes('4"') &&
        i.item?.toLowerCase().includes("single")
    );
    console.log('[BOM Hardware] Adding ledger fasteners:', count, 'Found item:', !!item);
    addItemToBOMAggregated(bomItems, item, 'Ledger Fastener (GRK 4")', count, "BEAMS & POSTS");
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
        count,
        "BEAMS & POSTS"
      );
    }
  }

  // H2.5Z hurricane ties: only for drop beam configurations
  // One tie per joist at each drop beam intersection
  console.log('[BOM Hardware] Hurricane ties check:', {
    beamType: inputs.beamType,
    beamCount: structure.beams?.length || 0,
    beams: structure.beams?.map(b => ({ usage: b.usage, isFlush: b.isFlush }))
  });

  if (inputs.beamType === "drop") {
    const dropBeamCount = structure.beams?.filter(b => !b.isFlush).length || 0;
    console.log('[BOM Hardware] Drop beam count:', dropBeamCount);

    if (dropBeamCount > 0) {
      const joistCount = (structure.joists || []).length;
      const endJoistCount = (structure.rimJoists || []).filter(
        (r) => r.usage === "End Joist"
      ).length;
      const tieCount = (joistCount + endJoistCount) * dropBeamCount;
      console.log('[BOM Hardware] Hurricane tie count:', tieCount, '(joists:', joistCount, 'endJoists:', endJoistCount, ')');

      if (tieCount > 0) {
        const h25Item = parsedStockData.find((i) =>
          i.item?.toLowerCase().includes("h2.5az")
        );
        console.log('[BOM Hardware] H2.5AZ item found:', !!h25Item);
        addItemToBOMAggregated(bomItems, h25Item, "H2.5 Tie (Drop Beam)", tieCount, "HARDWARE");
        if (h25Item) totalScrews1_5 += tieCount * 10;
      }
    }
  }

  // Joist hangers: needed at ledger and flush beam connections
  let hanger_count_final = 0;
  const candidateJoistSegmentsForHangers = (structure.joists || []).filter(
    (j) => j.usage === "Joist" || j.usage === "Picture Frame Joist"
  );

  console.log('[BOM Hardware] Joist hanger calculation:', {
    candidateJoists: candidateJoistSegmentsForHangers.length,
    attachmentType: inputs.attachmentType,
    beamType: inputs.beamType,
    hasLedger: !!structure.ledger
  });

  if (candidateJoistSegmentsForHangers.length > 0) {
    // Calculate joist runs (segments may be split by mid-beams)
    const numJoistSegments = candidateJoistSegmentsForHangers.length;
    const numMidBeams = structure.beams?.filter(
      (b) => b.usage?.includes("Mid Beam")
    ).length || 0;
    const numJoistRuns = numMidBeams > 0
      ? Math.ceil(numJoistSegments / (numMidBeams + 1))
      : numJoistSegments;

    console.log('[BOM Hardware] Joist runs:', { numJoistSegments, numMidBeams, numJoistRuns });

    // 1. Hangers at ledger (if ledger exists)
    if (inputs.attachmentType === "house_rim" && structure.ledger) {
      hanger_count_final += numJoistRuns;
      console.log('[BOM Hardware] Adding hangers at ledger:', numJoistRuns);
    }

    // 2. Hangers at flush wall-side beam (floating deck with flush beams)
    if (inputs.attachmentType === "floating") {
      const wallSideBeam = structure.beams?.find(
        (b) => b.usage === "Wall-Side Beam"
      );
      if (wallSideBeam && wallSideBeam.isFlush) {
        hanger_count_final += numJoistRuns;
        console.log('[BOM Hardware] Adding hangers at wall-side beam:', numJoistRuns);
      }
    }

    // 3. Hangers at flush mid-beams (joists connect from both sides)
    if (inputs.beamType === "flush" && numMidBeams > 0) {
      hanger_count_final += numJoistRuns * 2 * numMidBeams;
      console.log('[BOM Hardware] Adding hangers at mid-beams:', numJoistRuns * 2 * numMidBeams);
    }

    // 4. Hangers at flush outer beam
    if (inputs.beamType === "flush") {
      const outerBeam = structure.beams?.find((b) => b.usage === "Outer Beam");
      if (outerBeam) {
        hanger_count_final += numJoistRuns;
        console.log('[BOM Hardware] Adding hangers at outer beam:', numJoistRuns);
      }
    }
  }

  console.log('[BOM Hardware] Total joist hangers:', hanger_count_final);

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
        hanger_count_final,
        "HARDWARE"
      );
      if (item) {
        totalScrews1_5 += hanger_count_final * screws_1_5_per_hanger;
        totalScrews2_5 += hanger_count_final * screws_2_5_per_hanger;
      }
    }
  }

  const postCount = structure.posts?.length || 0;
  console.log('[BOM Hardware] Beam connectors check:', {
    postCount,
    postSize: structure.posts?.[0]?.size
  });

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

    console.log('[BOM Hardware] Beam connector lookup:', connectorLookup, 'beamPly:', beamPlyForConnector);

    if (connectorLookup) {
      const item = parsedStockData.find(
        (i) =>
          i.item?.toLowerCase().includes(connectorLookup) &&
          i.item?.toLowerCase().includes("bcs")
      );
      console.log('[BOM Hardware] BCS item found:', !!item);
      addItemToBOMAggregated(
        bomItems,
        item,
        `Beam Connector (${pSize} Post, ${beamPlyForConnector}-ply Beam)`,
        postCount,
        "BEAMS & POSTS"
      );
      if (item) totalScrews2_5 += postCount * screws_per_bcs;
    }
  }

  const numCornerAngles = structure.cornerCount || 4;
  console.log('[BOM Hardware] Corner angles check:', {
    numCornerAngles,
    primaryJoistSize
  });

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

    console.log('[BOM Hardware] Corner angle lookup:', angleLookup);

    if (angleLookup) {
      const item = parsedStockData.find(
        (i) =>
          i.item?.toLowerCase().includes(angleLookup) &&
          !i.item?.toLowerCase().includes("ls") &&
          (i.item?.toLowerCase().includes(" zmax") ||
            i.item?.toLowerCase().includes(" angle"))
      );
      console.log('[BOM Hardware] Corner angle item found:', !!item, item?.item);
      addItemToBOMAggregated(
        bomItems,
        item,
        `Corner Angle (${angleLookup.toUpperCase()})`,
        numCornerAngles,
        "HARDWARE"
      );
      if (item) totalScrews1_5 += numCornerAngles * screws_per_angle;
    }
  }

  // Use actual area for complex shapes (L, U), fallback to bounding box for simple rectangles
  const deckAreaSqFt = deckDimensions.actualAreaSqFt || (deckDimensions.widthFeet * deckDimensions.heightFeet);
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
      const nailsPerBox = 1500;
      fQty = Math.ceil(estNails / nailsPerBox);
      fDesc = `Framing Nails (Paslode 3-1/4") - ${fQty} box${fQty > 1 ? 'es' : ''}`;
    }
  }
  if (fItem && fQty > 0) addItemToBOMAggregated(bomItems, fItem, fDesc, fQty, "HARDWARE");
  else
    addItemToBOMAggregated(
      bomItems,
      null,
      `${fDesc} - No Stock Found or Zero Qty`,
      1,
      "HARDWARE"
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
          rolls,
          "HARDWARE"
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
            rolls,
            getCategoryForUsage(b.usage)
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
        addItemToBOMAggregated(bomItems, item, "Deck Frame Coating", pails, "HARDWARE");
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
    addItemToBOMAggregated(bomItems, sealer, "End Cut Sealer", 1, "HARDWARE");

    if (sealer || inputs.joistProtection === "coating") {
      const brush = parsedStockData.find((i) =>
        i.item?.toLowerCase().includes("polyester stain brush")
      );
      addItemToBOMAggregated(bomItems, brush, "Applicator Brush", 1, "HARDWARE");
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
  const wrappedBomAdder = (stock, usage, qty, category = null) =>
    addItemToBOMAggregated(bomItems, stock, usage, qty, category);

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
          1,
          "STAIRS"
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
            stair.calculatedStringerQty,
            "STAIRS"
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
            stair.calculatedStringerQty,
            "STAIRS"
          );
        } else {
          // Need to split into multiple stringer pieces
          let remainingSteps = stair.calculatedNumSteps;
          let partNumber = 1;
          let totalParts = 0;

          while (remainingSteps > 0) {
            const partSteps = Math.min(maxAvailablePylexStepSize, remainingSteps);
            const partSearchTerm = `${partSteps} step`.toLowerCase();
            const pylexItem = allPylexStringerItems.find((i) =>
              i.item?.toLowerCase().includes(partSearchTerm)
            );

            // Label parts: Upper, Middle 1, Middle 2, ..., Lower
            let partLabel;
            if (partNumber === 1) {
              partLabel = "Upper";
            } else if (remainingSteps <= partSteps) {
              partLabel = "Lower";
            } else {
              partLabel = `Middle ${partNumber - 1}`;
            }

            addItemToBOMAggregated(
              bomItems,
              pylexItem,
              `Pylex Stringer (${partSteps}-Step ${partLabel})${stairDescSuffix}`,
              stair.calculatedStringerQty,
              "STAIRS"
            );

            remainingSteps -= partSteps;
            partNumber++;
            totalParts++;
          }

          // Add connectors: one connector kit per joint (totalParts - 1 joints) per stringer
          if (totalParts > 1) {
            const connectorItem = parsedStockData.find((i) =>
              i.item
                ?.toLowerCase()
                .includes("pylex steel stair stringer connector bracket")
            );
            const connectorsPerStringer = totalParts - 1;
            addItemToBOMAggregated(
              bomItems,
              connectorItem,
              `Pylex Stringer Connector${stairDescSuffix}`,
              stair.calculatedStringerQty * connectorsPerStringer,
              "STAIRS"
            );
          }
        }
      } else if (
        stair.stringerType === "lvl_wood" &&
        stair.calculatedStringerQty > 0
      ) {
        const maxLVLSteps = 10;

        // Check if stairs exceed max LVL capacity (requires landing)
        if (stair.calculatedNumSteps > maxLVLSteps) {
          addItemToBOMAggregated(
            bomItems,
            null,
            `LVL Stringer${stairDescSuffix} - LANDING REQUIRED (${stair.calculatedNumSteps} steps exceeds ${maxLVLSteps}-step max)`,
            stair.calculatedStringerQty,
            "STAIRS"
          );
        } else {
          const stepsToLookup = Math.max(2, stair.calculatedNumSteps || 2);
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
            stair.calculatedStringerQty,
            "STAIRS"
          );
        }
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
                1,
                "STAIRS"
              );
            });
          }
        }
      } else if (stair.calculatedStringerQty > 0) {
        // Fallback for unknown or missing stringer type
        addItemToBOMAggregated(
          bomItems,
          null,
          `Stringers${stairDescSuffix} - Unknown type "${stair.stringerType || 'not specified'}"`,
          stair.calculatedStringerQty,
          "STAIRS"
        );
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
          totalSlabs,
          "STAIRS"
        );
      } else if (stair.landingType === "concrete_pad") {
        const landingDepthFt = 4.0;
        const padThicknessInches = 3;
        const padThicknessFt = padThicknessInches / 12;

        // Calculate concrete volume and bags needed
        // 30kg Quikrete yields ~0.5 cubic feet when mixed
        const landingAreaSqFt = stair.widthFt * landingDepthFt;
        const volumeCuFt = landingAreaSqFt * padThicknessFt;
        const yieldPerBagCuFt = 0.5;
        const bagsNeeded = Math.ceil(volumeCuFt / yieldPerBagCuFt);

        const concreteItem = parsedStockData.find((i) =>
          i.item?.toLowerCase().includes("quikrete 30kg")
        );
        addItemToBOMAggregated(
          bomItems,
          concreteItem,
          `Concrete Mix for Landing Pad (${stair.widthFt}'W x ${landingDepthFt}'D x ${padThicknessInches}")${stairDescSuffix}`,
          bagsNeeded,
          "STAIRS"
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
            (stock, usage, qty) => wrappedBomAdder(stock, usage, qty, "STAIRS")
          );
        } else if (perimeterFt > EPSILON) {
          addItemToBOMAggregated(
            bomItems,
            null,
            `2x4 Forms for Concrete Pad${stairDescSuffix} - No 2x4 Stock`,
            1,
            "STAIRS"
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
        const numLSCZConnectors = stair.calculatedStringerQty * 1;
        addItemToBOMAggregated(
          bomItems,
          lsczItem,
          `Stair Stringer Connector (LSCZ)${stairDescSuffix}`,
          numLSCZConnectors,
          "STAIRS"
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
      totalPylexStringerPiecesForFasteners * 2,
      "STAIRS"
    );
  }

  return {
    totalScrews1_5: currentTotalScrews1_5,
    totalScrews2_5: currentTotalScrews2_5,
  };
}

/**
 * Process decking materials for BOM
 * @param {Object} deckingState - Decking configuration from appState.decking
 * @param {Object} deckDimensions - Deck dimensions
 * @param {Object} bomItems - BOM items object to add to
 * @param {Array} parsedStockData - Stock data array
 */
function processDeckingMaterials(deckingState, deckDimensions, bomItems, parsedStockData) {
  if (!deckingState || !deckDimensions) return;

  const { material, cedarSize, boardDirection, pictureFrame, breakerBoards = [] } = deckingState;
  const areaSqFt = deckDimensions.actualAreaSqFt || deckDimensions.area || 0;
  const widthFeet = deckDimensions.widthFeet || deckDimensions.width || 0;
  const depthFeet = deckDimensions.depthFeet || deckDimensions.depth || 0;

  if (areaSqFt <= 0) return;

  // Determine board size and coverage
  // 5/4x6 board: 5.5" actual width, coverage ~0.458 sq ft per linear foot
  // 5/4x5 board: 4.5" actual width, coverage ~0.375 sq ft per linear foot
  const boardWidthInches = (material === 'cedar' && cedarSize === '5/4x5') ? 4.5 : 5.5;
  const coveragePerLF = boardWidthInches / 12; // sq ft per linear foot

  // Calculate linear feet needed
  let linearFeetNeeded = areaSqFt / coveragePerLF;

  // Add waste factor
  let wasteFactor = 1.10; // 10% base waste
  if (boardDirection === 'diagonal') {
    wasteFactor = 1.15; // 15% for diagonal
  }
  linearFeetNeeded *= wasteFactor;

  // Calculate perimeter for picture frame
  let perimeterFeet = 0;
  if (pictureFrame !== 'none') {
    perimeterFeet = 2 * (widthFeet + depthFeet);
    if (pictureFrame === 'double') {
      perimeterFeet *= 2;
    }
    // Picture frame uses perpendicular boards - add to linear feet
    linearFeetNeeded += perimeterFeet * 1.1; // 10% waste for picture frame
  }

  // Determine optimal board length to use
  const availableLengths = [8, 10, 12, 14, 16];
  let bestLength = 12; // Default to 12'

  // Use longest practical board length based on deck dimensions
  if (boardDirection === 'horizontal') {
    // Boards run parallel to width
    for (let i = availableLengths.length - 1; i >= 0; i--) {
      if (availableLengths[i] >= widthFeet) {
        bestLength = availableLengths[i];
        break;
      }
    }
  } else {
    // Diagonal - use longer boards
    bestLength = 16;
  }

  // Calculate number of boards needed
  const boardsNeeded = Math.ceil(linearFeetNeeded / bestLength);

  // Find the appropriate stock item
  let boardSearchTerm = '';
  if (material === 'pt') {
    boardSearchTerm = `5/4x6 PT Brown Deck Board ${bestLength}'`;
  } else if (material === 'cedar') {
    const size = cedarSize === '5/4x5' ? '5/4x5' : '5/4x6';
    boardSearchTerm = `${size} Cedar Deck Board ${bestLength}'`;
  }

  const boardItem = parsedStockData.find(i =>
    i.item?.toLowerCase().includes(boardSearchTerm.toLowerCase())
  );

  if (boardItem) {
    addItemToBOMAggregated(bomItems, boardItem, `Decking Boards (${bestLength}')`, boardsNeeded, "DECKING");
  } else {
    // Fallback - try to find any matching board
    const fallbackTerm = material === 'pt' ? '5/4x6 PT' : '5/4x6 Cedar';
    const fallbackItem = parsedStockData.find(i =>
      i.item?.toLowerCase().includes(fallbackTerm.toLowerCase())
    );
    if (fallbackItem) {
      addItemToBOMAggregated(bomItems, fallbackItem, 'Decking Boards', boardsNeeded, "DECKING");
    }
  }

  // Calculate screws needed
  // Approximately 2 screws per sq ft for face screwing, 1.5 for hidden
  let screwsPerSqFt = material === 'cedar' ? 1.5 : 2; // Camo uses fewer screws
  let totalScrews = Math.ceil(areaSqFt * screwsPerSqFt);

  // Find best screw box combination
  if (material === 'pt') {
    // Use DSB 2-1/2" screws for 5/4 boards
    const screwBoxes = parsedStockData.filter(i =>
      i.item?.toLowerCase().includes('dsb deck screw 2-1/2')
    ).sort((a, b) => {
      // Extract count from item name
      const aMatch = a.item.match(/(\d+)ct/);
      const bMatch = b.item.match(/(\d+)ct/);
      return (bMatch ? parseInt(bMatch[1]) : 0) - (aMatch ? parseInt(aMatch[1]) : 0);
    });

    if (screwBoxes.length > 0) {
      // Find optimal box combination
      let remaining = totalScrews;
      for (const box of screwBoxes) {
        const countMatch = box.item.match(/(\d+)ct/);
        if (countMatch) {
          const boxCount = parseInt(countMatch[1]);
          const boxesNeeded = Math.floor(remaining / boxCount);
          if (boxesNeeded > 0) {
            addItemToBOMAggregated(bomItems, box, `Deck Screws 2-1/2"`, boxesNeeded, "DECKING");
            remaining -= boxesNeeded * boxCount;
          }
        }
      }
      // Get smallest box for remainder
      if (remaining > 0 && screwBoxes.length > 0) {
        const smallestBox = screwBoxes[screwBoxes.length - 1];
        addItemToBOMAggregated(bomItems, smallestBox, `Deck Screws 2-1/2"`, 1, "DECKING");
      }
    }
  } else if (material === 'cedar') {
    // Use Camo hidden screws
    const camoBoxes = parsedStockData.filter(i =>
      i.item?.toLowerCase().includes('camo hidden deck screw')
    ).sort((a, b) => {
      const aMatch = a.item.match(/(\d+)ct/);
      const bMatch = b.item.match(/(\d+)ct/);
      return (bMatch ? parseInt(bMatch[1]) : 0) - (aMatch ? parseInt(aMatch[1]) : 0);
    });

    if (camoBoxes.length > 0) {
      let remaining = totalScrews;
      for (const box of camoBoxes) {
        const countMatch = box.item.match(/(\d+)ct/);
        if (countMatch) {
          const boxCount = parseInt(countMatch[1]);
          const boxesNeeded = Math.floor(remaining / boxCount);
          if (boxesNeeded > 0) {
            addItemToBOMAggregated(bomItems, box, 'Camo Hidden Screws', boxesNeeded, "DECKING");
            remaining -= boxesNeeded * boxCount;
          }
        }
      }
      if (remaining > 0 && camoBoxes.length > 0) {
        const smallestBox = camoBoxes[camoBoxes.length - 1];
        addItemToBOMAggregated(bomItems, smallestBox, 'Camo Hidden Screws', 1, "DECKING");
      }
    }
  }
}

export function calculateBOM(structure, inputs, stairs, deckDimensions, deckingState = null) {
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

    // Process decking materials if decking state is provided
    if (deckingState) {
      processDeckingMaterials(deckingState, deckDimensions, bomItems, parsedStockData);
    }

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
            (i.pkg_qty || 0) > 0 &&
            (i.retail_price || 0) > 0
        )
        .sort((a, b) => (b.pkg_qty || 0) - (a.pkg_qty || 0)); // Sort largest first

      if (availableBoxes.length === 0) {
        addItemToBOMAggregated(
          currentBomItems,
          null,
          `SD Screws ${screwDesc} - No Boxes Available`,
          totalNeeded,
          "HARDWARE"
        );
        return;
      }

      // Find the most economical combination of boxes
      let bestCombination = null;
      let bestCost = Infinity;

      // Try all reasonable combinations (works well for 2-3 box sizes)
      const maxLargeBoxes = Math.ceil(totalNeeded / availableBoxes[0].pkg_qty) + 1;

      for (let largeQty = 0; largeQty <= maxLargeBoxes; largeQty++) {
        const largeBox = availableBoxes[0];
        const coveredByLarge = largeQty * largeBox.pkg_qty;
        const remaining = totalNeeded - coveredByLarge;

        if (remaining <= 0) {
          // Large boxes alone cover the need
          const cost = largeQty * largeBox.retail_price;
          if (cost < bestCost) {
            bestCost = cost;
            bestCombination = [{ box: largeBox, qty: largeQty }];
          }
        } else if (availableBoxes.length > 1) {
          // Need to fill remainder with smaller boxes
          const smallBox = availableBoxes[availableBoxes.length - 1]; // Smallest
          const smallQty = Math.ceil(remaining / smallBox.pkg_qty);
          const cost = largeQty * largeBox.retail_price + smallQty * smallBox.retail_price;

          if (cost < bestCost) {
            bestCost = cost;
            bestCombination = [];
            if (largeQty > 0) bestCombination.push({ box: largeBox, qty: largeQty });
            if (smallQty > 0) bestCombination.push({ box: smallBox, qty: smallQty });
          }
        }
      }

      // Also try using only small boxes (in case that's cheaper)
      if (availableBoxes.length > 1) {
        const smallBox = availableBoxes[availableBoxes.length - 1];
        const smallOnlyQty = Math.ceil(totalNeeded / smallBox.pkg_qty);
        const smallOnlyCost = smallOnlyQty * smallBox.retail_price;
        if (smallOnlyCost < bestCost) {
          bestCost = smallOnlyCost;
          bestCombination = [{ box: smallBox, qty: smallOnlyQty }];
        }
      }

      // Add the best combination to BOM
      if (bestCombination && bestCombination.length > 0) {
        bestCombination.forEach(({ box, qty }) => {
          addItemToBOMAggregated(
            currentBomItems,
            box,
            `SD Screws ${screwDesc} (Box of ${box.pkg_qty})`,
            qty,
            "HARDWARE"
          );
        });
      } else {
        // Fallback if no valid combination found
        addItemToBOMAggregated(
          currentBomItems,
          null,
          `SD Screws ${screwDesc} - Could not determine box combination`,
          totalNeeded,
          "HARDWARE"
        );
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
