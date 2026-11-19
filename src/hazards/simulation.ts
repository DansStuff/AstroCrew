/**
 * Server hazard sim: spawn, targeting, damage, asteroid expiry, and saucer fire.
 * Does not call `room`; the state machine installs notify callbacks at setup.
 * Client visuals are in visuals.ts.
 */
import { engine, PlayerIdentityData } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { isServer } from '@dcl/sdk/network'
import {
  ASTEROID_FLIGHT_TIME,
  gunnerShotDamage,
  HAZARD_DAMAGE_INTERVAL,
  OVERCHARGE_DAMAGE_MULTIPLIER,
  playerCountDamageMultiplier,
  SAUCER_APPROACH_SECONDS,
  SAUCER_FIRE_INTERVAL,
  SKILL_XP_PER_GUNNER_HIT,
  type TurretId
} from '../gamebalance/constants'
import {
  ASTEROID_SPAWN_SPREAD_X_DEGREES,
  ASTEROID_SPAWN_SPREAD_Y_DEGREES,
  HAZARD_SPAWN_DISTANCE,
  SAUCER_HOVER_DISTANCE
} from './constants'
import { activateRandomBreach, damageShipHull, isWeaponsOvercharged } from '../gamestate'
import type {
  HazardHealthNotify,
  HazardImpactNotify,
  HazardSpawnNotify,
  HazardTargetedNotify,
  SaucerFiredNotify
} from '../gamestate/serverRoom'
import { addDamage } from '../players/contributions'
import { awardSkillXp, getGunnerLevel } from '../players/stats'
import { getKnownBreachIds, getTurretView } from '../sceneObjects'
import { shipVirtualPosition, shipVirtualRotation } from '../ship'
import { directionFromTo } from '../utilities'
import { setupHazardVisuals } from './visuals'

type HazardBase = {
  hazardId: number
  encounterId: string
  position: Vector3
  hp: number
  maxHp: number
}

type LiveAsteroid = HazardBase & {
  kind: 'asteroid'
  flightElapsed: number
  flightTime: number
  impactDamage: number
}

type LiveSaucer = HazardBase & {
  kind: 'saucer'
  approachElapsed: number
  approachTime: number
  fireElapsed: number
  fireInterval: number
  shotDamage: number
}

type LiveHazard = LiveAsteroid | LiveSaucer

type SpawnAsteroidOpts = {
  kind: 'asteroid'
  turret: TurretId
  hp: number
  impactDamage: number
}

type SpawnSaucerOpts = {
  kind: 'saucer'
  turret: TurretId
  hp: number
  shotDamage: number
}

type SpawnHazardOpts = SpawnAsteroidOpts | SpawnSaucerOpts

export type HazardNotifies = {
  notifyHazardSpawn: (data: HazardSpawnNotify) => void
  notifyHazardTargeted: (data: HazardTargetedNotify) => void
  notifyHazardHealth: (data: HazardHealthNotify) => void
  notifyHazardImpact: (data: HazardImpactNotify) => void
  notifySaucerFired: (data: SaucerFiredNotify) => void
}

/**
 * A player's lock, which belongs to the ship: it outlives the player's connection and is only
 * released when its hazard goes. Fires one shot every HAZARD_DAMAGE_INTERVAL on its own clock.
 */
type Targeter = {
  hazardId: number
  elapsed: number
}

let liveHazards: LiveHazard[] = []
/** Player address → their lock. The only record of who is targeting what. */
const targeters = new Map<string, Targeter>()
let nextHazardId = 1
let notifies: HazardNotifies | null = null

export function configureHazardNotifies(next: HazardNotifies): void {
  notifies = next
}

/**
 * Unit direction in virtual space from the weapon camera.
 * `yawDegrees` is left/right and `pitchDegrees` is up, both in the camera frame (+X right, +Y up, +Z look).
 */
