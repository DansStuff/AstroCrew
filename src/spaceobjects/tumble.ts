import { engine, Entity, Schemas, Transform, VisibilityComponent } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { HAZARD_SPIN_DEGREES_PER_SECOND } from '../constants'

/**
 * Apply local rotation on top of ProjectedBody celestial orientation.
 * With no fields set: random axis at HAZARD_SPIN_DEGREES_PER_SECOND (asteroids).
 * `axis` / `degreesPerSecond` override those (e.g. slow planet spin).
 */
export const Tumble = engine.defineComponent('Tumble', {
  axis: Schemas.Optional(Schemas.Vector3),
  degreesPerSecond: Schemas.Optional(Schemas.Float)
})

type TumbleState = { axis: Vector3; angle: number }
const tumbleState = new Map<Entity, TumbleState>()

function randomUnitAxis(): Vector3 {
  const theta = Math.random() * Math.PI * 2
  const z = Math.random() * 2 - 1
  const radius = Math.sqrt(1 - z * z)
  return Vector3.create(radius * Math.cos(theta), radius * Math.sin(theta), z)
}

/** Must run after ProjectedBodySystem, which overwrites Transform.rotation. */
export function TumbleSystem(dt: number) {
  for (const [entity, tumbleConfig] of engine.getEntitiesWith(Tumble, Transform)) {
    if (VisibilityComponent.has(entity) && !VisibilityComponent.get(entity).visible) continue

    let spin = tumbleState.get(entity)
    if (!spin) {
      spin = { axis: tumbleConfig.axis ?? randomUnitAxis(), angle: 0 }
      tumbleState.set(entity, spin)
    }
    spin.angle += dt * (tumbleConfig.degreesPerSecond ?? HAZARD_SPIN_DEGREES_PER_SECOND)
    const tumble = Quaternion.fromAngleAxis(spin.angle, spin.axis)
    const transform = Transform.getMutable(entity)
    transform.rotation = Quaternion.multiply(transform.rotation, tumble)
  }
}

export function forgetTumble(entity: Entity) {
  tumbleState.delete(entity)
}
