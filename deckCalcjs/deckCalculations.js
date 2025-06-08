// deckCalculations.js (v13 - Continuous 2x8s for Joists, End Joists, and PF Joists)
import {
  PIXELS_PER_FOOT,
  POST_INSET_FEET,
  MAX_POST_SPACING_FEET,
  BEAM_CANTILEVER_FEET,
  EPSILON,
  MIN_HEIGHT_FOR_NO_2X6_INCHES,
  PICTURE_FRAME_SINGLE_INSET_INCHES,
  PICTURE_FRAME_DOUBLE_INSET_INCHES,
  MAX_BLOCKING_SPACING_FEET,
  JOIST_SIZE_ORDER,
  DROP_BEAM_CENTERLINE_SETBACK_FEET as CONFIG_DROP_BEAM_SETBACK,
} from "./config.js";
import { distance, getLineSegmentsInPolygon, isPointInPolygon } from "./utils.js";
import { getMaxJoistSpans } from "./dataManager.js";

// --- Constants ---
const ACTUAL_LUMBER_THICKNESS_INCHES = 1.5;
const ACTUAL_LUMBER_THICKNESS_PIXELS =
  (ACTUAL_LUMBER_THICKNESS_INCHES / 12) * PIXELS_PER_FOOT;
const HALF_LUMBER_THICKNESS_PIXELS = ACTUAL_LUMBER_THICKNESS_PIXELS / 2;
const DROP_BEAM_CENTERLINE_SETBACK_FEET =
  typeof CONFIG_DROP_BEAM_SETBACK === "number" ? CONFIG_DROP_BEAM_SETBACK : 1.0;

// --- Helper Functions ---
function calculateBeamAndPostsInternal(
  positionCoordinate,
  isWallHorizontal,
  deckDimensions,
  beamSizeString,
  beamPly,
  postSize,
  deckHeightInches,
  footingType,
  usageLabel,
  beamType
) {
  let beamPosts = [];
  let beamFootings = [];
  let beamAxisP1, beamAxisP2;
  if (isWallHorizontal) {
    beamAxisP1 = { x: deckDimensions.minX, y: positionCoordinate };
    beamAxisP2 = { x: deckDimensions.maxX, y: positionCoordinate };
  } else {
    beamAxisP1 = { x: positionCoordinate, y: deckDimensions.minY };
    beamAxisP2 = { x: positionCoordinate, y: deckDimensions.maxY };
  }

  // Clip beam line against polygon boundaries
  const beamSegments = getLineSegmentsInPolygon(beamAxisP1, beamAxisP2, deckDimensions.polygonPoints);
  
  // If beam doesn't intersect with deck polygon, return empty beam
  if (beamSegments.length === 0) {
    return {
      beam: {
        p1: beamAxisP1,
        p2: beamAxisP1,
        centerlineP1: beamAxisP1,
        centerlineP2: beamAxisP1,
        positionCoordinateLineP1: beamAxisP1,
        positionCoordinateLineP2: beamAxisP1,
        size: beamSizeString,
        lengthFeet: 0,
        ply: beamPly,
        usage: usageLabel,
        isFlush: beamType === "flush",
      },
      posts: [],
      footings: [],
    };
  }

  // For now, use the longest beam segment as the primary beam
  // TODO: Handle multiple beam segments for complex polygons
  let longestSegment = beamSegments[0];
  for (const segment of beamSegments) {
    if (distance(segment.start, segment.end) > distance(longestSegment.start, longestSegment.end)) {
      longestSegment = segment;
    }
  }
  
  beamAxisP1 = longestSegment.start;
  beamAxisP2 = longestSegment.end;

  const beamLengthPixels = distance(beamAxisP1, beamAxisP2);
  if (beamLengthPixels < EPSILON) {
    return {
      beam: {
        p1: beamAxisP1,
        p2: beamAxisP1,
        centerlineP1: beamAxisP1,
        centerlineP2: beamAxisP1,
        positionCoordinateLineP1: beamAxisP1,
        positionCoordinateLineP2: beamAxisP1,
        size: beamSizeString,
        lengthFeet: 0,
        ply: beamPly,
        usage: usageLabel,
        isFlush: beamType === "flush",
      },
      posts: [],
      footings: [],
    };
  }

  const beamDx = beamAxisP2.x - beamAxisP1.x;
  const beamDy = beamAxisP2.y - beamAxisP1.y;
  const unitVecX = beamDx / beamLengthPixels;
  const unitVecY = beamDy / beamLengthPixels;
  const postInsetPixels = POST_INSET_FEET * PIXELS_PER_FOOT;
  const actualPostInsetPixels = Math.min(
    postInsetPixels,
    beamLengthPixels / 2 - EPSILON * 10
  );
  const post1Pos = {
    x: beamAxisP1.x + unitVecX * actualPostInsetPixels,
    y: beamAxisP1.y + unitVecY * actualPostInsetPixels,
  };
  const post2Pos = {
    x: beamAxisP2.x - unitVecX * actualPostInsetPixels,
    y: beamAxisP2.y - unitVecY * actualPostInsetPixels,
  };

  if (
    beamLengthPixels < POST_INSET_FEET * PIXELS_PER_FOOT * 2 &&
    beamLengthPixels > EPSILON
  ) {
    beamPosts.push({
      x: beamAxisP1.x + unitVecX * (beamLengthPixels / 2),
      y: beamAxisP1.y + unitVecY * (beamLengthPixels / 2),
      size: postSize,
      heightFeet: deckHeightInches / 12,
    });
  } else if (beamLengthPixels >= POST_INSET_FEET * PIXELS_PER_FOOT * 2) {
    beamPosts.push({
      ...post1Pos,
      size: postSize,
      heightFeet: deckHeightInches / 12,
    });
    if (distance(post1Pos, post2Pos) > EPSILON)
      beamPosts.push({
        ...post2Pos,
        size: postSize,
        heightFeet: deckHeightInches / 12,
      });
    if (beamPosts.length === 2) {
      const postSpanPixels = distance(beamPosts[0], beamPosts[1]);
      if (postSpanPixels / PIXELS_PER_FOOT > MAX_POST_SPACING_FEET) {
        const numIntermediatePosts = Math.floor(
          postSpanPixels / PIXELS_PER_FOOT / MAX_POST_SPACING_FEET
        );
        const intermediateSpacingPixels =
          postSpanPixels / (numIntermediatePosts + 1);
        for (let i = 1; i <= numIntermediatePosts; i++) {
          beamPosts.push({
            x: beamPosts[0].x + unitVecX * intermediateSpacingPixels * i,
            y: beamPosts[0].y + unitVecY * intermediateSpacingPixels * i,
            size: postSize,
            heightFeet: deckHeightInches / 12,
          });
        }
        beamPosts.sort((a, b) => (isWallHorizontal ? a.x - b.x : a.y - b.y));
      }
    }
  }

  let beamMaterialP1 = beamAxisP1;
  let beamMaterialP2 = beamAxisP2;
  if (beamPosts.length > 0) {
    const cantileverPixels = BEAM_CANTILEVER_FEET * PIXELS_PER_FOOT;
    const firstPost = beamPosts[0];
    const lastPost = beamPosts[beamPosts.length - 1];
    beamMaterialP1 = {
      x: firstPost.x - unitVecX * cantileverPixels,
      y: firstPost.y - unitVecY * cantileverPixels,
    };
    beamMaterialP2 = {
      x: lastPost.x + unitVecX * cantileverPixels,
      y: lastPost.y + unitVecY * cantileverPixels,
    };
  }
  // Only place footings where posts are inside the deck polygon
  beamFootings = beamPosts
    .filter((post) => isPointInPolygon(post, deckDimensions.polygonPoints))
    .map((post) => ({
      x: post.x,
      y: post.y,
      type: footingType,
    }));

  return {
    beam: {
      p1: beamMaterialP1,
      p2: beamMaterialP2,
      centerlineP1: beamAxisP1,
      centerlineP2: beamAxisP2,
      positionCoordinateLineP1: beamAxisP1,
      positionCoordinateLineP2: beamAxisP2,
      size: beamSizeString,
      lengthFeet: distance(beamMaterialP1, beamMaterialP2) / PIXELS_PER_FOOT,
      ply: beamPly,
      usage: usageLabel,
      isFlush: beamType === "flush",
    },
    posts: beamPosts,
    footings: beamFootings,
  };
}

