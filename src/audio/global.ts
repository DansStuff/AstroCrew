import { AudioSource, engine, Entity, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { SCENE_SHIP_POSITION } from '../constants'

const entities = new Map<string, Entity>()

function entityFor(path: string): Entity {
  const existing = entities.get(path)
  if (existing !== undefined) return existing

  const entity = engine.addEntity()
  Transform.create(entity, { position: Vector3.clone(SCENE_SHIP_POSITION) })
  AudioSource.create(entity, {
    audioClipUrl: path,
    playing: false,
    loop: false,
    volume: 1,
    global: true
  })
  entities.set(path, entity)
  return entity
}

export function registerGlobalSounds(paths: string[]): void {
  for (const path of paths) {
    entityFor(path)
  }
}

export function playGlobalSound(path: string): void {
  const entity = entityFor(path)
  AudioSource.createOrReplace(entity, {
    audioClipUrl: path,
    playing: true,
    loop: false,
    volume: 1,
    global: true,
    currentTime: 0
  })
}

const loopingState = new Map<string, boolean>()

/** Start/stop a looping global sound. Only touches the component when the state changes. */
export function setGlobalLoop(path: string, playing: boolean): void {
  if ((loopingState.get(path) ?? false) === playing) return
  loopingState.set(path, playing)
  const entity = entityFor(path)
  AudioSource.createOrReplace(entity, {
    audioClipUrl: path,
    playing,
    loop: true,
    volume: 1,
    global: true,
    currentTime: 0
  })
}
