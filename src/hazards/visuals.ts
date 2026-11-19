import { Animator, ColliderLayer, engine, Entity, GltfContainer, Transform, VisibilityComponent } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { CAMERA_SHAKE_HAZARD_IMPACT_INTENSITY, CAMERA_SHAKE_SAUCER_SHOT_INTENSITY } from '../effects/constants'
import { type HazardKind } from '../gamebalance/constants'
import {
  HAZARD_ASTEROID_MODEL_PATH,
  HAZARD_ASTEROID_POOL_SIZE,
  HAZARD_HIT_SHIP_SOUND_PATH,
  HAZARD_IMPACT_DISTANCE,
  HAZARD_RADIUS,
  HAZARD_SAUCER_MODEL_PATH,
  HAZARD_SAUCER_POOL_SIZE,
  HAZARD_SAUCER_RADIUS,
  SAUCER_HOVER_DISTANCE
} from './constants'
import { ASTEROID_ENCLOSING_SPHERE_RADIUS } from '../spaceobjects/constants'
import { playGlobalSound } from '../audio/global'
import { room } from '../networking/messages'
import { shakeCameras, shakeShip } from '../effects/cameraShake'
import { ObjectPool } from '../objectPool'
import { fireShipLaser } from '../shipweapons/lasers'
import { shipVirtualPosition } from '../ship'
import { ProjectedBody } from '../spaceobjects/projection'
import { forgetTumble, Tumble } from '../spaceobjects/tumble'
import { clampSimulationStep, directionFromTo } from '../utilities'
import { createHealthBar, hideHealthBar, setHealthBarFraction, setupHealthBars, type HealthBar } from './healthBar'
import { createTargetingReticule, hideReticule, type TargetingReticule } from './reticule'
import {
  advanceSaucerBeamPulse,
  createSaucerBeam,
  hideSaucerBeam,
  updateSaucerBeam,
  type SaucerBeam
} from './saucerBeam'
import {
  applyTargetingAppearance,
  isLocalPlayer,
  releaseAllLocks,
  releaseLocks,
  setLock,
  setupHazardTargeting
} from './targeting'

/** Pooled entity tree for one hazard. Reset to hidden when released. */
type HazardVisuals = {
  kind: HazardKind
  entity: Entity
  reticule: TargetingReticule
  healthBar: HealthBar
  beam?: SaucerBeam
}

export type SpawnedHazard = {
  hazardId: number
  encounterId: string
  visuals: HazardVisuals
  hp: number
  maxHp: number
  start: Vector3
  end: Vector3
  flightTime: number
  elapsed: number
}

type HazardSpawnData = {
  hazardId: number
  encounterId: string
  position: Vector3
  flightTime: number
  kind: string
  hp: number
  maxHp: number
}

let asteroidPool: ObjectPool<HazardVisuals>
let saucerPool: ObjectPool<HazardVisuals>

const spawned: SpawnedHazard[] = []

function hazardPool(kind: HazardKind): ObjectPool<HazardVisuals> {
  return kind === 'saucer' ? saucerPool : asteroidPool
}

function parseHazardKind(value: string): HazardKind {
  return value === 'saucer' ? 'saucer' : 'asteroid'
}

/** Client-only incoming hazard. ProjectedBodySystem projects `ProjectedBody.position`. */
function createHazardVisuals(kind: HazardKind): HazardVisuals {
  const entity = engine.addEntity()
  const isSaucer = kind === 'saucer'
  GltfContainer.create(entity, {
    src: isSaucer ? HAZARD_SAUCER_MODEL_PATH : HAZARD_ASTEROID_MODEL_PATH,
    visibleMeshesCollisionMask: ColliderLayer.CL_CUSTOM1,
    invisibleMeshesCollisionMask: ColliderLayer.CL_NONE
  })
  Transform.create(entity, { position: Vector3.Zero() })
  ProjectedBody.create(entity, {
    position: Vector3.Zero(),
    radius: isSaucer ? HAZARD_SAUCER_RADIUS : HAZARD_RADIUS,
    shellRadius: ASTEROID_ENCLOSING_SPHERE_RADIUS
  })
  if (isSaucer) {
    Animator.create(entity, {
      states: [
        {
          clip: 'Spin',
          playing: true,
          weight: 1,
          speed: 1,
          loop: true,
          shouldReset: true
        }
      ]
    })
  } else {
    Tumble.create(entity, {})
  }
  VisibilityComponent.create(entity, { visible: false })

  return {
    kind,
    entity,
    reticule: createTargetingReticule(entity),
    healthBar: createHealthBar(entity, kind),
    beam: isSaucer ? createSaucerBeam() : undefined
  }
}

function acquireHazard(kind: HazardKind, virtualPosition: Vector3, radius: number): HazardVisuals {
  const visuals = hazardPool(kind).acquire()
  const body = ProjectedBody.getMutable(visuals.entity)
  body.position = Vector3.clone(virtualPosition)
  body.radius = radius
  Transform.getMutable(visuals.entity).position = Vector3.clone(virtualPosition)
  VisibilityComponent.getMutable(visuals.entity).visible = true
  return visuals
}

function resetHazard(visuals: HazardVisuals) {
  if (visuals.kind === 'asteroid') {
    forgetTumble(visuals.entity)
  }
  hideReticule(visuals.reticule)
  hideHealthBar(visuals.healthBar)
  if (visuals.beam) hideSaucerBeam(visuals.beam)
  VisibilityComponent.getMutable(visuals.entity).visible = false
}

function releaseHazard(hazard: SpawnedHazard) {
  hazardPool(hazard.visuals.kind).release(hazard.visuals)
}

function findSpawnedHazard(hazardId: number): SpawnedHazard | undefined {
  return spawned.find((hazard) => hazard.hazardId === hazardId)
}

