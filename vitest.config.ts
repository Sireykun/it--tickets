import path from "node:path";
import { defineConfig } from "vitest/config";

// Tests run against a separate database so they never touch dev data.
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? (process.env.DATABASE_URL ?? "").replace(/\/ticketdb(\?|$)/, "/ticketdb_test$1");

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: "./tests/global-setup.ts",
    fileParallelism: false,
    env: {
      DATABASE_URL: testDatabaseUrl,
      UPLOAD_DIR: "/tmp/ticket-test-uploads",
      // The email token key comes from the container environment (docker-compose.yml).
      EMAIL_OUTBOUND: "on",
      HELPDESK_ADDRESS: "helpdesk@ciaschool.edu.kh",
      ALLOWED_EMAIL_DOMAIN: "ciaschool.edu.kh",
      APP_URL: "https://helpdesk.test",
      INBOUND_HELP_TOPIC: "Other",
    },
  },
});
