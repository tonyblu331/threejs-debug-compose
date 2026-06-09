import { clamp, float, mix, vec4 } from "three/tsl"
import type { FloatNode, Vec3Node, Vec4Node } from "./node-types"

const DEFAULT_DEPTH_SCALE = 0.1

export function visualizeNormal(normalNode: Vec3Node | Vec4Node): Vec4Node {
  const n3 = normalNode.xyz
  const color = n3.mul(0.5).add(0.5)

  return vec4(color.x, color.y, color.z, 1)
}

export function visualizeGrayscale(
  floatNode: FloatNode,
  scale = float(1),
  bias = float(0),
): Vec4Node {
  const v = clamp(floatNode.mul(scale).add(bias), 0, 1)
  return vec4(v, v, v, 1)
}

export function visualizeDepth(
  viewDepthNode: FloatNode,
  scale = float(DEFAULT_DEPTH_SCALE),
  bias = float(0),
): Vec4Node {
  const normalized = clamp(viewDepthNode.mul(scale).add(bias), 0, 1)
  const inverted = float(1).sub(normalized)

  return vec4(inverted, inverted, inverted, 1)
}

export function visualizeHeatmap(
  costNode: FloatNode,
  scale = float(1),
  bias = float(0),
): Vec4Node {
  const cost = clamp(costNode.mul(scale).add(bias), 0, 1)
  const green = vec4(0, 1, 0.12, 1)
  const yellow = vec4(1, 0.9, 0, 1)
  const red = vec4(1, 0.05, 0, 1)
  const white = vec4(1, 1, 1, 1)

  const greenToYellow = clamp(cost.sub(0.25).mul(2.857143), 0, 1)
  const yellowToRed = clamp(cost.sub(0.6).mul(3.333333), 0, 1)
  const redToWhite = clamp(cost.sub(0.9).mul(10), 0, 1)

  const low = mix(green, yellow, greenToYellow)
  const high = mix(yellow, red, yellowToRed)
  const extreme = mix(red, white, redToWhite)
  const heat = cost.lessThan(0.6).select(
    low,
    cost.lessThan(0.9).select(high, extreme),
  )

  return cost.lessThan(0.001).select(vec4(0, 0, 0, 1), heat)
}

/** UE5-style light complexity: black → blue → cyan → yellow → red → white. */
export function visualizeLightComplexityHeatmap(
  costNode: FloatNode,
  scale = float(1),
  bias = float(0),
): Vec4Node {
  const cost = clamp(costNode.mul(scale).add(bias), 0, 1)
  const black = vec4(0, 0, 0, 1)
  const blue = vec4(0.125, 0.376, 1, 1)
  const cyan = vec4(0, 0.831, 1, 1)
  const yellow = vec4(1, 0.94, 0, 1)
  const red = vec4(1, 0.05, 0, 1)
  const white = vec4(1, 1, 1, 1)

  const blackToBlue = clamp(cost.sub(0.06).mul(8.333333), 0, 1)
  const blueToCyan = clamp(cost.sub(0.18).mul(5.555556), 0, 1)
  const cyanToYellow = clamp(cost.sub(0.36).mul(5), 0, 1)
  const yellowToRed = clamp(cost.sub(0.56).mul(4.545455), 0, 1)
  const redToWhite = clamp(cost.sub(0.78).mul(4.545455), 0, 1)

  const cool = mix(blue, cyan, blueToCyan)
  const warm = mix(yellow, red, yellowToRed)
  const extreme = mix(red, white, redToWhite)
  const heat = cost.lessThan(0.18).select(
    mix(black, blue, blackToBlue),
    cost.lessThan(0.36).select(
      cool,
      cost.lessThan(0.56).select(
        mix(cyan, yellow, cyanToYellow),
        cost.lessThan(0.78).select(warm, extreme),
      ),
    ),
  )

  return cost.lessThan(0.001).select(black, heat)
}
