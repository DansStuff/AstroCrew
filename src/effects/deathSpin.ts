/**
 * Client-only death spin: after the hull is destroyed, tumble the ship's
 * virtual rotation around a server-chosen axis at an accelerating rate until
 * the mission resets.
 *
 * ShipPathSystem rebuilds `shipVirtualRotation` every frame, so this composes
 * the accumulated angle onto the path pose instead of rotating incrementally.
 * Cameras and the ship shake in random bursts for as long as the spin runs.
 * Register after ShipPathSystem.
 */
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import {
  CAMERA_SHAKE_DEATH_MAX_INTENSITY,
  CAMERA_SHAKE_DEATH_MAX_INTERVAL,
  CAMERA_SHAKE_DEATH_MIN_INTENSITY,
  CAMERA_SHAKE_DEATH_MIN_INTERVAL,
  HAZARD_HIT_SHIP_SOUND_PATH,
  SHIP_DEATH_SPIN_MAX_DEGREES_PER_SECOND,
  SHIP_DEATH_SPIN_RAMP_SECONDS
} from '../constants'
import { playGlobalSound } from '../audio/global'
import { shipVirtualRotation } from '../ship'
import { clampSimulationStep } from '../utilities'
import { shakeCameras, shakeShip } from './cameraShake'

let spinning = false
let elapsed = 0
let angle = 0
let nextShakeIn = 0
const axis: Vector3.Mutable = Vector3.Up()

function speedAt(t: number): number {
  return SHIP_DEATH_SPIN_MAX_DEGREES_PER_SECOND * (1 - Math.exp(-t / SHIP_DEATH_SPIN_RAMP_SECONDS))
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function shakeBurst(): void {
  const intensity = randomBetween(CAMERA_SHAKE_DEATH_MIN_INTENSITY, CAMERA_SHAKE_DEATH_MAX_INTENSITY)
  shakeCameras(intensity)
  shakeShip(intensity)
  nextShakeIn = randomBetween(CAMERA_SHAKE_DEATH_MIN_INTERVAL, CAMERA_SHAKE_DEATH_MAX_INTERVAL)
}

export function startDeathSpin(spinAxis: Vector3): void {
  const length = Vector3.length(spinAxis)
  if (length < 1e-6) return
  axis.x = spinAxis.x / length
  axis.y = spinAxis.y / length
  axis.z = spinAxis.z / length
  spinning = true
  elapsed = 0
  angle = 0
  shakeBurst()
}

export function stopDeathSpin(): void {
  if (!spinning) return
  spinning = false
  elapsed = 0
  angle = 0
  playGlobalSound(HAZARD_HIT_SHIP_SOUND_PATH)
}

export function DeathSpinSystem(dt: number): void {
  if (!spinning) return
  const step = clampSimulationStep(dt)
  elapsed += step
  nextShakeIn -= step
  if (nextShakeIn <= 0) shakeBurst()
  angle = (angle + speedAt(elapsed) * step) % 360
  const spun = Quaternion.multiply(shipVirtualRotation, Quaternion.fromAngleAxis(angle, axis))
  shipVirtualRotation.x = spun.x
  shipVirtualRotation.y = spun.y
  shipVirtualRotation.z = spun.z
  shipVirtualRotation.w = spun.w
}
