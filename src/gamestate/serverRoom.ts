/**
 * The only server `room.onMessage` / `room.send`. Imported by the state
 * machine; other server modules notify through it, they do not import `room`.
 */
import { type HazardKind } from '../gamebalance/constants'
import { PATH_START_STOP_ID } from '../path/constants'
import { room } from '../networking/messages'

export type HazardSpawnNotify = {
  hazardId: number
  encounterId: string
  position: { x: number; y: number; z: number }
  flightTime: number
  kind: HazardKind
  hp: number
  maxHp: number
}

export type HazardHealthNotify = {
  hazardId: number
  hp: number
  /** Address of the gunner whose shot caused this change. */
  shooter: string
}

export type HazardTargetedNotify = {
  hazardId: number
  targeter: string
}

export type HazardImpactNotify = {
  hazardId: number
}

export type SaucerFiredNotify = {
  hazardId: number
  position: { x: number; y: number; z: number }
}

export type RoundResultsNotify = {
  won: boolean
  endedAt: number
  furthestEncounter: string
  contributions: { playerId: string; name: string; damage: number; repairs: number }[]
}

export type WeeklyBoardNotify = {
  weekId: string
  updatedAt: number
  missions: {
    won: boolean
    furthestEncounter: string
    contributions: { playerId: string; name: string; damage: number; repairs: number }[]
  }[]
}

export type ServerInboxHandlers = {
  onMissionStart: (playerAddress: string) => void
  onInitialState: (playerAddress: string) => void
  onHazardTarget: (playerAddress: string, hazardId: number) => void
  onRepairBreach: (playerAddress: string, breachId: number) => void
  onOvercharge: (playerAddress: string) => void
}

export function notifyMissionStart(): void {
  room.send('notifyMissionStart', { encounterId: PATH_START_STOP_ID, startedAt: Date.now() })
}

export function notifyNewMission(): void {
  room.send('notifyNewMission', { resetAt: Date.now() })
}

export type ShipDyingNotify = {
  axis: { x: number; y: number; z: number }
  startedAt: number
}

export function notifyShipDying(data: ShipDyingNotify, to?: string): void {
  if (to) {
    room.send('notifyShipDying', data, { to: [to] })
    return
  }
  room.send('notifyShipDying', data)
}

export function notifyShipDestroyed(): void {
  room.send('notifyShipDestroyed', { destroyedAt: Date.now() })
}

export function notifyEncounterEnd(encounterId: string): void {
  room.send('notifyEncounterEnd', { encounterId })
}

export function notifyEncounterStage(turret: string, to?: string): void {
  const payload = { turret, startedAt: Date.now() }
  if (to) {
    room.send('notifyEncounterStage', payload, { to: [to] })
    return
  }
  room.send('notifyEncounterStage', payload)
}

export function notifyHazardSpawn(data: HazardSpawnNotify): void {
  room.send('notifyHazardSpawn', data)
}

export function notifyHazardTargeted(data: HazardTargetedNotify): void {
  room.send('notifyHazardTargeted', data)
}

export function notifyHazardHealth(data: HazardHealthNotify): void {
  room.send('notifyHazardHealth', data)
}

export function notifyHazardImpact(data: HazardImpactNotify): void {
  room.send('notifyHazardImpact', data)
}

export function notifySaucerFired(data: SaucerFiredNotify): void {
  room.send('notifySaucerFired', data)
}

export function notifyRoundResults(data: RoundResultsNotify): void {
  room.send('notifyRoundResults', data)
}

export function notifyWeaponsOvercharged(playerId: string): void {
  room.send('notifyWeaponsOvercharged', { playerId, overchargedAt: Date.now() })
}

export function notifyWeeklyBoard(data: WeeklyBoardNotify, to?: string): void {
  if (to) {
    room.send('notifyWeeklyBoard', data, { to: [to] })
    return
  }
  room.send('notifyWeeklyBoard', data)
}

export function setupServerInbox(handlers: ServerInboxHandlers): void {
  room.onMessage('requestMissionStart', (_data, context) => {
    if (!context) return
    handlers.onMissionStart(context.from)
  })

  room.onMessage('requestInitialState', (_data, context) => {
    if (!context) return
    handlers.onInitialState(context.from)
  })

  room.onMessage('requestHazardTarget', (data, context) => {
    if (!context?.from) return
    handlers.onHazardTarget(context.from, data.hazardId)
  })

  room.onMessage('requestRepairBreach', (data, context) => {
    if (!context?.from) return
    handlers.onRepairBreach(context.from, data.breachId)
  })

  room.onMessage('requestOvercharge', (_data, context) => {
    if (!context?.from) return
    handlers.onOvercharge(context.from)
  })
}
