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
import { distance } from "./utils.js";
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
  beamFootings = beamPosts.map((post) => ({
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

function calculateAllJoistsWithMultipleBeams(
  isWallHorizontal,
  deckDimensions,
  joistStartFixedCoord,
  beamCoordinates, // Array of beam centerline coordinates (including outer beam if drop)
  joistSize,
  hasPictureFrame,
  pictureFrameInsetPixels,
  joistSpacingPixels,
  forceSingleSpanJoists
) {
  const joists = [];
  const placementAxisMin = isWallHorizontal
    ? deckDimensions.minX
    : deckDimensions.minY;
  const placementAxisMax = isWallHorizontal
    ? deckDimensions.maxX
    : deckDimensions.maxY;

  const addJoistSegments = (pos, usage) => {
    if (forceSingleSpanJoists) {
      // Single span from start to end
      const lastBeamCoord = beamCoordinates[beamCoordinates.length - 1];
      const p1 = isWallHorizontal
        ? { x: pos, y: joistStartFixedCoord }
        : { x: joistStartFixedCoord, y: pos };
      const p2 = isWallHorizontal
        ? { x: pos, y: lastBeamCoord }
        : { x: lastBeamCoord, y: pos };
      
      if (distance(p1, p2) > EPSILON) {
        joists.push({
          p1,
          p2,
          size: joistSize,
          lengthFeet: distance(p1, p2) / PIXELS_PER_FOOT,
          usage,
        });
      }
    } else {
      // Create segments between each pair of support points
      let previousCoord = joistStartFixedCoord;
      
      for (const beamCoord of beamCoordinates) {
        const p1 = isWallHorizontal
          ? { x: pos, y: previousCoord }
          : { x: previousCoord, y: pos };
        const p2 = isWallHorizontal
          ? { x: pos, y: beamCoord }
          : { x: beamCoord, y: pos };
        
        if (distance(p1, p2) > EPSILON) {
          joists.push({
            p1,
            p2,
            size: joistSize,
            lengthFeet: distance(p1, p2) / PIXELS_PER_FOOT,
            usage,
          });
        }
        previousCoord = beamCoord;
      }
    }
  };

  // Handle picture frame joists
  let firstPFJoistPos = null, lastPFJoistPos = null;
  const physicalDeckEdgeStart = placementAxisMin;
  const physicalDeckEdgeEnd = placementAxisMax;

  if (hasPictureFrame) {
    firstPFJoistPos = physicalDeckEdgeStart + pictureFrameInsetPixels;
    lastPFJoistPos = physicalDeckEdgeEnd - pictureFrameInsetPixels;
    addJoistSegments(firstPFJoistPos, "Picture Frame Joist");
    if (Math.abs(lastPFJoistPos - firstPFJoistPos) > joistSpacingPixels * 0.5) {
      addJoistSegments(lastPFJoistPos, "Picture Frame Joist");
    }
  }

  // Handle regular joists
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
    addJoistSegments(currentPos, "Joist");
  }

  joists.sort((a, b) => (isWallHorizontal ? a.p1.x - b.p1.x : a.p1.y - b.p1.y));
  return joists;
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
        // Horizontal wall/ledger: joists run perpendicular (vertically in Y direction), spaced along X axis
        p1_s1 = { x: pos, y: joistStartFixedCoord };
        p2_s1 = { x: pos, y: joistEndFixedCoord2 }; // Joists run vertically (Y direction)
      } else {
        // Vertical wall/ledger: joists run perpendicular (horizontally in X direction), spaced along Y axis
        p1_s1 = { x: joistStartFixedCoord, y: pos };
        p2_s1 = { x: joistEndFixedCoord2, y: pos }; // Joists run horizontally (X direction)
      }
      if (distance(p1_s1, p2_s1) > EPSILON) {
        joists.push({
          p1: p1_s1,
          p2: p2_s1,
          size: joistSize,
          lengthFeet: distance(p1_s1, p2_s1) / PIXELS_PER_FOOT,
          usage,
        });
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
        joists.push({
          p1: p1_s1,
          p2: p2_s1,
          size: joistSize,
          lengthFeet: distance(p1_s1, p2_s1) / PIXELS_PER_FOOT,
          usage,
        });
      }
      if (p1_s2 && p2_s2 && distance(p1_s2, p2_s2) > EPSILON) {
        joists.push({
          p1: p1_s2,
          p2: p2_s2,
          size: joistSize,
          lengthFeet: distance(p1_s2, p2_s2) / PIXELS_PER_FOOT,
          usage,
        });
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

function calculateAllRimJoistsWithMultipleBeams(
  isWallHorizontal,
  deckDimensions,
  joistStartLineCoord,
  beamCoordinates, // Array of beam centerline coordinates
  rimJoistSize,
  deckEdgeP1_WallSide,
  deckEdgeP2_WallSide,
  deckEdgeP1_OuterSide,
  deckEdgeP2_OuterSide,
  attachmentType,
  forceSingleSpanRims
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

  // End Joist 1 (Left/Top side)
  const fullEj1P1 = deckEdgeP1_WallSide;
  const fullEj1P2 = isWallHorizontal
    ? { x: sideRimMin, y: deckEdgeP1_OuterSide.y }
    : { x: deckEdgeP1_OuterSide.x, y: sideRimMin };

  if (forceSingleSpanRims) {
    // Single span from start to last beam
    const lastBeamCoord = beamCoordinates[beamCoordinates.length - 1];
    const ej1p1 = isWallHorizontal
      ? { x: sideRimMin, y: joistStartLineCoord }
      : { x: joistStartLineCoord, y: sideRimMin };
    const ej1p2 = isWallHorizontal
      ? { x: sideRimMin, y: lastBeamCoord }
      : { x: lastBeamCoord, y: sideRimMin };
    addRimSegment(ej1p1, ej1p2, "End Joist", fullEj1P1, fullEj1P2);
  } else {
    // Create segments between each pair of support points
    let previousCoord = joistStartLineCoord;
    
    for (const beamCoord of beamCoordinates) {
      const p1 = isWallHorizontal
        ? { x: sideRimMin, y: previousCoord }
        : { x: previousCoord, y: sideRimMin };
      const p2 = isWallHorizontal
        ? { x: sideRimMin, y: beamCoord }
        : { x: beamCoord, y: sideRimMin };
      addRimSegment(p1, p2, "End Joist", fullEj1P1, fullEj1P2);
      previousCoord = beamCoord;
    }
  }

  // End Joist 2 (Right/Bottom side) - same logic
  const fullEj2P1 = deckEdgeP2_WallSide;
  const fullEj2P2 = isWallHorizontal
    ? { x: sideRimMax, y: deckEdgeP2_OuterSide.y }
    : { x: deckEdgeP2_OuterSide.x, y: sideRimMax };

  if (forceSingleSpanRims) {
    const lastBeamCoord = beamCoordinates[beamCoordinates.length - 1];
    const ej2p1 = isWallHorizontal
      ? { x: sideRimMax, y: joistStartLineCoord }
      : { x: joistStartLineCoord, y: sideRimMax };
    const ej2p2 = isWallHorizontal
      ? { x: sideRimMax, y: lastBeamCoord }
      : { x: lastBeamCoord, y: sideRimMax };
    addRimSegment(ej2p1, ej2p2, "End Joist", fullEj2P1, fullEj2P2);
  } else {
    let previousCoord = joistStartLineCoord;
    
    for (const beamCoord of beamCoordinates) {
      const p1 = isWallHorizontal
        ? { x: sideRimMax, y: previousCoord }
        : { x: previousCoord, y: sideRimMax };
      const p2 = isWallHorizontal
        ? { x: sideRimMax, y: beamCoord }
        : { x: beamCoord, y: sideRimMax };
      addRimSegment(p1, p2, "End Joist", fullEj2P1, fullEj2P2);
      previousCoord = beamCoord;
    }
  }

  // Outer Rim Joist (parallel to ledger/wall) - not affected by multiple beams
  addRimSegment(
    deckEdgeP1_OuterSide,
    deckEdgeP2_OuterSide,
    "Outer Rim Joist",
    deckEdgeP1_OuterSide,
    deckEdgeP2_OuterSide
  );

  // Wall Rim Joist (if concrete or floating attachment) - not affected by multiple beams
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
      if (distance(p1, p2) > EPSILON)
        midSpanBlocking.push({
          p1,
          p2,
          size: blockingSize,
          lengthFeet: distance(p1, p2) / PIXELS_PER_FOOT,
          usage: "Mid-Span Blocking",
          boardCount: blockingBoardCount,
        });
    }
  };

  if (requiresMidBeam && midBeamCoord !== null) {
    createBlockingRows(joistSpanStartCoord, midBeamCoord);
    createBlockingRows(midBeamCoord, joistSpanEndCoord);
  } else {
    createBlockingRows(joistSpanStartCoord, joistSpanEndCoord);
  }
  return midSpanBlocking;
}

function calculateMidSpanBlockingWithMultipleBeams(
  joistStartCoord,
  beamCoordinates, // Array of beam centerline coordinates
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
      if (distance(p1, p2) > EPSILON)
        midSpanBlocking.push({
          p1,
          p2,
          size: blockingSize,
          lengthFeet: distance(p1, p2) / PIXELS_PER_FOOT,
          usage: "Mid-Span Blocking",
          boardCount: blockingBoardCount,
        });
    }
  };

  // Create blocking for each span between support points
  let previousCoord = joistStartCoord;
  
  for (const beamCoord of beamCoordinates) {
    createBlockingRows(previousCoord, beamCoord);
    previousCoord = beamCoord;
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

export function calculateStructure(
  shapePoints,
  wallIndex,
  inputs,
  deckDimensions
) {
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
    cornerCount: shapePoints?.length || 4, // Number of corners for angle brackets
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
  let numberOfMidBeams = 0;
  let spanBetweenBeams = components.totalDepthFeet;

  if (requiresMidBeam) {
    // Calculate how many mid-beams we need
    const maxJoistSpans = getMaxJoistSpans();
    let maxAllowableSpan = 0;
    
    // Find the maximum span for any allowed joist size
    for (const currentSize of JOIST_SIZE_ORDER) {
      if (deckHeightInches >= MIN_HEIGHT_FOR_NO_2X6_INCHES && currentSize === "2x6") continue;
      const rule = maxJoistSpans.find(
        (r) => r.size === currentSize && r.spacing === inputs.joistSpacing
      );
      if (rule) {
        maxAllowableSpan = Math.max(maxAllowableSpan, rule.maxSpanFt);
      }
    }
    
    if (maxAllowableSpan === 0) {
      return {
        ...components,
        error: "No valid joist spans found for the specified spacing.",
      };
    }
    
    // Calculate number of spans needed (and thus mid-beams needed)
    const numberOfSpans = Math.ceil(components.totalDepthFeet / maxAllowableSpan);
    numberOfMidBeams = numberOfSpans - 1;
    spanBetweenBeams = components.totalDepthFeet / numberOfSpans;
    
    // Now find the appropriate joist size for this span
    const spanJoistResult = getRequiredJoistSize(
      spanBetweenBeams,
      inputs.joistSpacing,
      deckHeightInches
    );
    if (spanJoistResult.error || !spanJoistResult.size) {
      return {
        ...components,
        error:
          spanJoistResult.error ||
          `Cannot size joists for ${numberOfMidBeams} mid-beam config with ${spanBetweenBeams.toFixed(2)}' spans.`,
      };
    }
    joistSize = spanJoistResult.size;
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
  
  // Check for user override first
  let postSize, beamPly;
  if (inputs.postSize === "4x4") {
    postSize = "4x4";
    beamPly = 2;
  } else if (inputs.postSize === "6x6") {
    postSize = "6x6";
    beamPly = 3;
  } else {
    // Use automatic logic (existing behavior)
    postSize = deckHeightInches >= 60 ? "6x6" : "4x4";
    beamPly = postSize === "6x6" ? 3 : 2;
  }

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

  let midBeams = [];
  if (requiresMidBeam && numberOfMidBeams > 0) {
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
    
    // Calculate positions for all mid-beams
    const totalSpan = spanEndForMidBeamCalc - spanStartForMidBeamCalc;
    const beamSpacing = totalSpan / (numberOfMidBeams + 1);
    
    for (let i = 1; i <= numberOfMidBeams; i++) {
      const midBeamCenterline = spanStartForMidBeamCalc + (beamSpacing * i);
      const beamLabel = numberOfMidBeams > 1 ? `Mid Beam ${i}` : "Mid Beam";
      
      const mbRes = calculateBeamAndPostsInternal(
        midBeamCenterline,
        isWallHorizontal,
        deckDimensions,
        beamSize,
        beamPly,
        postSize,
        deckHeightInches,
        inputs.footingType,
        beamLabel,
        "drop"
      );
      if (mbRes.beam.lengthFeet > EPSILON) {
        components.beams.push(mbRes.beam);
        components.posts.push(...mbRes.posts);
        components.footings.push(...mbRes.footings);
        midBeams.push(mbRes.beam);
      } else {
        if (!forceSingleSpanJoistsAndRims) {
          return {
            ...components,
            error: `${beamLabel} required but could not be calculated.`,
          };
        }
      }
    }
    
    // For backward compatibility, keep midBeam as the first mid-beam
    midBeam = midBeams.length > 0 ? midBeams[0] : null;
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

  // Build array of beam coordinates for joists
  const beamCoordinates = [];
  
  // Add all mid-beam coordinates
  for (const mb of midBeams) {
    beamCoordinates.push(
      isWallHorizontal ? mb.centerlineP1.y : mb.centerlineP1.x
    );
  }
  
  // Add outer beam coordinate
  if (outerBeam) {
    const outerCoord = outerBeam.isFlush
      ? outerActualEdgeCoord +
        (deckExtendsPositiveDir
          ? -ACTUAL_LUMBER_THICKNESS_PIXELS
          : ACTUAL_LUMBER_THICKNESS_PIXELS)
      : outerActualEdgeCoord;
    beamCoordinates.push(outerCoord);
  } else {
    beamCoordinates.push(outerActualEdgeCoord);
  }
  
  // Sort beam coordinates from wall side to outer side
  beamCoordinates.sort((a, b) => {
    return deckExtendsPositiveDir ? a - b : b - a;
  });
  
  // For backward compatibility with the rest of the code
  if (midBeams.length > 0) {
    joistEndFixedCoord1 = beamCoordinates[0];
    joistEndFixedCoord2 = beamCoordinates.length > 1 ? beamCoordinates[beamCoordinates.length - 1] : null;
  } else {
    joistEndFixedCoord1 = beamCoordinates[0];
    joistEndFixedCoord2 = null;
    if (forceSingleSpanJoistsAndRims) {
      joistEndFixedCoord2 = outerActualEdgeCoord;
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

  // Use new multi-beam function if we have multiple beams, otherwise use legacy function
  if (midBeams.length > 1) {
    components.joists = calculateAllJoistsWithMultipleBeams(
      isWallHorizontal,
      deckDimensions,
      joistStartFixedCoord,
      beamCoordinates,
      joistSize,
      hasPictureFrame,
      pictureFrameInsetPixels,
      joistSpacingPixels,
      forceSingleSpanJoistsAndRims
    );
  } else {
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
  }

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

  // Update rim joist calculation for multiple beams
  if (midBeams.length > 1) {
    components.rimJoists = calculateAllRimJoistsWithMultipleBeams(
      isWallHorizontal,
      deckDimensions,
      joistStartFixedCoord,
      beamCoordinates,
      joistSize,
      deckEdgeP1_WallSide,
      deckEdgeP2_WallSide,
      deckEdgeP1_OuterSide,
      deckEdgeP2_OuterSide,
      inputs.attachmentType,
      forceSingleSpanJoistsAndRims
    );
  } else {
    // Legacy single mid-beam logic
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
  }

  const blockingMaterialSize = joistSize;
  const blockingMaterialPly = 1;

  // Update mid-span blocking calculation for multiple beams
  if (midBeams.length > 1) {
    components.midSpanBlocking = calculateMidSpanBlockingWithMultipleBeams(
      joistStartFixedCoord,
      beamCoordinates,
      blockingMaterialSize,
      blockingMaterialPly,
      isWallHorizontal,
      deckDimensions
    );
  } else {
    // Legacy single mid-beam logic
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
  }

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

  // Merge colinear beams and recalculate their posts/footings
  const mergeResult = mergeColinearBeamsWithPosts(
    components.beams, 
    components.posts, 
    components.footings,
    postSize,
    deckHeightInches,
    inputs.footingType
  );
  components.beams = mergeResult.beams;
  components.posts = mergeResult.posts;
  components.footings = mergeResult.footings;

  components.beams.sort((a, b) => {
    // Sort beams from wall side to outer side
    const getOrder = (beam) => {
      if (beam.usage === "Wall-Side Beam") return 1;
      if (beam.usage === "Outer Beam") return 1000;
      if (beam.usage === "Mid Beam") return 500;
      // For numbered mid-beams (e.g., "Mid Beam 1", "Mid Beam 2")
      const midBeamMatch = beam.usage.match(/Mid Beam (\d+)/);
      if (midBeamMatch) {
        return 100 + parseInt(midBeamMatch[1]) * 10;
      }
      return 999;
    };
    return getOrder(a) - getOrder(b);
  });
  return components;
}

/**
 * Merges colinear beams and recalculates posts/footings for merged beams
 * @param {Array} beams - Array of beam objects
 * @param {Array} posts - Array of post objects
 * @param {Array} footings - Array of footing objects
 * @param {string} postSize - Size of posts
 * @param {number} deckHeightInches - Deck height in inches
 * @param {string} footingType - Type of footings
 * @returns {Object} Object containing merged beams, posts, and footings
 */
function mergeColinearBeamsWithPosts(beams, posts, footings, postSize, deckHeightInches, footingType) {
  if (beams.length <= 1) {
    return { beams, posts, footings };
  }
  
  // First, merge the beams
  const mergedBeams = mergeColinearBeams(beams);
  
  // Now recalculate posts and footings for all beams
  const newPosts = [];
  const newFootings = [];
  
  mergedBeams.forEach(beam => {
    // Calculate posts for this beam
    const beamPosts = calculatePostsForBeam(
      beam,
      postSize,
      deckHeightInches
    );
    
    // Add posts
    newPosts.push(...beamPosts);
    
    // Create footings for each post
    beamPosts.forEach(post => {
      newFootings.push({
        position: { x: post.x, y: post.y },
        type: footingType
      });
    });
  });
  
  return {
    beams: mergedBeams,
    posts: newPosts,
    footings: newFootings
  };
}

/**
 * Calculates posts for a single beam following spacing rules
 * @param {Object} beam - Beam object
 * @param {string} postSize - Size of posts
 * @param {number} deckHeightInches - Deck height in inches
 * @returns {Array} Array of post objects
 */
function calculatePostsForBeam(beam, postSize, deckHeightInches) {
  const beamPosts = [];
  const beamLengthPixels = distance(beam.centerlineP1, beam.centerlineP2);
  
  if (beamLengthPixels < EPSILON) {
    return beamPosts;
  }
  
  const beamDx = beam.centerlineP2.x - beam.centerlineP1.x;
  const beamDy = beam.centerlineP2.y - beam.centerlineP1.y;
  const unitVecX = beamDx / beamLengthPixels;
  const unitVecY = beamDy / beamLengthPixels;
  const postInsetPixels = POST_INSET_FEET * PIXELS_PER_FOOT;
  
  // For very short beams, place a single post in the center
  if (beamLengthPixels < postInsetPixels * 2) {
    beamPosts.push({
      x: beam.centerlineP1.x + unitVecX * (beamLengthPixels / 2),
      y: beam.centerlineP1.y + unitVecY * (beamLengthPixels / 2),
      size: postSize,
      heightFeet: deckHeightInches / 12,
      position: {
        x: beam.centerlineP1.x + unitVecX * (beamLengthPixels / 2),
        y: beam.centerlineP1.y + unitVecY * (beamLengthPixels / 2)
      }
    });
    return beamPosts;
  }
  
  // Place posts at standard inset from ends
  const post1 = {
    x: beam.centerlineP1.x + unitVecX * postInsetPixels,
    y: beam.centerlineP1.y + unitVecY * postInsetPixels,
    size: postSize,
    heightFeet: deckHeightInches / 12
  };
  post1.position = { x: post1.x, y: post1.y };
  
  const post2 = {
    x: beam.centerlineP2.x - unitVecX * postInsetPixels,
    y: beam.centerlineP2.y - unitVecY * postInsetPixels,
    size: postSize,
    heightFeet: deckHeightInches / 12
  };
  post2.position = { x: post2.x, y: post2.y };
  
  beamPosts.push(post1, post2);
  
  // Check if we need intermediate posts
  const postSpanPixels = distance(post1, post2);
  if (postSpanPixels / PIXELS_PER_FOOT > MAX_POST_SPACING_FEET) {
    const numIntermediatePosts = Math.floor(
      postSpanPixels / PIXELS_PER_FOOT / MAX_POST_SPACING_FEET
    );
    const intermediateSpacingPixels = postSpanPixels / (numIntermediatePosts + 1);
    
    for (let i = 1; i <= numIntermediatePosts; i++) {
      const intermediatePost = {
        x: post1.x + unitVecX * (intermediateSpacingPixels * i),
        y: post1.y + unitVecY * (intermediateSpacingPixels * i),
        size: postSize,
        heightFeet: deckHeightInches / 12
      };
      intermediatePost.position = { x: intermediatePost.x, y: intermediatePost.y };
      beamPosts.push(intermediatePost);
    }
  }
  
  return beamPosts;
}

/**
 * Merges colinear beams that are adjacent to each other
 * @param {Array} beams - Array of beam objects
 * @returns {Array} Array of beams with colinear ones merged
 */
function mergeColinearBeams(beams) {
  if (beams.length <= 1) return beams;
  
  const mergedBeams = [];
  const processed = new Set();
  
  for (let i = 0; i < beams.length; i++) {
    if (processed.has(i)) continue;
    
    const beam1 = beams[i];
    let mergedBeam = { ...beam1 };
    processed.add(i);
    
    // Check if this beam is colinear with any other beam
    for (let j = i + 1; j < beams.length; j++) {
      if (processed.has(j)) continue;
      
      const beam2 = beams[j];
      
      // Check if beams are colinear and adjacent
      if (areBeamsColinearAndAdjacent(mergedBeam, beam2)) {
        // Merge the beams
        mergedBeam = mergeTwoBeams(mergedBeam, beam2);
        processed.add(j);
      }
    }
    
    mergedBeams.push(mergedBeam);
  }
  
  return mergedBeams;
}

/**
 * Checks if two beams are colinear and adjacent
 * @param {Object} beam1 - First beam
 * @param {Object} beam2 - Second beam
 * @returns {boolean} True if beams are colinear and adjacent
 */
function areBeamsColinearAndAdjacent(beam1, beam2) {
  const TOLERANCE = 2; // pixels tolerance for adjacency
  
  // Check if beams have the same properties (size, ply, type)
  if (beam1.size !== beam2.size || beam1.ply !== beam2.ply || beam1.isFlush !== beam2.isFlush) {
    return false;
  }
  
  // Check if beams are on the same line (using centerline points)
  const isHorizontal1 = Math.abs(beam1.centerlineP1.y - beam1.centerlineP2.y) < EPSILON;
  const isHorizontal2 = Math.abs(beam2.centerlineP1.y - beam2.centerlineP2.y) < EPSILON;
  const isVertical1 = Math.abs(beam1.centerlineP1.x - beam1.centerlineP2.x) < EPSILON;
  const isVertical2 = Math.abs(beam2.centerlineP1.x - beam2.centerlineP2.x) < EPSILON;
  
  // Both must have same orientation
  if (isHorizontal1 !== isHorizontal2 || isVertical1 !== isVertical2) {
    return false;
  }
  
  if (isHorizontal1) {
    // Check if on same horizontal line
    if (Math.abs(beam1.centerlineP1.y - beam2.centerlineP1.y) > TOLERANCE) {
      return false;
    }
    
    // Check if adjacent (end of one beam near start of other)
    const beam1MinX = Math.min(beam1.centerlineP1.x, beam1.centerlineP2.x);
    const beam1MaxX = Math.max(beam1.centerlineP1.x, beam1.centerlineP2.x);
    const beam2MinX = Math.min(beam2.centerlineP1.x, beam2.centerlineP2.x);
    const beam2MaxX = Math.max(beam2.centerlineP1.x, beam2.centerlineP2.x);
    
    // Check if beams are adjacent or overlapping
    return (Math.abs(beam1MaxX - beam2MinX) <= TOLERANCE || 
            Math.abs(beam2MaxX - beam1MinX) <= TOLERANCE ||
            (beam1MinX <= beam2MaxX && beam2MinX <= beam1MaxX)); // overlapping
  } else if (isVertical1) {
    // Check if on same vertical line
    if (Math.abs(beam1.centerlineP1.x - beam2.centerlineP1.x) > TOLERANCE) {
      return false;
    }
    
    // Check if adjacent (end of one beam near start of other)
    const beam1MinY = Math.min(beam1.centerlineP1.y, beam1.centerlineP2.y);
    const beam1MaxY = Math.max(beam1.centerlineP1.y, beam1.centerlineP2.y);
    const beam2MinY = Math.min(beam2.centerlineP1.y, beam2.centerlineP2.y);
    const beam2MaxY = Math.max(beam2.centerlineP1.y, beam2.centerlineP2.y);
    
    // Check if beams are adjacent or overlapping
    return (Math.abs(beam1MaxY - beam2MinY) <= TOLERANCE || 
            Math.abs(beam2MaxY - beam1MinY) <= TOLERANCE ||
            (beam1MinY <= beam2MaxY && beam2MinY <= beam1MaxY)); // overlapping
  }
  
  return false;
}

/**
 * Merges two beams into one
 * @param {Object} beam1 - First beam
 * @param {Object} beam2 - Second beam
 * @returns {Object} Merged beam
 */
function mergeTwoBeams(beam1, beam2) {
  const isHorizontal = Math.abs(beam1.centerlineP1.y - beam1.centerlineP2.y) < EPSILON;
  
  let mergedBeam = { ...beam1 };
  
  if (isHorizontal) {
    // Find the extreme points for horizontal beams
    const allX = [
      beam1.centerlineP1.x, beam1.centerlineP2.x,
      beam2.centerlineP1.x, beam2.centerlineP2.x
    ];
    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    
    // Update centerline points
    mergedBeam.centerlineP1 = { x: minX, y: beam1.centerlineP1.y };
    mergedBeam.centerlineP2 = { x: maxX, y: beam1.centerlineP1.y };
    
    // Update material points (p1, p2)
    const allMaterialX = [
      beam1.p1.x, beam1.p2.x,
      beam2.p1.x, beam2.p2.x
    ];
    const minMaterialX = Math.min(...allMaterialX);
    const maxMaterialX = Math.max(...allMaterialX);
    
    mergedBeam.p1 = { x: minMaterialX, y: beam1.p1.y };
    mergedBeam.p2 = { x: maxMaterialX, y: beam1.p1.y };
    
    // Update position coordinate line points
    mergedBeam.positionCoordinateLineP1 = { x: minX, y: beam1.positionCoordinateLineP1.y };
    mergedBeam.positionCoordinateLineP2 = { x: maxX, y: beam1.positionCoordinateLineP1.y };
  } else {
    // Find the extreme points for vertical beams
    const allY = [
      beam1.centerlineP1.y, beam1.centerlineP2.y,
      beam2.centerlineP1.y, beam2.centerlineP2.y
    ];
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);
    
    // Update centerline points
    mergedBeam.centerlineP1 = { x: beam1.centerlineP1.x, y: minY };
    mergedBeam.centerlineP2 = { x: beam1.centerlineP1.x, y: maxY };
    
    // Update material points (p1, p2)
    const allMaterialY = [
      beam1.p1.y, beam1.p2.y,
      beam2.p1.y, beam2.p2.y
    ];
    const minMaterialY = Math.min(...allMaterialY);
    const maxMaterialY = Math.max(...allMaterialY);
    
    mergedBeam.p1 = { x: beam1.p1.x, y: minMaterialY };
    mergedBeam.p2 = { x: beam1.p1.x, y: maxMaterialY };
    
    // Update position coordinate line points
    mergedBeam.positionCoordinateLineP1 = { x: beam1.positionCoordinateLineP1.x, y: minY };
    mergedBeam.positionCoordinateLineP2 = { x: beam1.positionCoordinateLineP1.x, y: maxY };
  }
  
  // Update length
  mergedBeam.lengthFeet = distance(mergedBeam.p1, mergedBeam.p2) / PIXELS_PER_FOOT;
  
  // Merge usage labels
  if (beam1.usage !== beam2.usage) {
    mergedBeam.usage = `${beam1.usage} + ${beam2.usage}`;
  }
  
  return mergedBeam;
}

