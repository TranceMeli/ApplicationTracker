import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from '@playwright/test'

// The browser tests run against their own backend with a throw-away database and upload folder, so the real data is
// never touched. Both servers start by themselves (and stop again); ports are chosen to not collide with a running
// tracker on 8000 / 5173 (E2E_WEB_PORT and E2E_API_PORT change them when something else uses these ports).
const API_PORT = Number(process.env.E2E_API_PORT ?? 8021)
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 5190)
const dataDir = process.env.TRACKER_E2E_DATA ?? mkdtempSync(join(tmpdir(), 'tracker-e2e-'))
const python = process.env.PYTHON ?? 'python'

export default defineConfig({
  testDir: 'e2e',
  // One shared database: tests clear it before they start, so they must not run at the same time.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: 'de-DE',
    viewport: { width: 1280, height: 900 },
    // Microsoft Edge is used because it is on every Windows machine; set E2E_BROWSER=chromium after
    // `npx playwright install chromium` to use the bundled one instead.
    channel: process.env.E2E_BROWSER === 'chromium' ? undefined : 'msedge',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: `${python} manage.py migrate --noinput && ${python} manage.py runserver ${API_PORT} --noreload`,
      cwd: '../backend',
      env: { TRACKER_DATA_DIR: dataDir },
      url: `http://localhost:${API_PORT}/api/applications/`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      env: { API_URL: `http://localhost:${API_PORT}` },
      url: `http://localhost:${WEB_PORT}/`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
