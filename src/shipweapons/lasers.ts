import { AudioSource, engine, Entity, Material, Transform, VisibilityComponent } from '@dcl/sdk/ecs'
import { Color4, Vector3 } from '@dcl/sdk/math'
import { isServer } from '@dcl/sdk/network'
import { SCENE_SHIP_POSITION } from '../constants'
import {
  SHIP_LASER_EMISSIVE_INTENSITY,
  SHIP_LASER_LIFETIME_SECONDS,
  SHIP_LASER_LOCAL_ORIGIN_OFFSET,
  SHIP_LASER_OTHER_ORIGIN_OFFSET,
  SHIP_LASER_OTHER_ORIGIN_X_SPREAD,
  SHIP_LASER_OTHER_WIDTH,
  SHIP_LASER_POOL_SIZE,
  SHIP_LASER_SOUND_PATH,
  SHIP_LASER_SOUND_VOICES,
  SHIP_LASER_WIDTH,
  WEAPON_LIGHT_COLOR,
  WEAPON_LIGHT_OVERCHARGE_COLOR
} from './constants'
import { createBeamStrip, poseBeamStrip } from '../effects/beamStrip'
import { isWeaponsOvercharged } from '../gamestate'
import { getLocalTargetTurret } from '../hazards/targeting'
import { ObjectPool } from '../objectPool'
import { getTurretView } from '../sceneObjects'
import { clampSimulationStep } from '../utilities'

type ActiveLaser = {
  entity: Entity
  origin: Vector3
  target: Entity
  remaining: number
  /** Peak width, reached halfway through the shot. */
  width: number
}

/** Width over a shot's life: 0 → `peak` → 0 along half a sine wave. */
function pulsedLaserWidth(peak: number, remaining: number): number {
  const t = 1 - remaining / SHIP_LASER_LIFETIME_SECONDS
  return peak * Math.sin(Math.PI * Math.min(1, Math.max(0, t)))
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
    poseBeamStrip(entity, origin, Transform.get(target).position, 0)
  }
  active.push({ entity, origin, target, remaining: SHIP_LASER_LIFETIME_SECONDS, width })
  playLaserSound()
}

function releaseLaser(index: number): void {
  const laser = active[index]
  laserPool.release(laser.entity)
  active.splice(index, 1)
}

/**
 * Play one shot at `target`. Called once per server damage message, so shots match hits.
 * The local player's shots come from the weapon they locked from; other players' from below the hull.
 */
export function fireShipLaser(target: Entity, fromLocalPlayer: boolean): void {
  if (fromLocalPlayer) {
    acquireLaser(target, localOrigin(), SHIP_LASER_WIDTH)
  } else {
    acquireLaser(target, otherShotOrigin(), SHIP_LASER_OTHER_WIDTH)
  }
}

function updateActive(dt: number): void {
  for (let i = active.length - 1; i >= 0; i--) {
    const laser = active[i]
    laser.remaining -= dt
    if (laser.remaining <= 0 || !Transform.has(laser.target)) {
      releaseLaser(i)
      continue
    }
    const width = pulsedLaserWidth(laser.width, laser.remaining)
    poseBeamStrip(laser.entity, laser.origin, Transform.get(laser.target).position, width)
  }
}

function LaserSystem(dt: number): void {
  updateActive(clampSimulationStep(dt))
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