function virtualApproachPath(spawnPosition: Vector3, endDistance: number): { start: Vector3; end: Vector3 } {
  const dir = directionFromTo(shipVirtualPosition, spawnPosition)
  const start = Vector3.clone(spawnPosition)
  const end = Vector3.add(shipVirtualPosition, Vector3.scale(dir, endDistance))
  return { start, end }
}

function applyVirtualPosition(hazard: SpawnedHazard) {
  const duration = hazard.flightTime
  const u = duration <= 1e-6 ? 1 : Math.min(1, hazard.elapsed / duration)
  ProjectedBody.getMutable(hazard.visuals.entity).position = Vector3.lerp(hazard.start, hazard.end, u)
}

function spawnHazard(data: HazardSpawnData) {
  if (findSpawnedHazard(data.hazardId)) return
  const kind = parseHazardKind(data.kind)
  const endDistance = kind === 'saucer' ? SAUCER_HOVER_DISTANCE : HAZARD_IMPACT_DISTANCE
  const path = virtualApproachPath(data.position, endDistance)
  const radius = kind === 'saucer' ? HAZARD_SAUCER_RADIUS : HAZARD_RADIUS
  const hazard: SpawnedHazard = {
    hazardId: data.hazardId,
    encounterId: data.encounterId,
    visuals: acquireHazard(kind, path.start, radius),
    hp: data.hp,
    maxHp: data.maxHp,
    start: path.start,
    end: path.end,
    flightTime: data.flightTime,
    elapsed: 0
  }
  spawned.push(hazard)
  applyVirtualPosition(hazard)
  applyTargetingAppearance(hazard)
  setHealthBarFraction(hazard.visuals.healthBar, hazard.hp, hazard.maxHp)
  console.log(`[CLIENT] Hazard ${data.hazardId} (${kind}) spawned for ${data.encounterId}`)
}

function despawnHazard(hazardId: number) {
  releaseLocks(hazardId)
  const index = spawned.findIndex((hazard) => hazard.hazardId === hazardId)
  if (index < 0) return
  const [hazard] = spawned.splice(index, 1)
  releaseHazard(hazard)
}

export function despawnEncounter(encounterId: string) {
  for (let i = spawned.length - 1; i >= 0; i--) {
    if (spawned[i].encounterId !== encounterId) continue
    const [hazard] = spawned.splice(i, 1)
    releaseLocks(hazard.hazardId)
    releaseHazard(hazard)
  }
}

export function despawnAllHazards() {
  releaseAllLocks()
  const hazards = spawned.splice(0, spawned.length)
  for (const hazard of hazards) {
    releaseHazard(hazard)
  }
}

function HazardFlightSystem(dt: number) {
  const step = clampSimulationStep(dt)
  for (const hazard of spawned) {
    hazard.elapsed += step
    applyVirtualPosition(hazard)
  }
}

function SaucerBeamSystem(dt: number) {
  const step = clampSimulationStep(dt)
  advanceSaucerBeamPulse(step)
  for (const hazard of spawned) {
    const { beam, entity } = hazard.visuals
    if (!beam) continue
    const hovering = hazard.elapsed >= hazard.flightTime
    updateSaucerBeam(beam, entity, hovering, step)
  }
}

export function setupHazardVisuals() {
  asteroidPool = new ObjectPool({
    create: () => createHazardVisuals('asteroid'),
    reset: resetHazard,
    initialSize: HAZARD_ASTEROID_POOL_SIZE
  })
  saucerPool = new ObjectPool({
    create: () => createHazardVisuals('saucer'),
    reset: resetHazard,
    initialSize: HAZARD_SAUCER_POOL_SIZE
  })

  engine.addSystem(HazardFlightSystem)
  engine.addSystem(SaucerBeamSystem)
  setupHealthBars()
  setupHazardTargeting(spawned)

  room.onMessage('notifyHazardSpawn', spawnHazard)

  room.onMessage('notifyHazardImpact', (data) => {
    console.log(`[CLIENT] Hazard ${data.hazardId} hit the ship`)
    playGlobalSound(HAZARD_HIT_SHIP_SOUND_PATH)
    shakeCameras(CAMERA_SHAKE_HAZARD_IMPACT_INTENSITY)
    shakeShip(CAMERA_SHAKE_HAZARD_IMPACT_INTENSITY)
    despawnHazard(data.hazardId)
  })

  room.onMessage('notifyHazardTargeted', (data) => {
    console.log(`[CLIENT] Hazard ${data.hazardId} targeted by ${data.targeter}`)
    const previousId = setLock(data.targeter, data.hazardId)
    for (const hazardId of [previousId, data.hazardId]) {
      const hazard = hazardId === undefined ? undefined : findSpawnedHazard(hazardId)
      if (hazard) applyTargetingAppearance(hazard)
    }
  })

  room.onMessage('notifyHazardHealth', (data) => {
    const hazard = findSpawnedHazard(data.hazardId)
    if (!hazard) return
    hazard.hp = data.hp
    setHealthBarFraction(hazard.visuals.healthBar, hazard.hp, hazard.maxHp)
    fireShipLaser(hazard.visuals.entity, isLocalPlayer(data.shooter))
    if (data.hp <= 0) {
      console.log(`[CLIENT] Hazard ${data.hazardId} shot down by ${data.shooter}`)
      despawnHazard(data.hazardId)
    }
  })

  room.onMessage('notifySaucerFired', (data) => {
    console.log(`[CLIENT] Saucer ${data.hazardId} fired`)
    shakeCameras(CAMERA_SHAKE_SAUCER_SHOT_INTENSITY)
    shakeShip(CAMERA_SHAKE_SAUCER_SHOT_INTENSITY)
  })
}