function calculateLedger(attachToHouse, wallP1, wallP2, ledgerSize) {
  if (!attachToHouse) return null;
  return {
    p1: wallP1,
    p2: wallP2,
    size: ledgerSize,
    lengthFeet: distance(wallP1, wallP2) / PIXELS_PER_FOOT,
    ply: 1,
    usage: "Ledger",
  };
}

function getRequiredJoistSize(spanFeet, spacingInches, deckHeightInches) {
  const maxJoistSpans = getMaxJoistSpans();
  if (!maxJoistSpans || maxJoistSpans.length === 0)
    return {
      size: null,
      requiresMidBeam: false,
      error: "Max joist span data not available.",
    };
  const prohibit2x6 = deckHeightInches >= MIN_HEIGHT_FOR_NO_2X6_INCHES;
  let smallestSuitableSize = null,
    largestPossibleSpanForAnyAllowedSize = 0;
  for (const currentSize of JOIST_SIZE_ORDER) {
    if (prohibit2x6 && currentSize === "2x6") continue;
    const rule = maxJoistSpans.find(
      (r) => r.size === currentSize && r.spacing === spacingInches
    );
    if (rule) {
      largestPossibleSpanForAnyAllowedSize = Math.max(
        largestPossibleSpanForAnyAllowedSize,
        rule.maxSpanFt
      );
      if (!smallestSuitableSize && rule.maxSpanFt >= spanFeet - EPSILON)
        smallestSuitableSize = currentSize;
    }
  }
  if (smallestSuitableSize)
    return { size: smallestSuitableSize, requiresMidBeam: false, error: null };
  if (
    largestPossibleSpanForAnyAllowedSize > 0 &&
    spanFeet > largestPossibleSpanForAnyAllowedSize + EPSILON
  )
    return { size: null, requiresMidBeam: true, error: null };
  let errorMsg = `No joist for span ${spanFeet.toFixed(
    2
  )}' @ ${spacingInches}" OC. Max: ${largestPossibleSpanForAnyAllowedSize.toFixed(
    2
  )}'.`;
  if (prohibit2x6 && JOIST_SIZE_ORDER.includes("2x6"))
    errorMsg += ` (2x6 not allowed for height >= ${
      MIN_HEIGHT_FOR_NO_2X6_INCHES / 12
    }')`;
  return { size: null, requiresMidBeam: false, error: errorMsg };
}

