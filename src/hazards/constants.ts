import { Color3, Vector3 } from '@dcl/sdk/math'

// MARK: Asteroids and Saucers

export const HAZARD_ASTEROID_MODEL_PATH = 'assets/scene/Models/Asteroid.gltf'
export const HAZARD_TARGETING_CROSSHAIR_TEXTURE_PATH = 'assets/scene/Images/crosshair1.png'

/** Pre-warmed incoming-asteroid entity trees. The pool grows if this is exhausted. */
export const HAZARD_ASTEROID_POOL_SIZE = 10

/** Virtual-space radius of an incoming asteroid (models are authored at radius 1). */
export const HAZARD_RADIUS = 4

/** Virtual-space distance ahead of the ship to place a spawned hazard. */
export const HAZARD_SPAWN_DISTANCE = 240

/**
 * Asteroid spawn offset from the weapon camera look, in degrees.
 * X is left/right (±). Y is up from the look axis (0 through +max).
 */
export const ASTEROID_SPAWN_SPREAD_X_DEGREES = 15
export const ASTEROID_SPAWN_SPREAD_Y_DEGREES = 20

/** Virtual-space distance from the ship at the end of an asteroid's flight. */
export const HAZARD_IMPACT_DISTANCE = 8

/** Local tumble rate applied on top of celestial orientation. */
export const HAZARD_SPIN_DEGREES_PER_SECOND = 60

/** Max scene-space distance for the click-to-target aim cone. */
export const HAZARD_RAYCAST_MAX_DISTANCE = 40

/** Uniform scale of the billboard crosshair parented to a hazard. */
export const HAZARD_TARGETING_INDICATOR_SCALE = 4

/** How many targeter portraits each reticule shows. */
export const HAZARD_TARGETING_PORTRAIT_COUNT = 3

/** Radius of the portrait ring around the reticule center (plane is 1×1). */
export const HAZARD_TARGETING_PORTRAIT_RADIUS = 0.55

/** Local Z so portraits sit in front of the reticule plane. */
export const HAZARD_TARGETING_PORTRAIT_Z = -0.1

/** First portrait at 3 o'clock; remaining portraits step clockwise (downward). */
export const HAZARD_TARGETING_PORTRAIT_START_ANGLE_DEGREES = 0
export const HAZARD_TARGETING_PORTRAIT_STEP_DEGREES = -60

/** Local scale of each portrait plane relative to the 1×1 reticule. */
export const HAZARD_TARGETING_PORTRAIT_SCALE = 0.2

/** Local offset of the "Target Locked" label from the reticule center (plane is 1×1). */
export const HAZARD_TARGETING_LOCKED_OFFSET = Vector3.create(0, 0.55, -0.1)

/** TextShape fontSize for the local-player lock label. Inverse-scaled by the reticule parent. */
export const HAZARD_TARGETING_LOCKED_FONT_SIZE = 8

export const HAZARD_SELECT_SOUND_PATH = 'assets/scene/Sounds/select1.mp3'
export const HAZARD_HIT_SHIP_SOUND_PATH = 'assets/scene/Sounds/boom1.mp3'

export const HAZARD_SAUCER_MODEL_PATH = 'assets/scene/Models/Saucer.gltf'

/** Pre-warmed saucer entity trees. The pool grows if this is exhausted. */
export const HAZARD_SAUCER_POOL_SIZE = 2

/** Virtual-space radius of a saucer (models are authored at radius 1). */
export const HAZARD_SAUCER_RADIUS = 5

/** Virtual-space distance from the ship where a saucer stops approaching. */
export const SAUCER_HOVER_DISTANCE = 40

export const SAUCER_BEAM_COLOR = Color3.create(0.05, 0.85, 0.15)
export const SAUCER_BEAM_EMISSIVE_INTENSITY = 4

/** Scene-space width of the saucer beam plane before the pulse is applied. */
export const SAUCER_BEAM_WIDTH = 0.25

/** Scene-space offset from SCENE_SHIP_POSITION: below the floor, toward the bow (scene -Z; +Z is stern). */
export const SAUCER_BEAM_TARGET_OFFSET = Vector3.create(0, -5, -10)

/** Random X jitter around SCENE_SHIP_POSITION when a saucer beam starts. */
export const SAUCER_BEAM_TARGET_X_SPREAD = 10

/** Seconds between saucer beam impact rerolls while hovering. */
export const SAUCER_BEAM_RETARGET_SECONDS = 1.3

/** Fractional width pulse around SAUCER_BEAM_WIDTH (0.2 = ±20%). */
export const SAUCER_BEAM_WIDTH_PULSE_AMPLITUDE = 0.4

/** Seconds for one full width pulse cycle. */
export const SAUCER_BEAM_WIDTH_PULSE_PERIOD = 0.225
