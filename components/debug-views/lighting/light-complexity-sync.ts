import {
  type PointLight,
  type RectAreaLight,
  type SpotLight,
  Vector3,
} from "three"
import { createSceneGraphRescanScheduler } from "../shared/scene-graph-cache"
import {
  DEFAULT_MAX_DISPLAY_LIGHTS,
  discoverCountableLights,
  type CountableLightSnapshot,
} from "./light-classification"

export const LIGHT_TYPE_POINT = 0
export const LIGHT_TYPE_SPOT = 1
export const LIGHT_TYPE_RECT = 2

export interface LightComplexitySlotUniforms {
  position: { value: { set: (x: number, y: number, z: number) => void } }
  range: { value: number }
  lightType: { value: number }
  direction: { value: { set: (x: number, y: number, z: number) => void } }
  angleCos: { value: number }
  rectRange: { value: number }
}

interface TrackedLight {
  light: PointLight | SpotLight | RectAreaLight
  target: SpotLight["target"] | null
}

interface LightSlotState {
  active: boolean
  px: number
  py: number
  pz: number
  range: number
  lightType: number
  dx: number
  dy: number
  dz: number
  angleCos: number
  rectRange: number
}

const positionScratch = new Vector3()
const targetScratch = new Vector3()
const directionScratch = new Vector3()
const probeState = createEmptyLightSlotState()
const rescanParentsScratch: { parent: unknown | null }[] = []

export interface LightComplexitySync {
  syncScene: (root: { traverse: (cb: (obj: unknown) => void) => void }) => void
  syncSceneIfDirty: (root: { traverse: (cb: (obj: unknown) => void) => void }) => boolean
  syncLights: (lights: readonly CountableLightSnapshot[]) => void
  invalidateScene: () => void
  dispose: () => void
}

export function createLightComplexitySync(
  slots: readonly LightComplexitySlotUniforms[],
  maxDisplayLights = DEFAULT_MAX_DISPLAY_LIGHTS,
): LightComplexitySync {
  const fingerprints: LightSlotState[] = Array.from({ length: maxDisplayLights }, createEmptyLightSlotState)
  let trackedLights: TrackedLight[] = []
  const scheduler = createSceneGraphRescanScheduler()

  const syncScene = (root: { traverse: (cb: (obj: unknown) => void) => void }) => {
    rescanTrackedLights(root)
    writeAllSlots(slots, trackedLights, fingerprints)
  }

  const syncSceneIfDirty = (root: { traverse: (cb: (obj: unknown) => void) => void }) => {
    if (shouldRescan(root)) {
      rescanTrackedLights(root)
      writeAllSlots(slots, trackedLights, fingerprints)
      return true
    }

    for (let index = 0; index < maxDisplayLights; index += 1) {
      const tracked = trackedLights[index]
      const fingerprint = fingerprints[index]!

      if (!tracked || tracked.light.parent == null) {
        if (fingerprint.active) {
          writeAllSlots(slots, trackedLights, fingerprints)
          return true
        }
        continue
      }

      if (lightStateChanged(tracked, fingerprint)) {
        writeAllSlots(slots, trackedLights, fingerprints)
        return true
      }
    }

    return false
  }

  const syncLights = (lights: readonly CountableLightSnapshot[]) => {
    trackedLights = []
    scheduler.invalidate()

    for (let index = 0; index < maxDisplayLights; index += 1) {
      const light = lights[index]
      const fingerprint = fingerprints[index]!

      if (!light) {
        applyStateToFingerprint(fingerprint, createEmptyLightSlotState())
        clearSlot(slots[index]!)
        continue
      }

      const state = resolveSnapshotLight(light)
      applyStateToSlot(slots[index]!, state)
      applyStateToFingerprint(fingerprint, state)
    }
  }

  return {
    syncScene,
    syncSceneIfDirty,
    syncLights,
    invalidateScene() {
      trackedLights = []
      scheduler.invalidate()
      for (const fingerprint of fingerprints) {
        applyStateToFingerprint(fingerprint, createEmptyLightSlotState())
      }
    },
    dispose() {
      trackedLights = []
      scheduler.dispose()
    },
  }

  function shouldRescan(_root: { traverse: (cb: (obj: unknown) => void) => void }) {
    rescanParentsScratch.length = 0
    for (const tracked of trackedLights) {
      rescanParentsScratch.push({ parent: tracked.light.parent })
    }
    return scheduler.shouldRescan(rescanParentsScratch)
  }

  function rescanTrackedLights(root: { traverse: (cb: (obj: unknown) => void) => void }) {
    trackedLights = discoverCountableLights(root)
      .slice(0, maxDisplayLights)
      .map((light) => ({
        light,
        target: (light as SpotLight).isSpotLight ? (light as SpotLight).target : null,
      }))
    scheduler.markRescanned()
  }
}

