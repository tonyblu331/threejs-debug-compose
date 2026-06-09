import { NodeMaterial } from "three/webgpu"
import { float, Fn, length, positionWorld, uniform, vec3, vec4 } from "three/tsl"
import {
  collectCountableLights,
  DEFAULT_MAX_DISPLAY_LIGHTS,
  type CountableLightSnapshot,
} from "./light-classification"

const LIGHT_TYPE_POINT = 0
const LIGHT_TYPE_SPOT = 1
const LIGHT_TYPE_RECT = 2

interface LightComplexitySlotUniforms {
  position: { value: { set: (x: number, y: number, z: number) => void } }
  range: { value: number }
  lightType: { value: number }
  direction: { value: { set: (x: number, y: number, z: number) => void } }
  angleCos: { value: number }
  rectRange: { value: number }
}

export interface LightComplexityHandle {
  material: NodeMaterial
  syncScene: (root: { traverse: (cb: (obj: unknown) => void) => void }) => void
  syncLights: (lights: readonly CountableLightSnapshot[]) => void
  dispose: () => void
}

export function createLightComplexityHandle(
  maxDisplayLights = DEFAULT_MAX_DISPLAY_LIGHTS,
): LightComplexityHandle {
  const material = new NodeMaterial()
  material.fog = false
  material.lights = false
  material.toneMapped = false
  material.depthTest = true
  material.depthWrite = true

  const slots = Array.from({ length: maxDisplayLights }, () => ({
    position: uniform(vec3(0, 0, 0)),
    range: uniform(float(0)),
    lightType: uniform(float(LIGHT_TYPE_POINT)),
    direction: uniform(vec3(0, 0, -1)),
    angleCos: uniform(float(-1)),
    rectRange: uniform(float(0)),
  }))

  material.colorNode = Fn(() => {
    const worldPosition = positionWorld
    const count = float(0).toVar("lightComplexityCount")

    for (const slot of slots) {
      const toLight = slot.position.sub(worldPosition)
      const distance = length(toLight)
      const inRange = distance.lessThanEqual(slot.range)
      const active = slot.range.greaterThan(float(0))

      const pointContrib = inRange.select(float(1), float(0))

      const lightVector = toLight.normalize().negate()
      const coneMatch = lightVector.dot(slot.direction).greaterThanEqual(slot.angleCos)
      const spotContrib = inRange.and(coneMatch).select(float(1), float(0))

      const rectMatch = distance.lessThanEqual(slot.rectRange)
      const rectContrib = rectMatch.select(float(1), float(0))

      const isPoint = slot.lightType.equal(float(LIGHT_TYPE_POINT))
      const isSpot = slot.lightType.equal(float(LIGHT_TYPE_SPOT))
      const contrib = isPoint.select(
        pointContrib,
        isSpot.select(spotContrib, rectContrib),
      )

      count.addAssign(active.select(contrib, float(0)))
    }

    return vec4(count.div(float(maxDisplayLights)), float(0), float(0), float(1))
  })()

  return {
    material,
    syncScene(root) {
      applyCountableLightsToSlots(slots, collectCountableLights(root))
    },
    syncLights(lights) {
      applyCountableLightsToSlots(slots, lights)
    },
    dispose() {
      material.dispose()
    },
  }
}

export function createLightComplexityMaterial(
  lights: readonly CountableLightSnapshot[],
  maxDisplayLights = DEFAULT_MAX_DISPLAY_LIGHTS,
) {
  const handle = createLightComplexityHandle(maxDisplayLights)
  handle.syncLights(lights.slice(0, maxDisplayLights))
  return handle.material
}

export function createLightComplexityMaterialFromScene(
  scene: { traverse: (cb: (obj: unknown) => void) => void },
  maxDisplayLights = DEFAULT_MAX_DISPLAY_LIGHTS,
) {
  const handle = createLightComplexityHandle(maxDisplayLights)
  handle.syncScene(scene)
  return handle.material
}

function applyCountableLightsToSlots(
  slots: readonly LightComplexitySlotUniforms[],
  lights: readonly CountableLightSnapshot[],
) {
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index]!
    const light = lights[index]

    if (!light) {
      slot.range.value = 0
      continue
    }

    slot.position.value.set(light.position.x, light.position.y, light.position.z)
    slot.range.value = light.distance > 0 ? light.distance : 1_000

    if (light.type === "spot" && light.direction && light.angleCos != null) {
      slot.lightType.value = LIGHT_TYPE_SPOT
      slot.direction.value.set(light.direction.x, light.direction.y, light.direction.z)
      slot.angleCos.value = light.angleCos
      slot.rectRange.value = 0
      continue
    }

    if (light.type === "rectArea" && light.width && light.height) {
      slot.lightType.value = LIGHT_TYPE_RECT
      slot.rectRange.value = Math.max(light.width, light.height) * 1.5
      slot.angleCos.value = -1
      continue
    }

    slot.lightType.value = LIGHT_TYPE_POINT
    slot.angleCos.value = -1
    slot.rectRange.value = 0
  }
}
