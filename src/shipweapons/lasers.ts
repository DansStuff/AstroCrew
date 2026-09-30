import { AudioSource, engine, Entity, Material, Transform, VisibilityComponent } from '@dcl/sdk/ecs'
import { Color4, Vector3 } from '@dcl/sdk/math'
import { isServer } from '@dcl/sdk/network'
import {
  SCENE_SHIP_POSITION,
  SHIP_LASER_BASE_FIRE_RATE,
  SHIP_LASER_EMISSIVE_INTENSITY,
  SHIP_LASER_LIFETIME_SECONDS,
  SHIP_LASER_LOCAL_ORIGIN_OFFSET,
  SHIP_LASER_MAX_TARGETERS,
  SHIP_LASER_OTHER_ORIGIN_OFFSET,
  SHIP_LASER_OTHER_ORIGIN_X_SPREAD,
  SHIP_LASER_OTHER_WIDTH,
  SHIP_LASER_POOL_SIZE,
  SHIP_LASER_SOUND_PATH,
  SHIP_LASER_SOUND_VOICES,
  SHIP_LASER_WIDTH,
  WEAPON_LIGHT_COLOR,
  WEAPON_LIGHT_OVERCHARGE_COLOR
} from '../constants'
import { createBeamStrip, poseBeamStrip } from '../effects/beamStrip'
import { isWeaponsOvercharged } from '../gamestate'
import { getLocalTargetTurret } from '../hazards/targeting'
import { forEachHazardLaserSource } from '../hazards/visuals'
import { ObjectPool } from '../objectPool'
import { getTurretView } from '../sceneObjects'
import { clampSimulationStep } from '../utilities'

type ActiveLaser = {
  entity: Entity
  origin: Vector3
  target: Entity
  remaining: number
  width: number
}

const fallbackLocalOrigin = Vector3.add(SCENE_SHIP_POSITION, SHIP_LASER_LOCAL_ORIGIN_OFFSET)
const otherOrigin = Vector3.add(SCENE_SHIP_POSITION, SHIP_LASER_OTHER_ORIGIN_OFFSET)

/** A fresh underside origin, shifted left or right so shots do not share one muzzle. */
function otherShotOrigin(): Vector3 {
  const x = (Math.random() * 2 - 1) * SHIP_LASER_OTHER_ORIGIN_X_SPREAD
  return Vector3.create(otherOrigin.x + x, otherOrigin.y, otherOrigin.z)
}

/** Muzzle of the weapon the local player locked from. */
function localOrigin(): Vector3 {
  const turret = getLocalTargetTurret()
  const view = turret ? getTurretView(turret) : undefined
  return view?.muzzle ?? fallbackLocalOrigin
}

let laserPool: ObjectPool<Entity>
const active: ActiveLaser[] = []
const localFireElapsed = new Map<Entity, number>()
const otherFireElapsed = new Map<Entity, number>()

const laserSoundEntities: Entity[] = []
let laserSoundIndex = 0

function applyLaserMaterial(entity: Entity, overcharged: boolean): void {
  const color = overcharged ? WEAPON_LIGHT_OVERCHARGE_COLOR : WEAPON_LIGHT_COLOR
  Material.setPbrMaterial(entity, {
    albedoColor: Color4.fromColor3(color),
    emissiveColor: color,
    emissiveIntensity: SHIP_LASER_EMISSIVE_INTENSITY,
    castShadows: false
  })
}

function createLaserEntity(): Entity {
  const entity = createBeamStrip(fallbackLocalOrigin, SHIP_LASER_WIDTH)
  applyLaserMaterial(entity, false)
  return entity
}

function resetLaser(entity: Entity): void {
  VisibilityComponent.getMutable(entity).visible = false
}