function writeAllSlots(
  slots: readonly LightComplexitySlotUniforms[],
  trackedLights: readonly TrackedLight[],
  fingerprints: LightSlotState[],
) {
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index]!
    const fingerprint = fingerprints[index]!
    const tracked = trackedLights[index]

    if (!tracked || tracked.light.parent == null) {
      applyStateToFingerprint(fingerprint, createEmptyLightSlotState())
      clearSlot(slot)
      continue
    }

    const state = resolveTrackedLight(tracked)
    applyStateToSlot(slot, state)
    applyStateToFingerprint(fingerprint, state)
  }
}

function lightStateChanged(tracked: TrackedLight, fingerprint: LightSlotState) {
  resolveTrackedLight(tracked, probeState)
  return !lightSlotStatesEqual(probeState, fingerprint)
}

function lightSlotStatesEqual(a: LightSlotState, b: LightSlotState) {
  return (
    a.active === b.active
    && a.px === b.px
    && a.py === b.py
    && a.pz === b.pz
    && a.range === b.range
    && a.lightType === b.lightType
    && a.dx === b.dx
    && a.dy === b.dy
    && a.dz === b.dz
    && a.angleCos === b.angleCos
    && a.rectRange === b.rectRange
  )
}

function resolveTrackedLight(tracked: TrackedLight, out = createEmptyLightSlotState()): LightSlotState {
  const light = tracked.light

  light.getWorldPosition(positionScratch)
  out.active = true
  out.px = positionScratch.x
  out.py = positionScratch.y
  out.pz = positionScratch.z

  if ((light as PointLight).isPointLight) {
    const point = light as PointLight
    out.lightType = LIGHT_TYPE_POINT
    out.range = point.distance > 0 ? point.distance : 1_000
    out.dx = 0
    out.dy = 0
    out.dz = -1
    out.angleCos = -1
    out.rectRange = 0
    return out
  }

  if ((light as SpotLight).isSpotLight) {
    const spot = light as SpotLight
    tracked.target?.getWorldPosition(targetScratch)
    directionScratch.copy(targetScratch).sub(positionScratch).normalize()

    out.lightType = LIGHT_TYPE_SPOT
    out.range = spot.distance > 0 ? spot.distance : 1_000
    out.dx = directionScratch.x
    out.dy = directionScratch.y
    out.dz = directionScratch.z
    out.angleCos = Math.cos(spot.angle * 0.5)
    out.rectRange = 0
    return out
  }

  const rect = light as RectAreaLight
  const rectRange = Math.max(rect.width, rect.height) * 1.5
  out.lightType = LIGHT_TYPE_RECT
  out.range = rectRange
  out.dx = 0
  out.dy = 0
  out.dz = -1
  out.angleCos = -1
  out.rectRange = rectRange
  return out
}

function resolveSnapshotLight(light: CountableLightSnapshot): LightSlotState {
  const state = createEmptyLightSlotState()
  state.active = true
  state.px = light.position.x
  state.py = light.position.y
  state.pz = light.position.z
  state.range = light.distance > 0 ? light.distance : 1_000

  if (light.type === "spot" && light.direction && light.angleCos != null) {
    state.lightType = LIGHT_TYPE_SPOT
    state.dx = light.direction.x
    state.dy = light.direction.y
    state.dz = light.direction.z
    state.angleCos = light.angleCos
    return state
  }

  if (light.type === "rectArea" && light.width && light.height) {
    state.lightType = LIGHT_TYPE_RECT
    state.rectRange = Math.max(light.width, light.height) * 1.5
    state.range = state.rectRange
    return state
  }

  state.lightType = LIGHT_TYPE_POINT
  return state
}

function applyStateToSlot(slot: LightComplexitySlotUniforms, state: LightSlotState) {
  if (!state.active) {
    clearSlot(slot)
    return
  }

  slot.position.value.set(state.px, state.py, state.pz)
  slot.range.value = state.range
  slot.lightType.value = state.lightType
  slot.direction.value.set(state.dx, state.dy, state.dz)
  slot.angleCos.value = state.angleCos
  slot.rectRange.value = state.rectRange
}

function applyStateToFingerprint(fingerprint: LightSlotState, state: LightSlotState) {
  fingerprint.active = state.active
  fingerprint.px = state.px
  fingerprint.py = state.py
  fingerprint.pz = state.pz
  fingerprint.range = state.range
  fingerprint.lightType = state.lightType
  fingerprint.dx = state.dx
  fingerprint.dy = state.dy
  fingerprint.dz = state.dz
  fingerprint.angleCos = state.angleCos
  fingerprint.rectRange = state.rectRange
}

function clearSlot(slot: LightComplexitySlotUniforms) {
  slot.range.value = 0
}

function createEmptyLightSlotState(): LightSlotState {
  return {
    active: false,
    px: 0,
    py: 0,
    pz: 0,
    range: 0,
    lightType: LIGHT_TYPE_POINT,
    dx: 0,
    dy: 0,
    dz: -1,
    angleCos: -1,
    rectRange: 0,
  }
}
