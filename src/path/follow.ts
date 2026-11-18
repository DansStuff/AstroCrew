/**
 * Ship path-follow: each frame this module writes the ship's *virtual* pose
 * (`shipVirtualPosition` / `shipVirtualRotation`). The visible ship Transform
 * stays fixed; other systems offset the world around that virtual pose.
 *
 * On the server, arriving at an authored stop calls `onStopReached` so the
 * mission state machine can start a fight or resume. Clients still release
 * holds from `notifyEncounterEnd`.
 *
 * Authored data is `SHIP_ROUTE.legs` (open path, no loop). Each leg is a
 * waypoint polyline whose `stopId` is the encounter at the *end* of the leg.
 * There is no authored start encounter — the first point of the first leg is
 * the origin, identified at runtime as `PATH_START_STOP_ID`.
 *
 * Startup
 *   `prepareLegs` bakes each Catmull-Rom segment into an arc-length sample
 *   list. Follow never re-evaluates the spline: `writePositionAt` lerps those
 *   samples. State begins `holding` at start; the first sample of leg 0 is
 *   applied once so the ship is posed before the first tick.
 *
 * Per-frame driver: `ShipPathSystem`
 *   Two modes, gated by `state.holding`.
 *
 *   Holding (paused)
 *     Level the bank (`applyLookAndBank(0)`). Do not advance along the path.
 *     Every stop waits forever until `resumeFromStop()` sets `skipHold`.
 *     Start is released by mission start; authored stops are released by
 *     `notifyEncounterEnd` from the server. The last stop also sets `finished`,
 *     so the hold never releases. If the server already completed a stop
 *     (`markEncounterComplete`), `enterHold` sets `skipHold` so a slow client
 *     does not stall. A late joiner uses `teleportToStop` to snap to the
 *     current encounter instead of transiting every earlier leg. Leaving a
 *     hold clears `currentStopId` and `elapsed`; the next tick transits
 *     `preparedLegs[state.legIndex]`.
 *
 *   Transiting (a leg is running)
 *     `elapsed` maps through `accelDecelProgress` onto arc length, then
 *     `applySampledPose` → `writePositionAt` (position) + lookahead tangent
 *     (`headingCrossY` / `bankFromHeadings`) → `applyLookAndBank` (yaw + roll).
 *     When `elapsed` reaches the leg's duration, `enterHold(leg.stopId)` parks
 *     at the end sample and `finishOrAdvance` either increments `legIndex`
 *     (so the next departure runs the following leg) or sets `finished`.
 *
 * Leg start / pause
 *   Start: holding at origin, `legIndex` already 0. Mission resume drops the
 *   hold and the next tick runs leg 0.
 *   Encounter: arriving calls `enterHold` then `finishOrAdvance`, so the ship
 *   is paused at this stop while `legIndex` already points at the *next* leg.
 *   `resumeFromStop` ends the pause and that next leg starts. It is a no-op
 *   while transiting or after `finished`.
 *
 * Late join
 *   `teleportToStop` copies the holding state that arrival would have left:
 *   posed at the stop's end sample, `legIndex` already on the next leg (or)
 *   `finished` on the last stop). `PATH_START_STOP_ID` resets to origin.
 *   Unknown ids are ignored. If the stop is already in `completedStops` and
 *   is not the last, `skipHold` is set so replay can resume even when
 *   encounter-end messages arrived first.
 */

import { isServer } from '@dcl/sdk/network'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import {
  PATH_CATMULL_ROM_KNOT_EPSILON,
  PATH_MAX_SEGMENT_SAMPLES,
  PATH_MIN_SEGMENT_SAMPLES,
  PATH_SAMPLE_SPACING,
  PATH_START_STOP_ID,
  PATH_TANGENT_EPSILON,
  PATH_TANGENT_LOOKAHEAD,
  PATH_TANGENT_LOOKAHEAD_LENGTH_FRACTION,
  PATH_TANGENT_LOOKAHEAD_MIN,
  SHIP_BANK_GAIN,
  SHIP_CRUISE_SPEED,
  SHIP_MAX_BANK_DEGREES,
  SHIP_MODEL_YAW_DEGREES,
  SHIP_ROLL_SMOOTH
} from './constants'
import { shipVirtualPosition, shipVirtualRotation } from '../ship'
import { clampSimulationStep } from '../utilities'
import { SHIP_ROUTE, type ShipRoute } from './route'

