import { Entity, Material, Transform, VisibilityComponent } from '@dcl/sdk/ecs'
import { Color4, Vector3 } from '@dcl/sdk/math'
import { SCENE_SHIP_POSITION } from '../constants'
import {
  SAUCER_BEAM_COLOR,
  SAUCER_BEAM_EMISSIVE_INTENSITY,
  SAUCER_BEAM_RETARGET_SECONDS,
  SAUCER_BEAM_TARGET_OFFSET,
  SAUCER_BEAM_TARGET_X_SPREAD,
  SAUCER_BEAM_WIDTH,
  SAUCER_BEAM_WIDTH_PULSE_AMPLITUDE,
  SAUCER_BEAM_WIDTH_PULSE_PERIOD
} from './constants'
import { createBeamStrip, poseBeamStrip } from '../effects/beamStrip'

/** Pooled with its saucer. `target` is the current impact point while hovering. */
export type SaucerBeam = {
  entity: Entity
  target?: Vector3
  retargetElapsed: number
}

let pulseElapsed = 0

function rollBeamTarget(): Vector3 {
  return Vector3.create(
    SCENE_SHIP_POSITION.x + (Math.random() * 2 - 1) * SAUCER_BEAM_TARGET_X_SPREAD,
    SCENE_SHIP_POSITION.y + SAUCER_BEAM_TARGET_OFFSET.y,
    SCENE_SHIP_POSITION.z + SAUCER_BEAM_TARGET_OFFSET.z
  )
}

function pulsedBeamWidth(): number {
  const phase = (pulseElapsed / SAUCER_BEAM_WIDTH_PULSE_PERIOD) * Math.PI * 2
  return SAUCER_BEAM_WIDTH * (1 + SAUCER_BEAM_WIDTH_PULSE_AMPLITUDE * Math.sin(phase))
}

export function createSaucerBeam(): SaucerBeam {
  const entity = createBeamStrip(SCENE_SHIP_POSITION, SAUCER_BEAM_WIDTH)
  Material.setPbrMaterial(entity, {
    albedoColor: Color4.fromColor3(SAUCER_BEAM_COLOR),
    emissiveColor: SAUCER_BEAM_COLOR,
    emissiveIntensity: SAUCER_BEAM_EMISSIVE_INTENSITY,
    castShadows: false
  })
  return { entity, retargetElapsed: 0 }
}

/** All saucer beams share one width pulse. Advance it once per frame. */
export function advanceSaucerBeamPulse(dt: number): void {
  pulseElapsed += dt
}

export function hideSaucerBeam(beam: SaucerBeam): void {
  VisibilityComponent.getMutable(beam.entity).visible = false
  beam.target = undefined
  beam.retargetElapsed = 0
}

/**
 * While the saucer hovers, stretch the beam from it to a random spot under the ship's bow,
 * rerolling the spot every SAUCER_BEAM_RETARGET_SECONDS.
 */
export function updateSaucerBeam(beam: SaucerBeam, saucer: Entity, hovering: boolean, dt: number): void {
  if (!hovering || !Transform.has(saucer)) {
    hideSaucerBeam(beam)
    return
  }
  VisibilityComponent.getMutable(beam.entity).visible = true
  if (beam.target === undefined) {
    beam.target = rollBeamTarget()
    beam.retargetElapsed = 0
  } else {
    beam.retargetElapsed += dt
    while (beam.retargetElapsed >= SAUCER_BEAM_RETARGET_SECONDS) {
      beam.retargetElapsed -= SAUCER_BEAM_RETARGET_SECONDS
      beam.target = rollBeamTarget()
    }
  }
  poseBeamStrip(beam.entity, Transform.get(saucer).position, beam.target, pulsedBeamWidth())
}
