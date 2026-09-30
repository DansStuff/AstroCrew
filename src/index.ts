/**
 * Scene composition root. Calls each domain `setup*` and, on the client,
 * registers mission HUD/notify handlers. Server request handling lives in
 * the state machine.
 */
import { AssetLoad, engine } from '@dcl/sdk/ecs'
import { isServer } from '@dcl/sdk/network'
import { registerGlobalSounds } from './audio/global'
import { ENCOUNTER_STAGE_SOUND_PATH, HAZARD_HIT_SHIP_SOUND_PATH, HAZARD_SELECT_SOUND_PATH, LOW_HP_SOUND_PATH, OVERCHARGE_END_SOUND_PATH, OVERCHARGE_START_SOUND_PATH, PATH_START_STOP_ID, SHIP_LASER_SOUND_PATH } from './constants'
import { CameraShakeSystem } from './effects/cameraShake'
import { DeathSpinSystem, startDeathSpin, stopDeathSpin } from './effects/deathSpin'
import { setupEncounters } from './encounters/client'
import { setupScoreboard } from './leaderboard/scoreboard'
import { setupWeeklyBoard } from './leaderboard/weeklyBoard'
import { setupGameState } from './gamestate'
import { setupStateMachine } from './gamestate/stateMachine'
import { setupHazards } from './hazards/simulation'
import { clearLocalTarget } from './hazards/targeting'
import { despawnAllHazards } from './hazards/visuals'
import { room } from './networking/messages'
import { currentStopId, resetPathToStart, resumeFromStop, ShipPathSystem } from './path/follow'
import { setupPlayers } from './players/stats'
import { exitWeaponCamera, setActiveConsoleArrow, setupSceneObjects } from './sceneObjects'
import { setupSpaceObjects } from './spaceobjects/planets'
import { setupShipWeapons } from './shipweapons/lasers'
import { setupUi } from './ui'
import { setupDebugTeleportToShip } from './utilities'

function setupClientRoom() {
  let appliedStartedAt = 0
  let appliedResetAt = 0
  let appliedDestroyedAt = 0
  let appliedDyingAt = 0

  function applyClientMissionReset() {
    stopDeathSpin()
    resetPathToStart()
    despawnAllHazards()
    exitWeaponCamera()
    setActiveConsoleArrow(null)
  }

  room.onMessage('notifyMissionStart', (data) => {
    if (data.startedAt <= appliedStartedAt) return
    appliedStartedAt = data.startedAt
    console.log(`[CLIENT] Mission started: ${data.encounterId}`)
    if (currentStopId() === PATH_START_STOP_ID) {
      resumeFromStop()
    }
  })

  room.onMessage('notifyNewMission', (data) => {
    if (data.resetAt <= appliedResetAt) return
    appliedResetAt = data.resetAt
    console.log(`[CLIENT] Mission reset (${data.resetAt})`)
    applyClientMissionReset()
  })

  room.onMessage('notifyShipDying', (data) => {
    if (data.startedAt <= appliedDyingAt) return
    appliedDyingAt = data.startedAt
    console.log(`[CLIENT] Ship dying`)
    clearLocalTarget()
    startDeathSpin(data.axis)
  })

  room.onMessage('notifyShipDestroyed', (data) => {
    if (data.destroyedAt <= appliedDestroyedAt) return
    appliedDestroyedAt = data.destroyedAt
    console.log(`[CLIENT] Ship destroyed`)
    applyClientMissionReset()
  })

  let requestedInitialState = false
  const requestInitialState = () => {
    if (requestedInitialState) return
    requestedInitialState = true
    room.send('requestInitialState', { requestedAt: Date.now() })
  }

  const unsubscribe = room.onReady((ready) => {
    if (!ready) return
    requestInitialState()
    unsubscribe()
  })

  if (room.isReady()) {
    requestInitialState()
    unsubscribe()
  }
}

export function main() {
  setupGameState()
  setupStateMachine()
  setupSceneObjects()
  setupEncounters()
  setupHazards()
  setupPlayers()
  setupWeeklyBoard()
  setupSpaceObjects()
  setupShipWeapons()
  engine.addSystem(ShipPathSystem)

  if (isServer()) {
    console.log(`[SERVER] Init server`)
    return
  }

  setupClientRoom()
  engine.addSystem(DeathSpinSystem)
  engine.addSystem(CameraShakeSystem)
  setupUi()
  setupScoreboard()
  setupDebugTeleportToShip()
  registerGlobalSounds([HAZARD_SELECT_SOUND_PATH, HAZARD_HIT_SHIP_SOUND_PATH, ENCOUNTER_STAGE_SOUND_PATH, OVERCHARGE_START_SOUND_PATH, OVERCHARGE_END_SOUND_PATH, LOW_HP_SOUND_PATH])
  AssetLoad.create(engine.RootEntity, {
    assets: [SHIP_LASER_SOUND_PATH, HAZARD_SELECT_SOUND_PATH, HAZARD_HIT_SHIP_SOUND_PATH, ENCOUNTER_STAGE_SOUND_PATH]
  })
}
