import { chromium } from "@playwright/test"
import { mkdir } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const output = resolve(root, "capture", "breakdown-social-x.png")
const SQUARE_SIZE = 1080

async function resolveBaseURL() {
  if (process.env.CAPTURE_BASE_URL) return process.env.CAPTURE_BASE_URL

  for (const port of [3000, 3001]) {
    const url = `http://127.0.0.1:${port}`
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(750) })
      if (response.ok) return url
    } catch {
      // try next port
    }
  }

  return "http://127.0.0.1:3000"
}

async function configureDemo(page, baseURL) {
  await page.goto(`${baseURL}/?capture=social&scene=overdraw`, { waitUntil: "networkidle" })

  await page.waitForFunction(() => {
    const text = document.body.textContent ?? ""
    if (text.includes("WebGPU required")) return true
    return document.querySelector("canvas") !== null
  })

  if (await page.getByText("WebGPU required", { exact: true }).isVisible()) {
    throw new Error("WebGPU is required to capture the demo screenshot on this machine.")
  }

  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 30_000 })
  await page.getByText("Complexity", { exact: true }).waitFor({ state: "visible", timeout: 30_000 })
  await page.getByText("Albedo", { exact: true }).waitFor({ state: "visible", timeout: 10_000 })
  await page.waitForTimeout(2000)
}

async function hideChrome(page) {
  await page.addStyleTag({
    content: `
      [data-debug-view-leva],
      [aria-label="Demo scene"] {
        display: none !important;
      }
    `,
  })

  await page.evaluate(() => {
    for (const element of document.querySelectorAll("body *")) {
      const text = element.textContent?.trim() ?? ""
      if (/^Three\.js.*WebGPU/.test(text) && text.length < 48) {
        element.style.display = "none"
      }
    }
  })
}

async function screenshotSquareCanvas(page, path) {
  await page.screenshot({ path, type: "png", fullPage: false })
}

async function main() {
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    headless: true,
  })

  try {
    const page = await browser.newPage({
      viewport: { width: SQUARE_SIZE, height: SQUARE_SIZE },
      deviceScaleFactor: 2,
    })

    const baseURL = await resolveBaseURL()
    await configureDemo(page, baseURL)
    await page.waitForTimeout(500)
    await hideChrome(page)
    await page.waitForTimeout(1200)

    await mkdir(dirname(output), { recursive: true })
    await screenshotSquareCanvas(page, output)

    console.log(output)
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
