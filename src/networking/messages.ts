import { Schemas } from '@dcl/sdk/ecs'
import { registerMessages } from '@dcl/sdk/network'

export const Messages = {

  
  // Client → Server
  // Empty Map payloads can be dropped by the transport (seen on server→client).
  // Keep a timestamp so these always have a body.
  requestMissionStart: Schemas.Map({
    requestedAt: Schemas.Int64
  }),
  requestInitialState: Schemas.Map({
    requestedAt: Schemas.Int64
  }),
  requestHazardTarget: Schemas.Map({
    hazardId: Schemas.Int
  }),
  requestRepairBreach: Schemas.Map({
    breachId: Schemas.Int
  }),
  requestOvercharge: Schemas.Map({
    requestedAt: Schemas.Int64
  }),

  // Server → Client
  notifyMissionStart: Schemas.Map({
    encounterId: Schemas.String,
    startedAt: Schemas.Int64
  }),
  notifyHazardSpawn: Schemas.Map({
    hazardId: Schemas.Int,
    encounterId: Schemas.String,
    position: Schemas.Vector3,
    flightTime: Schemas.Float,
    kind: Schemas.String
  }),
  notifyHazardTargeted: Schemas.Map({
    hazardId: Schemas.Int,
    targeters: Schemas.Array(Schemas.String)
  }),
  notifyHazardDestroyed: Schemas.Map({
    hazardId: Schemas.Int,
    /** true = hit the ship; false = shot down */
    hitShip: Schemas.Boolean
  }),
  notifyEncounterEnd: Schemas.Map({
    encounterId: Schemas.String
  }),
  notifyEncounterStage: Schemas.Map({
    turret: Schemas.String,
    startedAt: Schemas.Int64
  }),
  notifyNewMission: Schemas.Map({
    resetAt: Schemas.Int64
  }),
  notifyShipDestroyed: Schemas.Map({
    destroyedAt: Schemas.Int64
  }),
  notifySaucerFired: Schemas.Map({
    hazardId: Schemas.Int,
    position: Schemas.Vector3
  }),
  notifyRoundResults: Schemas.Map({
    won: Schemas.Boolean,
    endedAt: Schemas.Int64,
    furthestEncounter: Schemas.String,
    contributions: Schemas.Array(
      Schemas.Map({
        playerId: Schemas.String,
        name: Schemas.String,
        damage: Schemas.Int,
        repairs: Schemas.Int
      })
    )
  }),
  notifyWeaponsOvercharged: Schemas.Map({
    playerId: Schemas.String,
    overchargedAt: Schemas.Int64
  }),
  notifyWeeklyBoard: Schemas.Map({
    weekId: Schemas.String,
    updatedAt: Schemas.Int64,
    missions: Schemas.Array(
      Schemas.Map({
        won: Schemas.Boolean,
        furthestEncounter: Schemas.String,
        contributions: Schemas.Array(
          Schemas.Map({
            playerId: Schemas.String,
            name: Schemas.String,
            damage: Schemas.Int,
            repairs: Schemas.Int
          })
        )
      })
    )
  })
}

export const room = registerMessages(Messages)
