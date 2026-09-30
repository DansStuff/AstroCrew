import { Color3, Color4, Vector3 } from '@dcl/sdk/math'

// MARK: Simulation

/** Clamp for per-frame `dt` so a hitch cannot jump the sim too far. */
export const SIMULATION_MAX_DELTA_SECONDS = 0.1

// MARK: Difficulty
// Combat, survivability, and encounter pacing. Presentation and sim stay in the sections below.

export type TurretId = 'left' | 'center' | 'right'

export type HazardKind = 'asteroid' | 'saucer'

export type AsteroidEncounterStage = {
  kind: 'asteroid'
  turret: TurretId
  hazardCount: number
}

export type SaucerEncounterStage = {
  kind: 'saucer'
  turret: TurretId
}

export type EncounterStage = AsteroidEncounterStage | SaucerEncounterStage

export type EncounterParams = {
  /** Multiplier on BASE_ASTEROID_HP / BASE_SAUCER_HP for every hazard in this encounter. */
  hpMultiplier: number
  /** Multiplier on BASE_ASTEROID_DAMAGE / BASE_SAUCER_DAMAGE for every hazard in this encounter. */
  damageMultiplier: number
  stages: EncounterStage[]
}

/** Starting hull hit points. The HUD bar is hullHp / this value. */
export const SHIP_BASE_HULL_HP = 100

/** Seconds the ship spins out after the hull reaches 0, before the mission resets. */
export const SHIP_DEATH_SPIN_SECONDS = 5
/** Spin rate the death spin approaches. */
export const SHIP_DEATH_SPIN_MAX_DEGREES_PER_SECOND = 720
/** Time constant of the spin ramp: ~63% of max speed after this many seconds. */
export const SHIP_DEATH_SPIN_RAMP_SECONDS = 1.5

/** Repair hold at engineering level 1. */
export const BREACH_REPAIR_HOLD_LEVEL_1_SECONDS = 1.5
/** Repair hold at engineering level 10. */
export const BREACH_REPAIR_HOLD_MAX_LEVEL_SECONDS = 0.5

/** Hull HP restored by a level 1 engineer when a breach is repaired. */
export const ENGINEERING_REPAIR_BASE_HP = 5
/** Extra hull HP restored per engineering level above 1. Level 2 = 6, level 10 = 14. */
export const ENGINEERING_REPAIR_HP_PER_LEVEL = 1

/**
 * Shots per second for the local player's laser (fixed), and per other player targeting
 * the same hazard. Other players multiply this, up to SHIP_LASER_MAX_TARGETERS.
 */
export const SHIP_LASER_BASE_FIRE_RATE = 1.5

/** Clamp on other players' shot frequency. 1 other = base rate; 5+ others = 5× base. The local laser is not counted. */
export const SHIP_LASER_MAX_TARGETERS = 5

/** Seconds between damage ticks on a locked hazard. First hit waits one full interval. */
export const HAZARD_DAMAGE_INTERVAL = 0.5

/** Damage dealt by a level 1 gunner each damage tick. */
export const GUNNER_BASE_DAMAGE = 10
/** Extra damage per gunner level above 1. Level 2 = 12, level 10 = 28. */
export const GUNNER_DAMAGE_PER_LEVEL = 2

/** HP of an asteroid at encounter hpMultiplier 1. Level 1 TTK is 5s (10 ticks × 10 damage). */
export const BASE_ASTEROID_HP = 100
/** Hull damage when an asteroid reaches the ship at encounter damageMultiplier 1. */
export const BASE_ASTEROID_DAMAGE = 10
/** HP of a saucer at encounter hpMultiplier 1. Level 1 TTK is 6s (12 ticks × 10 damage). */
export const BASE_SAUCER_HP = 120
/** Hull damage per saucer shot at encounter damageMultiplier 1. */
export const BASE_SAUCER_DAMAGE = 10

export function gunnerShotDamage(level: number): number {
  return GUNNER_BASE_DAMAGE + (level - 1) * GUNNER_DAMAGE_PER_LEVEL
}

/** Hull HP restored when a breach is repaired. Level 1 = 5, then +1 each level. */
export function engineeringRepairHp(level: number): number {
  return ENGINEERING_REPAIR_BASE_HP + (level - 1) * ENGINEERING_REPAIR_HP_PER_LEVEL
}

