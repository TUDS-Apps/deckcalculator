// multiSectionCalculations.js - Multi-section structural calculations for complex deck shapes
// Handles structural calculations for decomposed shapes by calculating each section independently
// and then merging overlapping/collinear structural elements

import { EPSILON, PIXELS_PER_FOOT, POST_INSET_FEET, MAX_POST_SPACING_FEET } from "./config.js";
import * as deckCalculations from "./deckCalculations.js";

/**
 * Finds which edge of a rectangular section contains the ledger wall
 * @param {Object} section - Rectangular section object with corners and ledgerWalls
 * @returns {number} Index of the edge that contains the ledger (0-3)
 */
function findLedgerEdgeInSection(section) {
  if (!section.ledgerWalls || section.ledgerWalls.length === 0) {
    return 0; // Fallback to first edge
  }
  
  const ledgerWall = section.ledgerWalls[0]; // Use first ledger wall
  const corners = section.corners;
  
  // Check each edge of the rectangle to find which one contains the ledger
  for (let i = 0; i < corners.length; i++) {
    const edgeStart = corners[i];
    const edgeEnd = corners[(i + 1) % corners.length];
    
    // Check if this edge overlaps with the ledger wall
    if (edgesOverlap(edgeStart, edgeEnd, ledgerWall.p1, ledgerWall.p2)) {
      console.log(`Found ledger on edge ${i} of section rectangle`);
      return i;
    }
  }
  
  console.warn(`Could not find ledger edge in section, defaulting to edge 0`);
  return 0; // Fallback
}

/**
 * Checks if two line segments overlap (are collinear and intersect)
 * @param {Object} edge1Start - Start point of first edge
 * @param {Object} edge1End - End point of first edge  
 * @param {Object} edge2Start - Start point of second edge
 * @param {Object} edge2End - End point of second edge
 * @returns {boolean} True if edges overlap
 */
function edgesOverlap(edge1Start, edge1End, edge2Start, edge2End) {
  // Check if lines are collinear
  const crossProduct1 = (edge1End.x - edge1Start.x) * (edge2Start.y - edge1Start.y) - 
                       (edge1End.y - edge1Start.y) * (edge2Start.x - edge1Start.x);
  const crossProduct2 = (edge1End.x - edge1Start.x) * (edge2End.y - edge1Start.y) - 
                       (edge1End.y - edge1Start.y) * (edge2End.x - edge1Start.x);

  if (Math.abs(crossProduct1) > EPSILON || Math.abs(crossProduct2) > EPSILON) {
    return false; // Not collinear
  }

  // Check if there's any overlap between the segments
  // For horizontal segments
  if (Math.abs(edge1Start.y - edge1End.y) < EPSILON) {
    const minX1 = Math.min(edge1Start.x, edge1End.x);
    const maxX1 = Math.max(edge1Start.x, edge1End.x);
    const minX2 = Math.min(edge2Start.x, edge2End.x);
    const maxX2 = Math.max(edge2Start.x, edge2End.x);
    
    return maxX1 >= minX2 - EPSILON && minX1 <= maxX2 + EPSILON;
  }
  
  // For vertical segments
  if (Math.abs(edge1Start.x - edge1End.x) < EPSILON) {
    const minY1 = Math.min(edge1Start.y, edge1End.y);
    const maxY1 = Math.max(edge1Start.y, edge1End.y);
    const minY2 = Math.min(edge2Start.y, edge2End.y);
    const maxY2 = Math.max(edge2Start.y, edge2End.y);
    
    return maxY1 >= minY2 - EPSILON && minY1 <= maxY2 + EPSILON;
  }
  
  return false;
}

/**
 * Determines the global joist direction for the entire deck based on main ledger orientation
 * @param {Array<Object>} rectangularSections - Array of decomposed rectangular sections
 * @param {Array<number>} selectedWallIndices - Indices of selected ledger walls  
 * @param {Array<{x: number, y: number}>} originalPoints - Original deck outline points
 * @returns {Object} Global joist direction info
 */
function determineGlobalJoistDirection(rectangularSections, selectedWallIndices, originalPoints) {
  // Find the main ledger wall from the original shape
  const mainLedgerIndex = selectedWallIndices[0]; // Use first selected wall as main ledger
  const mainLedgerP1 = originalPoints[mainLedgerIndex];
  const mainLedgerP2 = originalPoints[(mainLedgerIndex + 1) % originalPoints.length];
  
  // Determine if main ledger is horizontal or vertical
  const isMainLedgerHorizontal = Math.abs(mainLedgerP1.x - mainLedgerP2.x) > Math.abs(mainLedgerP1.y - mainLedgerP2.y);
  
  return {
    isMainLedgerHorizontal: isMainLedgerHorizontal,
    // Joists should run perpendicular to the main ledger direction
    joistsRunVertically: isMainLedgerHorizontal,  // If ledger is horizontal, joists run vertically
    joistsRunHorizontally: !isMainLedgerHorizontal, // If ledger is vertical, joists run horizontally
    mainLedgerP1: mainLedgerP1,
    mainLedgerP2: mainLedgerP2
  };
}

/**
 * Reorients a section's points to ensure consistent joist direction across all sections
 * @param {Object} section - The rectangular section
 * @param {Array<{x: number, y: number}>} sectionPoints - Original section corner points
 * @param {number} originalLedgerIndex - Original ledger edge index in this section
 * @param {Object} globalJoistDirection - Global joist direction info
 * @returns {Object} Reoriented section data with new points and ledger index
 */
function reorientSectionForGlobalJoistDirection(section, sectionPoints, originalLedgerIndex, globalJoistDirection) {
  // Get the ledger edge from the original points
  const ledgerP1 = sectionPoints[originalLedgerIndex];
  const ledgerP2 = sectionPoints[(originalLedgerIndex + 1) % sectionPoints.length];
  
  // Determine if this section's ledger is horizontal or vertical
  const isSectionLedgerHorizontal = Math.abs(ledgerP1.x - ledgerP2.x) > Math.abs(ledgerP1.y - ledgerP2.y);
  
  // Check if this section's orientation matches the global orientation
  const orientationMatches = isSectionLedgerHorizontal === globalJoistDirection.isMainLedgerHorizontal;
  
  if (orientationMatches) {
    // Orientation already matches, no reorientation needed
    console.log(`Section orientation matches global direction - no reorientation needed`);
    return {
      points: sectionPoints,
      ledgerIndex: originalLedgerIndex
    };
  }
  
  // Orientation doesn't match - we need to reorient the section
  console.log(`Section orientation differs from global - reorienting section`);
  console.log(`Section ledger is ${isSectionLedgerHorizontal ? 'horizontal' : 'vertical'}, global is ${globalJoistDirection.isMainLedgerHorizontal ? 'horizontal' : 'vertical'}`);
  
  // For sections that don't have the main ledger, we need to choose the edge that would
  // result in the correct joist direction. Find an edge that matches the global orientation.
  let targetLedgerIndex = originalLedgerIndex;
  
  for (let i = 0; i < sectionPoints.length; i++) {
    const edgeP1 = sectionPoints[i];
    const edgeP2 = sectionPoints[(i + 1) % sectionPoints.length];
    const isEdgeHorizontal = Math.abs(edgeP1.x - edgeP2.x) > Math.abs(edgeP1.y - edgeP2.y);
    
    if (isEdgeHorizontal === globalJoistDirection.isMainLedgerHorizontal) {
      targetLedgerIndex = i;
      console.log(`Found matching edge orientation at index ${i}`);
      break;
    }
  }
  
  return {
    points: sectionPoints,
    ledgerIndex: targetLedgerIndex
  };
}

/**
 * Calculates structural components for multi-section decomposed deck shapes
 * @param {Array<Object>} rectangularSections - Array of decomposed rectangular sections
 * @param {Object} inputs - User input parameters (joist spacing, beam type, etc.)
 * @param {Array<number>} selectedWallIndices - Indices of selected ledger walls
 * @param {Array<{x: number, y: number}>} originalPoints - Original deck outline points
 * @returns {Object} Combined structural components object
 */
