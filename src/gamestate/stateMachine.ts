/**
 * Server mission authority: legal transitions, the active Encounter, and
 * world side effects. `nextState` is pure; `applyTransition` writes GameState,
 * path, and notifies. Clients do not run this machine.
 */
import { engine } from '@dcl/sdk/ecs'
import { isServer } from '@dcl/sdk/network'
import { createWaveEncounter, type Encounter } from '../encounters/encounter'
import { ENCOUNTER_PARAMS, engineeringRepairHp, PATH_START_STOP_ID, SKILL_XP_PER_REPAIR } from '../constants'
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
import { awardSkillXp, flushPlayerStats, getEngineeringLevel, onPlayerConnected } from '../players/stats'
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
  notifyWeaponsOvercharged,
  notifyWeeklyBoard,
  setupServerInbox
} from './serverRoom'

export type MissionState = 'idle' | 'traveling' | 'inEncounter' | 'missionComplete'

export type MissionEvent =
  | { type: 'MISSION_START' }
  | { type: 'STOP_REACHED'; stopId: string; pathFinished: boolean }
  | { type: 'ENCOUNTER_CLEARED'; pathFinished: boolean }
  | { type: 'SHIP_DESTROYED' }
  | { type: 'MISSION_RESET' }

let currentState: MissionState = 'idle'
let activeEncounter: Encounter | null = null

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
      if (event.type === 'SHIP_DESTROYED') return 'idle'
      return null
    case 'missionComplete':
      if (event.type === 'MISSION_RESET') return 'idle'
      return null
  }
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

function EncounterTickSystem(dt: number): void {
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
    onNewMission: (from) => {
      if (processEvent({ type: 'MISSION_RESET' })) {
        console.log(`[SERVER] Mission reset by ${from}`)
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
    },
    onHazardTarget: (from, hazardId) => {
      if (currentState !== 'inEncounter') return
      setPlayerTarget(from, hazardId)
    },
    onRepairBreach: (from, breachId) => {
      const heal = engineeringRepairHp(getEngineeringLevel(from))
      if (repairBreach(breachId, heal)) {
        addRepair(from)
        awardSkillXp(from, 'engineering', SKILL_XP_PER_REPAIR)
        console.log(`[SERVER] Breach ${breachId} repaired by ${from}`)
      }
    },
    onOvercharge: (from) => {
      if (!activateOvercharge()) return
      notifyWeaponsOvercharged(from)
      console.log(`[SERVER] Weapons overcharged by ${from}`)
    }
  })

  engine.addSystem(EncounterTickSystem)
}
