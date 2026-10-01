import { engine, Entity, Name, Schemas, Transform, VirtualCamera } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'
import { EntityNames } from '../../assets/scene/entity-names'
import {
  CAMERA_SHAKE_DEFAULT_DURATION_SECONDS,
  CAMERA_SHAKE_DEFAULT_INTENSITY,
  CAMERA_SHAKE_MAX_ANGLE_DEGREES,
  CAMERA_SHAKE_MAX_OFFSET
} from '../constants'

/** Active shake. `basePosition` / `baseRotation` are the rest pose restored when the shake ends. */
export const CameraShake = engine.defineComponent('CameraShake', {
  basePosition: Schemas.Vector3,
  baseRotation: Schemas.Quaternion,
  intensity: Schemas.Float,
  duration: Schemas.Float,
  elapsed: Schemas.Float
})

/** Shake one entity around its current pose. Overlapping shakes keep the stronger intensity and longer remaining time. */
export function shakeEntity(
  entity: Entity,
  intensity = CAMERA_SHAKE_DEFAULT_INTENSITY,
  durationSeconds = CAMERA_SHAKE_DEFAULT_DURATION_SECONDS
): void {
  if (intensity <= 0 || durationSeconds <= 0 || !Transform.has(entity)) return

  const active = CameraShake.getMutableOrNull(entity)
  if (!active) {
    const pose = Transform.get(entity)
    CameraShake.create(entity, {
      basePosition: Vector3.clone(pose.position),
      baseRotation: Quaternion.create(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w),
      intensity,
      duration: durationSeconds,
      elapsed: 0
    })
    return
  }

  active.intensity = Math.max(active.intensity, intensity)
  if (durationSeconds > active.duration - active.elapsed) {
    active.duration = durationSeconds
    active.elapsed = 0
  }
}

/** Shake every VirtualCamera in the scene, whether or not it is the active view. */
export function shakeCameras(
  intensity = CAMERA_SHAKE_DEFAULT_INTENSITY,
  durationSeconds = CAMERA_SHAKE_DEFAULT_DURATION_SECONDS
): void {
  for (const [entity] of engine.getEntitiesWith(VirtualCamera, Transform)) {
    shakeEntity(entity, intensity, durationSeconds)
  }
}

let shipEntity: Entity | undefined

function findShip(): Entity | undefined {
  if (shipEntity !== undefined && Transform.has(shipEntity)) return shipEntity
  shipEntity = undefined
  for (const [entity, name] of engine.getEntitiesWith(Name)) {
    if (name.value === EntityNames.Ship) {
      shipEntity = entity
      break
    }
  }
  return shipEntity
}

/** Shake the Ship entity (and everything parented to it). */
export function shakeShip(
  intensity = CAMERA_SHAKE_DEFAULT_INTENSITY,
  durationSeconds = CAMERA_SHAKE_DEFAULT_DURATION_SECONDS
): void {
  if (isMobile()) return
  const ship = findShip()
  if (ship !== undefined) shakeEntity(ship, intensity, durationSeconds)
}

function randomSigned(): number {
  return Math.random() * 2 - 1
}

export function CameraShakeSystem(dt: number): void {
  for (const [entity, shake] of engine.getEntitiesWith(CameraShake, Transform)) {
    const elapsed = shake.elapsed + dt
    const transform = Transform.getMutable(entity)

    if (elapsed >= shake.duration) {
      transform.position = Vector3.clone(shake.basePosition)
      transform.rotation = Quaternion.create(
        shake.baseRotation.x,
        shake.baseRotation.y,
        shake.baseRotation.z,
        shake.baseRotation.w
      )
      CameraShake.deleteFrom(entity)
      continue
    }
    CameraShake.getMutable(entity).elapsed = elapsed

    const falloff = 1 - elapsed / shake.duration
    const strength = shake.intensity * falloff * falloff
    const offset = Vector3.scale(
      Vector3.create(randomSigned(), randomSigned(), randomSigned()),
      strength * CAMERA_SHAKE_MAX_OFFSET
    )
    const maxAngle = strength * CAMERA_SHAKE_MAX_ANGLE_DEGREES
    const jitter = Quaternion.fromEulerDegrees(
      randomSigned() * maxAngle,
      randomSigned() * maxAngle,
      randomSigned() * maxAngle
    )

    transform.position = Vector3.add(shake.basePosition, Vector3.rotate(offset, shake.baseRotation))
    transform.rotation = Quaternion.multiply(shake.baseRotation, jitter)
  }
}