export function calculateMultiSectionStructure(rectangularSections, inputs, selectedWallIndices, originalPoints) {
  if (!rectangularSections || rectangularSections.length === 0) {
    return { error: "No rectangular sections provided for calculation" };
  }

  try {
    // Determine the global joist direction based on the main ledger orientation
    const globalJoistDirection = determineGlobalJoistDirection(rectangularSections, selectedWallIndices, originalPoints);
    console.log(`Global joist direction determined:`, globalJoistDirection);
    
    // Calculate structure for each section using consistent joist direction
    const sectionResults = [];
    
    for (let i = 0; i < rectangularSections.length; i++) {
      const section = rectangularSections[i];
      
      // Convert rectangle to deck dimensions format
      const sectionDimensions = calculateSectionDimensions(section);
      
      // Create points array from rectangle corners for this section
      const sectionPoints = [...section.corners];
      
      // Determine if this section has a ledger or should be treated as floating
      let sectionStructure;
      let isFloatingSection = false;
      
      if (section.isLedgerRectangle && section.ledgerWalls && section.ledgerWalls.length > 0) {
        // This section has a ledger - find the correct edge and ensure consistent orientation
        const sectionLedgerIndex = findLedgerEdgeInSection(section);
        
        // Reorder section points to ensure consistent joist direction across all sections
        const orientedSectionData = reorientSectionForGlobalJoistDirection(
          section, sectionPoints, sectionLedgerIndex, globalJoistDirection
        );
        
        console.log(`Calculating ledger-attached structure for section ${i + 1}/${rectangularSections.length}`);
        console.log(`Section dimensions:`, sectionDimensions);
        console.log(`Original ledger edge: ${sectionLedgerIndex}, Reoriented ledger edge: ${orientedSectionData.ledgerIndex}`);
        
        sectionStructure = deckCalculations.calculateStructure(
          orientedSectionData.points,
          orientedSectionData.ledgerIndex,
          inputs,
          sectionDimensions
        );
      } else if (section.isLedgerRectangle) {
        // This section is identified as part of the ledger structure but has no explicit ledger walls
        // This can happen in L-shaped decks where the section is collinear with the main ledger
        // Treat it as a ledger-attached section using the appropriate edge
        console.log(`Section ${i + 1} is identified as ledger rectangle but no explicit ledger walls found`);
        console.log(`Treating as ledger-attached section with appropriate edge selection`);
        
        // Find an edge that matches the global ledger orientation
        let ledgerOrientedEdgeIndex = 0;
        for (let j = 0; j < sectionPoints.length; j++) {
          const edgeP1 = sectionPoints[j];
          const edgeP2 = sectionPoints[(j + 1) % sectionPoints.length];
          const isEdgeHorizontal = Math.abs(edgeP1.x - edgeP2.x) > Math.abs(edgeP1.y - edgeP2.y);
          
          if (isEdgeHorizontal === globalJoistDirection.isMainLedgerHorizontal) {
            ledgerOrientedEdgeIndex = j;
            console.log(`Using edge ${j} that matches global ledger orientation`);
            break;
          }
        }
        
        // Reorder section points to ensure consistent joist direction
        const orientedSectionData = reorientSectionForGlobalJoistDirection(
          section, sectionPoints, ledgerOrientedEdgeIndex, globalJoistDirection
        );
        
        console.log(`Calculating ledger-attached structure for collinear section ${i + 1}/${rectangularSections.length}`);
        console.log(`Section dimensions:`, sectionDimensions);
        console.log(`Using ledger-oriented edge: ${orientedSectionData.ledgerIndex}`);
        
        sectionStructure = deckCalculations.calculateStructure(
          orientedSectionData.points,
          orientedSectionData.ledgerIndex,
          inputs,
          sectionDimensions
        );
      } else {
        // This section has no ledger - treat as floating deck with beams on both ends
        isFloatingSection = true;
        
        console.log(`Calculating floating deck structure for section ${i + 1}/${rectangularSections.length} (no ledger selected)`);
        console.log(`Section dimensions:`, sectionDimensions);
        console.log(`This section will have beams on both ends instead of a ledger attachment`);
        
        // For floating sections, also ensure consistent joist direction with the global orientation
        // Find an edge that matches the global joist direction for structural consistency
        let floatingLedgerIndex = 0; // Default fallback
        
        for (let j = 0; j < sectionPoints.length; j++) {
          const edgeP1 = sectionPoints[j];
          const edgeP2 = sectionPoints[(j + 1) % sectionPoints.length];
          const isEdgeHorizontal = Math.abs(edgeP1.x - edgeP2.x) > Math.abs(edgeP1.y - edgeP2.y);
          
          if (isEdgeHorizontal === globalJoistDirection.isMainLedgerHorizontal) {
            floatingLedgerIndex = j;
            console.log(`Floating section using edge ${j} to match global joist direction`);
            break;
          }
        }
        
        // Create modified inputs for floating deck calculation
        const floatingInputs = {
          ...inputs,
          attachmentType: 'floating' // Force floating mode
        };
        
        // Use the edge that matches global joist direction for consistent structural framing
        sectionStructure = deckCalculations.calculateStructure(
          sectionPoints,
          floatingLedgerIndex, // Use edge that matches global joist direction
          floatingInputs,
          sectionDimensions
        );
      }
      
      if (sectionStructure && !sectionStructure.error) {
        sectionResults.push({
          sectionIndex: i,
          section: section,
          dimensions: sectionDimensions,
          structure: sectionStructure,
          isFloatingSection: isFloatingSection
        });
      } else {
        console.warn(`Section ${i} calculation failed:`, sectionStructure?.error);
        // Continue with other sections even if one fails
      }
    }
    
    if (sectionResults.length === 0) {
      return { error: "All section calculations failed" };
    }
    
    console.log(`Successfully calculated ${sectionResults.length} sections`);

    // Merge results from all sections, passing originalPoints for boundary clipping
    const mergedStructure = mergeSectionResults(sectionResults, originalPoints);

    // ============================================================================
    // DIAGONAL EDGE HANDLING
    // After merging sections, handle diagonal edges from the original shape
    // ============================================================================
    if (originalPoints && originalPoints.length >= 3) {
      const diagonalEdges = deckCalculations.getDiagonalEdges(originalPoints);
      console.log(`[MULTI-SECTION DIAGONAL] Found ${diagonalEdges.length} diagonal edges in original shape`);

      if (diagonalEdges.length > 0) {
        // Calculate deck dimensions from original points
        const allX = originalPoints.map(p => p.x);
        const allY = originalPoints.map(p => p.y);
        const overallDimensions = {
          minX: Math.min(...allX),
          maxX: Math.max(...allX),
          minY: Math.min(...allY),
          maxY: Math.max(...allY)
        };

        // Determine deck extension direction from global joist direction
        const deckExtendsPositiveDir = globalJoistDirection.isMainLedgerHorizontal
          ? (overallDimensions.maxY - globalJoistDirection.mainLedgerP1.y) > (globalJoistDirection.mainLedgerP1.y - overallDimensions.minY)
          : (overallDimensions.maxX - globalJoistDirection.mainLedgerP1.x) > (globalJoistDirection.mainLedgerP1.x - overallDimensions.minX);

        console.log(`[MULTI-SECTION DIAGONAL] Deck extends positive dir: ${deckExtendsPositiveDir}`);
        console.log(`[MULTI-SECTION DIAGONAL] isMainLedgerHorizontal: ${globalJoistDirection.isMainLedgerHorizontal}`);

        // Filter out diagonal edges that are the ledger wall
        const nonLedgerDiagonalEdges = diagonalEdges.filter(edge => {
          // Check if this edge is the ledger
          for (const wallIdx of selectedWallIndices) {
            if (edge.index === wallIdx) {
              console.log(`[MULTI-SECTION DIAGONAL] Skipping diagonal edge ${edge.index} - it's the ledger`);
              return false;
            }
          }
          return true;
        });

        if (nonLedgerDiagonalEdges.length > 0) {
          // Extend joists to diagonal edges
          console.log(`[MULTI-SECTION DIAGONAL] Extending ${mergedStructure.joists.length} joists to ${nonLedgerDiagonalEdges.length} diagonal edges`);
          mergedStructure.joists = deckCalculations.extendJoistsToDiagonalEdges(
            mergedStructure.joists,
            nonLedgerDiagonalEdges,
            globalJoistDirection.isMainLedgerHorizontal,
            overallDimensions,
            deckExtendsPositiveDir
          );

          // Create diagonal beams parallel to diagonal edges
          for (const diagEdge of nonLedgerDiagonalEdges) {
            console.log(`[MULTI-SECTION DIAGONAL] Creating beam for diagonal edge from (${diagEdge.p1.x.toFixed(1)}, ${diagEdge.p1.y.toFixed(1)}) to (${diagEdge.p2.x.toFixed(1)}, ${diagEdge.p2.y.toFixed(1)})`);

            // Calculate setback based on beam type and joist size cantilever
            const joistSize = inputs.joistSize || '2x8';
            const cantileverFeet = deckCalculations.getCantileverForJoistSize(joistSize);
            const setbackFeet = inputs.beamType === 'drop' ? cantileverFeet : 0;

            // Determine direction to offset beam (into the deck)
            const edgeMidX = (diagEdge.p1.x + diagEdge.p2.x) / 2;
            const edgeMidY = (diagEdge.p1.y + diagEdge.p2.y) / 2;
            const deckCenterX = (overallDimensions.minX + overallDimensions.maxX) / 2;
            const deckCenterY = (overallDimensions.minY + overallDimensions.maxY) / 2;

            const edgeAngle = deckCalculations.getEdgeAngle(diagEdge.p1, diagEdge.p2);
            const perpVec = deckCalculations.getPerpendicularVector(edgeAngle);

            // Test which perpendicular direction points toward deck center
            const testX = edgeMidX + perpVec.x * 10;
            const testY = edgeMidY + perpVec.y * 10;
            const distToCenter1 = Math.sqrt((testX - deckCenterX) ** 2 + (testY - deckCenterY) ** 2);
            const distToCenter2 = Math.sqrt((edgeMidX - perpVec.x * 10 - deckCenterX) ** 2 +
                                             (edgeMidY - perpVec.y * 10 - deckCenterY) ** 2);
            const inwardSign = distToCenter1 < distToCenter2 ? 1 : -1;

            // Get beam properties from existing beams
            const existingBeam = mergedStructure.beams[0];
            const beamSize = existingBeam?.size || '2x8';
            const beamPly = existingBeam?.ply || 2;

            // Get post/footing inputs from first section's results
            const firstSectionInputs = sectionResults[0] ?
              { deckHeightInches: (sectionResults[0].structure.posts?.[0]?.heightFeet || 4) * 12,
                postSize: sectionResults[0].structure.posts?.[0]?.size || '6x6',
                footingType: sectionResults[0].structure.footings?.[0]?.type || 'concrete' }
              : { deckHeightInches: 48, postSize: '6x6', footingType: 'concrete' };

            const diagBeamRes = deckCalculations.calculateAngledBeamAndPosts(
              diagEdge.p1,
              diagEdge.p2,
              setbackFeet,
              beamSize,
              beamPly,
              firstSectionInputs.postSize,
              firstSectionInputs.deckHeightInches,
              firstSectionInputs.footingType,
              "Diagonal Beam",
              inputs.beamType,
              inwardSign
            );

            if (diagBeamRes.beam && diagBeamRes.beam.lengthFeet > EPSILON) {
              console.log(`[MULTI-SECTION DIAGONAL] Added diagonal beam: ${diagBeamRes.beam.lengthFeet.toFixed(2)} ft`);

              // Find the outer beam that this diagonal beam should intersect with
              // The outer beam is typically the one that runs perpendicular to the ledger
              // and is closest to the diagonal edge
              const outerBeam = findOuterBeamForDiagonalTrim(mergedStructure.beams, diagEdge, globalJoistDirection.isMainLedgerHorizontal);

              if (outerBeam) {
                console.log(`[MULTI-SECTION DIAGONAL] Found outer beam to trim against`);

                // Get the index of the outer beam so we can replace it
                const outerBeamIndex = mergedStructure.beams.indexOf(outerBeam);

                // Find posts and footings associated with the outer beam
                const outerBeamPosts = findPostsForBeam(mergedStructure.posts, outerBeam);
                const outerBeamFootings = findFootingsForBeam(mergedStructure.footings, outerBeam);

                // Trim both beams at their intersection
                const trimResult = deckCalculations.trimBeamsAtIntersection(
                  outerBeam,
                  diagBeamRes.beam,
                  outerBeamPosts,
                  diagBeamRes.posts,
                  outerBeamFootings,
                  diagBeamRes.footings,
                  firstSectionInputs.postSize,
                  firstSectionInputs.deckHeightInches,
                  firstSectionInputs.footingType
                );

                // Replace the outer beam with the trimmed version
                if (outerBeamIndex !== -1) {
                  mergedStructure.beams[outerBeamIndex] = trimResult.outerBeam;
                }

                // Remove old posts/footings for outer beam and add filtered ones
                removePostsForBeam(mergedStructure.posts, outerBeam);
                removeFootingsForBeam(mergedStructure.footings, outerBeam);
                mergedStructure.posts.push(...trimResult.outerPosts);
                mergedStructure.footings.push(...trimResult.outerFootings);

                // Add the trimmed diagonal beam, but first extend it to the deck edge
                const extendedDiagonalBeam = extendDiagonalBeamToEdge(
                  trimResult.diagonalBeam,
                  overallDimensions,
                  diagEdge,
                  { x: deckCenterX, y: deckCenterY }
                );
                mergedStructure.beams.push(extendedDiagonalBeam);
                mergedStructure.posts.push(...trimResult.diagonalPosts);
                mergedStructure.footings.push(...trimResult.diagonalFootings);

                // Add the shared intersection post and footing
                if (trimResult.intersectionPost) {
                  mergedStructure.posts.push(trimResult.intersectionPost);
                }
                if (trimResult.intersectionFooting) {
                  mergedStructure.footings.push(trimResult.intersectionFooting);
                }
              } else {
                // No outer beam to trim against, extend the beam to deck edge and add it
                const extendedDiagonalBeam = extendDiagonalBeamToEdge(
                  diagBeamRes.beam,
                  overallDimensions,
                  diagEdge,
                  { x: deckCenterX, y: deckCenterY }
                );
                mergedStructure.beams.push(extendedDiagonalBeam);
                mergedStructure.posts.push(...diagBeamRes.posts);
                mergedStructure.footings.push(...diagBeamRes.footings);
              }
            }
          }

          // ====================================================================
          // DIAGONAL RIM JOIST HANDLING
          // Add diagonal edges as rim joists and trim existing rim joists
          // ====================================================================

          // Get rim joist size from existing rim joists
          const existingRimJoist = mergedStructure.rimJoists[0];
          const rimJoistSize = existingRimJoist?.size || '2x8';

          for (const diagEdge of nonLedgerDiagonalEdges) {
            // 1. Add diagonal rim joist for this edge
            const diagRimJoist = {
              p1: { ...diagEdge.p1 },
              p2: { ...diagEdge.p2 },
              size: rimJoistSize,
              lengthFeet: Math.sqrt(
                Math.pow(diagEdge.p2.x - diagEdge.p1.x, 2) +
                Math.pow(diagEdge.p2.y - diagEdge.p1.y, 2)
              ) / PIXELS_PER_FOOT,
              usage: 'Diagonal Rim Joist',
              fullEdgeP1: { ...diagEdge.p1 },
              fullEdgeP2: { ...diagEdge.p2 },
              isDiagonal: true
            };
            mergedStructure.rimJoists.push(diagRimJoist);
            console.log(`[DIAGONAL RIM] Added diagonal rim joist: ${diagRimJoist.lengthFeet.toFixed(2)} ft`);

            // 2. Trim existing rim joists at this diagonal edge
            mergedStructure.rimJoists = trimRimJoistsAtDiagonalEdge(
              mergedStructure.rimJoists,
              diagEdge,
              { x: deckCenterX, y: deckCenterY }
            );
          }
        }
      }
    }

    return mergedStructure;
    
  } catch (error) {
    console.error("Multi-section calculation error:", error);
    return { error: `Multi-section calculation failed: ${error.message}` };
  }
}

/**
 * Converts rectangle corners to deck dimensions format
 * @param {Object} rectangle - Rectangle object with corners array
 * @returns {Object} Deck dimensions object {widthFeet, heightFeet, minX, maxX, minY, maxY}
 */