function calculateAllJoists(
  isWallHorizontal,
  deckDimensions,
  joistStartFixedCoord,
  joistEndFixedCoord1,
  joistEndFixedCoord2,
  hasMidBeam, // True if a mid-beam physically exists and defines a segment
  joistSize,
  hasPictureFrame,
  pictureFrameInsetPixels,
  joistSpacingPixels,
  forceSingleSpanJoists // True if specific joists (2x8s, 18-20ft depth) should be single pieces
) {
  const joists = [];
  const placementAxisMin = isWallHorizontal
    ? deckDimensions.minX
    : deckDimensions.minY;
  const placementAxisMax = isWallHorizontal
    ? deckDimensions.maxX
    : deckDimensions.maxY;

  const addJoistSegments = (pos, usage, applyForceSingleSpanFlag) => {
    let p1_s1,
      p2_s1,
      p1_s2 = null,
      p2_s2 = null;

    // The applyForceSingleSpanFlag comes from the caller, indicating if this type of joist
    // under current deck conditions should be a single span.
    if (applyForceSingleSpanFlag) {
      // This joist will be a single, full-depth piece.
      // It implies a mid-beam exists (or was required), and joistEndFixedCoord2 is the true outer end.
      if (isWallHorizontal) {
        p1_s1 = { x: pos, y: joistStartFixedCoord };
        p2_s1 = { x: pos, y: joistEndFixedCoord2 }; // Target the actual outer end
      } else {
        p1_s1 = { x: joistStartFixedCoord, y: pos };
        p2_s1 = { x: joistEndFixedCoord2, y: pos }; // Target the actual outer end
      }
      if (distance(p1_s1, p2_s1) > EPSILON) {
        // Clip joist against polygon boundaries
        const segments = getLineSegmentsInPolygon(p1_s1, p2_s1, deckDimensions.polygonPoints);
        for (const segment of segments) {
          joists.push({
            p1: segment.start,
            p2: segment.end,
            size: joistSize,
            lengthFeet: distance(segment.start, segment.end) / PIXELS_PER_FOOT,
            usage,
          });
        }
      }
    } else {
      // Original segmentation logic
      if (isWallHorizontal) {
        p1_s1 = { x: pos, y: joistStartFixedCoord };
        p2_s1 = { x: pos, y: joistEndFixedCoord1 };
        if (hasMidBeam && joistEndFixedCoord2 !== null) {
          p1_s2 = { x: pos, y: joistEndFixedCoord1 };
          p2_s2 = { x: pos, y: joistEndFixedCoord2 };
        }
      } else {
        p1_s1 = { x: joistStartFixedCoord, y: pos };
        p2_s1 = { x: joistEndFixedCoord1, y: pos };
        if (hasMidBeam && joistEndFixedCoord2 !== null) {
          p1_s2 = { x: joistEndFixedCoord1, y: pos };
          p2_s2 = { x: joistEndFixedCoord2, y: pos };
        }
      }
      if (distance(p1_s1, p2_s1) > EPSILON) {
        // Clip first segment against polygon boundaries
        const segments1 = getLineSegmentsInPolygon(p1_s1, p2_s1, deckDimensions.polygonPoints);
        for (const segment of segments1) {
          joists.push({
            p1: segment.start,
            p2: segment.end,
            size: joistSize,
            lengthFeet: distance(segment.start, segment.end) / PIXELS_PER_FOOT,
            usage,
          });
        }
      }
      if (p1_s2 && p2_s2 && distance(p1_s2, p2_s2) > EPSILON) {
        // Clip second segment against polygon boundaries
        const segments2 = getLineSegmentsInPolygon(p1_s2, p2_s2, deckDimensions.polygonPoints);
        for (const segment of segments2) {
          joists.push({
            p1: segment.start,
            p2: segment.end,
            size: joistSize,
            lengthFeet: distance(segment.start, segment.end) / PIXELS_PER_FOOT,
            usage,
          });
        }
      }
    }
  };

  let firstPFJoistPos = null,
    lastPFJoistPos = null;
  const physicalDeckEdgeStart = placementAxisMin;
  const physicalDeckEdgeEnd = placementAxisMax;

  if (hasPictureFrame) {
    firstPFJoistPos = physicalDeckEdgeStart + pictureFrameInsetPixels;
    lastPFJoistPos = physicalDeckEdgeEnd - pictureFrameInsetPixels;
    // Apply forceSingleSpanJoists flag to Picture Frame Joists as well
    addJoistSegments(
      firstPFJoistPos,
      "Picture Frame Joist",
      forceSingleSpanJoists
    );
    if (Math.abs(lastPFJoistPos - firstPFJoistPos) > joistSpacingPixels * 0.5) {
      addJoistSegments(
        lastPFJoistPos,
        "Picture Frame Joist",
        forceSingleSpanJoists
      );
    }
  }

  const internalJoistAreaStart = hasPictureFrame
    ? firstPFJoistPos
    : physicalDeckEdgeStart;
  const internalJoistAreaEnd = hasPictureFrame
    ? lastPFJoistPos
    : physicalDeckEdgeEnd;
  const loopStart = internalJoistAreaStart + joistSpacingPixels;

  for (
    let currentPos = loopStart;
    currentPos < internalJoistAreaEnd - EPSILON;
    currentPos += joistSpacingPixels
  ) {
    addJoistSegments(currentPos, "Joist", forceSingleSpanJoists);
  }

  joists.sort((a, b) => (isWallHorizontal ? a.p1.x - b.p1.x : a.p1.y - b.p1.y));
  return joists;
}

