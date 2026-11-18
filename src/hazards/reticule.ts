import {
  Billboard,
  BillboardMode,
  engine,
  Entity,
  Material,
  MaterialTransparencyMode,
  MeshRenderer,
  TextAlignMode,
  TextShape,
  Transform,
  VisibilityComponent
} from '@dcl/sdk/ecs'
import { Color3, Color4, Vector3 } from '@dcl/sdk/math'
import {
  HAZARD_TARGETING_CROSSHAIR_TEXTURE_PATH,
  HAZARD_TARGETING_INDICATOR_SCALE,
  HAZARD_TARGETING_LOCKED_FONT_SIZE,
  HAZARD_TARGETING_LOCKED_OFFSET,
  HAZARD_TARGETING_PORTRAIT_COUNT,
  HAZARD_TARGETING_PORTRAIT_RADIUS,
  HAZARD_TARGETING_PORTRAIT_SCALE,
  HAZARD_TARGETING_PORTRAIT_START_ANGLE_DEGREES,
  HAZARD_TARGETING_PORTRAIT_STEP_DEGREES,
  HAZARD_TARGETING_PORTRAIT_Z,
  HAZARD_TEXT_OUTLINE_WIDTH
} from './constants'
/** Crosshair billboard on a hazard, with the local lock label and targeter portraits as children. */
export type TargetingReticule = {
  indicator: Entity
  lockedLabel: Entity
  portraitSlots: Entity[]
}

function portraitPosition(index: number): Vector3 {
  const angle =
    (HAZARD_TARGETING_PORTRAIT_START_ANGLE_DEGREES + index * HAZARD_TARGETING_PORTRAIT_STEP_DEGREES) *
    (Math.PI / 180)
  return Vector3.create(
    Math.cos(angle) * HAZARD_TARGETING_PORTRAIT_RADIUS,
    Math.sin(angle) * HAZARD_TARGETING_PORTRAIT_RADIUS,
    HAZARD_TARGETING_PORTRAIT_Z
  )
}

function createPortraitSlot(parent: Entity, index: number): Entity {
  const entity = engine.addEntity()
  Transform.create(entity, {
    parent,
    position: portraitPosition(index),
    scale: Vector3.create(
      HAZARD_TARGETING_PORTRAIT_SCALE,
      HAZARD_TARGETING_PORTRAIT_SCALE,
      HAZARD_TARGETING_PORTRAIT_SCALE
    )
  })
  MeshRenderer.setPlane(entity)
  Material.setPbrMaterial(entity, {
    emissiveColor: Color3.White(),
    emissiveIntensity: 1,
    castShadows: false
  })
  VisibilityComponent.create(entity, { visible: false })
  return entity
}

function clearPortraitSlot(slot: Entity): void {
  VisibilityComponent.getMutable(slot).visible = false
  if (Material.has(slot)) Material.deleteFrom(slot)
}

function showPortrait(slot: Entity, address: string): void {
  const portrait = Material.Texture.Avatar({ userId: address })
  Material.setPbrMaterial(slot, {
    texture: portrait,
    emissiveTexture: portrait,
    emissiveColor: Color3.White(),
    emissiveIntensity: 1,
    castShadows: false
  })
  VisibilityComponent.getMutable(slot).visible = true
}

export function createTargetingReticule(hazard: Entity): TargetingReticule {
  // Default plane is 1×1; asteroid mesh extends ~1.35 from origin (~2.7 across).
  const indicator = engine.addEntity()
  Transform.create(indicator, {
    parent: hazard,
    scale: Vector3.create(
      HAZARD_TARGETING_INDICATOR_SCALE,
      HAZARD_TARGETING_INDICATOR_SCALE,
      HAZARD_TARGETING_INDICATOR_SCALE
    )
  })
  MeshRenderer.setPlane(indicator)
  Billboard.create(indicator, { billboardMode: BillboardMode.BM_ALL })
  Material.setPbrMaterial(indicator, {
    texture: Material.Texture.Common({ src: HAZARD_TARGETING_CROSSHAIR_TEXTURE_PATH }),
    emissiveColor: Color3.Red(),
    emissiveIntensity: 1,
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_TEST,
    alphaTest: 0.5,
    castShadows: false
  })
  VisibilityComponent.create(indicator, { visible: false })

  const labelScale = 1 / HAZARD_TARGETING_INDICATOR_SCALE
  const lockedLabel = engine.addEntity()
  Transform.create(lockedLabel, {
    parent: indicator,
    position: Vector3.clone(HAZARD_TARGETING_LOCKED_OFFSET),
    scale: Vector3.create(labelScale, labelScale, labelScale)
  })
  TextShape.create(lockedLabel, {
    text: 'Target Locked',
    fontSize: HAZARD_TARGETING_LOCKED_FONT_SIZE,
    textColor: Color4.Green(),
    outlineColor: Color4.Black(),
    outlineWidth: HAZARD_TEXT_OUTLINE_WIDTH,
    textAlign: TextAlignMode.TAM_BOTTOM_CENTER
  })
  VisibilityComponent.create(lockedLabel, { visible: false })

  const portraitSlots: Entity[] = []
  for (let i = 0; i < HAZARD_TARGETING_PORTRAIT_COUNT; i++) {
    portraitSlots.push(createPortraitSlot(indicator, i))
  }

  return { indicator, lockedLabel, portraitSlots }
}

/**
 * The crosshair and "Target Locked" show only on the local player's own target.
 * Portraits show for every targeter on any hazard.
 */
export function applyReticule(reticule: TargetingReticule, targeters: string[], isLocalTarget: boolean): void {
  VisibilityComponent.getMutable(reticule.indicator).visible = isLocalTarget
  VisibilityComponent.getMutable(reticule.lockedLabel).visible = isLocalTarget
  reticule.portraitSlots.forEach((slot, i) => {
    const address = targeters[i]
    if (address) {
      showPortrait(slot, address)
    } else {
      clearPortraitSlot(slot)
    }
  })
}

export function hideReticule(reticule: TargetingReticule): void {
  VisibilityComponent.getMutable(reticule.indicator).visible = false
  VisibilityComponent.getMutable(reticule.lockedLabel).visible = false
  reticule.portraitSlots.forEach(clearPortraitSlot)
}
