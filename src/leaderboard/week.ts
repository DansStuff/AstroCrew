import { PATH_START_STOP_ID } from '../path/constants'
import { SHIP_ROUTE } from '../path/routedata'
import { type MissionRecord } from '../players/contributions'

export const WEEKLY_TOP_N = 5

const encounterRank = new Map<string, number>()
encounterRank.set(PATH_START_STOP_ID, 0)
SHIP_ROUTE.legs.forEach((leg, index) => {
  encounterRank.set(leg.stopId, index + 1)
})

export function utcIsoWeekId(nowMs: number = Date.now()): string {
  const date = new Date(nowMs)
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() + 4 - day)
  const year = utc.getUTCFullYear()
  const yearStart = new Date(Date.UTC(year, 0, 1))
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

export function furthestEncounterRank(encounterId: string): number {
  return encounterRank.get(encounterId) ?? -1
}

export function totalMissionDamage(mission: MissionRecord): number {
  let total = 0
  for (const row of mission.contributions) {
    total += row.damage
  }
  return total
}

export function compareWeeklyMissions(a: MissionRecord, b: MissionRecord): number {
  const byEncounter = furthestEncounterRank(b.furthestEncounter) - furthestEncounterRank(a.furthestEncounter)
  if (byEncounter !== 0) return byEncounter
  return totalMissionDamage(b) - totalMissionDamage(a)
}
