import { Color3, Vector3 } from '@dcl/sdk/math'

// MARK: Lasers

/** How long a laser plane stays visible after each shot. Its width follows 0 → peak → 0 over this time. */
export const SHIP_LASER_LIFETIME_SECONDS = 0.1275

/** Peak scene-space width of the laser plane (local X). Length is the ship-to-asteroid distance. */
export const SHIP_LASER_WIDTH = 0.25

/** Width of lasers fired for other players, from below the hull. */
export const SHIP_LASER_OTHER_WIDTH = SHIP_LASER_WIDTH * 0.5

/**
 * Offset from SCENE_SHIP_POSITION to the local player's laser origin when the weapon they
 * locked from is unknown. Normally the local laser fires from that weapon's muzzle.
 */
export const SHIP_LASER_LOCAL_ORIGIN_OFFSET = Vector3.create(0, 7, -6)

/** Offset from SCENE_SHIP_POSITION to other players' laser origin, below the hull. */
export const SHIP_LASER_OTHER_ORIGIN_OFFSET = Vector3.create(0, -7, -6)

/** Random scene-X offset (± meters) around that origin. Scene X is left/right; -Z is the bow. */
export const SHIP_LASER_OTHER_ORIGIN_X_SPREAD = 8

export const SHIP_LASER_SOUND_PATH = 'assets/scene/Sounds/laser1.mp3'

/** Concurrent laser one-shots. One AudioSource cannot restart while still playing. */
export const SHIP_LASER_SOUND_VOICES = 16

/** Pre-warmed laser plane entities. The pool grows if this is exhausted. */
export const SHIP_LASER_POOL_SIZE = 16

/** Shared by WeaponLights and ship laser beams. */
export const WEAPON_LIGHT_COLOR = Color3.Yellow()
export const WEAPON_LIGHT_OVERCHARGE_COLOR = Color3.create(0.85, 0, 1)

export const SHIP_LASER_EMISSIVE_INTENSITY = 4

// MARK: Weapon Camera

/** Camera-local offset from the weapon pose (+Z look, +Y up, +X right). */
export const WEAPON_CAMERA_LOCAL_OFFSET = Vector3.create(0, -3, 2)

/** Local laser origin relative to the weapon pose, in the same frame as WEAPON_CAMERA_LOCAL_OFFSET. */
export const WEAPON_MUZZLE_LOCAL_OFFSET = Vector3.create(0, 0, 3.5)

/** Seconds to blend into / out of a weapon VirtualCamera. */
export const WEAPON_CAMERA_TRANSITION_SECONDS = 0.5

/** Vertical FOV in degrees while a weapon VirtualCamera is active. */
export const WEAPON_CAMERA_FOV_DEGREES = 60

// MARK: Overcharge

export const OVERCHARGE_START_SOUND_PATH = 'assets/scene/Sounds/powerup.mp3'
export const OVERCHARGE_END_SOUND_PATH = 'assets/scene/Sounds/powerdown.mp3'
