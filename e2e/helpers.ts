import { type Browser, expect, type Page, type TestInfo } from "@playwright/test";

export const ADMIN = { email: process.env.E2E_ADMIN_EMAIL ?? "admin@ciaschool.edu.kh", password: process.env.E2E_ADMIN_PASSWORD ?? "ChangeMe-DevOnly-123!" };
export const AGENT = { email: "agent@ciaschool.edu.kh", password: process.env.E2E_SAMPLE_PASSWORD ?? "Sample-DevOnly-123!" };
export const STUDENT = { email: process.env.E2E_REQUESTER_EMAIL ?? "student@ciaschool.edu.kh", password: process.env.E2E_REQUESTER_PASSWORD ?? "Sample-DevOnly-123!" };
// Campus admin of SS1 with "Manage users & agents", and an agent who only works at SS2.
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

// Ticket controls are always shown; this just waits for them.
export async function openTicketPanel(page: Page) {
  await expect(page.getByLabel("Status")).toBeVisible();
}

// People, Tasks and Linked tickets are collapsed sections on the staff ticket page.
export async function openTicketSection(page: Page, name: "People on this ticket" | "Tasks" | "Linked tickets") {
  const section = page.locator("details").filter({ has: page.locator("summary", { hasText: name }) });
  if (!(await section.getAttribute("open").then((v) => v !== null))) await section.locator("summary").click();
}

export async function shot(page: Page, testInfo: TestInfo, name: string) {
  if (testInfo.project.name !== "iphone") return;
  // Chromium refuses screenshots over 32767px on a side, which a long queue reaches at 3x.
  const pixelHeight = await page.evaluate(() => document.documentElement.scrollHeight * window.devicePixelRatio);
  await page.screenshot({ path: `test-results/screens/${name}.png`, fullPage: pixelHeight < 32_000 });
}

export async function fillNewTicket(page: Page, details: { topic: string; campus: string; room: string; subject: string; body: string; file?: { name: string; mimeType: string; buffer: Buffer } }) {
  await page.goto("/tickets/new");
  await page.getByRole("radio", { name: details.topic }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: details.campus }).check();
  await page.getByLabel("Room").fill(details.room);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Issue summary").fill(details.subject);
  await page.getByLabel("Please describe your issue").fill(details.body);
  await page.getByRole("button", { name: "Continue" }).click();
  if (details.file) await page.locator('input[type="file"][name="files"]').setInputFiles(details.file);
}