function calculateAllRimJoists(
  isWallHorizontal,
  deckDimensions,
  joistStartLineCoord, // e.g., ledger line
  firstBeamLineCoord, // e.g., mid-beam line or outer beam line if no mid
  outerBeamLineCoord, // e.g., outer beam line (if mid exists) or null
  hasMidBeam, // True if a mid-beam physically exists
  rimJoistSize,
  deckEdgeP1_WallSide,
  deckEdgeP2_WallSide,
  deckEdgeP1_OuterSide,
  deckEdgeP2_OuterSide,
  attachmentType,
  forceSingleSpanRims // New flag for End Joists
) {
  const rimJoists = [];
  const addRimSegment = (p1, p2, usage, fullEdgeP1, fullEdgeP2) => {
    if (distance(p1, p2) > EPSILON)
      rimJoists.push({
        p1,
        p2,
        size: rimJoistSize,
        lengthFeet: distance(p1, p2) / PIXELS_PER_FOOT,
        usage,
        fullEdgeP1,
        fullEdgeP2,
      });
  };

  const sideRimMin = isWallHorizontal
    ? deckDimensions.minX
    : deckDimensions.minY;
  const sideRimMax = isWallHorizontal
    ? deckDimensions.maxX
    : deckDimensions.maxY;

  // Determine the true outer coordinate for single-span End Joists
  let endJoistOuterCoord;
  if (hasMidBeam && outerBeamLineCoord !== null) {
    endJoistOuterCoord = outerBeamLineCoord;
  } else {
    endJoistOuterCoord = firstBeamLineCoord;
  }

  // End Joist 1 (Left/Top side)
  const ej1p1 = isWallHorizontal
    ? { x: sideRimMin, y: joistStartLineCoord }
    : { x: joistStartLineCoord, y: sideRimMin };
  const fullEj1P1 = deckEdgeP1_WallSide;
  const fullEj1P2 = isWallHorizontal
    ? { x: sideRimMin, y: deckEdgeP1_OuterSide.y }
    : { x: deckEdgeP1_OuterSide.x, y: sideRimMin };

  if (forceSingleSpanRims) {
    const ej1p2_single = isWallHorizontal
      ? { x: sideRimMin, y: endJoistOuterCoord }
      : { x: endJoistOuterCoord, y: sideRimMin };
    addRimSegment(ej1p1, ej1p2_single, "End Joist", fullEj1P1, fullEj1P2);
  } else {
    const ej1p2_seg1 = isWallHorizontal
      ? { x: sideRimMin, y: firstBeamLineCoord }
      : { x: firstBeamLineCoord, y: sideRimMin };
    addRimSegment(ej1p1, ej1p2_seg1, "End Joist", fullEj1P1, fullEj1P2);
    if (hasMidBeam && outerBeamLineCoord !== null) {
      const ej1p1_seg2 = ej1p2_seg1;
      const ej1p2_seg2 = isWallHorizontal
        ? { x: sideRimMin, y: outerBeamLineCoord }
        : { x: outerBeamLineCoord, y: sideRimMin };
      addRimSegment(ej1p1_seg2, ej1p2_seg2, "End Joist", fullEj1P1, fullEj1P2);
    }
  }

  // End Joist 2 (Right/Bottom side)
  const ej2p1 = isWallHorizontal
    ? { x: sideRimMax, y: joistStartLineCoord }
    : { x: joistStartLineCoord, y: sideRimMax };
  const fullEj2P1 = deckEdgeP2_WallSide;
  const fullEj2P2 = isWallHorizontal
    ? { x: sideRimMax, y: deckEdgeP2_OuterSide.y }
    : { x: deckEdgeP2_OuterSide.x, y: sideRimMax };

  if (forceSingleSpanRims) {
    const ej2p2_single = isWallHorizontal
      ? { x: sideRimMax, y: endJoistOuterCoord }
      : { x: endJoistOuterCoord, y: sideRimMax };
    addRimSegment(ej2p1, ej2p2_single, "End Joist", fullEj2P1, fullEj2P2);
  } else {
    const ej2p2_seg1 = isWallHorizontal
      ? { x: sideRimMax, y: firstBeamLineCoord }
      : { x: firstBeamLineCoord, y: sideRimMax };
    addRimSegment(ej2p1, ej2p2_seg1, "End Joist", fullEj2P1, fullEj2P2);
    if (hasMidBeam && outerBeamLineCoord !== null) {
      const ej2p1_seg2 = ej2p2_seg1;
      const ej2p2_seg2 = isWallHorizontal
        ? { x: sideRimMax, y: outerBeamLineCoord }
        : { x: outerBeamLineCoord, y: sideRimMax };
      addRimSegment(ej2p1_seg2, ej2p2_seg2, "End Joist", fullEj2P1, fullEj2P2);
    }
  }

  // Outer Rim Joist (parallel to ledger/wall) - not affected by forceSingleSpanRims
  addRimSegment(
    deckEdgeP1_OuterSide,
    deckEdgeP2_OuterSide,
    "Outer Rim Joist",
    deckEdgeP1_OuterSide,
    deckEdgeP2_OuterSide
  );

  // Wall Rim Joist (if concrete or floating attachment) - not affected by forceSingleSpanRims
  if (attachmentType === "concrete" || attachmentType === "floating") {
    addRimSegment(
      deckEdgeP1_WallSide,
      deckEdgeP2_WallSide,
      "Wall Rim Joist",
      deckEdgeP1_WallSide,
      deckEdgeP2_WallSide
    );
  }
  return rimJoists;
}

