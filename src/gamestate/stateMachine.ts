/**
 * Server mission authority: legal transitions, the active Encounter, and
 * world side effects. `nextState` is pure; `applyTransition` writes GameState,
 * path, and notifies. Clients do not run this machine.
 */
import { engine } from '@dcl/sdk/ecs'
import { isServer } from '@dcl/sdk/network'
import { createWaveEncounter, type Encounter } from '../encounters/encounter'
import {
  ENCOUNTER_PARAMS,
  engineeringRepairHp,
  PATH_START_STOP_ID,
  SHIP_DEATH_SPIN_SECONDS,
  SKILL_XP_PER_REPAIR
} from '../constants'
import { setPlayerTarget, configureHazardNotifies, resetLive } from '../hazards/simulation'
import { isPathFinished, resetPathToStart, resumeFromStop, setOnStopReached } from '../path/follow'
import { getWeeklyBoardSnapshot, recordWeeklyMission } from '../leaderboard/weeklyBoard'
import {
  addRepair,
  recordEncounterReached,
  resetContributions,
  snapshotMission,
  stringifyContributions
} from '../players/contributions'
import {
  awardSkillXp,
  beginMissionDoubleXp,
  endMissionDoubleXp,
  flushPlayerStats,
  getEngineeringLevel,
  onPlayerConnected
} from '../players/stats'
import {
  activateOvercharge,
  applyEncounterActive,
  applyEncounterEnded,
  applyMissionStarted,
  repairBreach,
  resetGameState
} from './index'
import {
  notifyEncounterEnd,
  notifyEncounterStage,
  notifyHazardDestroyed,
  notifyHazardSpawn,
  notifyHazardTargeted,
  notifyMissionStart,
  notifyNewMission,
  notifyRoundResults,
  notifySaucerFired,
  notifyShipDestroyed,
  notifyShipDying,
  notifyWeaponsOvercharged,
  notifyWeeklyBoard,
  setupServerInbox,
  type ShipDyingNotify
} from './serverRoom'

export type MissionState = 'idle' | 'traveling' | 'inEncounter' | 'shipDying' | 'missionComplete'

export type MissionEvent =
  | { type: 'MISSION_START' }
  | { type: 'STOP_REACHED'; stopId: string; pathFinished: boolean }
  | { type: 'ENCOUNTER_CLEARED'; pathFinished: boolean }
  | { type: 'SHIP_DESTROYED' }
  | { type: 'DEATH_SEQUENCE_ENDED' }
  | { type: 'MISSION_RESET' }

let currentState: MissionState = 'idle'
let activeEncounter: Encounter | null = null
let shipDying: ShipDyingNotify | null = null
let shipDyingElapsed = 0

function hasEncounterStages(stopId: string): boolean {
  const params = ENCOUNTER_PARAMS[stopId]
  return params !== undefined && params.stages.length > 0
}

function nextState(state: MissionState, event: MissionEvent): MissionState | null {
  switch (state) {
    case 'idle':
      if (event.type === 'MISSION_START') return 'traveling'
      return null
    case 'traveling':
      if (event.type === 'STOP_REACHED') {
        if (hasEncounterStages(event.stopId)) return 'inEncounter'
        if (event.pathFinished) return 'missionComplete'
        return 'traveling'
      }
      return null
    case 'inEncounter':
      if (event.type === 'ENCOUNTER_CLEARED') return event.pathFinished ? 'missionComplete' : 'traveling'
      if (event.type === 'SHIP_DESTROYED') return 'shipDying'
      return null
    case 'shipDying':
      if (event.type === 'DEATH_SEQUENCE_ENDED') return 'idle'
      return null
    case 'missionComplete':
      if (event.type === 'MISSION_RESET') return 'idle'
      return null
  }
}

/** Uniformly distributed direction on the unit sphere. */
function randomUnitAxis(): { x: number; y: number; z: number } {
  const z = Math.random() * 2 - 1
  const phi = Math.random() * Math.PI * 2
  const r = Math.sqrt(1 - z * z)
  return { x: r * Math.cos(phi), y: r * Math.sin(phi), z }
}

function disposeEncounter(): void {
  if (!activeEncounter) return
  activeEncounter.dispose()
  activeEncounter = null
}

function resetWorld(): void {
  disposeEncounter()
  resetGameState()
  resetLive()
  resetPathToStart()
}

function publishWeeklyBoard(to?: string): void {
  void getWeeklyBoardSnapshot().then((weekly) => {
    notifyWeeklyBoard(
      {
        weekId: weekly.weekId,
        updatedAt: Date.now(),
        missions: weekly.missions
      },
      to
    )
  })
}

function finishRound(won: boolean): void {
  void flushPlayerStats()
  endMissionDoubleXp()
  const mission = snapshotMission(won)
  console.log(`[SERVER] Round contributions (${won ? 'win' : 'loss'}): ${stringifyContributions()}`)
  notifyRoundResults({
    won: mission.won,
    endedAt: Date.now(),
    furthestEncounter: mission.furthestEncounter,
    contributions: mission.contributions
  })
  void recordWeeklyMission(mission).then((weekly) => {
    notifyWeeklyBoard({
      weekId: weekly.weekId,
      updatedAt: Date.now(),
      missions: weekly.missions
    })
  })
}

