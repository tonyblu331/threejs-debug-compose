import { Suspense, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { OrbitControls, useGLTF, useProgress, Html } from "@react-three/drei"
import { HdrEnvironment } from "./HdrEnvironment"
import {
  DataTexture,
  DoubleSide,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RGBAFormat,
  RepeatWrapping,
  UnsignedByteType,
  type Group,
} from "three"

const DAMAGED_HELMET_URL = `${import.meta.env.BASE_URL}models/DamagedHelmet/glTF/DamagedHelmet.gltf`

// Preload the model immediately when the module is parsed
// This starts the fetch in parallel with everything else
useGLTF.preload(DAMAGED_HELMET_URL)

function Loader() {
  const { progress } = useProgress()
  return (
    <Html center>
      <div
        style={{
          color: "white",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          userSelect: "none",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 8 }}>
          Loading scene...
        </div>
        <div
          style={{
            width: 160,
            height: 4,
            background: "rgba(255,255,255,0.15)",
            borderRadius: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: "white",
              borderRadius: 0,
              transition: "width 0.2s ease",
            }}
          />
        </div>
        <div style={{ fontSize: 12, opacity: 0.5, marginTop: 8 }}>
          {progress.toFixed(0)}%
        </div>
      </div>
    </Html>
  )
}

function Helmet() {
  const ref = useRef<Group>(null!)
  const { scene } = useGLTF(DAMAGED_HELMET_URL)

  useFrame((_, delta) => {
    ref.current.rotation.y += delta * 0.5
  })

  return <primitive ref={ref} object={scene} position={[0, 0.55, 0]} scale={0.62} />
}

function createSolidTexture(r: number, g: number, b: number, a = 255, size = 512) {
  const data = new Uint8Array(size * size * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = a
  }

  const texture = new DataTexture(
    data,
    size,
    size,
    RGBAFormat,
    UnsignedByteType,
  )
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.needsUpdate = true
  return texture
}

function createStripeTexture(size = 1024) {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const stripe = (Math.sin((x + y * 0.45) * 0.045) + 1) * 0.5
      const ring = (Math.sin(Math.hypot(x - size * 0.5, y - size * 0.45) * 0.04) + 1) * 0.5
      const value = 72 + stripe * 84 + ring * 28
      data[i] = value
      data[i + 1] = value
      data[i + 2] = value
      data[i + 3] = 255
    }
  }

  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(1.4, 1.4)
  texture.needsUpdate = true
  return texture
}

function createNormalTexture(size = 1024) {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const ridge = Math.sin(x * 0.08) * Math.cos(y * 0.065)
      data[i] = 128 + ridge * 42
      data[i + 1] = 128 + Math.sin((x + y) * 0.04) * 32
      data[i + 2] = 190
      data[i + 3] = 255
    }
  }

  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(2, 2)
  texture.needsUpdate = true
  return texture
}

const textureSet = {
  albedo: createStripeTexture(),
  normal: createNormalTexture(),
  roughness: createSolidTexture(170, 170, 170, 255, 1024),
  metalness: createSolidTexture(45, 45, 45, 255, 1024),
  clearcoat: createSolidTexture(235, 235, 235, 255, 1024),
  transmission: createSolidTexture(225, 225, 225, 255, 1024),
  ao: createSolidTexture(180, 180, 180, 255, 1024),
  alpha: createSolidTexture(255, 255, 255, 190, 1024),
  emissive: createSolidTexture(210, 210, 210, 255, 1024),
}

const costSamples = [
  {
    label: "Basic",
    position: [-2.6, 0, 0] as const,
    material: new MeshBasicMaterial({
      color: "#f2f2f2",
      toneMapped: false,
    }),
  },
  {
    label: "Standard",
    position: [-1.3, 0, 0] as const,
    material: new MeshStandardMaterial({
      color: "#bdbdbd",
      roughness: 0.72,
      metalness: 0.05,
    }),
  },
  {
    label: "Mapped PBR",
    position: [0, 0, 0] as const,
    material: new MeshStandardMaterial({
      color: "#d8d8d8",
      map: textureSet.albedo,
      normalMap: textureSet.normal,
      roughnessMap: textureSet.roughness,
      metalnessMap: textureSet.metalness,
      roughness: 0.55,
      metalness: 0.25,
    }),
  },
  {
    label: "Layered",
    position: [1.3, 0, 0] as const,
    material: new MeshPhysicalMaterial({
      color: "#a6a6a6",
      clearcoat: 0.92,
      clearcoatMap: textureSet.clearcoat,
      envMapIntensity: 1.4,
      iridescence: 0.65,
      normalMap: textureSet.normal,
      roughness: 0.22,
      sheen: 0.7,
    }),
  },
  {
    label: "POM stack",
    position: [2.6, 0, 0] as const,
    material: new MeshPhysicalMaterial({
      alphaMap: textureSet.alpha,
      aoMap: textureSet.ao,
      clearcoat: 0.85,
      clearcoatMap: textureSet.clearcoat,
      color: "#e6e6e6",
      emissive: "#2a2a2a",
      emissiveIntensity: 0.18,
      emissiveMap: textureSet.emissive,
      envMapIntensity: 1.6,
      iridescence: 0.75,
      map: textureSet.albedo,
      metalness: 0.35,
      metalnessMap: textureSet.metalness,
      normalMap: textureSet.normal,
      opacity: 0.78,
      roughness: 0.16,
      roughnessMap: textureSet.roughness,
      side: DoubleSide,
      sheen: 0.8,
      transmission: 0.28,
      transmissionMap: textureSet.transmission,
      transparent: true,
    }),
  },
]

function ShaderCostSamples() {
  const group = useRef<Group>(null!)

  useFrame((_, delta) => {
    group.current.rotation.y = Math.sin(performance.now() * 0.00035) * 0.08
    group.current.rotation.x += delta * 0.03
  })

  return (
    <group ref={group} position={[0, -1.45, 0]}>
      {costSamples.map((sample) => (
        <group key={sample.label} position={sample.position}>
          <mesh material={sample.material}>
            <sphereGeometry args={[0.48, 72, 36]} />
          </mesh>
          <Html center position={[0, -0.74, 0]}>
            <span
              style={{
                background: "rgba(0, 0, 0, 0.64)",
                border: "1px solid rgba(255, 255, 255, 0.18)",
                borderRadius: 0,
                color: "white",
                fontFamily: "monospace",
                fontSize: 10,
                letterSpacing: "0.04em",
                padding: "4px 6px",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {sample.label}
            </span>
          </Html>
        </group>
      ))}
    </group>
  )
}

export function Scene() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[5, 5, 5]}
        intensity={2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      <OrbitControls enableDamping />

      <Suspense fallback={<Loader />}>
        <HdrEnvironment />
        <Helmet />
        <ShaderCostSamples />
      </Suspense>
    </>
  )
}
