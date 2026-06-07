import {
  FrontSide,
  Material,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshMatcapMaterial,
  MeshPhongMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  NormalBlending,
  ShaderMaterial,
  Texture,
} from "three"
import { applyShaderCostCalibration, type ShaderCostCalibration } from "./calibration"

export interface MaterialCostEntry {
  cost: number
  features?: ShaderCostFeatures
  signature: string
  signals: readonly string[]
}

export type MaterialFamily =
  | "basic"
  | "lambert"
  | "matcap"
  | "node"
  | "phong"
  | "physical"
  | "shader"
  | "standard"
  | "toon"
  | "unknown"

export type TransparencyMode = "opaque" | "alphaTest" | "transparent"
export type ShaderCostSource = "compiled-shader" | "generated-wgsl" | "three-node-graph" | "material-proxy"

export interface ShaderCostFeatures {
  materialFamily: MaterialFamily
  aluOps: number
  textureOps: number
  dependentTextureOps: number
  branchOps: number
  discardOps: number
  derivativeOps: number
  transcendentalOps: number
  interpolatorPressure: number
  uniformPressure: number
  precisionPressure: number
  bandwidthPressure: number
  source: ShaderCostSource
  confidence: number
  textureSlots: number
  weightedTexelLoad: number
  dependentTextureRisk: number
  transparencyMode: TransparencyMode
  physicalLobes: number
  branchRisk: number
  discardRisk: number
  renderStateRisk: number
  customUniforms: number
}

export interface MaterialCostCache {
  get(material: Material): MaterialCostEntry
  clear(): void
  readonly size: number
}

const MAX_CACHE_SIZE = 1000
const REFERENCE_HIGH_SHADER_UNITS = 96
const DEFAULT_TEXTURE_DIMENSION = 1024

type ShaderUnitProfile = Pick<
  ShaderCostFeatures,
  | "aluOps"
  | "textureOps"
  | "dependentTextureOps"
  | "branchOps"
  | "discardOps"
  | "derivativeOps"
  | "transcendentalOps"
  | "interpolatorPressure"
  | "uniformPressure"
  | "precisionPressure"
  | "bandwidthPressure"
  | "confidence"
>

const MATERIAL_SHADER_UNIT_PROFILES: Record<MaterialFamily, ShaderUnitProfile> = {
  basic: profile({ aluOps: 1, confidence: 0.45 }),
  lambert: profile({ aluOps: 6, interpolatorPressure: 1, confidence: 0.45 }),
  matcap: profile({ aluOps: 4, textureOps: 1, interpolatorPressure: 1, confidence: 0.4 }),
  phong: profile({ aluOps: 14, branchOps: 1, interpolatorPressure: 2, confidence: 0.45 }),
  toon: profile({ aluOps: 12, branchOps: 1, interpolatorPressure: 2, confidence: 0.4 }),
  standard: profile({ aluOps: 28, derivativeOps: 1, interpolatorPressure: 3, confidence: 0.5 }),
  physical: profile({ aluOps: 42, branchOps: 1, derivativeOps: 1, interpolatorPressure: 4, confidence: 0.5 }),
  node: profile({ aluOps: 20, branchOps: 1, interpolatorPressure: 2, confidence: 0.3 }),
  shader: profile({ aluOps: 8, branchOps: 1, confidence: 0.2 }),
  unknown: profile({ aluOps: 10, branchOps: 1, confidence: 0.2 }),
}

const SHADER_UNIT_WEIGHTS = {
  aluOps: 1,
  textureOps: 4,
  dependentTextureOps: 2,
  branchOps: 2,
  discardOps: 3,
  derivativeOps: 2,
  transcendentalOps: 4,
  interpolatorPressure: 0.5,
  uniformPressure: 0.25,
  precisionPressure: 1,
  bandwidthPressure: 2,
} as const

