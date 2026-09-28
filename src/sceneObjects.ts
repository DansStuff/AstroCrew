import {
  AvatarModifierArea,
  AvatarModifierType,
  ColliderLayer,
  engine,
  Entity,
  getWorldPosition,
  getWorldRotation,
  GltfContainer,
  GltfNodeModifiers,
  InputAction,
  InputModifier,
  inputSystem,
  InteractionType,
  MainCamera,
  Name,
  PointerEvents,
  PointerEventType,
  PointerLock,
  TouchScreenControls,
  Transform,
  VirtualCamera,
  VisibilityComponent
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { isServer, isStateSyncronized } from '@dcl/sdk/network'
import { getPlatform, isMobile } from '@dcl/sdk/platform'
import { EntityNames } from '../assets/scene/entity-names'
import {
  WEAPON_CAMERA_FOV_DEGREES,
  WEAPON_CAMERA_LOCAL_OFFSET,
  WEAPON_CAMERA_TRANSITION_SECONDS,
  WEAPON_LIGHT_COLOR,
  WEAPON_LIGHT_OVERCHARGE_COLOR,
  WEAPON_MUZZLE_LOCAL_OFFSET,
  type TurretId
} from './constants'
import { getGameState, isBreachActive } from './gamestate'
import { room } from './networking/messages'
import { Spinner, SpinSystem } from './spinner'

const CURSOR_MAX_DISTANCE = 4
const PROXIMITY_RADIUS = 4

const consoleCameras = new Map<Entity, Entity>()
const consoleTurrets = new Map<Entity, TurretId>()
const breachEntities = new Map<number, Entity>()
const consoleTutArrows = new Map<TurretId, Entity>()
let turretOccupied = false
let occupiedTurret: TurretId | null = null
let activeConsoleArrowTurret: string | null = null
let overchargeStation: Entity | null = null
let missionTable: Entity | null = null
let missionTableText: Entity | null = null
let missionStartArrow: Entity | null = null
let missionLights: Entity | null = null
let missionLightsShowingEncounter: boolean | null = null
let weaponLights: Entity | null = null
let weaponLightsShowingOvercharge: boolean | null = null
let breachPointerEventsReady = false

const LIGHT_EMISSIVE_INTENSITY = 3

export type TurretView = {
  position: Vector3
  rotation: Quaternion
  look: Vector3
  /** Scene-space origin for lasers fired from this weapon. */
  muzzle: Vector3
  /** Console the gunner stands at. Projection rays start here, below the camera. */
  aimOrigin?: Vector3
}

const turretViews = new Map<TurretId, TurretView>()

export function getTurretView(id: TurretId): TurretView | undefined {
  return turretViews.get(id)
}

function turretIdFromWeaponName(name: string): TurretId | undefined {
  if (name === 'LeftWeapon') return 'left'
  if (name === 'CenterWeapon') return 'center'
  if (name === 'RightWeapon') return 'right'
  return undefined
}

function turretIdFromConsoleArrowName(name: string): TurretId | undefined {
  if (name === EntityNames.LeftConsoleArrow) return 'left'
  if (name === EntityNames.CenterConsoleArrow) return 'center'
  if (name === EntityNames.RightConsoleArrow) return 'right'
  return undefined
}

function isBreachName(name: string): boolean {
  return name.startsWith('Breach')
}

function breachIdFromName(name: string): number | undefined {
  const match = /^Breach(\d+)$/.exec(name)
  if (!match) return undefined
  const id = Number(match[1])
  if (id < 1 || id > 6) return undefined
  return id
}

export function getKnownBreachIds(): number[] {
  return [...breachEntities.keys()]
}

function isConsoleName(name: string): boolean {
  return name.endsWith('WeaponConsole')
}

function isWeaponName(name: string): boolean {
  return name.endsWith('Weapon')
}

function attachInteractEvent(entity: Entity, hoverText: string): void {
  const useProximity = isMobile()
  PointerEvents.createOrReplace(entity, {
    pointerEvents: [
      {
        eventType: PointerEventType.PET_DOWN,
        eventInfo: {
          button: InputAction.IA_POINTER,
          hoverText,
          showFeedback: true,
          showHighlight: true,
          maxDistance: useProximity ? PROXIMITY_RADIUS : CURSOR_MAX_DISTANCE,
          ...(useProximity ? { maxPlayerDistance: PROXIMITY_RADIUS } : {})
        },
        interactionType: useProximity ? InteractionType.PROXIMITY : InteractionType.CURSOR
      }
    ]
  })
}

function setBreachPointerCollider(entity: Entity, enabled: boolean): void {
  const gltf = GltfContainer.getMutableOrNull(entity)
  if (!gltf) return
  gltf.invisibleMeshesCollisionMask = enabled ? ColliderLayer.CL_POINTER : ColliderLayer.CL_NONE
}

function setBreachInteractable(entity: Entity, interactable: boolean): void {
  setBreachPointerCollider(entity, interactable)
  if (interactable) {
    attachInteractEvent(entity, 'Repair Breach!')
  } else {
    PointerEvents.deleteFrom(entity)
  }
}

function initBreach(entity: Entity): void {
  VisibilityComponent.createOrReplace(entity, { visible: false, propagateToChildren: true })
  setBreachPointerCollider(entity, false)
}

/** Weapon GLTFs face -Z; VirtualCamera looks along +Z. */
const WEAPON_CAMERA_YAW = Quaternion.fromEulerDegrees(0, 180, 0)

function cacheTurretView(id: TurretId, weapon: Entity): TurretView {
  const weaponPosition = getWorldPosition(engine, weapon)
  const rotation = Quaternion.multiply(getWorldRotation(engine, weapon), WEAPON_CAMERA_YAW)
  const position = Vector3.add(weaponPosition, Vector3.rotate(WEAPON_CAMERA_LOCAL_OFFSET, rotation))
  const look = Vector3.normalize(Vector3.rotate(Vector3.Forward(), rotation))
  const muzzle = Vector3.add(weaponPosition, Vector3.rotate(WEAPON_MUZZLE_LOCAL_OFFSET, rotation))
  const view: TurretView = { position, rotation, look, muzzle }
  turretViews.set(id, view)
  return view
}

function initWeaponFromView(view: TurretView): Entity {
  const camera = engine.addEntity()
  Transform.create(camera, {
    position: view.position,
    rotation: view.rotation
  })
  VirtualCamera.create(camera, {
    fov: WEAPON_CAMERA_FOV_DEGREES,
    defaultTransition: {
      transitionMode: VirtualCamera.Transition.Time(WEAPON_CAMERA_TRANSITION_SECONDS)
    }
  })
  return camera
}

function hoverTextForConsole(name: string): string {
  const side = name.replace(/WeaponConsole$/, '')
  const label = side === 'Center' ? 'Middle' : side
  return `Control ${label} Laser`
}

/** 8×9 parcels (16m each), tall enough to cover the ship at y=64. Centered on the parcel bounds. */
const SCENE_PASSPORT_AREA_SIZE = Vector3.create(128, 200, 144)
const SCENE_PASSPORT_AREA_CENTER = Vector3.create(64, 64, 72)

/** Hide the explorer "Options" / passport prompt on every avatar in the scene. */
function disablePlayerPassportPrompt(): void {
  const entity = engine.addEntity()
  Transform.create(entity, { position: SCENE_PASSPORT_AREA_CENTER })
  AvatarModifierArea.create(entity, {
    area: SCENE_PASSPORT_AREA_SIZE,
    modifiers: [AvatarModifierType.AMT_DISABLE_PASSPORTS],
    excludeIds: []
  })
}

function OverchargeStationSystem(): void {
  if (!overchargeStation || !isStateSyncronized()) return
  if (inputSystem.getInputCommand(InputAction.IA_POINTER, PointerEventType.PET_DOWN, overchargeStation)) {
    room.send('requestOvercharge', { requestedAt: Date.now() })
  }
}

function disableMissionTable(): void {
  if (!missionTable) return
  PointerEvents.deleteFrom(missionTable)
}

function enableMissionTable(): void {
  if (!missionTable || getPlatform() === null) return
  if (PointerEvents.getOrNull(missionTable)) return
  attachInteractEvent(missionTable, 'Start Mission')
}

function applyEmissiveMaterial(entity: Entity, color: Color3): void {
  GltfNodeModifiers.createOrReplace(entity, {
    modifiers: [
      {
        path: '',
        material: {
          material: {
            $case: 'pbr',
            pbr: {
              albedoColor: Color4.fromColor3(color),
              emissiveColor: color,
              emissiveIntensity: LIGHT_EMISSIVE_INTENSITY
            }
          }
        }
      }
    ]
  })
}

function applyMissionLights(inEncounter: boolean): void {
  if (!missionLights || missionLightsShowingEncounter === inEncounter) return
  missionLightsShowingEncounter = inEncounter
  applyEmissiveMaterial(missionLights, inEncounter ? Color3.Red() : Color3.Green())
}

function MissionLightsSystem(): void {
  applyMissionLights(getGameState().inEncounter)
}

function applyWeaponLights(overcharged: boolean): void {
  if (!weaponLights || weaponLightsShowingOvercharge === overcharged) return
  weaponLightsShowingOvercharge = overcharged
  applyEmissiveMaterial(weaponLights, overcharged ? WEAPON_LIGHT_OVERCHARGE_COLOR : WEAPON_LIGHT_COLOR)
}

function WeaponLightsSystem(): void {
  applyWeaponLights(getGameState().weaponsOvercharged)
}

function setEntityVisible(entity: Entity | null, visible: boolean): void {
  if (!entity) return
  const current = VisibilityComponent.getOrNull(entity)
  if (current && current.visible === visible) return
  VisibilityComponent.createOrReplace(entity, { visible, propagateToChildren: true })
}

function MissionTableSystem(): void {
  const started = getGameState().missionStarted
  setEntityVisible(missionTableText, started)
  setEntityVisible(missionStartArrow, !started)

  if (!missionTable) return
  if (started) {
    disableMissionTable()
    return
  }
  enableMissionTable()
  if (!isStateSyncronized() || !PointerEvents.getOrNull(missionTable)) return
  if (inputSystem.getInputCommand(InputAction.IA_POINTER, PointerEventType.PET_DOWN, missionTable)) {
    room.send('requestMissionStart', { requestedAt: Date.now() })
    disableMissionTable()
  }
}

function initConsole(entity: Entity, camera: Entity | undefined, turret: TurretId | undefined): void {
  if (camera === undefined || turret === undefined) return
  consoleCameras.set(entity, camera)
  consoleTurrets.set(entity, turret)
}

function hideMobileControls(): void {
  TouchScreenControls.hideAll()
  TouchScreenControls.hideJoystick()
  TouchScreenControls.hideCrosshair()
}

function showMobileControls(): void {
  TouchScreenControls.showAll()
  TouchScreenControls.showJoystick()
  TouchScreenControls.showCrosshair()
}

function freezePlayer(): void {
  InputModifier.createOrReplace(engine.PlayerEntity, {
    mode: InputModifier.Mode.Standard({ disableAll: true })
  })
}

function unfreezePlayer(): void {
  InputModifier.deleteFrom(engine.PlayerEntity)
}

function applyConsoleArrowVisibility(): void {
  for (const [id, entity] of consoleTutArrows) {
    setEntityVisible(entity, id === activeConsoleArrowTurret && id !== occupiedTurret)
  }
}

function occupyWeaponCamera(camera: Entity, turret: TurretId): void {
  MainCamera.getOrCreateMutable(engine.CameraEntity).virtualCameraEntity = camera
  PointerLock.getMutable(engine.CameraEntity).isPointerLocked = false
  hideMobileControls()
  freezePlayer()
  turretOccupied = true
  occupiedTurret = turret
  applyConsoleArrowVisibility()
}

export function setActiveConsoleArrow(turret: string | null): void {
  activeConsoleArrowTurret = turret
  applyConsoleArrowVisibility()
}

export function exitWeaponCamera(): void {
  MainCamera.getOrCreateMutable(engine.CameraEntity).virtualCameraEntity = undefined
  showMobileControls()
  unfreezePlayer()
  turretOccupied = false
  occupiedTurret = null
  applyConsoleArrowVisibility()
}

export function isTurretOccupied(): boolean {
  return turretOccupied
}

export function getOccupiedTurret(): TurretId | null {
  return occupiedTurret
}

function WeaponConsoleSystem(): void {
  for (const [consoleEntity, camera] of consoleCameras) {
    if (inputSystem.getInputCommand(InputAction.IA_POINTER, PointerEventType.PET_DOWN, consoleEntity)) {
      const turret = consoleTurrets.get(consoleEntity)
      if (!turret) continue
      occupyWeaponCamera(camera, turret)
    }
  }
}

function BreachVisibilitySystem(): void {
  const state = getGameState()
  const platformReady = getPlatform() !== null
  const attachPointerEventsNow = platformReady && !breachPointerEventsReady
  if (attachPointerEventsNow) breachPointerEventsReady = true

  for (const [id, entity] of breachEntities) {
    const visible = isBreachActive(state, id)
    const current = VisibilityComponent.getOrNull(entity)
    const visibilityChanged = !current || current.visible !== visible
    if (visibilityChanged) {
      VisibilityComponent.createOrReplace(entity, { visible, propagateToChildren: true })
    }
    if (platformReady && (visibilityChanged || attachPointerEventsNow)) {
      setBreachInteractable(entity, visible)
    } else if (visibilityChanged) {
      setBreachPointerCollider(entity, visible)
    }
  }
}

function BreachRepairSystem(): void {
  if (!isStateSyncronized()) return
  const state = getGameState()
  for (const [id, entity] of breachEntities) {
    if (!isBreachActive(state, id)) continue
    if (inputSystem.getInputCommand(InputAction.IA_POINTER, PointerEventType.PET_DOWN, entity)) {
      room.send('requestRepairBreach', { breachId: id })
    }
  }
}

export function setupSceneObjects(): void {
  turretViews.clear()
  breachEntities.clear()
  overchargeStation = null
  missionTable = null
  missionTableText = null
  missionStartArrow = null
  missionLights = null
  missionLightsShowingEncounter = null
  weaponLights = null
  weaponLightsShowingOvercharge = null
  consoleCameras.clear()
  consoleTurrets.clear()
  consoleTutArrows.clear()
  occupiedTurret = null
  activeConsoleArrowTurret = null
  turretOccupied = false
  breachPointerEventsReady = false

  const weapons = new Map<string, Entity>()
  const consoles: { entity: Entity; name: string }[] = []

  for (const [entity, name] of engine.getEntitiesWith(Name)) {
    if (isBreachName(name.value)) {
      const breachId = breachIdFromName(name.value)
      if (breachId === undefined) {
        console.log(`[SCENE] Unrecognized breach name: ${name.value}`)
        continue
      }
      breachEntities.set(breachId, entity)
      continue
    }
    if (isWeaponName(name.value)) {
      weapons.set(name.value, entity)
      const turretId = turretIdFromWeaponName(name.value)
      if (turretId) {
        cacheTurretView(turretId, entity)
      } else {
        console.log(`[SCENE] Unrecognized weapon name: ${name.value}`)
      }
      continue
    }
    if (name.value === EntityNames.OverchargeStation) {
      overchargeStation = entity
      continue
    }
    if (name.value === EntityNames.MissionTable) {
      missionTable = entity
      continue
    }
    if (name.value === EntityNames.MissionTableText) {
      missionTableText = entity
      continue
    }
    if (name.value === EntityNames.MissionStartArrow) {
      missionStartArrow = entity
      continue
    }
    if (name.value === EntityNames.MissionLights) {
      missionLights = entity
      continue
    }
    if (name.value === EntityNames.WeaponLights) {
      weaponLights = entity
      continue
    }
    const arrowTurret = turretIdFromConsoleArrowName(name.value)
    if (arrowTurret) {
      consoleTutArrows.set(arrowTurret, entity)
      continue
    }
    if (isConsoleName(name.value)) {
      consoles.push({ entity, name: name.value })
    }
  }

  const role = isServer() ? 'SERVER' : 'CLIENT'
  console.log(`[${role}] Cached ${turretViews.size} turret views, ${breachEntities.size} breaches`)

  if (isServer()) return

  disablePlayerPassportPrompt()
  PointerLock.createOrReplace(engine.CameraEntity, { isPointerLocked: false })

  for (const entity of breachEntities.values()) {
    initBreach(entity)
  }

  const missionStarted = getGameState().missionStarted
  setEntityVisible(missionTableText, missionStarted)
  setEntityVisible(missionStartArrow, !missionStarted)
  setActiveConsoleArrow(null)
  if (missionTableText) {
    Spinner.create(missionTableText)
  }

  const cameras = new Map<string, Entity>()
  for (const [name] of weapons) {
    const turretId = turretIdFromWeaponName(name)
    const view = turretId ? turretViews.get(turretId) : undefined
    if (!view) continue
    cameras.set(name, initWeaponFromView(view))
  }

  for (const console of consoles) {
    const weaponName = console.name.replace(/Console$/, '')
    const turretId = turretIdFromWeaponName(weaponName)
    const view = turretId ? turretViews.get(turretId) : undefined
    if (view) {
      view.aimOrigin = Vector3.clone(getWorldPosition(engine, console.entity))
    }
    initConsole(console.entity, cameras.get(weaponName), turretId)
  }

  function attachSceneObjectPointerEvents(): void {
    if (getPlatform() === null) return
    engine.removeSystem(attachSceneObjectPointerEvents)

    if (overchargeStation) {
      attachInteractEvent(overchargeStation, 'Supercharge Weapons!')
    }
    if (missionTable) {
      attachInteractEvent(missionTable, 'Start Mission')
    }
    for (const console of consoles) {
      if (!consoleCameras.has(console.entity)) continue
      attachInteractEvent(console.entity, hoverTextForConsole(console.name))
    }
  }

  engine.addSystem(attachSceneObjectPointerEvents)
  engine.addSystem(WeaponConsoleSystem)
  engine.addSystem(BreachVisibilitySystem)
  engine.addSystem(BreachRepairSystem)
  engine.addSystem(OverchargeStationSystem)
  engine.addSystem(MissionTableSystem)
  engine.addSystem(MissionLightsSystem)
  engine.addSystem(WeaponLightsSystem)
  engine.addSystem(SpinSystem)
}
