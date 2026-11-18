import { Vector3 } from '@dcl/sdk/math'

// MARK: Simulation

/** Clamp for per-frame `dt` so a hitch cannot jump the sim too far. */
export const SIMULATION_MAX_DELTA_SECONDS = 0.1

// MARK: Ship

/** Fixed scene-space anchor for the visible ship model (center of the enclosing sphere). */
export const SCENE_SHIP_POSITION = Vector3.create(64, 64, 64)

/**
 * Scene-space radius of the walkable ship interior around SCENE_SHIP_POSITION.
 * Projected planets are scaled so their surface stays outside this volume.
 */
export const SHIP_INTERIOR_RADIUS = 20

export const BREACH_REPAIR_SOUND_PATH = 'assets/scene/Sounds/wrench.mp3'
export const LOW_HP_SOUND_PATH = 'assets/scene/Sounds/low_hp2.mp3'
export const LOW_HP_THRESHOLD = 0.25

// MARK: Miniship

export type MinishipPose = {
  /** Scene-space position of the Miniship entity. */
  position: Vector3
  /** Rotation about Y, in degrees. */
  yawDegrees: number
}

/**
 * Miniship poses, 8 entries. Index 0 is the starting pose before a mission begins
 * (matches the Miniship in the scene composite). The remaining entries are to be filled in.
 */
export const MINISHIP_POSES: MinishipPose[] = [
  { position: Vector3.create(65.07147979736328, 61.75, 64.27969360351562), yawDegrees: -30 },
  { position: Vector3.create(65.39566802978516, 61.75, 63.69566345214844), yawDegrees: 0 },
  { position: Vector3.create(65.2730712890625, 61.75, 63.218544006347656), yawDegrees: 49.79 },
  { position: Vector3.create(64.44740295410156, 61.75, 62.76624298095703), yawDegrees: 120 },
  { position: Vector3.create(63.83460998535156, 61.75, 63.58098602294922), yawDegrees: 90 },
  { position: Vector3.create(62.75, 61.75, 63.75), yawDegrees: 198.89 },
  { position: Vector3.create(62.89591979980469, 61.75, 64.60245513916016), yawDegrees: 225 },
  { position: Vector3.create(64.04685974121094, 61.75, 65.13430786132812), yawDegrees: 259.93 }
]
