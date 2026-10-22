import { expect, type Page, test } from "@playwright/test";
import { ADMIN, AGENT, openTicketPanel, sessionFor, shot, STUDENT } from "./helpers";

const thread = (page: Page) => page.getByRole("list", { name: "Conversation" });
const composer = (page: Page) => page.getByRole("textbox", { name: /^(Message|Internal note)$/ });

async function openOnBehalf(page: Page, subject: string, source = "WALK_IN") {
  await page.goto("/staff/tickets/new");
  await page.getByLabel("Email").fill(STUDENT.email);
  await page.getByLabel("How did they contact IT?").selectOption(source);
  await page.getByLabel("Help topic").selectOption({ label: "Student Wifi" });
  await page.getByLabel("Subject").fill(subject);
  await page.getByLabel("What's the problem?").fill("Came to the IT office: laptop won't join wifi.");
  await page.getByRole("button", { name: "Create ticket" }).click();
  await page.waitForURL(/\/staff\/tickets\/TKT-\d{6}$/);
  return page.url().match(/TKT-\d{6}/)![0];
}

test("agent tools: on-behalf tickets, canned replies, lock warning, tasks, transfer, merge, print, export", async ({ browser }, testInfo) => {
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const agent = await sessionFor(browser, testInfo, AGENT);

  // ── Open a walk-in ticket for the student ──
  const main = await openOnBehalf(agent, `Laptop wifi ${stamp}`);
  await expect(agent.getByText(/via Walk-in/)).toBeVisible();
  await expect(thread(agent).getByText("Opened on behalf of the requester (Walk-in)")).toBeVisible();
  await expect(thread(agent).getByText("Came to the IT office")).toBeVisible();

  // ── Canned reply fills in the requester's name ──
  await agent.getByLabel("Insert canned reply").selectOption({ label: "Wifi: forget and rejoin" });
  await expect(composer(agent)).toHaveValue(/^Hi Sample,/);
  await expect(composer(agent)).toHaveValue(/Sample Agent, IT Team/);

  // ── While the agent has a draft, the admin sees a "also replying" warning ──
  await agent.waitForTimeout(1500); // let the first heartbeat land
  const admin = await sessionFor(browser, testInfo, ADMIN);
  await admin.goto(`/staff/tickets/${main}`);
  await expect(admin.getByText("Sample Agent is also replying to this ticket")).toBeVisible();

  await agent.getByRole("button", { name: "Send" }).click();
  await expect(thread(agent).getByText(/Forget this network/)).toBeVisible();
  await admin.reload();
  await expect(admin.getByText("is also replying")).toHaveCount(0);
  await shot(agent, testInfo, "08-agent-ticket-tools");

  // ── Task on the ticket: add, comment, complete ──
  await agent.getByLabel("New task").fill(`Re-image laptop ${stamp}`);
  await agent.getByLabel("Assign task to agent").selectOption({ label: "Sample Agent" });
  await agent.getByRole("button", { name: "Add task" }).click();
  await expect(thread(agent).getByText(`Task added: Re-image laptop ${stamp}`)).toBeVisible();
  await agent.getByRole("link", { name: new RegExp(`Re-image laptop ${stamp}`) }).click();
  await agent.waitForURL(/\/staff\/tasks\/[0-9a-f-]{36}$/);
  await agent.getByRole("textbox", { name: "Comment" }).fill("Backed up the user's files first.");
  await agent.getByRole("button", { name: "Comment" }).click();
  await expect(agent.getByText("Backed up the user's files first.").last()).toBeVisible();
  await agent.getByLabel("Status").selectOption("CLOSED");
  await agent.getByRole("button", { name: "Save task" }).click();
  await expect(agent.getByText("Task saved.")).toBeVisible();
  await agent.goto("/staff/tasks?view=done");
  await expect(agent.getByText(`Re-image laptop ${stamp}`)).toBeVisible();
  await shot(agent, testInfo, "09-tasks");

  // ── Transfer to another department ──
  await agent.goto(`/staff/tickets/${main}`);
  await openTicketPanel(agent);
  await agent.getByLabel("Department").selectOption({ label: "Infrastructure" });
  await agent.getByRole("button", { name: "Save changes" }).click();
  await expect(thread(agent).getByText("Transferred from IT Support to Infrastructure")).toBeVisible();

  // ── A duplicate from the same student gets merged into the main ticket ──
  const dup = await openOnBehalf(agent, `Same laptop again ${stamp}`, "PHONE");
  await agent.getByLabel("Merge into ticket number").fill(main);
  await agent.getByRole("button", { name: "Merge", exact: true }).click();
  await agent.getByRole("button", { name: "Yes, merge" }).click();
  await agent.waitForURL(new RegExp(`/staff/tickets/${main}$`));
  await expect(thread(agent).getByText(`Merged ${dup}`)).toBeVisible();
  await expect(agent.getByRole("link", { name: new RegExp(dup) })).toBeVisible();

  // ── Print view and CSV export ──
  await agent.goto(`/print/tickets/${main}`);
  await expect(agent.getByRole("heading", { name: new RegExp(main) })).toBeVisible();
  await expect(agent.getByText("Same laptop again").first()).toBeVisible();

  // Exporting is superadmin-only.
  expect((await agent.request.get(`/staff/export?view=all&q=${encodeURIComponent(stamp)}`)).status()).toBe(404);
  const superadmin = await sessionFor(browser, testInfo, ADMIN);
  const csv = await superadmin.request.get(`/staff/export?view=all&q=${encodeURIComponent(stamp)}`);
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const body = await csv.text();
  expect(body).toContain(main);
  expect(body).toContain(dup);
  expect(body).toContain("Walk-in");
});

test("requesters can't reach staff exports or print views", async ({ browser }, testInfo) => {
  const student = await sessionFor(browser, testInfo, STUDENT);
  expect((await student.request.get("/staff/export?view=all")).status()).toBe(404);
  await student.goto("/print/tickets/TKT-000001");
  await expect(student).toHaveURL(/\/$/);
});

test("admin manages canned replies", async ({ browser }, testInfo) => {
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const admin = await sessionFor(browser, testInfo, ADMIN);
  await admin.goto("/staff/admin/canned?edit=new");
  await admin.getByLabel("Title").fill(`Printer jam ${stamp}`);
  await admin.getByLabel("Reply").fill("Hi {requester.firstName}, open tray 2 and remove the jammed sheet.");
  await admin.getByRole("button", { name: "Create" }).click();
  await admin.waitForURL(/canned\?saved=1/);
  await expect(admin.getByText(`Printer jam ${stamp}`)).toBeVisible();
});
