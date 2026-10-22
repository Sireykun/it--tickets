import { expect, type Page, test } from "@playwright/test";
import { AGENT, openTicketPanel, PNG, sessionFor, shot, STUDENT } from "./helpers";

// Assertions on the conversation only, never on text still sitting in the composer.
const thread = (page: Page) => page.getByRole("list", { name: "Conversation" });
const composer = (page: Page) => page.getByRole("textbox", { name: /^(Message|Internal note)$/ });

test("student opens a ticket, agent works it, student closes it", async ({ browser }, testInfo) => {
  const subject = `Wifi keeps dropping ${Date.now()}`;

  // ── Student opens a ticket with a photo ──
  const student = await sessionFor(browser, testInfo, STUDENT);
  await expect(student.getByRole("heading", { name: /^Hi, / })).toBeVisible();
  await shot(student, testInfo, "01-my-tickets");

  await student.goto("/tickets/new");
  await student.getByRole("combobox", { name: "Help Topic" }).selectOption({ label: "Student Wifi" });
  await student.getByRole("combobox", { name: "Campus" }).selectOption({ label: "Main Campus" });
  await student.getByLabel("Room").fill("204");
  await student.getByLabel("Issue Summary").fill(subject);
  await student.getByLabel("Please Describe Your Issue").fill("In room 204 the wifi disconnects every few minutes.");
  await student.locator('input[type="file"][name="files"]').setInputFiles({ name: "error.png", mimeType: "image/png", buffer: PNG });
  await shot(student, testInfo, "02-new-ticket");
  await student.getByRole("button", { name: "Submit ticket" }).click();

  await student.waitForURL(/\/tickets\/TKT-\d{6}\?created=1/);
  const ticketNumber = student.url().match(/TKT-\d{6}/)![0];
  await expect(student.getByText(`Ticket ${ticketNumber} has been sent`)).toBeVisible();
  await expect(student.getByText("Room: 204")).toBeVisible();
  await expect(thread(student).getByRole("img", { name: "error.png" })).toBeVisible();
  await shot(student, testInfo, "03-ticket-created");

  // ── Agent picks it up (agents don't see the shared queues, so they open it by number) ──
  const agent = await sessionFor(browser, testInfo, AGENT);
  await agent.goto(`/staff/tickets/${ticketNumber}`);

  await openTicketPanel(agent);
  await agent.getByRole("button", { name: "Assign to me" }).click();
  await expect(thread(agent).getByText("Assigned to Sample Agent")).toBeVisible();

  // Now it's in their console, which only offers their open tickets and New ticket.
  await agent.goto(`/staff?q=${ticketNumber}`);
  await expect(agent.getByRole("heading", { name: "My open tickets" })).toBeVisible();
  const staffNav = agent.getByRole("navigation", { name: "Staff" }).first();
  await expect(staffNav.getByRole("link", { name: "Unassigned" })).toHaveCount(0);
  await shot(agent, testInfo, "04-staff-queue");
  await agent.getByRole("link", { name: new RegExp(subject) }).first().click();
  await agent.waitForURL(new RegExp(`/staff/tickets/${ticketNumber}`));

  await agent.getByRole("radio", { name: "Internal note" }).click();
  await composer(agent).fill("Probably AP-3 overloaded during lunch.");
  await agent.getByRole("button", { name: "Add note" }).click();
  await expect(thread(agent).getByText("Probably AP-3 overloaded during lunch.")).toBeVisible();
  await expect(composer(agent)).toHaveValue("");

  await agent.getByRole("radio", { name: "Reply to requester" }).click();
  await composer(agent).fill("Thanks, we're looking into the access point in room 204.");
  await agent.getByRole("button", { name: "Send" }).click();
  await expect(thread(agent).getByText("we're looking into the access point")).toBeVisible();
  await expect(thread(agent).getByText("Status changed from Open to In progress")).toBeVisible();
  await shot(agent, testInfo, "05-staff-ticket");

  // ── Student sees the reply, never the note ──
  await student.goto(`/tickets/${ticketNumber}`);
  await expect(thread(student).getByText("we're looking into the access point")).toBeVisible();
  await expect(student.getByText("AP-3 overloaded")).toHaveCount(0);
  await expect(student.getByText("In progress", { exact: true })).toBeVisible();
  await shot(student, testInfo, "06-student-sees-reply");

  // ── Agent resolves; student replies (reopens), then closes ──
  await agent.reload();
  await openTicketPanel(agent);
  await agent.getByLabel("Status").selectOption("RESOLVED");
  await agent.getByRole("button", { name: "Save changes" }).click();
  await expect(thread(agent).getByText("Status changed from In progress to Resolved")).toBeVisible();

  await student.reload();
  await expect(student.getByText("IT marked this as resolved")).toBeVisible();
  await composer(student).fill("It happened again this morning.");
  await student.getByRole("button", { name: "Send" }).click();
  await expect(thread(student).getByText("Reopened by the requester's reply")).toBeVisible();
  await expect(student.getByText("Open", { exact: true })).toBeVisible();

  await student.getByRole("button", { name: /close ticket/ }).click();
  await expect(student.getByText("This ticket is closed.")).toBeVisible();
  await expect(composer(student)).toHaveCount(0);
});

test("requesters can't open someone else's ticket or the staff console", async ({ browser }, testInfo) => {
  const agent = await sessionFor(browser, testInfo, AGENT);
  // The agent's own ticket, opened through the portal, belongs to someone other than the student.
  await agent.goto("/tickets/new");
  await agent.getByRole("combobox", { name: "Help Topic" }).selectOption({ label: "Printer Setup" });
  await agent.getByRole("combobox", { name: "Campus" }).selectOption({ label: "Main Campus" });
  await agent.getByLabel("Room").fill("Office");
  await agent.getByLabel("Issue Summary").fill(`Agent's own printer ${Date.now()}`);
  await agent.getByLabel("Please Describe Your Issue").fill("Toner light is on.");
  await agent.getByRole("button", { name: "Submit ticket" }).click();
  await agent.waitForURL(/\/tickets\/TKT-\d{6}/);
  const ticketNumber = agent.url().match(/TKT-\d{6}/)![0];

  const student = await sessionFor(browser, testInfo, STUDENT);
  const res = await student.goto(`/tickets/${ticketNumber}`);
  expect(res?.status()).toBe(404);
  await expect(student.getByText("Page not found")).toBeVisible();

  await student.goto("/staff");
  await expect(student).toHaveURL(/\/$/);
});
