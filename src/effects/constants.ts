import { Color3 } from '@dcl/sdk/math'

// MARK: Camera Shake

/** Default strength multiplier for shakeCamera(). */
export const CAMERA_SHAKE_DEFAULT_INTENSITY = 1

export const CAMERA_SHAKE_DEFAULT_DURATION_SECONDS = 0.4

/** Max camera-local position offset in meters at intensity 1. */
export const CAMERA_SHAKE_MAX_OFFSET = 0.3

/** Max pitch/yaw/roll jitter in degrees at intensity 1. */
export const CAMERA_SHAKE_MAX_ANGLE_DEGREES = 3

/** Shake intensity when a hazard collides with the ship. */
export const CAMERA_SHAKE_HAZARD_IMPACT_INTENSITY = 1

/** Shake intensity when a saucer shot hits the ship. */
export const CAMERA_SHAKE_SAUCER_SHOT_INTENSITY = 0.6

/** Random intensity range for each shake burst during the death spin. */
export const CAMERA_SHAKE_DEATH_MIN_INTENSITY = 2
export const CAMERA_SHAKE_DEATH_MAX_INTENSITY = 3
/** Random gap in seconds between death-spin shake bursts. */
export const CAMERA_SHAKE_DEATH_MIN_INTERVAL = 0.15
export const CAMERA_SHAKE_DEATH_MAX_INTERVAL = 0.45

// MARK: Tutorial Beam

/** Meters above the player's feet. The tutorial beam starts here. */
export const TUTORIAL_BEAM_WAIST_HEIGHT = 0.5

/** Meters below a tutorial arrow. The beam ends on the object the arrow indicates. */
export const TUTORIAL_BEAM_TARGET_DROP = 1.25

/** Scene-space width of the tutorial beam plane. */
export const TUTORIAL_BEAM_WIDTH = 0.45

export const TUTORIAL_BEAM_TEXTURE_PATH = 'assets/scene/Images/tut_beam.png'

/**
 * Repeats of tut_beam along the beam. The plane's UVs stay 0–1, so this is set once:
 * the chevron count does not change as the beam stretches.
 * Local X (width) is one copy; local Y (length) is this many.
 */
export const TUTORIAL_BEAM_TEXTURE_REPEATS = 15

export const TUTORIAL_BEAM_EMISSIVE_COLOR = Color3.create(1, 1, 0)

export const TUTORIAL_BEAM_EMISSIVE_INTENSITY = 1
