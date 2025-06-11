// multiSectionCalculations.js - Multi-section structural calculations for complex deck shapes
// Handles structural calculations for decomposed shapes by calculating each section independently
// and then merging overlapping/collinear structural elements

import { EPSILON } from "./config.js";
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
    
    // Merge results from all sections
    const mergedStructure = mergeSectionResults(sectionResults);
    
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
 * @returns {Object} Combined structural components object
 */
export function mergeSectionResults(sectionResults) {
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
  
  // Merge overlapping and collinear components
  const mergedBeams = handleBeamMerging(combinedBeams);
  const mergedPosts = removeDuplicatePosts(combinedPosts);
  const mergedFootings = removeDuplicateFootings(combinedFootings);
  const mergedJoists = mergeCollinearJoists(combinedJoists);
  const mergedRimJoists = mergeCollinearRimJoists(combinedRimJoists);
  
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
 * @returns {Array<Object>} Merged beam array
 */
export function handleBeamMerging(allBeams) {
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
    
    // Find all beams that should be merged with this one
    for (let j = i + 1; j < allBeams.length; j++) {
      if (processed.has(j)) continue;
      
      const beam2 = allBeams[j];
      
      // Check if beams should be merged (collinear and same type)
      if (shouldMergeBeams(beam1, beam2)) {
        console.log(`  ✓ Beam ${j} can merge with beam ${i}`);
        mergeGroup.push(beam2);
        processed.add(j);
      } else {
        console.log(`  ✗ Beam ${j} cannot merge with beam ${i}`);
      }
    }
    
    // Merge the group of beams
    if (mergeGroup.length > 1) {
      const mergedBeam = mergeBeamGroup(mergeGroup);
      mergedBeams.push(mergedBeam);
    } else {
      mergedBeams.push(beam1);
    }
  }
  
  console.log(`\n=== Beam merging complete: ${allBeams.length} beams → ${mergedBeams.length} beams ===\n`);
  
  return mergedBeams;
}

/**
 * Checks if two beams should be merged (collinear and same type)
 * @param {Object} beam1 - First beam object
 * @param {Object} beam2 - Second beam object
 * @returns {boolean} True if beams should be merged
 */
function shouldMergeBeams(beam1, beam2) {
  // Must be same size
  if (beam1.size !== beam2.size) {
    return false;
  }
  
  // Check if beams have compatible usage types
  // Beams can merge if they have the same usage OR both are "Outer Beam" (from different sections)
  const areCompatible = beam1.usage === beam2.usage || 
    (beam1.usage === "Outer Beam" && beam2.usage === "Outer Beam");
  
  if (!areCompatible) {
    return false;
  }
  
  // Check if beams are collinear
  return areBeamsCollinear(beam1, beam2);
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
  
  // Calculate cross product to check collinearity
  const crossProduct1 = (p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x);
  const crossProduct2 = (p4.x - p1.x) * (p2.y - p1.y) - (p4.y - p1.y) * (p2.x - p1.x);
  
  // If both cross products are close to zero, the beams are collinear
  return Math.abs(crossProduct1) < EPSILON && Math.abs(crossProduct2) < EPSILON;
}

/**
 * Merges a group of collinear beams into a single beam
 * @param {Array<Object>} beamGroup - Array of beams to merge
 * @returns {Object} Merged beam object
 */
function mergeBeamGroup(beamGroup) {
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
    mergedBeam = {
      ...templateBeam,
      p1: { x: minX, y: templateBeam.p1.y },
      p2: { x: maxX, y: templateBeam.p1.y },
      lengthFt: (maxX - minX) / 24 // Convert pixels to feet
    };
  } else {
    mergedBeam = {
      ...templateBeam,
      p1: { x: templateBeam.p1.x, y: minY },
      p2: { x: templateBeam.p1.x, y: maxY },
      lengthFt: (maxY - minY) / 24 // Convert pixels to feet
    };
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
  
  // IMPORTANT NOTE: When beams are merged, the posts and footings need to be recalculated
  // based on the new merged beam length. The merged beam should have posts at:
  // 1. Both ends of the beam
  // 2. At regular intervals based on the beam span requirements (typically 6-8 feet)
  // This recalculation should happen in the post-processing phase after all beams are merged.
  
  return mergedBeam;
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
 * Merges collinear joists
 * @param {Array<Object>} joists - Array of joist objects
 * @returns {Array<Object>} Merged joists array
 */
function mergeCollinearJoists(joists) {
  // For now, return joists as-is since merging joists is complex
  // and they typically don't need merging across sections
  return joists || [];
}

/**
 * Merges collinear rim joists
 * @param {Array<Object>} rimJoists - Array of rim joist objects
 * @returns {Array<Object>} Merged rim joists array
 */
function mergeCollinearRimJoists(rimJoists) {
  // For now, return rim joists as-is
  // In practice, rim joists from different sections usually don't overlap
  return rimJoists || [];
}

/**
 * Validates if shape has only one rectangular section (simple rectangle)
 * @param {Array<Object>} rectangularSections - Array of decomposed sections
 * @returns {boolean} True if shape is a simple rectangle
 */
export function isSimpleRectangle(rectangularSections) {
  return rectangularSections && rectangularSections.length === 1;
}