import { Color4 } from '@dcl/sdk/math'
import type { TurretId } from '../gamebalance/constants'

// MARK: UI

export const UI_VIRTUAL_WIDTH = 1920
export const UI_VIRTUAL_HEIGHT = 1080

export const UI_FONT = 'monospace' as const

export function boldUi(value: string): string {
  return `<b>${value}</b>`
}
export const UI_TINT = Color4.create(0x33 / 255, 0xdb / 255, 0, 1)
export const UI_HUD_EDGE_PADDING_X = '2%'
export const UI_HUD_EDGE_PADDING_Y = '7%'

// Mission start / restart
export const UI_MISSION_BUTTON_FONT_SIZE = 22
export const UI_MISSION_BUTTON_WIDTH = '18%'
export const UI_MISSION_BUTTON_HEIGHT = '9%'
export const UI_MISSION_BUTTON_LEFT = '41%'
export const UI_MISSION_STATUS_LABEL_WIDTH = '29%'
export const UI_MISSION_STATUS_LABEL_LEFT = '35%'

// Exit camera
export const UI_BACK_TO_SHIP_BUTTON_WIDTH = '20%'
export const UI_BACK_TO_SHIP_BUTTON_HEIGHT = '32%'
export const UI_BACK_TO_SHIP_BUTTON_FONT_SIZE = 36

// Turret camera crosshair
export const UI_TURRET_CROSSHAIR_PATH = 'assets/scene/Images/cam_crosshair_corners.png'
export const UI_TURRET_CROSSHAIR_SLICES = { top: 0.49, bottom: 0.49, left: 0.49, right: 0.49 }
/** Screen width left of the right-side column (UI_BACK_TO_SHIP_BUTTON_WIDTH + UI_HUD_EDGE_PADDING_X), inset by UI_HUD_EDGE_PADDING_X on both sides. */
export const UI_TURRET_CROSSHAIR_WIDTH = '74%'
/** Full screen height inset by UI_HUD_EDGE_PADDING_Y top and bottom. */
export const UI_TURRET_CROSSHAIR_HEIGHT = '86%'

// Which turret camera is active, drawn inside the crosshair frame's bottom-left corner.
export const UI_CAM_INDICATOR_PATHS: Record<TurretId, string> = {
  left: 'assets/scene/Images/cam_indicator_left.png',
  center: 'assets/scene/Images/cam_indicator_center.png',
  right: 'assets/scene/Images/cam_indicator_right.png'
}
/** Both axes are this share of screen height, so the art stays square when the mobile virtual canvas is shorter than desktop. */
export const UI_CAM_INDICATOR_SIZE = '22.22vh'
/** Inset from the left edge, as a share of screen width. */
export const UI_CAM_INDICATOR_LEFT = '9.4vw'
/** Inset from the bottom edge, as a share of screen height. */
export const UI_CAM_INDICATOR_BOTTOM = '20.4vh'

// Prompt while a turret camera is up and nothing is locked
export const UI_SELECT_TARGET_FONT_SIZE = 32
export const UI_SELECT_TARGET_LABEL_WIDTH = '36%'
export const UI_SELECT_TARGET_LABEL_HEIGHT = '6vh'
export const UI_SELECT_TARGET_BLINK_MS = 500

// Hull bar
export const UI_HEALTH_BAR_WIDTH = '36%'
export const UI_HEALTH_BAR_HEIGHT = '4.8%'
export const UI_HEALTH_BAR_FONT_SIZE = 22

// Repair hold, centered on the screen. Width shrinks from this size as the hold progresses.
export const UI_REPAIR_HOLD_BAR_WIDTH = '24%'
export const UI_REPAIR_HOLD_BAR_HEIGHT = '5%'
export const UI_REPAIR_HOLD_BAR_FONT_SIZE = 22

