import {
  AdditiveBlending,
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  type Scene,
  type Texture,
} from "three"

export interface OverdrawOverride {
  apply(scene: Scene | Object3D): OverdrawRestore
  dispose(): void
}

export interface OverdrawRestore {
  restore(): void
  readonly replacements: number
}

type MeshMaterial = Material | Material[]

interface OriginalMaterialEntry {
  mesh: Mesh
  material: MeshMaterial
  visible: boolean
}

const OPAQUE_KEY = "opaque"

export function createOverdrawOverride(): OverdrawOverride {
  const materials = new Map<string, MeshBasicMaterial>()

  return {
    apply(scene) {
      return applyOverdrawOverride(scene, materials)
    },
    dispose() {
      for (const material of materials.values()) {
        material.dispose()
      }
      materials.clear()
    },
  }
}

function applyOverdrawOverride(
  scene: Scene | Object3D,
  materials: Map<string, MeshBasicMaterial>,
): OverdrawRestore {
  const originals: OriginalMaterialEntry[] = []

  scene.traverse((object) => {
    if (!isMeshWithMaterial(object)) return

    originals.push({
      mesh: object,
      material: object.material,
      visible: object.visible,
    })

    const replacement = replaceMaterial(object.material, materials)
    if (!replacement.contributes) {
      object.visible = false
      return
    }

    object.material = replacement.material
  })

  let restored = false

  return {
    restore() {
      if (restored) return

      for (const entry of originals) {
        entry.mesh.material = entry.material
        entry.mesh.visible = entry.visible
      }

      restored = true
    },
    get replacements() {
      return originals.length
    },
  }
}

function replaceMaterial(
  material: MeshMaterial,
  materials: Map<string, MeshBasicMaterial>,
): { material: MeshMaterial, contributes: boolean } {
  if (Array.isArray(material)) {
    const replacements = material.map((entry) => (
      isOverdrawContributor(entry)
        ? getOverdrawMaterial(entry, materials)
        : getHiddenMaterial(materials)
    ))

    return {
      material: replacements,
      contributes: material.some(isOverdrawContributor),
    }
  }

  return {
    material: getOverdrawMaterial(material, materials),
    contributes: isOverdrawContributor(material),
  }
}

function getOverdrawMaterial(material: Material, materials: Map<string, MeshBasicMaterial>) {
  if (!isOverdrawContributor(material)) {
    return getHiddenMaterial(materials)
  }

  const alphaMap = getMaterialProperty<Texture | null>(material, "alphaMap")
  const alphaTest = Math.max(getMaterialAlphaTest(material), alphaMap ? 0.001 : 0)
  const key = [
    alphaMap?.uuid ?? OPAQUE_KEY,
    alphaTest,
    material.side,
  ].join(":")
  const existing = materials.get(key)
  if (existing) return existing

  const replacement = new MeshBasicMaterial({
    alphaMap,
    alphaTest,
    blending: AdditiveBlending,
    color: 0xffffff,
    depthTest: false,
    depthWrite: false,
    name: `Overdraw:${key}`,
    opacity: 0.18,
    side: material.side,
    toneMapped: false,
    transparent: true,
  })

  replacement.alphaHash = getMaterialProperty(material, "alphaHash") === true
  materials.set(key, replacement)
  return replacement
}

function getHiddenMaterial(materials: Map<string, MeshBasicMaterial>) {
  const existing = materials.get("hidden")
  if (existing) return existing

  const material = new MeshBasicMaterial({
    color: 0x000000,
    depthWrite: false,
    name: "Overdraw:hidden",
    opacity: 0,
    toneMapped: false,
    transparent: true,
  })

  materials.set("hidden", material)
  return material
}

function isOverdrawContributor(material: Material) {
  return (
    material.transparent ||
    getMaterialAlphaTest(material) > 0 ||
    getMaterialOpacity(material) < 1 ||
    getMaterialProperty(material, "alphaMap") != null ||
    getMaterialProperty(material, "alphaHash") === true
  )
}

function getMaterialOpacity(material: Material) {
  return typeof material.opacity === "number" ? material.opacity : 1
}

function getMaterialAlphaTest(material: Material) {
  return typeof material.alphaTest === "number" ? material.alphaTest : 0
}

function getMaterialProperty<T>(material: Material, property: string): T | undefined {
  return (material as unknown as Record<string, T>)[property]
}

function isMeshWithMaterial(object: Object3D): object is Mesh {
  return Boolean((object as Mesh).isMesh && (object as Mesh).material)
}
