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

/** Magnet / screw positions: offset from the cell centre in X and Y. */
export const HOLE_OFFSET = 13;