function acquireLaser(target: Entity, origin: Vector3, width: number): void {
  const entity = laserPool.acquire()
  applyLaserMaterial(entity, isWeaponsOvercharged())
  VisibilityComponent.getMutable(entity).visible = true
  if (Transform.has(target)) {
    poseBeamStrip(entity, origin, Transform.get(target).position, width)
  }
  active.push({ entity, origin, target, remaining: SHIP_LASER_LIFETIME_SECONDS, width })
  playLaserSound()
}

function releaseLaser(index: number): void {
  const laser = active[index]
  laserPool.release(laser.entity)
  active.splice(index, 1)
}

/** Fire `rate` shots per second at `hazard`. Each shot calls `originForShot`. The first shot fires immediately. */
function advanceStream(
  elapsedByHazard: Map<Entity, number>,
  hazard: Entity,
  rate: number,
  originForShot: () => Vector3,
  width: number,
  dt: number
): void {
  if (rate <= 0) {
    elapsedByHazard.delete(hazard)
    return
  }

  const interval = 1 / rate
  let elapsed = elapsedByHazard.get(hazard)
  if (elapsed === undefined) {
    elapsed = interval
  }
  elapsed += dt
  while (elapsed >= interval) {
    elapsed -= interval
    acquireLaser(hazard, originForShot(), width)
  }
  elapsedByHazard.set(hazard, elapsed)
}

function pruneDespawned(elapsedByHazard: Map<Entity, number>, seen: Set<Entity>): void {
  for (const entity of elapsedByHazard.keys()) {
    if (!seen.has(entity)) {
      elapsedByHazard.delete(entity)
    }
  }
}

function fireShots(dt: number): void {
  const seen = new Set<Entity>()
  const origin = localOrigin()

  forEachHazardLaserSource((entity, isLocalTarget, otherTargeters) => {
    seen.add(entity)
    const localRate = isLocalTarget ? SHIP_LASER_BASE_FIRE_RATE : 0
    const otherRate = SHIP_LASER_BASE_FIRE_RATE * Math.min(otherTargeters, SHIP_LASER_MAX_TARGETERS)
    advanceStream(localFireElapsed, entity, localRate, () => origin, SHIP_LASER_WIDTH, dt)
    advanceStream(otherFireElapsed, entity, otherRate, otherShotOrigin, SHIP_LASER_OTHER_WIDTH, dt)
  })

  pruneDespawned(localFireElapsed, seen)
  pruneDespawned(otherFireElapsed, seen)
}

function updateActive(dt: number): void {
  for (let i = active.length - 1; i >= 0; i--) {
    const laser = active[i]
    laser.remaining -= dt
    if (laser.remaining <= 0 || !Transform.has(laser.target)) {
      releaseLaser(i)
      continue
    }
    poseBeamStrip(laser.entity, laser.origin, Transform.get(laser.target).position, laser.width)
  }
}

function LaserSystem(dt: number): void {
  const step = clampSimulationStep(dt)
  fireShots(step)
  updateActive(step)
}

function createLaserSoundEntity(): Entity {
  const entity = engine.addEntity()
  Transform.create(entity, { position: Vector3.clone(fallbackLocalOrigin) })
  AudioSource.create(entity, {
    audioClipUrl: SHIP_LASER_SOUND_PATH,
    playing: false,
    loop: false,
    volume: 1
  })
  return entity
}

function playLaserSound(): void {
  const entity = laserSoundEntities[laserSoundIndex]
  laserSoundIndex = (laserSoundIndex + 1) % laserSoundEntities.length
  AudioSource.createOrReplace(entity, {
    audioClipUrl: SHIP_LASER_SOUND_PATH,
    playing: true,
    loop: false,
    volume: 1,
    currentTime: 0
  })
}

export function setupShipWeapons() {
  if (isServer()) return

  for (let i = 0; i < SHIP_LASER_SOUND_VOICES; i++) {
    laserSoundEntities.push(createLaserSoundEntity())
  }
  laserPool = new ObjectPool({
    create: createLaserEntity,
    reset: resetLaser,
    initialSize: SHIP_LASER_POOL_SIZE
  })
  engine.addSystem(LaserSystem)
}