const TEXTURE_SLOTS = [
  "map",
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "envMap",
  "clearcoatMap",
  "transmissionMap",
  "aoMap",
  "emissiveMap",
  "alphaMap",
] as const

class BoundedCache {
  private map = new Map<string, MaterialCostEntry>()

  get(key: string): MaterialCostEntry | undefined {
    return this.map.get(key)
  }

  set(key: string, value: MaterialCostEntry) {
    if (this.map.size >= MAX_CACHE_SIZE) {
      const firstKey = this.map.keys().next().value
      if (firstKey) this.map.delete(firstKey)
    }
    this.map.set(key, value)
  }

  clear() {
    this.map.clear()
  }

  get size() {
    return this.map.size
  }
}

const cache = new BoundedCache()

export function getMaterialComplexity(material: Material): MaterialCostEntry {
  const signature = buildSignature(material)
  const cached = cache.get(material.uuid)
  
  if (cached && cached.signature === signature) {
    return cached
  }

  if (isZeroCostBasicMaterial(material)) {
    const features = extractMaterialCostFeatures(material)
    const result: MaterialCostEntry = {
      cost: 0,
      features,
      signature,
      signals: createMaterialCostSignals(features),
    }
    cache.set(material.uuid, result)
    return result
  }

  const features = extractMaterialCostFeatures(material)

  const result: MaterialCostEntry = {
    cost: predictMaterialCost(features),
    features,
    signature,
    signals: createMaterialCostSignals(features),
  }

  cache.set(material.uuid, result)
  return result
}

export function extractMaterialCostFeatures(material: Material): ShaderCostFeatures {
  const materialFamily = getMaterialFamily(material)
  const transparencyMode = getTransparencyMode(material)
  const physicalLobes = getPhysicalLobeCount(material)
  const customUniforms = material instanceof ShaderMaterial
    ? Object.keys(material.uniforms).length
    : 0
  const textureProfile = getTextureProfile(material)
  const baseProfile = MATERIAL_SHADER_UNIT_PROFILES[materialFamily]
  const branchOps = getBranchRisk(material, transparencyMode, customUniforms)
  const discardOps = transparencyMode === "alphaTest" ? 1 : 0
  const renderStateRisk = getRenderStateRisk(material)

  return {
    materialFamily,
    aluOps: baseProfile.aluOps + physicalLobes * 8,
    textureOps: baseProfile.textureOps + textureProfile.textureOps,
    dependentTextureOps: baseProfile.dependentTextureOps + textureProfile.dependentTextureRisk,
    branchOps: baseProfile.branchOps + branchOps,
    discardOps: baseProfile.discardOps + discardOps,
    derivativeOps: baseProfile.derivativeOps,
    transcendentalOps: baseProfile.transcendentalOps + physicalLobes,
    interpolatorPressure: baseProfile.interpolatorPressure + Math.min(4, textureProfile.slots * 0.5),
    uniformPressure: baseProfile.uniformPressure + Math.min(8, customUniforms),
    precisionPressure: baseProfile.precisionPressure,
    bandwidthPressure: baseProfile.bandwidthPressure + textureProfile.bandwidthPressure + renderStateRisk,
    source: "material-proxy",
    confidence: baseProfile.confidence,
    textureSlots: textureProfile.slots,
    weightedTexelLoad: textureProfile.weightedTexelLoad,
    dependentTextureRisk: textureProfile.dependentTextureRisk,
    transparencyMode,
    physicalLobes,
    branchRisk: branchOps,
    discardRisk: discardOps,
    renderStateRisk,
    customUniforms,
  }
}

