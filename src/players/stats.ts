import { engine, Entity, Schemas } from '@dcl/sdk/ecs'
import { isServer, syncEntity } from '@dcl/sdk/network'
import { AUTH_SERVER_PEER_ID } from '@dcl/sdk/network/message-bus-sync'
import { DOUBLE_XP_MULTIPLIER, ENGINEERING_XP_GROWTH, ENGINEERING_XP_LEVEL_1, GUNNER_XP_GROWTH, GUNNER_XP_LEVEL_1, SKILL_MAX_LEVEL } from '../constants'

export const PlayerStats = engine.defineComponent('game:PlayerStats', {
  playerId: Schemas.String,
  gunnerLevel: Schemas.Int,
  engineeringLevel: Schemas.Int,
  gunnerXp: Schemas.Int,
  engineeringXp: Schemas.Int,
  lastMissionAt: Schemas.Int64,
  doubleXpMission: Schemas.Boolean
})

export type PlayerStatsSnapshot = {
  playerId: string
  gunnerLevel: number
  engineeringLevel: number
  gunnerXp: number
  engineeringXp: number
  lastMissionAt: number
  doubleXpMission: boolean
}

type StoredStats = Omit<PlayerStatsSnapshot, 'playerId' | 'doubleXpMission'>

export type SkillId = 'gunner' | 'engineering'

export const DEFAULT_PLAYER_STATS: Omit<PlayerStatsSnapshot, 'playerId'> = {
  gunnerLevel: 1,
  engineeringLevel: 1,
  gunnerXp: 0,
  engineeringXp: 0,
  lastMissionAt: 0,
  doubleXpMission: false
}

const STATS_STORAGE_KEY = 'stats'
const RESERVED_ENTITY_SLOT = 512
const LOAD_RETRY_INITIAL_MS = 5000
const LOAD_RETRY_MAX_MS = 60000

type StatsEntry = {
  address: string
  status: 'loading' | 'loaded' | 'failed'
  dirty: boolean
  pendingGunnerXp: number
  pendingEngineeringXp: number
  retryDelayMs: number
  retryAt: number
}

type StoredStatsRead = { kind: 'found'; raw: unknown } | { kind: 'absent' } | { kind: 'failed' }

const playerEntities = new Map<string, Entity>()
const statsEntries = new Map<string, StatsEntry>()

if (isServer()) {
  PlayerStats.validateBeforeChange((value) => {
    return value.senderAddress === AUTH_SERVER_PEER_ID
  })
}

function statsKey(playerAddress: string): string {
  return playerAddress.toLowerCase()
}

function defaultSnapshot(playerId: string): PlayerStatsSnapshot {
  return {
    playerId,
    gunnerLevel: DEFAULT_PLAYER_STATS.gunnerLevel,
    engineeringLevel: DEFAULT_PLAYER_STATS.engineeringLevel,
    gunnerXp: DEFAULT_PLAYER_STATS.gunnerXp,
    engineeringXp: DEFAULT_PLAYER_STATS.engineeringXp,
    lastMissionAt: DEFAULT_PLAYER_STATS.lastMissionAt,
    doubleXpMission: DEFAULT_PLAYER_STATS.doubleXpMission
  }
}

