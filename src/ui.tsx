import { Color4 } from '@dcl/sdk/math'
import { isStateSyncronized } from '@dcl/sdk/network'
import { getPlayer } from '@dcl/sdk/players'
import ReactEcs, { Label, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'
import {
  SHIP_BASE_HULL_HP,
  UI_FONT,
  UI_TINT,
  boldUi,
  UI_HEALTH_BAR_FONT_SIZE,
  UI_HEALTH_BAR_HEIGHT,
  UI_HEALTH_BAR_WIDTH,
  UI_REPAIR_HOLD_BAR_FONT_SIZE,
  UI_REPAIR_HOLD_BAR_HEIGHT,
  UI_REPAIR_HOLD_BAR_WIDTH,
  UI_BACK_TO_SHIP_BUTTON_FONT_SIZE,
  UI_BACK_TO_SHIP_BUTTON_HEIGHT,
  UI_BACK_TO_SHIP_BUTTON_WIDTH,
  UI_MISSION_BUTTON_FONT_SIZE,
  UI_MISSION_BUTTON_HEIGHT,
  UI_MISSION_BUTTON_LEFT,
  UI_HUD_EDGE_PADDING_X,
  UI_HUD_EDGE_PADDING_Y,
  UI_MISSION_BUTTON_WIDTH,
  UI_MISSION_STATUS_LABEL_LEFT,
  UI_MISSION_STATUS_LABEL_WIDTH,
  UI_ENCOUNTER_STAGE_DURATION_SECONDS,
  UI_ENCOUNTER_STAGE_FONT_SIZE,
  UI_ENCOUNTER_STAGE_LABEL_HEIGHT,
  UI_ENCOUNTER_STAGE_LABEL_WIDTH,
  UI_OVERCHARGE_LABEL_FONT_SIZE,
  UI_OVERCHARGE_LABEL_HEIGHT,
  UI_OVERCHARGE_LABEL_MARGIN_TOP,
  UI_OVERCHARGE_LABEL_WIDTH,
  UI_SELECT_TARGET_BLINK_MS,
  UI_SELECT_TARGET_FONT_SIZE,
  UI_SELECT_TARGET_LABEL_HEIGHT,
  UI_SELECT_TARGET_LABEL_WIDTH,
  UI_CAM_INDICATOR_BOTTOM,
  UI_CAM_INDICATOR_LEFT,
  UI_CAM_INDICATOR_PATHS,
  UI_CAM_INDICATOR_SIZE,
  UI_TURRET_CROSSHAIR_PATH,
  UI_TURRET_CROSSHAIR_SLICES,
  UI_TURRET_CROSSHAIR_WIDTH,
  UI_TURRET_CROSSHAIR_HEIGHT,
  UI_VIRTUAL_HEIGHT,
  UI_VIRTUAL_WIDTH,
  WEAPON_LIGHT_OVERCHARGE_COLOR
} from './constants'
import { getGameState, isWeaponsOvercharged } from './gamestate'
import { room } from './networking/messages'
import { lastStopId } from './path/follow'
import { getLocalTargetTurret } from './hazards/targeting'
import { exitWeaponCamera, getOccupiedTurret, isTurretOccupied, repairHoldRemaining } from './sceneObjects'
import { GreenPixelButton } from './ui/greenPixelFrame'
import { RoundResultsUi, setupRoundResultsUi } from './ui/roundResults'
import { SkillLevelsHud } from './ui/skillLevels'

let encounterStageUntil = 0
let encounterStageTurret = ''
let overchargePlayerName = ''

const HEALTH_BAR_BACKGROUND = Color4.Red()
const HEALTH_BAR_FOREGROUND = Color4.Green()

function truncateWallet(address: string): string {
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function playerDisplayName(address: string): string {
  return getPlayer({ userId: address })?.name || truncateWallet(address)
}

function showingOverchargeLabel() {
  return isWeaponsOvercharged() && overchargePlayerName.length > 0
}

export function markEncounterStage(turret: string) {
  encounterStageTurret = turret
  encounterStageUntil = Date.now() + UI_ENCOUNTER_STAGE_DURATION_SECONDS * 1000
}

function showingEncounterStage() {
  return Date.now() < encounterStageUntil
}

function encounterStageLabel(): string {
  if (encounterStageTurret === 'left') return 'INCOMING LEFT'
  if (encounterStageTurret === 'right') return 'INCOMING RIGHT'
  if (encounterStageTurret === 'center') return 'INCOMING CENTER'
  return 'INCOMING'
}

function missionEnded(): boolean {
  const state = getGameState()
  return state.missionStarted && !state.inEncounter && state.encounterId === lastStopId()
}

function hullPercent(): number {
  return (getGameState().hullHp / SHIP_BASE_HULL_HP) * 100
}

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(uiMenu, { virtualWidth: UI_VIRTUAL_WIDTH, virtualHeight: UI_VIRTUAL_HEIGHT })
  setupRoundResultsUi()
  room.onMessage('notifyWeaponsOvercharged', (data) => {
    overchargePlayerName = playerDisplayName(data.playerId)
  })
}

function requestMissionStart() {
  if (getGameState().missionStarted || !isStateSyncronized()) return
  room.send('requestMissionStart', { requestedAt: Date.now() })
}

function requestLeaveTurret() {
  exitWeaponCamera()
}

function camIndicatorSrc(): string {
  const turret = getOccupiedTurret()
  if (!turret) return UI_CAM_INDICATOR_PATHS.center
  return UI_CAM_INDICATOR_PATHS[turret]
}

function showingSelectTarget(): boolean {
  return isTurretOccupied() && getLocalTargetTurret() === null
}

function selectTargetBlinkOn(): boolean {
  return Math.floor(Date.now() / UI_SELECT_TARGET_BLINK_MS) % 2 === 0
}

function inMissionHud() {
  return getGameState().missionStarted && !missionEnded()
}

function RepairHoldBar() {
  const remaining = repairHoldRemaining()
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        positionType: 'absolute',
        position: { top: 0, left: 0 },
        justifyContent: 'center',
        alignItems: 'center',
        display: remaining === null ? 'none' : 'flex',
        pointerFilter: 'none'
      }}
    >
      <UiEntity
        uiTransform={{
          width: UI_REPAIR_HOLD_BAR_WIDTH,
          height: UI_REPAIR_HOLD_BAR_HEIGHT,
          justifyContent: 'center',
          alignItems: 'center',
          pointerFilter: 'none'
        }}
      >
        <UiEntity
          uiTransform={{
            width: `${(remaining ?? 0) * 100}%`,
            height: '100%',
            pointerFilter: 'none'
          }}
          uiBackground={{ color: UI_TINT }}
        />
        <Label
          value={boldUi('hold')}
          font={UI_FONT}
          fontSize={UI_REPAIR_HOLD_BAR_FONT_SIZE}
          color={Color4.Black()}
          textAlign="middle-center"
          uiTransform={{
            width: '100%',
            height: '100%',
            positionType: 'absolute',
            position: { top: 0, left: 0 },
            pointerFilter: 'none'
          }}
        />
      </UiEntity>
    </UiEntity>
  )
}