const SHIP_MODEL_YAW = Quaternion.fromAngleAxis(SHIP_MODEL_YAW_DEGREES, Vector3.Up())

const scratchPoint: RoutePoint = { x: 0, z: 0 }
const scratchAhead: RoutePoint = { x: 0, z: 0 }
const scratchNext: RoutePoint = { x: 0, z: 0 }
const scratchForward: Vector3.Mutable = Vector3.create(1, 0, 0)
const scratchBankAxis: Vector3 = Vector3.Forward()

type RoutePoint = { x: number; z: number }

type Sample = {
  s: number
  x: number
  z: number
}

type PreparedLeg = {
  stopId: string
  length: number
  duration: number
  lookAhead: number
  samples: Sample[]
}

type PathState = {
  legIndex: number
  elapsed: number
  holding: boolean
  finished: boolean
  /** Stop id while holding; 'start' before the first leg; null while transiting. */
  currentStopId: string | null
  /** Smoothed bank in degrees. Positive = roll right. */
  roll: number
}

function dist(a: RoutePoint, b: RoutePoint): number {
  const dx = b.x - a.x
  const dz = b.z - a.z
  return Math.sqrt(dx * dx + dz * dz)
}

function lerpPoint(a: RoutePoint, b: RoutePoint, ta: number, tb: number, t: number): RoutePoint {
  if (Math.abs(tb - ta) < 1e-8) return { x: a.x, z: a.z }
  const u = (t - ta) / (tb - ta)
  return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u }
}

/** Centripetal Catmull-Rom (α = 0.5) from p1 to p2, t in [0, 1]. Avoids cusps on uneven points. */
function interpolatePoint(p0: RoutePoint, p1: RoutePoint, p2: RoutePoint, p3: RoutePoint, t: number): RoutePoint {
  const t0 = 0
  const t1 = t0 + Math.pow(Math.max(dist(p0, p1), PATH_CATMULL_ROM_KNOT_EPSILON), 0.5)
  const t2 = t1 + Math.pow(Math.max(dist(p1, p2), PATH_CATMULL_ROM_KNOT_EPSILON), 0.5)
  const t3 = t2 + Math.pow(Math.max(dist(p2, p3), PATH_CATMULL_ROM_KNOT_EPSILON), 0.5)
  const tVal = t1 + (t2 - t1) * t
  const a1 = lerpPoint(p0, p1, t0, t1, tVal)
  const a2 = lerpPoint(p1, p2, t1, t2, tVal)
  const a3 = lerpPoint(p2, p3, t2, t3, tVal)
  const b1 = lerpPoint(a1, a2, t0, t2, tVal)
  const b2 = lerpPoint(a2, a3, t1, t3, tVal)
  return lerpPoint(b1, b2, t1, t2, tVal)
}

/**
 * Normalized distance along a leg for normalized time `t`.
 * 0 = constant speed; 1 = accel first half, decel second half; above 1 = softer
 * holds at the ends and a sharper mid-leg (slider goes to 4).
 */
function accelDecelProgress(t: number, amount: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  const a = Math.min(4, Math.max(0, amount))
  if (a >= 1) {
    const p = 1 + a
    if (t < 0.5) return Math.pow(2 * t, p) / 2
    return 1 - Math.pow(2 * (1 - t), p) / 2
  }
  const ramp = a * 0.5
  if (ramp < 1e-6) return t
  const peak = 1 / (1 - ramp)
  if (t < ramp) {
    return (peak * t * t) / (2 * ramp)
  }
  if (t <= 1 - ramp) {
    return peak * (ramp / 2 + (t - ramp))
  }
  const rest = 1 - t
  return 1 - (peak * rest * rest) / (2 * ramp)
}

