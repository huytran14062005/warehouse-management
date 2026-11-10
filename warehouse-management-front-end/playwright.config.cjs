const { defineConfig } = require('@playwright/test');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
const { existsSync } = require('node:fs');

if (process.env.E2E_ALLOW_WRITES !== '1' || process.env.E2E_TARGET !== 'local') {
  throw new Error('Local E2E requires E2E_ALLOW_WRITES=1 and E2E_TARGET=local');
}
if (process.env.DATABASE_URL || process.env.DB_HOST || process.env.DB_NAME) {
  throw new Error('Unset DATABASE_URL, DB_HOST and DB_NAME before local E2E');
}

process.env.E2E_RUN_ID ||= randomBytes(12).toString('hex');
const venvPython = path.resolve(__dirname, '..', '.venv', process.platform === 'win32'
  ? 'Scripts/python.exe' : 'bin/python');
const python = process.env.E2E_PYTHON || (existsSync(venvPython) ? venvPython : 'python');
const server = path.resolve(__dirname, '..', 'tests', 'e2e_server.py');
const frontendServer = path.resolve(__dirname, '..', 'tests', 'e2e_frontend.py');

module.exports = defineConfig({
  testDir: './e2e',
  testMatch: '*.spec.js',
  timeout: 90000,
  expect: { timeout: 10000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e-report.json' }]],
  outputDir: './test-results/e2e',
  use: {
    actionTimeout: 10000,
    navigationTimeout: 60000,
    reducedMotion: 'reduce',
    baseURL: 'http://127.0.0.1:3107/warehouse-management',
    browserName: 'chromium',
    channel: process.env.E2E_CHROME_CHANNEL || 'chrome',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: process.env.E2E_EXTERNAL_SERVERS === '1' ? undefined : [
    {
      command: `"${python}" "${server}"`,
      cwd: path.resolve(__dirname, '..'),
      url: 'http://127.0.0.1:5107/api/products/inventory',
      reuseExistingServer: false,
      timeout: 30000,
      stderr: 'ignore',
      env: { APP_ENV: 'test', E2E_TARGET: 'local', E2E_ALLOW_WRITES: '1',
        E2E_RUN_ID: process.env.E2E_RUN_ID },
    },
    {
      command: `"${python}" "${frontendServer}"`,
      cwd: __dirname,
      url: 'http://127.0.0.1:3107/warehouse-management/login',
      reuseExistingServer: false,
      timeout: 180000,
      stderr: 'ignore',
      env: { E2E_TARGET: 'local', E2E_ALLOW_WRITES: '1' },
    },
  ],
});
