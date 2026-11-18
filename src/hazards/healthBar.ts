import {
  Billboard,
  BillboardMode,
  engine,
  Entity,
  Material,
  MeshRenderer,
  TextAlignMode,
  TextShape,
  Transform,
  VisibilityComponent
} from '@dcl/sdk/ecs'
import { Color3, Color4, Vector3 } from '@dcl/sdk/math'
import { type HazardKind } from '../gamebalance/constants'
import {
  HAZARD_HEALTH_BAR_COLOR,
  HAZARD_HEALTH_BAR_EMISSIVE_INTENSITY,
  HAZARD_HEALTH_BAR_HEIGHT,
  HAZARD_HEALTH_BAR_OFFSET_Y_ASTEROID,
  HAZARD_HEALTH_BAR_OFFSET_Y_SAUCER,
  HAZARD_HEALTH_BAR_TEXT_FONT_SIZE,
  HAZARD_HEALTH_BAR_TEXT_OFFSET_Y,
  HAZARD_HEALTH_BAR_TRACK_COLOR,
  HAZARD_HEALTH_BAR_WIDTH,
  HAZARD_TEXT_OUTLINE_WIDTH
} from './constants'
import { rotateByInverse } from '../utilities'

/**
 * Health bar parented to a hazard. `root` is an unscaled camera-facing billboard held above
 * the hazard. Under it: `track` (full-width backdrop), `fill` (shrinks toward its left edge
 * as HP drops) and `label` (remaining / original HP).
 */
export type HealthBar = {
  hazard: Entity
  root: Entity
  track: Entity
  fill: Entity
  label: Entity
  offsetY: number
}

/** Runs after regular-priority systems so it sees the final ProjectedBody + Tumble rotation. */
const HEALTH_BAR_SYSTEM_PRIORITY = 100e3 - 1

/** Local Z steps so the fill and label draw in front of the track (billboard front is -Z). */
const HEALTH_BAR_FILL_Z = -0.01
const HEALTH_BAR_LABEL_Z = -0.02

const bars: HealthBar[] = []

function healthBarOffsetY(kind: HazardKind): number {
  return kind === 'saucer' ? HAZARD_HEALTH_BAR_OFFSET_Y_SAUCER : HAZARD_HEALTH_BAR_OFFSET_Y_ASTEROID
}

function createBarPlane(root: Entity, color: Color3, z: number): Entity {
  const entity = engine.addEntity()
  Transform.create(entity, {
    parent: root,
    position: Vector3.create(0, 0, z),
    scale: Vector3.create(HAZARD_HEALTH_BAR_WIDTH, HAZARD_HEALTH_BAR_HEIGHT, 1)
  })
  MeshRenderer.setPlane(entity)
  Material.setPbrMaterial(entity, {
    albedoColor: Color4.fromColor3(color),
    emissiveColor: color,
    emissiveIntensity: HAZARD_HEALTH_BAR_EMISSIVE_INTENSITY,
    castShadows: false
  })
  VisibilityComponent.create(entity, { visible: false })
  return entity
}

export function createHealthBar(hazard: Entity, kind: HazardKind): HealthBar {
  const offsetY = healthBarOffsetY(kind)
  const root = engine.addEntity()
  Transform.create(root, { parent: hazard, position: Vector3.create(0, offsetY, 0) })
  Billboard.create(root, { billboardMode: BillboardMode.BM_ALL })

  const track = createBarPlane(root, HAZARD_HEALTH_BAR_TRACK_COLOR, 0)
  const fill = createBarPlane(root, HAZARD_HEALTH_BAR_COLOR, HEALTH_BAR_FILL_Z)

  const label = engine.addEntity()
  Transform.create(label, {
    parent: root,
    position: Vector3.create(0, HAZARD_HEALTH_BAR_TEXT_OFFSET_Y, HEALTH_BAR_LABEL_Z)
  })
  TextShape.create(label, {
    text: '',
    fontSize: HAZARD_HEALTH_BAR_TEXT_FONT_SIZE,
    textColor: Color4.White(),
    outlineColor: Color4.Black(),
    outlineWidth: HAZARD_TEXT_OUTLINE_WIDTH,
    textAlign: TextAlignMode.TAM_BOTTOM_CENTER
  })
  VisibilityComponent.create(label, { visible: false })

  const bar: HealthBar = { hazard, root, track, fill, label, offsetY }
  bars.push(bar)
  return bar
}

function setHealthBarVisible(bar: HealthBar, visible: boolean): void {
  for (const entity of [bar.track, bar.fill, bar.label]) {
    VisibilityComponent.getMutable(entity).visible = visible
  }
}

/** Pooled hazards are hidden without propagating to children, so the bar hides itself. */
export function hideHealthBar(bar: HealthBar): void {
  setHealthBarVisible(bar, false)
}

/** Show the bar, scale the fill to `hp / maxHp` with its left edge fixed, and update the label. */
export function setHealthBarFraction(bar: HealthBar, hp: number, maxHp: number): void {
  setHealthBarVisible(bar, true)
  const fraction = maxHp > 0 ? Math.min(1, Math.max(0, hp / maxHp)) : 0
  const transform = Transform.getMutable(bar.fill)
  transform.scale = Vector3.create(HAZARD_HEALTH_BAR_WIDTH * fraction, HAZARD_HEALTH_BAR_HEIGHT, 1)
  transform.position = Vector3.create(-(HAZARD_HEALTH_BAR_WIDTH * (1 - fraction)) / 2, 0, HEALTH_BAR_FILL_Z)
  // Ceil so a live hazard never reads 0.
  TextShape.getMutable(bar.label).text = `${Math.max(0, Math.ceil(hp))} / ${Math.round(maxHp)}`
}

/**
 * Hazards rotate (projection orientation, asteroid tumble), which would swing a fixed
 * child offset around. Counter-rotate the offset so the bar always sits above in scene space.
 */
function HealthBarSystem() {
  for (const bar of bars) {
    if (!VisibilityComponent.get(bar.fill).visible) continue
    if (!Transform.has(bar.hazard)) continue
    const rotation = Transform.get(bar.hazard).rotation
    Transform.getMutable(bar.root).position = rotateByInverse(Vector3.create(0, bar.offsetY, 0), rotation)
  }
}

export function setupHealthBars(): void {
  engine.addSystem(HealthBarSystem, HEALTH_BAR_SYSTEM_PRIORITY)
}