function calculateMidSpanBlocking(
  requiresMidBeam,
  joistSpanStartCoord,
  midBeamCoord,
  joistSpanEndCoord,
  deckWidthPixels,
  blockingSize,
  blockingBoardCount,
  isWallHorizontal,
  deckDimensions
) {
  const midSpanBlocking = [];
  const createBlockingRows = (spanStart, spanEnd) => {
    const spanDepthPixels = Math.abs(spanEnd - spanStart);
    const spanDepthFt = spanDepthPixels / PIXELS_PER_FOOT;
    if (spanDepthFt <= MAX_BLOCKING_SPACING_FEET + EPSILON) return;

    const numSections = Math.ceil(spanDepthFt / MAX_BLOCKING_SPACING_FEET);
    const numBlockingRowsNeeded = Math.max(0, numSections - 1);
    if (numBlockingRowsNeeded < 1) return;

    const blockingSpacingPixels = spanDepthPixels / (numBlockingRowsNeeded + 1);
    for (let i = 1; i <= numBlockingRowsNeeded; i++) {
      let p1, p2;
      const blockingLineCoord =
        spanStart + i * blockingSpacingPixels * (spanEnd > spanStart ? 1 : -1);
      if (isWallHorizontal) {
        p1 = { x: deckDimensions.minX, y: blockingLineCoord };
        p2 = { x: deckDimensions.maxX, y: blockingLineCoord };
      } else {
        p1 = { x: blockingLineCoord, y: deckDimensions.minY };
        p2 = { x: blockingLineCoord, y: deckDimensions.maxY };
      }
      
      // Clip blocking line against polygon boundaries
      const blockingSegments = getLineSegmentsInPolygon(p1, p2, deckDimensions.polygonPoints);
      
      for (const segment of blockingSegments) {
        if (distance(segment.start, segment.end) > EPSILON) {
          midSpanBlocking.push({
            p1: segment.start,
            p2: segment.end,
            size: blockingSize,
            lengthFeet: distance(segment.start, segment.end) / PIXELS_PER_FOOT,
            usage: "Mid-Span Blocking",
            boardCount: blockingBoardCount,
          });
        }
      }
    }

  if (requiresMidBeam && midBeamCoord !== null) {
    createBlockingRows(joistSpanStartCoord, midBeamCoord);
    createBlockingRows(midBeamCoord, joistSpanEndCoord);
  } else {
    createBlockingRows(joistSpanStartCoord, joistSpanEndCoord);
  }
  return midSpanBlocking;
}

function calculateLadderStylePictureFrameBlocking(
  isWallHorizontal,
  deckDimensions,
  deckExtendsPositiveDir,
  wallSideActualEdgeCoord,
  outerActualEdgeCoord,
  firstPFJoistObject,
  lastPFJoistObject,
  blockingMaterialSize,
  joistSpacingPixels
) {
  const pictureFrameBlocking = [];
  if (!firstPFJoistObject) {
    return pictureFrameBlocking;
  }

  const addRungsForBay = (
    rung_fixed_coord_axis1,
    rung_fixed_coord_axis2,
    placement_iteration_axis_start,
    placement_iteration_axis_end,
    usage_label
  ) => {
    const rungActualLengthOnAxis = Math.abs(
      rung_fixed_coord_axis2 - rung_fixed_coord_axis1
    );
    if (rungActualLengthOnAxis < EPSILON) return;

    const placement_min = Math.min(
      placement_iteration_axis_start,
      placement_iteration_axis_end
    );
    const placement_max = Math.max(
      placement_iteration_axis_start,
      placement_iteration_axis_end
    );

    for (
      let iter_pos_along_joist_run = placement_min + joistSpacingPixels;
      iter_pos_along_joist_run < placement_max - EPSILON;
      iter_pos_along_joist_run += joistSpacingPixels
    ) {
      let p1, p2;
      if (isWallHorizontal) {
        p1 = { x: rung_fixed_coord_axis1, y: iter_pos_along_joist_run };
        p2 = { x: rung_fixed_coord_axis2, y: iter_pos_along_joist_run };
      } else {
        p1 = { x: iter_pos_along_joist_run, y: rung_fixed_coord_axis1 };
        p2 = { x: iter_pos_along_joist_run, y: rung_fixed_coord_axis2 };
      }
      if (distance(p1, p2) > EPSILON) {
        pictureFrameBlocking.push({
          p1,
          p2,
          size: blockingMaterialSize,
          lengthFeet: distance(p1, p2) / PIXELS_PER_FOOT,
          usage: usage_label,
        });
      }
    }
  };

  const placement_axis_start_coord =
    wallSideActualEdgeCoord +
    (deckExtendsPositiveDir
      ? HALF_LUMBER_THICKNESS_PIXELS
      : -HALF_LUMBER_THICKNESS_PIXELS);
  const placement_axis_end_coord =
    outerActualEdgeCoord +
    (deckExtendsPositiveDir
      ? -HALF_LUMBER_THICKNESS_PIXELS
      : HALF_LUMBER_THICKNESS_PIXELS);

  const sideRim1_InnerFace =
    (isWallHorizontal ? deckDimensions.minX : deckDimensions.minY) +
    HALF_LUMBER_THICKNESS_PIXELS;
  const firstPF_Centerline_PerpendicularAxis = isWallHorizontal
    ? firstPFJoistObject.p1.x
    : firstPFJoistObject.p1.y;
  const firstPF_InnerFace_ForBay =
    firstPF_Centerline_PerpendicularAxis - HALF_LUMBER_THICKNESS_PIXELS;

  addRungsForBay(
    sideRim1_InnerFace,
    firstPF_InnerFace_ForBay,
    placement_axis_start_coord,
    placement_axis_end_coord,
    "Ladder Blocking (Side 1)"
  );

  if (lastPFJoistObject) {
    const sideRim2_InnerFace =
      (isWallHorizontal ? deckDimensions.maxX : deckDimensions.maxY) -
      HALF_LUMBER_THICKNESS_PIXELS;
    const lastPF_Centerline_PerpendicularAxis = isWallHorizontal
      ? lastPFJoistObject.p1.x
      : lastPFJoistObject.p1.y;
    const lastPF_InnerFace_ForBay =
      lastPF_Centerline_PerpendicularAxis + HALF_LUMBER_THICKNESS_PIXELS;

    addRungsForBay(
      lastPF_InnerFace_ForBay,
      sideRim2_InnerFace,
      placement_axis_start_coord,
      placement_axis_end_coord,
      "Ladder Blocking (Side 2)"
    );
  }
  return pictureFrameBlocking;
}

export function calculateStructure(shapePoints, wallIndex, inputs, deckDimensions) {
  const components = {
    ledger: null,
    beams: [],
    joists: [],
    posts: [],
    footings: [],
    rimJoists: [],
    midSpanBlocking: [],
    pictureFrameBlocking: [],
    error: null,
    totalDepthFeet: 0,
  };
  let joistStartFixedCoord,
    joistEndFixedCoord1,
    joistEndFixedCoord2 = null;

  if (!deckDimensions || typeof deckDimensions.widthFeet !== "number")
    return { ...components, error: "Deck dimensions invalid." };

  const wallP1 = shapePoints[wallIndex];
  const wallP2 = shapePoints[(wallIndex + 1) % shapePoints.length];
  const isWallHorizontal =
    Math.abs(wallP1.x - wallP2.x) > Math.abs(wallP1.y - wallP2.y);
  components.totalDepthFeet = isWallHorizontal
    ? (deckDimensions.maxY - deckDimensions.minY) / PIXELS_PER_FOOT
    : (deckDimensions.maxX - deckDimensions.minX) / PIXELS_PER_FOOT;
  const deckWidthPixels = isWallHorizontal
    ? deckDimensions.maxX - deckDimensions.minX
    : deckDimensions.maxY - deckDimensions.minY;
  const deckHeightInches = inputs.deckHeight;

  let joistSizeResult = getRequiredJoistSize(
    components.totalDepthFeet,
    inputs.joistSpacing,
    deckHeightInches
  );
  if (joistSizeResult.error && !joistSizeResult.requiresMidBeam) {
    return { ...components, error: joistSizeResult.error };
  }

  let requiresMidBeam = joistSizeResult.requiresMidBeam;
  let joistSize;

  if (requiresMidBeam) {
    const halfSpanJoistResult = getRequiredJoistSize(
      components.totalDepthFeet / 2,
      inputs.joistSpacing,
      deckHeightInches
    );
    if (halfSpanJoistResult.error || !halfSpanJoistResult.size) {
      return {
        ...components,
        error:
          halfSpanJoistResult.error ||
          "Cannot size joists for mid-beam config.",
      };
    }
    joistSize = halfSpanJoistResult.size;
  } else {
    joistSize = joistSizeResult.size;
  }

  if (!joistSize) {
    return {
      ...components,
      error: joistSizeResult.error || "Could not determine joist size.",
    };
  }

  let forceSingleSpanJoistsAndRims = false; // Renamed for clarity
  if (
    joistSize === "2x8" &&
    requiresMidBeam &&
    components.totalDepthFeet > 18.0 + EPSILON &&
    components.totalDepthFeet <= 20.0 + EPSILON
  ) {
    forceSingleSpanJoistsAndRims = true;
  }

  const beamSize = joistSize;
  const postSize = deckHeightInches >= 60 ? "6x6" : "4x4";
  const beamPly = postSize === "6x6" ? 3 : 2;

  const deckCenterX = (deckDimensions.minX + deckDimensions.maxX) / 2;
  const deckCenterY = (deckDimensions.minY + deckDimensions.maxY) / 2;
  const wallMidX = (wallP1.x + wallP2.x) / 2;
  const wallMidY = (wallP1.y + wallP2.y) / 2;
  let deckExtendsPositiveDir = isWallHorizontal
    ? deckCenterY > wallMidY
    : deckCenterX > wallMidX;

  const wallSideActualEdgeCoord = isWallHorizontal
    ? deckExtendsPositiveDir
      ? deckDimensions.minY
      : deckDimensions.maxY
    : deckExtendsPositiveDir
    ? deckDimensions.minX
    : deckDimensions.maxX;
  const outerActualEdgeCoord = isWallHorizontal
    ? deckExtendsPositiveDir
      ? deckDimensions.maxY
      : deckDimensions.minY
    : deckExtendsPositiveDir
    ? deckDimensions.maxX
    : deckDimensions.minX;

  let wallSideBeam = null,
    outerBeam = null,
    midBeam = null;

  if (inputs.attachmentType === "floating") {
    let wsPosCoord = wallSideActualEdgeCoord;
    if (inputs.beamType === "drop") {
      wsPosCoord =
        wallSideActualEdgeCoord +
        (deckExtendsPositiveDir
          ? DROP_BEAM_CENTERLINE_SETBACK_FEET * PIXELS_PER_FOOT
          : -(DROP_BEAM_CENTERLINE_SETBACK_FEET * PIXELS_PER_FOOT));
    }
    const wsRes = calculateBeamAndPostsInternal(
      wsPosCoord,
      isWallHorizontal,
      deckDimensions,
      beamSize,
      beamPly,
      postSize,
      deckHeightInches,
      inputs.footingType,
      "Wall-Side Beam",
      inputs.beamType
    );
    if (wsRes.beam.lengthFeet > EPSILON) {
      components.beams.push(wsRes.beam);
      components.posts.push(...wsRes.posts);
      components.footings.push(...wsRes.footings);
      wallSideBeam = wsRes.beam;
    }
  } else if (inputs.attachmentType === "house_rim") {
    components.ledger = calculateLedger(true, wallP1, wallP2, beamSize);
  }

  if (
    components.totalDepthFeet > EPSILON ||
    inputs.attachmentType === "floating"
  ) {
    let obPosCoord = outerActualEdgeCoord;
    if (inputs.beamType === "drop") {
      obPosCoord =
        outerActualEdgeCoord +
        (deckExtendsPositiveDir
          ? -(DROP_BEAM_CENTERLINE_SETBACK_FEET * PIXELS_PER_FOOT)
          : DROP_BEAM_CENTERLINE_SETBACK_FEET * PIXELS_PER_FOOT);
    }
    const obRes = calculateBeamAndPostsInternal(
      obPosCoord,
      isWallHorizontal,
      deckDimensions,
      beamSize,
      beamPly,
      postSize,
      deckHeightInches,
      inputs.footingType,
      "Outer Beam",
      inputs.beamType
    );
    if (obRes.beam.lengthFeet > EPSILON) {
      components.beams.push(obRes.beam);
      components.posts.push(...obRes.posts);
      components.footings.push(...obRes.footings);
      outerBeam = obRes.beam;
    }
    if (
      !outerBeam &&
      !(components.ledger && !requiresMidBeam && joistSizeResult.size) &&
      inputs.attachmentType !== "house_rim" &&
      inputs.attachmentType !== "floating"
    ) {
      if (inputs.attachmentType !== "floating" || !wallSideBeam) {
        return {
          ...components,
          error:
            "Outer beam calculation failed for non-ledger, non-floating deck.",
        };
      }
    }
  }

  if (requiresMidBeam) {
    let spanStartForMidBeamCalc = components.ledger
      ? isWallHorizontal
        ? components.ledger.p1.y
        : components.ledger.p1.x
      : wallSideBeam
      ? isWallHorizontal
        ? wallSideBeam.centerlineP1.y
        : wallSideBeam.centerlineP1.x
      : wallSideActualEdgeCoord;
    let spanEndForMidBeamCalc = outerBeam
      ? isWallHorizontal
        ? outerBeam.centerlineP1.y
        : outerBeam.centerlineP1.x
      : outerActualEdgeCoord;
    let midBeamCenterline =
      spanStartForMidBeamCalc +
      (spanEndForMidBeamCalc - spanStartForMidBeamCalc) / 2;

    const mbRes = calculateBeamAndPostsInternal(
      midBeamCenterline,
      isWallHorizontal,
      deckDimensions,
      beamSize,
      beamPly,
      postSize,
      deckHeightInches,
      inputs.footingType,
      "Mid Beam",
      "drop"
    );
    if (mbRes.beam.lengthFeet > EPSILON) {
      components.beams.push(mbRes.beam);
      components.posts.push(...mbRes.posts);
      components.footings.push(...mbRes.footings);
      midBeam = mbRes.beam;
    } else {
      if (!forceSingleSpanJoistsAndRims) {
        // If not forcing single span, mid-beam failure is an error
        return {
          ...components,
          error: "Mid-beam required but could not be calculated.",
        };
      }
      // If forcing single span, midBeam remains null, but requiresMidBeam flag is still true.
    }
  }

  if (components.ledger) {
    joistStartFixedCoord = isWallHorizontal
      ? components.ledger.p1.y
      : components.ledger.p1.x;
  } else if (wallSideBeam) {
    joistStartFixedCoord = wallSideBeam.isFlush
      ? wallSideActualEdgeCoord +
        (deckExtendsPositiveDir
          ? ACTUAL_LUMBER_THICKNESS_PIXELS
          : -ACTUAL_LUMBER_THICKNESS_PIXELS)
      : wallSideActualEdgeCoord;
  } else {
    joistStartFixedCoord = wallSideActualEdgeCoord;
  }

  if (midBeam) {
    joistEndFixedCoord1 = isWallHorizontal
      ? midBeam.centerlineP1.y
      : midBeam.centerlineP1.x;
    if (outerBeam) {
      joistEndFixedCoord2 = outerBeam.isFlush
        ? outerActualEdgeCoord +
          (deckExtendsPositiveDir
            ? -ACTUAL_LUMBER_THICKNESS_PIXELS
            : ACTUAL_LUMBER_THICKNESS_PIXELS)
        : outerActualEdgeCoord;
    } else {
      joistEndFixedCoord2 = outerActualEdgeCoord;
    }
  } else {
    // No midBeam object
    joistEndFixedCoord2 = null; // Important for single-span logic if mid-beam was required but not "created" due to forceSingleSpan
    if (outerBeam) {
      joistEndFixedCoord1 = outerBeam.isFlush
        ? outerActualEdgeCoord +
          (deckExtendsPositiveDir
            ? -ACTUAL_LUMBER_THICKNESS_PIXELS
            : ACTUAL_LUMBER_THICKNESS_PIXELS)
        : outerActualEdgeCoord;
    } else {
      joistEndFixedCoord1 = outerActualEdgeCoord;
    }
    // If forceSingleSpanJoistsAndRims is true, joistEndFixedCoord2 needs to be the true outer edge for joist calculation
    if (forceSingleSpanJoistsAndRims) {
      joistEndFixedCoord2 = outerActualEdgeCoord; // Ensure this is set for the single span target
    }
  }

  const joistSpacingPixels = (inputs.joistSpacing / 12) * PIXELS_PER_FOOT;
  const hasPictureFrame = inputs.pictureFrame !== "none";
  const pictureFrameInsetPixels = hasPictureFrame
    ? ((inputs.pictureFrame === "single"
        ? PICTURE_FRAME_SINGLE_INSET_INCHES
        : PICTURE_FRAME_DOUBLE_INSET_INCHES) /
        12) *
      PIXELS_PER_FOOT
    : 0;

  components.joists = calculateAllJoists(
    isWallHorizontal,
    deckDimensions,
    joistStartFixedCoord,
    joistEndFixedCoord1,
    joistEndFixedCoord2,
    !!midBeam, // Whether a mid-beam physically exists for segmentation (if not forcing single span)
    joistSize,
    hasPictureFrame,
    pictureFrameInsetPixels,
    joistSpacingPixels,
    forceSingleSpanJoistsAndRims
  );

  const deckEdgeP1_WallSide = isWallHorizontal
    ? { x: deckDimensions.minX, y: wallSideActualEdgeCoord }
    : { x: wallSideActualEdgeCoord, y: deckDimensions.minY };
  const deckEdgeP2_WallSide = isWallHorizontal
    ? { x: deckDimensions.maxX, y: wallSideActualEdgeCoord }
    : { x: wallSideActualEdgeCoord, y: deckDimensions.maxY };
  const deckEdgeP1_OuterSide = isWallHorizontal
    ? { x: deckDimensions.minX, y: outerActualEdgeCoord }
    : { x: outerActualEdgeCoord, y: deckDimensions.minY };
  const deckEdgeP2_OuterSide = isWallHorizontal
    ? { x: deckDimensions.maxX, y: outerActualEdgeCoord }
    : { x: outerActualEdgeCoord, y: deckDimensions.maxY };

  let rimJoist_firstSupportCoord = midBeam
    ? isWallHorizontal
      ? midBeam.centerlineP1.y
      : midBeam.centerlineP1.x
    : joistEndFixedCoord1;
  let rimJoist_outerSupportCoord = midBeam ? joistEndFixedCoord2 : null;
  // If forcing single span and midBeam object is null (but was required), outerSupportCoord needs to be the true outer edge for rim joists.
  if (forceSingleSpanJoistsAndRims && !midBeam && requiresMidBeam) {
    rimJoist_outerSupportCoord = outerActualEdgeCoord;
  }

  components.rimJoists = calculateAllRimJoists(
    isWallHorizontal,
    deckDimensions,
    joistStartFixedCoord,
    rimJoist_firstSupportCoord,
    rimJoist_outerSupportCoord,
    !!midBeam, // Pass whether mid-beam physically exists
    joistSize,
    deckEdgeP1_WallSide,
    deckEdgeP2_WallSide,
    deckEdgeP1_OuterSide,
    deckEdgeP2_OuterSide,
    inputs.attachmentType,
    forceSingleSpanJoistsAndRims // Pass the flag for End Joists
  );

  const blockingMaterialSize = joistSize;
  const blockingMaterialPly = 1;

  let blocking_midBeamCoord = midBeam
    ? isWallHorizontal
      ? midBeam.centerlineP1.y
      : midBeam.centerlineP1.x
    : null;
  let blocking_spanEndCoord = midBeam
    ? joistEndFixedCoord2
    : joistEndFixedCoord1;
  if (midBeam && blocking_spanEndCoord === null)
    blocking_spanEndCoord = outerActualEdgeCoord;

  components.midSpanBlocking = calculateMidSpanBlocking(
    !!midBeam,
    joistStartFixedCoord,
    blocking_midBeamCoord,
    blocking_spanEndCoord,
    deckWidthPixels,
    blockingMaterialSize,
    blockingMaterialPly,
    isWallHorizontal,
    deckDimensions
  );

  let firstPFJoistFromAllJoists = null;
  let lastPFJoistFromAllJoists = null;
  if (
    hasPictureFrame &&
    components.joists.some((j) => j.usage === "Picture Frame Joist")
  ) {
    const allPfJoists = components.joists
      .filter((j) => j.usage === "Picture Frame Joist")
      .sort((a, b) => {
        if (isWallHorizontal) return a.p1.x - b.p1.x;
        return a.p1.y - b.p1.y;
      });
    if (allPfJoists.length > 0) {
      firstPFJoistFromAllJoists = allPfJoists[0];
      lastPFJoistFromAllJoists = allPfJoists[allPfJoists.length - 1];
    }
  }

  if (hasPictureFrame && firstPFJoistFromAllJoists) {
    components.pictureFrameBlocking = calculateLadderStylePictureFrameBlocking(
      isWallHorizontal,
      deckDimensions,
      deckExtendsPositiveDir,
      wallSideActualEdgeCoord,
      outerActualEdgeCoord,
      firstPFJoistFromAllJoists,
      lastPFJoistFromAllJoists,
      blockingMaterialSize,
      joistSpacingPixels
    );
  }

  components.beams.sort((a, b) => {
    const order = { "Wall-Side Beam": 1, "Mid Beam": 2, "Outer Beam": 3 };
    return (order[a.usage] || 99) - (order[b.usage] || 99);
  });
  return components;
}