/** Seconds the repair button must stay down. Level 1 = 1.5, level 10 = 0.5. */
export function engineeringRepairHoldSeconds(level: number): number {
  const clamped = Math.min(SKILL_MAX_LEVEL, Math.max(1, Math.floor(level)))
  const t = (clamped - 1) / (SKILL_MAX_LEVEL - 1)
  return (
    BREACH_REPAIR_HOLD_LEVEL_1_SECONDS +
    t * (BREACH_REPAIR_HOLD_MAX_LEVEL_SECONDS - BREACH_REPAIR_HOLD_LEVEL_1_SECONDS)
  )
}

/** Per-gunner damage scale from connected player count. Total DPS grows like sqrt(n). */
export function playerCountDamageMultiplier(playerCount: number): number {
  return 1 / Math.cbrt(Math.max(1, playerCount))
}

/** Aim-assist cone half-angle (degrees) for click-to-target. */
export const HAZARD_AIM_CONE_HALF_ANGLE_DEGREES = 6

/** Minimum time between successful target-lock requests. */
export const HAZARD_TARGET_COOLDOWN_SECONDS = 0.5

export const OVERCHARGE_DAMAGE_MULTIPLIER = 1.5
export const OVERCHARGE_DURATION_SECONDS = 15

export const SKILL_MAX_LEVEL = 10
/** XP to go from gunner 1 to 2. Later levels cost GUNNER_XP_GROWTH times the previous. */
export const GUNNER_XP_LEVEL_1 = 200
export const GUNNER_XP_GROWTH = 2
/** XP to go from engineering 1 to 2. Later levels cost ENGINEERING_XP_GROWTH times the previous. */
export const ENGINEERING_XP_LEVEL_1 = 160
export const ENGINEERING_XP_GROWTH = 1.5
/** Gunner XP granted each damage tick while locked on a hazard. */
export const SKILL_XP_PER_GUNNER_HIT = 5
/** Engineering XP granted for each successful breach repair. */
export const SKILL_XP_PER_REPAIR = 40
/** XP multiplier for a player's first mission of each UTC day. */
export const DOUBLE_XP_MULTIPLIER = 2

/** Seconds after a stage signal before the first spawn. */
export const ENCOUNTER_STAGE_TELEGRAPH_SECONDS = 2

/** Seconds between hazard spawns during an encounter. */
export const HAZARD_SPAWN_INTERVAL = 2

/** Seconds to fly from HAZARD_SPAWN_DISTANCE to SAUCER_HOVER_DISTANCE. */
export const SAUCER_APPROACH_SECONDS = 2
/** Seconds between saucer shots. First shot waits one full interval after approach. */
export const SAUCER_FIRE_INTERVAL = 2
/** Seconds an asteroid exists before it hits the ship (unless shot). */
export const ASTEROID_FLIGHT_TIME = 12
/*
export const ENCOUNTER_PARAMS: Record<string, EncounterParams> = {
  Terra: {
    hpMultiplier: 1,
    damageMultiplier: 1,
    stages: [

      { kind: 'asteroid', turret: 'center', hazardCount: 2 },
      { kind: 'asteroid', turret: 'left', hazardCount: 2 },
      { kind: 'asteroid', turret: 'right', hazardCount: 2 }
    ]
  },
  Vaelith: {
    hpMultiplier: 1.33,
    damageMultiplier: 1.17,
    stages: [
      { kind: 'saucer', turret: 'center' },
      { kind: 'saucer', turret: 'right' },
      { kind: 'saucer', turret: 'left' }
    ]
  },
  Korund: {
    hpMultiplier: 1.67,
    damageMultiplier: 1.33,
    stages: [
      { kind: 'asteroid', turret: 'right', hazardCount: 4 },
      { kind: 'asteroid', turret: 'left', hazardCount: 4 },
      { kind: 'saucer', turret: 'right' },
    ]
  },
  Sablemere: {
    hpMultiplier: 2,
    damageMultiplier: 1.5,
    stages: [
      { kind: 'asteroid', turret: 'right', hazardCount: 4 },
      { kind: 'saucer', turret: 'left' },
      { kind: 'asteroid', turret: 'right', hazardCount: 4 }
    ]
  },
  Orpheon: {
    hpMultiplier: 2.33,
    damageMultiplier: 1.67,
    stages: [
      { kind: 'saucer', turret: 'right' },
      { kind: 'asteroid', turret: 'center', hazardCount: 6 },
      { kind: 'saucer', turret: 'left' },
      { kind: 'asteroid', turret: 'center', hazardCount: 6 },
    ]
  },
  Caelum: {
    hpMultiplier: 2.67,
    damageMultiplier: 1.83,
    stages: [
      { kind: 'asteroid', turret: 'left', hazardCount: 6 },
      { kind: 'asteroid', turret: 'right', hazardCount: 6 },
      { kind: 'asteroid', turret: 'center', hazardCount: 6 },
      { kind: 'asteroid', turret: 'left', hazardCount: 6 },
      { kind: 'asteroid', turret: 'right', hazardCount: 6 },
      { kind: 'asteroid', turret: 'center', hazardCount: 6 }
    ]
  },
  Drenovar: {
    hpMultiplier: 8,
    damageMultiplier: 2,
    stages: [
      { kind: 'saucer', turret: 'center' },
    ]
  }
}
*/