export const uiMenu = () => {

  return (
  <UiEntity
    uiTransform={{
      width: '100%',
      height: '100%',
      pointerFilter: 'none'
    }}
  >
    <UiEntity
      uiTransform={{
        width: '100%',
        height: UI_HEALTH_BAR_HEIGHT,
        positionType: 'absolute',
        position: { top: UI_HUD_EDGE_PADDING_Y, left: 0 },
        justifyContent: 'center',
        alignItems: 'center',
        pointerFilter: 'none'
      }}
    >
      <UiEntity
        uiTransform={{
          width: UI_HEALTH_BAR_WIDTH,
          height: '100%'
        }}
      >
        <UiEntity
          uiTransform={{ width: '100%', height: '100%' }}
          uiBackground={{ color: HEALTH_BAR_BACKGROUND }}
        >
          <UiEntity
            uiTransform={{ width: `${hullPercent()}%`, height: '100%' }}
            uiBackground={{ color: HEALTH_BAR_FOREGROUND }}
          />
        </UiEntity>
        <Label
          value={boldUi('Hull Status')}
          font={UI_FONT}
          fontSize={UI_HEALTH_BAR_FONT_SIZE}
          color={Color4.Black()}
          textAlign="middle-center"
          uiTransform={{
            width: '100%',
            height: '100%',
            positionType: 'absolute',
            position: { top: 0, left: 0 },
            zIndex: 1,
            pointerFilter: 'none'
          }}
        />
      </UiEntity>
    </UiEntity>

    <UiEntity
      uiTransform={{
        width: '100%',
        height: UI_OVERCHARGE_LABEL_HEIGHT,
        positionType: 'absolute',
        position: { top: UI_OVERCHARGE_LABEL_MARGIN_TOP, left: 0 },
        justifyContent: 'center',
        alignItems: 'center',
        display: showingOverchargeLabel() ? 'flex' : 'none',
        pointerFilter: 'none'
      }}
    >
      <Label
        value={boldUi(`Weapons supercharged by ${overchargePlayerName}!`)}
        font={UI_FONT}
        fontSize={UI_OVERCHARGE_LABEL_FONT_SIZE}
        color={Color4.fromColor3(WEAPON_LIGHT_OVERCHARGE_COLOR)}
        textAlign="middle-center"
        uiTransform={{
          width: UI_OVERCHARGE_LABEL_WIDTH,
          height: '100%'
        }}
      />
    </UiEntity>

    <UiEntity
      uiTransform={{
        width: UI_TURRET_CROSSHAIR_WIDTH,
        height: UI_TURRET_CROSSHAIR_HEIGHT,
        positionType: 'absolute',
        position: { top: UI_HUD_EDGE_PADDING_Y, left: UI_HUD_EDGE_PADDING_X },
        display: isTurretOccupied() ? 'flex' : 'none',
        pointerFilter: 'none'
      }}
      uiBackground={{
        texture: { src: UI_TURRET_CROSSHAIR_PATH },
        textureMode: 'nine-slices',
        textureSlices: UI_TURRET_CROSSHAIR_SLICES
      }}
    />

    <UiEntity
      uiTransform={{
        width: UI_CAM_INDICATOR_SIZE,
        height: UI_CAM_INDICATOR_SIZE,
        positionType: 'absolute',
        position: { bottom: UI_CAM_INDICATOR_BOTTOM, left: UI_CAM_INDICATOR_LEFT },
        display: isTurretOccupied() ? 'flex' : 'none',
        pointerFilter: 'none'
      }}
      uiBackground={{
        texture: { src: camIndicatorSrc() },
        textureMode: 'stretch'
      }}
    />

    <UiEntity
      uiTransform={{
        width: '100%',
        height: UI_SELECT_TARGET_LABEL_HEIGHT,
        positionType: 'absolute',
        position: { bottom: UI_HUD_EDGE_PADDING_Y, left: 0 },
        justifyContent: 'center',
        alignItems: 'center',
        display: showingSelectTarget() ? 'flex' : 'none',
        opacity: selectTargetBlinkOn() ? 1 : 0,
        pointerFilter: 'none'
      }}
    >
      <Label
        value={boldUi('SELECT TARGET')}
        font={UI_FONT}
        fontSize={UI_SELECT_TARGET_FONT_SIZE}
        color={UI_TINT}
        textAlign="middle-center"
        uiTransform={{
          width: UI_SELECT_TARGET_LABEL_WIDTH,
          height: '100%',
          pointerFilter: 'none'
        }}
      />
    </UiEntity>

    <GreenPixelButton
      value="Exit Camera"
      fontSize={UI_BACK_TO_SHIP_BUTTON_FONT_SIZE}
      uiTransform={{
        width: UI_BACK_TO_SHIP_BUTTON_WIDTH,
        height: UI_BACK_TO_SHIP_BUTTON_HEIGHT,
        positionType: 'absolute',
        position: {
          bottom: UI_HUD_EDGE_PADDING_Y,
          right: UI_HUD_EDGE_PADDING_X
        },
        display: isTurretOccupied() ? 'flex' : 'none',
        zIndex: 2
      }}
      onMouseDown={requestLeaveTurret}
    />

    {showingEncounterStage() ? (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        positionType: 'absolute',
        position: { top: 0, left: 0 },
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      <Label
        value={boldUi(encounterStageLabel())}
        font={UI_FONT}
        fontSize={UI_ENCOUNTER_STAGE_FONT_SIZE}
        color={UI_TINT}
        textAlign="middle-center"
        uiTransform={{
          width: UI_ENCOUNTER_STAGE_LABEL_WIDTH,
          height: UI_ENCOUNTER_STAGE_LABEL_HEIGHT
        }}
      />
    </UiEntity>
    ) : null}
    <RepairHoldBar />
    <SkillLevelsHud />
    <RoundResultsUi />
  </UiEntity>
  )
}
