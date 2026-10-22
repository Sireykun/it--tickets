import { expect, type Page, test } from "@playwright/test";
import { ADMIN, AGENT, sessionFor, shot, STUDENT } from "./helpers";
import { plainText, sendMail, waitForMail } from "./mail";

const thread = (page: Page) => page.getByRole("list", { name: "Conversation" });
const composer = (page: Page) => page.getByRole("textbox", { name: /^(Message|Internal note)$/ });

test("email round trip: email opens a ticket, agent reply is emailed, emailed reply lands in the thread", async ({ browser }, testInfo) => {
  const subject = `Smartboard frozen ${testInfo.project.name}-${Date.now()}`;

  // ── A student emails the helpdesk ──
  await sendMail({ from: `Sample Student <${STUDENT.email}>`, subject, text: "The smartboard in room 7 is frozen." });

  // ── It shows up as a ticket (the worker polls the mailbox); admins see the shared queue ──
  const admin = await sessionFor(browser, testInfo, ADMIN);
  await expect
    .poll(
      async () => {
        await admin.goto(`/staff?view=all&q=${encodeURIComponent(subject)}`);
        return admin.getByRole("link", { name: new RegExp(subject) }).count();
      },
      { timeout: 60_000, intervals: [2000] },
    )
    .toBeGreaterThan(0);
  await admin.getByRole("link", { name: new RegExp(subject) }).first().click();
  await admin.waitForURL(/\/staff\/tickets\/TKT-\d{6}$/);
  const ticketNumber = admin.url().match(/TKT-\d{6}/)![0];

  const agent = await sessionFor(browser, testInfo, AGENT);
  await agent.goto(`/staff/tickets/${ticketNumber}`);
  await expect(agent.getByText(/via Email/)).toBeVisible();

  // ── The student got a confirmation email ──
  const confirmation = await waitForMail(STUDENT.email, new RegExp(`^\\[${ticketNumber}\\]`));
  expect(plainText(confirmation)).toContain("Auto-Submitted: auto-replied");

  // ── Agent replies on the web; the student receives it by email ──
  await composer(agent).fill("Please hold the power button for 10 seconds.");
  await agent.getByRole("button", { name: "Send" }).click();
  await expect(thread(agent).getByText("hold the power button")).toBeVisible();
  const reply = await waitForMail(STUDENT.email, new RegExp(`^Re: \\[${ticketNumber}\\]`));
  expect(plainText(reply)).toContain("hold the power button");
  expect(plainText(reply)).not.toContain("Auto-Submitted");

  // ── The student answers from their mail client; quoted history is stripped ──
  await sendMail({
    from: STUDENT.email,
    subject: `Re: ${reply.subject}`,
    inReplyTo: reply["Message-ID"],
    references: [reply["Message-ID"]],
    text: `That fixed it, thank you!\n\nOn Thu, 22 Oct 2026, CIA IT Helpdesk <helpdesk@ciaschool.edu.kh> wrote:\n> Please hold the power button for 10 seconds.`,
  });
  await expect
    .poll(
      async () => {
        await agent.reload();
        return thread(agent).getByText("That fixed it, thank you!").count();
      },
      { timeout: 60_000, intervals: [2000] },
    )
    .toBe(1);
  // Only the agent's original reply contains this sentence; the quoted copy was stripped.
  await expect(thread(agent).getByText("Please hold the power button for 10 seconds.")).toHaveCount(1);
  await shot(agent, testInfo, "10-email-thread");
});

