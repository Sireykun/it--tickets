import { expect, test } from "@playwright/test";
import { ADMIN, login, sessionFor, shot } from "./helpers";

test("admin manages help topics and users; deactivation signs a user out", async ({ browser }, testInfo) => {
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  // Throwaway credential for a throwaway account, generated per run.
  const teacherSecret = ["T", stamp, Math.random().toString(36).slice(2)].join("-");
  const admin = await sessionFor(browser, testInfo, ADMIN);

  // ── New help topic shows up for requesters ──
  await admin.goto("/staff/admin/help-topics?edit=new");
  await admin.getByLabel("Name").fill(`Smartboard ${stamp}`);
  await admin.getByLabel("Description").fill("Classroom interactive displays");
  await admin.getByLabel("Default priority").selectOption("HIGH");
  await admin.getByLabel("SLA policy").selectOption({ label: "High" });
  await admin.getByLabel("Assign to team").selectOption({ label: "High School Team" });
  await admin.getByRole("button", { name: "Create" }).click();
  await admin.waitForURL(/help-topics\?saved=1/);
  await expect(admin.getByText(`Smartboard ${stamp}`)).toBeVisible();
  await shot(admin, testInfo, "07-admin-topics");

  // ── Validation errors keep what was typed ──
  const email = `teacher-${stamp}@ciaschool.edu.kh`;
  await admin.goto("/staff/admin/users?edit=new");
  await admin.getByLabel("Full name").fill(`Teacher ${stamp}`);
  await admin.getByLabel("Email").fill(email);
  await admin.getByLabel("Password").fill("short");
  // Skip the browser's own minlength check so the server-side validation is exercised.
  await admin.locator("form", { has: admin.getByRole("button", { name: "Create" }) }).evaluate((f) => f.setAttribute("novalidate", ""));
  await admin.getByRole("button", { name: "Create" }).click();
  await expect(admin.getByText("Password must be at least 10 characters.")).toBeVisible();
  await expect(admin.getByLabel("Full name")).toHaveValue(`Teacher ${stamp}`);

  // ── Create the user properly ──
  await admin.getByLabel("Password").fill(teacherSecret);
  await admin.getByRole("button", { name: "Create" }).click();
  await admin.waitForURL(/users\?saved=1/);
  await expect(admin.getByText(`Teacher ${stamp}`)).toBeVisible();

  // ── New user can sign in ──
  const context = await browser.newContext(testInfo.project.use);
  const teacher = await context.newPage();
  await login(teacher, { email, password: teacherSecret });
  await expect(teacher.getByRole("heading", { name: "Hi, Teacher" })).toBeVisible();

  // ── Admin deactivates them; their next request bounces to login ──
  await admin.getByRole("link", { name: new RegExp(`Teacher ${stamp}`) }).click();
  await admin.getByLabel("Active").uncheck();
  await admin.getByRole("button", { name: "Save changes" }).click();
  await admin.waitForURL(/users\?saved=1/);

  await teacher.goto("/");
  await expect(teacher).toHaveURL(/\/login/);
  await teacher.getByLabel("Email").fill(email);
  await teacher.getByLabel("Password").fill(teacherSecret);
  await teacher.getByRole("button", { name: "Login" }).click();
  await expect(teacher.getByText("don't match an active account")).toBeVisible();
});