// Encounter stage banner
export const UI_ENCOUNTER_STAGE_DURATION_SECONDS = 2
export const UI_ENCOUNTER_STAGE_FONT_SIZE = 48
export const UI_ENCOUNTER_STAGE_LABEL_WIDTH = '38%'
export const UI_ENCOUNTER_STAGE_LABEL_HEIGHT = '7%'
/** Top edge of the banner. Centers the 7% label on the line 66% up the screen (34% from the top). */
export const UI_ENCOUNTER_STAGE_LABEL_TOP = '30.5%'

// Overcharge label
export const UI_OVERCHARGE_LABEL_WIDTH = '57%'
export const UI_OVERCHARGE_LABEL_HEIGHT = '4.5%'
export const UI_OVERCHARGE_LABEL_FONT_SIZE = 27
export const UI_OVERCHARGE_LABEL_MARGIN_TOP = '11.8%'

// Skills panel (fixed height so footer text stays inside the frame, not viewport-bottom aligned)
export const UI_SKILL_PANEL_HEIGHT = '47vh'
export const UI_SKILL_PANEL_WIDTH = UI_BACK_TO_SHIP_BUTTON_WIDTH
export const UI_SKILL_PANEL_ROW_HEIGHT = '5vh'
export const UI_SKILL_PANEL_ROW_MARGIN = '2vh'
export const UI_SKILL_PANEL_PADDING_X = '7%'
export const UI_SKILL_PANEL_PADDING_Y = '2vh'
export const UI_SKILL_PANEL_TITLE_HEIGHT = '3vh'
export const UI_SKILL_PANEL_TITLE_FONT_SIZE = 22
export const UI_SKILL_TEXT_ROW_HEIGHT = '72%'
export const UI_SKILL_ICON_WIDTH = '12%'
export const UI_SKILL_ICON_MARGIN_RIGHT = '4%'
export const UI_SKILL_LABEL_WIDTH = '50%'
export const UI_SKILL_LEVEL_WIDTH = '16%'
export const UI_SKILL_XP_BAR_HEIGHT = '16%'
export const UI_SKILL_XP_BAR_MARGIN_TOP = '4%'
export const UI_SKILL_DOUBLE_XP_ROW_HEIGHT = '3vh'
export const UI_SKILL_DOUBLE_XP_FONT_SIZE = 18
export const UI_GUNNER_ICON_PATH = 'assets/scene/Images/gunner.png'
export const UI_ENGINEERING_ICON_PATH = 'assets/scene/Images/engineering.png'

// Off-screen breach repair icons, drawn on the screen edge toward each active breach
export const UI_BREACH_ICON_SIZE_VH = 8.4
/** Extra scale at the peak of the pulse (0.15 = up to 15% bigger). */
export const UI_BREACH_ICON_PULSE_AMOUNT = 0.30
/** Pulses (bounces) per second; |sin| makes each half-cycle a bounce. */
export const UI_BREACH_ICON_PULSE_HZ = 1.5
/** Icon center is kept this many half-icon-sizes from each screen edge (1 = touching, extra room covers the pulse). */
export const UI_BREACH_ICON_EDGE_INSET_HALF_SIZES = 1.3
export const UI_BREACH_ICON_TINT = Color4.create(1, 0.27, 0.05, 1)
/** The rectangle around the player, "stood up" onto the screen, is 16:9 (half extents in arbitrary units). */
export const UI_BREACH_RECT_HALF_WIDTH = 16
export const UI_BREACH_RECT_HALF_HEIGHT = 9

// Green pixel frame / buttons
export const UI_GREEN_PIXEL_FRAME_PATH = 'assets/scene/Images/green_pixel_frame_9.png'
// Corner art is 17px of the 128px texture. Larger slices force a minimum frame size of
// 2x the slice, and smaller elements get the frame drawn past their bounds.
export const UI_GREEN_PIXEL_FRAME_SLICES = { top: 0.14, bottom: 0.14, left: 0.14, right: 0.14 }
export const UI_GREEN_PIXEL_FRAME_FILL = Color4.create(0.1, 0.2, 0.2, 0.8)
export const UI_GREEN_PIXEL_BUTTON_HOVER_FILL = Color4.create(0.15, 0.5, 0.25, 0.8)
export const UI_GREEN_PIXEL_BUTTON_HOVER_INSET = 8