function utcDayId(ms: number): string {
  const date = new Date(ms)
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${date.getUTCFullYear()}-${month}-${day}`
}

function startedMissionToday(lastMissionAt: number, nowMs: number): boolean {
  return lastMissionAt > 0 && utcDayId(lastMissionAt) === utcDayId(nowMs)
}

/** Milliseconds until the next 00:00 UTC, when the daily double-XP mission resets. */
export function msUntilNextUtcDay(nowMs: number = Date.now()): number {
  const date = new Date(nowMs)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1) - nowMs
}

export function isDoubleXpAvailable(
  stats: Pick<PlayerStatsSnapshot, 'lastMissionAt' | 'doubleXpMission'>,
  nowMs: number = Date.now()
): boolean {
  return stats.doubleXpMission || !startedMissionToday(stats.lastMissionAt, nowMs)
}

function xpBase(skill: SkillId): number {
  return skill === 'gunner' ? GUNNER_XP_LEVEL_1 : ENGINEERING_XP_LEVEL_1
}

function xpGrowth(skill: SkillId): number {
  return skill === 'gunner' ? GUNNER_XP_GROWTH : ENGINEERING_XP_GROWTH
}

export function xpToNextLevel(level: number, skill: SkillId): number {
  if (level >= SKILL_MAX_LEVEL) return 0
  return Math.round(xpBase(skill) * Math.pow(xpGrowth(skill), level - 1))
}

export function skillProgress(level: number, xp: number, skill: SkillId): number {
  if (level >= SKILL_MAX_LEVEL) return 1
  const need = xpToNextLevel(level, skill)
  if (need <= 0) return 0
  return Math.max(0, Math.min(1, xp / need))
}

function clampLevel(value: number): number {
  return Math.max(1, Math.min(SKILL_MAX_LEVEL, Math.floor(value)))
}

function clampXp(value: number): number {
  return Math.max(0, Math.floor(value))
}

function applyXp(level: number, xp: number, amount: number, skill: SkillId): { level: number; xp: number } {
  if (level >= SKILL_MAX_LEVEL) return { level: SKILL_MAX_LEVEL, xp: 0 }
  let nextLevel = level
  let nextXp = xp + amount
  while (nextLevel < SKILL_MAX_LEVEL) {
    const need = xpToNextLevel(nextLevel, skill)
    if (nextXp < need) break
    nextXp -= need
    nextLevel += 1
  }
  if (nextLevel >= SKILL_MAX_LEVEL) return { level: SKILL_MAX_LEVEL, xp: 0 }
  return { level: nextLevel, xp: nextXp }
}

function findPlayerStatsEntity(playerAddress: string): Entity | null {
  const key = statsKey(playerAddress)
  const cached = playerEntities.get(key)
  if (cached !== undefined && PlayerStats.getOrNull(cached) !== null) {
    return cached
  }
  for (const [entity, data] of engine.getEntitiesWith(PlayerStats)) {
    if ((entity & 0xffff) < RESERVED_ENTITY_SLOT) continue
    if (data.playerId.toLowerCase() !== key) continue
    return entity
  }
  return null
}

function getOrCreatePlayerEntity(playerAddress: string): Entity {
  const key = statsKey(playerAddress)
  const cached = playerEntities.get(key)
  if (cached !== undefined && PlayerStats.getOrNull(cached) !== null) return cached
  if (cached !== undefined) {
    playerEntities.delete(key)
    try {
      engine.removeEntity(cached)
    } catch {
      /* already gone */
    }
  }

  for (const [entity, data] of engine.getEntitiesWith(PlayerStats)) {
    if ((entity & 0xffff) < RESERVED_ENTITY_SLOT) continue
    if (data.playerId.toLowerCase() !== key) continue
    playerEntities.set(key, entity)
    return entity
  }

  const entity = engine.addEntity()
  PlayerStats.create(entity, defaultSnapshot(key))
  syncEntity(entity, [PlayerStats.componentId])
  playerEntities.set(key, entity)
  return entity
}

function parseLevel(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return clampLevel(value)
}

function parseXp(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return clampXp(value)
}

function parseTimestamp(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0
  return Math.floor(value)
}

function parseStoredStats(raw: unknown): StoredStats | null {
  if (typeof raw !== 'string' || raw.length === 0) return null
  try {
    const parsed = JSON.parse(raw) as {
      gunnerLevel?: unknown
      engineeringLevel?: unknown
      gunnerXp?: unknown
      engineeringXp?: unknown
      lastMissionAt?: unknown
      lastXpAt?: unknown
    }
    const gunnerLevel = parseLevel(parsed.gunnerLevel)
    const engineeringLevel = parseLevel(parsed.engineeringLevel)
    if (gunnerLevel === null || engineeringLevel === null) return null
    return {
      gunnerLevel,
      engineeringLevel,
      gunnerXp: parseXp(parsed.gunnerXp),
      engineeringXp: parseXp(parsed.engineeringXp),
      lastMissionAt: parseTimestamp(parsed.lastMissionAt ?? parsed.lastXpAt)
    }
  } catch {
    return null
  }
}

export function getPlayerStats(playerAddress: string): PlayerStatsSnapshot {
  const entity = findPlayerStatsEntity(playerAddress)
  if (entity === null) return defaultSnapshot(statsKey(playerAddress))
  return PlayerStats.getOrNull(entity) ?? defaultSnapshot(statsKey(playerAddress))
}

export function getGunnerLevel(playerAddress: string): number {
  return getPlayerStats(playerAddress).gunnerLevel
}

export function getEngineeringLevel(playerAddress: string): number {
  return getPlayerStats(playerAddress).engineeringLevel
}

function storedStatsPayload(stats: StoredStats): string {
  return JSON.stringify({
    gunnerLevel: stats.gunnerLevel,
    engineeringLevel: stats.engineeringLevel,
    gunnerXp: stats.gunnerXp,
    engineeringXp: stats.engineeringXp,
    lastMissionAt: stats.lastMissionAt
  })
}

/**
 * Null (a 404) means a new player; a thrown read is a failure and is retried.
 * The installed SDK also resolves null for failed reads, so those are treated
 * as a new player until the `auth-server` build with js-sdk-toolchain#1630.
 */
async function readStoredStats(playerAddress: string): Promise<StoredStatsRead> {
  const { Storage } = await import('@dcl/sdk/server')
  try {
    const raw = await Storage.player.get<string>(playerAddress, STATS_STORAGE_KEY)
    if (raw === null || raw === undefined) return { kind: 'absent' }
    return { kind: 'found', raw }
  } catch {
    return { kind: 'failed' }
  }
}

async function loadPlayerStats(key: string): Promise<void> {
  const entry = statsEntries.get(key)
  if (!entry || entry.status === 'loaded') return
  entry.status = 'loading'

  const result = await readStoredStats(entry.address)
  if (result.kind === 'failed') {
    entry.status = 'failed'
    entry.retryAt = Date.now() + entry.retryDelayMs
    console.log(`[SERVER] PlayerStats load failed for ${entry.address}; retrying in ${entry.retryDelayMs / 1000}s`)
    entry.retryDelayMs = Math.min(entry.retryDelayMs * 2, LOAD_RETRY_MAX_MS)
    return
  }

  const stored = result.kind === 'found' ? parseStoredStats(result.raw) : null
  const base = stored ?? DEFAULT_PLAYER_STATS
  const gunner = applyXp(base.gunnerLevel, base.gunnerXp, entry.pendingGunnerXp, 'gunner')
  const engineering = applyXp(base.engineeringLevel, base.engineeringXp, entry.pendingEngineeringXp, 'engineering')

  const hadPending = entry.pendingGunnerXp > 0 || entry.pendingEngineeringXp > 0
  const mutable = PlayerStats.getMutableOrNull(getOrCreatePlayerEntity(entry.address))
  if (mutable) {
    mutable.gunnerLevel = gunner.level
    mutable.gunnerXp = gunner.xp
    mutable.engineeringLevel = engineering.level
    mutable.engineeringXp = engineering.xp
    mutable.lastMissionAt = base.lastMissionAt
  }

  const storedWasInvalid = result.kind === 'found' && stored === null
  entry.status = 'loaded'
  entry.dirty = hadPending || storedWasInvalid
  entry.pendingGunnerXp = 0
  entry.pendingEngineeringXp = 0
}

/** Writes every loaded player whose stats changed since the last flush. */
export async function flushPlayerStats(): Promise<void> {
  if (!isServer()) return
  const { Storage } = await import('@dcl/sdk/server')
  for (const entry of statsEntries.values()) {
    if (entry.status !== 'loaded' || !entry.dirty) continue
    entry.dirty = false
    let saved = false
    try {
      saved = await Storage.player.set(
        entry.address,
        STATS_STORAGE_KEY,
        storedStatsPayload(getPlayerStats(entry.address))
      )
    } catch {
      saved = false
    }
    if (!saved) {
      entry.dirty = true
      console.log(`[SERVER] PlayerStats persist failed for ${entry.address}`)
    }
  }
}

function StatsLoadRetrySystem(): void {
  const now = Date.now()
  for (const [key, entry] of statsEntries) {
    if (entry.status !== 'failed' || now < entry.retryAt) continue
    void loadPlayerStats(key)
  }
}

export function awardSkillXp(playerAddress: string, skill: SkillId, amount: number): void {
  if (!isServer() || amount <= 0) return
  const entity = getOrCreatePlayerEntity(playerAddress)
  const mutable = PlayerStats.getMutableOrNull(entity)
  if (!mutable) return

  const awarded = mutable.doubleXpMission ? amount * DOUBLE_XP_MULTIPLIER : amount
  if (skill === 'gunner') {
    const next = applyXp(mutable.gunnerLevel, mutable.gunnerXp, awarded, 'gunner')
    mutable.gunnerLevel = next.level
    mutable.gunnerXp = next.xp
  } else {
    const next = applyXp(mutable.engineeringLevel, mutable.engineeringXp, awarded, 'engineering')
    mutable.engineeringLevel = next.level
    mutable.engineeringXp = next.xp
  }

  const entry = statsEntries.get(statsKey(playerAddress))
  if (!entry) return
  if (entry.status === 'loaded') {
    entry.dirty = true
  } else if (skill === 'gunner') {
    entry.pendingGunnerXp += awarded
  } else {
    entry.pendingEngineeringXp += awarded
  }
}

/** Flags loaded players who have not started a mission this UTC day, and stamps that start time. */
export function beginMissionDoubleXp(): void {
  if (!isServer()) return
  const now = Date.now()
  const flagged: string[] = []
  for (const entry of statsEntries.values()) {
    if (entry.status !== 'loaded') continue
    const mutable = PlayerStats.getMutableOrNull(getOrCreatePlayerEntity(entry.address))
    if (!mutable) continue
    mutable.doubleXpMission = !startedMissionToday(mutable.lastMissionAt, now)
    mutable.lastMissionAt = now
    entry.dirty = true
    if (mutable.doubleXpMission) flagged.push(entry.address)
  }
  console.log(`[SERVER] Double XP this mission: ${flagged.length > 0 ? flagged.join(', ') : 'none'}`)
}

export function endMissionDoubleXp(): void {
  if (!isServer()) return
  for (const [entity, data] of engine.getEntitiesWith(PlayerStats)) {
    if (!data.doubleXpMission) continue
    PlayerStats.getMutable(entity).doubleXpMission = false
  }
}

export function onPlayerConnected(playerAddress: string): void {
  if (!isServer()) return
  getOrCreatePlayerEntity(playerAddress)
  const key = statsKey(playerAddress)
  if (statsEntries.has(key)) return
  statsEntries.set(key, {
    address: playerAddress,
    status: 'loading',
    dirty: false,
    pendingGunnerXp: 0,
    pendingEngineeringXp: 0,
    retryDelayMs: LOAD_RETRY_INITIAL_MS,
    retryAt: 0
  })
  void loadPlayerStats(key)
}

function reconcilePlayerEntities(): void {
  for (const [entity, data] of engine.getEntitiesWith(PlayerStats)) {
    if ((entity & 0xffff) < RESERVED_ENTITY_SLOT) continue
    const key = data.playerId.toLowerCase()
    const existing = playerEntities.get(key)
    if (existing === undefined) {
      playerEntities.set(key, entity)
    } else if (existing !== entity) {
      engine.removeEntity(entity)
    }
  }
}

export function setupPlayers() {
  if (!isServer()) return
  reconcilePlayerEntities()
  engine.addSystem(StatsLoadRetrySystem)
}