export const ENCOUNTER_PARAMS: Record<string, EncounterParams> = {
  Terra: {
    hpMultiplier: 1,
    damageMultiplier: 1,
    stages: [

      { kind: 'asteroid', turret: 'center', hazardCount: 1 },
      
    ]
  },
  Vaelith: {
    hpMultiplier: 1.33,
    damageMultiplier: 0,
    stages: [
      { kind: 'asteroid', turret: 'center', hazardCount: 1 },
    ]
  },
  Korund: {
    hpMultiplier: 1.67,
    damageMultiplier: 0,
    stages: [
      { kind: 'asteroid', turret: 'center', hazardCount: 1 },
    ]
  },
  Sablemere: {
    hpMultiplier: 2,
    damageMultiplier: 0,
    stages: [
      { kind: 'asteroid', turret: 'center', hazardCount: 1 },
    ]
  },
  Orpheon: {
    hpMultiplier: 2.33,
    damageMultiplier: 0,
    stages: [
      { kind: 'asteroid', turret: 'center', hazardCount: 1 },
    ]
  },
  Caelum: {
    hpMultiplier: 2.67,
    damageMultiplier: 0,
    stages: [
      { kind: 'asteroid', turret: 'center', hazardCount: 1 },
    ]
  },
  Drenovar: {
    hpMultiplier: 8,
    damageMultiplier: 0,
    stages: [
      { kind: 'asteroid', turret: 'center', hazardCount: 1 },
    ]
  }
}


// MARK: Ship

/** Fixed scene-space anchor for the visible ship model (center of the enclosing sphere). */
export const SCENE_SHIP_POSITION = Vector3.create(64, 64, 64)

/**
 * Scene-space radius of the walkable ship interior around SCENE_SHIP_POSITION.
 * Projected planets are scaled so their surface stays outside this volume.
 */
export const SHIP_INTERIOR_RADIUS = 20

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

// MARK: Hazards

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

// MARK: Ship Weapons

/** How long a laser plane stays visible after each shot. */
export const SHIP_LASER_LIFETIME_SECONDS = 0.15

/** Scene-space width of the laser plane (local X). Length is the ship-to-asteroid distance. */
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

/** Camera-local offset from the weapon pose (+Z look, +Y up, +X right). */
export const WEAPON_CAMERA_LOCAL_OFFSET = Vector3.create(0, -3, 2)

/** Local laser origin relative to the weapon pose, in the same frame as WEAPON_CAMERA_LOCAL_OFFSET. */
export const WEAPON_MUZZLE_LOCAL_OFFSET = Vector3.create(0, 0, 3.5)

/** Seconds to blend into / out of a weapon VirtualCamera. */
export const WEAPON_CAMERA_TRANSITION_SECONDS = 0.5

/** Vertical FOV in degrees while a weapon VirtualCamera is active. */
export const WEAPON_CAMERA_FOV_DEGREES = 60

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

export const SHIP_LASER_SOUND_PATH = 'assets/scene/Sounds/laser1.mp3'

/** Concurrent laser one-shots. One AudioSource cannot restart while still playing. */
export const SHIP_LASER_SOUND_VOICES = 16

/** Pre-warmed laser plane entities. The pool grows if this is exhausted. */
export const SHIP_LASER_POOL_SIZE = 16

/** Shared by WeaponLights and ship laser beams. */
export const WEAPON_LIGHT_COLOR = Color3.Yellow()
export const WEAPON_LIGHT_OVERCHARGE_COLOR = Color3.create(0.85, 0, 1)

