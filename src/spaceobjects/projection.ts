import { engine, Schemas, Transform, VisibilityComponent } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { SCENE_SHIP_POSITION, SHIP_INTERIOR_RADIUS } from '../constants'
import { CELESTIAL_SPHERE_INSET, PLANET_ENCLOSING_SPHERE_RADIUS, PROJECTED_BODY_MIN_SCALE } from './constants'
import { shipVirtualPosition, shipVirtualRotation } from '../ship'
import { conjugateQuaternion, directionFromTo, rotateByInverse } from '../utilities'

/**
 * Virtual-space body projected onto a scene enclosing sphere.
 * `shellRadius` chooses the planet shell vs the closer asteroid/saucer shell.
 */
export const ProjectedBody = engine.defineComponent('ProjectedBody', {
  position: Schemas.Vector3,
  radius: Schemas.Float,
  shellRadius: Schemas.Float
})

/**
 * Angular radius (radians) of a virtual body as seen from the ship.
 * Uses the sphere relation sin(α) = radius / distance when the body is not engulfing.
 */
export function virtualAngularRadius(virtualRadius: number, virtualDistance: number): number {
  if (virtualDistance < 1e-8) {
    return Math.PI / 2
  }
  const ratio = virtualRadius / virtualDistance
  if (ratio >= 1) {
    return Math.PI / 2
  }
  return Math.asin(ratio)
}

/**
 * Transform scale for a radius-1 mesh so it subtends `angularRadius` at
 * `distanceFromViewer` (player → body center on the shell).
 *
 * scale = distance * sin(α). Same camera FOV (e.g. 50°) views virtual and scene
 * space, so matching world angular size keeps on-screen size stable as the player walks.
 */
export function scaleForAngularRadiusAtDistance(
  angularRadius: number,
  distanceFromViewer: number,
  minScale: number = PROJECTED_BODY_MIN_SCALE,
  maxScale: number = PLANET_ENCLOSING_SPHERE_RADIUS - SHIP_INTERIOR_RADIUS
): number {
  if (distanceFromViewer < 1e-8) {
    return maxScale
  }
  const scale = distanceFromViewer * Math.sin(angularRadius)
  return Math.min(maxScale, Math.max(minScale, scale))
}

export type SphereProjection = {
  position: Vector3.Mutable
  rotation: Quaternion.Mutable
  scale: number
  distance: number
}

/**
 * Scene-space orientation for a body that is fixed in virtual space (no spin).
 *
 * Vertices are transformed into the ship's frame by inverse(shipRotation), same as
 * position. As the ship orbits/turns, this rotation changes so the viewer sees
 * different sides of the stationary planet — the planet itself is not spinning.
 */
export function stationaryBodySceneRotation(shipVirtualRotation: Quaternion): Quaternion.Mutable {
  return conjugateQuaternion(shipVirtualRotation)
}

/**
 * Forward hit distance along a ray against a sphere (player is assumed inside).
 * Solves |origin + t*dir - center|^2 = radius^2 and returns the t > 0 root.
 */
export function raySphereForwardDistance(
  rayOrigin: Vector3,
  rayDirection: Vector3,
  sphereCenter: Vector3,
  sphereRadius: number
): number {
  const originRelative = Vector3.subtract(rayOrigin, sphereCenter)
  const b = Vector3.dot(originRelative, rayDirection)
  const c = Vector3.lengthSquared(originRelative) - sphereRadius * sphereRadius
  const discriminant = b * b - c
  if (discriminant <= 0) {
    // Numerical fallback if the player is slightly outside / grazing.
    return Math.max(PROJECTED_BODY_MIN_SCALE, -b + sphereRadius)
  }
  return -b + Math.sqrt(discriminant)
}

/**
 * Projects a body from virtual space onto a *fixed* enclosing scene sphere.
 *
 * Direction comes from the virtual ship pose. The ray starts at the local player
 * (free to move inside the sphere) and hits the shell — so walking closer to one
 * side shortens that ray without moving the sphere itself.
 */
export function projectVirtualBodyToSceneSphere(
  bodyVirtualPosition: Vector3,
  shipVirtualPosition: Vector3,
  shipVirtualRotation: Quaternion,
  sphereCenter: Vector3,
  rayOrigin: Vector3,
  sphereRadius: number,
  virtualRadius: number
): SphereProjection {
  const eye = rayOrigin
  // Step 1: world-space offset from the ship to the body in virtual coordinates.
  const offset = Vector3.subtract(bodyVirtualPosition, shipVirtualPosition)
  // Step 2: true virtual distance (for apparent size).
  const distance = Vector3.length(offset)
  // Step 3: unit direction from ship → body in virtual world space.
  const worldDirection = directionFromTo(shipVirtualPosition, bodyVirtualPosition)
  // Step 4: express that direction in the ship's local / scene frame.
  const localDirection = rotateByInverse(worldDirection, shipVirtualRotation)
  // Step 5: desired angular size from virtual radius + virtual distance (FOV-independent).
  const angularRadius = virtualAngularRadius(virtualRadius, distance)
  // Step 6: cast from the eye onto the fixed enclosing shell, then inset.
  const hitDistance = raySphereForwardDistance(
    eye,
    localDirection,
    sphereCenter,
    sphereRadius
  )
  const centerDistance = Math.max(PROJECTED_BODY_MIN_SCALE, hitDistance - CELESTIAL_SPHERE_INSET)
  const position = Vector3.add(eye, Vector3.scale(localDirection, centerDistance))
  // Step 7: scale the radius-1 model so it keeps that angular size at the *actual*
  //         player→body distance (shrinks when you walk closer, grows when farther).
  //         Cap so the near face stays outside the ship interior, not merely the origin.
  const distanceFromOrigin = Vector3.distance(position, sphereCenter)
  const maxScale =
    sphereRadius >= PLANET_ENCLOSING_SPHERE_RADIUS
      ? Math.max(PROJECTED_BODY_MIN_SCALE, distanceFromOrigin - SHIP_INTERIOR_RADIUS)
      : sphereRadius
  const scale = scaleForAngularRadiusAtDistance(
    angularRadius,
    centerDistance,
    PROJECTED_BODY_MIN_SCALE,
    maxScale
  )
  // Step 8: orient the mesh for a non-spinning body under the ship's viewpoint.
  const rotation = stationaryBodySceneRotation(shipVirtualRotation)

  return { position, rotation, scale, distance }
}

/**
 * Reproject every visible `ProjectedBody` onto its `shellRadius` sphere.
 * Tumble (asteroids) is a separate system that must run after this, because
 * projection overwrites Transform.rotation.
 */
export function ProjectedBodySystem(_dt: number) {
  const virtualPosition = shipVirtualPosition
  const virtualRotation = shipVirtualRotation

  let rayOrigin = SCENE_SHIP_POSITION
  if (Transform.has(engine.PlayerEntity)) {
    rayOrigin = Transform.get(engine.PlayerEntity).position
  }

  for (const [entity, body] of engine.getEntitiesWith(ProjectedBody, Transform)) {
    if (VisibilityComponent.has(entity) && !VisibilityComponent.get(entity).visible) continue

    const projection = projectVirtualBodyToSceneSphere(
      body.position,
      virtualPosition,
      virtualRotation,
      SCENE_SHIP_POSITION,
      rayOrigin,
      body.shellRadius,
      body.radius
    )

    const transform = Transform.getMutable(entity)
    transform.position = projection.position
    transform.rotation = projection.rotation
    transform.scale = Vector3.create(projection.scale, projection.scale, projection.scale)
  }
}
