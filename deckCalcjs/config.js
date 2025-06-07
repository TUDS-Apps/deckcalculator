// js/config.js
export const PIXELS_PER_FOOT = 24; // 24 pixels = 1 foot
export const GRID_SPACING_FEET = 1/12; // 1 inch
export const GRID_SPACING_PIXELS = PIXELS_PER_FOOT * GRID_SPACING_FEET; // 2 model units per grid line

// ACTUAL LUMBER DIMENSIONS (nominal vs actual)
export const ACTUAL_2X_THICKNESS_INCHES = 1.5; // Actual thickness of 2x lumber
export const ACTUAL_2X6_WIDTH_INCHES = 5.5; // Actual width of 2x6
export const ACTUAL_2X8_WIDTH_INCHES = 7.25; // Actual width of 2x8
export const ACTUAL_2X10_WIDTH_INCHES = 9.25; // Actual width of 2x10
export const ACTUAL_2X12_WIDTH_INCHES = 11.25; // Actual width of 2x12
export const ACTUAL_4X4_WIDTH_INCHES = 3.5; // Actual width of 4x4 post
export const ACTUAL_6X6_WIDTH_INCHES = 5.5; // Actual width of 6x6 post

// VIEWPORT AND ZOOM CONSTANTS
export const MIN_ZOOM_SCALE = 0.1; // Minimum zoom out
export const MAX_ZOOM_SCALE = 10.0; // Maximum zoom in
export const ZOOM_INCREMENT_FACTOR = 1.1; // Factor for zooming in (e.g., scale * 1.1), for zooming out (scale / 1.1)

// Defines the full logical drawing area
export const MODEL_WIDTH_FEET = 100;
export const MODEL_HEIGHT_FEET = 100;

// Defines the initial visible portion of the model space (approx)
export const INITIAL_VIEW_WIDTH_FEET = 50;
export const INITIAL_VIEW_HEIGHT_FEET = 40;

export const SNAP_TOLERANCE_PIXELS = 10; // How close to snap (this is in SCREEN pixels)
export const BEAM_CANTILEVER_FEET = 1;
export const POST_INSET_FEET = 1;
export const MAX_POST_SPACING_FEET = 8;
export const EPSILON = 0.01; // Small tolerance for float comparisons
export const RESIZE_TOLERANCE = 2; // Minimum pixel change to trigger resize reinit
export const MAX_BLOCKING_SPACING_FEET = 8;
export const PICTURE_FRAME_SINGLE_INSET_INCHES = 5;
export const PICTURE_FRAME_DOUBLE_INSET_INCHES = 10;
export const MIN_HEIGHT_FOR_NO_2X6_INCHES = 24; // 2 feet
export const DROP_BEAM_CENTERLINE_SETBACK_FEET = 1.0;

export const JOIST_SIZE_ORDER = ["2x6", "2x8", "2x10", "2x12"];

// Colors (can be centralized here if used in JS, though mostly in CSS)
export const DECK_OUTLINE_COLOR = "#4A90E2";
export const LEDGER_COLOR = "#FFA500";
export const JOIST_RIM_COLOR = "#4B5563";
export const BEAM_COLOR = "#DC2626";
export const POST_STROKE_COLOR = "#000000";
export const POST_FILL_COLOR = "#FFFFFF";
export const FOOTING_FILL_COLOR = "#9CA3AF";
export const FOOTING_STROKE_COLOR = "#374151";
export const BLOCKING_COLOR = "#8B5CF6";
export const STAIR_STRINGER_COLOR = "#8D6E63";
export const STAIR_TREAD_COLOR = "#A1887F";
export const STAIR_SELECTED_COLOR = "#4A90E2";
