import { Color4 } from '@dcl/sdk/math'
import { getPlayer } from '@dcl/sdk/players'
import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'
import {
  UI_ENGINEERING_ICON_PATH,
  UI_FONT,
  UI_TINT,
  boldUi,
  UI_GUNNER_ICON_PATH,
  UI_HUD_EDGE_PADDING_X,
  UI_HUD_EDGE_PADDING_Y,
  UI_SKILL_DOUBLE_XP_FONT_SIZE,
  UI_SKILL_DOUBLE_XP_ROW_HEIGHT,
  UI_SKILL_ICON_MARGIN_RIGHT,
  UI_SKILL_ICON_WIDTH,
  UI_SKILL_LABEL_WIDTH,
  UI_SKILL_LEVEL_WIDTH,
  UI_SKILL_PANEL_EMPTY_ROWS,
  UI_SKILL_PANEL_PADDING_X,
  UI_SKILL_PANEL_PADDING_Y,
  UI_SKILL_PANEL_ROW_HEIGHT,
  UI_SKILL_PANEL_ROW_MARGIN,
  UI_SKILL_PANEL_TITLE_FONT_SIZE,
  UI_SKILL_PANEL_TITLE_HEIGHT,
  UI_SKILL_PANEL_WIDTH,
  UI_SKILL_TEXT_ROW_HEIGHT,
  UI_SKILL_XP_BAR_HEIGHT,
  UI_SKILL_XP_BAR_MARGIN_TOP
} from '../constants'
import { DEFAULT_PLAYER_STATS, getPlayerStats, isDoubleXpAvailable, skillProgress } from '../players/stats'
import { GreenPixelFrame } from './greenPixelFrame'

const XP_BAR_TRACK = Color4.create(0.03, 0.04, 0.03, 1)
const XP_BAR_FILL = Color4.Green()

function EmptySkillRow(key: string) {
  return (
    <UiEntity
      key={key}
      uiTransform={{
        width: '100%',
        height: UI_SKILL_PANEL_ROW_HEIGHT,
        margin: { bottom: UI_SKILL_PANEL_ROW_MARGIN }
      }}
    />
  )
}

function emptySkillRows() {
  const rows = []
  for (let i = 0; i < UI_SKILL_PANEL_EMPTY_ROWS; i++) {
    rows.push(EmptySkillRow(`empty-${i}`))
  }
  return rows
}

function localSkillLevels() {
  const me = getPlayer()
  if (!me) return DEFAULT_PLAYER_STATS
  return getPlayerStats(me.userId)
}

function SkillRow(iconSrc: string, label: string, level: number, progress: number, key: string) {
  return (
    <UiEntity
      key={key}
      uiTransform={{
        width: '100%',
        height: UI_SKILL_PANEL_ROW_HEIGHT,
        flexDirection: 'column',
        justifyContent: 'center',
        margin: { bottom: UI_SKILL_PANEL_ROW_MARGIN }
      }}
    >
        <UiEntity
          uiTransform={{
            width: '100%',
            height: UI_SKILL_TEXT_ROW_HEIGHT,
            flexDirection: 'row',
            alignItems: 'center'
          }}
        >
        <UiEntity
          uiTransform={{
            width: UI_SKILL_ICON_WIDTH,
            height: '100%',
            margin: { right: UI_SKILL_ICON_MARGIN_RIGHT }
          }}
          uiBackground={{
            color: UI_TINT,
            texture: { src: iconSrc },
            textureMode: 'stretch'
          }}
        />
        <Label
          value={boldUi(label)}
          font={UI_FONT}
          fontSize={18}
          color={UI_TINT}
          textAlign="middle-left"
          uiTransform={{ width: UI_SKILL_LABEL_WIDTH, height: '100%' }}
        />
        <Label
          value={boldUi(`${level}`)}
          font={UI_FONT}
          fontSize={22}
          color={UI_TINT}
          textAlign="middle-right"
          uiTransform={{ width: UI_SKILL_LEVEL_WIDTH, height: '100%' }}
        />
      </UiEntity>
      <UiEntity
        uiTransform={{
          width: '100%',
          height: UI_SKILL_XP_BAR_HEIGHT,
          margin: { top: UI_SKILL_XP_BAR_MARGIN_TOP }
        }}
        uiBackground={{ color: XP_BAR_TRACK }}
      >
        <UiEntity
          uiTransform={{ width: `${Math.round(progress * 100)}%`, height: '100%' }}
          uiBackground={{ color: XP_BAR_FILL }}
        />
      </UiEntity>
    </UiEntity>
  )
}

export function SkillLevelsHud() {
  const stats = localSkillLevels()

  return (
    <GreenPixelFrame
      uiTransform={{
        width: UI_SKILL_PANEL_WIDTH,
        height: 'auto',
        positionType: 'absolute',
        position: { top: UI_HUD_EDGE_PADDING_Y, right: UI_HUD_EDGE_PADDING_X },
        flexDirection: 'column'
      }}
    >
        <UiEntity
          uiTransform={{
            width: '100%',
            flexDirection: 'column',
            padding: {
              left: UI_SKILL_PANEL_PADDING_X,
              right: UI_SKILL_PANEL_PADDING_X,
              top: UI_SKILL_PANEL_PADDING_Y,
              bottom: UI_SKILL_PANEL_PADDING_Y
            }
          }}
        >
          <Label
            value={boldUi('Skills')}
            font={UI_FONT}
            fontSize={UI_SKILL_PANEL_TITLE_FONT_SIZE}
            color={UI_TINT}
            textAlign="middle-left"
            uiTransform={{
              width: '100%',
              height: UI_SKILL_PANEL_TITLE_HEIGHT,
              margin: { bottom: UI_SKILL_PANEL_ROW_MARGIN }
            }}
          />
          {SkillRow(
            UI_GUNNER_ICON_PATH,
            'Gunner',
            stats.gunnerLevel,
            skillProgress(stats.gunnerLevel, stats.gunnerXp, 'gunner'),
            'gunner'
          )}
          {SkillRow(
            UI_ENGINEERING_ICON_PATH,
            'Engineering',
            stats.engineeringLevel,
            skillProgress(stats.engineeringLevel, stats.engineeringXp, 'engineering'),
            'engineering'
          )}
          {emptySkillRows()}
          <Label
            value={boldUi(isDoubleXpAvailable(stats) ? 'Double XP Available!' : 'Double XP available at 0:00 UTC')}
            font={UI_FONT}
            fontSize={UI_SKILL_DOUBLE_XP_FONT_SIZE}
            color={UI_TINT}
            textAlign="bottom-center"
            uiTransform={{ width: '100%', height: UI_SKILL_DOUBLE_XP_ROW_HEIGHT }}
          />
        </UiEntity>
      </GreenPixelFrame>
  )
}