export function predictMaterialCost(features: ShaderCostFeatures): number {
  if (
    features.materialFamily === "basic" &&
    features.textureSlots === 0 &&
    features.transparencyMode === "opaque" &&
    features.renderStateRisk === 0
  ) {
    return 0
  }

  const shaderUnitCost =
    features.aluOps * SHADER_UNIT_WEIGHTS.aluOps +
    features.textureOps * SHADER_UNIT_WEIGHTS.textureOps +
    features.dependentTextureOps * SHADER_UNIT_WEIGHTS.dependentTextureOps +
    features.branchOps * SHADER_UNIT_WEIGHTS.branchOps +
    features.discardOps * SHADER_UNIT_WEIGHTS.discardOps +
    features.derivativeOps * SHADER_UNIT_WEIGHTS.derivativeOps +
    features.transcendentalOps * SHADER_UNIT_WEIGHTS.transcendentalOps +
    features.interpolatorPressure * SHADER_UNIT_WEIGHTS.interpolatorPressure +
    features.uniformPressure * SHADER_UNIT_WEIGHTS.uniformPressure +
    features.precisionPressure * SHADER_UNIT_WEIGHTS.precisionPressure +
    features.bandwidthPressure * SHADER_UNIT_WEIGHTS.bandwidthPressure

  return clamp01(shaderUnitCost / REFERENCE_HIGH_SHADER_UNITS)
}

function getMaterialFamily(material: Material): MaterialFamily {
  if (isNodeMaterial(material)) return "node"
  if (material instanceof MeshPhysicalMaterial) return "physical"
  if (material instanceof MeshStandardMaterial) return "standard"
  if (material instanceof ShaderMaterial) return "shader"
  if (material instanceof MeshPhongMaterial) return "phong"
  if (material instanceof MeshToonMaterial) return "toon"
  if (material instanceof MeshLambertMaterial) return "lambert"
  if (material instanceof MeshMatcapMaterial) return "matcap"
  if (material instanceof MeshBasicMaterial) return "basic"
  return "unknown"
}

function getTransparencyMode(material: Material): TransparencyMode {
  if (material.transparent) return "transparent"
  return getNumericProperty(material, "alphaTest") > 0 || getBooleanProperty(material, "alphaHash")
    ? "alphaTest"
    : "opaque"
}

function getPhysicalLobeCount(material: Material): number {
  if (!(material instanceof MeshPhysicalMaterial)) return 0

  let lobes = 0
  if (material.transmission > 0) lobes += 1
  if (material.clearcoat > 0) lobes += 1
  if (material.iridescence > 0) lobes += 1
  if (material.sheen > 0) lobes += 1
  return lobes
}

function getTextureProfile(material: Material) {
  let slots = 0
  let weightedTexelLoad = 0
  let dependentTextureRisk = 0
  let textureOps = 0
  let bandwidthPressure = 0

  for (const slot of TEXTURE_SLOTS) {
    const texture = getProperty<Texture | undefined>(material, slot)
    if (!texture) continue

    slots += 1
    const resolutionWeight = getTextureResolutionWeight(texture)
    weightedTexelLoad += getTextureSlotCost(slot) * resolutionWeight
    dependentTextureRisk += getDependentTextureRisk(slot)
    textureOps += getTextureOpCount(slot)
    bandwidthPressure += Math.max(0, resolutionWeight - 1)
  }

  return { bandwidthPressure, dependentTextureRisk, slots, textureOps, weightedTexelLoad }
}

function getTextureSlotCost(slot: string): number {
  if (slot === "normalMap" || slot === "envMap" || slot === "transmissionMap") return 1.5
  if (slot === "aoMap" || slot === "emissiveMap" || slot === "alphaMap") return 0.55
  return 1
}

function getDependentTextureRisk(slot: string): number {
  return slot === "normalMap" || slot === "transmissionMap" ? 1 : 0
}

function getTextureOpCount(slot: string): number {
  return slot === "envMap" || slot === "transmissionMap" ? 2 : 1
}

function getBranchRisk(
  material: Material,
  transparencyMode: TransparencyMode,
  customUniforms: number,
): number {
  let risk = 0
  if (transparencyMode !== "opaque") risk += 1
  if (getArrayProperty(material, "clippingPlanes").length > 0) risk += 1
  if (customUniforms > 5) risk += 1
  if (customUniforms > 10) risk += 1
  return risk
}