function directionInTurretView(turret: TurretId, yawDegrees = 0, pitchDegrees = 0): Vector3 {
  const view = getTurretView(turret)
  const yaw = (yawDegrees * Math.PI) / 180
  const pitch = (pitchDegrees * Math.PI) / 180
  const cosPitch = Math.cos(pitch)
  const local = Vector3.create(Math.sin(yaw) * cosPitch, Math.sin(pitch), Math.cos(yaw) * cosPitch)
  const sceneDirection = view ? Vector3.rotate(local, view.rotation) : local
  return Vector3.rotate(sceneDirection, shipVirtualRotation)
}

function asteroidSpawnDirection(turret: TurretId): Vector3 {
  const yaw = (Math.random() * 2 - 1) * ASTEROID_SPAWN_SPREAD_X_DEGREES
  const pitch = Math.random() * ASTEROID_SPAWN_SPREAD_Y_DEGREES
  return directionInTurretView(turret, yaw, pitch)
}

function remainingFlightTime(hazard: LiveHazard): number {
  if (hazard.kind === 'asteroid') {
    return Math.max(0, hazard.flightTime - hazard.flightElapsed)
  }
  return Math.max(0, hazard.approachTime - hazard.approachElapsed)
}

function hazardSpawnMessage(hazard: LiveHazard): HazardSpawnNotify {
  return {
    hazardId: hazard.hazardId,
    encounterId: hazard.encounterId,
    position: hazard.position,
    flightTime: remainingFlightTime(hazard),
    kind: hazard.kind,
    hp: hazard.hp,
    maxHp: hazard.maxHp
  }
}

function findLive(hazardId: number): LiveHazard | undefined {
  return liveHazards.find((h) => h.hazardId === hazardId)
}

/** Drop a hazard and every lock on it. Clients release their copy of the locks when they despawn it. */
function removeLive(hazard: LiveHazard): void {
  const index = liveHazards.indexOf(hazard)
  if (index < 0) return
  liveHazards.splice(index, 1)
  for (const [address, targeter] of targeters) {
    if (targeter.hazardId === hazard.hazardId) targeters.delete(address)
  }
}

function openRandomBreach(): void {
  const breachId = activateRandomBreach(getKnownBreachIds())
  if (breachId !== null) {
    console.log(`[SERVER] Breach ${breachId} opened`)
  }
}

/**
 * Lock `playerAddress` onto `hazardId`. A new lock fires on the next tick. Switching keeps the
 * player's shot clock, so retargeting can never fire faster than one shot per interval.
 */
export function setPlayerTarget(playerAddress: string, hazardId: number) {
  if (!findLive(hazardId)) return

  const targeter = targeters.get(playerAddress)
  if (targeter?.hazardId === hazardId) return

  if (targeter) {
    targeter.hazardId = hazardId
  } else {
    targeters.set(playerAddress, { hazardId, elapsed: HAZARD_DAMAGE_INTERVAL })
  }
  notifies?.notifyHazardTargeted({ hazardId, targeter: playerAddress })
  console.log(`[SERVER] Hazard ${hazardId} targeted by ${playerAddress}`)
}

/** An asteroid reached the ship: hull damage, a breach, and clients play the impact and despawn it. */
function impactShip(hazard: LiveAsteroid): void {
  removeLive(hazard)
  damageShipHull(hazard.impactDamage)
  openRandomBreach()
  notifies?.notifyHazardImpact({ hazardId: hazard.hazardId })
  console.log(`[SERVER] Hazard ${hazard.hazardId} hit the ship`)
}

function nextBase(encounterId: string, position: Vector3, hp: number): HazardBase {
  return {
    hazardId: nextHazardId++,
    encounterId,
    position,
    hp,
    maxHp: hp
  }
}

export function spawn(encounterId: string, opts: SpawnHazardOpts): number {
  const direction =
    opts.kind === 'asteroid' ? asteroidSpawnDirection(opts.turret) : directionInTurretView(opts.turret)
  const position = Vector3.add(shipVirtualPosition, Vector3.scale(direction, HAZARD_SPAWN_DISTANCE))
  const base = nextBase(encounterId, position, opts.hp)
  const hazard: LiveHazard =
    opts.kind === 'asteroid'
      ? {
          ...base,
          kind: 'asteroid',
          flightElapsed: 0,
          flightTime: ASTEROID_FLIGHT_TIME,
          impactDamage: opts.impactDamage
        }
      : {
          ...base,
          kind: 'saucer',
          approachElapsed: 0,
          approachTime: SAUCER_APPROACH_SECONDS,
          fireElapsed: 0,
          fireInterval: SAUCER_FIRE_INTERVAL,
          shotDamage: opts.shotDamage
        }
  liveHazards.push(hazard)
  notifies?.notifyHazardSpawn(hazardSpawnMessage(hazard))
  return hazard.hazardId
}