export const SHIP_LASER_EMISSIVE_INTENSITY = 4

// MARK: Encounters

export const ENCOUNTER_STAGE_SOUND_PATH = 'assets/scene/Sounds/fail1.mp3'
export const OVERCHARGE_START_SOUND_PATH = 'assets/scene/Sounds/powerup.mp3'
export const OVERCHARGE_END_SOUND_PATH = 'assets/scene/Sounds/powerdown.mp3'
export const BREACH_REPAIR_SOUND_PATH = 'assets/scene/Sounds/wrench.mp3'
export const LOW_HP_SOUND_PATH = 'assets/scene/Sounds/low_hp2.mp3'
export const LOW_HP_THRESHOLD = 0.25

// MARK: UI

export const UI_VIRTUAL_WIDTH = 1920
export const UI_VIRTUAL_HEIGHT = 1080

export const UI_FONT = 'monospace' as const

export function boldUi(value: string): string {
  return `<b>${value}</b>`
}
export const UI_TINT = Color4.create(0x33 / 255, 0xdb / 255, 0, 1)
export const UI_HUD_EDGE_PADDING_X = '2%'
export const UI_HUD_EDGE_PADDING_Y = '7%'

// Mission start / restart
export const UI_MISSION_BUTTON_FONT_SIZE = 22
export const UI_MISSION_BUTTON_WIDTH = '18%'
export const UI_MISSION_BUTTON_HEIGHT = '9%'
export const UI_MISSION_BUTTON_LEFT = '41%'
export const UI_MISSION_STATUS_LABEL_WIDTH = '29%'
export const UI_MISSION_STATUS_LABEL_LEFT = '35%'

// Exit camera
export const UI_BACK_TO_SHIP_BUTTON_WIDTH = '20%'
export const UI_BACK_TO_SHIP_BUTTON_HEIGHT = '32%'
export const UI_BACK_TO_SHIP_BUTTON_FONT_SIZE = 36

// Turret camera crosshair
export const UI_TURRET_CROSSHAIR_PATH = 'assets/scene/Images/cam_crosshair_corners.png'
export const UI_TURRET_CROSSHAIR_SLICES = { top: 0.49, bottom: 0.49, left: 0.49, right: 0.49 }
/** Screen width left of the right-side column (UI_BACK_TO_SHIP_BUTTON_WIDTH + UI_HUD_EDGE_PADDING_X), inset by UI_HUD_EDGE_PADDING_X on both sides. */
export const UI_TURRET_CROSSHAIR_WIDTH = '74%'
/** Full screen height inset by UI_HUD_EDGE_PADDING_Y top and bottom. */
export const UI_TURRET_CROSSHAIR_HEIGHT = '86%'

// Which turret camera is active, drawn inside the crosshair frame's bottom-left corner.
export const UI_CAM_INDICATOR_PATHS: Record<TurretId, string> = {
  left: 'assets/scene/Images/cam_indicator_left.png',
  center: 'assets/scene/Images/cam_indicator_center.png',
  right: 'assets/scene/Images/cam_indicator_right.png'
}
/** Both axes are this share of screen height, so the art stays square when the mobile virtual canvas is shorter than desktop. */
export const UI_CAM_INDICATOR_SIZE = '22.22vh'
/** Inset from the left edge, as a share of screen width. */
export const UI_CAM_INDICATOR_LEFT = '9.4vw'
/** Inset from the bottom edge, as a share of screen height. */
export const UI_CAM_INDICATOR_BOTTOM = '20.4vh'

// Prompt while a turret camera is up and nothing is locked
export const UI_SELECT_TARGET_FONT_SIZE = 32
export const UI_SELECT_TARGET_LABEL_WIDTH = '36%'
export const UI_SELECT_TARGET_LABEL_HEIGHT = '6vh'
export const UI_SELECT_TARGET_BLINK_MS = 500

// Hull bar
export const UI_HEALTH_BAR_WIDTH = '36%'
export const UI_HEALTH_BAR_HEIGHT = '4.8%'
export const UI_HEALTH_BAR_FONT_SIZE = 22

// Repair hold, centered on the screen. Width shrinks from this size as the hold progresses.
export const UI_REPAIR_HOLD_BAR_WIDTH = '24%'
export const UI_REPAIR_HOLD_BAR_HEIGHT = '5%'
export const UI_REPAIR_HOLD_BAR_FONT_SIZE = 22

