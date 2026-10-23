import { expect, test } from "@playwright/test";
import { ADMIN, AGENT2, CAMPUS_ADMIN, sessionFor, STUDENT } from "./helpers";

test("system log shows sign-ins, sign-outs and failed sign-ins to superadmins only", async ({ browser }, testInfo) => {
  // ── Generate activity: a sign-in and sign-out, and a wrong password ──
  const student = await sessionFor(browser, testInfo, STUDENT);
  // The portal shows Sign out in the sidebar on desktop and on the account page on phones.
  await student.goto("/account");
  await student.getByRole("button", { name: "Sign out" }).filter({ visible: true }).first().click();
  await student.waitForURL(/\/login/);

  await student.getByLabel("Email").fill(AGENT2.email);
  await student.getByLabel("Password").fill(`wrong-${Date.now()}`);
  await student.getByRole("button", { name: "Login" }).click();
  await expect(student.getByText("don't match an active account")).toBeVisible();

  // ── Superadmin sees it, filtered by person and type ──
  const admin = await sessionFor(browser, testInfo, ADMIN);
  await admin.goto(`/staff/admin/audit-log?category=auth&q=${encodeURIComponent(STUDENT.email)}`);
  await expect(admin.getByRole("heading", { name: "System log" })).toBeVisible();
  await expect(admin.getByText("signed out").first()).toBeVisible();
  await expect(admin.getByText("signed in").first()).toBeVisible();

  await admin.goto(`/staff/admin/audit-log?category=auth&q=${encodeURIComponent(AGENT2.email)}`);
  await expect(admin.getByText("failed sign-in").first()).toBeVisible();
  await expect(admin.getByText("wrong password").first()).toBeVisible();

  // ── Campus admins can't open it ──
  const campusAdmin = await sessionFor(browser, testInfo, CAMPUS_ADMIN);
  await campusAdmin.goto("/staff/admin/audit-log");
  await expect(campusAdmin).toHaveURL(/\/staff$/);
});
