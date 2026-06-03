import { type ReactNode } from "react"
import { Canvas, type CanvasProps } from "@react-three/fiber"
import { createWebGpuRenderer } from "@/src/rendering/create-webgpu-renderer"

const webGpuRendererFactory: NonNullable<CanvasProps["gl"]> = ({ powerPreference: _powerPreference, ...props }) =>
  createWebGpuRenderer(props as Parameters<typeof createWebGpuRenderer>[0])

interface WebGpuCanvasProps {
  children: ReactNode
  camera?: CanvasProps["camera"]
  onCreated?: CanvasProps["onCreated"]
}

export function WebGpuCanvas({ children, camera, onCreated }: WebGpuCanvasProps) {
  return (
    <Canvas gl={webGpuRendererFactory} camera={camera} onCreated={onCreated}>
      {children}
    </Canvas>
  )
}
