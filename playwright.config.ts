import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: process.env.SIGNIA_TEST_URL ?? "http://127.0.0.1:5173",
    headless: true,
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    },
    viewport: { width: 1440, height: 960 },
  },
  reporter: [["list"]],
});
