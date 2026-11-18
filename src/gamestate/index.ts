import { engine, Entity } from '@dcl/sdk/ecs'
import { isServer, syncEntity } from '@dcl/sdk/network'
import { OVERCHARGE_DURATION_SECONDS, SHIP_BASE_HULL_HP } from '../gamebalance/constants'
import { PATH_START_STOP_ID } from '../path/constants'
import { isPathFinished, resumeFromStop, teleportToStop } from '../path/follow'
import { clampSimulationStep } from '../utilities'
import { GameState, type GameStateSnapshot } from './schema'

export { GameState, type GameStateSnapshot } from './schema'

const GAME_STATE_SYNC_ID = 1
const RESERVED_ENTITY_SLOT = 512

const BREACH_FIELDS = ['breach1', 'breach2', 'breach3', 'breach4', 'breach5', 'breach6'] as const
type BreachField = (typeof BREACH_FIELDS)[number]

let stateEntity: Entity | null = null
let overchargeRemaining = 0

export function defaultGameState(): GameStateSnapshot {
  return {
    encounterId: PATH_START_STOP_ID,
    hullHp: SHIP_BASE_HULL_HP,
    inEncounter: false,
    missionStarted: false,
    turret1: true,
    turret2: true,
    turret3: true,
    breach1: false,
    breach2: false,
    breach3: false,
    breach4: false,
    breach5: false,
    breach6: false,
    weaponsOvercharged: false
  }
}

function stateEntityOrThrow(): Entity {
  if (stateEntity === null) {
    throw new Error('GameState entity is not created; call setupGameState() first')
  }
  return stateEntity
}

function breachField(id: number): BreachField | undefined {
  return BREACH_FIELDS[id - 1]
}

export function isBreachActive(state: GameStateSnapshot, id: number): boolean {
  const field = breachField(id)
  return field !== undefined && state[field]
}

export function activateRandomBreach(knownIds: number[]): number | null {
  const state = GameState.getMutable(stateEntityOrThrow())
  const hidden = knownIds.filter((id) => {
    const field = breachField(id)
    return field !== undefined && !state[field]
  })
  if (hidden.length === 0) return null
  const id = hidden[Math.floor(Math.random() * hidden.length)]
  const field = breachField(id)
  if (!field) return null
  state[field] = true
  return id
}

/** Hide a breach and restore hull HP. No-op (and no HP) if already repaired. */
export function repairBreach(id: number, hullRestored: number): boolean {
  const field = breachField(id)
  if (!field) return false
  const state = GameState.getMutable(stateEntityOrThrow())
  if (!state[field]) return false
  state[field] = false
  const heal = Math.max(0, Math.floor(hullRestored))
  state.hullHp = Math.min(SHIP_BASE_HULL_HP, state.hullHp + heal)
  return true
}

function bindClientGameState(): boolean {
  if (stateEntity !== null) return true
  for (const [entity] of engine.getEntitiesWith(GameState)) {
    if ((entity & 0xffff) < RESERVED_ENTITY_SLOT) continue
    stateEntity = entity
    placeFromGameState()
    const state = getGameState()
    console.log(
      `[CLIENT] GameState bound: ${state.encounterId} mission=${state.missionStarted} hull=${state.hullHp}`
    )
    return true
  }
  return false
}

export function getGameState(): GameStateSnapshot {
  if (!isServer() && stateEntity === null) {
    bindClientGameState()
  }
  if (stateEntity === null) return defaultGameState()
  return GameState.getOrNull(stateEntity) ?? defaultGameState()
}

export function applyGameState(data: GameStateSnapshot): void {
  const state = GameState.getMutable(stateEntityOrThrow())
  state.encounterId = data.encounterId
  state.hullHp = data.hullHp
  state.inEncounter = data.inEncounter
  state.missionStarted = data.missionStarted
  state.turret1 = data.turret1
  state.turret2 = data.turret2
  state.turret3 = data.turret3
  state.breach1 = data.breach1
  state.breach2 = data.breach2
  state.breach3 = data.breach3
  state.breach4 = data.breach4
  state.breach5 = data.breach5
  state.breach6 = data.breach6
  state.weaponsOvercharged = data.weaponsOvercharged
}

export function applyMissionStarted(encounterId: string = PATH_START_STOP_ID): void {
  const state = GameState.getMutable(stateEntityOrThrow())
  state.missionStarted = true
  state.inEncounter = false
  state.encounterId = encounterId
}

export function applyEncounterActive(encounterId: string): void {
  const state = GameState.getMutable(stateEntityOrThrow())
  state.inEncounter = true
  state.encounterId = encounterId
}

export function applyEncounterEnded(encounterId: string): void {
  const state = GameState.getMutable(stateEntityOrThrow())
  state.inEncounter = false
  state.encounterId = encounterId
}

export function resetGameState(): void {
  overchargeRemaining = 0
  applyGameState(defaultGameState())
}

/** Returns false if overcharge is already running. */
export function activateOvercharge(): boolean {
  if (overchargeRemaining > 0) return false
  const state = GameState.getMutable(stateEntityOrThrow())
  if (state.weaponsOvercharged) return false
  state.weaponsOvercharged = true
  overchargeRemaining = OVERCHARGE_DURATION_SECONDS
  return true
}

export function isWeaponsOvercharged(): boolean {
  return getGameState().weaponsOvercharged
}

function OverchargeSystem(dt: number): void {
  if (overchargeRemaining <= 0) return
  overchargeRemaining -= clampSimulationStep(dt)
  if (overchargeRemaining > 0) return
  overchargeRemaining = 0
  GameState.getMutable(stateEntityOrThrow()).weaponsOvercharged = false
}

export function damageShipHull(amount: number): number {
  const state = GameState.getMutable(stateEntityOrThrow())
  state.hullHp = Math.max(0, state.hullHp - amount)
  return state.hullHp
}

/** Place the local ship from the current GameState snapshot (connect catch-up only). */
export function placeFromGameState(): void {
  const state = getGameState()
  if (!state.missionStarted) return
  if (state.inEncounter) {
    teleportToStop(state.encounterId)
    return
  }
  if (state.encounterId === PATH_START_STOP_ID) {
    resumeFromStop()
    return
  }
  teleportToStop(state.encounterId)
  if (!isPathFinished()) {
    resumeFromStop()
  }
}

export function setupGameState(): void {
  if (isServer()) {
    if (stateEntity !== null) return
    stateEntity = engine.addEntity()
    GameState.create(stateEntity, defaultGameState())
    syncEntity(stateEntity, [GameState.componentId], GAME_STATE_SYNC_ID)
    engine.addSystem(OverchargeSystem)
    return
  }

  bindClientGameState()
  engine.addSystem(function BindGameStateSystem() {
    if (stateEntity !== null && !GameState.getOrNull(stateEntity)) {
      stateEntity = null
    }
    if (stateEntity !== null) return
    bindClientGameState()
  })
}
