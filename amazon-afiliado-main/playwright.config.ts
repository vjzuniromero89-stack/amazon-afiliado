import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://localhost:3010",
    browserName: "chromium",
    channel: process.env.TEST_BROWSER_CHANNEL,
  },
  workers: 1,
  reporter: "list",
});
