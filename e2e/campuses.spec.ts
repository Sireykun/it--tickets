import { expect, test } from "@playwright/test";
import { ADMIN, AGENT2, CAMPUS_ADMIN, fillNewTicket, sessionFor, shot, STUDENT } from "./helpers";

test("superadmin adds a campus and grants a campus admin 'Manage users' there", async ({ browser }, testInfo) => {
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const admin = await sessionFor(browser, testInfo, ADMIN);

  await admin.goto("/staff/admin/campuses?edit=new");
  await admin.getByLabel("Name").fill(`North ${stamp}`);
  await admin.getByRole("button", { name: "Create" }).click();
  await admin.waitForURL(/campuses\?saved=1/);
  await expect(admin.getByText(`North ${stamp}`)).toBeVisible();

  // Grant on the user form: one row per campus with "Works here" and "Manage users & agents".
  await admin.goto(`/staff/admin/users?q=campusadmin`);
  await admin.getByRole("link", { name: /Sample Campus Admin/ }).click();
  const row = admin.locator("div", { has: admin.getByText(`North ${stamp}`, { exact: true }) }).last();
  await row.getByRole("checkbox", { name: "Works here" }).check();
  await row.getByRole("checkbox", { name: "Manage users & agents" }).check();
  await shot(admin, testInfo, "13-campus-access");
  await admin.getByRole("button", { name: "Save changes" }).click();
  await admin.waitForURL(/users\?saved=1/);

  await admin.goto("/staff/admin/campuses");
  await admin.getByRole("link", { name: new RegExp(`North ${stamp}`) }).click();
  await expect(admin.getByText("manages users & agents")).toBeVisible();
});

test("campus admin manages users of their campus but no other settings", async ({ browser }, testInfo) => {
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const cadmin = await sessionFor(browser, testInfo, CAMPUS_ADMIN);

  // Shared settings are superadmin-only.
  await cadmin.goto("/staff/admin/teams");
  await expect(cadmin).toHaveURL(/\/staff$/);
  expect((await cadmin.request.get("/staff/export?view=all")).status()).toBe(404);

  await cadmin.goto("/staff/admin/users?edit=new");
  const roles = await cadmin.locator("form select#role").locator("option").allTextContents(); // the form, not the list filter
  expect(roles).toEqual(["Requester", "Agent"]);
  await cadmin.getByLabel("Full name").fill(`Lab Tech ${stamp}`);
  await cadmin.getByLabel("Email").fill(`labtech-${stamp}@ciaschool.edu.kh`);
  await cadmin.locator("form select#role").selectOption("AGENT");
  await cadmin.getByLabel("Home campus").selectOption({ label: "Main Campus" });
  await cadmin.locator("div", { has: cadmin.getByText("Main Campus", { exact: true }) }).last().getByRole("checkbox", { name: "Works here" }).check();
  await cadmin.getByRole("button", { name: "Create" }).click();
  await cadmin.waitForURL(/users\?saved=1/);
  await expect(cadmin.getByText(`Lab Tech ${stamp}`)).toBeVisible();
  // Superadmins aren't in a campus admin's list.
  await expect(cadmin.getByText("System Administrator")).toHaveCount(0);
  await shot(cadmin, testInfo, "14-campus-admin-users");
});

test("an agent from another campus can't see this campus's tickets", async ({ browser }, testInfo) => {
  const subject = `Main campus only ${testInfo.project.name}-${Date.now()}`;
  const student = await sessionFor(browser, testInfo, STUDENT);
  await fillNewTicket(student, { topic: "Printer Setup", campus: "Main Campus", room: "101", subject, body: "Printer offline." });
  await student.getByRole("button", { name: "Submit ticket" }).click();
  await student.waitForURL(/\/tickets\/TKT-\d{6}/);
  const ticketNumber = student.url().match(/TKT-\d{6}/)![0];

  const agent2 = await sessionFor(browser, testInfo, AGENT2);
  const res = await agent2.goto(`/staff/tickets/${ticketNumber}`);
  expect(res?.status()).toBe(404);
  await agent2.goto(`/staff?view=all&q=${encodeURIComponent(subject)}`);
  await expect(agent2.getByText("0 tickets")).toBeVisible();

  // The superadmin sees it, labelled with its campus.
  const admin = await sessionFor(browser, testInfo, ADMIN);
  await admin.goto(`/staff/tickets/${ticketNumber}`);
  await expect(admin.getByText(/Main Campus · via Web/)).toBeVisible();
});