/** Catmull-Rom handles for an open path (no wrap from last leg back to first). */
function segmentHandles(legs: ShipRoute['legs'], legIndex: number, segIndex: number): {
  p0: RoutePoint
  p1: RoutePoint
  p2: RoutePoint
  p3: RoutePoint
} {
  const pts = legs[legIndex].points
  const p1 = pts[segIndex]
  const p2 = pts[segIndex + 1]
  const p0 =
    segIndex === 0
      ? legIndex > 0
        ? legs[legIndex - 1].points[legs[legIndex - 1].points.length - 2]
        : p1
      : pts[segIndex - 1]
  const p3 =
    segIndex === pts.length - 2
      ? legIndex < legs.length - 1
        ? legs[legIndex + 1].points[1]
        : p2
      : pts[segIndex + 2]
  return { p0, p1, p2, p3 }
}

function prepareLegs(route: ShipRoute): PreparedLeg[] {
  const prepared: PreparedLeg[] = []
  for (let legIndex = 0; legIndex < route.legs.length; legIndex++) {
    const leg = route.legs[legIndex]
    const samples: Sample[] = []
    let length = 0
    if (leg.points.length >= 2) {
      let prev = leg.points[0]
      samples.push({ s: 0, x: prev.x, z: prev.z })
      const segments = leg.points.length - 1
      for (let seg = 0; seg < segments; seg++) {
        const { p0, p1, p2, p3 } = segmentHandles(route.legs, legIndex, seg)
        const count = Math.min(
          PATH_MAX_SEGMENT_SAMPLES,
          Math.max(PATH_MIN_SEGMENT_SAMPLES, Math.ceil(dist(p1, p2) / PATH_SAMPLE_SPACING))
        )
        for (let i = 1; i <= count; i++) {
          const point = interpolatePoint(p0, p1, p2, p3, i / count)
          const step = dist(prev, point)
          if (step < 1e-6) continue
          length += step
          samples.push({ s: length, x: point.x, z: point.z })
          prev = point
        }
      }
    }
    prepared.push({
      stopId: leg.stopId,
      length,
      duration: length > 1 ? length / SHIP_CRUISE_SPEED : 0,
      lookAhead: Math.min(
        PATH_TANGENT_LOOKAHEAD,
        Math.max(PATH_TANGENT_LOOKAHEAD_MIN, length * PATH_TANGENT_LOOKAHEAD_LENGTH_FRACTION)
      ),
      samples
    })
  }
  return prepared
}

/** Writes the point at arc-length `s` into `out`. No allocations. */
function writePositionAt(leg: PreparedLeg, s: number, out: RoutePoint): void {
  const samples = leg.samples
  if (samples.length === 0) {
    out.x = 0
    out.z = 0
    return
  }
  if (samples.length === 1 || leg.length <= 0) {
    out.x = samples[0].x
    out.z = samples[0].z
    return
  }
  const clamped = s < 0 ? 0 : s > leg.length ? leg.length : s
  let lo = 0
  let hi = samples.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (samples[mid].s <= clamped) lo = mid
    else hi = mid
  }
  const a = samples[lo]
  const b = samples[hi]
  const span = b.s - a.s
  const u = span > 1e-8 ? (clamped - a.s) / span : 0
  out.x = a.x + (b.x - a.x) * u
  out.z = a.z + (b.z - a.z) * u
}

function applyLookAndBank(targetRoll: number, dt: number): void {
  if (dt <= 0) {
    state.roll = targetRoll
  } else {
    state.roll += (targetRoll - state.roll) * Math.min(1, dt * SHIP_ROLL_SMOOTH)
  }
  const facing = Quaternion.lookRotation(scratchForward)
  const banked = Quaternion.multiply(facing, Quaternion.fromAngleAxis(state.roll, scratchBankAxis))
  const oriented = Quaternion.multiply(banked, SHIP_MODEL_YAW)
  shipVirtualRotation.x = oriented.x
  shipVirtualRotation.y = oriented.y
  shipVirtualRotation.z = oriented.z
  shipVirtualRotation.w = oriented.w
}