test("CC: requester adds and removes someone, staff can add people by name", async ({ browser }, testInfo) => {
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const student = await sessionFor(browser, testInfo, STUDENT);
  await student.goto("/tickets/new");
  await student.getByText("Printer Setup", { exact: true }).click();
  await student.getByRole("combobox", { name: "Campus" }).selectOption({ label: "Main Campus" });
  await student.getByLabel("Room").fill("Classroom");
  await student.getByLabel("Issue Summary").fill(`Printer for class ${stamp}`);
  await student.getByLabel("Please Describe Your Issue").fill("The class printer needs setting up.");
  await student.getByRole("button", { name: "Submit ticket" }).click();
  await student.waitForURL(/\/tickets\/TKT-\d{6}/);
  const ticketNumber = student.url().match(/TKT-\d{6}/)![0];

  await student.getByLabel("Email to CC").fill("parent@gmail.com");
  await student.getByRole("button", { name: "Add to CC" }).click();
  await expect(student.getByText("You can only add people with an @ciaschool.edu.kh email.")).toBeVisible();

  const teacher = `teacher-${stamp}@ciaschool.edu.kh`;
  await student.getByLabel("Email to CC").fill(teacher);
  await student.getByRole("button", { name: "Add to CC" }).click();
  await expect(thread(student).getByText(/Added teacher-.* as CC/)).toBeVisible();
  await shot(student, testInfo, "11-cc");
  await student.getByRole("button", { name: /Remove teacher-.* from CC/ }).click();
  await expect(thread(student).getByText(/Removed teacher-.* from CC/)).toBeVisible();

  const agent = await sessionFor(browser, testInfo, AGENT);
  await agent.goto(`/staff/tickets/${ticketNumber}`);
  await agent.getByLabel("Email to CC").fill(`deputy-${stamp}@ciaschool.edu.kh`);
  await agent.getByLabel("Their name (if new)").fill("Deputy Head");
  await agent.getByRole("button", { name: "Add to CC" }).click();
  await expect(thread(agent).getByText("Added Deputy Head as CC")).toBeVisible();
});

test("admin: organizations, email templates and the email log", async ({ browser }, testInfo) => {
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const admin = await sessionFor(browser, testInfo, ADMIN);

  await admin.goto("/staff/admin/organizations?edit=new");
  await admin.getByLabel("Name").fill(`Grade 10 ${stamp}`);
  await admin.getByLabel("Email domains").fill(`g10-${Date.now()}.ciaschool.edu.kh`);
  await admin.getByRole("button", { name: "Create" }).click();
  await admin.waitForURL(/organizations\?saved=1/);
  await expect(admin.getByText(`Grade 10 ${stamp}`)).toBeVisible();

  await admin.goto("/staff/admin/email");
  await admin.getByRole("link", { name: /Ticket resolved: to requester/ }).click();
  await admin.getByLabel("Subject").fill(`Fixed: [{{ticket.number}}] ${stamp}`);
  await admin.getByRole("button", { name: "Save changes" }).click();
  await admin.waitForURL(/email\?saved=1/);
  await expect(admin.getByText(`Fixed: [{{ticket.number}}] ${stamp}`)).toBeVisible();
  await expect(admin.getByText("Customized")).toBeVisible();
  await admin.getByRole("link", { name: /Ticket resolved: to requester/ }).click();
  await admin.getByRole("button", { name: "Reset to default" }).click();
  await admin.waitForURL(/email\?saved=1/);
  await expect(admin.getByText(`Fixed: [{{ticket.number}}] ${stamp}`)).toHaveCount(0);

  await expect(admin.getByRole("heading", { name: "Recently received" })).toBeVisible();
  await expect(admin.getByText("processed").first()).toBeVisible();
  await shot(admin, testInfo, "12-email-admin");
});

test("staff can switch off alert emails", async ({ browser }, testInfo) => {
  const agent = await sessionFor(browser, testInfo, AGENT);
  await agent.goto("/account");
  const box = agent.getByRole("checkbox", { name: /Email me about new tickets/ });
  await box.uncheck();
  await agent.getByRole("button", { name: "Save", exact: true }).click();
  await expect(agent.getByText("Saved.")).toBeVisible();
  await agent.reload();
  await expect(box).not.toBeChecked();
  await box.check(); // leave the shared dev account as it was
  await agent.getByRole("button", { name: "Save", exact: true }).click();
  await expect(agent.getByText("Saved.")).toBeVisible();
});
