import { execSync } from "node:child_process";

// Rebuild the test database from migrations and seed it once per run.
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? (process.env.DATABASE_URL ?? "").replace(/\/ticketdb(\?|$)/, "/ticketdb_test$1");
  if (!url.includes("_test")) throw new Error(`Refusing to reset a non-test database: ${url}`);
  const env = { ...process.env, DATABASE_URL: url };
  execSync("npx prisma migrate reset --force", { env, stdio: "inherit" });
  execSync("npx prisma db seed", { env, stdio: "inherit" });
}
