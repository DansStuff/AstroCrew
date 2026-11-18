// MARK: Ship Motion

/** World units per second at mid-leg (ease-in-out averages to this). */
export const SHIP_CRUISE_SPEED = 800

/**
 * Bank from the Y of currentHeading × nextHeading (unit vectors on XZ).
 * Cross Y > 0 is a right turn, < 0 is a left turn.
 *
 * SHIP_BANK_GAIN is degrees of roll per unit of that cross Y (which is sin of the heading change).
 * A gentle turn might be ~0.1, so 70 → about 7°. Raise it to lean harder on the same curve;
 * SHIP_MAX_BANK_DEGREES still clamps the result.
 *
 * If the ship banks the wrong way, negate SHIP_BANK_GAIN (70 → -70). That flips left/right
 * without changing how strong the lean is.
 *
 * SHIP_ROLL_SMOOTH is how fast roll eases toward the target (higher = snappier).
 */
export const SHIP_MAX_BANK_DEGREES = 55
export const SHIP_BANK_GAIN = -400
export const SHIP_ROLL_SMOOTH = 2

/** Extra yaw so virtual forward matches a Y flip of the ship GLTF. Applied after bank. */
export const SHIP_MODEL_YAW_DEGREES = 180

// MARK: Path

/**
 * Runtime id of the origin hold. The first point of the first authored leg is Start;
 * it is not an encounter in the path editor. The ship waits here until the mission starts.
 */
export const PATH_START_STOP_ID = 'start'

/**
 * Bake density for the runtime polyline. Follow is a linear lerp between these samples,
 * not a live Catmull-Rom eval.
 *
 * PATH_SAMPLE_SPACING is the target gap in virtual units. A waypoint-to-waypoint chord longer
 * than PATH_MAX_SEGMENT_SAMPLES * PATH_SAMPLE_SPACING (800) gets coarser samples, so tight bends
 * across a huge gap can look slightly faceted. Raise/remove the cap if that shows up.
 */
export const PATH_SAMPLE_SPACING = 4
export const PATH_MIN_SEGMENT_SAMPLES = 12
export const PATH_MAX_SEGMENT_SAMPLES = 200

/** How far ahead (virtual units) to sample for heading / bank. */
export const PATH_TANGENT_LOOKAHEAD = 15
/** Floor on per-leg lookahead distance. */
export const PATH_TANGENT_LOOKAHEAD_MIN = 4
/** Extra lookahead as a fraction of leg length. */
export const PATH_TANGENT_LOOKAHEAD_LENGTH_FRACTION = 0.02
/** Below this squared length, a sampled tangent is treated as zero. */
export const PATH_TANGENT_EPSILON = 1e-6
/** Minimum knot spacing for centripetal Catmull-Rom (avoids divide-by-zero on coincident points). */
export const PATH_CATMULL_ROM_KNOT_EPSILON = 1e-4