export function calculateSectionDimensions(rectangle) {
  if (!rectangle || !rectangle.corners || rectangle.corners.length < 4) {
    throw new Error("Invalid rectangle for dimension calculation");
  }
  
  const corners = rectangle.corners;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  
  corners.forEach(corner => {
    minX = Math.min(minX, corner.x);
    maxX = Math.max(maxX, corner.x);
    minY = Math.min(minY, corner.y);
    maxY = Math.max(maxY, corner.y);
  });
  
  const widthPixels = maxX - minX;
  const heightPixels = maxY - minY;
  
  // Convert pixels to feet (assuming 24 pixels per foot from config)
  const PIXELS_PER_FOOT = 24;
  
  return {
    widthFeet: widthPixels / PIXELS_PER_FOOT,
    heightFeet: heightPixels / PIXELS_PER_FOOT,
    minX: minX,
    maxX: maxX,
    minY: minY,
    maxY: maxY
  };
}

/**
 * Merges structural calculation results from multiple sections
 * @param {Array<Object>} sectionResults - Array of section calculation results
 * @param {Array<{x: number, y: number}>} originalPoints - Original deck outline points for boundary clipping
 * @returns {Object} Combined structural components object
 */
export function mergeSectionResults(sectionResults, originalPoints = null) {
  if (!sectionResults || sectionResults.length === 0) {
    return { error: "No section results to merge" };
  }

  // If only one section, return its structure directly
  if (sectionResults.length === 1) {
    return sectionResults[0].structure;
  }
  
  console.log(`Merging results from ${sectionResults.length} sections`);
  
  // Initialize combined arrays
  let combinedLedger = null;
  const combinedBeams = [];
  const combinedJoists = [];
  const combinedRimJoists = [];
  const combinedPosts = [];
  const combinedFootings = [];
  const combinedMidSpanBlocking = [];
  const combinedPictureFrameBlocking = [];
  
  // Collect all components from each section
  sectionResults.forEach((result, index) => {
    const structure = result.structure;
    const sectionId = index + 1; // R1, R2, R3, etc.
    
    console.log(`Processing section ${index + 1} components`);
    console.log(`Section ${index + 1} - isFloatingSection: ${result.isFloatingSection}, has ledger: ${!!structure.ledger}, ledger length: ${structure.ledger?.lengthFeet || 'N/A'}`);
    console.log(`Section ${index + 1} - section.isLedgerRectangle: ${result.section.isLedgerRectangle}`);
    
    // Enhanced ledger handling - combine from sections that have ledgers OR are identified as ledger rectangles
    // This ensures that L-shaped decks properly combine all ledger segments
    if (structure.ledger && (!result.isFloatingSection || result.section.isLedgerRectangle)) {
      if (!combinedLedger) {
        combinedLedger = { ...structure.ledger, sectionId: sectionId };
        console.log(`First ledger section ${sectionId}: ${combinedLedger.lengthFeet} feet`);
      } else {
        // Extend ledger if they're connected
        console.log(`Extending ledger: existing ${combinedLedger.lengthFeet} feet + section ${sectionId} ${structure.ledger.lengthFeet} feet`);
        combinedLedger = extendLedger(combinedLedger, structure.ledger);
        console.log(`After extending: ${combinedLedger.lengthFeet} feet total`);
      }
    }
    // Note: Only purely floating sections (not marked as ledger rectangles) don't contribute to the combined ledger
    
    // Collect all other components with section IDs
    if (structure.beams) {
      const beamsWithSectionId = structure.beams.map(beam => ({ ...beam, sectionId: sectionId }));
      combinedBeams.push(...beamsWithSectionId);
    }
    if (structure.joists) {
      const joistsWithSectionId = structure.joists.map(joist => ({ ...joist, sectionId: sectionId }));
      combinedJoists.push(...joistsWithSectionId);
    }
    if (structure.rimJoists) {
      const rimJoistsWithSectionId = structure.rimJoists.map(rimJoist => ({ ...rimJoist, sectionId: sectionId }));
      combinedRimJoists.push(...rimJoistsWithSectionId);
    }
    if (structure.posts) {
      const postsWithSectionId = structure.posts.map(post => ({ ...post, sectionId: sectionId }));
      combinedPosts.push(...postsWithSectionId);
    }
    if (structure.footings) {
      const footingsWithSectionId = structure.footings.map(footing => ({ ...footing, sectionId: sectionId }));
      combinedFootings.push(...footingsWithSectionId);
    }
    if (structure.midSpanBlocking) {
      const blockingWithSectionId = structure.midSpanBlocking.map(blocking => ({ ...blocking, sectionId: sectionId }));
      combinedMidSpanBlocking.push(...blockingWithSectionId);
    }
    if (structure.pictureFrameBlocking) {
      const pfBlockingWithSectionId = structure.pictureFrameBlocking.map(pfBlocking => ({ ...pfBlocking, sectionId: sectionId }));
      combinedPictureFrameBlocking.push(...pfBlockingWithSectionId);
    }
  });
  
  // Merge overlapping and collinear components, passing originalPoints for boundary clipping
  const mergedBeams = handleBeamMerging(combinedBeams, originalPoints);
  
  // Recalculate posts and footings for merged beams
  // We need to get the deck height and post size from the first section's inputs
  const firstSectionInputs = sectionResults[0] ? 
    { deckHeightInches: (sectionResults[0].structure.posts?.[0]?.heightFeet || 4) * 12,
      postSize: sectionResults[0].structure.posts?.[0]?.size || '6x6',
      footingType: sectionResults[0].structure.footings?.[0]?.type || 'concrete' } 
    : { deckHeightInches: 48, postSize: '6x6', footingType: 'concrete' };
  
  const recalculatedPostsAndFootings = recalculatePostsForMergedBeams(
    mergedBeams,
    firstSectionInputs.postSize,
    firstSectionInputs.deckHeightInches,
    firstSectionInputs.footingType
  );
  
  const mergedPosts = recalculatedPostsAndFootings.posts;
  const mergedFootings = recalculatedPostsAndFootings.footings;
  const mergedJoists = mergeCollinearJoists(combinedJoists, originalPoints);
  const mergedRimJoists = mergeCollinearRimJoists(combinedRimJoists, originalPoints);
  
  console.log(`Merged components: ${mergedBeams.length} beams, ${mergedPosts.length} posts, ${mergedFootings.length} footings`);

  // Return combined structure
  return {
    ledger: combinedLedger,
    beams: mergedBeams,
    joists: mergedJoists,
    rimJoists: mergedRimJoists,
    posts: mergedPosts,
    footings: mergedFootings,
    midSpanBlocking: combinedMidSpanBlocking,
    pictureFrameBlocking: combinedPictureFrameBlocking
  };
}

/**
 * Merges collinear beams and handles beam intersections
 * @param {Array<Object>} allBeams - Array of all beam objects from sections
 * @param {Array<{x: number, y: number}>} originalPoints - Original deck outline points for boundary clipping
 * @returns {Array<Object>} Merged beam array
 */
export function handleBeamMerging(allBeams, originalPoints = null) {
  if (!allBeams || allBeams.length === 0) return [];
  
  console.log(`\n=== Starting beam merging process with ${allBeams.length} beams ===`);
  
  // Log all input beams for debugging
  allBeams.forEach((beam, idx) => {
    console.log(`Beam ${idx}: Section ${beam.sectionId}, ${beam.lengthFt}'`, 
      `${beam.usage}, size: ${beam.size}, from (${beam.p1.x},${beam.p1.y}) to (${beam.p2.x},${beam.p2.y})`);
  });
  
  const mergedBeams = [];
  const processed = new Set();
  
  for (let i = 0; i < allBeams.length; i++) {
    if (processed.has(i)) continue;
    
    const beam1 = allBeams[i];
    const mergeGroup = [beam1];
    processed.add(i);
    
    console.log(`\nChecking beam ${i} for potential merges...`);
    
    // Find all beams that should be merged with this group
    // We need to check against all beams in the merge group, not just beam1
    let foundNewMerge = true;
    while (foundNewMerge) {
      foundNewMerge = false;
      
      for (let j = 0; j < allBeams.length; j++) {
        if (processed.has(j)) continue;
        
        const beam2 = allBeams[j];
        
        // Check if beam2 can merge with any beam in the current merge group
        let canMergeWithGroup = false;
        for (const groupBeam of mergeGroup) {
          if (shouldMergeBeams(groupBeam, beam2)) {
            canMergeWithGroup = true;
            break;
          }
        }
        
        if (canMergeWithGroup) {
          console.log(`  ✓ Beam ${j} can merge with group`);
          mergeGroup.push(beam2);
          processed.add(j);
          foundNewMerge = true; // Continue searching for more beams to merge
        }
      }
    }
    
    // Merge the group of beams, passing originalPoints for boundary clipping
    if (mergeGroup.length > 1) {
      const mergedBeam = mergeBeamGroup(mergeGroup, originalPoints);
      mergedBeams.push(mergedBeam);
    } else {
      // Single beam - also clip to boundary
      if (originalPoints && originalPoints.length >= 3) {
        const isHorizontal = Math.abs(beam1.p2.y - beam1.p1.y) < Math.abs(beam1.p2.x - beam1.p1.x);
        const clippedBeam = clipBeamToDeckBoundary(beam1, originalPoints, isHorizontal);
        if (clippedBeam && !clippedBeam.removed) {
          beam1.p1 = clippedBeam.p1;
          beam1.p2 = clippedBeam.p2;
          beam1.centerlineP1 = clippedBeam.p1;
          beam1.centerlineP2 = clippedBeam.p2;
          beam1.lengthFt = clippedBeam.lengthFt;
        } else if (clippedBeam && clippedBeam.removed) {
          beam1.removed = true;
        }
      }
      mergedBeams.push(beam1);
    }
  }

  // Filter out beams that were marked for removal (outside boundary)
  const validBeams = mergedBeams.filter(beam => !beam.removed && beam.lengthFt > 0.1);

  console.log(`\n=== Beam merging complete: ${allBeams.length} beams → ${validBeams.length} valid beams (${mergedBeams.length - validBeams.length} removed) ===\n`);

  return validBeams;
}

/**
 * Checks if two beams should be merged (collinear, adjacent, and same type)
 * @param {Object} beam1 - First beam object
 * @param {Object} beam2 - Second beam object
 * @returns {boolean} True if beams should be merged
 */
function shouldMergeBeams(beam1, beam2) {
  console.log(`\n  Checking if beams can merge:`);
  console.log(`    Beam 1: ${beam1.usage}, size: ${beam1.size}, from (${beam1.p1.x.toFixed(0)},${beam1.p1.y.toFixed(0)}) to (${beam1.p2.x.toFixed(0)},${beam1.p2.y.toFixed(0)})`);
  console.log(`    Beam 2: ${beam2.usage}, size: ${beam2.size}, from (${beam2.p1.x.toFixed(0)},${beam2.p1.y.toFixed(0)}) to (${beam2.p2.x.toFixed(0)},${beam2.p2.y.toFixed(0)})`);
  
  // Must be same size
  if (beam1.size !== beam2.size) {
    console.log(`    ✗ Different sizes: ${beam1.size} vs ${beam2.size}`);
    return false;
  }
  
  // Check if beams have compatible usage types
  // Beams can merge if they have the same usage OR if one is Outer and other is Wall-Side
  // (This happens when sections share a beam at their boundary)
  const areCompatible = beam1.usage === beam2.usage || 
    (beam1.usage === "Outer Beam" && beam2.usage === "Outer Beam") ||
    (beam1.usage === "Outer Beam" && beam2.usage === "Wall-Side Beam") ||
    (beam1.usage === "Wall-Side Beam" && beam2.usage === "Outer Beam");
  
  if (!areCompatible) {
    console.log(`    ✗ Incompatible types: ${beam1.usage} vs ${beam2.usage}`);
    return false;
  }
  
  const collinear = areBeamsCollinear(beam1, beam2);
  const adjacent = areBeamsAdjacent(beam1, beam2);
  
  console.log(`    Collinear: ${collinear}, Adjacent: ${adjacent}`);
  
  // Check if beams are collinear and adjacent
  return collinear && adjacent;
}

