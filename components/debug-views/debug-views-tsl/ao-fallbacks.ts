import {
  DataTexture,
  Material as ThreeMaterial,
  RGBAFormat,
  type Material,
  type Object3D,
  type Object3DEventMap,
  type Scene,
  type Texture,
} from "three"

const WHITE_AO_TEXTURE = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat)
WHITE_AO_TEXTURE.needsUpdate = true

interface MaterialWithAo extends Material {
  aoMap?: Texture | null
  aoMapIntensity?: number
}

interface ObjectWithMaterial {
  material?: Material | Material[]
}

interface AoFallbackSnapshot {
  hadAoMap: boolean
  hadAoMapIntensity: boolean
  material: MaterialWithAo
  previousAoMap?: Texture | null
  previousAoMapIntensity?: number
}

export function createAoFallbacks(scene: Scene) {
  const snapshots = new WeakMap<Material, AoFallbackSnapshot>()
  const tracked: AoFallbackSnapshot[] = []
  const listenedObjects = new Set<Object3D>()
  const materialOwners = new Set<Object3D>()
  const objectMaterials = new Map<Object3D, Set<Material>>()
  const materialRefCounts = new Map<Material, number>()
  const materialPrototype = ThreeMaterial.prototype as MaterialWithAo
  const prototypeSnapshot = createSnapshot(materialPrototype)
  let prototypeApplied = false

  function apply() {
    if (!prototypeApplied) {
      applyFallback(materialPrototype)
      prototypeApplied = true
    }

    scene.traverse(prepareObject)
  }

  function refresh() {
    for (const object of materialOwners) {
      applyObjectFallback(object)
    }
  }

  function restore() {
    for (const snapshot of [...tracked]) {
      releaseSnapshot(snapshot)
    }

    if (prototypeApplied) {
      restoreSnapshot(prototypeSnapshot)
      prototypeApplied = false
    }

    tracked.length = 0

    for (const object of listenedObjects) {
      object.removeEventListener("childadded", handleChildAdded)
      object.removeEventListener("childremoved", handleChildRemoved)
    }
    listenedObjects.clear()
    materialOwners.clear()
    objectMaterials.clear()
    materialRefCounts.clear()
  }

  function prepareObject(object: Object3D) {
    listenForChildren(object)
    applyObjectFallback(object)
  }

  function listenForChildren(object: Object3D) {
    if (listenedObjects.has(object)) return
    object.addEventListener("childadded", handleChildAdded)
    object.addEventListener("childremoved", handleChildRemoved)
    listenedObjects.add(object)
  }

  function handleChildAdded(event: Object3DEventMap["childadded"] & { child: Object3D }) {
    event.child.traverse(prepareObject)
  }

  function handleChildRemoved(event: Object3DEventMap["childremoved"] & { child: Object3D }) {
    event.child.traverse(untrackObject)
  }

  function untrackObject(object: Object3D) {
    releaseObjectMaterials(object)
    materialOwners.delete(object)

    if (!listenedObjects.delete(object)) return

    object.removeEventListener("childadded", handleChildAdded)
    object.removeEventListener("childremoved", handleChildRemoved)
  }

  function applyObjectFallback(object: Object3D) {
    const material = (object as ObjectWithMaterial).material
    const materials = material ? createMaterialSet(material) : new Set<Material>()
    const previous = objectMaterials.get(object)

    if (previous) {
      for (const entry of previous) {
        if (!materials.has(entry)) {
          releaseMaterialFallback(entry)
        }
      }
    }

    for (const entry of materials) {
      if (!previous?.has(entry)) {
        applyMaterialFallback(entry as MaterialWithAo)
      }
    }

    if (materials.size > 0) {
      materialOwners.add(object)
      objectMaterials.set(object, materials)
    } else {
      materialOwners.delete(object)
      objectMaterials.delete(object)
    }
  }

  function applyMaterialFallback(material: MaterialWithAo) {
    const previousCount = materialRefCounts.get(material)
    if (previousCount !== undefined) {
      materialRefCounts.set(material, previousCount + 1)
      return
    }

    const hasUsableAoMap = material.aoMap?.isTexture === true
    if (hasUsableAoMap) return

    const snapshot = createSnapshot(material)
    snapshots.set(material, snapshot)
    tracked.push(snapshot)
    materialRefCounts.set(material, 1)
    applyFallback(material)
  }

  function releaseObjectMaterials(object: Object3D) {
    const materials = objectMaterials.get(object)
    if (!materials) return

    for (const entry of materials) {
      releaseMaterialFallback(entry)
    }

    objectMaterials.delete(object)
  }

  function releaseMaterialFallback(material: Material) {
    const previousCount = materialRefCounts.get(material)
    if (previousCount === undefined) return

    if (previousCount > 1) {
      materialRefCounts.set(material, previousCount - 1)
      return
    }

    materialRefCounts.delete(material)

    const snapshot = snapshots.get(material)
    if (snapshot) {
      releaseSnapshot(snapshot)
    }
  }

  function createMaterialSet(material: Material | Material[]) {
    if (Array.isArray(material)) {
      return new Set(material)
    }

    return new Set([material])
  }

  function releaseSnapshot(snapshot: AoFallbackSnapshot) {
    restoreSnapshot(snapshot)
    snapshots.delete(snapshot.material)
    materialRefCounts.delete(snapshot.material)

    const index = tracked.indexOf(snapshot)
    if (index >= 0) {
      tracked.splice(index, 1)
    }
  }

  return { apply, refresh, restore }
}

function createSnapshot(material: MaterialWithAo): AoFallbackSnapshot {
  return {
    hadAoMap: Object.prototype.hasOwnProperty.call(material, "aoMap"),
    hadAoMapIntensity: Object.prototype.hasOwnProperty.call(material, "aoMapIntensity"),
    material,
    previousAoMap: material.aoMap,
    previousAoMapIntensity: material.aoMapIntensity,
  }
}

function applyFallback(material: MaterialWithAo) {
  material.aoMap = WHITE_AO_TEXTURE
  material.aoMapIntensity = 0
  material.needsUpdate = true
}

function restoreSnapshot(snapshot: AoFallbackSnapshot) {
  if (snapshot.hadAoMap) {
    snapshot.material.aoMap = snapshot.previousAoMap
  } else {
    delete snapshot.material.aoMap
  }

  if (snapshot.hadAoMapIntensity) {
    snapshot.material.aoMapIntensity = snapshot.previousAoMapIntensity
  } else {
    delete snapshot.material.aoMapIntensity
  }

  snapshot.material.needsUpdate = true
}
