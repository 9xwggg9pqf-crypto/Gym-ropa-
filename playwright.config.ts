import { defineConfig, devices } from '@playwright/test'

// Pruebas de humo y accesibilidad sobre la app compilada (ejecuta `npm run build` antes).
const launchOptions = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3100' },
  webServer: { command: 'npm run start -- -p 3100', url: 'http://localhost:3100', reuseExistingServer: true, timeout: 60_000 },
  projects: [
    { name: 'movil', use: { ...devices['Pixel 7'], launchOptions } },
    { name: 'escritorio-oscuro', use: { ...devices['Desktop Chrome'], colorScheme: 'dark', launchOptions } },
  ],
})