/** True once the asteroid has reached the ship. */
function tickAsteroid(hazard: LiveAsteroid, dt: number): boolean {
  hazard.flightElapsed += dt
  return hazard.flightElapsed >= hazard.flightTime
}

function tickSaucer(hazard: LiveSaucer, dt: number): void {
  hazard.approachElapsed += dt
  if (hazard.approachElapsed < hazard.approachTime) return
  if (hazard.fireInterval <= 0) return
  hazard.fireElapsed += dt
  while (hazard.fireElapsed >= hazard.fireInterval) {
    hazard.fireElapsed -= hazard.fireInterval
    damageShipHull(hazard.shotDamage)
    openRandomBreach()
    const dir = directionFromTo(shipVirtualPosition, hazard.position)
    notifies?.notifySaucerFired({
      hazardId: hazard.hazardId,
      position: Vector3.add(shipVirtualPosition, Vector3.scale(dir, SAUCER_HOVER_DISTANCE))
    })
    console.log(`[SERVER] Saucer ${hazard.hazardId} fired`)
  }
}

function connectedPlayerCount(): number {
  return Array.from(engine.getEntitiesWith(PlayerIdentityData)).length
}

/**
 * One laser shot from `address`. Each shot is one health message, which clients also play
 * as the laser. A message with hp 0 means the shot destroyed the hazard; there is no separate destroy message.
 */
function fireShot(address: string, hazardId: number, damageScale: number): void {
  const hazard = findLive(hazardId)
  if (!hazard) return
  const damage = Math.round(gunnerShotDamage(getGunnerLevel(address)) * damageScale)
  if (damage <= 0) return
  addDamage(address, damage)
  awardSkillXp(address, 'gunner', SKILL_XP_PER_GUNNER_HIT)
  hazard.hp -= damage
  notifies?.notifyHazardHealth({ hazardId, hp: Math.max(0, hazard.hp), shooter: address })
  if (hazard.hp <= 0) {
    removeLive(hazard)
    console.log(`[SERVER] Hazard ${hazardId} shot down by ${address}`)
  }
}

function tickTargeters(dt: number): void {
  if (targeters.size === 0) return
  const overcharge = isWeaponsOvercharged() ? OVERCHARGE_DAMAGE_MULTIPLIER : 1
  const damageScale = overcharge * playerCountDamageMultiplier(connectedPlayerCount())
  // A kill deletes that hazard's locks mid-loop; Map iteration skips deleted entries.
  for (const [address, targeter] of targeters) {
    targeter.elapsed += dt
    while (targeter.elapsed >= HAZARD_DAMAGE_INTERVAL && targeters.get(address) === targeter) {
      targeter.elapsed -= HAZARD_DAMAGE_INTERVAL
      fireShot(address, targeter.hazardId, damageScale)
    }
  }
}

export function tick(dt: number): void {
  const arrived: LiveAsteroid[] = []
  for (const hazard of liveHazards) {
    if (hazard.kind === 'asteroid') {
      if (tickAsteroid(hazard, dt)) arrived.push(hazard)
    } else {
      tickSaucer(hazard, dt)
    }
  }
  for (const asteroid of arrived) {
    impactShip(asteroid)
  }

  tickTargeters(dt)
}

export function hasLive(): boolean {
  return liveHazards.length > 0
}

/** Clear live hazards and targeting locks. Hazard ids keep incrementing. */
export function clearLive(): void {
  liveHazards = []
  targeters.clear()
}

/** Clear live hazards and reset hazard ids for a new mission. */
export function resetLive(): void {
  clearLive()
  nextHazardId = 1
}

export function setupHazards() {
  if (isServer()) return
  setupHazardVisuals()
}
