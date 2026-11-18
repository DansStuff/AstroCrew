/**
 * Client reactions to encounter notifies: stage banner/sound, despawn, and
 * resume the path. Server encounter lifetime lives in encounter.ts.
 */
import { isServer } from '@dcl/sdk/network'
import { playGlobalSound } from '../audio/global'
import { ENCOUNTER_STAGE_SOUND_PATH } from './constants'
import { despawnEncounter } from '../hazards/visuals'
import { room } from '../networking/messages'
import { currentStopId, markEncounterComplete, resumeFromStop } from '../path/follow'
import { setActiveConsoleArrow } from '../sceneObjects'
import { markEncounterStage } from '../ui'

export function setupEncounters() {
  if (isServer()) return

  let appliedStageAt = 0

  room.onMessage('notifyEncounterStage', (data) => {
    if (data.startedAt <= appliedStageAt) return
    appliedStageAt = data.startedAt
    console.log(`[CLIENT] Encounter stage: ${data.turret}`)
    markEncounterStage(data.turret)
    setActiveConsoleArrow(data.turret)
    playGlobalSound(ENCOUNTER_STAGE_SOUND_PATH)
  })

  room.onMessage('notifyEncounterEnd', (data) => {
    console.log(`[CLIENT] Encounter ended: ${data.encounterId}`)
    setActiveConsoleArrow(null)
    markEncounterComplete(data.encounterId)
    despawnEncounter(data.encounterId)
    if (currentStopId() === data.encounterId) {
      resumeFromStop()
    }
  })
}
