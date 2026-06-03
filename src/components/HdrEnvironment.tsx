import { Environment } from "@react-three/drei"

interface HdrEnvironmentProps {
  files?: string
  environmentIntensity?: number
}

const DEFAULT_HDR_PATH = `${import.meta.env.BASE_URL}textures/quarry_01_1k.hdr`

export function HdrEnvironment({
  files = DEFAULT_HDR_PATH,
  environmentIntensity = 1,
}: HdrEnvironmentProps) {
  return (
    <Environment
      files={files}
      environmentIntensity={environmentIntensity}
    />
  )
}