/** Y of unit(current) × unit(next). Negative = left turn, positive = right. */
function headingCrossY(ax: number, az: number, bx: number, bz: number): number {
  const aLen = Math.sqrt(ax * ax + az * az)
  const bLen = Math.sqrt(bx * bx + bz * bz)
  if (aLen < 1e-8 || bLen < 1e-8) return 0
  return (az * bx - ax * bz) / (aLen * bLen)
}

function bankFromHeadings(ax: number, az: number, bx: number, bz: number): number {
  const crossY = headingCrossY(ax, az, bx, bz)
  const roll = crossY * SHIP_BANK_GAIN
  if (roll > SHIP_MAX_BANK_DEGREES) return SHIP_MAX_BANK_DEGREES
  if (roll < -SHIP_MAX_BANK_DEGREES) return -SHIP_MAX_BANK_DEGREES
  return roll
}

function applySampledPose(leg: PreparedLeg, s: number, updateHeading: boolean, dt: number): void {
  writePositionAt(leg, s, scratchPoint)
  shipVirtualPosition.x = scratchPoint.x
  shipVirtualPosition.y = SHIP_ROUTE.y
  shipVirtualPosition.z = scratchPoint.z

  let targetRoll = 0
  if (updateHeading) {
    const look = leg.lookAhead
    writePositionAt(leg, s + look, scratchAhead)
    let tx = scratchAhead.x - scratchPoint.x
    let tz = scratchAhead.z - scratchPoint.z
    let haveNext = true
    if (tx * tx + tz * tz < PATH_TANGENT_EPSILON) {
      writePositionAt(leg, s - look, scratchAhead)
      tx = scratchPoint.x - scratchAhead.x
      tz = scratchPoint.z - scratchAhead.z
      haveNext = false
    }
    const lenSq = tx * tx + tz * tz
    if (lenSq < PATH_TANGENT_EPSILON) {
      applyLookAndBank(0, dt)
      return
    }
    const inv = 1 / Math.sqrt(lenSq)
    scratchForward.x = tx * inv
    scratchForward.y = 0
    scratchForward.z = tz * inv

    if (haveNext) {
      writePositionAt(leg, s + look * 2, scratchNext)
      targetRoll = bankFromHeadings(tx, tz, scratchNext.x - scratchAhead.x, scratchNext.z - scratchAhead.z)
    }
  }

  applyLookAndBank(targetRoll, dt)
}

const preparedLegs = prepareLegs(SHIP_ROUTE)

const state: PathState = {
  legIndex: 0,
  elapsed: 0,
  holding: true,
  finished: false,
  currentStopId: preparedLegs.length > 0 ? PATH_START_STOP_ID : null,
  roll: 0
}

let skipHold = false
const completedStops = new Set<string>()
let onStopReached: ((stopId: string, pathFinished: boolean) => void) | null = null

export function setOnStopReached(handler: ((stopId: string, pathFinished: boolean) => void) | null): void {
  onStopReached = handler
}

function holdLogPrefix(): string {
  return isServer() ? '[SERVER]' : '[CLIENT]'
}

{
  const startLeg = preparedLegs[0]
  if (startLeg && startLeg.samples.length > 0) {
    applySampledPose(startLeg, 0, true, 0)
  }
  if (state.holding) {
    console.log(`${holdLogPrefix()} Ship holding at stop ${state.currentStopId}`)
  }
}

/** Skip the rest of the current stop hold and start the next leg. Ignored while transiting. */
export function resumeFromStop(): void {
  if (state.holding && !state.finished) {
    skipHold = true
  }
}

export function isShipStopped(): boolean {
  return state.holding
}

export function currentStopId(): string | null {
  return state.currentStopId
}

/** Remember that the server already finished this stop so a late hold is skipped. */
export function markEncounterComplete(stopId: string): void {
  completedStops.add(stopId)
}

