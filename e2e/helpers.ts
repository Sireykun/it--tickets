import { type Browser, expect, type Page, type TestInfo } from "@playwright/test";

export const ADMIN = { email: process.env.E2E_ADMIN_EMAIL ?? "admin@ciaschool.edu.kh", password: process.env.E2E_ADMIN_PASSWORD ?? "ChangeMe-DevOnly-123!" };
export const AGENT = { email: "agent@ciaschool.edu.kh", password: process.env.E2E_SAMPLE_PASSWORD ?? "Sample-DevOnly-123!" };
export const STUDENT = { email: process.env.E2E_REQUESTER_EMAIL ?? "student@ciaschool.edu.kh", password: process.env.E2E_REQUESTER_PASSWORD ?? "Sample-DevOnly-123!" };
// Campus admin of Main Campus with "Manage users & agents", and an agent who only works at Campus 2.
export const CAMPUS_ADMIN = { email: "campusadmin@ciaschool.edu.kh", password: process.env.E2E_SAMPLE_PASSWORD ?? "Sample-DevOnly-123!" };
export const AGENT2 = { email: "agent2@ciaschool.edu.kh", password: process.env.E2E_SAMPLE_PASSWORD ?? "Sample-DevOnly-123!" };

// 1×1 PNG, enough to exercise image upload and inline rendering.
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export async function login(page: Page, who: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login") && url.pathname !== "/go");
}

// Each user gets their own browser context (separate cookies) with the project's device settings.
export async function sessionFor(browser: Browser, testInfo: TestInfo, who: { email: string; password: string }) {
  const context = await browser.newContext(testInfo.project.use);
  const page = await context.newPage();
  await login(page, who);
  return page;
}

// Staff controls and side panels open from one compact ticket-tools shortcut.
export async function openTicketPanel(page: Page) {
  const toggle = page.locator("summary").filter({ hasText: "Ticket tools" });
  await toggle.click();
  await expect(page.getByLabel("Status")).toBeVisible();
}

export async function shot(page: Page, testInfo: TestInfo, name: string) {
  if (testInfo.project.name !== "iphone") return;
  await page.screenshot({ path: `test-results/screens/${name}.png`, fullPage: true });
}

export async function fillNewTicket(page: Page, details: { topic: string; campus: string; room: string; subject: string; body: string; file?: { name: string; mimeType: string; buffer: Buffer } }) {
  await page.goto("/tickets/new");
  await page.getByRole("combobox", { name: "Help topic" }).selectOption({ label: details.topic });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("combobox", { name: "Campus" }).selectOption({ label: details.campus });
  await page.getByLabel("Room").fill(details.room);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Issue summary").fill(details.subject);
  await page.getByLabel("Please describe your issue").fill(details.body);
  await page.getByRole("button", { name: "Continue" }).click();
  if (details.file) await page.locator('input[type="file"][name="files"]').setInputFiles(details.file);
}
