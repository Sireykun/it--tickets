import { expect, type Page, test } from "@playwright/test";
import { ADMIN, AGENT, fillNewTicket, sessionFor, shot, STUDENT } from "./helpers";

async function openTicket(student: Page, subject: string) {
  await fillNewTicket(student, { topic: "Student Wifi", campus: "Main Campus", room: "101", subject, body: "Details." });
  await student.getByRole("button", { name: "Submit ticket" }).click();
  await student.waitForURL(/\/tickets\/TKT-\d{6}\?created=1/);
  return student.url().match(/TKT-\d{6}/)![0];
}

test("staff queue opens ticket cards without selection controls", async ({ browser }, testInfo) => {
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const student = await sessionFor(browser, testInfo, STUDENT);
  const ticket = await openTicket(student, `Queue card ${stamp}`);

  const admin = await sessionFor(browser, testInfo, ADMIN);
  await admin.goto(`/staff?view=all&q=${encodeURIComponent(stamp)}`);
  await expect(admin.getByRole("checkbox")).toHaveCount(0);
  const card = admin.getByRole("link", { name: new RegExp(ticket) });
  await expect(card).toBeVisible();
  await shot(admin, testInfo, "20-queue-cards");
  await card.click();
  await expect(admin).toHaveURL(new RegExp(`/staff/tickets/${ticket}$`));
});

test("requester can browse Help", async ({ browser }, testInfo) => {
  const student = await sessionFor(browser, testInfo, STUDENT);
  await student.goto("/help?q=password");
  await student.getByRole("link", { name: /Reset a forgotten password/ }).click();
  await expect(student.getByRole("heading", { name: "Reset a forgotten password" })).toBeVisible();
  await expect(student.getByRole("link", { name: "Open a ticket" })).toBeVisible();
});

test("theme choice is saved on the account", async ({ browser }, testInfo) => {
  // One account per device project: both run at once and would overwrite each other's choice.
  const who = testInfo.project.name === "iphone" ? AGENT : STUDENT;
  const student = await sessionFor(browser, testInfo, who);
  // Settings has the picker on every layout (the account dropdown is only in some headers).
  const pick = async (name: string) => {
    await student.goto("/account");
    const saved = student.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/account"));
    await student.locator("label", { has: student.getByRole("radio", { name, exact: true }) }).click();
    await expect(student.locator("html")).toHaveAttribute("data-theme", name.toLowerCase());
    expect((await saved).ok()).toBe(true);
  };
  await pick("Light");
  await student.reload();
  await expect(student.locator("html")).toHaveAttribute("data-theme", "light");
  await shot(student, testInfo, "22-light-theme");

  // A fresh browser (no theme cookie) gets the same choice after signing in.
  const elsewhere = await sessionFor(browser, testInfo, who);
  await expect(elsewhere.locator("html")).toHaveAttribute("data-theme", "light");

  // Back to the default so other runs start from it.
  await pick("System");
});

test("reports are for superadmins only", async ({ browser }, testInfo) => {
  const admin = await sessionFor(browser, testInfo, ADMIN);
  await admin.goto("/staff/reports");
  await expect(admin.getByRole("heading", { name: "Reports" })).toBeVisible();
  await expect(admin.getByText("New vs resolved per day")).toBeVisible();
  await shot(admin, testInfo, "23-reports");
  expect((await admin.request.get("/staff/reports/export?days=7")).headers()["content-type"]).toContain("text/csv");

  const agent = await sessionFor(browser, testInfo, AGENT);
  await agent.goto("/staff/reports");
  await expect(agent).toHaveURL(/\/staff$/);
  expect((await agent.request.get("/staff/reports/export")).status()).toBe(404);
});