// Encounter stage banner
export const UI_ENCOUNTER_STAGE_DURATION_SECONDS = 2
export const UI_ENCOUNTER_STAGE_FONT_SIZE = 48
export const UI_ENCOUNTER_STAGE_LABEL_WIDTH = '38%'
export const UI_ENCOUNTER_STAGE_LABEL_HEIGHT = '7%'
/** Top edge of the banner. Centers the 7% label on the line 66% up the screen (34% from the top). */
export const UI_ENCOUNTER_STAGE_LABEL_TOP = '30.5%'

// Overcharge label
export const UI_OVERCHARGE_LABEL_WIDTH = '57%'
export const UI_OVERCHARGE_LABEL_HEIGHT = '4.5%'
export const UI_OVERCHARGE_LABEL_FONT_SIZE = 27
export const UI_OVERCHARGE_LABEL_MARGIN_TOP = '11.8%'

// Skills panel (fixed height so footer text stays inside the frame, not viewport-bottom aligned)
export const UI_SKILL_PANEL_HEIGHT = '47vh'
export const UI_SKILL_PANEL_WIDTH = UI_BACK_TO_SHIP_BUTTON_WIDTH
export const UI_SKILL_PANEL_ROW_HEIGHT = '5vh'
export const UI_SKILL_PANEL_ROW_MARGIN = '2vh'
export const UI_SKILL_PANEL_PADDING_X = '7%'
export const UI_SKILL_PANEL_PADDING_Y = '2vh'
export const UI_SKILL_PANEL_TITLE_HEIGHT = '3vh'
export const UI_SKILL_PANEL_TITLE_FONT_SIZE = 22
export const UI_SKILL_TEXT_ROW_HEIGHT = '72%'
export const UI_SKILL_ICON_WIDTH = '12%'
export const UI_SKILL_ICON_MARGIN_RIGHT = '4%'
export const UI_SKILL_LABEL_WIDTH = '50%'
export const UI_SKILL_LEVEL_WIDTH = '16%'
export const UI_SKILL_XP_BAR_HEIGHT = '16%'
export const UI_SKILL_XP_BAR_MARGIN_TOP = '4%'
export const UI_SKILL_DOUBLE_XP_ROW_HEIGHT = '3vh'
export const UI_SKILL_DOUBLE_XP_FONT_SIZE = 18
export const UI_GUNNER_ICON_PATH = 'assets/scene/Images/gunner.png'
export const UI_ENGINEERING_ICON_PATH = 'assets/scene/Images/engineering.png'

// Off-screen breach repair icons, drawn on the screen edge toward each active breach
export const UI_BREACH_ICON_SIZE_VH = 8.4
/** Extra scale at the peak of the pulse (0.15 = up to 15% bigger). */
export const UI_BREACH_ICON_PULSE_AMOUNT = 0.30
/** Pulses (bounces) per second; |sin| makes each half-cycle a bounce. */
export const UI_BREACH_ICON_PULSE_HZ = 1.5
/** Icon center is kept this many half-icon-sizes from each screen edge (1 = touching, extra room covers the pulse). */
export const UI_BREACH_ICON_EDGE_INSET_HALF_SIZES = 1.3
export const UI_BREACH_ICON_TINT = Color4.create(1, 0.27, 0.05, 1)
/** The rectangle around the player, "stood up" onto the screen, is 16:9 (half extents in arbitrary units). */
export const UI_BREACH_RECT_HALF_WIDTH = 16
export const UI_BREACH_RECT_HALF_HEIGHT = 9

// Green pixel frame / buttons
export const UI_GREEN_PIXEL_FRAME_PATH = 'assets/scene/Images/green_pixel_frame_9.png'
// Corner art is 17px of the 128px texture. Larger slices force a minimum frame size of
// 2x the slice, and smaller elements get the frame drawn past their bounds.
export const UI_GREEN_PIXEL_FRAME_SLICES = { top: 0.14, bottom: 0.14, left: 0.14, right: 0.14 }
export const UI_GREEN_PIXEL_FRAME_FILL = Color4.create(0.1, 0.2, 0.2, 0.8)
export const UI_GREEN_PIXEL_BUTTON_HOVER_FILL = Color4.create(0.15, 0.5, 0.25, 0.8)
export const UI_GREEN_PIXEL_BUTTON_HOVER_INSET = 8

