import {
  ColliderLayer,
  engine,
  Entity,
  GltfContainer,
  InputAction,
  inputSystem,
  Material,
  MeshCollider,
  MeshRenderer,
  Name,
  PointerEvents,
  PointerEventType,
  TextAlignMode,
  TextShape,
  Transform
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { EntityNames } from '../../assets/scene/entity-names'
import { SCENE_SHIP_POSITION } from '../constants'
import { room } from '../networking/messages'
import { contributionMapFromRows, type MissionRecord } from '../players/contributions'
import { showRoundResults } from '../ui/roundResults'
import { WEEKLY_TOP_N } from './week'

/** Default Blender cube is 2×2×2, centered, extents ±1. Front is local +Z (Creator Hub / DCL forward). */
const CUBE_HALF = 1
const CUBE_SIZE = CUBE_HALF * 2
const ROW_COUNT = WEEKLY_TOP_N
const ROW_GAP = 0.06
const POINTER_DISTANCE = 30
const LABEL_FONT_SIZE = 1.4
/** World-space offset so TextShape sits in front of the row plane (avoids z-fighting). */
const LABEL_FORWARD = 0.06
const LABEL_DEFAULT_COLOR = Color4.create(0.92, 0.93, 0.95, 1)
const LABEL_EMPTY_COLOR = Color4.create(0.6, 0.62, 0.66, 1)
const LABEL_LOSS_COLOR = Color4.create(1, 0.35, 0.28, 1)

const rowEntities: Entity[] = []
const rowLabels: Entity[] = []
const rowMissions = new Map<Entity, MissionRecord>()
let appliedBoardAt = 0

function rowHeight(): number {
  return (CUBE_SIZE - ROW_GAP * (ROW_COUNT - 1)) / ROW_COUNT
}

function rowLocalY(index: number): number {
  return CUBE_HALF - index * (rowHeight() + ROW_GAP) - rowHeight() / 2
}

function createRow(parent: Entity, index: number, parentScale: Vector3): Entity {
  const height = rowHeight()
  const planeScale = Vector3.create(CUBE_SIZE, height, 1)
  const entity = engine.addEntity()
  Transform.create(entity, {
    parent,
    position: Vector3.create(0, rowLocalY(index), CUBE_HALF),
    rotation: Quaternion.fromEulerDegrees(0, 180, 0),
    scale: planeScale
  })
  MeshRenderer.setPlane(entity)
  MeshCollider.setPlane(entity, ColliderLayer.CL_POINTER)
  Material.setPbrMaterial(entity, {
    albedoColor: Color4.create(0.1, 0.12, 0.16, 0.96),
    metallic: 0,
    roughness: 0.8,
    emissiveColor: Color3.create(0.08, 0.1, 0.14),
    emissiveIntensity: 0.4,
    castShadows: false
  })
  PointerEvents.create(entity, {
    pointerEvents: [
      {
        eventType: PointerEventType.PET_DOWN,
        eventInfo: {
          button: InputAction.IA_POINTER,
          hoverText: `View mission #${index + 1}`,
          maxDistance: POINTER_DISTANCE,
          showFeedback: true,
          showHighlight: true
        }
      }
    ]
  })

  const label = engine.addEntity()
  Transform.create(label, {
    parent: entity,
    position: Vector3.create(0, 0, -LABEL_FORWARD / Math.max(parentScale.z, 0.001)),
    scale: Vector3.create(
      1 / (planeScale.x * parentScale.x),
      1 / (planeScale.y * parentScale.y),
      1 / Math.max(parentScale.z, 0.001)
    )
  })
  TextShape.create(label, {
    text: 'No Record',
    fontSize: LABEL_FONT_SIZE,
    textColor: Color4.create(LABEL_EMPTY_COLOR.r, LABEL_EMPTY_COLOR.g, LABEL_EMPTY_COLOR.b, LABEL_EMPTY_COLOR.a),
    outlineColor: Color4.Black(),
    outlineWidth: 0.05,
    textAlign: TextAlignMode.TAM_MIDDLE_CENTER
  })

  rowEntities.push(entity)
  rowLabels.push(label)
  return entity
}

function rowLabelText(index: number, mission: MissionRecord | undefined): string {
  if (!mission) return 'No Record'
  if (mission.won) return 'Victory!'
  return `#${index + 1} destroyed at ${mission.furthestEncounter}`
}

function applyLabelColor(text: { textColor?: Color4 }, color: Color4): void {
  text.textColor = Color4.create(color.r, color.g, color.b, color.a)
}

function applyWeeklyMissions(missions: MissionRecord[]): void {
  for (let i = 0; i < ROW_COUNT; i++) {
    const entity = rowEntities[i]
    const label = rowLabels[i]
    if (!entity || !label) continue
    const mission = missions[i]
    const text = TextShape.getMutable(label)
    if (mission) {
      rowMissions.set(entity, mission)
    } else {
      rowMissions.delete(entity)
    }
    text.text = rowLabelText(i, mission)
    applyLabelColor(
      text,
      !mission ? LABEL_EMPTY_COLOR : mission.won ? LABEL_DEFAULT_COLOR : LABEL_LOSS_COLOR
    )
  }
}

function ScoreboardClickSystem(): void {
  for (const entity of rowEntities) {
    if (!inputSystem.getInputCommand(InputAction.IA_POINTER, PointerEventType.PET_DOWN, entity)) {
      continue
    }
    const mission = rowMissions.get(entity)
    if (!mission) return
    showRoundResults(contributionMapFromRows(mission.contributions), mission.won, mission.furthestEncounter)
    return
  }
}

function findScoreboardEntity(): Entity | null {
  for (const [entity, name] of engine.getEntitiesWith(Name)) {
    if (name.value === EntityNames.Scoreboard) return entity
  }
  return null
}

function resolveAnchor(): { entity: Entity; scale: Vector3 } {
  const named = findScoreboardEntity()
  if (named !== null) {
    GltfContainer.deleteFrom(named)
    return { entity: named, scale: Transform.get(named).scale }
  }

  console.log('[CLIENT] Scoreboard entity missing; using ship-origin fallback')
  const fallback = engine.addEntity()
  Transform.create(fallback, {
    position: Vector3.clone(SCENE_SHIP_POSITION),
    rotation: Quaternion.fromEulerDegrees(0, 0, 0)
  })
  return { entity: fallback, scale: Vector3.One() }
}

export function setupScoreboard(): void {
  const anchor = resolveAnchor()

  for (let i = 0; i < ROW_COUNT; i++) {
    createRow(anchor.entity, i, anchor.scale)
  }

  room.onMessage('notifyWeeklyBoard', (data) => {
    if (data.updatedAt <= appliedBoardAt) return
    appliedBoardAt = data.updatedAt
    applyWeeklyMissions(data.missions)
  })

  engine.addSystem(ScoreboardClickSystem)
}
