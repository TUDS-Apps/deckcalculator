// deckCalculations.js (v13 - Continuous 2x8s for Joists, End Joists, and PF Joists)
import {
  PIXELS_PER_FOOT,
  POST_INSET_FEET,
  MAX_POST_SPACING_FEET,
  BEAM_CANTILEVER_FEET,
  CANTILEVER_BY_JOIST_SIZE,
  EPSILON,
  MIN_HEIGHT_FOR_NO_2X6_INCHES,
  PICTURE_FRAME_SINGLE_INSET_INCHES,
  PICTURE_FRAME_DOUBLE_INSET_INCHES,
  MAX_BLOCKING_SPACING_FEET,
  JOIST_SIZE_ORDER,
} from "./config.js";
import { distance } from "./utils.js";
import { getMaxJoistSpans, recommendBeamSize, validateBeamSpan, calculateFootingDiameter, calculateTributaryArea } from "./dataManager.js";

// --- Constants ---
const ACTUAL_LUMBER_THICKNESS_INCHES = 1.5;
const ACTUAL_LUMBER_THICKNESS_PIXELS =
  (ACTUAL_LUMBER_THICKNESS_INCHES / 12) * PIXELS_PER_FOOT;
const HALF_LUMBER_THICKNESS_PIXELS = ACTUAL_LUMBER_THICKNESS_PIXELS / 2;

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
      usage: usageLabel,
    });
  } else if (beamLengthPixels >= POST_INSET_FEET * PIXELS_PER_FOOT * 2) {
    beamPosts.push({
      ...post1Pos,
      size: postSize,
      heightFeet: deckHeightInches / 12,
      usage: usageLabel,
    });
    if (distance(post1Pos, post2Pos) > EPSILON)
      beamPosts.push({
        ...post2Pos,
        size: postSize,
        heightFeet: deckHeightInches / 12,
        usage: usageLabel,
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
            usage: usageLabel,
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
  // Create footings with load-based diameter calculation
  // Default tributary area of 32 sqft (8' post spacing × 8' joist span / 2) for edge posts
  beamFootings = beamPosts.map((post, index) => {
    const isCorner = (index === 0 || index === beamPosts.length - 1);
    const footing = createFooting(post.x, post.y, footingType, 32, isCorner);
    footing.usage = usageLabel;
    return footing;
  });

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
  ledgerIndices,  // Array of edge indices that are ledgers (can include diagonal edges)
  inputs,
  deckDimensions
) {
  // Handle both array and single index for backward compatibility
  const ledgerIndicesArray = Array.isArray(ledgerIndices) ? ledgerIndices : [ledgerIndices];
  // Primary wall index determines joist direction (first selected edge)
  const wallIndex = ledgerIndicesArray[0];

  const components = {
    ledger: null,
    beams: [],
    joists: [],
    posts: [],
    footings: [],
    rimJoists: [],
    midSpanBlocking: [],
    pictureFrameBlocking: [],
    diagonalLedgers: [],  // For diagonal edges marked as ledgers
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

  // Determine post size and beam ply FIRST (needed for IRC beam sizing)
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

  // IRC Table R507.6 beam sizing based on joist span and beam span
  // spanBetweenBeams = joist span (tributary width beam supports)
  // MAX_POST_SPACING_FEET = beam span between posts (8')
  const beamSizeResult = recommendBeamSize(MAX_POST_SPACING_FEET, spanBetweenBeams, beamPly);
  let beamSize;
  if (beamSizeResult.size) {
    beamSize = beamSizeResult.size;
  } else {
    // Fallback: if no IRC-compliant beam found, use largest available and warn
    console.warn(`IRC R507.6 Warning: ${beamSizeResult.message || 'No compliant beam size found'}. Using 2x12 with recommendation to consult engineer.`);
    beamSize = "2x12";
    components.beamWarning = beamSizeResult.message || "Beam span may exceed IRC limits. Consult a structural engineer.";
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

  // Get the cantilever distance based on joist size (not hardcoded 1 foot)
  const cantileverFeet = getCantileverForJoistSize(joistSize);

  if (inputs.attachmentType === "floating") {
    let wsPosCoord = wallSideActualEdgeCoord;
    if (inputs.beamType === "drop") {
      wsPosCoord =
        wallSideActualEdgeCoord +
        (deckExtendsPositiveDir
          ? cantileverFeet * PIXELS_PER_FOOT
          : -(cantileverFeet * PIXELS_PER_FOOT));
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
          ? -(cantileverFeet * PIXELS_PER_FOOT)
          : cantileverFeet * PIXELS_PER_FOOT);
    }

    // Check for diagonal edges and find where horizontal outer edge ends
    // If diagonal edges exist, we may need to trim the outer beam
    let trimmedDeckDimensions = { ...deckDimensions };
    if (shapePoints && shapePoints.length >= 3) {
      const diagonalEdgesCheck = getDiagonalEdges(shapePoints);
      if (diagonalEdgesCheck.length > 0) {
        // Find the horizontal outer edge (not the ledger) and get its extent
        for (let i = 0; i < shapePoints.length; i++) {
          if (i === wallIndex) continue; // Skip ledger

          const edgeP1 = shapePoints[i];
          const edgeP2 = shapePoints[(i + 1) % shapePoints.length];
          const edgeType = classifyEdge(edgeP1, edgeP2);

          // Check if this is the horizontal outer edge
          if (edgeType === 'horizontal') {
            const edgeY = (edgeP1.y + edgeP2.y) / 2;
            // Check if this edge is on the outer side of the deck
            const isOuterEdge = isWallHorizontal
              ? (deckExtendsPositiveDir ? edgeY > (deckDimensions.minY + deckDimensions.maxY) / 2 : edgeY < (deckDimensions.minY + deckDimensions.maxY) / 2)
              : (deckExtendsPositiveDir ? edgeP1.x > (deckDimensions.minX + deckDimensions.maxX) / 2 : edgeP1.x < (deckDimensions.minX + deckDimensions.maxX) / 2);

            if (isOuterEdge) {
              // Trim the outer beam to only cover this horizontal edge
              const edgeMinX = Math.min(edgeP1.x, edgeP2.x);
              const edgeMaxX = Math.max(edgeP1.x, edgeP2.x);
              const edgeMinY = Math.min(edgeP1.y, edgeP2.y);
              const edgeMaxY = Math.max(edgeP1.y, edgeP2.y);

              if (isWallHorizontal) {
                // Horizontal wall: trim X range of outer beam
                trimmedDeckDimensions.minX = edgeMinX;
                trimmedDeckDimensions.maxX = edgeMaxX;
              } else {
                // Vertical wall: trim Y range of outer beam
                trimmedDeckDimensions.minY = edgeMinY;
                trimmedDeckDimensions.maxY = edgeMaxY;
              }
              break;
            }
          }
        }
      }
    }

    const obRes = calculateBeamAndPostsInternal(
      obPosCoord,
      isWallHorizontal,
      trimmedDeckDimensions,
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

  // ============================================================================
  // UNIFIED BEAM OUTLINE GENERATION
  // Beams mirror the outer rim joist shape, offset inward by cantilever distance
  // This replaces separate outer beam + diagonal beam calculations
  // ============================================================================
  // Note: deckCenterX and deckCenterY are already defined above
  const deckCenter = { x: deckCenterX, y: deckCenterY };

  const diagonalBeams = [];
  const detectedDiagonalEdges = []; // Store detected diagonal edges for joist extension

  // First, handle diagonal ledgers (for bay window configurations)
  if (shapePoints && shapePoints.length >= 3) {
    const allDiagonalEdges = getDiagonalEdges(shapePoints);

    for (const diagEdgeInfo of allDiagonalEdges) {

      // Check if this diagonal edge is a ledger (attached to house, e.g., bay window)
      if (ledgerIndicesArray.includes(diagEdgeInfo.index)) {

        // Create diagonal ledger component (no beam, posts, or footings needed)
        const diagLedger = {
          p1: { ...diagEdgeInfo.p1 },
          p2: { ...diagEdgeInfo.p2 },
          size: joistSize,
          lengthFeet: distance(diagEdgeInfo.p1, diagEdgeInfo.p2) / PIXELS_PER_FOOT,
          isDiagonal: true,
          edgeIndex: diagEdgeInfo.index,
          angle: diagEdgeInfo.angle
        };
        components.diagonalLedgers.push(diagLedger);
      } else {
        // Store non-ledger diagonal edges for joist extension
        detectedDiagonalEdges.push(diagEdgeInfo);
      }
    }
  }

  // Generate unified beam outline (mirrors rim joist, offset by cantilever)
  // This replaces separate outer beam and diagonal beam calculations
  // ONLY apply when shape has diagonal edges - simple rectangles use traditional beam placement
  const hasDiagonalEdgesForBeams = shapePoints && shapePoints.length >= 3 && getDiagonalEdges(shapePoints).length > 0;
  const shouldUsePerimeterBeams = hasDiagonalEdgesForBeams;

  if (shouldUsePerimeterBeams) {

    // Remove existing outer beam and diagonal beams from components
    // (they were added by the old calculateBeamAndPostsInternal call above)
    const beamsToRemove = components.beams.filter(b =>
      b.usage === "Outer Beam" || b.usage === "Diagonal Beam"
    );
    const postsToRemove = [];
    const footingsToRemove = [];

    // Find and remove associated posts and footings
    for (const beam of beamsToRemove) {
      // Posts and footings are harder to track, we'll regenerate them
    }

    // Clear outer beam and diagonal beams
    components.beams = components.beams.filter(b =>
      b.usage !== "Outer Beam" && b.usage !== "Diagonal Beam"
    );

    // Also clear posts and footings that were for outer/diagonal beams
    // We'll regenerate them with the new beam outline
    components.posts = components.posts.filter(p =>
      p.usage !== "Outer Beam" && p.usage !== "Diagonal Beam" &&
      p.usage !== "Beam Post"
    );
    components.footings = components.footings.filter(f =>
      f.usage !== "Outer Beam" && f.usage !== "Diagonal Beam"
    );

    // Generate beam outline that mirrors rim joist shape
    const beamOutline = generateBeamOutlineFromPerimeter(
      shapePoints,
      ledgerIndicesArray,
      joistSize, // Use joist size to determine cantilever
      deckCenter
    );

    if (beamOutline.length > 0) {
      // Create beam components from outline
      const beamComponents = createBeamComponentsFromOutline(
        beamOutline,
        beamSize,
        beamPly,
        postSize,
        deckHeightInches,
        inputs.footingType,
        inputs.beamType
      );

      // Add to components
      components.beams.push(...beamComponents.beams);
      components.posts.push(...beamComponents.posts);
      components.footings.push(...beamComponents.footings);

      // Track diagonal beams for joist extension
      for (const beam of beamComponents.beams) {
        if (beam.isDiagonal) {
          diagonalBeams.push(beam);
        }
      }

      // Update outerBeam reference for downstream calculations
      // Use the first non-diagonal beam as the "outer beam" reference
      const mainOuterBeam = beamComponents.beams.find(b => !b.isDiagonal);
      if (mainOuterBeam) {
        outerBeam = mainOuterBeam;
      }
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

  // ============================================================================
  // EXTEND JOISTS TO DIAGONAL EDGES
  // For shapes with 45° diagonal edges, extend joists to reach the diagonal rim
  // ============================================================================
  if (detectedDiagonalEdges.length > 0) {
    components.joists = extendJoistsToDiagonalEdges(
      components.joists,
      detectedDiagonalEdges,
      isWallHorizontal,
      deckDimensions,
      deckExtendsPositiveDir
    );
  }

  // ============================================================================
  // EXTEND JOISTS TO DIAGONAL LEDGERS (HOUSE SIDE)
  // For bay window configurations, extend joists to reach diagonal ledgers
  // ============================================================================
  if (components.diagonalLedgers.length > 0) {
    components.joists = extendJoistsToLedgerDiagonals(
      components.joists,
      components.diagonalLedgers,
      isWallHorizontal,
      deckDimensions,
      deckExtendsPositiveDir
    );
  }

  // ============================================================================
  // CLIP JOISTS TO POLYGON BOUNDARY
  // For notched/jogged deck shapes, clip joists that extend outside the deck
  // ============================================================================
  components.joists = clipJoistsToPolygon(
    components.joists,
    shapePoints,
    isWallHorizontal,
    deckExtendsPositiveDir
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

  // Handle diagonal rim joists - add diagonal rim joists and trim axis-aligned ones
  if (detectedDiagonalEdges && detectedDiagonalEdges.length > 0) {
    const deckCenter = {
      x: (deckDimensions.minX + deckDimensions.maxX) / 2,
      y: (deckDimensions.minY + deckDimensions.maxY) / 2
    };
    components.rimJoists = handleDiagonalRimJoists(
      components.rimJoists,
      detectedDiagonalEdges,
      deckCenter,
      joistSize
    );

    // Handle diagonal beams - trim axis-aligned beams at their intersection with diagonal edges
    components.beams = handleDiagonalBeams(
      components.beams,
      detectedDiagonalEdges,
      deckCenter
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
    
    // Create footings for each post (using same structure as createFooting)
    beamPosts.forEach(post => {
      newFootings.push({
        x: post.x,
        y: post.y,
        type: footingType,
        diameter: footingType === "Helical" ? 0 : 16
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

// ============================================================================
// 45-DEGREE ANGLE SUPPORT FUNCTIONS
// ============================================================================

/**
 * Classifies an edge as horizontal, vertical, diagonal (45°), or other
 * @param {Object} p1 - Start point {x, y}
 * @param {Object} p2 - End point {x, y}
 * @param {number} tolerance - Angle tolerance in degrees (default 2°)
 * @returns {string} 'horizontal', 'vertical', 'diagonal', or 'other'
 */
export function classifyEdge(p1, p2, tolerance = 2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) {
    return 'other';
  }

  const angleRad = Math.atan2(Math.abs(dy), Math.abs(dx));
  const angleDeg = angleRad * (180 / Math.PI);

  if (angleDeg < tolerance) return 'horizontal';
  if (Math.abs(angleDeg - 90) < tolerance) return 'vertical';
  if (Math.abs(angleDeg - 45) < tolerance) return 'diagonal';

  return 'other';
}

/**
 * Gets the angle of an edge in radians
 * @param {Object} p1 - Start point {x, y}
 * @param {Object} p2 - End point {x, y}
 * @returns {number} Angle in radians
 */
export function getEdgeAngle(p1, p2) {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

/**
 * Gets a perpendicular unit vector to the given angle
 * @param {number} angle - Angle in radians
 * @returns {Object} Perpendicular unit vector {x, y}
 */
export function getPerpendicularVector(angle) {
  return {
    x: Math.cos(angle + Math.PI / 2),
    y: Math.sin(angle + Math.PI / 2)
  };
}

/**
 * Gets a unit vector along the given angle
 * @param {number} angle - Angle in radians
 * @returns {Object} Unit vector {x, y}
 */
export function getUnitVector(angle) {
  return {
    x: Math.cos(angle),
    y: Math.sin(angle)
  };
}

/**
 * Gets the cantilever distance based on joist size
 * @param {string} joistSize - Joist size (e.g., "2x8", "2x10")
 * @returns {number} Cantilever distance in feet
 */
export function getCantileverForJoistSize(joistSize) {
  return CANTILEVER_BY_JOIST_SIZE[joistSize] ?? BEAM_CANTILEVER_FEET;
}

/**
 * Offsets a line segment perpendicular to its direction
 * @param {Object} p1 - Start point
 * @param {Object} p2 - End point
 * @param {number} offsetPixels - Offset distance in pixels (positive = left of direction)
 * @returns {Object} {p1: {x, y}, p2: {x, y}} offset segment
 */
function offsetSegment(p1, p2, offsetPixels) {
  const angle = getEdgeAngle(p1, p2);
  const perp = getPerpendicularVector(angle);
  return {
    p1: { x: p1.x + perp.x * offsetPixels, y: p1.y + perp.y * offsetPixels },
    p2: { x: p2.x + perp.x * offsetPixels, y: p2.y + perp.y * offsetPixels }
  };
}

/**
 * Finds the intersection point of two infinite lines defined by two points each
 * (Internal helper for beam outline generation)
 * @param {Object} l1p1 - Line 1 start point
 * @param {Object} l1p2 - Line 1 end point
 * @param {Object} l2p1 - Line 2 start point
 * @param {Object} l2p2 - Line 2 end point
 * @returns {Object|null} Intersection point {x, y} or null if parallel
 */
function findLineIntersectionInternal(l1p1, l1p2, l2p1, l2p2) {
  const d1x = l1p2.x - l1p1.x;
  const d1y = l1p2.y - l1p1.y;
  const d2x = l2p2.x - l2p1.x;
  const d2y = l2p2.y - l2p1.y;

  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < EPSILON) return null; // Parallel lines

  const dx = l2p1.x - l1p1.x;
  const dy = l2p1.y - l1p1.y;
  const t = (dx * d2y - dy * d2x) / cross;

  return {
    x: l1p1.x + t * d1x,
    y: l1p1.y + t * d1y
  };
}

/**
 * Generates beam outline by offsetting the outer deck perimeter inward
 * The beam follows the same shape as the rim joist, just offset by the cantilever distance
 * @param {Array} shapePoints - Deck polygon points
 * @param {Array} ledgerIndices - Indices of edges that are ledgers (attached to house)
 * @param {string} joistSize - Joist size for determining cantilever
 * @param {Object} deckCenter - Center point of deck {x, y}
 * @returns {Array} Array of beam segment points [{p1, p2, edgeIndex, isOffsetted}]
 */
export function generateBeamOutlineFromPerimeter(shapePoints, ledgerIndices, joistSize, deckCenter) {
  if (!shapePoints || shapePoints.length < 3) return [];

  const cantileverFeet = getCantileverForJoistSize(joistSize);
  const cantileverPixels = cantileverFeet * PIXELS_PER_FOOT;


  // Check if the shape has a closing point (last point equals first point)
  // If so, we need to exclude the last edge which would be zero-length
  const firstP = shapePoints[0];
  const lastP = shapePoints[shapePoints.length - 1];
  const hasClosingPoint = Math.abs(firstP.x - lastP.x) < 1 && Math.abs(firstP.y - lastP.y) < 1;
  const numEdges = hasClosingPoint ? shapePoints.length - 1 : shapePoints.length;

  // Determine joist direction from the primary ledger
  // Joists run perpendicular to the ledger
  const primaryLedgerIndex = ledgerIndices[0];
  const ledgerP1 = shapePoints[primaryLedgerIndex];
  const ledgerP2 = shapePoints[(primaryLedgerIndex + 1) % numEdges];
  const isLedgerHorizontal = Math.abs(ledgerP1.y - ledgerP2.y) < Math.abs(ledgerP1.x - ledgerP2.x);

  // If ledger is horizontal, joists run vertically (in Y direction)
  // If ledger is vertical, joists run horizontally (in X direction)
  // Beams should only exist on edges that CROSS the joists (perpendicular to joist direction)
  // - Horizontal ledger → vertical joists → need beams on HORIZONTAL edges + diagonals
  // - Vertical ledger → horizontal joists → need beams on VERTICAL edges + diagonals

  // Get all non-ledger edges that need beams (edges that cross under joists)
  const edges = [];
  for (let i = 0; i < numEdges; i++) {
    if (ledgerIndices.includes(i)) {
      continue; // Skip ledger edges
    }
    const p1 = shapePoints[i];
    const p2 = shapePoints[(i + 1) % numEdges];

    // Classify this edge
    const dx = Math.abs(p2.x - p1.x);
    const dy = Math.abs(p2.y - p1.y);
    const isEdgeHorizontal = dy < EPSILON || dx / dy > 10; // Mostly horizontal
    const isEdgeVertical = dx < EPSILON || dy / dx > 10;   // Mostly vertical
    const isEdgeDiagonal = !isEdgeHorizontal && !isEdgeVertical;

    // Determine if this edge needs a beam
    // - If joists are vertical (horizontal ledger): need beams on horizontal + diagonal edges
    // - If joists are horizontal (vertical ledger): need beams on vertical + diagonal edges
    let needsBeam = false;
    if (isLedgerHorizontal) {
      // Joists run vertically, so beams on horizontal edges + diagonals
      needsBeam = isEdgeHorizontal || isEdgeDiagonal;
      if (isEdgeVertical) {
      }
    } else {
      // Joists run horizontally, so beams on vertical edges + diagonals
      needsBeam = isEdgeVertical || isEdgeDiagonal;
      if (isEdgeHorizontal) {
      }
    }

    if (needsBeam) {
      edges.push({ p1, p2, edgeIndex: i, isEdgeDiagonal });
    }
  }

  if (edges.length === 0) {
    return [];
  }


  // Determine polygon winding order to know which way is "inward"
  // Use the shoelace formula: positive sum = clockwise (in screen coords), negative = counter-clockwise
  let windingSum = 0;
  for (let i = 0; i < numEdges; i++) {
    const p1 = shapePoints[i];
    const p2 = shapePoints[(i + 1) % numEdges];
    windingSum += (p2.x - p1.x) * (p2.y + p1.y);
  }
  // For clockwise (positive), perpendicular (90° CCW) points OUTWARD, so we need -1 to go inward
  // For counter-clockwise (negative), perpendicular points INWARD, so we use +1
  const windingSign = windingSum >= 0 ? -1 : 1;

  // For each edge, calculate the offset direction using winding order (not distance-to-center)
  const offsetSegments = [];
  for (const edge of edges) {
    // Calculate perpendicular vector from edge direction
    const dx = edge.p2.x - edge.p1.x;
    const dy = edge.p2.y - edge.p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < EPSILON) continue;

    // Perpendicular vector (90° counter-clockwise rotation of edge direction)
    // Adjusted by winding sign to always point inward
    const perpX = (-dy / len) * windingSign;
    const perpY = (dx / len) * windingSign;

    // Offset the segment inward by cantilever distance
    const offset = {
      p1: { x: edge.p1.x + perpX * cantileverPixels, y: edge.p1.y + perpY * cantileverPixels },
      p2: { x: edge.p2.x + perpX * cantileverPixels, y: edge.p2.y + perpY * cantileverPixels }
    };

    offsetSegments.push({
      ...offset,
      edgeIndex: edge.edgeIndex,
      originalP1: edge.p1,
      originalP2: edge.p2
    });
  }

  // Build a map of which edge indices have beams
  const edgeHasBeam = new Set(edges.map(e => e.edgeIndex));
  // Use numEdges (which accounts for closing point) instead of shapePoints.length
  const numPoints = numEdges;

  // Helper: extend a beam line to intersect with a deck edge (for edges without beams)
  function extendBeamToEdge(beamP1, beamP2, edgeIdx) {
    const edgeStart = shapePoints[edgeIdx];
    const edgeEnd = shapePoints[(edgeIdx + 1) % numPoints];
    return findLineIntersectionInternal(beamP1, beamP2, edgeStart, edgeEnd);
  }

  // Connect adjacent beam segments at their intersection points
  // For segments where the adjacent edge was filtered out, extend beam LINE to deck edge
  const beamPoints = [];

  for (let i = 0; i < offsetSegments.length; i++) {
    const current = offsetSegments[i];
    const currentEdge = edges[i];
    const currentEdgeIdx = current.edgeIndex;

    // Find the next segment in our filtered list
    const nextIdx = (i + 1) % offsetSegments.length;
    const next = offsetSegments[nextIdx];
    const nextEdgeIdx = next.edgeIndex;

    // Check if current and next edges are adjacent in the original polygon
    const currentEndPointIdx = (currentEdgeIdx + 1) % numPoints;
    const areAdjacentToNext = (nextEdgeIdx === currentEndPointIdx);

    // Check if current edge's START connects to an edge with a beam
    const prevEdgeIdx = (currentEdgeIdx - 1 + numPoints) % numPoints;
    const prevHasBeam = edgeHasBeam.has(prevEdgeIdx);

    // Check if current edge's END connects to an edge with a beam
    const nextPolyEdgeIdx = currentEndPointIdx; // The edge after current in polygon order
    const nextPolyHasBeam = edgeHasBeam.has(nextPolyEdgeIdx);

    // Determine endpoints for this beam segment
    let segP1, segP2;

    // For P1 (start of beam segment)
    if (i === 0) {
      if (prevHasBeam) {
        // Find the previous offset segment and intersect
        const prevOffsetIdx = offsetSegments.findIndex(s => s.edgeIndex === prevEdgeIdx);
        if (prevOffsetIdx !== -1) {
          const prevSeg = offsetSegments[prevOffsetIdx];
          const intersect = findLineIntersectionInternal(prevSeg.p1, prevSeg.p2, current.p1, current.p2);
          segP1 = intersect || current.p1;
        } else {
          segP1 = current.p1;
        }
      } else {
        // No beam on previous edge - extend beam LINE to intersect with that deck edge
        // Keep the beam parallel to original edge, just extend it
        const intersect = extendBeamToEdge(current.p1, current.p2, prevEdgeIdx);
        segP1 = intersect || current.p1;
      }
    } else {
      // Use previous beam's endpoint
      segP1 = beamPoints[beamPoints.length - 1].p2;
    }

    // For P2 (end of beam segment)
    if (areAdjacentToNext && offsetSegments.length > 1) {
      // Next beam segment is adjacent - find intersection of the two beam lines
      const intersect = findLineIntersectionInternal(current.p1, current.p2, next.p1, next.p2);
      segP2 = intersect || current.p2;
    } else if (nextPolyHasBeam && offsetSegments.length > 1) {
      // There's a beam on the next polygon edge, find it and intersect
      const nextOffsetIdx = offsetSegments.findIndex(s => s.edgeIndex === nextPolyEdgeIdx);
      if (nextOffsetIdx !== -1) {
        const nextSeg = offsetSegments[nextOffsetIdx];
        const intersect = findLineIntersectionInternal(current.p1, current.p2, nextSeg.p1, nextSeg.p2);
        segP2 = intersect || current.p2;
      } else {
        // Extend beam line to the next deck edge
        const intersect = extendBeamToEdge(current.p1, current.p2, nextPolyEdgeIdx);
        segP2 = intersect || current.p2;
      }
    } else {
      // No beam on next polygon edge - extend beam LINE to intersect with that deck edge
      const intersect = extendBeamToEdge(current.p1, current.p2, nextPolyEdgeIdx);
      segP2 = intersect || current.p2;
    }

    beamPoints.push({
      p1: segP1,
      p2: segP2,
      edgeIndex: current.edgeIndex,
      isDiagonal: currentEdge.isEdgeDiagonal
    });
  }

  // Final cleanup: connect last segment back to first if they should meet
  if (beamPoints.length > 1) {
    const firstEdgeIdx = offsetSegments[0].edgeIndex;
    const lastEdgeIdx = offsetSegments[offsetSegments.length - 1].edgeIndex;
    const lastSeg = offsetSegments[offsetSegments.length - 1];
    const firstSeg = offsetSegments[0];

    // Check if last and first edges are adjacent in polygon
    const lastEndPoint = (lastEdgeIdx + 1) % numPoints;
    if (lastEndPoint === firstEdgeIdx) {
      // They should connect - find intersection of beam lines
      const closeIntersection = findLineIntersectionInternal(lastSeg.p1, lastSeg.p2, firstSeg.p1, firstSeg.p2);
      if (closeIntersection) {
        beamPoints[0].p1 = closeIntersection;
        beamPoints[beamPoints.length - 1].p2 = closeIntersection;
      }
    } else {
      // Not adjacent - extend last beam to its next deck edge
      const lastNextEdgeIdx = (lastEdgeIdx + 1) % numPoints;
      if (!edgeHasBeam.has(lastNextEdgeIdx)) {
        const intersect = extendBeamToEdge(lastSeg.p1, lastSeg.p2, lastNextEdgeIdx);
        if (intersect) {
          beamPoints[beamPoints.length - 1].p2 = intersect;
        }
      }
      // Extend first beam backward to its previous deck edge
      const firstPrevEdgeIdx = (firstEdgeIdx - 1 + numPoints) % numPoints;
      if (!edgeHasBeam.has(firstPrevEdgeIdx)) {
        const intersect = extendBeamToEdge(firstSeg.p1, firstSeg.p2, firstPrevEdgeIdx);
        if (intersect) {
          beamPoints[0].p1 = intersect;
        }
      }
    }
  }

  return beamPoints;
}

/**
 * Creates beam components (beams, posts, footings) from the beam outline
 * @param {Array} beamOutline - Array of beam segment points from generateBeamOutlineFromPerimeter
 * @param {string} beamSize - Beam size (e.g., "2x10")
 * @param {number} beamPly - Number of plies
 * @param {string} postSize - Post size
 * @param {number} deckHeightInches - Deck height
 * @param {string} footingType - Footing type
 * @param {string} beamType - 'flush' or 'drop'
 * @param {number} joistSpanFt - Joist span in feet for footing load calculation (default 12)
 * @returns {Object} {beams: [], posts: [], footings: []}
 */
export function createBeamComponentsFromOutline(
  beamOutline,
  beamSize,
  beamPly,
  postSize,
  deckHeightInches,
  footingType,
  beamType,
  joistSpanFt = 12
) {
  const beams = [];
  const posts = [];
  const footings = [];

  if (!beamOutline || beamOutline.length === 0) {
    return { beams, posts, footings };
  }


  for (const segment of beamOutline) {
    const p1 = segment.p1;
    const p2 = segment.p2;
    const lengthPixels = distance(p1, p2);
    const lengthFeet = lengthPixels / PIXELS_PER_FOOT;

    if (lengthFeet < EPSILON) continue;

    // Determine if this is a diagonal segment (not axis-aligned)
    const dx = Math.abs(p2.x - p1.x);
    const dy = Math.abs(p2.y - p1.y);
    const isDiagonal = dx > EPSILON && dy > EPSILON;

    // Create beam object
    const beam = {
      p1: { ...p1 },
      p2: { ...p2 },
      centerlineP1: { ...p1 },
      centerlineP2: { ...p2 },
      size: beamSize,
      ply: beamPly,
      lengthFeet: lengthFeet,
      usage: isDiagonal ? "Diagonal Beam" : "Outer Beam",
      isFlush: beamType === "flush",
      isDiagonal: isDiagonal,
      edgeIndex: segment.edgeIndex
    };

    beams.push(beam);

    // Calculate posts along this beam segment
    const beamPosts = calculatePostsAlongBeam(
      p1, p2,
      postSize,
      deckHeightInches,
      beam.usage
    );

    posts.push(...beamPosts);

    // Create footings for each post with load-based sizing
    // Tributary area depends on post position (corner vs edge vs interior)
    const postSpacingFt = MAX_POST_SPACING_FEET; // 8' max between posts
    for (let i = 0; i < beamPosts.length; i++) {
      const post = beamPosts[i];
      const isCorner = (i === 0 || i === beamPosts.length - 1);
      const tributaryArea = calculateTributaryArea(postSpacingFt, joistSpanFt, isCorner);
      const footing = createFooting(post.x, post.y, footingType, tributaryArea, isCorner);
      footings.push(footing);
    }
  }

  return { beams, posts, footings };
}

/**
 * Calculates posts along a beam segment
 * @param {Object} p1 - Start point
 * @param {Object} p2 - End point
 * @param {string} postSize - Post size
 * @param {number} deckHeightInches - Deck height
 * @param {string} usage - Usage label
 * @returns {Array} Array of post objects
 */
function calculatePostsAlongBeam(p1, p2, postSize, deckHeightInches, usage) {
  const posts = [];
  const lengthPixels = distance(p1, p2);
  const lengthFeet = lengthPixels / PIXELS_PER_FOOT;

  if (lengthFeet < EPSILON) return posts;

  // Calculate number of posts needed based on max spacing
  const maxSpacingPixels = MAX_POST_SPACING_FEET * PIXELS_PER_FOOT;
  const numSpans = Math.ceil(lengthPixels / maxSpacingPixels);
  const numPosts = numSpans + 1;

  // Direction vector
  const dx = (p2.x - p1.x) / lengthPixels;
  const dy = (p2.y - p1.y) / lengthPixels;

  // Inset posts from beam ends
  const insetPixels = POST_INSET_FEET * PIXELS_PER_FOOT;
  const effectiveLength = lengthPixels - 2 * insetPixels;

  if (effectiveLength <= 0) {
    // Beam too short, just place posts at ends
    posts.push(createPost(p1.x, p1.y, postSize, deckHeightInches, usage));
    posts.push(createPost(p2.x, p2.y, postSize, deckHeightInches, usage));
    return posts;
  }

  const spacing = effectiveLength / (numPosts - 1);

  for (let i = 0; i < numPosts; i++) {
    const distFromStart = insetPixels + i * spacing;
    const x = p1.x + dx * distFromStart;
    const y = p1.y + dy * distFromStart;
    posts.push(createPost(x, y, postSize, deckHeightInches, usage));
  }

  return posts;
}

/**
 * Creates a post object
 */
function createPost(x, y, size, deckHeightInches, usage) {
  return {
    x,
    y,
    size,
    heightInches: deckHeightInches,
    heightFeet: deckHeightInches / 12,  // BOM expects heightFeet
    usage: usage || "Beam Post"
  };
}

/**
 * Creates a footing object with load-based diameter calculation
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {string} footingType - Type of footing (concrete, Helical, etc.)
 * @param {number} tributaryAreaSqFt - Tributary area for load calculation (optional, defaults to typical 32 sqft)
 * @param {boolean} isCorner - Whether this is a corner post (affects load calculation)
 */
function createFooting(x, y, footingType, tributaryAreaSqFt = 32, isCorner = false) {
  // Helical piles don't need diameter calculation
  if (footingType === "Helical" || footingType === "helical") {
    return { x, y, type: footingType, diameter: 0 };
  }

  // Calculate load-based diameter using IRC R403.1
  const footingCalc = calculateFootingDiameter(tributaryAreaSqFt);

  return {
    x,
    y,
    type: footingType,
    diameter: footingCalc.diameter,
    load: footingCalc.load,
    tributaryArea: tributaryAreaSqFt,
    warning: footingCalc.message
  };
}

/**
 * Calculates beam and posts for an angled edge (supports 45° diagonals)
 * @param {Object} edgeP1 - Start point of the edge
 * @param {Object} edgeP2 - End point of the edge
 * @param {number} setbackFeet - How far back from the edge the beam centerline should be
 * @param {string} beamSizeString - Beam size string
 * @param {number} beamPly - Number of plies
 * @param {string} postSize - Post size string
 * @param {number} deckHeightInches - Deck height
 * @param {string} footingType - Footing type
 * @param {string} usageLabel - Usage label for the beam
 * @param {string} beamType - 'flush' or 'drop'
 * @param {number} inwardSign - Direction multiplier for setback (1 or -1), defaults to 1
 * @returns {Object} {beam, posts, footings}
 */
export function calculateAngledBeamAndPosts(
  edgeP1,
  edgeP2,
  setbackFeet,
  beamSizeString,
  beamPly,
  postSize,
  deckHeightInches,
  footingType,
  usageLabel,
  beamType,
  inwardSign = 1
) {
  const beamPosts = [];
  const beamFootings = [];

  // Calculate edge properties
  const edgeAngle = getEdgeAngle(edgeP1, edgeP2);
  const edgeLength = distance(edgeP1, edgeP2);
  const unitVec = getUnitVector(edgeAngle);
  const perpVec = getPerpendicularVector(edgeAngle);

  // Calculate setback offset in pixels, using inwardSign to determine direction
  const setbackPixels = setbackFeet * PIXELS_PER_FOOT * inwardSign;

  // Beam runs parallel to the edge, offset by the setback (inward toward deck center)
  const beamAxisP1 = {
    x: edgeP1.x + perpVec.x * setbackPixels,
    y: edgeP1.y + perpVec.y * setbackPixels
  };
  const beamAxisP2 = {
    x: edgeP2.x + perpVec.x * setbackPixels,
    y: edgeP2.y + perpVec.y * setbackPixels
  };

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
        isFlush: beamType === 'flush',
        isAngled: true,
        angle: edgeAngle
      },
      posts: [],
      footings: []
    };
  }

  // Post placement follows same rules as regular beams
  const postInsetPixels = POST_INSET_FEET * PIXELS_PER_FOOT;
  const actualPostInsetPixels = Math.min(postInsetPixels, beamLengthPixels / 2 - EPSILON * 10);

  const post1Pos = {
    x: beamAxisP1.x + unitVec.x * actualPostInsetPixels,
    y: beamAxisP1.y + unitVec.y * actualPostInsetPixels
  };
  const post2Pos = {
    x: beamAxisP2.x - unitVec.x * actualPostInsetPixels,
    y: beamAxisP2.y - unitVec.y * actualPostInsetPixels
  };

  if (beamLengthPixels < POST_INSET_FEET * PIXELS_PER_FOOT * 2 && beamLengthPixels > EPSILON) {
    // Single center post for short beams
    beamPosts.push({
      x: beamAxisP1.x + unitVec.x * (beamLengthPixels / 2),
      y: beamAxisP1.y + unitVec.y * (beamLengthPixels / 2),
      size: postSize,
      heightFeet: deckHeightInches / 12
    });
  } else if (beamLengthPixels >= POST_INSET_FEET * PIXELS_PER_FOOT * 2) {
    beamPosts.push({ ...post1Pos, size: postSize, heightFeet: deckHeightInches / 12 });
    if (distance(post1Pos, post2Pos) > EPSILON) {
      beamPosts.push({ ...post2Pos, size: postSize, heightFeet: deckHeightInches / 12 });
    }

    // Add intermediate posts if needed
    if (beamPosts.length === 2) {
      const postSpanPixels = distance(beamPosts[0], beamPosts[1]);
      if (postSpanPixels / PIXELS_PER_FOOT > MAX_POST_SPACING_FEET) {
        const numIntermediatePosts = Math.floor(postSpanPixels / PIXELS_PER_FOOT / MAX_POST_SPACING_FEET);
        const intermediateSpacingPixels = postSpanPixels / (numIntermediatePosts + 1);
        for (let i = 1; i <= numIntermediatePosts; i++) {
          beamPosts.push({
            x: beamPosts[0].x + unitVec.x * intermediateSpacingPixels * i,
            y: beamPosts[0].y + unitVec.y * intermediateSpacingPixels * i,
            size: postSize,
            heightFeet: deckHeightInches / 12
          });
        }
      }
    }
  }

  // Sort posts along the beam direction
  beamPosts.sort((a, b) => {
    const dotA = (a.x - beamAxisP1.x) * unitVec.x + (a.y - beamAxisP1.y) * unitVec.y;
    const dotB = (b.x - beamAxisP1.x) * unitVec.x + (b.y - beamAxisP1.y) * unitVec.y;
    return dotA - dotB;
  });

  // Calculate material endpoints with cantilever
  let beamMaterialP1 = beamAxisP1;
  let beamMaterialP2 = beamAxisP2;
  if (beamPosts.length > 0) {
    const cantileverPixels = BEAM_CANTILEVER_FEET * PIXELS_PER_FOOT;
    const firstPost = beamPosts[0];
    const lastPost = beamPosts[beamPosts.length - 1];
    beamMaterialP1 = {
      x: firstPost.x - unitVec.x * cantileverPixels,
      y: firstPost.y - unitVec.y * cantileverPixels
    };
    beamMaterialP2 = {
      x: lastPost.x + unitVec.x * cantileverPixels,
      y: lastPost.y + unitVec.y * cantileverPixels
    };
  }

  // Create footings with load-based sizing
  // Estimate tributary area based on beam length and typical joist span (8ft default)
  const beamLengthFt = beamLengthPixels / PIXELS_PER_FOOT;
  const postSpacingFt = beamPosts.length > 1 ? beamLengthFt / (beamPosts.length - 1) : beamLengthFt;
  const estimatedJoistSpanFt = 8; // Conservative estimate for angled beams

  beamFootings.push(...beamPosts.map((post, index) => {
    const isCorner = (index === 0 || index === beamPosts.length - 1);
    const tributaryArea = calculateTributaryArea(postSpacingFt, estimatedJoistSpanFt, isCorner);
    return createFooting(post.x, post.y, footingType, tributaryArea, isCorner);
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
      isFlush: beamType === 'flush',
      isAngled: true,
      angle: edgeAngle
    },
    posts: beamPosts,
    footings: beamFootings
  };
}

/**
 * Calculates the intersection point of two lines
 * @param {Object} line1P1 - Line 1 start point
 * @param {Object} line1P2 - Line 1 end point
 * @param {Object} line2P1 - Line 2 start point
 * @param {Object} line2P2 - Line 2 end point
 * @returns {Object|null} Intersection point {x, y} or null if parallel
 */
export function lineIntersection(line1P1, line1P2, line2P1, line2P2) {
  const x1 = line1P1.x, y1 = line1P1.y;
  const x2 = line1P2.x, y2 = line1P2.y;
  const x3 = line2P1.x, y3 = line2P1.y;
  const x4 = line2P2.x, y4 = line2P2.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < EPSILON) return null; // Parallel lines

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;

  return {
    x: x1 + t * (x2 - x1),
    y: y1 + t * (y2 - y1)
  };
}

/**
 * Trims a joist where it meets an angled edge
 * @param {Object} joist - Joist object with p1, p2
 * @param {Object} angledEdgeP1 - Angled edge start point
 * @param {Object} angledEdgeP2 - Angled edge end point
 * @returns {Object} Updated joist with trimmed endpoint and cut angle info
 */
export function trimJoistAtAngledEdge(joist, angledEdgeP1, angledEdgeP2) {
  // Find intersection of joist line with angled edge
  const intersection = lineIntersection(joist.p1, joist.p2, angledEdgeP1, angledEdgeP2);

  if (!intersection) {
    // No intersection - return joist unchanged
    return { ...joist, cutAngle: null };
  }

  // Determine which end of the joist is closer to the angled edge
  const dist1 = distance(joist.p1, intersection);
  const dist2 = distance(joist.p2, intersection);

  // Calculate the cut angle
  const joistAngle = getEdgeAngle(joist.p1, joist.p2);
  const edgeAngle = getEdgeAngle(angledEdgeP1, angledEdgeP2);
  const cutAngleDeg = Math.abs(joistAngle - edgeAngle) * (180 / Math.PI);
  const normalizedCutAngle = cutAngleDeg > 90 ? 180 - cutAngleDeg : cutAngleDeg;

  // Create trimmed joist
  let trimmedJoist;
  if (dist1 < dist2) {
    // Trim p1 end
    trimmedJoist = {
      ...joist,
      p1: intersection,
      lengthFeet: distance(intersection, joist.p2) / PIXELS_PER_FOOT,
      cutAngle: Math.round(normalizedCutAngle),
      cutEnd: 'p1'
    };
  } else {
    // Trim p2 end
    trimmedJoist = {
      ...joist,
      p2: intersection,
      lengthFeet: distance(joist.p1, intersection) / PIXELS_PER_FOOT,
      cutAngle: Math.round(normalizedCutAngle),
      cutEnd: 'p2'
    };
  }

  return trimmedJoist;
}

/**
 * Checks if a point is on the line segment (not just the infinite line)
 * @param {Object} point - Point to check
 * @param {Object} lineP1 - Line start point
 * @param {Object} lineP2 - Line end point
 * @returns {boolean} True if point is on the segment
 */
export function isPointOnSegment(point, lineP1, lineP2) {
  const minX = Math.min(lineP1.x, lineP2.x) - EPSILON;
  const maxX = Math.max(lineP1.x, lineP2.x) + EPSILON;
  const minY = Math.min(lineP1.y, lineP2.y) - EPSILON;
  const maxY = Math.max(lineP1.y, lineP2.y) + EPSILON;

  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

/**
 * Checks if an edge array contains any diagonal (45°) edges
 * @param {Array} edges - Array of edge objects with p1, p2
 * @returns {boolean} True if any diagonal edges exist
 */
export function hasAngledEdges(edges) {
  for (const edge of edges) {
    if (classifyEdge(edge.p1, edge.p2) === 'diagonal') {
      return true;
    }
  }
  return false;
}

/**
 * Gets all diagonal edges from a set of points
 * @param {Array} points - Array of shape points
 * @returns {Array} Array of diagonal edge objects with p1, p2, angle
 */
export function getDiagonalEdges(points) {
  const diagonalEdges = [];
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    if (classifyEdge(p1, p2) === 'diagonal') {
      diagonalEdges.push({
        p1,
        p2,
        angle: getEdgeAngle(p1, p2),
        index: i
      });
    }
  }
  return diagonalEdges;
}

/**
 * Extends joists to reach diagonal edges (rim joists) and trims them at the intersection.
 * This allows joists to run continuously from the ledger to an angled rim joist.
 * @param {Array} joists - Array of joist objects with p1, p2, size, usage, lengthFeet
 * @param {Array} diagonalEdges - Array of diagonal edge objects with p1, p2
 * @param {boolean} isWallHorizontal - Whether the ledger/wall is horizontal
 * @param {Object} deckDimensions - Deck bounding box dimensions
 * @param {boolean} deckExtendsPositiveDir - Direction the deck extends from the wall
 * @returns {Array} Modified joists array with extended joists trimmed at diagonal edges
 */
export function extendJoistsToDiagonalEdges(joists, diagonalEdges, isWallHorizontal, deckDimensions, deckExtendsPositiveDir) {

  if (!diagonalEdges || diagonalEdges.length === 0) {
    return joists;
  }

  const modifiedJoists = [];
  let trimmedCount = 0;

  for (const joist of joists) {
    let joistModified = false;
    let modifiedJoist = { ...joist };

    for (const diagEdge of diagonalEdges) {
      // Determine if this joist is within the horizontal span of the diagonal edge
      const diagMinX = Math.min(diagEdge.p1.x, diagEdge.p2.x);
      const diagMaxX = Math.max(diagEdge.p1.x, diagEdge.p2.x);
      const diagMinY = Math.min(diagEdge.p1.y, diagEdge.p2.y);
      const diagMaxY = Math.max(diagEdge.p1.y, diagEdge.p2.y);

      // Get joist position on the perpendicular axis (where it's placed)
      const joistPosX = isWallHorizontal ? joist.p1.x : (joist.p1.x + joist.p2.x) / 2;
      const joistPosY = isWallHorizontal ? (joist.p1.y + joist.p2.y) / 2 : joist.p1.y;

      // Check if joist is within the diagonal edge's coverage area
      let isInDiagonalArea = false;
      if (isWallHorizontal) {
        // For horizontal ledger, check if joist X is within diagonal's X range
        isInDiagonalArea = joistPosX >= diagMinX - EPSILON && joistPosX <= diagMaxX + EPSILON;
      } else {
        // For vertical ledger, check if joist Y is within diagonal's Y range
        isInDiagonalArea = joistPosY >= diagMinY - EPSILON && joistPosY <= diagMaxY + EPSILON;
      }

      if (isInDiagonalArea) {
        // Extend joist to diagonal edge
        // First, project the joist line to extend beyond current endpoint
        const joistStart = joist.p1;
        let joistExtendedEnd;

        if (isWallHorizontal) {
          // Joists run vertically (Y direction), extend in Y
          const extendY = deckExtendsPositiveDir
            ? Math.max(diagEdge.p1.y, diagEdge.p2.y) + 100  // Extend well beyond diagonal
            : Math.min(diagEdge.p1.y, diagEdge.p2.y) - 100;
          joistExtendedEnd = { x: joist.p1.x, y: extendY };
        } else {
          // Joists run horizontally (X direction), extend in X
          const extendX = deckExtendsPositiveDir
            ? Math.max(diagEdge.p1.x, diagEdge.p2.x) + 100
            : Math.min(diagEdge.p1.x, diagEdge.p2.x) - 100;
          joistExtendedEnd = { x: extendX, y: joist.p1.y };
        }

        // Find intersection with diagonal edge
        const intersection = lineIntersection(joistStart, joistExtendedEnd, diagEdge.p1, diagEdge.p2);


        if (intersection) {
          // Verify intersection is actually on the diagonal segment
          const onSegment = isPointOnSegment(intersection, diagEdge.p1, diagEdge.p2);

          if (onSegment) {
            // Calculate cut angle
            const joistAngle = getEdgeAngle(joist.p1, joist.p2);
            const edgeAngle = getEdgeAngle(diagEdge.p1, diagEdge.p2);
            const cutAngleDeg = Math.abs(joistAngle - edgeAngle) * (180 / Math.PI);
            const normalizedCutAngle = cutAngleDeg > 90 ? 180 - cutAngleDeg : cutAngleDeg;

            // Update joist endpoint to intersection
            // p1 is ALWAYS the wall/ledger side, p2 is ALWAYS the outer side
            // The diagonal is on the outer edge, so we ALWAYS modify p2
            modifiedJoist.p2 = intersection;

            modifiedJoist.lengthFeet = distance(modifiedJoist.p1, modifiedJoist.p2) / PIXELS_PER_FOOT;
            modifiedJoist.cutAngle = Math.round(normalizedCutAngle);
            modifiedJoist.trimmedAtDiagonal = true;
            joistModified = true;
            trimmedCount++;
            break; // Only trim at one diagonal edge per joist
          }
        } else if (isInDiagonalArea) {
        }
      }
    }

    modifiedJoists.push(joistModified ? modifiedJoist : joist);
  }

  return modifiedJoists;
}

/**
 * Trims two beams (one axis-aligned, one diagonal) so they meet at their intersection point
 * instead of overlapping. Also handles posts and footings at the intersection.
 * @param {Object} outerBeam - The axis-aligned outer beam
 * @param {Object} diagonalBeam - The diagonal beam (angled)
 * @param {Array} outerPosts - Posts for the outer beam
 * @param {Array} diagonalPosts - Posts for the diagonal beam
 * @param {Array} outerFootings - Footings for the outer beam
 * @param {Array} diagonalFootings - Footings for the diagonal beam
 * @param {string} postSize - Size of posts
 * @param {number} deckHeightInches - Deck height in inches
 * @param {string} footingType - Type of footing
 * @returns {Object} Modified beams, posts, and footings
 */
export function trimBeamsAtIntersection(
  outerBeam,
  diagonalBeam,
  outerPosts,
  diagonalPosts,
  outerFootings,
  diagonalFootings,
  postSize,
  deckHeightInches,
  footingType
) {

  // Find intersection point between the two beam centerlines
  const intersection = lineIntersection(
    outerBeam.centerlineP1 || outerBeam.p1,
    outerBeam.centerlineP2 || outerBeam.p2,
    diagonalBeam.centerlineP1 || diagonalBeam.p1,
    diagonalBeam.centerlineP2 || diagonalBeam.p2
  );

  if (!intersection) {
    return {
      outerBeam,
      diagonalBeam,
      outerPosts,
      diagonalPosts,
      outerFootings,
      diagonalFootings,
      intersectionPost: null
    };
  }


  // Determine which end of each beam to trim
  // For outer beam: find which endpoint is closer to the intersection
  const outerP1Dist = distance(outerBeam.centerlineP1 || outerBeam.p1, intersection);
  const outerP2Dist = distance(outerBeam.centerlineP2 || outerBeam.p2, intersection);

  // For diagonal beam: find which endpoint is closer to the intersection
  const diagP1Dist = distance(diagonalBeam.centerlineP1 || diagonalBeam.p1, intersection);
  const diagP2Dist = distance(diagonalBeam.centerlineP2 || diagonalBeam.p2, intersection);

  // Clone beams to modify
  const trimmedOuterBeam = { ...outerBeam };
  const trimmedDiagonalBeam = { ...diagonalBeam };

  // Trim outer beam - the end closest to the intersection should become the intersection point
  // But we need to determine if the intersection is actually between the beam endpoints
  // or beyond one end
  const outerBeamLength = distance(outerBeam.centerlineP1 || outerBeam.p1, outerBeam.centerlineP2 || outerBeam.p2);

  // Check if intersection is closer to P2 (the end we want to trim for outer beam typically)
  if (outerP2Dist < outerP1Dist && outerP2Dist < outerBeamLength) {
    // Trim the P2 end of outer beam
    trimmedOuterBeam.p2 = { ...intersection };
    trimmedOuterBeam.centerlineP2 = { ...intersection };
    if (trimmedOuterBeam.positionCoordinateLineP2) {
      trimmedOuterBeam.positionCoordinateLineP2 = { ...intersection };
    }
  } else if (outerP1Dist < outerP2Dist && outerP1Dist < outerBeamLength) {
    // Trim the P1 end of outer beam
    trimmedOuterBeam.p1 = { ...intersection };
    trimmedOuterBeam.centerlineP1 = { ...intersection };
    if (trimmedOuterBeam.positionCoordinateLineP1) {
      trimmedOuterBeam.positionCoordinateLineP1 = { ...intersection };
    }
  }

  // Trim diagonal beam - find which end should be trimmed
  const diagBeamLength = distance(diagonalBeam.centerlineP1 || diagonalBeam.p1, diagonalBeam.centerlineP2 || diagonalBeam.p2);

  if (diagP1Dist < diagP2Dist && diagP1Dist < diagBeamLength) {
    // Trim the P1 end of diagonal beam
    trimmedDiagonalBeam.p1 = { ...intersection };
    trimmedDiagonalBeam.centerlineP1 = { ...intersection };
    if (trimmedDiagonalBeam.positionCoordinateLineP1) {
      trimmedDiagonalBeam.positionCoordinateLineP1 = { ...intersection };
    }
  } else if (diagP2Dist < diagP1Dist && diagP2Dist < diagBeamLength) {
    // Trim the P2 end of diagonal beam
    trimmedDiagonalBeam.p2 = { ...intersection };
    trimmedDiagonalBeam.centerlineP2 = { ...intersection };
    if (trimmedDiagonalBeam.positionCoordinateLineP2) {
      trimmedDiagonalBeam.positionCoordinateLineP2 = { ...intersection };
    }
  }

  // Recalculate beam lengths
  trimmedOuterBeam.lengthFeet = distance(trimmedOuterBeam.p1, trimmedOuterBeam.p2) / PIXELS_PER_FOOT;
  trimmedDiagonalBeam.lengthFeet = distance(trimmedDiagonalBeam.p1, trimmedDiagonalBeam.p2) / PIXELS_PER_FOOT;


  // Filter posts that are beyond the trim point
  const filteredOuterPosts = filterPostsWithinBeam(outerPosts, trimmedOuterBeam);
  const filteredDiagonalPosts = filterPostsWithinBeam(diagonalPosts, trimmedDiagonalBeam);

  // Create shared post at intersection
  const intersectionPost = {
    x: intersection.x,
    y: intersection.y,
    size: postSize,
    heightFeet: deckHeightInches / 12,
    isShared: true,
    usage: "Intersection Post"
  };

  // Create footing for intersection post with load-based sizing
  // Intersection posts support load from both beams, estimate tributary area conservatively
  const estimatedTributaryArea = 48; // Conservative estimate for intersection (8ft joist span × 6ft post spacing)
  const intersectionFooting = createFooting(
    intersection.x,
    intersection.y,
    footingType,
    estimatedTributaryArea,
    false // Not a corner post
  );

  // Filter footings that are beyond the trim point
  const filteredOuterFootings = filterFootingsWithinBeam(outerFootings, trimmedOuterBeam);
  const filteredDiagonalFootings = filterFootingsWithinBeam(diagonalFootings, trimmedDiagonalBeam);

  return {
    outerBeam: trimmedOuterBeam,
    diagonalBeam: trimmedDiagonalBeam,
    outerPosts: filteredOuterPosts,
    diagonalPosts: filteredDiagonalPosts,
    outerFootings: filteredOuterFootings,
    diagonalFootings: filteredDiagonalFootings,
    intersectionPost,
    intersectionFooting
  };
}

/**
 * Filters posts to only include those within the beam's endpoints
 * @param {Array} posts - Array of post objects
 * @param {Object} beam - Beam object with p1 and p2
 * @returns {Array} Filtered posts
 */
function filterPostsWithinBeam(posts, beam) {
  if (!posts || posts.length === 0) return [];

  const beamP1 = beam.centerlineP1 || beam.p1;
  const beamP2 = beam.centerlineP2 || beam.p2;
  const beamLength = distance(beamP1, beamP2);

  if (beamLength < EPSILON) return [];

  // Calculate beam unit vector
  const unitVecX = (beamP2.x - beamP1.x) / beamLength;
  const unitVecY = (beamP2.y - beamP1.y) / beamLength;

  return posts.filter(post => {
    // Project post onto beam axis
    const postVecX = post.x - beamP1.x;
    const postVecY = post.y - beamP1.y;
    const projection = postVecX * unitVecX + postVecY * unitVecY;

    // Check if projection is within beam length (with small tolerance)
    const tolerance = POST_INSET_FEET * PIXELS_PER_FOOT * 0.5;
    return projection >= -tolerance && projection <= beamLength + tolerance;
  });
}

/**
 * Filters footings to only include those within the beam's endpoints
 * @param {Array} footings - Array of footing objects
 * @param {Object} beam - Beam object with p1 and p2
 * @returns {Array} Filtered footings
 */
function filterFootingsWithinBeam(footings, beam) {
  if (!footings || footings.length === 0) return [];

  const beamP1 = beam.centerlineP1 || beam.p1;
  const beamP2 = beam.centerlineP2 || beam.p2;
  const beamLength = distance(beamP1, beamP2);

  if (beamLength < EPSILON) return [];

  // Calculate beam unit vector
  const unitVecX = (beamP2.x - beamP1.x) / beamLength;
  const unitVecY = (beamP2.y - beamP1.y) / beamLength;

  return footings.filter(footing => {
    // Project footing onto beam axis
    const footingVecX = footing.x - beamP1.x;
    const footingVecY = footing.y - beamP1.y;
    const projection = footingVecX * unitVecX + footingVecY * unitVecY;

    // Check if projection is within beam length (with small tolerance)
    const tolerance = POST_INSET_FEET * PIXELS_PER_FOOT * 0.5;
    return projection >= -tolerance && projection <= beamLength + tolerance;
  });
}

/**
 * Extends a diagonal beam to meet the axis-aligned rim joist at the deck edge
 * @param {Object} beam - The diagonal beam to extend
 * @param {Object} dimensions - Deck dimensions with minX, maxX, minY, maxY
 * @param {Object} diagEdge - The diagonal edge {p1, p2}
 * @param {Object} deckCenter - Center point of deck {x, y}
 * @returns {Object} Extended beam with updated endpoints and length
 */
export function extendDiagonalBeamToEdge(beam, dimensions, diagEdge, deckCenter) {

  if (!beam || !beam.p1 || !beam.p2) {
    return beam;
  }

  // Calculate deck center if not provided
  const center = deckCenter || {
    x: (dimensions.minX + dimensions.maxX) / 2,
    y: (dimensions.minY + dimensions.maxY) / 2
  };

  // Determine which endpoint is the "outer" one (farther from deck center)
  const dist1 = distance(beam.p1, center);
  const dist2 = distance(beam.p2, center);

  // The outer point is the one farther from center - this is what needs to be extended
  const outerIdx = dist1 > dist2 ? 1 : 2;
  const outerPoint = outerIdx === 1 ? beam.p1 : beam.p2;
  const innerPoint = outerIdx === 1 ? beam.p2 : beam.p1;


  // Beam direction from inner to outer
  const beamDx = outerPoint.x - innerPoint.x;
  const beamDy = outerPoint.y - innerPoint.y;
  const beamLen = Math.sqrt(beamDx * beamDx + beamDy * beamDy);

  if (beamLen < EPSILON) {
    return beam;
  }

  // Unit direction vector
  const unitDx = beamDx / beamLen;
  const unitDy = beamDy / beamLen;

  // Determine which axis-aligned edge to intersect based on the diagonal corner position
  // The diagonal is at a corner - find which two edges meet at that corner
  let targetEdges = [];

  // Check which corner the diagonal is at
  const cornerTolerance = 2 * PIXELS_PER_FOOT;
  const diagMidX = (diagEdge.p1.x + diagEdge.p2.x) / 2;
  const diagMidY = (diagEdge.p1.y + diagEdge.p2.y) / 2;

  const isNearLeft = diagMidX < center.x;
  const isNearTop = diagMidY < center.y;


  // Based on diagonal position, determine which axis-aligned edges form that corner
  if (isNearTop) {
    // Top edge: y = minY
    targetEdges.push({ axis: 'y', value: dimensions.minY, type: 'top' });
  } else {
    // Bottom edge: y = maxY
    targetEdges.push({ axis: 'y', value: dimensions.maxY, type: 'bottom' });
  }

  if (isNearLeft) {
    // Left edge: x = minX
    targetEdges.push({ axis: 'x', value: dimensions.minX, type: 'left' });
  } else {
    // Right edge: x = maxX
    targetEdges.push({ axis: 'x', value: dimensions.maxX, type: 'right' });
  }


  // Find intersection with nearest axis-aligned edge along beam direction
  let bestIntersection = null;
  let bestT = Infinity;

  for (const edge of targetEdges) {
    let t, intersectX, intersectY;

    if (edge.axis === 'x') {
      // Vertical edge at x = edge.value
      if (Math.abs(unitDx) < EPSILON) continue;
      t = (edge.value - innerPoint.x) / (unitDx * beamLen);
      intersectX = edge.value;
      intersectY = innerPoint.y + t * beamLen * unitDy;
    } else {
      // Horizontal edge at y = edge.value
      if (Math.abs(unitDy) < EPSILON) continue;
      t = (edge.value - innerPoint.y) / (unitDy * beamLen);
      intersectX = innerPoint.x + t * beamLen * unitDx;
      intersectY = edge.value;
    }


    // t > 1 means it's beyond current outer endpoint (extension needed)
    // We want the closest intersection point that extends the beam
    if (t > 0.5 && t < bestT) {
      bestT = t;
      bestIntersection = { x: intersectX, y: intersectY };
    }
  }

  if (!bestIntersection) {
    return beam;
  }


  // Create new beam with extended endpoint
  const newBeam = { ...beam };
  if (outerIdx === 1) {
    newBeam.p1 = bestIntersection;
    newBeam.centerlineP1 = bestIntersection;
  } else {
    newBeam.p2 = bestIntersection;
    newBeam.centerlineP2 = bestIntersection;
  }

  // Recalculate length
  const newLength = distance(newBeam.p1, newBeam.p2);
  newBeam.lengthFeet = newLength / PIXELS_PER_FOOT;


  return newBeam;
}

/**
 * Handles diagonal rim joists - adds diagonal rim joists and trims existing axis-aligned ones
 * @param {Array} rimJoists - Existing rim joists
 * @param {Array} diagonalEdges - Diagonal edges array
 * @param {Object} deckCenter - Center point of deck
 * @param {string} rimJoistSize - Size for rim joists (e.g., '2x10')
 * @returns {Array} Modified rim joists with diagonal rim joists added
 */
export function handleDiagonalRimJoists(rimJoists, diagonalEdges, deckCenter, rimJoistSize) {

  if (!diagonalEdges || diagonalEdges.length === 0) {
    return rimJoists;
  }

  const modifiedRimJoists = [...rimJoists];

  for (const diagEdge of diagonalEdges) {

    // 1. Add the diagonal rim joist
    const diagLength = distance(diagEdge.p1, diagEdge.p2);
    const diagRimJoist = {
      p1: { ...diagEdge.p1 },
      p2: { ...diagEdge.p2 },
      lengthFeet: diagLength / PIXELS_PER_FOOT,
      size: rimJoistSize,
      isDiagonal: true
    };

    modifiedRimJoists.push(diagRimJoist);

    // 2. Trim existing axis-aligned rim joists at their intersection with diagonal
    for (let i = 0; i < modifiedRimJoists.length; i++) {
      const rimJoist = modifiedRimJoists[i];
      if (rimJoist.isDiagonal) continue;  // Skip diagonal rim joists

      // Check if this rim joist intersects or connects to the diagonal edge
      const isHorizontal = Math.abs(rimJoist.p1.y - rimJoist.p2.y) < EPSILON;
      const isVertical = Math.abs(rimJoist.p1.x - rimJoist.p2.x) < EPSILON;

      if (!isHorizontal && !isVertical) continue;  // Skip non-axis-aligned

      // Find intersection point of rim joist line with diagonal edge
      let intersection = null;

      if (isHorizontal) {
        // Rim joist is horizontal: y = rimJoist.p1.y
        // Diagonal line: from diagEdge.p1 to diagEdge.p2
        const diagDx = diagEdge.p2.x - diagEdge.p1.x;
        const diagDy = diagEdge.p2.y - diagEdge.p1.y;

        if (Math.abs(diagDy) > EPSILON) {
          const t = (rimJoist.p1.y - diagEdge.p1.y) / diagDy;
          if (t >= -0.01 && t <= 1.01) {
            const intersectX = diagEdge.p1.x + t * diagDx;
            // Check if intersection is within rim joist's x range
            const minX = Math.min(rimJoist.p1.x, rimJoist.p2.x);
            const maxX = Math.max(rimJoist.p1.x, rimJoist.p2.x);
            if (intersectX >= minX - EPSILON && intersectX <= maxX + EPSILON) {
              intersection = { x: intersectX, y: rimJoist.p1.y };
            }
          }
        }
      } else if (isVertical) {
        // Rim joist is vertical: x = rimJoist.p1.x
        const diagDx = diagEdge.p2.x - diagEdge.p1.x;
        const diagDy = diagEdge.p2.y - diagEdge.p1.y;

        if (Math.abs(diagDx) > EPSILON) {
          const t = (rimJoist.p1.x - diagEdge.p1.x) / diagDx;
          if (t >= -0.01 && t <= 1.01) {
            const intersectY = diagEdge.p1.y + t * diagDy;
            // Check if intersection is within rim joist's y range
            const minY = Math.min(rimJoist.p1.y, rimJoist.p2.y);
            const maxY = Math.max(rimJoist.p1.y, rimJoist.p2.y);
            if (intersectY >= minY - EPSILON && intersectY <= maxY + EPSILON) {
              intersection = { x: rimJoist.p1.x, y: intersectY };
            }
          }
        }
      }

      if (!intersection) continue;


      // Determine which endpoint to trim (the one "outside" the diagonal)
      // Use signed distance from diagonal line to determine which side of the diagonal each endpoint is on
      const diagVecX = diagEdge.p2.x - diagEdge.p1.x;
      const diagVecY = diagEdge.p2.y - diagEdge.p1.y;

      // Cross product sign tells us which side of the line a point is on
      const crossP1 = (rimJoist.p1.x - diagEdge.p1.x) * diagVecY - (rimJoist.p1.y - diagEdge.p1.y) * diagVecX;
      const crossP2 = (rimJoist.p2.x - diagEdge.p1.x) * diagVecY - (rimJoist.p2.y - diagEdge.p1.y) * diagVecX;
      const crossCenter = (deckCenter.x - diagEdge.p1.x) * diagVecY - (deckCenter.y - diagEdge.p1.y) * diagVecX;

      // The "inside" point has the same sign as the center
      // The "outside" point has opposite sign - that's the one to trim to intersection
      const p1IsOutside = (crossP1 * crossCenter) < 0;
      const p2IsOutside = (crossP2 * crossCenter) < 0;


      if (p1IsOutside && !p2IsOutside) {
        // Trim p1 to intersection
        rimJoist.p1 = { ...intersection };
        rimJoist.lengthFeet = distance(rimJoist.p1, rimJoist.p2) / PIXELS_PER_FOOT;
      } else if (p2IsOutside && !p1IsOutside) {
        // Trim p2 to intersection
        rimJoist.p2 = { ...intersection };
        rimJoist.lengthFeet = distance(rimJoist.p1, rimJoist.p2) / PIXELS_PER_FOOT;
      }
    }
  }

  return modifiedRimJoists;
}

/**
 * Handles diagonal beams - trims axis-aligned beams at their intersection with diagonal edges
 * Similar to handleDiagonalRimJoists but for beams
 * @param {Array} beams - Existing beams
 * @param {Array} diagonalEdges - Diagonal edges array
 * @param {Object} deckCenter - Center point of deck
 * @returns {Array} Modified beams with trimmed endpoints
 */
export function handleDiagonalBeams(beams, diagonalEdges, deckCenter) {

  if (!diagonalEdges || diagonalEdges.length === 0) {
    return beams;
  }

  const modifiedBeams = [...beams];

  for (const diagEdge of diagonalEdges) {

    // Trim existing axis-aligned beams at their intersection with diagonal
    for (let i = 0; i < modifiedBeams.length; i++) {
      const beam = modifiedBeams[i];
      if (beam.isDiagonal) continue;  // Skip diagonal beams

      // Get beam centerline points (use centerline if available, otherwise p1/p2)
      const beamP1 = beam.centerlineP1 || beam.p1;
      const beamP2 = beam.centerlineP2 || beam.p2;

      // Check if this beam is axis-aligned
      const isHorizontal = Math.abs(beamP1.y - beamP2.y) < EPSILON;
      const isVertical = Math.abs(beamP1.x - beamP2.x) < EPSILON;

      if (!isHorizontal && !isVertical) continue;  // Skip non-axis-aligned

      // Find intersection point of beam line with diagonal edge
      let intersection = null;

      if (isHorizontal) {
        // Beam is horizontal: y = beamP1.y
        // Diagonal line: from diagEdge.p1 to diagEdge.p2
        const diagDx = diagEdge.p2.x - diagEdge.p1.x;
        const diagDy = diagEdge.p2.y - diagEdge.p1.y;

        if (Math.abs(diagDy) > EPSILON) {
          const t = (beamP1.y - diagEdge.p1.y) / diagDy;
          if (t >= -0.01 && t <= 1.01) {
            const intersectX = diagEdge.p1.x + t * diagDx;
            // Check if intersection is within beam's x range (with some tolerance)
            const minX = Math.min(beamP1.x, beamP2.x);
            const maxX = Math.max(beamP1.x, beamP2.x);
            if (intersectX >= minX - EPSILON && intersectX <= maxX + EPSILON) {
              intersection = { x: intersectX, y: beamP1.y };
            }
          }
        }
      } else if (isVertical) {
        // Beam is vertical: x = beamP1.x
        const diagDx = diagEdge.p2.x - diagEdge.p1.x;
        const diagDy = diagEdge.p2.y - diagEdge.p1.y;

        if (Math.abs(diagDx) > EPSILON) {
          const t = (beamP1.x - diagEdge.p1.x) / diagDx;
          if (t >= -0.01 && t <= 1.01) {
            const intersectY = diagEdge.p1.y + t * diagDy;
            // Check if intersection is within beam's y range (with some tolerance)
            const minY = Math.min(beamP1.y, beamP2.y);
            const maxY = Math.max(beamP1.y, beamP2.y);
            if (intersectY >= minY - EPSILON && intersectY <= maxY + EPSILON) {
              intersection = { x: beamP1.x, y: intersectY };
            }
          }
        }
      }

      if (!intersection) continue;


      // Determine which endpoint to trim (the one "outside" the diagonal)
      // Use signed distance from diagonal line to determine which side of the diagonal each endpoint is on
      const diagVecX = diagEdge.p2.x - diagEdge.p1.x;
      const diagVecY = diagEdge.p2.y - diagEdge.p1.y;

      // Cross product sign tells us which side of the line a point is on
      const crossP1 = (beamP1.x - diagEdge.p1.x) * diagVecY - (beamP1.y - diagEdge.p1.y) * diagVecX;
      const crossP2 = (beamP2.x - diagEdge.p1.x) * diagVecY - (beamP2.y - diagEdge.p1.y) * diagVecX;
      const crossCenter = (deckCenter.x - diagEdge.p1.x) * diagVecY - (deckCenter.y - diagEdge.p1.y) * diagVecX;

      // The "inside" point has the same sign as the center
      // The "outside" point has opposite sign - that's the one to trim to intersection
      const p1IsOutside = (crossP1 * crossCenter) < 0;
      const p2IsOutside = (crossP2 * crossCenter) < 0;


      if (p1IsOutside && !p2IsOutside) {
        // Trim p1 to intersection
        beam.p1 = { ...intersection };
        if (beam.centerlineP1) beam.centerlineP1 = { ...intersection };
        if (beam.positionCoordinateLineP1) beam.positionCoordinateLineP1 = { ...intersection };
        beam.lengthFeet = distance(beam.p1, beam.p2) / PIXELS_PER_FOOT;
      } else if (p2IsOutside && !p1IsOutside) {
        // Trim p2 to intersection
        beam.p2 = { ...intersection };
        if (beam.centerlineP2) beam.centerlineP2 = { ...intersection };
        if (beam.positionCoordinateLineP2) beam.positionCoordinateLineP2 = { ...intersection };
        beam.lengthFeet = distance(beam.p1, beam.p2) / PIXELS_PER_FOOT;
      }
    }
  }

  return modifiedBeams;
}

/**
 * Extends joists to reach diagonal ledgers on the house side (e.g., bay windows)
 * This modifies the START point (p1) of joists to meet diagonal ledger edges
 * @param {Array} joists - Array of joist objects with p1, p2
 * @param {Array} diagonalLedgers - Array of diagonal ledger objects with p1, p2
 * @param {boolean} isWallHorizontal - Whether the main ledger is horizontal
 * @param {Object} deckDimensions - Deck bounding box dimensions
 * @param {boolean} deckExtendsPositiveDir - Direction the deck extends from the wall
 * @returns {Array} Modified joists array with extended start points
 */
export function extendJoistsToLedgerDiagonals(joists, diagonalLedgers, isWallHorizontal, deckDimensions, deckExtendsPositiveDir) {

  if (!diagonalLedgers || diagonalLedgers.length === 0) {
    return joists;
  }

  const modifiedJoists = [];

  for (const joist of joists) {
    let joistModified = false;
    let modifiedJoist = { ...joist };

    for (const diagLedger of diagonalLedgers) {
      // Determine the X/Y range of the diagonal ledger
      const diagMinX = Math.min(diagLedger.p1.x, diagLedger.p2.x);
      const diagMaxX = Math.max(diagLedger.p1.x, diagLedger.p2.x);
      const diagMinY = Math.min(diagLedger.p1.y, diagLedger.p2.y);
      const diagMaxY = Math.max(diagLedger.p1.y, diagLedger.p2.y);

      // Get joist position on the perpendicular axis
      const joistPosX = isWallHorizontal ? joist.p1.x : (joist.p1.x + joist.p2.x) / 2;
      const joistPosY = isWallHorizontal ? (joist.p1.y + joist.p2.y) / 2 : joist.p1.y;

      // Check if joist is within the diagonal ledger's coverage area
      let isInDiagonalArea = false;
      if (isWallHorizontal) {
        isInDiagonalArea = joistPosX >= diagMinX - EPSILON && joistPosX <= diagMaxX + EPSILON;
      } else {
        isInDiagonalArea = joistPosY >= diagMinY - EPSILON && joistPosY <= diagMaxY + EPSILON;
      }

      if (isInDiagonalArea) {

        // Calculate where the joist START should be on the diagonal ledger
        // For horizontal wall: joist runs vertically, need to find Y on diagonal at joist's X
        // For vertical wall: joist runs horizontally, need to find X on diagonal at joist's Y

        const diagDx = diagLedger.p2.x - diagLedger.p1.x;
        const diagDy = diagLedger.p2.y - diagLedger.p1.y;

        let intersectX, intersectY;

        if (isWallHorizontal) {
          // Joist is vertical (runs in Y direction), find Y at joist's X position
          if (Math.abs(diagDx) > EPSILON) {
            const t = (joistPosX - diagLedger.p1.x) / diagDx;
            if (t >= -0.01 && t <= 1.01) {
              intersectY = diagLedger.p1.y + t * diagDy;
              intersectX = joistPosX;

              // Check if this intersection is on the "house side" of the joist
              // For horizontal wall extending in positive Y, p1 is at lower Y (house side)
              const currentStartY = joist.p1.y;

              // Only extend if the diagonal ledger is further in the house direction
              const shouldExtend = deckExtendsPositiveDir
                ? intersectY < currentStartY  // Deck extends positive, house at lower Y
                : intersectY > currentStartY; // Deck extends negative, house at higher Y

              if (shouldExtend) {
                modifiedJoist.p1 = { x: intersectX, y: intersectY };
                modifiedJoist.lengthFeet = distance(modifiedJoist.p1, modifiedJoist.p2) / PIXELS_PER_FOOT;
                joistModified = true;
              }
            }
          }
        } else {
          // Joist is horizontal (runs in X direction), find X at joist's Y position
          if (Math.abs(diagDy) > EPSILON) {
            const t = (joistPosY - diagLedger.p1.y) / diagDy;
            if (t >= -0.01 && t <= 1.01) {
              intersectX = diagLedger.p1.x + t * diagDx;
              intersectY = joistPosY;

              // Check if this intersection is on the "house side" of the joist
              const currentStartX = joist.p1.x;

              // Only extend if the diagonal ledger is further in the house direction
              const shouldExtend = deckExtendsPositiveDir
                ? intersectX < currentStartX  // Deck extends positive, house at lower X
                : intersectX > currentStartX; // Deck extends negative, house at higher X

              if (shouldExtend) {
                modifiedJoist.p1 = { x: intersectX, y: intersectY };
                modifiedJoist.lengthFeet = distance(modifiedJoist.p1, modifiedJoist.p2) / PIXELS_PER_FOOT;
                joistModified = true;
              }
            }
          }
        }
      }
    }

    modifiedJoists.push(modifiedJoist);
  }

  return modifiedJoists;
}

/**
 * Checks if a point is inside a polygon using ray casting algorithm
 * @param {Object} point - Point to check {x, y}
 * @param {Array} polygon - Array of points forming the polygon
 * @returns {boolean} True if point is inside polygon
 */
export function isPointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Clips joists to the deck polygon boundary
 * Joists that start outside the deck polygon (due to notches/jogs) are trimmed
 * to the nearest deck edge intersection
 * @param {Array} joists - Array of joist objects
 * @param {Array} shapePoints - Array of deck polygon points
 * @param {boolean} isWallHorizontal - Whether the ledger wall is horizontal
 * @param {boolean} deckExtendsPositiveDir - Direction the deck extends from ledger
 * @returns {Array} Array of clipped joists
 */
export function clipJoistsToPolygon(joists, shapePoints, isWallHorizontal, deckExtendsPositiveDir) {
  if (!shapePoints || shapePoints.length < 3) {
    return joists;
  }


  const clippedJoists = [];

  for (const joist of joists) {
    // Check if the joist start point (p1, ledger side) is inside the deck polygon
    const p1Inside = isPointInPolygon(joist.p1, shapePoints);
    const p2Inside = isPointInPolygon(joist.p2, shapePoints);

    // If both points are inside, keep the joist as-is
    if (p1Inside && p2Inside) {
      clippedJoists.push(joist);
      continue;
    }

    // If both points are outside, check if the joist crosses the polygon at all
    if (!p1Inside && !p2Inside) {
      // Find all intersections with polygon edges
      const intersections = findJoistPolygonIntersections(joist, shapePoints);
      if (intersections.length >= 2) {
        // Joist crosses through the polygon - clip to the two intersection points
        // Sort intersections by distance from p1
        intersections.sort((a, b) => distance(joist.p1, a) - distance(joist.p1, b));
        const newP1 = intersections[0];
        const newP2 = intersections[intersections.length - 1];

        if (distance(newP1, newP2) > EPSILON) {
          clippedJoists.push({
            ...joist,
            p1: newP1,
            p2: newP2,
            lengthFeet: distance(newP1, newP2) / PIXELS_PER_FOOT,
            clipped: true
          });
        }
      }
      // If no valid intersections, joist is entirely outside - skip it
      continue;
    }

    // If only p1 is outside (ledger side), clip p1 to the polygon boundary
    if (!p1Inside && p2Inside) {
      const intersection = findNearestIntersection(joist.p1, joist.p2, shapePoints);
      if (intersection) {
        const newLength = distance(intersection, joist.p2);
        if (newLength > EPSILON) {
          clippedJoists.push({
            ...joist,
            p1: intersection,
            lengthFeet: newLength / PIXELS_PER_FOOT,
            clipped: true
          });
        }
      }
      continue;
    }

    // If only p2 is outside (outer side), clip p2 to the polygon boundary
    if (p1Inside && !p2Inside) {
      const intersection = findNearestIntersection(joist.p2, joist.p1, shapePoints);
      if (intersection) {
        const newLength = distance(joist.p1, intersection);
        if (newLength > EPSILON) {
          clippedJoists.push({
            ...joist,
            p2: intersection,
            lengthFeet: newLength / PIXELS_PER_FOOT,
            clipped: true
          });
        }
      }
      continue;
    }
  }

  return clippedJoists;
}

/**
 * Finds all intersections of a joist line with polygon edges
 * @param {Object} joist - Joist with p1, p2
 * @param {Array} polygon - Array of polygon points
 * @returns {Array} Array of intersection points
 */
function findJoistPolygonIntersections(joist, polygon) {
  const intersections = [];

  for (let i = 0; i < polygon.length; i++) {
    const edgeP1 = polygon[i];
    const edgeP2 = polygon[(i + 1) % polygon.length];

    const intersection = lineIntersection(joist.p1, joist.p2, edgeP1, edgeP2);
    if (intersection && isPointOnSegment(intersection, edgeP1, edgeP2)) {
      // Also check if intersection is between joist endpoints
      if (isPointOnSegment(intersection, joist.p1, joist.p2)) {
        intersections.push(intersection);
      }
    }
  }

  return intersections;
}

/**
 * Finds the nearest intersection point from outsidePoint toward insidePoint
 * @param {Object} outsidePoint - Point outside the polygon
 * @param {Object} insidePoint - Point inside the polygon
 * @param {Array} polygon - Array of polygon points
 * @returns {Object|null} Nearest intersection point or null
 */
function findNearestIntersection(outsidePoint, insidePoint, polygon) {
  let nearestIntersection = null;
  let nearestDistance = Infinity;

  for (let i = 0; i < polygon.length; i++) {
    const edgeP1 = polygon[i];
    const edgeP2 = polygon[(i + 1) % polygon.length];

    const intersection = lineIntersection(outsidePoint, insidePoint, edgeP1, edgeP2);
    if (intersection && isPointOnSegment(intersection, edgeP1, edgeP2)) {
      const dist = distance(outsidePoint, intersection);
      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearestIntersection = intersection;
      }
    }
  }

  return nearestIntersection;
}

