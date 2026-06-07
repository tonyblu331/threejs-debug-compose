import { Leva } from "leva"

const neutralLevaTheme = {
  colors: {
    elevation1: "#050505",
    elevation2: "#111111",
    elevation3: "#1c1c1c",
    accent1: "#2a2a2a",
    accent2: "#d8d8d8",
    accent3: "#ffffff",
    highlight1: "#7a7a7a",
    highlight2: "#d8d8d8",
    highlight3: "#ffffff",
    vivid1: "#ffffff",
  },
  radii: {
    xs: "0px",
    sm: "0px",
    lg: "0px",
  },
  shadows: {
    level1: "none",
    level2: "none",
  },
}

export function DebugControls() {
  return <Leva collapsed={false} theme={neutralLevaTheme} />
}
