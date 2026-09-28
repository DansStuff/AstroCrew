import { isServer } from '@dcl/sdk/network'
import { type MissionRecord, type RoundContributionRow } from '../players/contributions'
import { compareWeeklyMissions, utcIsoWeekId, WEEKLY_TOP_N } from './week'

export type WeeklyBoard = {
  weekId: string
  missions: MissionRecord[]
}

const STORAGE_KEY = 'weeklyMissions'

let board: WeeklyBoard = emptyBoard()
let loadPromise: Promise<boolean> | null = null

function emptyBoard(weekId: string = utcIsoWeekId()): WeeklyBoard {
  return { weekId, missions: [] }
}

function snapshot(): WeeklyBoard {
  return { weekId: board.weekId, missions: board.missions.slice() }
}

function parseContribution(raw: unknown): RoundContributionRow | null {
  if (typeof raw !== 'object' || raw === null) return null
  const row = raw as { playerId?: unknown; name?: unknown; damage?: unknown; repairs?: unknown }
  if (typeof row.playerId !== 'string' || row.playerId.length === 0) return null
  if (typeof row.damage !== 'number' || !Number.isFinite(row.damage)) return null
  if (typeof row.repairs !== 'number' || !Number.isFinite(row.repairs)) return null
  return {
    playerId: row.playerId,
    name: typeof row.name === 'string' ? row.name : '',
    damage: Math.max(0, Math.floor(row.damage)),
    repairs: Math.max(0, Math.floor(row.repairs))
  }
}

function parseMission(raw: unknown): MissionRecord | null {
  if (typeof raw !== 'object' || raw === null) return null
  const mission = raw as { won?: unknown; furthestEncounter?: unknown; contributions?: unknown }
  if (typeof mission.won !== 'boolean') return null
  if (typeof mission.furthestEncounter !== 'string' || mission.furthestEncounter.length === 0) return null
  if (!Array.isArray(mission.contributions)) return null
  const contributions: RoundContributionRow[] = []
  for (const row of mission.contributions) {
    const parsed = parseContribution(row)
    if (!parsed) return null
    contributions.push(parsed)
  }
  return { won: mission.won, furthestEncounter: mission.furthestEncounter, contributions }
}

/** Bad missions are skipped individually; they drop out on the next mission write. */
function parseBoard(raw: unknown): WeeklyBoard | null {
  if (typeof raw !== 'string' || raw.length === 0) return null
  try {
    const parsed = JSON.parse(raw) as { weekId?: unknown; missions?: unknown }
    if (typeof parsed.weekId !== 'string' || parsed.weekId.length === 0) return null
    if (!Array.isArray(parsed.missions)) return null
    const missions: MissionRecord[] = []
    for (const mission of parsed.missions) {
      const row = parseMission(mission)
      if (row) missions.push(row)
    }
    return { weekId: parsed.weekId, missions }
  } catch {
    return null
  }
}

function rollToCurrentWeek(): void {
  const weekId = utcIsoWeekId()
  if (board.weekId === weekId) return
  board = emptyBoard(weekId)
  console.log(`[SERVER] WeeklyBoard reset for ${weekId}`)
}

/**
 * Never writes. A null read (404) is an empty board; a thrown read leaves the
 * board unloaded so the next `ensureLoaded` retries.
 */
async function loadBoard(): Promise<boolean> {
  const { Storage } = await import('@dcl/sdk/server')
  let raw: string | null
  try {
    raw = await Storage.get<string>(STORAGE_KEY)
  } catch (error) {
    console.log(`[SERVER] WeeklyBoard load failed: ${String(error)}`)
    loadPromise = null
    return false
  }

  const loaded = parseBoard(raw)
  if (raw !== null && raw !== undefined && !loaded) {
    console.log('[SERVER] WeeklyBoard stored value is invalid; starting empty')
  }
  board = loaded ?? emptyBoard()
  rollToCurrentWeek()
  return true
}

function ensureLoaded(): Promise<boolean> {
  if (!loadPromise) loadPromise = loadBoard()
  return loadPromise
}

export function setupWeeklyBoard(): void {
  if (!isServer()) return
  void ensureLoaded()
}

export async function getWeeklyBoardSnapshot(): Promise<WeeklyBoard> {
  if (await ensureLoaded()) rollToCurrentWeek()
  return snapshot()
}

/**
 * The only board write: one per finished mission. If the board cannot be read
 * or the write fails, the mission is dropped and the board is left unchanged.
 */
export async function recordWeeklyMission(mission: MissionRecord): Promise<WeeklyBoard> {
  if (!(await ensureLoaded())) {
    console.log('[SERVER] WeeklyBoard unavailable; mission dropped')
    return snapshot()
  }

  rollToCurrentWeek()
  const next: WeeklyBoard = {
    weekId: board.weekId,
    missions: [...board.missions, mission].sort(compareWeeklyMissions).slice(0, WEEKLY_TOP_N)
  }

  const { Storage } = await import('@dcl/sdk/server')
  let saved = false
  try {
    saved = await Storage.set(STORAGE_KEY, JSON.stringify(next))
  } catch {
    saved = false
  }
  if (!saved) {
    console.log(`[SERVER] WeeklyBoard write failed (${next.weekId}); mission dropped`)
    return snapshot()
  }

  board = next
  return snapshot()
}