/**
 * Checks if two beams are adjacent (touching or very close)
 * @param {Object} beam1 - First beam object
 * @param {Object} beam2 - Second beam object
 * @returns {boolean} True if beams are adjacent
 */
function areBeamsAdjacent(beam1, beam2) {
  const TOLERANCE = 1.0 * PIXELS_PER_FOOT; // 1 foot tolerance for adjacency
  
  // Check distance between all possible endpoint pairs
  const distances = [
    Math.sqrt(Math.pow(beam1.p1.x - beam2.p1.x, 2) + Math.pow(beam1.p1.y - beam2.p1.y, 2)),
    Math.sqrt(Math.pow(beam1.p1.x - beam2.p2.x, 2) + Math.pow(beam1.p1.y - beam2.p2.y, 2)),
    Math.sqrt(Math.pow(beam1.p2.x - beam2.p1.x, 2) + Math.pow(beam1.p2.y - beam2.p1.y, 2)),
    Math.sqrt(Math.pow(beam1.p2.x - beam2.p2.x, 2) + Math.pow(beam1.p2.y - beam2.p2.y, 2))
  ];
  
  const minDistance = Math.min(...distances);
  console.log(`    Min distance between endpoints: ${(minDistance / PIXELS_PER_FOOT).toFixed(2)} feet`);
  
  // Beams are adjacent if any endpoint pair is within tolerance
  return minDistance <= TOLERANCE;
}

/**
 * Checks if two beams are collinear (on the same line)
 * @param {Object} beam1 - First beam object
 * @param {Object} beam2 - Second beam object
 * @returns {boolean} True if beams are collinear
 */
function areBeamsCollinear(beam1, beam2) {
  const p1 = beam1.p1;
  const p2 = beam1.p2;
  const p3 = beam2.p1;
  const p4 = beam2.p2;
  
  // For beams to be collinear in a deck structure, they should be either:
  // 1. Both horizontal (same Y coordinate)
  // 2. Both vertical (same X coordinate)
  
  const beam1IsHorizontal = Math.abs(p2.y - p1.y) < PIXELS_PER_FOOT; // Less than 1 foot Y difference
  const beam1IsVertical = Math.abs(p2.x - p1.x) < PIXELS_PER_FOOT; // Less than 1 foot X difference
  
  const beam2IsHorizontal = Math.abs(p4.y - p3.y) < PIXELS_PER_FOOT;
  const beam2IsVertical = Math.abs(p4.x - p3.x) < PIXELS_PER_FOOT;
  
  // Both must have same orientation
  if (beam1IsHorizontal !== beam2IsHorizontal || beam1IsVertical !== beam2IsVertical) {
    console.log(`    Different orientations - Beam1: H=${beam1IsHorizontal} V=${beam1IsVertical}, Beam2: H=${beam2IsHorizontal} V=${beam2IsVertical}`);
    return false;
  }
  
  // For horizontal beams, check if Y coordinates are close
  if (beam1IsHorizontal) {
    const avgY1 = (p1.y + p2.y) / 2;
    const avgY2 = (p3.y + p4.y) / 2;
    const yDiff = Math.abs(avgY1 - avgY2);
    const collinear = yDiff < PIXELS_PER_FOOT; // Within 1 foot
    console.log(`    Horizontal beams - Y difference: ${(yDiff / PIXELS_PER_FOOT).toFixed(2)} feet`);
    return collinear;
  }
  
  // For vertical beams, check if X coordinates are close
  if (beam1IsVertical) {
    const avgX1 = (p1.x + p2.x) / 2;
    const avgX2 = (p3.x + p4.x) / 2;
    const xDiff = Math.abs(avgX1 - avgX2);
    const collinear = xDiff < PIXELS_PER_FOOT; // Within 1 foot
    console.log(`    Vertical beams - X difference: ${(xDiff / PIXELS_PER_FOOT).toFixed(2)} feet`);
    return collinear;
  }
  
  // Neither horizontal nor vertical - use cross product method
  const crossProduct1 = (p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x);
  const crossProduct2 = (p4.x - p1.x) * (p2.y - p1.y) - (p4.y - p1.y) * (p2.x - p1.x);
  
  console.log(`    Cross products: ${crossProduct1.toFixed(2)}, ${crossProduct2.toFixed(2)}`);
  
  // If both cross products are close to zero, the beams are collinear
  return Math.abs(crossProduct1) < PIXELS_PER_FOOT * PIXELS_PER_FOOT && 
         Math.abs(crossProduct2) < PIXELS_PER_FOOT * PIXELS_PER_FOOT;
}

/**
 * Merges a group of collinear beams into a single beam
 * @param {Array<Object>} beamGroup - Array of beams to merge
 * @param {Array<{x: number, y: number}>} originalPoints - Original deck outline points for boundary clipping
 * @returns {Object} Merged beam object
 */
function mergeBeamGroup(beamGroup, originalPoints = null) {
  if (beamGroup.length === 1) return beamGroup[0];

  console.log(`Merging ${beamGroup.length} collinear beams`);

  // Find the extent of all beams
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  beamGroup.forEach(beam => {
    minX = Math.min(minX, beam.p1.x, beam.p2.x);
    maxX = Math.max(maxX, beam.p1.x, beam.p2.x);
    minY = Math.min(minY, beam.p1.y, beam.p2.y);
    maxY = Math.max(maxY, beam.p1.y, beam.p2.y);
    console.log(`  Beam from section ${beam.sectionId}: ${beam.lengthFt}' (${beam.usage})`);
  });

  // Use the first beam as template for properties
  const templateBeam = beamGroup[0];

  // Determine if beam is primarily horizontal or vertical
  const isHorizontal = (maxX - minX) > (maxY - minY);

  let mergedBeam;
  if (isHorizontal) {
    // For horizontal beams, use the average Y coordinate from all beam endpoints
    const avgY = beamGroup.reduce((sum, beam) => {
      return sum + (beam.p1.y + beam.p2.y) / 2;
    }, 0) / beamGroup.length;

    mergedBeam = {
      ...templateBeam,
      p1: { x: minX, y: avgY },
      p2: { x: maxX, y: avgY },
      centerlineP1: { x: minX, y: avgY },
      centerlineP2: { x: maxX, y: avgY },
      lengthFt: (maxX - minX) / 24 // Convert pixels to feet
    };
  } else {
    // For vertical beams, use the average X coordinate from all beam endpoints
    const avgX = beamGroup.reduce((sum, beam) => {
      return sum + (beam.p1.x + beam.p2.x) / 2;
    }, 0) / beamGroup.length;

    mergedBeam = {
      ...templateBeam,
      p1: { x: avgX, y: minY },
      p2: { x: avgX, y: maxY },
      centerlineP1: { x: avgX, y: minY },
      centerlineP2: { x: avgX, y: maxY },
      lengthFt: (maxY - minY) / 24 // Convert pixels to feet
    };
  }

  // Clip merged beam to deck boundary if originalPoints provided
  if (originalPoints && originalPoints.length >= 3) {
    const clippedBeam = clipBeamToDeckBoundary(mergedBeam, originalPoints, isHorizontal);
    if (clippedBeam) {
      // Check if beam was marked for removal (entirely outside polygon)
      if (clippedBeam.removed) {
        console.log(`[BEAM_CLIP] Beam marked for removal - entirely outside deck boundary`);
        mergedBeam.removed = true;
        mergedBeam.lengthFt = 0;
        return mergedBeam;
      }
      mergedBeam.p1 = clippedBeam.p1;
      mergedBeam.p2 = clippedBeam.p2;
      mergedBeam.centerlineP1 = clippedBeam.p1;
      mergedBeam.centerlineP2 = clippedBeam.p2;
      mergedBeam.lengthFt = clippedBeam.lengthFt;
      console.log(`[BEAM_CLIP] Beam clipped to deck boundary`);
    }
  }

  // Mark as merged for enhanced rendering
  mergedBeam.isMerged = true;
  mergedBeam.mergedFromCount = beamGroup.length;
  mergedBeam.originalSections = beamGroup.map(b => b.sectionId);

  // Calculate the actual combined length in feet and inches
  const totalInches = Math.round(mergedBeam.lengthFt * 12);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  mergedBeam.lengthDisplay = inches > 0 ? `${feet}'${inches}"` : `${feet}'`;

  console.log(`✓ Merged beam total length: ${mergedBeam.lengthDisplay} (${mergedBeam.lengthFt.toFixed(2)} feet)`);
  console.log(`  Merged beam endpoints: (${mergedBeam.p1.x.toFixed(0)}, ${mergedBeam.p1.y.toFixed(0)}) to (${mergedBeam.p2.x.toFixed(0)}, ${mergedBeam.p2.y.toFixed(0)})`);
  console.log(`  Centerline: (${mergedBeam.centerlineP1.x.toFixed(0)}, ${mergedBeam.centerlineP1.y.toFixed(0)}) to (${mergedBeam.centerlineP2.x.toFixed(0)}, ${mergedBeam.centerlineP2.y.toFixed(0)})`);

  // IMPORTANT NOTE: When beams are merged, the posts and footings need to be recalculated
  // based on the new merged beam length. The merged beam should have posts at:
  // 1. Both ends of the beam (1' inset)
  // 2. At regular intervals based on the beam span requirements (typically 6-8 feet)
  // This recalculation should happen in the post-processing phase after all beams are merged.

  return mergedBeam;
}

/**
 * Clips a beam to stay within the deck boundary polygon
 * @param {Object} beam - Beam with p1, p2 endpoints
 * @param {Array<{x: number, y: number}>} shapePoints - Deck polygon points
 * @param {boolean} isHorizontal - Whether the beam is horizontal
 * @returns {Object|null} Clipped beam with p1, p2, lengthFt or null if no clipping needed/beam is outside
 */
