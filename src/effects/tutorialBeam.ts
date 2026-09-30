import {
  engine,
  Entity,
  Material,
  MaterialTransparencyMode,
  TextureWrapMode,
  Transform,
  VisibilityComponent
} from '@dcl/sdk/ecs'
import { Color3, Color4, Vector2, Vector3 } from '@dcl/sdk/math'
import {
  TUTORIAL_BEAM_EMISSIVE_COLOR,
  TUTORIAL_BEAM_EMISSIVE_INTENSITY,
  TUTORIAL_BEAM_TEXTURE_PATH,
  TUTORIAL_BEAM_TEXTURE_REPEATS,
  TUTORIAL_BEAM_WAIST_HEIGHT,
  TUTORIAL_BEAM_WIDTH
} from '../constants'
import { createBeamStrip, poseBeamStrip } from './beamStrip'

let tutorialBeam: Entity | null = null
let tutorialTarget: Vector3 | null = null

function hideBeam(entity: Entity | null): void {
  if (!entity) return
  VisibilityComponent.getMutable(entity).visible = false
}

function setBeamTarget(entity: Entity | null, position: Vector3 | null): Vector3 | null {
  const next = position ? Vector3.clone(position) : null
  if (!next) hideBeam(entity)
  return next
}

/** Point the guide beam at `position`, or hide it when `position` is null. */
export function setTutorialBeamTarget(position: Vector3 | null): void {
  tutorialTarget = setBeamTarget(tutorialBeam, position)
}

function poseBeam(entity: Entity | null, target: Vector3 | null, waist: Vector3): void {
  if (!entity || !target) return
  VisibilityComponent.getMutable(entity).visible = true
  poseBeamStrip(entity, waist, target, TUTORIAL_BEAM_WIDTH)
}

function GuideBeamSystem(): void {
  if (!tutorialBeam || !tutorialTarget) return
  if (!Transform.has(engine.PlayerEntity)) {
    hideBeam(tutorialBeam)
    return
  }
  const feet = Transform.get(engine.PlayerEntity).position
  const waist = Vector3.create(feet.x, feet.y + TUTORIAL_BEAM_WAIST_HEIGHT, feet.z)
  poseBeam(tutorialBeam, tutorialTarget, waist)
}

function beamTexture(src: string) {
  return Material.Texture.Common({
    src,
    wrapMode: TextureWrapMode.TWM_REPEAT,
    tiling: Vector2.create(1, TUTORIAL_BEAM_TEXTURE_REPEATS)
  })
}

function createGuideBeam(src: string, emissiveColor: Color3): Entity {
  const entity = createBeamStrip(Vector3.Zero(), TUTORIAL_BEAM_WIDTH)
  Material.setPbrMaterial(entity, {
    albedoColor: Color4.White(),
    texture: beamTexture(src),
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_TEST,
    alphaTest: 0.5,
    emissiveColor,
    emissiveIntensity: TUTORIAL_BEAM_EMISSIVE_INTENSITY,
    castShadows: false
  })
  return entity
}

/** Client-only. The plane stays hidden until something sets a target. */
export function setupTutorialBeam(): void {
  tutorialBeam = createGuideBeam(TUTORIAL_BEAM_TEXTURE_PATH, TUTORIAL_BEAM_EMISSIVE_COLOR)
  engine.addSystem(GuideBeamSystem)
}