export function isPathFinished(): boolean {
  return state.finished
}

export function lastStopId(): string | null {
  if (preparedLegs.length === 0) return null
  return preparedLegs[preparedLegs.length - 1].stopId
}

/** Hold at the origin again. Clears completed stops so the next mission can run. */
export function resetPathToStart(): void {
  skipHold = false
  completedStops.clear()
  state.legIndex = 0
  state.elapsed = 0
  state.holding = true
  state.finished = false
  state.currentStopId = preparedLegs.length > 0 ? PATH_START_STOP_ID : null
  state.roll = 0
  const startLeg = preparedLegs[0]
  if (startLeg && startLeg.samples.length > 0) {
    applySampledPose(startLeg, 0, true, 0)
  }
  console.log(`${holdLogPrefix()} Ship reset to start`)
}

/**
 * Snap holding state and pose to an authored stop. Used so a late joiner does
 * not fly every earlier leg. `PATH_START_STOP_ID` resets to origin.
 */
export function teleportToStop(stopId: string): void {
  if (stopId === PATH_START_STOP_ID) {
    resetPathToStart()
    return
  }

  let legIndex = -1
  for (let i = 0; i < preparedLegs.length; i++) {
    if (preparedLegs[i].stopId === stopId) {
      legIndex = i
      break
    }
  }
  if (legIndex < 0) return

  const leg = preparedLegs[legIndex]
  const finished = legIndex >= preparedLegs.length - 1
  skipHold = false
  state.elapsed = 0
  state.holding = true
  state.finished = finished
  state.currentStopId = stopId
  state.legIndex = finished ? legIndex : legIndex + 1
  state.roll = 0
  applySampledPose(leg, leg.length, true, 0)
  if (completedStops.has(stopId) && !finished) {
    skipHold = true
  }
  console.log(`${holdLogPrefix()} Ship teleported to stop ${stopId}`)
}

/**
 * Advances the ship's virtual pose along authored legs: ease in/out, then hold at each stop.
 * The visible ship Transform stays fixed; only shipVirtualPosition / Rotation change.
 */
export function ShipPathSystem(dt: number): void {
  if (preparedLegs.length === 0) return

  const step = clampSimulationStep(dt)

  if (state.holding) {
    applyLookAndBank(0, step)
    if (state.finished) return
    if (!skipHold) return
    skipHold = false
    state.holding = false
    state.currentStopId = null
    state.elapsed = 0
    return
  }

  const leg = preparedLegs[state.legIndex]
  if (!leg || leg.duration <= 0) {
    enterHold(leg ? leg.stopId : null, leg)
    finishOrAdvance()
    emitStopReached()
    return
  }

  state.elapsed += step
  const u = accelDecelProgress(state.elapsed / leg.duration, SHIP_ROUTE.accelDecel)
  applySampledPose(leg, u * leg.length, true, step)

  if (state.elapsed >= leg.duration) {
    enterHold(leg.stopId, leg)
    finishOrAdvance()
    emitStopReached()
  }
}

function finishOrAdvance(): void {
  if (state.legIndex >= preparedLegs.length - 1) {
    state.finished = true
  } else {
    state.legIndex += 1
  }
}

function emitStopReached(): void {
  if (!isServer()) return
  const stopId = state.currentStopId
  if (!stopId || stopId === PATH_START_STOP_ID) return
  onStopReached?.(stopId, state.finished)
}

function enterHold(stopId: string | null, leg: PreparedLeg | undefined): void {
  state.holding = true
  state.currentStopId = stopId
  state.elapsed = 0
  if (stopId && completedStops.has(stopId)) {
    skipHold = true
  }
  console.log(`${holdLogPrefix()} Ship holding at stop ${stopId}`)
  if (!leg) return
  writePositionAt(leg, leg.length, scratchPoint)
  shipVirtualPosition.x = scratchPoint.x
  shipVirtualPosition.y = SHIP_ROUTE.y
  shipVirtualPosition.z = scratchPoint.z
}