function clipBeamToDeckBoundary(beam, shapePoints, isHorizontal) {
  if (!shapePoints || shapePoints.length < 3) return null;

  const TOLERANCE = 2; // pixels
  const numEdges = shapePoints.length;

  // Check if each endpoint is inside the polygon
  const p1Inside = isPointInsidePolygon(beam.p1, shapePoints);
  const p2Inside = isPointInsidePolygon(beam.p2, shapePoints);

  // If both endpoints are inside, no clipping needed
  if (p1Inside && p2Inside) {
    console.log(`[BEAM_CLIP] Both endpoints inside polygon - no clipping needed`);
    return null;
  }

  console.log(`[BEAM_CLIP] Endpoints inside: p1=${p1Inside}, p2=${p2Inside}`);
  console.log(`[BEAM_CLIP] Beam: (${beam.p1.x.toFixed(1)}, ${beam.p1.y.toFixed(1)}) to (${beam.p2.x.toFixed(1)}, ${beam.p2.y.toFixed(1)})`);

  // Find ALL intersections of beam line (extended infinitely) with polygon edges
  const intersections = [];

  for (let i = 0; i < numEdges; i++) {
    const edgeP1 = shapePoints[i];
    const edgeP2 = shapePoints[(i + 1) % numEdges];

    const intersection = lineIntersection(beam.p1, beam.p2, edgeP1, edgeP2);
    if (intersection) {
      // Check if intersection is on the polygon edge segment
      if (isPointOnSegment(intersection, edgeP1, edgeP2, TOLERANCE)) {
        intersections.push({ ...intersection, edgeIndex: i });
        console.log(`[BEAM_CLIP] Found intersection with edge ${i} at (${intersection.x.toFixed(1)}, ${intersection.y.toFixed(1)})`);
      }
    }
  }

  if (intersections.length === 0) {
    console.log(`[BEAM_CLIP] No intersections found - beam may be entirely outside polygon`);
    // If both endpoints are outside and no intersections, the beam is entirely outside
    if (!p1Inside && !p2Inside) {
      return { p1: beam.p1, p2: beam.p1, lengthFt: 0, removed: true }; // Return zero-length to indicate removal
    }
    return null;
  }

  // Sort intersections by distance from p1 along the beam direction
  const beamDx = beam.p2.x - beam.p1.x;
  const beamDy = beam.p2.y - beam.p1.y;
  const beamLength = Math.sqrt(beamDx * beamDx + beamDy * beamDy);

  if (beamLength < TOLERANCE) return null;

  intersections.forEach(inter => {
    // Calculate parametric position along beam line (t=0 at p1, t=1 at p2)
    inter.t = ((inter.x - beam.p1.x) * beamDx + (inter.y - beam.p1.y) * beamDy) / (beamLength * beamLength);
  });

  intersections.sort((a, b) => a.t - b.t);

  // Determine new endpoints based on which points are inside/outside
  let newP1 = beam.p1;
  let newP2 = beam.p2;

  if (!p1Inside && !p2Inside) {
    // Both endpoints outside - find the segment of the beam that's inside the polygon
    // We need at least 2 intersections to have a valid segment inside
    if (intersections.length >= 2) {
      // Find the two intersections that bound the inside segment
      // The beam enters and exits the polygon
      newP1 = { x: intersections[0].x, y: intersections[0].y };
      newP2 = { x: intersections[intersections.length - 1].x, y: intersections[intersections.length - 1].y };
      console.log(`[BEAM_CLIP] Both endpoints outside - using intersection segment`);
    } else {
      // Only one intersection - beam barely touches polygon, effectively outside
      console.log(`[BEAM_CLIP] Both endpoints outside with <2 intersections - beam is outside`);
      return { p1: beam.p1, p2: beam.p1, lengthFt: 0, removed: true };
    }
  } else if (!p1Inside) {
    // p1 is outside, p2 is inside - clip p1 to the closest intersection
    // Find intersection with t closest to 0 but <= t value of p2 (which is 1)
    const validIntersections = intersections.filter(i => i.t <= 1 + TOLERANCE/beamLength);
    if (validIntersections.length > 0) {
      const closest = validIntersections[0]; // First one (closest to p1)
      newP1 = { x: closest.x, y: closest.y };
      console.log(`[BEAM_CLIP] Clipped p1 to (${newP1.x.toFixed(1)}, ${newP1.y.toFixed(1)})`);
    }
  } else if (!p2Inside) {
    // p2 is outside, p1 is inside - clip p2 to the closest intersection
    // Find intersection with t closest to 1 but >= t value of p1 (which is 0)
    const validIntersections = intersections.filter(i => i.t >= -TOLERANCE/beamLength);
    if (validIntersections.length > 0) {
      const closest = validIntersections[validIntersections.length - 1]; // Last one (closest to p2)
      newP2 = { x: closest.x, y: closest.y };
      console.log(`[BEAM_CLIP] Clipped p2 to (${newP2.x.toFixed(1)}, ${newP2.y.toFixed(1)})`);
    }
  }

  // Calculate new length
  const newLength = Math.sqrt((newP2.x - newP1.x) ** 2 + (newP2.y - newP1.y) ** 2) / PIXELS_PER_FOOT;

  // If the clipped beam is too short, mark for removal
  if (newLength < 0.1) {
    console.log(`[BEAM_CLIP] Clipped beam too short (${newLength.toFixed(2)} ft) - marking for removal`);
    return { p1: newP1, p2: newP2, lengthFt: 0, removed: true };
  }

  return {
    p1: { x: newP1.x, y: newP1.y },
    p2: { x: newP2.x, y: newP2.y },
    lengthFt: newLength
  };
}

/**
 * Checks if a point is inside a polygon using ray casting algorithm
 * @param {Object} point - Point {x, y}
 * @param {Array<{x: number, y: number}>} polygon - Array of polygon vertices
 * @returns {boolean} True if point is inside polygon
 */
