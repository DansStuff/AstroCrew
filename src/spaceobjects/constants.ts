// MARK: Projection

/**
 * Projection-shell radius for planets/stars (scene meters).
 * Does not place the ship — the center is always SCENE_SHIP_POSITION.
 * Smaller values pull bodies onto a closer shell; apparent angular size is unchanged.
 */
export const PLANET_ENCLOSING_SPHERE_RADIUS = 40 // previously 64
/** Slow axial spin for planets, as if very large and distant. */
export const PLANET_SPIN_DEGREES_PER_SECOND = 2

/**
 * Smaller enclosing sphere for asteroids (closer shell than planets/stars).
 * Center remains SCENE_SHIP_POSITION; only the projection radius differs.
 */
export const ASTEROID_ENCLOSING_SPHERE_RADIUS = 20

/** Pull celestial body centers inward from the shell along the view ray (meters). */
export const CELESTIAL_SPHERE_INSET = 0.75

/** Assumed player camera vertical FOV (degrees). Angular matching is FOV-independent. */
export const STANDARD_PLAYER_FOV_DEGREES = 50

/** Minimum Transform scale for a projected radius-1 mesh. */
export const PROJECTED_BODY_MIN_SCALE = 0.01

/**
 * Half-angle of the rear planet-cull cone (degrees). Full sector is 90°.
 * Scene +Z is the ship's stern (SHIP_MODEL_YAW_DEGREES = 180); bodies with
 * localDir.z >= cos(this angle) sit behind the hull and are hidden.
 */
export const PLANET_CULL_BEHIND_HALF_ANGLE_DEGREES = 60

// MARK: Stars

export const STAR_MODEL_PATH = 'assets/scene/Models/Star.gltf'

/** Virtual-space radius for distant background stars (models are authored at radius 1). */
export const STAR_VIRTUAL_RADIUS = 85

/** Star.gltf baseColorFactor (RGB) — tint is applied relative to this. */
export const STAR_BASE_COLOR = { r: 0.8, g: 0.8, b: 0.8 }

export const STAR_SPAWN_COUNT_DEFAULT = 20

/**
 * Virtual-space distance for background stars.
 * 1.5× the farthest authored planet (Planet_8 at ~21029 from origin).
 */
export const STAR_SPAWN_DISTANCE = 31544
