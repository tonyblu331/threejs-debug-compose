import { Suspense, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { OrbitControls, useGLTF, useProgress, Html } from "@react-three/drei"
import { HdrEnvironment } from "./HdrEnvironment"
import {
  DataTexture,
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
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: "white",
              borderRadius: 2,
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

function createSolidTexture(r: number, g: number, b: number, a = 255) {
  const texture = new DataTexture(
    new Uint8Array([r, g, b, a]),
    1,
    1,
    RGBAFormat,
    UnsignedByteType,
  )
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.needsUpdate = true
  return texture
}

const costSampleMaterials = {
  cheap: new MeshBasicMaterial({
    color: "#7ee787",
    toneMapped: false,
  }),
  standard: new MeshStandardMaterial({
    color: "#f2cc60",
    roughness: 0.7,
    metalness: 0.05,
  }),
  mapped: new MeshStandardMaterial({
    color: "#7aa2f7",
    map: createSolidTexture(110, 160, 255),
    normalMap: createSolidTexture(128, 128, 255),
    roughnessMap: createSolidTexture(180, 180, 180),
    metalnessMap: createSolidTexture(40, 40, 40),
    roughness: 0.55,
    metalness: 0.25,
  }),
  transparent: new MeshPhysicalMaterial({
    color: "#ff7b72",
    alphaMap: createSolidTexture(255, 255, 255, 180),
    clearcoat: 0.75,
    envMapIntensity: 1.2,
    opacity: 0.7,
    roughness: 0.18,
    transmission: 0.35,
    transparent: true,
  }),
}

function ShaderCostSamples() {
  return (
    <group position={[0, -1.2, 0]}>
      <mesh position={[-0.72, 0, 0]} material={costSampleMaterials.cheap}>
        <boxGeometry args={[0.32, 0.32, 0.32]} />
      </mesh>
      <mesh position={[-0.24, 0, 0]} material={costSampleMaterials.standard}>
        <sphereGeometry args={[0.23, 32, 16]} />
      </mesh>
      <mesh position={[0.28, 0, 0]} material={costSampleMaterials.mapped}>
        <torusKnotGeometry args={[0.18, 0.06, 96, 12]} />
      </mesh>
      <mesh position={[0.82, 0, 0]} material={costSampleMaterials.transparent}>
        <icosahedronGeometry args={[0.26, 1]} />
      </mesh>
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
