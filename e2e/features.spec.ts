import { expect, type Page, test } from "@playwright/test";
import { ADMIN, AGENT, fillNewTicket, sessionFor, shot, STUDENT } from "./helpers";

async function openTicket(student: Page, subject: string) {
  await fillNewTicket(student, { topic: "Student Wifi", campus: "Main Campus", room: "101", subject, body: "Details." });
  await student.getByRole("button", { name: "Submit ticket" }).click();
  await student.waitForURL(/\/tickets\/TKT-\d{6}\?created=1/);
  return student.url().match(/TKT-\d{6}/)![0];
}

test("superadmin bulk-assigns tickets from the queue", async ({ browser }, testInfo) => {
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const student = await sessionFor(browser, testInfo, STUDENT);
  const first = await openTicket(student, `Bulk A ${stamp}`);
  const second = await openTicket(student, `Bulk B ${stamp}`);

  const admin = await sessionFor(browser, testInfo, ADMIN);
  await admin.goto(`/staff?view=all&q=${encodeURIComponent(stamp)}`);
  // Phones and desktop render different rows; tick the visible box for each ticket.
  await admin.getByLabel(`Select ${first}`).filter({ visible: true }).check();
  await admin.getByLabel(`Select ${second}`).filter({ visible: true }).check();
  await expect(admin.getByText("2 selected")).toBeVisible();
  await shot(admin, testInfo, "20-bulk-select");
  await admin.getByRole("button", { name: "Bulk actions" }).click();
  await admin.getByRole("menuitem", { name: "Assign to me" }).click();
  await expect(admin.getByText("Updated 2 tickets.")).toBeVisible();

  await admin.goto(`/staff/tickets/${first}`);
  await expect(admin.getByRole("list", { name: "Conversation" }).getByText(/Assigned to /)).toBeVisible();
});

test("requester can browse Help", async ({ browser }, testInfo) => {
  const student = await sessionFor(browser, testInfo, STUDENT);
  await student.goto("/help?q=password");
  await student.getByRole("link", { name: /Reset a forgotten password/ }).click();
  await expect(student.getByRole("heading", { name: "Reset a forgotten password" })).toBeVisible();
  await expect(student.getByRole("link", { name: "Open a ticket" })).toBeVisible();
});

test("theme choice persists across reloads", async ({ browser }, testInfo) => {
  const student = await sessionFor(browser, testInfo, STUDENT);
  await expect(student.locator("html")).toHaveAttribute("data-theme", "dark");
  await student.getByRole("button", { name: /Account menu for/ }).click();
  await student.getByRole("menuitemradio", { name: "Light" }).click();
  await expect(student.locator("html")).toHaveAttribute("data-theme", "light");
  await student.reload();
  await expect(student.locator("html")).toHaveAttribute("data-theme", "light");
  await shot(student, testInfo, "22-light-theme");
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
