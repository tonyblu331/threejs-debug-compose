import { useEffect, useState, type CSSProperties, type ReactNode } from "react"
import { Canvas, type CanvasProps } from "@react-three/fiber"
import { createWebGpuRenderer, hasUsableWebGpuAdapter } from "@/src/rendering/create-webgpu-renderer"

const webGpuRendererFactory: NonNullable<CanvasProps["gl"]> = ({ powerPreference: _powerPreference, ...props }) =>
  createWebGpuRenderer(props as Parameters<typeof createWebGpuRenderer>[0])

interface WebGpuCanvasProps {
  children: ReactNode
  camera?: CanvasProps["camera"]
  onCreated?: CanvasProps["onCreated"]
  onSupportChange?: (support: WebGpuSupport) => void
}

type WebGpuSupport = "checking" | "ready" | "unsupported"

export function WebGpuCanvas({ children, camera, onCreated, onSupportChange }: WebGpuCanvasProps) {
  const [support, setSupport] = useState<WebGpuSupport>("checking")

  useEffect(() => {
    onSupportChange?.(support)
  }, [onSupportChange, support])

  useEffect(() => {
    let cancelled = false

    hasUsableWebGpuAdapter()
      .then((available) => {
        if (!cancelled) setSupport(available ? "ready" : "unsupported")
      })
      .catch(() => {
        if (!cancelled) setSupport("unsupported")
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (support !== "ready") {
    return (
      <div style={webGpuGateStyle}>
        <div style={webGpuGatePanelStyle}>
          <div style={webGpuGateTitleStyle}>
            {support === "checking" ? "Checking WebGPU" : "WebGPU required"}
          </div>
          <div style={webGpuGateBodyStyle}>
            {support === "checking"
              ? "Detecting a native GPU adapter before starting the debug renderer."
              : "This demo uses native WebGPU debug passes and does not run when Three.js initializes WebGL2 instead."}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Canvas gl={webGpuRendererFactory} camera={camera} onCreated={onCreated}>
      {children}
    </Canvas>
  )
}

const webGpuGateStyle: CSSProperties = {
  alignItems: "center",
  background: "#090d09",
  color: "#f2f0e8",
  display: "flex",
  fontFamily: "Inter, system-ui, sans-serif",
  inset: 0,
  justifyContent: "center",
  position: "fixed",
}

const webGpuGatePanelStyle: CSSProperties = {
  border: "1px solid rgba(242, 240, 232, 0.22)",
  borderRadius: 8,
  maxWidth: 420,
  padding: 24,
}

const webGpuGateTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  marginBottom: 8,
}

const webGpuGateBodyStyle: CSSProperties = {
  color: "rgba(242, 240, 232, 0.76)",
  fontSize: 14,
  lineHeight: 1.5,
}
