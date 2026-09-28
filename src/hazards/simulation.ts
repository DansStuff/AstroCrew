/**
 * Server hazard sim: spawn, targeting, damage, asteroid expiry, and saucer fire.
 * Does not call `room`; the state machine installs notify callbacks at setup.
 * Client visuals are in visuals.ts.
 */
import { engine, PlayerIdentityData } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { isServer } from '@dcl/sdk/network'
import {
  ASTEROID_SPAWN_SPREAD_X_DEGREES,
  ASTEROID_SPAWN_SPREAD_Y_DEGREES,
  HAZARD_DAMAGE_INTERVAL,
  HAZARD_SPAWN_DISTANCE,
  OVERCHARGE_DAMAGE_MULTIPLIER,
  ASTEROID_FLIGHT_TIME,
  SAUCER_APPROACH_SECONDS,
  SAUCER_FIRE_INTERVAL,
  SAUCER_HOVER_DISTANCE,
  SKILL_XP_PER_GUNNER_HIT,
  gunnerShotDamage,
  playerCountDamageMultiplier,
  type HazardKind,
  type TurretId
} from '../constants'
import { activateRandomBreach, damageShipHull, isWeaponsOvercharged } from '../gamestate'
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
  targetedBy: Set<string>
  damageElapsed: number
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
  notifyHazardSpawn: (data: {
    hazardId: number
    encounterId: string
    position: { x: number; y: number; z: number }
    flightTime: number
    kind: HazardKind
  }) => void
  notifyHazardTargeted: (data: { hazardId: number; targeters: string[] }) => void
  notifyHazardDestroyed: (data: { hazardId: number; hitShip: boolean }) => void
  notifySaucerFired: (data: {
    hazardId: number
    position: { x: number; y: number; z: number }
  }) => void
}

let liveHazards: LiveHazard[] = []
const playerTarget = new Map<string, number>()
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

function hazardSpawnMessage(hazard: LiveHazard) {
  return {
    hazardId: hazard.hazardId,
    encounterId: hazard.encounterId,
    position: hazard.position,
    flightTime: remainingFlightTime(hazard),
    kind: hazard.kind
  }
}

function clearTargeting() {
  playerTarget.clear()
}

function broadcastHazardTargeted(hazard: LiveHazard) {
  notifies?.notifyHazardTargeted({
    hazardId: hazard.hazardId,
    targeters: [...hazard.targetedBy]
  })
}

function clearHazardLockers(hazard: LiveHazard) {
  for (const address of hazard.targetedBy) {
    if (playerTarget.get(address) === hazard.hazardId) {
      playerTarget.delete(address)
    }
  }
  hazard.targetedBy.clear()
}

function openRandomBreach(): void {
  const breachId = activateRandomBreach(getKnownBreachIds())
  if (breachId !== null) {
    console.log(`[SERVER] Breach ${breachId} opened`)
  }
}

function damageHazard(hazardId: number, amount: number): boolean {
  const hazard = liveHazards.find((h) => h.hazardId === hazardId)
  if (!hazard) return false
  hazard.hp -= amount
  if (hazard.hp > 0) return true
  return destroyHazard(hazardId, false)
}

export function setPlayerTarget(playerAddress: string, hazardId: number) {
  const hazard = liveHazards.find((h) => h.hazardId === hazardId)
  if (!hazard) return

  const previousId = playerTarget.get(playerAddress)
  if (previousId === hazardId) return

  if (previousId !== undefined) {
    const previous = liveHazards.find((h) => h.hazardId === previousId)
    if (previous) {
      previous.targetedBy.delete(playerAddress)
      if (previous.targetedBy.size === 0) {
        previous.damageElapsed = 0
      }
      broadcastHazardTargeted(previous)
    }
  }

  hazard.targetedBy.add(playerAddress)
  playerTarget.set(playerAddress, hazardId)
  broadcastHazardTargeted(hazard)
  console.log(
    `[SERVER] Hazard ${hazardId} targeted by ${playerAddress} (count ${hazard.targetedBy.size})`
  )
}

/** Remove a live hazard and tell clients to despawn it. `hitShip` true = collided with the ship; false = shot. */
export function destroyHazard(hazardId: number, hitShip: boolean): boolean {
  const index = liveHazards.findIndex((h) => h.hazardId === hazardId)
  if (index < 0) return false
  const hazard = liveHazards[index]
  clearHazardLockers(hazard)
  liveHazards.splice(index, 1)
  if (hitShip) {
    if (hazard.kind === 'asteroid') {
      damageShipHull(hazard.impactDamage)
    }
    openRandomBreach()
  }
  notifies?.notifyHazardDestroyed({ hazardId, hitShip })
  console.log(`[SERVER] Hazard ${hazardId} destroyed (${hitShip ? 'hit ship' : 'shot'})`)
  return true
}

function nextBase(encounterId: string, position: Vector3, hp: number): HazardBase {
  return {
    hazardId: nextHazardId++,
    encounterId,
    position,
    hp,
    targetedBy: new Set(),
    damageElapsed: 0
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

function tickAsteroid(hazard: LiveAsteroid, dt: number): number | null {
  hazard.flightElapsed += dt
  if (hazard.flightElapsed >= hazard.flightTime) {
    return hazard.hazardId
  }
  return null
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

function tickTargetedDamage(dt: number): void {
  const lockedIds: number[] = []
  for (const hazard of liveHazards) {
    if (hazard.targetedBy.size > 0) {
      hazard.damageElapsed += dt
      lockedIds.push(hazard.hazardId)
    } else {
      hazard.damageElapsed = 0
    }
  }
  if (lockedIds.length === 0) return
  const crowdScale = playerCountDamageMultiplier(connectedPlayerCount())
  for (const hazardId of lockedIds) {
    const hazard = liveHazards.find((h) => h.hazardId === hazardId)
    if (!hazard) continue
    while (hazard.damageElapsed >= HAZARD_DAMAGE_INTERVAL) {
      hazard.damageElapsed -= HAZARD_DAMAGE_INTERVAL
      let amount = 0
      const multiplier = isWeaponsOvercharged() ? OVERCHARGE_DAMAGE_MULTIPLIER : 1
      for (const address of hazard.targetedBy) {
        const damage = Math.round(gunnerShotDamage(getGunnerLevel(address)) * multiplier * crowdScale)
        addDamage(address, damage)
        if (damage > 0) {
          awardSkillXp(address, 'gunner', SKILL_XP_PER_GUNNER_HIT)
        }
        amount += damage
      }
      if (amount <= 0) break
      if (!damageHazard(hazardId, amount)) break
    }
  }
}

export function tick(dt: number): void {
  const expiredIds: number[] = []
  for (const hazard of liveHazards) {
    if (hazard.kind === 'asteroid') {
      const expiredId = tickAsteroid(hazard, dt)
      if (expiredId !== null) expiredIds.push(expiredId)
    } else {
      tickSaucer(hazard, dt)
    }
  }
  for (const hazardId of expiredIds) {
    destroyHazard(hazardId, true)
  }

  tickTargetedDamage(dt)
}

export function hasLive(): boolean {
  return liveHazards.length > 0
}

/** Clear live hazards and targeting locks. Hazard ids keep incrementing. */
export function clearLive(): void {
  liveHazards = []
  clearTargeting()
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