function getRenderStateRisk(material: Material): number {
  let risk = 0
  if (getArrayProperty(material, "clippingPlanes").length > 0) risk += 1
  if (material.side !== FrontSide) risk += 0.5
  if (material.blending !== NormalBlending) risk += 0.5
  return risk
}

function isZeroCostBasicMaterial(material: Material): material is MeshBasicMaterial {
  if (!(material instanceof MeshBasicMaterial)) return false

  const features = extractMaterialCostFeatures(material)
  return (
    features.textureSlots === 0 &&
    features.transparencyMode === "opaque" &&
    features.branchRisk === 0 &&
    features.discardRisk === 0 &&
    features.renderStateRisk === 0
  )
}

function isNodeMaterial(material: Material): boolean {
  const flags = material as unknown as Record<string, unknown>
  return flags.isNodeMaterial === true || flags.isMeshStandardNodeMaterial === true
}

function createMaterialCostSignals(features: ShaderCostFeatures): string[] {
  const signals: string[] = [`family:${features.materialFamily}`]

  if (features.materialFamily === "basic" && features.textureSlots === 0) {
    signals.push("type:basic-unlit")
  }

  if (features.materialFamily === "physical") {
    signals.push("lighting:pbr", "brdf:physical")
  } else if (features.materialFamily === "standard") {
    signals.push("lighting:pbr")
  } else if (features.materialFamily === "shader") {
    signals.push("type:custom-shader")
  } else if (features.materialFamily === "node") {
    signals.push("type:node-material")
  }

  if (features.textureSlots > 0) signals.push(`textures:${features.textureSlots}`)
  signals.push(`source:${features.source}`)
  signals.push(`confidence:${roundSignal(features.confidence)}`)
  signals.push(`alu-ops:${roundSignal(features.aluOps)}`)
  if (features.textureOps > 0) signals.push(`texture-ops:${roundSignal(features.textureOps)}`)
  if (features.dependentTextureOps > 0) {
    signals.push(`dependent-texture-ops:${roundSignal(features.dependentTextureOps)}`)
  }
  if (features.branchOps > 0) signals.push(`branch-ops:${roundSignal(features.branchOps)}`)
  if (features.discardOps > 0) signals.push(`discard-ops:${roundSignal(features.discardOps)}`)
  if (features.bandwidthPressure > 0) {
    signals.push(`bandwidth-pressure:${roundSignal(features.bandwidthPressure)}`)
  }
  if (features.weightedTexelLoad > 0) {
    signals.push(`weighted-texel-load:${roundSignal(features.weightedTexelLoad)}`)
  }
  if (features.dependentTextureRisk > 0) {
    signals.push(`dependent-texture-risk:${features.dependentTextureRisk}`)
  }
  if (features.transparencyMode !== "opaque") {
    signals.push(`transparency:${features.transparencyMode}`)
  }
  if (features.physicalLobes > 0) signals.push(`physical-lobes:${features.physicalLobes}`)
  if (features.branchRisk > 0) signals.push(`branch-risk:${features.branchRisk}`)
  if (features.discardRisk > 0) signals.push("discard-risk:alpha-test")
  if (features.renderStateRisk > 0) {
    signals.push(`render-state-risk:${roundSignal(features.renderStateRisk)}`)
  }
  if (features.customUniforms > 0) signals.push(`custom-uniforms:${features.customUniforms}`)

  return signals
}

function getTextureResolutionWeight(texture: Texture): number {
  const { width, height } = getTextureDimensions(texture)
  const maxDimension = Math.max(width, height)
  const texelCount = width * height

  if (maxDimension >= 2048 || texelCount >= 2048 * 2048) return 1.5
  if (maxDimension >= 1024 || texelCount >= 1024 * 1024) return 1.25
  if (maxDimension <= 256 && texelCount <= 256 * 256) return 0.75
  return 1.0
}

