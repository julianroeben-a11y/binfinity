// Gridfinity dimensions, following the original spec by Zack Freedman and the
// values used by gridfinity-rebuilt-openscad. All values in mm.

/** Grid pitch in X and Y. */
export const GRID = 42;
/** Height unit for bins. */
export const HEIGHT_UNIT = 7;

/** Corner radius of the baseplate pocket at its top edge (= outer plate radius). */
export const PLATE_RADIUS = 4;

/**
 * Baseplate pocket profile, bottom to top: a 0.7 mm 45° chamfer, 1.8 mm
 * vertical wall, then a 2.15 mm 45° chamfer up to the top edge.
 */
export const PLATE_PROFILE = {
  bottomChamfer: 0.7,
  vertical: 1.8,
  topChamfer: 2.15,
} as const;

export const PLATE_PROFILE_HEIGHT =
  PLATE_PROFILE.bottomChamfer + PLATE_PROFILE.vertical + PLATE_PROFILE.topChamfer; // 4.65

/** Horizontal inset of the pocket bottom relative to the 42 mm top edge, per side. */
export const PLATE_PROFILE_INSET = PLATE_PROFILE.bottomChamfer + PLATE_PROFILE.topChamfer; // 2.85

/**
 * Radius of the rounded ridge between baseplate cells. The 45° walls of two
 * neighbouring pockets would otherwise meet in a knife edge; the round sits
 * tangent to both walls, so the plate ends up R × (√2 − 1) lower than 4.65 mm.
 * Bins rest on the chamfers, not on the ridge, so the fit does not change.
 */
export const PLATE_RIDGE_RADIUS = 0.5;
export const PLATE_HEIGHT = PLATE_PROFILE_HEIGHT - PLATE_RIDGE_RADIUS * (Math.SQRT2 - 1); // 4.44

/** Magnet / screw positions: offset from the cell centre in X and Y. */
export const HOLE_OFFSET = 13;

/** Bins are 0.5 mm smaller than the grid so they drop into the baseplate. */
export const BIN_CLEARANCE = 0.5;
/** Outer corner radius of a bin. */
export const BIN_RADIUS = 3.75;

/**
 * Bin foot profile, bottom to top: 0.8 mm 45° chamfer, 1.8 mm vertical, 2.15 mm
 * 45° chamfer. The foot is 41.5 mm wide at the top and 35.6 mm at the bottom.
 */
export const BIN_FOOT = {
  bottomChamfer: 0.8,
  vertical: 1.8,
  topChamfer: 2.15,
} as const;
export const BIN_FOOT_HEIGHT = BIN_FOOT.bottomChamfer + BIN_FOOT.vertical + BIN_FOOT.topChamfer; // 4.75
export const BIN_FOOT_INSET = BIN_FOOT.bottomChamfer + BIN_FOOT.topChamfer; // 2.95

/**
 * Stacking lip, from the top edge downwards: 1.9 mm 45° chamfer, 1.8 mm
 * vertical, 0.7 mm 45° chamfer. Below that a 45° support slope runs back to the
 * inner wall so the lip prints without overhangs.
 */
export const LIP = {
  topChamfer: 1.9,
  vertical: 1.8,
  bottomChamfer: 0.7,
} as const;
export const LIP_HEIGHT = LIP.topChamfer + LIP.vertical + LIP.bottomChamfer; // 4.4
export const LIP_INSET = LIP.topChamfer + LIP.bottomChamfer; // 2.6
