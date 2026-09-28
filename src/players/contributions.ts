import { getPlayer } from '@dcl/sdk/players'
import { PATH_START_STOP_ID } from '../constants'

export type RoundContribution = {
  name: string
  damage: number
  repairs: number
}

/** `name` is captured while the player is in the scene; empty if it was unavailable. */
export type RoundContributionRow = {
  playerId: string
  name: string
  damage: number
  repairs: number
}

export type MissionRecord = {
  won: boolean
  furthestEncounter: string
  contributions: RoundContributionRow[]
}

const contributions = new Map<string, RoundContribution>()
let furthestEncounter = PATH_START_STOP_ID

function contributionKey(playerAddress: string): string {
  return playerAddress.toLowerCase()
}

function playerName(playerAddress: string): string {
  return getPlayer({ userId: playerAddress })?.name ?? ''
}

function getOrCreate(playerAddress: string): RoundContribution {
  const key = contributionKey(playerAddress)
  const existing = contributions.get(key)
  if (existing) return existing
  const created: RoundContribution = { name: playerName(playerAddress), damage: 0, repairs: 0 }
  contributions.set(key, created)
  return created
}

export function addDamage(playerAddress: string, amount: number): void {
  if (amount <= 0) return
  getOrCreate(playerAddress).damage += amount
}

export function addRepair(playerAddress: string): void {
  getOrCreate(playerAddress).repairs += 1
}

export function recordEncounterReached(encounterId: string): void {
  furthestEncounter = encounterId
}

export function getFurthestEncounter(): string {
  return furthestEncounter
}

export function resetContributions(): void {
  contributions.clear()
  furthestEncounter = PATH_START_STOP_ID
}

export function getContributions(): ReadonlyMap<string, RoundContribution> {
  return contributions
}

export function snapshotContributions(): RoundContributionRow[] {
  const rows: RoundContributionRow[] = []
  for (const [playerId, row] of contributions) {
    if (!row.name) row.name = playerName(playerId)
    rows.push({ playerId, name: row.name, damage: row.damage, repairs: row.repairs })
  }
  return rows
}

export function snapshotMission(won: boolean): MissionRecord {
  return {
    won,
    furthestEncounter,
    contributions: snapshotContributions()
  }
}

export function contributionMapFromRows(rows: RoundContributionRow[]): Map<string, RoundContribution> {
  const map = new Map<string, RoundContribution>()
  for (const row of rows) {
    map.set(row.playerId, { name: row.name, damage: row.damage, repairs: row.repairs })
  }
  return map
}

/** Temporary: dump the table for logging. */
export function stringifyContributions(): string {
  return JSON.stringify({ furthestEncounter, contributions: [...contributions] })
}
