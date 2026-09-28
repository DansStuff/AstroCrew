import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Button, Label, UiEntity } from '@dcl/sdk/react-ecs'
import { UI_FONT, UI_TINT, boldUi } from '../constants'
import { room } from '../networking/messages'
import { contributionMapFromRows, type RoundContribution } from '../players/contributions'

type ResultRow = {
  playerId: string
  name: string
  damage: number
  repairs: number
}

const PANEL_WIDTH = 720
const PANEL_HEIGHT = 560
const TITLE_HEIGHT = 48
const HEADER_HEIGHT = 36
const ROW_HEIGHT = 48
const PORTRAIT_SIZE = 36
const CLOSE_WIDTH = 160
const CLOSE_HEIGHT = 48
const COL_CREW = 320
const COL_NAME = 274
const COL_STAT = 160

const BACKDROP_COLOR = Color4.create(0, 0, 0, 0.55)
const PANEL_COLOR = Color4.create(0.1, 0.12, 0.16, 0.96)

let visible = false
let won = false
let rows: ResultRow[] = []

function truncateWallet(address: string): string {
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function showRoundResults(
  contributions: ReadonlyMap<string, RoundContribution>,
  didWin: boolean
): void {
  won = didWin
  rows = [...contributions.entries()]
    .map(([playerId, stats]) => ({
      playerId,
      name: stats.name || truncateWallet(playerId),
      damage: stats.damage,
      repairs: stats.repairs
    }))
    .sort((a, b) => b.damage - a.damage || b.repairs - a.repairs)
  visible = true
}

function hideRoundResults() {
  visible = false
}

function ResultRowView(row: ResultRow, key: string) {
  return (
    <UiEntity
      key={key}
      uiTransform={{
        width: '100%',
        height: ROW_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center'
      }}
    >
      <UiEntity
        uiTransform={{
          width: COL_CREW,
          height: ROW_HEIGHT,
          flexDirection: 'row',
          alignItems: 'center'
        }}
      >
        <UiEntity
          uiTransform={{
            width: PORTRAIT_SIZE,
            height: PORTRAIT_SIZE,
            margin: { right: 10 }
          }}
          uiBackground={{
            avatarTexture: { userId: row.playerId },
            textureMode: 'stretch'
          }}
        />
        <Label
          value={boldUi(row.name)}
          font={UI_FONT}
          fontSize={18}
          color={UI_TINT}
          textAlign="middle-left"
          uiTransform={{ width: COL_NAME, height: ROW_HEIGHT }}
        />
      </UiEntity>
      <Label
        value={boldUi(`${row.damage}`)}
        font={UI_FONT}
        fontSize={18}
        color={UI_TINT}
        textAlign="middle-center"
        uiTransform={{ width: COL_STAT, height: ROW_HEIGHT }}
      />
      <Label
        value={boldUi(`${row.repairs}`)}
        font={UI_FONT}
        fontSize={18}
        color={UI_TINT}
        textAlign="middle-center"
        uiTransform={{ width: COL_STAT, height: ROW_HEIGHT }}
      />
    </UiEntity>
  )
}

export function RoundResultsUi() {
  if (!visible) return null

  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        positionType: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
        pointerFilter: 'block'
      }}
      uiBackground={{ color: BACKDROP_COLOR }}
    >
      <UiEntity
        uiTransform={{
          width: PANEL_WIDTH,
          height: PANEL_HEIGHT,
          flexDirection: 'column',
          alignItems: 'center',
          padding: 24
        }}
        uiBackground={{ color: PANEL_COLOR }}
      >
        <Label
          value={boldUi(won ? 'MISSION COMPLETE' : 'SHIP DESTROYED')}
          font={UI_FONT}
          fontSize={32}
          color={UI_TINT}
          textAlign="middle-center"
          uiTransform={{ width: '100%', height: TITLE_HEIGHT, margin: { bottom: 16 } }}
        />
        <UiEntity
          uiTransform={{
            width: '100%',
            height: HEADER_HEIGHT,
            flexDirection: 'row',
            alignItems: 'center',
            margin: { bottom: 8 }
          }}
        >
          <Label
            value={boldUi('Crew')}
            font={UI_FONT}
            fontSize={16}
            color={UI_TINT}
            textAlign="middle-left"
            uiTransform={{ width: COL_CREW, height: HEADER_HEIGHT }}
          />
          <Label
            value={boldUi('Damage')}
            font={UI_FONT}
            fontSize={16}
            color={UI_TINT}
            textAlign="middle-center"
            uiTransform={{ width: COL_STAT, height: HEADER_HEIGHT }}
          />
          <Label
            value={boldUi('Repairs')}
            font={UI_FONT}
            fontSize={16}
            color={UI_TINT}
            textAlign="middle-center"
            uiTransform={{ width: COL_STAT, height: HEADER_HEIGHT }}
          />
        </UiEntity>
        <UiEntity
          uiTransform={{
            width: '100%',
            height: 340,
            flexDirection: 'column',
            overflow: 'scroll',
            margin: { bottom: 16 }
          }}
        >
          {rows.length === 0 ? (
            <Label
              value={boldUi('No contributions recorded')}
              font={UI_FONT}
              fontSize={18}
              color={UI_TINT}
              textAlign="middle-center"
              uiTransform={{ width: '100%', height: ROW_HEIGHT }}
            />
          ) : (
            rows.map((row) => ResultRowView(row, row.playerId))
          )}
        </UiEntity>
        <Button
          value={boldUi('Close')}
          variant="primary"
          font={UI_FONT}
          fontSize={20}
          color={UI_TINT}
          uiTransform={{ width: CLOSE_WIDTH, height: CLOSE_HEIGHT }}
          onMouseDown={hideRoundResults}
        />
      </UiEntity>
    </UiEntity>
  )
}

export function setupRoundResultsUi() {
  let appliedResultsAt = 0
  room.onMessage('notifyRoundResults', (data) => {
    if (data.endedAt <= appliedResultsAt) return
    appliedResultsAt = data.endedAt
    showRoundResults(contributionMapFromRows(data.contributions), data.won)
  })
}
