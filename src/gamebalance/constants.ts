// MARK: Difficulty
// Combat, survivability, and encounter pacing. Presentation and sim tuning live in each domain folder.

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
 * Seconds between shots from each gunner locked on a hazard. Every shot is one damage
 * message, which clients also play as that gunner's laser. A new lock fires immediately;
 * switching targets keeps the gunner's shot clock.
 */
export const HAZARD_DAMAGE_INTERVAL = 0.5

/** Damage dealt by a level 1 gunner each shot. */
export const GUNNER_BASE_DAMAGE = 12
/** Extra damage per gunner level above 1. Level 2 = 12, level 10 = 28. */
export const GUNNER_DAMAGE_PER_LEVEL = 2

/** HP of an asteroid at encounter hpMultiplier 1. One level 1 gunner: 8 shots × 12 damage, 3.5s TTK. */
export const BASE_ASTEROID_HP = 90
/** Hull damage when an asteroid reaches the ship at encounter damageMultiplier 1. */
export const BASE_ASTEROID_DAMAGE = 10
/** HP of a saucer at encounter hpMultiplier 1. One level 1 gunner: 13 shots × 12 damage, 6s TTK. */
export const BASE_SAUCER_HP = 150
/** Hull damage per saucer shot at encounter damageMultiplier 1. */
export const BASE_SAUCER_DAMAGE = 8

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
/** Gunner XP granted for each shot that deals damage. */
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
export const ASTEROID_FLIGHT_TIME = 11

// HP multipliers run linearly from 0.8 to 3 across the seven stops. Drenovar overrides the final 3.
export const ENCOUNTER_PARAMS: Record<string, EncounterParams> = {
  Terra: {
    hpMultiplier: 0.8,
    damageMultiplier: 1,
    stages: [

      { kind: 'asteroid', turret: 'center', hazardCount: 2 },
      { kind: 'asteroid', turret: 'left', hazardCount: 2 },
      { kind: 'asteroid', turret: 'right', hazardCount: 2 }
    ]
  },
  Vaelith: {
    hpMultiplier: 1.17,
    damageMultiplier: 1.17,
    stages: [
      { kind: 'saucer', turret: 'center' },
      { kind: 'saucer', turret: 'right' },
      { kind: 'saucer', turret: 'left' }
    ]
  },
  Korund: {
    hpMultiplier: 1.53,
    damageMultiplier: 1.33,
    stages: [
      { kind: 'asteroid', turret: 'right', hazardCount: 4 },
      { kind: 'asteroid', turret: 'left', hazardCount: 4 },
      { kind: 'saucer', turret: 'right' },
    ]
  },
  Sablemere: {
    hpMultiplier: 1.9,
    damageMultiplier: 1.5,
    stages: [
      { kind: 'asteroid', turret: 'right', hazardCount: 4 },
      { kind: 'saucer', turret: 'left' },
      { kind: 'asteroid', turret: 'right', hazardCount: 4 }
    ]
  },
  Orpheon: {
    hpMultiplier: 2.27,
    damageMultiplier: 1.67,
    stages: [
      { kind: 'saucer', turret: 'right' },
      { kind: 'asteroid', turret: 'center', hazardCount: 6 },
      { kind: 'saucer', turret: 'left' },
      { kind: 'asteroid', turret: 'center', hazardCount: 6 },
    ]
  },
  Caelum: {
    hpMultiplier: 2.63,
    damageMultiplier: 1.83,
    stages: [
      { kind: 'asteroid', turret: 'left', hazardCount: 4 },
      { kind: 'asteroid', turret: 'right', hazardCount: 4 },
      { kind: 'asteroid', turret: 'center', hazardCount: 4 },
      { kind: 'asteroid', turret: 'left', hazardCount: 4 },
      { kind: 'asteroid', turret: 'right', hazardCount: 4 },
      { kind: 'asteroid', turret: 'center', hazardCount: 4 }
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

/*
export const ENCOUNTER_PARAMS: Record<string, EncounterParams> = {
  Terra: {
    hpMultiplier: 1,
    damageMultiplier: 1000,
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
*/
