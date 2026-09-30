import { engine, Transform, UiCanvasInformation } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'
import {
  UI_BREACH_ICON_EDGE_INSET_HALF_SIZES,
  UI_BREACH_ICON_PULSE_AMOUNT,
  UI_BREACH_ICON_PULSE_HZ,
  UI_BREACH_ICON_SIZE_VH,
  UI_BREACH_ICON_TINT,
  UI_BREACH_RECT_HALF_HEIGHT,
  UI_BREACH_RECT_HALF_WIDTH,
  UI_ENGINEERING_ICON_PATH
} from '../constants'
import { getGameState, isBreachActive } from '../gamestate'
import { getBreachWorldPositions, isTurretOccupied } from '../sceneObjects'

const BREACH_IDS = [1, 2, 3, 4, 5]

type ScreenPercent = { left: number; top: number }

/**
 * Imagine a 16:9 rectangle on the horizontal plane centered on the player, then stand it up
 * as the screen. The player-to-breach vector exits the rectangle on one edge; that exit point
 * is where the icon is drawn. The rectangle is oriented by the camera's horizontal forward
 * direction (`cameraForward`, world space), so screen-up is where the camera is looking.
 */
export function edgePositionForBreach(player: Vector3, breach: Vector3, cameraForward: Vector3): ScreenPercent | null {
  const dx = breach.x - player.x
  const dz = breach.z - player.z
  // Flatten the camera forward onto the horizontal plane; left-handed, +Y up, so right = (fz, -fx).
  let fx = cameraForward.x
  let fz = cameraForward.z
  const len = Math.sqrt(fx * fx + fz * fz)
  if (len > 1e-4) {
    fx /= len
    fz /= len
  } else {
    fx = 0
    fz = 1
  }
  const right = dx * fz - dz * fx
  const forward = dx * fx + dz * fz
  const absRight = Math.abs(right)
  const absForward = Math.abs(forward)

  let hitRight = 0
  let hitForward = 0
  if (absRight > 1e-6 || absForward > 1e-6) {
    const tX = absRight > 1e-6 ? UI_BREACH_RECT_HALF_WIDTH / absRight : Infinity
    const tZ = absForward > 1e-6 ? UI_BREACH_RECT_HALF_HEIGHT / absForward : Infinity
    // Exits through the top edge: the breach is in front of the player (on screen), so no icon.
    if (forward > 0 && tZ <= tX) return null
    const t = Math.min(tX, tZ)
    hitRight = right * t
    hitForward = forward * t
  }

  // The icon is sized in vh (1vh = 1% of screen height), so the inset is fixed in physical size:
  // it is that many % vertically and 1/aspect times that horizontally.
  const insetVh = (UI_BREACH_ICON_SIZE_VH / 2) * UI_BREACH_ICON_EDGE_INSET_HALF_SIZES
  const insetY = insetVh
  const insetX = insetVh / screenAspect()
  const left = 50 + (hitRight / UI_BREACH_RECT_HALF_WIDTH) * 50
  const top = 50 - (hitForward / UI_BREACH_RECT_HALF_HEIGHT) * 50
  return {
    left: Math.min(100 - insetX, Math.max(insetX, left)),
    top: Math.min(100 - insetY, Math.max(insetY, top))
  }
}

/** Screen width / height, from the renderer's canvas info. Falls back to 16:9. */
function screenAspect(): number {
  const canvas = UiCanvasInformation.getOrNull(engine.RootEntity)
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) return 16 / 9
  return canvas.width / canvas.height
}

function BreachIcon(id: number, player: Vector3 | null, cameraForward: Vector3) {
  const state = getGameState()
  const breach = getBreachWorldPositions().get(id)
  const active = !!player && !!breach && isBreachActive(state, id) && !isTurretOccupied()
  const edge = active && player && breach ? edgePositionForBreach(player, breach, cameraForward) : null
  const visible = edge !== null
  const pos = edge ?? { left: 0, top: 0 }
  const pulse = 1 + UI_BREACH_ICON_PULSE_AMOUNT * Math.abs(Math.sin(Math.PI * UI_BREACH_ICON_PULSE_HZ * (Date.now() / 1000)))
  const size = UI_BREACH_ICON_SIZE_VH * pulse
  const half = size / 2

  return (
    <UiEntity
      key={`breach-icon-${id}`}
      uiTransform={{
        width: `${size}vh`,
        height: `${size}vh`,
        positionType: 'absolute',
        position: { left: `${pos.left}%`, top: `${pos.top}%` },
        margin: { left: `${-half}vh`, top: `${-half}vh` },
        display: visible ? 'flex' : 'none',
        pointerFilter: 'none'
      }}
      uiBackground={{
        texture: { src: UI_ENGINEERING_ICON_PATH },
        textureMode: 'stretch',
        color: UI_BREACH_ICON_TINT
      }}
    />
  )
}

export function BreachIconsHud() {
  const player = Transform.getOrNull(engine.PlayerEntity)?.position ?? null
  // CameraEntity's transform is available on desktop and mobile.
  const cameraRotation = Transform.getOrNull(engine.CameraEntity)?.rotation ?? Quaternion.Identity()
  const cameraForward = Vector3.rotate(Vector3.Forward(), cameraRotation)
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        positionType: 'absolute',
        position: { top: 0, left: 0 },
        pointerFilter: 'none'
      }}
    >
      {BREACH_IDS.map((id) => BreachIcon(id, player, cameraForward))}
    </UiEntity>
  )
}