function buildSignature(material: Material): string {
  let sig = `${material.type}:${material.uuid}:${material.side}:${material.blending}`
  
  if (material.transparent) sig += ":T"
  if (getBooleanProperty(material, "alphaHash")) sig += ":H"
  if (getNumericProperty(material, "alphaTest") > 0) {
    sig += `:A${getNumericProperty(material, "alphaTest")}`
  }
  if (getArrayProperty(material, "clippingPlanes").length > 0) {
    sig += `:C${getArrayProperty(material, "clippingPlanes").length}`
  }
  
  for (const slot of TEXTURE_SLOTS) {
    const texture = getProperty<Texture | undefined>(material, slot)
    if (texture) {
      const { width, height } = getTextureDimensions(texture)
      sig += `:${slot}:${width}x${height}`
    }
  }
  
  if (material instanceof MeshPhysicalMaterial) {
    if (material.transmission > 0) sig += ":TX"
    if (material.clearcoat > 0) sig += ":CC"
    if (material.iridescence > 0) sig += ":IR"
    if (material.sheen > 0) sig += ":SH"
  }

  if (material instanceof ShaderMaterial) {
    sig += `:U${Object.keys(material.uniforms).length}`
  }
  
  return sig
}

function getTextureDimensions(texture: Texture) {
  const image = texture.image as Partial<{ width: number; height: number }> | undefined
  const sourceData = texture.source?.data as Partial<{ width: number; height: number }> | undefined
  const width = getPositiveDimension(image?.width ?? sourceData?.width)
  const height = getPositiveDimension(image?.height ?? sourceData?.height)

  return { width, height }
}

function getPositiveDimension(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_TEXTURE_DIMENSION
}

function getProperty<T>(material: Material, property: string): T | undefined {
  return (material as unknown as Record<string, T>)[property]
}

function getBooleanProperty(material: Material, property: string): boolean {
  return getProperty<boolean>(material, property) === true
}

function getNumericProperty(material: Material, property: string): number {
  const value = getProperty<number>(material, property)
  return typeof value === "number" ? value : 0
}

function getArrayProperty<T>(material: Material, property: string): T[] {
  const value = getProperty<T[]>(material, property)
  return Array.isArray(value) ? value : []
}

export function clearMaterialComplexityCache(): void {
  cache.clear()
}

export function getMaterialComplexityCacheSize(): number {
  return cache.size
}

export function scoreMaterialCost(
  material: Material,
  calibration?: ShaderCostCalibration,
): number {
  return applyShaderCostCalibration(getMaterialComplexity(material).cost, calibration)
}

export function getMaterialCostSignature(material: Material): string {
  return buildSignature(material)
}

export function createMaterialCostCache(): MaterialCostCache {
  return {
    get(material: Material) {
      return getMaterialComplexity(material)
    },
    clear() {
      clearMaterialComplexityCache()
    },
    get size() {
      return getMaterialComplexityCacheSize()
    },
  }
}

function roundSignal(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, "")
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function profile(profile: Partial<ShaderUnitProfile> & Pick<ShaderUnitProfile, "aluOps" | "confidence">): ShaderUnitProfile {
  return {
    aluOps: profile.aluOps,
    textureOps: profile.textureOps ?? 0,
    dependentTextureOps: profile.dependentTextureOps ?? 0,
    branchOps: profile.branchOps ?? 0,
    discardOps: profile.discardOps ?? 0,
    derivativeOps: profile.derivativeOps ?? 0,
    transcendentalOps: profile.transcendentalOps ?? 0,
    interpolatorPressure: profile.interpolatorPressure ?? 0,
    uniformPressure: profile.uniformPressure ?? 0,
    precisionPressure: profile.precisionPressure ?? 0,
    bandwidthPressure: profile.bandwidthPressure ?? 0,
    confidence: profile.confidence,
  }
}
