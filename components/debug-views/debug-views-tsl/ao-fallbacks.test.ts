import { describe, expect, it } from "vitest"
import { Mesh, MeshStandardMaterial, Scene } from "three"
import { createAoFallbacks } from "./ao-fallbacks"

describe("ao fallbacks", () => {
  it("can apply again after restore", () => {
    const scene = new Scene()
    const material = new MeshStandardMaterial()
    scene.add(new Mesh(undefined, material))

    const fallbacks = createAoFallbacks(scene)

    fallbacks.apply()
    expect(material.aoMap?.isTexture).toBe(true)

    fallbacks.restore()
    expect(material.aoMap).toBeNull()

    fallbacks.apply()
    expect(material.aoMap?.isTexture).toBe(true)
  })

  it("patches materials added while AO fallback is active", () => {
    const scene = new Scene()
    const material = new MeshStandardMaterial()
    const fallbacks = createAoFallbacks(scene)

    fallbacks.apply()
    scene.add(new Mesh(undefined, material))

    expect(material.aoMap?.isTexture).toBe(true)

    fallbacks.restore()
    expect(material.aoMap).toBeNull()
  })

  it("patches material replacements while AO fallback is active", () => {
    const scene = new Scene()
    const mesh = new Mesh(undefined, new MeshStandardMaterial())
    const replacement = new MeshStandardMaterial()
    scene.add(mesh)

    const fallbacks = createAoFallbacks(scene)

    fallbacks.apply()
    mesh.material = replacement
    fallbacks.refresh()

    expect(replacement.aoMap?.isTexture).toBe(true)

    fallbacks.restore()
    expect(replacement.aoMap).toBeNull()
  })

  it("stops watching material owners after removal", () => {
    const scene = new Scene()
    const mesh = new Mesh(undefined, new MeshStandardMaterial())
    const replacement = new MeshStandardMaterial()
    scene.add(mesh)

    const fallbacks = createAoFallbacks(scene)

    fallbacks.apply()
    scene.remove(mesh)
    mesh.material = replacement
    fallbacks.refresh()

    expect(replacement.aoMap).toBeNull()
  })

  it("restores patched materials when their owner is removed", () => {
    const scene = new Scene()
    const material = new MeshStandardMaterial()
    const mesh = new Mesh(undefined, material)
    scene.add(mesh)

    const fallbacks = createAoFallbacks(scene)

    fallbacks.apply()
    expect(material.aoMap?.isTexture).toBe(true)

    scene.remove(mesh)

    expect(material.aoMap).toBeNull()
  })

  it("restores replaced materials when their owner is removed before refresh", () => {
    const scene = new Scene()
    const original = new MeshStandardMaterial()
    const replacement = new MeshStandardMaterial()
    const mesh = new Mesh(undefined, original)
    scene.add(mesh)

    const fallbacks = createAoFallbacks(scene)

    fallbacks.apply()
    expect(original.aoMap?.isTexture).toBe(true)

    mesh.material = replacement
    scene.remove(mesh)

    expect(original.aoMap).toBeNull()
    expect(replacement.aoMap).toBeNull()
  })

  it("keeps shared patched materials active until the last owner is removed", () => {
    const scene = new Scene()
    const material = new MeshStandardMaterial()
    const first = new Mesh(undefined, material)
    const second = new Mesh(undefined, material)
    scene.add(first, second)

    const fallbacks = createAoFallbacks(scene)

    fallbacks.apply()
    scene.remove(first)

    expect(material.aoMap?.isTexture).toBe(true)

    scene.remove(second)

    expect(material.aoMap).toBeNull()
  })
})