function applyTransition(from: MissionState, to: MissionState, event: MissionEvent): void {
  console.log(`[STATE] ${from} → ${to} (${event.type})`)

  if (event.type === 'MISSION_START') {
    resetContributions()
    beginMissionDoubleXp()
    applyMissionStarted(PATH_START_STOP_ID)
    resumeFromStop()
    notifyMissionStart()
    return
  }

  if (event.type === 'STOP_REACHED' && to === 'inEncounter') {
    recordEncounterReached(event.stopId)
    activeEncounter = createWaveEncounter(event.stopId)
    applyEncounterActive(event.stopId)
    const turret = activeEncounter.currentTurret()
    if (turret) {
      console.log(`[SERVER] Encounter ${event.stopId} stage 0 ${turret}`)
      notifyEncounterStage(turret)
    }
    return
  }

  if (event.type === 'STOP_REACHED' && to === 'traveling') {
    resumeFromStop()
    return
  }

  if (event.type === 'ENCOUNTER_CLEARED') {
    const encounterId = activeEncounter?.id
    disposeEncounter()
    void flushPlayerStats()
    if (encounterId) {
      applyEncounterEnded(encounterId)
      console.log(`[SERVER] Encounter ${encounterId} ended`)
      notifyEncounterEnd(encounterId)
    }
    if (to === 'traveling') resumeFromStop()
    return
  }

  if (event.type === 'SHIP_DESTROYED') {
    disposeEncounter()
    shipDyingElapsed = 0
    shipDying = { axis: randomUnitAxis(), startedAt: Date.now() }
    notifyShipDying(shipDying)
    return
  }

  if (event.type === 'DEATH_SEQUENCE_ENDED') {
    shipDying = null
    finishRound(false)
    resetWorld()
    notifyShipDestroyed()
    return
  }

  if (event.type === 'MISSION_RESET') {
    finishRound(true)
    resetWorld()
    notifyNewMission()
  }
}

export function processEvent(event: MissionEvent): boolean {
  const next = nextState(currentState, event)
  if (next === null) {
    console.log(`[STATE] Ignored ${event.type} in ${currentState}`)
    return false
  }

  const from = currentState
  currentState = next
  applyTransition(from, next, event)
  return true
}

/** Seconds to wait on the mission-complete screen before resetting automatically (nobody pressed restart). */
const AUTO_RESET_DELAY_SECONDS = 1
let missionCompleteElapsed = 0

function EncounterTickSystem(dt: number): void {
  if (currentState === 'missionComplete') {
    missionCompleteElapsed += dt
    if (missionCompleteElapsed >= AUTO_RESET_DELAY_SECONDS) {
      console.log('[SERVER] Auto-resetting mission after timeout')
      processEvent({ type: 'MISSION_RESET' })
    }
    return
  }
  missionCompleteElapsed = 0
  if (currentState === 'shipDying') {
    shipDyingElapsed += dt
    if (shipDyingElapsed >= SHIP_DEATH_SPIN_SECONDS) {
      processEvent({ type: 'DEATH_SEQUENCE_ENDED' })
    }
    return
  }
  if (!activeEncounter) return

  const result = activeEncounter.tick(dt)
  if (result === 'stageStarted') {
    const turret = activeEncounter.currentTurret()
    if (turret) notifyEncounterStage(turret)
    return
  }
  if (result === 'cleared') {
    processEvent({ type: 'ENCOUNTER_CLEARED', pathFinished: isPathFinished() })
    return
  }
  if (result === 'shipDestroyed') {
    processEvent({ type: 'SHIP_DESTROYED' })
  }
}

export function setupStateMachine(): void {
  currentState = 'idle'
  shipDying = null
  disposeEncounter()

  if (!isServer()) return

  configureHazardNotifies({
    notifyHazardSpawn,
    notifyHazardTargeted,
    notifyHazardDestroyed,
    notifySaucerFired
  })

  setOnStopReached((stopId, pathFinished) => {
    processEvent({ type: 'STOP_REACHED', stopId, pathFinished })
  })

  setupServerInbox({
    onMissionStart: (from) => {
      if (processEvent({ type: 'MISSION_START' })) {
        console.log(`[SERVER] Mission started (${PATH_START_STOP_ID}) by ${from}`)
      }
    },
    onInitialState: (from) => {
      console.log(`[SERVER] Initial state requested by ${from}`)
      onPlayerConnected(from)
      publishWeeklyBoard(from)
      const turret = activeEncounter?.currentTurret()
      if (currentState === 'inEncounter' && turret) {
        notifyEncounterStage(turret, from)
      }
      if (currentState === 'shipDying' && shipDying) {
        notifyShipDying(shipDying, from)
      }
    },
    onHazardTarget: (from, hazardId) => {
      if (currentState !== 'inEncounter') return
      setPlayerTarget(from, hazardId)
    },
    onRepairBreach: (from, breachId) => {
      if (currentState === 'shipDying') return
      const heal = engineeringRepairHp(getEngineeringLevel(from))
      if (repairBreach(breachId, heal)) {
        addRepair(from)
        awardSkillXp(from, 'engineering', SKILL_XP_PER_REPAIR)
        console.log(`[SERVER] Breach ${breachId} repaired by ${from}`)
      }
    },
    onOvercharge: (from) => {
      if (currentState === 'shipDying') return
      if (!activateOvercharge()) return
      notifyWeaponsOvercharged(from)
      console.log(`[SERVER] Weapons overcharged by ${from}`)
    }
  })

  engine.addSystem(EncounterTickSystem)
}
