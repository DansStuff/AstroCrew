import {
  engine,
  Entity,
  GltfContainer,
  GltfNodeModifiers,
  Schemas,
  Transform,
  VisibilityComponent
} from '@dcl/sdk/ecs'
import { Color3, Color4, Vector3 } from '@dcl/sdk/math'
import { isServer } from '@dcl/sdk/network'
import {
  PLANET_CULL_BEHIND_HALF_ANGLE_DEGREES,
  PLANET_ENCLOSING_SPHERE_RADIUS,
  PLANET_SPIN_DEGREES_PER_SECOND,
  STAR_BASE_COLOR,
  STAR_MODEL_PATH,
  STAR_SPAWN_COUNT_DEFAULT,
  STAR_SPAWN_DISTANCE,
  STAR_VIRTUAL_RADIUS
} from '../constants'
import { SHIP_ROUTE } from '../path/route'
import { shipVirtualPosition, shipVirtualRotation } from '../ship'
import { directionFromTo, rotateByInverse } from '../utilities'
import { ProjectedBody, ProjectedBodySystem } from './projection'
import { Tumble, TumbleSystem } from './tumble'

export const PlanetData = engine.defineComponent('PlanetData', {
  name: Schemas.String
})

/** Tag for bodies hidden when they sit in the ship's rear cull cone. */
export const Cullable = engine.defineComponent('Cullable', {})

const CULL_BEHIND_DOT = Math.cos((PLANET_CULL_BEHIND_HALF_ANGLE_DEGREES * Math.PI) / 180)

export type PlanetSpawnData = {
  name: string
  position: Vector3
  /** Virtual-space radius. Models are authored at radius 1; this sets true simulated size. */
  radius: number
}

export function createPlanet(
  modelPath: string,
  data: PlanetSpawnData,
  cullable: boolean = true,
  spin: boolean = true
): Entity {
  const entity = engine.addEntity()

  // Models must be origin-centered with radius 1. Baked glTF node translations get multiplied
  // by Transform.scale and will fling the mesh off-screen once ProjectedBodySystem applies apparent size.
  GltfContainer.create(entity, { src: modelPath })
  GltfNodeModifiers.create(entity, {
    modifiers: [{ path: '', castShadows: false }]
  })
  Transform.create(entity, { position: data.position })
  ProjectedBody.create(entity, {
    position: data.position,
    radius: data.radius,
    shellRadius: PLANET_ENCLOSING_SPHERE_RADIUS
  })
  PlanetData.create(entity, { name: data.name })
  // Very slow spin, as if huge and distant.
  if (spin) {
    Tumble.create(entity, {
      axis: Vector3.Up(),
      degreesPerSecond: PLANET_SPIN_DEGREES_PER_SECOND
    })
  }
  if (cullable) {
    Cullable.create(entity)
    VisibilityComponent.create(entity, { visible: true })
  }

  return entity
}

/**
 * Override the star GLTF PBR colors with a slight orange tint.
 * DCL cannot read the loaded material at runtime; we re-apply known base values + tint.
 */
function applyStarOrangeTint(entity: Entity, tintStrength: number): void {
  // Push toward orange: keep red, pull green a little, pull blue more.
  const r = Math.min(1, STAR_BASE_COLOR.r + tintStrength * 0.25)
  const g = STAR_BASE_COLOR.g * (1 - tintStrength * 0.25)
  const b = STAR_BASE_COLOR.b * (1 - tintStrength * 0.55)

  GltfNodeModifiers.createOrReplace(entity, {
    modifiers: [
      {
        path: '',
        castShadows: false,
        material: {
          material: {
            $case: 'pbr',
            pbr: {
              albedoColor: Color4.create(r, g, b, 1),
              emissiveColor: Color3.create(r, g, b),
              emissiveIntensity: 3
            }
          }
        }
      }
    ]
  })
}

/**
 * Spawns distant background stars at varied directions, all at STAR_SPAWN_DISTANCE.
 * Uses ProjectedBody so they share the planet enclosing sphere.
 */
export function spawnDistantStars(count: number = STAR_SPAWN_COUNT_DEFAULT): void {
  for (let i = 0; i < count; i++) {
    // Deterministic "random" directions so the field is stable across reloads.
    const yaw = (i / count) * Math.PI * 2 + i * 0.37
    const pitch = -0.8 + ((i * 0.618) % 1) * 1.6

    const cosPitch = Math.cos(pitch)
    const position = Vector3.create(
      Math.cos(yaw) * cosPitch * STAR_SPAWN_DISTANCE,
      Math.sin(pitch) * STAR_SPAWN_DISTANCE,
      Math.sin(yaw) * cosPitch * STAR_SPAWN_DISTANCE
    )

    // ±25% of STAR_VIRTUAL_RADIUS, stable across reloads.
    const radius = STAR_VIRTUAL_RADIUS * (0.75 + ((i * 0.431) % 1) * 0.5)

    const entity = createPlanet(
      STAR_MODEL_PATH,
      {
        name: `Star_${i}`,
        position,
        radius
      },
      true,
      false
    )

    // Slight per-star orange tint (0.15–0.45), stable across reloads.
    const tintStrength = 0.6 + ((i * 0.618) % 1) * 1
    applyStarOrangeTint(entity, tintStrength)
  }
}

/** Spawns authored planets from the path-editor route table. */
export function spawnPlanetsFromRoute(): void {
  for (const planet of SHIP_ROUTE.planets) {
    createPlanet(planet.model, {
      name: planet.name,
      position: Vector3.create(planet.x, planet.y, planet.z),
      radius: planet.radius
    })
  }
}

/**
 * Hide Cullable planets that sit in a 90° cone behind the ship (45° either side of the stern).
 * Scene +Z is aft; uses virtual pose so walking the deck does not pop visibility.
 */
export function PlanetCuller(_dt: number) {
  for (const [entity, body] of engine.getEntitiesWith(ProjectedBody, Cullable, VisibilityComponent)) {
    const worldDirection = directionFromTo(shipVirtualPosition, body.position)
    const localDirection = rotateByInverse(worldDirection, shipVirtualRotation)
    const visible = localDirection.z < CULL_BEHIND_DOT
    const visibility = VisibilityComponent.getMutable(entity)
    if (visibility.visible !== visible) {
      visibility.visible = visible
    }
  }
}

export function setupSpaceObjects() {
  if (isServer()) return
  spawnPlanetsFromRoute()
  spawnDistantStars(40)
  engine.addSystem(ProjectedBodySystem)
  engine.addSystem(PlanetCuller)
  engine.addSystem(TumbleSystem)
}
