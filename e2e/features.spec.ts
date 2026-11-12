import { expect, type Page, test } from "@playwright/test";
import { ADMIN, AGENT, CAMPUS_ADMIN, fillNewTicket, sessionFor, shot, STUDENT } from "./helpers";

async function openTicket(student: Page, subject: string) {
  await fillNewTicket(student, { topic: "Student Wifi", campus: "SS1", room: "101", subject, body: "Details." });
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

  // Choosing a topic on a new ticket offers that topic's guides first.
  await student.goto("/tickets/new");
  const guides = student.getByRole("complementary", { name: "These guides might fix it" });
  await expect(guides).toHaveCount(0);
  await student.getByRole("radio", { name: "Student Wifi" }).check();
  await expect(guides.getByRole("link", { name: /Connect to the student Wi.Fi/ })).toHaveAttribute("target", "_blank");
});

test("theme choice persists across reloads", async ({ browser }, testInfo) => {
  const student = await sessionFor(browser, testInfo, STUDENT);
  await expect(student.locator("html")).toHaveAttribute("data-theme", "dark");
  await student.goto("/account");
  await student.getByRole("group", { name: "Theme" }).getByText("Light", { exact: true }).click();
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

test("superadmin can force a holiday theme on the staff console and login page", async ({ browser }, testInfo) => {
  const admin = await sessionFor(browser, testInfo, ADMIN);
  await admin.goto("/staff/admin/holidays");
  await admin.getByLabel("Holiday theme").selectOption("bon-om-touk");
  await admin.getByRole("button", { name: "Save" }).click();
  await admin.waitForURL(/\/staff\/admin\/holidays\?saved=1/);

  try {
    await admin.goto("/staff");
    const banner = admin.getByRole("region", { name: "Water Festival" });
    await expect(banner).toContainText("Happy Water Festival");
    await shot(admin, testInfo, "30-holiday-staff");
    await banner.getByRole("button", { name: "Dismiss holiday greeting" }).click();
    await expect(banner).toBeHidden();
    await admin.reload();
    await expect(admin.getByRole("region", { name: "Water Festival" })).toBeHidden();

    const guest = await (await browser.newContext(testInfo.project.use)).newPage();
    await guest.goto("/login");
    await expect(guest.getByText("Happy Water Festival")).toBeVisible();
    await shot(guest, testInfo, "31-holiday-login");
  } finally {
    await admin.goto("/staff/admin/holidays");
    await admin.getByLabel("Holiday theme").selectOption("auto");
    await admin.getByRole("button", { name: "Save" }).click();
    await admin.waitForURL(/\/staff\/admin\/holidays\?saved=1/);
  }
});

test("superadmin posts an announcement that requesters see until it is taken down", async ({ browser }, testInfo) => {
  const title = `Wi-Fi down ${testInfo.project.name}-${Date.now()}`;
  const admin = await sessionFor(browser, testInfo, ADMIN);
  await admin.goto("/staff/admin/announcements?edit=new");
  await admin.getByLabel("Title").fill(title);
  await admin.getByLabel("Type").selectOption("outage");
  await admin.getByLabel("Message").fill("Building B has no Wi-Fi. We expect it back by noon.");
  await admin.getByRole("button", { name: "Post" }).click();
  await admin.waitForURL(/announcements\?saved=1/);

  const student = await sessionFor(browser, testInfo, STUDENT);
  await student.goto("/");
  const status = student.getByRole("region", { name: "IT status" });
  await expect(status.getByText(title)).toBeVisible();
  await expect(status.getByText("We expect it back by noon.")).toBeVisible();
  await shot(student, testInfo, "32-announcement");

  // Campus admins can't manage announcements.
  const cadmin = await sessionFor(browser, testInfo, CAMPUS_ADMIN);
  await cadmin.goto("/staff/admin/announcements");
  await expect(cadmin).toHaveURL(/\/staff$/);

  await admin.getByRole("link", { name: new RegExp(title) }).click();
  await admin.getByRole("button", { name: "Delete" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await admin.waitForURL(/announcements\?deleted=1/);
  await student.reload();
  await expect(status.getByText(title)).toHaveCount(0);
});