function isPointInsidePolygon(point, polygon) {
  if (!polygon || polygon.length < 3) return false;

  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    // Check if point is on the edge (with small tolerance)
    const onEdge = isPointOnSegment(point, polygon[i], polygon[j], 2);
    if (onEdge) return true;

    // Ray casting
    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Extends ledger wall if two ledgers are connected
 * @param {Object} ledger1 - First ledger object
 * @param {Object} ledger2 - Second ledger object
 * @returns {Object} Extended ledger object
 */
function extendLedger(ledger1, ledger2) {
  if (!ledger1 || !ledger2) {
    return ledger1 || ledger2;
  }
  
  console.log('Extending ledger:', { 
    ledger1Length: ledger1.lengthFeet, 
    ledger2Length: ledger2.lengthFeet,
    ledger1Points: ledger1.p1 && ledger1.p2 ? `(${ledger1.p1.x},${ledger1.p1.y}) to (${ledger1.p2.x},${ledger1.p2.y})` : 'N/A',
    ledger2Points: ledger2.p1 && ledger2.p2 ? `(${ledger2.p1.x},${ledger2.p1.y}) to (${ledger2.p2.x},${ledger2.p2.y})` : 'N/A'
  });
  
  // Check if ledgers are collinear and connected
  const areCollinear = areLedgersCollinear(ledger1, ledger2);
  console.log(`Ledgers are ${areCollinear ? 'collinear' : 'not collinear'}`);
  
  if (areCollinear) {
    // Combine the ledgers by extending the length and updating endpoints
    const combinedLedger = combineLedgers(ledger1, ledger2);
    console.log('✓ Combined collinear ledger length:', combinedLedger.lengthFeet, 'feet');
    return combinedLedger;
  } else {
    // For non-collinear ledgers (like in L-shaped decks), add the lengths together
    // This ensures the total ledger length is used for fastener calculations
    console.log('✓ Ledgers not collinear, combining lengths for L-shaped deck');
    const combinedLength = ledger1.lengthFeet + ledger2.lengthFeet;
    
    // Create a virtual combined ledger that preserves the total length for BOM calculations
    // Use the first ledger as the template but update the length
    const combinedLedger = {
      ...ledger1,
      lengthFeet: combinedLength,
      // Mark as combined from multiple non-collinear sections for debugging
      isCombined: true,
      isLShapedCombination: true,
      combinedFromCount: 2,
      originalLengths: [ledger1.lengthFeet, ledger2.lengthFeet]
    };
    
    console.log('✓ Combined L-shaped ledger total length:', combinedLedger.lengthFeet, 'feet');
    console.log(`   This should result in ${Math.max(4, Math.ceil(combinedLedger.lengthFeet * 12 / 16) * 2)} GRK fasteners`);
    return combinedLedger;
  }
}

/**
 * Checks if two ledgers are collinear (on the same line)
 * @param {Object} ledger1 - First ledger object
 * @param {Object} ledger2 - Second ledger object
 * @returns {boolean} True if ledgers are collinear
 */
function areLedgersCollinear(ledger1, ledger2) {
  if (!ledger1.p1 || !ledger1.p2 || !ledger2.p1 || !ledger2.p2) {
    return false;
  }
  
  // Check if the ledgers are on the same line using cross product
  const crossProduct1 = (ledger2.p1.x - ledger1.p1.x) * (ledger1.p2.y - ledger1.p1.y) - 
                       (ledger2.p1.y - ledger1.p1.y) * (ledger1.p2.x - ledger1.p1.x);
  const crossProduct2 = (ledger2.p2.x - ledger1.p1.x) * (ledger1.p2.y - ledger1.p1.y) - 
                       (ledger2.p2.y - ledger1.p1.y) * (ledger1.p2.x - ledger1.p1.x);
  
  // If both cross products are close to zero, the ledgers are collinear
  return Math.abs(crossProduct1) < EPSILON && Math.abs(crossProduct2) < EPSILON;
}

/**
 * Combines two collinear ledgers into a single extended ledger
 * @param {Object} ledger1 - First ledger object
 * @param {Object} ledger2 - Second ledger object
 * @returns {Object} Combined ledger object
 */
function combineLedgers(ledger1, ledger2) {
  // Find the extent of both ledgers to create the combined ledger
  const allPoints = [ledger1.p1, ledger1.p2, ledger2.p1, ledger2.p2];
  
  // Determine if ledgers are primarily horizontal or vertical
  const isHorizontal = Math.abs(ledger1.p2.x - ledger1.p1.x) > Math.abs(ledger1.p2.y - ledger1.p1.y);
  
  let minPoint, maxPoint;
  
  if (isHorizontal) {
    // For horizontal ledgers, find min and max X coordinates
    minPoint = allPoints.reduce((min, p) => p.x < min.x ? p : min);
    maxPoint = allPoints.reduce((max, p) => p.x > max.x ? p : max);
  } else {
    // For vertical ledgers, find min and max Y coordinates
    minPoint = allPoints.reduce((min, p) => p.y < min.y ? p : min);
    maxPoint = allPoints.reduce((max, p) => p.y > max.y ? p : max);
  }
  
  // Calculate the combined length
  const combinedLengthPixels = isHorizontal ? 
    Math.abs(maxPoint.x - minPoint.x) : 
    Math.abs(maxPoint.y - minPoint.y);
  
  const combinedLengthFeet = combinedLengthPixels / 24; // Convert pixels to feet
  
  // Create the combined ledger using the first ledger as template
  return {
    ...ledger1,
    p1: minPoint,
    p2: maxPoint,
    lengthFeet: combinedLengthFeet,
    // Mark as combined for debugging
    isCombined: true,
    combinedFromCount: 2
  };
}

/**
 * Removes duplicate posts at the same location
 * @param {Array<Object>} posts - Array of post objects
 * @returns {Array<Object>} Deduplicated posts array
 */
function removeDuplicatePosts(posts) {
  if (!posts || posts.length === 0) return [];
  
  const uniquePosts = [];
  const locations = new Set();
  
  posts.forEach(post => {
    const locationKey = `${Math.round(post.x)}_${Math.round(post.y)}`;
    if (!locations.has(locationKey)) {
      locations.add(locationKey);
      uniquePosts.push(post);
    }
  });
  
  console.log(`Removed ${posts.length - uniquePosts.length} duplicate posts`);
  return uniquePosts;
}

/**
 * Removes duplicate footings at the same location
 * @param {Array<Object>} footings - Array of footing objects
 * @returns {Array<Object>} Deduplicated footings array
 */
function removeDuplicateFootings(footings) {
  if (!footings || footings.length === 0) return [];
  
  const uniqueFootings = [];
  const locations = new Set();
  
  footings.forEach(footing => {
    const locationKey = `${Math.round(footing.x)}_${Math.round(footing.y)}`;
    if (!locations.has(locationKey)) {
      locations.add(locationKey);
      uniqueFootings.push(footing);
    }
  });
  
  console.log(`Removed ${footings.length - uniqueFootings.length} duplicate footings`);
  return uniqueFootings;
}

/**
 * Merges collinear joists and clips to deck boundary
 * @param {Array<Object>} joists - Array of joist objects
 * @param {Array<{x: number, y: number}>} originalPoints - Deck polygon for boundary clipping
 * @returns {Array<Object>} Merged joists array
 */
function mergeCollinearJoists(joists, originalPoints = null) {
  if (!joists || joists.length === 0) return [];

  // Clip joists to deck boundary if originalPoints provided
  if (originalPoints && originalPoints.length >= 3) {
    const clippedJoists = [];
    for (const joist of joists) {
      if (!joist.p1 || !joist.p2) {
        clippedJoists.push(joist);
        continue;
      }

      const clipped = clipJoistToBoundary(joist, originalPoints);
      if (clipped && clipped.lengthFeet > 0.1) { // Only keep joists > 0.1 feet
        clippedJoists.push(clipped);
      }
    }
    console.log(`[JOIST_CLIP] Clipped ${joists.length} joists to ${clippedJoists.length} joists`);
    return clippedJoists;
  }

  return joists;
}

/**
 * Clips a joist to stay within the deck boundary
 * @param {Object} joist - Joist object with p1, p2 endpoints
 * @param {Array<{x: number, y: number}>} shapePoints - Deck polygon points
 * @returns {Object|null} Clipped joist or null if entirely outside
 */
function clipJoistToBoundary(joist, shapePoints) {
  if (!joist.p1 || !joist.p2 || !shapePoints || shapePoints.length < 3) return joist;

  const TOLERANCE = 2;

  // Check if endpoints are inside polygon
  const p1Inside = isPointInsidePolygon(joist.p1, shapePoints);
  const p2Inside = isPointInsidePolygon(joist.p2, shapePoints);

  // If both inside, no clipping needed
  if (p1Inside && p2Inside) return joist;

  // Find ALL intersections with polygon edges
  const intersections = [];
  const numEdges = shapePoints.length;

  for (let i = 0; i < numEdges; i++) {
    const edgeP1 = shapePoints[i];
    const edgeP2 = shapePoints[(i + 1) % numEdges];

    const inter = lineIntersection(joist.p1, joist.p2, edgeP1, edgeP2);
    if (inter && isPointOnSegment(inter, edgeP1, edgeP2, TOLERANCE)) {
      intersections.push({ ...inter, edgeIndex: i });
    }
  }

  // If both endpoints outside and no intersections, joist is entirely outside
  if (!p1Inside && !p2Inside && intersections.length === 0) {
    return null; // Mark for removal
  }

  if (intersections.length === 0) return joist;

  // Sort intersections by parametric position along the joist line
  const joistDx = joist.p2.x - joist.p1.x;
  const joistDy = joist.p2.y - joist.p1.y;
  const joistLength = Math.sqrt(joistDx * joistDx + joistDy * joistDy);

  if (joistLength < TOLERANCE) return null;

  intersections.forEach(inter => {
    inter.t = ((inter.x - joist.p1.x) * joistDx + (inter.y - joist.p1.y) * joistDy) / (joistLength * joistLength);
  });

  intersections.sort((a, b) => a.t - b.t);

  let newP1 = joist.p1;
  let newP2 = joist.p2;

  if (!p1Inside && !p2Inside) {
    // Both endpoints outside - find the segment of the joist that's inside the polygon
    if (intersections.length >= 2) {
      // Use the first and last intersections to define the inside segment
      newP1 = { x: intersections[0].x, y: intersections[0].y };
      newP2 = { x: intersections[intersections.length - 1].x, y: intersections[intersections.length - 1].y };
    } else {
      // Only one intersection - joist barely touches polygon, remove it
      return null;
    }
  } else if (!p1Inside) {
    // p1 is outside, p2 is inside - clip p1 to the first valid intersection
    const validIntersections = intersections.filter(i => i.t <= 1 + TOLERANCE/joistLength);
    if (validIntersections.length > 0) {
      newP1 = { x: validIntersections[0].x, y: validIntersections[0].y };
    }
  } else if (!p2Inside) {
    // p2 is outside, p1 is inside - clip p2 to the last valid intersection
    const validIntersections = intersections.filter(i => i.t >= -TOLERANCE/joistLength);
    if (validIntersections.length > 0) {
      newP2 = { x: validIntersections[validIntersections.length - 1].x, y: validIntersections[validIntersections.length - 1].y };
    }
  }

  const newLength = Math.sqrt((newP2.x - newP1.x) ** 2 + (newP2.y - newP1.y) ** 2) / PIXELS_PER_FOOT;

  // If the clipped joist is too short, remove it
  if (newLength < 0.1) {
    return null;
  }

  return {
    ...joist,
    p1: { x: newP1.x, y: newP1.y },
    p2: { x: newP2.x, y: newP2.y },
    lengthFeet: newLength
  };
}

/**
 * Merges collinear rim joists and clips to deck boundary
 * @param {Array<Object>} rimJoists - Array of rim joist objects
 * @param {Array<{x: number, y: number}>} originalPoints - Deck polygon for boundary clipping
 * @returns {Array<Object>} Merged rim joists array
 */
function mergeCollinearRimJoists(rimJoists, originalPoints = null) {
  if (!rimJoists || rimJoists.length === 0) return [];

  console.log(`[RIM_MERGE] Processing ${rimJoists.length} rim joists`);

  // Group rim joists by their approximate line (collinear rim joists)
  const processed = new Set();
  const mergedRimJoists = [];

  for (let i = 0; i < rimJoists.length; i++) {
    if (processed.has(i)) continue;

    const rim1 = rimJoists[i];
    if (!rim1.p1 || !rim1.p2) {
      mergedRimJoists.push(rim1);
      processed.add(i);
      continue;
    }

    const mergeGroup = [rim1];
    processed.add(i);

    // Find all rim joists that are collinear with this one
    for (let j = i + 1; j < rimJoists.length; j++) {
      if (processed.has(j)) continue;

      const rim2 = rimJoists[j];
      if (!rim2.p1 || !rim2.p2) continue;

      if (areRimJoistsCollinear(rim1, rim2) && areRimJoistsAdjacent(rim1, rim2)) {
        mergeGroup.push(rim2);
        processed.add(j);
      }
    }

    // Merge the group
    if (mergeGroup.length > 1) {
      const merged = mergeRimJoistGroup(mergeGroup);
      mergedRimJoists.push(merged);
      console.log(`[RIM_MERGE] Merged ${mergeGroup.length} rim joists into one`);
    } else {
      mergedRimJoists.push(rim1);
    }
  }

  // Clip rim joists to deck boundary if originalPoints provided
  if (originalPoints && originalPoints.length >= 3) {
    const clippedRimJoists = [];
    for (const rim of mergedRimJoists) {
      const clipped = clipRimJoistToBoundary(rim, originalPoints);
      if (clipped && clipped.lengthFeet > 0.1) { // Only keep rim joists > 0.1 feet
        clippedRimJoists.push(clipped);
      }
    }
    console.log(`[RIM_MERGE] After clipping: ${clippedRimJoists.length} rim joists`);
    return clippedRimJoists;
  }

  return mergedRimJoists;
}

/**
 * Checks if two rim joists are collinear
 */
function areRimJoistsCollinear(rim1, rim2) {
  const TOLERANCE = PIXELS_PER_FOOT * 0.5; // 0.5 foot tolerance

  // Determine orientation of rim1
  const rim1IsHorizontal = Math.abs(rim1.p2.y - rim1.p1.y) < TOLERANCE;
  const rim1IsVertical = Math.abs(rim1.p2.x - rim1.p1.x) < TOLERANCE;

  // Determine orientation of rim2
  const rim2IsHorizontal = Math.abs(rim2.p2.y - rim2.p1.y) < TOLERANCE;
  const rim2IsVertical = Math.abs(rim2.p2.x - rim2.p1.x) < TOLERANCE;

  // Must have same orientation
  if (rim1IsHorizontal !== rim2IsHorizontal) return false;
  if (rim1IsVertical !== rim2IsVertical) return false;

  // Check if on same line
  if (rim1IsHorizontal) {
    const avgY1 = (rim1.p1.y + rim1.p2.y) / 2;
    const avgY2 = (rim2.p1.y + rim2.p2.y) / 2;
    return Math.abs(avgY1 - avgY2) < TOLERANCE;
  }

  if (rim1IsVertical) {
    const avgX1 = (rim1.p1.x + rim1.p2.x) / 2;
    const avgX2 = (rim2.p1.x + rim2.p2.x) / 2;
    return Math.abs(avgX1 - avgX2) < TOLERANCE;
  }

  return false;
}

/**
 * Checks if two rim joists are adjacent (touching or overlapping)
 */
function areRimJoistsAdjacent(rim1, rim2) {
  const TOLERANCE = PIXELS_PER_FOOT * 2; // 2 feet tolerance

  // Check if any endpoints are close
  const distances = [
    Math.sqrt((rim1.p1.x - rim2.p1.x) ** 2 + (rim1.p1.y - rim2.p1.y) ** 2),
    Math.sqrt((rim1.p1.x - rim2.p2.x) ** 2 + (rim1.p1.y - rim2.p2.y) ** 2),
    Math.sqrt((rim1.p2.x - rim2.p1.x) ** 2 + (rim1.p2.y - rim2.p1.y) ** 2),
    Math.sqrt((rim1.p2.x - rim2.p2.x) ** 2 + (rim1.p2.y - rim2.p2.y) ** 2)
  ];

  return Math.min(...distances) < TOLERANCE;
}

/**
 * Merges a group of collinear rim joists
 */
function mergeRimJoistGroup(rimGroup) {
  if (rimGroup.length === 1) return rimGroup[0];

  // Find extent of all rim joists
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  rimGroup.forEach(rim => {
    minX = Math.min(minX, rim.p1.x, rim.p2.x);
    maxX = Math.max(maxX, rim.p1.x, rim.p2.x);
    minY = Math.min(minY, rim.p1.y, rim.p2.y);
    maxY = Math.max(maxY, rim.p1.y, rim.p2.y);
  });

  const template = rimGroup[0];
  const isHorizontal = (maxX - minX) > (maxY - minY);

  let merged;
  if (isHorizontal) {
    const avgY = rimGroup.reduce((sum, rim) => sum + (rim.p1.y + rim.p2.y) / 2, 0) / rimGroup.length;
    merged = {
      ...template,
      p1: { x: minX, y: avgY },
      p2: { x: maxX, y: avgY },
      lengthFeet: (maxX - minX) / PIXELS_PER_FOOT
    };
  } else {
    const avgX = rimGroup.reduce((sum, rim) => sum + (rim.p1.x + rim.p2.x) / 2, 0) / rimGroup.length;
    merged = {
      ...template,
      p1: { x: avgX, y: minY },
      p2: { x: avgX, y: maxY },
      lengthFeet: (maxY - minY) / PIXELS_PER_FOOT
    };
  }

  merged.isMerged = true;
  merged.mergedFromCount = rimGroup.length;

  return merged;
}

/**
 * Checks if a rim joist lies on an actual polygon perimeter edge
 * This prevents rim joists from spanning across concave areas (like U-shapes)
 * @param {Object} rim - Rim joist with p1, p2 points
 * @param {Array} shapePoints - Polygon vertices
 * @param {number} tolerance - Distance tolerance in pixels
 * @returns {boolean} True if rim lies on a perimeter edge
 */
function isRimOnPerimeterEdge(rim, shapePoints, tolerance = PIXELS_PER_FOOT * 0.5) {
  if (!rim.p1 || !rim.p2 || !shapePoints || shapePoints.length < 3) return false;

  const rimMidX = (rim.p1.x + rim.p2.x) / 2;
  const rimMidY = (rim.p1.y + rim.p2.y) / 2;
  const rimMid = { x: rimMidX, y: rimMidY };

  // Check if the rim's midpoint is near any perimeter edge
  for (let i = 0; i < shapePoints.length; i++) {
    const edgeP1 = shapePoints[i];
    const edgeP2 = shapePoints[(i + 1) % shapePoints.length];

    // Calculate distance from rim midpoint to this edge
    const dist = pointToSegmentDistanceLocal(rimMid, edgeP1, edgeP2);
    if (dist <= tolerance) {
      // Also verify the rim direction is parallel to the edge direction
      const rimDx = rim.p2.x - rim.p1.x;
      const rimDy = rim.p2.y - rim.p1.y;
      const edgeDx = edgeP2.x - edgeP1.x;
      const edgeDy = edgeP2.y - edgeP1.y;

      // Calculate cross product to check parallelism
      const rimLen = Math.sqrt(rimDx * rimDx + rimDy * rimDy) || 1;
      const edgeLen = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy) || 1;
      const cross = Math.abs((rimDx / rimLen) * (edgeDy / edgeLen) - (rimDy / rimLen) * (edgeDx / edgeLen));

      // If nearly parallel (cross product near 0), this is a valid perimeter rim
      if (cross < 0.2) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calculate distance from point to line segment (local helper)
 */
function pointToSegmentDistanceLocal(point, segP1, segP2) {
  const dx = segP2.x - segP1.x;
  const dy = segP2.y - segP1.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.sqrt((point.x - segP1.x) ** 2 + (point.y - segP1.y) ** 2);
  }

  let t = ((point.x - segP1.x) * dx + (point.y - segP1.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = segP1.x + t * dx;
  const closestY = segP1.y + t * dy;

  return Math.sqrt((point.x - closestX) ** 2 + (point.y - closestY) ** 2);
}

/**
 * Clips a rim joist to stay within the deck boundary
 * @returns {Object|null} Clipped rim joist or null if entirely outside
 */
function clipRimJoistToBoundary(rim, shapePoints) {
  if (!rim.p1 || !rim.p2 || !shapePoints || shapePoints.length < 3) return rim;

  const TOLERANCE = 2;

  // FIRST: Check if rim lies on an actual perimeter edge (critical for U-shapes)
  // This prevents rim joists from spanning across concave areas
  if (!isRimOnPerimeterEdge(rim, shapePoints)) {
    console.log(`[RIM_CLIP] Rejecting rim joist not on perimeter edge: ` +
      `(${rim.p1.x.toFixed(0)}, ${rim.p1.y.toFixed(0)}) to (${rim.p2.x.toFixed(0)}, ${rim.p2.y.toFixed(0)})`);
    return null;
  }

  // Check if endpoints are inside polygon
  const p1Inside = isPointInsidePolygon(rim.p1, shapePoints);
  const p2Inside = isPointInsidePolygon(rim.p2, shapePoints);

  // If both inside, no clipping needed
  if (p1Inside && p2Inside) return rim;

  // Find ALL intersections with polygon edges
  const intersections = [];
  const numEdges = shapePoints.length;

  for (let i = 0; i < numEdges; i++) {
    const edgeP1 = shapePoints[i];
    const edgeP2 = shapePoints[(i + 1) % numEdges];

    const inter = lineIntersection(rim.p1, rim.p2, edgeP1, edgeP2);
    if (inter && isPointOnSegment(inter, edgeP1, edgeP2, TOLERANCE)) {
      intersections.push({ ...inter, edgeIndex: i });
    }
  }

  // If both endpoints outside and no intersections, rim is entirely outside
  if (!p1Inside && !p2Inside && intersections.length === 0) {
    return null; // Mark for removal
  }

  if (intersections.length === 0) return rim;

  // Sort intersections by parametric position along the rim line
  const rimDx = rim.p2.x - rim.p1.x;
  const rimDy = rim.p2.y - rim.p1.y;
  const rimLength = Math.sqrt(rimDx * rimDx + rimDy * rimDy);

  if (rimLength < TOLERANCE) return null;

  intersections.forEach(inter => {
    inter.t = ((inter.x - rim.p1.x) * rimDx + (inter.y - rim.p1.y) * rimDy) / (rimLength * rimLength);
  });

  intersections.sort((a, b) => a.t - b.t);

  let newP1 = rim.p1;
  let newP2 = rim.p2;

  if (!p1Inside && !p2Inside) {
    // Both endpoints outside - find the segment inside the polygon
    if (intersections.length >= 2) {
      newP1 = { x: intersections[0].x, y: intersections[0].y };
      newP2 = { x: intersections[intersections.length - 1].x, y: intersections[intersections.length - 1].y };
    } else {
      return null;
    }
  } else if (!p1Inside) {
    const validIntersections = intersections.filter(i => i.t <= 1 + TOLERANCE/rimLength);
    if (validIntersections.length > 0) {
      newP1 = { x: validIntersections[0].x, y: validIntersections[0].y };
    }
  } else if (!p2Inside) {
    const validIntersections = intersections.filter(i => i.t >= -TOLERANCE/rimLength);
    if (validIntersections.length > 0) {
      newP2 = { x: validIntersections[validIntersections.length - 1].x, y: validIntersections[validIntersections.length - 1].y };
    }
  }

  const newLength = Math.sqrt((newP2.x - newP1.x) ** 2 + (newP2.y - newP1.y) ** 2) / PIXELS_PER_FOOT;

  // If the clipped rim joist is too short, remove it
  if (newLength < 0.1) {
    return null;
  }

  return {
    ...rim,
    p1: { x: newP1.x, y: newP1.y },
    p2: { x: newP2.x, y: newP2.y },
    lengthFeet: newLength
  };
}

/**
 * Validates if shape has only one rectangular section (simple rectangle)
 * @param {Array<Object>} rectangularSections - Array of decomposed sections
 * @returns {boolean} True if shape is a simple rectangle
 */
export function isSimpleRectangle(rectangularSections) {
  return rectangularSections && rectangularSections.length === 1;
}

/**
 * Recalculates posts and footings for merged beams
 * @param {Array} beams - Array of merged beam objects
 * @param {string} postSize - Size of posts
 * @param {number} deckHeightInches - Deck height in inches
 * @param {string} footingType - Type of footings
 * @returns {Object} Object containing recalculated posts and footings
 */
function recalculatePostsForMergedBeams(beams, postSize, deckHeightInches, footingType) {
  const newPosts = [];
  const newFootings = [];
  
  beams.forEach(beam => {
    // Calculate posts for this beam
    const beamPosts = calculatePostsForBeam(
      beam,
      postSize,
      deckHeightInches
    );
    
    // Add posts with section info if available
    beamPosts.forEach(post => {
      if (beam.sectionId) {
        post.sectionId = beam.sectionId;
      }
      newPosts.push(post);
    });
    
    // Create footings for each post
    beamPosts.forEach(post => {
      const footing = {
        position: { x: post.x, y: post.y },
        type: footingType
      };
      if (beam.sectionId) {
        footing.sectionId = beam.sectionId;
      }
      newFootings.push(footing);
    });
  });
  
  return {
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
  
  // Use centerline points if available, otherwise fall back to p1/p2
  const beamP1 = beam.centerlineP1 || beam.p1;
  const beamP2 = beam.centerlineP2 || beam.p2;
  
  const beamLengthPixels = Math.sqrt(
    Math.pow(beamP2.x - beamP1.x, 2) + 
    Math.pow(beamP2.y - beamP1.y, 2)
  );
  
  if (beamLengthPixels < EPSILON) {
    return beamPosts;
  }
  
  const beamDx = beamP2.x - beamP1.x;
  const beamDy = beamP2.y - beamP1.y;
  const unitVecX = beamDx / beamLengthPixels;
  const unitVecY = beamDy / beamLengthPixels;
  const postInsetPixels = POST_INSET_FEET * PIXELS_PER_FOOT;
  
  // For very short beams, place a single post in the center
  if (beamLengthPixels < postInsetPixels * 2) {
    beamPosts.push({
      x: beamP1.x + unitVecX * (beamLengthPixels / 2),
      y: beamP1.y + unitVecY * (beamLengthPixels / 2),
      size: postSize,
      heightFeet: deckHeightInches / 12,
      position: {
        x: beamP1.x + unitVecX * (beamLengthPixels / 2),
        y: beamP1.y + unitVecY * (beamLengthPixels / 2)
      }
    });
    return beamPosts;
  }
  
  // Place posts at standard inset from ends
  const post1 = {
    x: beamP1.x + unitVecX * postInsetPixels,
    y: beamP1.y + unitVecY * postInsetPixels,
    size: postSize,
    heightFeet: deckHeightInches / 12
  };
  post1.position = { x: post1.x, y: post1.y };
  
  const post2 = {
    x: beamP2.x - unitVecX * postInsetPixels,
    y: beamP2.y - unitVecY * postInsetPixels,
    size: postSize,
    heightFeet: deckHeightInches / 12
  };
  post2.position = { x: post2.x, y: post2.y };
  
  beamPosts.push(post1, post2);
  
  // Check if we need intermediate posts
  const postSpanPixels = Math.sqrt(
    Math.pow(post2.x - post1.x, 2) + 
    Math.pow(post2.y - post1.y, 2)
  );
  
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
 * Finds the outer beam that should be trimmed against a diagonal beam
 * @param {Array} beams - Array of all beam objects
 * @param {Object} diagEdge - The diagonal edge object with p1 and p2
 * @param {boolean} isMainLedgerHorizontal - Whether the main ledger is horizontal
 * @returns {Object|null} The outer beam to trim, or null if not found
 */
function findOuterBeamForDiagonalTrim(beams, diagEdge, isMainLedgerHorizontal) {
  if (!beams || beams.length === 0) return null;

  // The outer beam runs perpendicular to the ledger direction
  // If ledger is horizontal, outer beam is vertical (runs in Y direction)
  // If ledger is vertical, outer beam is horizontal (runs in X direction)

  // Find all outer beams (beams that run perpendicular to ledger)
  const outerBeams = beams.filter(beam => {
    if (!beam.p1 || !beam.p2) return false;

    const beamDx = Math.abs(beam.p2.x - beam.p1.x);
    const beamDy = Math.abs(beam.p2.y - beam.p1.y);
    const isBeamHorizontal = beamDx > beamDy;

    // Outer beam should be perpendicular to ledger
    // If ledger is horizontal, outer beam should be vertical (not horizontal)
    return isMainLedgerHorizontal ? !isBeamHorizontal : isBeamHorizontal;
  });

  if (outerBeams.length === 0) {
    console.log(`[findOuterBeamForDiagonalTrim] No perpendicular beams found`);
    return null;
  }

  // Find the outer beam that is closest to the diagonal edge's corner
  // The diagonal edge connects to the deck at one of its endpoints
  const diagMidX = (diagEdge.p1.x + diagEdge.p2.x) / 2;
  const diagMidY = (diagEdge.p1.y + diagEdge.p2.y) / 2;

  let closestBeam = null;
  let closestDistance = Infinity;

  for (const beam of outerBeams) {
    const beamP1 = beam.centerlineP1 || beam.p1;
    const beamP2 = beam.centerlineP2 || beam.p2;

    // Calculate distance from diagonal edge midpoint to beam centerline
    const dist = pointToLineDistance(diagMidX, diagMidY, beamP1.x, beamP1.y, beamP2.x, beamP2.y);

    if (dist < closestDistance) {
      closestDistance = dist;
      closestBeam = beam;
    }
  }

  console.log(`[findOuterBeamForDiagonalTrim] Found closest beam at distance ${(closestDistance / PIXELS_PER_FOOT).toFixed(2)} feet`);
  return closestBeam;
}

/**
 * Calculates the perpendicular distance from a point to a line segment
 * @param {number} px - Point x coordinate
 * @param {number} py - Point y coordinate
 * @param {number} x1 - Line start x
 * @param {number} y1 - Line start y
 * @param {number} x2 - Line end x
 * @param {number} y2 - Line end y
 * @returns {number} Distance from point to line
 */
function pointToLineDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lineLengthSq = dx * dx + dy * dy;

  if (lineLengthSq < EPSILON) {
    // Line is a point
    return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  }

  // Project point onto line
  let t = ((px - x1) * dx + (py - y1) * dy) / lineLengthSq;
  t = Math.max(0, Math.min(1, t)); // Clamp to segment

  const nearestX = x1 + t * dx;
  const nearestY = y1 + t * dy;

  return Math.sqrt((px - nearestX) ** 2 + (py - nearestY) ** 2);
}

/**
 * Finds all posts that are associated with a specific beam
 * @param {Array} posts - Array of all post objects
 * @param {Object} beam - The beam to find posts for
 * @returns {Array} Array of posts associated with this beam
 */
function findPostsForBeam(posts, beam) {
  if (!posts || posts.length === 0 || !beam) return [];

  const beamP1 = beam.centerlineP1 || beam.p1;
  const beamP2 = beam.centerlineP2 || beam.p2;

  // Find posts that are close to this beam's centerline
  const TOLERANCE = 2.0 * PIXELS_PER_FOOT; // 2 feet tolerance

  return posts.filter(post => {
    const postX = post.x || post.position?.x;
    const postY = post.y || post.position?.y;

    if (postX === undefined || postY === undefined) return false;

    const dist = pointToLineDistance(postX, postY, beamP1.x, beamP1.y, beamP2.x, beamP2.y);
    return dist < TOLERANCE;
  });
}

/**
 * Finds all footings that are associated with a specific beam
 * @param {Array} footings - Array of all footing objects
 * @param {Object} beam - The beam to find footings for
 * @returns {Array} Array of footings associated with this beam
 */
function findFootingsForBeam(footings, beam) {
  if (!footings || footings.length === 0 || !beam) return [];

  const beamP1 = beam.centerlineP1 || beam.p1;
  const beamP2 = beam.centerlineP2 || beam.p2;

  // Find footings that are close to this beam's centerline
  const TOLERANCE = 2.0 * PIXELS_PER_FOOT; // 2 feet tolerance

  return footings.filter(footing => {
    const footingX = footing.x || footing.position?.x;
    const footingY = footing.y || footing.position?.y;

    if (footingX === undefined || footingY === undefined) return false;

    const dist = pointToLineDistance(footingX, footingY, beamP1.x, beamP1.y, beamP2.x, beamP2.y);
    return dist < TOLERANCE;
  });
}

/**
 * Removes posts associated with a specific beam from the posts array
 * @param {Array} posts - Array of all post objects (modified in place)
 * @param {Object} beam - The beam whose posts should be removed
 */
function removePostsForBeam(posts, beam) {
  if (!posts || posts.length === 0 || !beam) return;

  const beamPosts = findPostsForBeam(posts, beam);

  // Remove each beam post from the array
  for (const beamPost of beamPosts) {
    const index = posts.indexOf(beamPost);
    if (index !== -1) {
      posts.splice(index, 1);
    }
  }

  console.log(`[removePostsForBeam] Removed ${beamPosts.length} posts for beam`);
}

/**
 * Removes footings associated with a specific beam from the footings array
 * @param {Array} footings - Array of all footing objects (modified in place)
 * @param {Object} beam - The beam whose footings should be removed
 */
function removeFootingsForBeam(footings, beam) {
  if (!footings || footings.length === 0 || !beam) return;

  const beamFootings = findFootingsForBeam(footings, beam);

  // Remove each beam footing from the array
  for (const beamFooting of beamFootings) {
    const index = footings.indexOf(beamFooting);
    if (index !== -1) {
      footings.splice(index, 1);
    }
  }

  console.log(`[removeFootingsForBeam] Removed ${beamFootings.length} footings for beam`);
}

/**
 * Trims rim joists at their intersection with a diagonal edge
 * This prevents rim joists from extending past the deck's actual boundary
 * @param {Array} rimJoists - Array of rim joist objects
 * @param {Object} diagEdge - Diagonal edge with p1 and p2 properties
 * @returns {Array} Modified rim joists array with trimmed rim joists
 */
function trimRimJoistsAtDiagonalEdge(rimJoists, diagEdge, deckCenter) {
  if (!rimJoists || rimJoists.length === 0 || !diagEdge) return rimJoists;

  const TOLERANCE = 2; // pixels

  // Helper function: calculate signed distance from point to line (positive = one side, negative = other)
  // Returns positive if point is on the same side as deckCenter, negative otherwise
  function getSignedDistanceFromLine(point, lineP1, lineP2) {
    // Cross product of (lineP2 - lineP1) and (point - lineP1)
    return (lineP2.x - lineP1.x) * (point.y - lineP1.y) -
           (lineP2.y - lineP1.y) * (point.x - lineP1.x);
  }

  // Determine which side of the diagonal line is "inside" the deck (toward deck center)
  const centerSignedDist = getSignedDistanceFromLine(deckCenter, diagEdge.p1, diagEdge.p2);
  const insideSign = centerSignedDist >= 0 ? 1 : -1;

  console.log(`[TRIM RIM] Deck center at (${deckCenter.x.toFixed(1)}, ${deckCenter.y.toFixed(1)}), insideSign: ${insideSign}`);

  return rimJoists.map(rimJoist => {
    // Skip diagonal rim joists (don't trim them)
    if (rimJoist.isDiagonal) return rimJoist;

    // Check if this rim joist is axis-aligned (horizontal or vertical)
    const isHorizontal = Math.abs(rimJoist.p1.y - rimJoist.p2.y) < TOLERANCE;
    const isVertical = Math.abs(rimJoist.p1.x - rimJoist.p2.x) < TOLERANCE;

    if (!isHorizontal && !isVertical) return rimJoist; // Not axis-aligned, skip

    // Find intersection point between rim joist LINE (extended) and diagonal edge
    const intersection = lineIntersection(
      rimJoist.p1, rimJoist.p2,
      diagEdge.p1, diagEdge.p2
    );

    if (!intersection) return rimJoist; // No intersection (parallel lines)

    // Check if intersection is within the diagonal edge segment
    const onDiagonal = isPointOnSegment(intersection, diagEdge.p1, diagEdge.p2, TOLERANCE * 2);
    if (!onDiagonal) return rimJoist; // Intersection not on diagonal segment

    // Check which endpoint of the rim joist is "outside" the deck (on opposite side of diagonal from center)
    const p1SignedDist = getSignedDistanceFromLine(rimJoist.p1, diagEdge.p1, diagEdge.p2);
    const p2SignedDist = getSignedDistanceFromLine(rimJoist.p2, diagEdge.p1, diagEdge.p2);

    const p1Inside = (p1SignedDist * insideSign) >= -TOLERANCE;
    const p2Inside = (p2SignedDist * insideSign) >= -TOLERANCE;

    // If both points are inside, no trim needed
    if (p1Inside && p2Inside) return rimJoist;

    // If both are outside, this rim joist is entirely outside - should be removed
    // (but we'll return it unchanged for safety)
    if (!p1Inside && !p2Inside) {
      console.log(`[TRIM RIM] Warning: rim joist entirely outside diagonal edge`);
      return rimJoist;
    }

    console.log(`[TRIM RIM] Trimming rim joist at intersection (${intersection.x.toFixed(1)}, ${intersection.y.toFixed(1)})`);
    console.log(`[TRIM RIM] p1 inside: ${p1Inside}, p2 inside: ${p2Inside}`);

    const newRimJoist = { ...rimJoist };

    // Trim the endpoint that's outside (replace with intersection point)
    if (!p1Inside) {
      newRimJoist.p1 = { ...intersection };
      console.log(`[TRIM RIM] Trimmed p1`);
    } else if (!p2Inside) {
      newRimJoist.p2 = { ...intersection };
      console.log(`[TRIM RIM] Trimmed p2`);
    }

    // Recalculate length
    newRimJoist.lengthFeet = Math.sqrt(
      Math.pow(newRimJoist.p2.x - newRimJoist.p1.x, 2) +
      Math.pow(newRimJoist.p2.y - newRimJoist.p1.y, 2)
    ) / PIXELS_PER_FOOT;

    console.log(`[TRIM RIM] New rim joist length: ${newRimJoist.lengthFeet.toFixed(2)} ft`);

    return newRimJoist;
  });
}

/**
 * Finds the intersection point of two line segments
 * @param {Object} p1 - First line start point {x, y}
 * @param {Object} p2 - First line end point {x, y}
 * @param {Object} p3 - Second line start point {x, y}
 * @param {Object} p4 - Second line end point {x, y}
 * @returns {Object|null} Intersection point {x, y} or null if no intersection
 */
function lineIntersection(p1, p2, p3, p4) {
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;
  const x4 = p4.x, y4 = p4.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  if (Math.abs(denom) < EPSILON) {
    return null; // Lines are parallel
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;

  return {
    x: x1 + t * (x2 - x1),
    y: y1 + t * (y2 - y1)
  };
}

/**
 * Checks if a point lies on a line segment within tolerance
 * @param {Object} point - Point to check {x, y}
 * @param {Object} segStart - Segment start point {x, y}
 * @param {Object} segEnd - Segment end point {x, y}
 * @param {number} tolerance - Distance tolerance
 * @returns {boolean} True if point is on segment
 */
function isPointOnSegment(point, segStart, segEnd, tolerance) {
  const minX = Math.min(segStart.x, segEnd.x) - tolerance;
  const maxX = Math.max(segStart.x, segEnd.x) + tolerance;
  const minY = Math.min(segStart.y, segEnd.y) - tolerance;
  const maxY = Math.max(segStart.y, segEnd.y) + tolerance;

  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

/**
 * Extends a diagonal beam to meet the deck edge (axis-aligned rim joist)
 * @param {Object} beam - Diagonal beam object with p1, p2, etc.
 * @param {Object} dimensions - Overall deck dimensions {minX, maxX, minY, maxY}
 * @param {Object} diagEdge - The diagonal edge this beam is parallel to
 * @param {Object} deckCenter - Deck center point {x, y}
 * @returns {Object} Extended beam with updated p1 or p2 and lengthFeet
 */
function extendDiagonalBeamToEdge(beam, dimensions, diagEdge, deckCenter) {
  if (!beam || !dimensions || !diagEdge) return beam;

  const TOLERANCE = 2; // pixels

  // Calculate beam direction vector
  const beamDx = beam.p2.x - beam.p1.x;
  const beamDy = beam.p2.y - beam.p1.y;
  const beamLength = Math.sqrt(beamDx * beamDx + beamDy * beamDy);

  if (beamLength < TOLERANCE) return beam;

  const beamUnitX = beamDx / beamLength;
  const beamUnitY = beamDy / beamLength;

  // Define the four axis-aligned deck edges
  const deckEdges = [
    { p1: { x: dimensions.minX, y: dimensions.minY }, p2: { x: dimensions.maxX, y: dimensions.minY }, name: 'top' },
    { p1: { x: dimensions.minX, y: dimensions.maxY }, p2: { x: dimensions.maxX, y: dimensions.maxY }, name: 'bottom' },
    { p1: { x: dimensions.minX, y: dimensions.minY }, p2: { x: dimensions.minX, y: dimensions.maxY }, name: 'left' },
    { p1: { x: dimensions.maxX, y: dimensions.minY }, p2: { x: dimensions.maxX, y: dimensions.maxY }, name: 'right' }
  ];

  // Find which beam endpoint is farther from deck center (the "outer" end to extend)
  const distP1ToCenter = Math.sqrt(
    Math.pow(beam.p1.x - deckCenter.x, 2) + Math.pow(beam.p1.y - deckCenter.y, 2)
  );
  const distP2ToCenter = Math.sqrt(
    Math.pow(beam.p2.x - deckCenter.x, 2) + Math.pow(beam.p2.y - deckCenter.y, 2)
  );

  const extendP1 = distP1ToCenter > distP2ToCenter;

  console.log(`[EXTEND BEAM] Extending ${extendP1 ? 'p1' : 'p2'} (farther from center)`);
  console.log(`[EXTEND BEAM] Current beam: (${beam.p1.x.toFixed(1)}, ${beam.p1.y.toFixed(1)}) to (${beam.p2.x.toFixed(1)}, ${beam.p2.y.toFixed(1)})`);

  // Find intersection of beam line (extended) with each deck edge
  let bestIntersection = null;
  let bestDistance = Infinity;

  const pointToExtend = extendP1 ? beam.p1 : beam.p2;
  // Direction to extend is away from center (away from the other point)
  const extensionDirX = extendP1 ? -beamUnitX : beamUnitX;
  const extensionDirY = extendP1 ? -beamUnitY : beamUnitY;

  // Create a far point along the extension direction for intersection testing
  const farPoint = {
    x: pointToExtend.x + extensionDirX * 10000,
    y: pointToExtend.y + extensionDirY * 10000
  };

  for (const edge of deckEdges) {
    const intersection = lineIntersection(pointToExtend, farPoint, edge.p1, edge.p2);

    if (!intersection) continue;

    // Check if intersection is on the deck edge segment
    const onEdge = isPointOnSegment(intersection, edge.p1, edge.p2, TOLERANCE);
    if (!onEdge) continue;

    // Check if the intersection is in the extension direction (not backwards)
    const toIntersectionX = intersection.x - pointToExtend.x;
    const toIntersectionY = intersection.y - pointToExtend.y;
    const dotProduct = toIntersectionX * extensionDirX + toIntersectionY * extensionDirY;

    if (dotProduct < TOLERANCE) continue; // Intersection is behind us

    // Calculate distance to this intersection
    const dist = Math.sqrt(toIntersectionX * toIntersectionX + toIntersectionY * toIntersectionY);

    if (dist < bestDistance) {
      bestDistance = dist;
      bestIntersection = { ...intersection, edgeName: edge.name };
    }
  }

  if (!bestIntersection) {
    console.log(`[EXTEND BEAM] No valid intersection found, returning unchanged`);
    return beam;
  }

  console.log(`[EXTEND BEAM] Found intersection with ${bestIntersection.edgeName} edge at (${bestIntersection.x.toFixed(1)}, ${bestIntersection.y.toFixed(1)})`);

  // Create extended beam
  const extendedBeam = { ...beam };

  if (extendP1) {
    extendedBeam.p1 = { x: bestIntersection.x, y: bestIntersection.y };
  } else {
    extendedBeam.p2 = { x: bestIntersection.x, y: bestIntersection.y };
  }

  // Recalculate length
  extendedBeam.lengthFeet = Math.sqrt(
    Math.pow(extendedBeam.p2.x - extendedBeam.p1.x, 2) +
    Math.pow(extendedBeam.p2.y - extendedBeam.p1.y, 2)
  ) / PIXELS_PER_FOOT;

  console.log(`[EXTEND BEAM] Extended beam length: ${extendedBeam.lengthFeet.toFixed(2)} ft`);

  return extendedBeam;
}