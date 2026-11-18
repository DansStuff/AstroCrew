import { engine, InputAction, inputSystem, PointerEventType } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { movePlayerTo } from '~system/RestrictedActions'
import { SCENE_SHIP_POSITION, SIMULATION_MAX_DELTA_SECONDS } from './constants'
/** Frame `dt` capped at SIMULATION_MAX_DELTA_SECONDS so a hitch cannot jump the sim too far. */
export function clampSimulationStep(dt: number): number {
  return Math.min(dt, SIMULATION_MAX_DELTA_SECONDS)
}

/**
 * Returns the conjugate of a quaternion (-x, -y, -z, w).
 * For unit quaternions (the kind used for rotations), the conjugate is the inverse.
 */
export function conjugateQuaternion(rotation: Quaternion): Quaternion.Mutable {
  return Quaternion.create(-rotation.x, -rotation.y, -rotation.z, rotation.w)
}

/**
 * Rotates a vector by the inverse of a rotation quaternion.
 * Useful for taking a world-space direction into the ship's local frame.
 */
export function rotateByInverse(vector: Vector3, rotation: Quaternion): Vector3.Mutable {
  // Step 1: invert the rotation (conjugate for unit quaternions).
  const inverse = conjugateQuaternion(rotation)
  // Step 2: apply that inverse rotation to the vector.
  return Vector3.rotate(vector, inverse)
}

/**
 * Returns the unit direction from `from` toward `to`.
 * If the points are nearly the same, returns `fallback` so callers never get a zero vector.
 */
export function directionFromTo(
  from: Vector3,
  to: Vector3,
  fallback: Vector3 = Vector3.Forward()
): Vector3.Mutable {
  // Step 1: vector pointing from the ship toward the planet in virtual space.
  const offset = Vector3.subtract(to, from)
  // Step 2: measure how far apart they are.
  const length = Vector3.length(offset)
  // Step 3: if they coincide, there is no meaningful direction — use the fallback.
  if (length < 1e-8) {
    return Vector3.clone(fallback)
  }
  // Step 4: normalize to unit length (direction only, no distance).
  return Vector3.scale(offset, 1 / length)
}

/**
 * Debug helper: teleport the local player back to the ship / enclosing-sphere center.
 *
 * Decentraland does not expose letter keys (including "T") as InputActions, so this
 * listens for IA_ACTION_3 — the "1" key on desktop.
 */
export function setupDebugTeleportToShip() {
  engine.addSystem(function debugTeleportToShipSystem() {
    if (inputSystem.isTriggered(InputAction.IA_ACTION_3, PointerEventType.PET_DOWN)) {
      void movePlayerTo({ newRelativePosition: SCENE_SHIP_POSITION })
    }
  })
}
