import { AudioSource, engine, Entity, Transform } from '@dcl/sdk/ecs'

/**
 * An entity can only hold one AudioSource, so each named sound lives on its own
 * child entity of the target. Add as many sounds per entity as needed.
 */
const sounds = new Map<Entity, Map<string, Entity>>()

export function addEntitySound(
  target: Entity,
  key: string,
  audioClipUrl: string,
  options: { volume?: number; global?: boolean } = {}
): void {
  let byKey = sounds.get(target)
  if (!byKey) {
    byKey = new Map()
    sounds.set(target, byKey)
  }
  const existing = byKey.get(key)
  if (existing !== undefined) engine.removeEntity(existing)

  const child = engine.addEntity()
  Transform.create(child, { parent: target })
  AudioSource.create(child, {
    audioClipUrl,
    playing: false,
    loop: false,
    volume: options.volume ?? 1,
    global: options.global ?? false
  })
  byKey.set(key, child)
}

export function playEntitySound(target: Entity, key: string): void {
  const child = sounds.get(target)?.get(key)
  if (child === undefined) return
  const source = AudioSource.get(child)
  AudioSource.createOrReplace(child, { ...source, playing: true, currentTime: 0 })
}

/** Call when the scene is rebuilt so stale child entities don't accumulate. */
export function clearEntitySounds(): void {
  for (const byKey of sounds.values()) {
    for (const child of byKey.values()) engine.removeEntity(child)
  }
  sounds.clear()
}
