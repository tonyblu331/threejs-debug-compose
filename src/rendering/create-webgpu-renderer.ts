import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from "three"
import { WebGPURenderer } from "three/webgpu"

type RendererFactoryProps = ConstructorParameters<typeof WebGPURenderer>[0]

const WEBGPU_PREFLIGHT_TIMEOUT_MS = 1_500
const RENDERER_INIT_TIMEOUT_MS = 5_000

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

async function hasUsableWebGpuAdapter() {
  if (typeof navigator === "undefined" || !("gpu" in navigator)) {
    return false
  }

  try {
    const adapter = await withTimeout(
      navigator.gpu.requestAdapter(),
      WEBGPU_PREFLIGHT_TIMEOUT_MS,
      null,
    )

    return adapter !== null
  } catch {
    return false
  }
}

async function createInitializedRenderer(props: RendererFactoryProps, forceWebGL: boolean) {
  const renderer = new WebGPURenderer({
    ...props,
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
    forceWebGL,
  })

  await renderer.init()

  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 2
  renderer.shadowMap.enabled = true
  renderer.shadowMap.transmitted = true
  renderer.shadowMap.type = PCFSoftShadowMap

  return renderer
}

export async function createWebGpuRenderer(props: RendererFactoryProps) {
  const shouldTryNativeWebGpu = await hasUsableWebGpuAdapter()

  if (!shouldTryNativeWebGpu) {
    return createInitializedRenderer(props, true)
  }

  try {
    const nativeRenderer = await withTimeout(createInitializedRenderer(props, false), RENDERER_INIT_TIMEOUT_MS, null)

    if (nativeRenderer) {
      return nativeRenderer
    }
  } catch {
    // Fall through to the same WebGPURenderer running its WebGL2 backend.
  }

  return createInitializedRenderer(props, true)
}
