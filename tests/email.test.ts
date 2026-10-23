import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { saveEmailTemplate } from "@/server/admin";
import { type InboundMessage, isAutomated, processInbound, stripQuoted } from "@/server/email/inbound";
import { REPLY_MARKER, renderTemplate, textToHtml } from "@/server/email/templates";
import { newMessageId, ticketFromHeaders, ticketFromSubject } from "@/server/email/tokens";
import { prisma } from "@/server/prisma";
import { makeUser as makeTestUser } from "./fixtures";
import type { AppUser } from "@/server/roles";
import {
  addCollaborator,
  addMessage,
  closeAsRequester,
  createTicket,
  getTicketForViewer,
  listMyTickets,
  removeCollaborator,
  TicketError,
  updateTicketFields,
} from "@/server/tickets";
import { ensureUser } from "@/server/users";

const tag = `e${Date.now()}`;
const mail = (local: string) => `${local}-${tag}@ciaschool.edu.kh`;
let student: AppUser, friend: AppUser, agent: AppUser, admin: AppUser, quiet: AppUser;
let wifiTopicId: string, teamId: string;

const makeUser = (name: string, role: AppUser["role"], extra: { emailAlerts?: boolean } = {}) => makeTestUser(tag, name, role, extra);

const outbox = (ticketId: string) => prisma.emailOutbox.findMany({ where: { ticketId }, orderBy: { createdAt: "asc" } });
const keep = (t: { status: any; priority: any; assignedTeamId: string | null; assignedAgentId: string | null }) => ({
  status: t.status,
  priority: t.priority,
  assignedTeamId: t.assignedTeamId,
  assignedAgentId: t.assignedAgentId,
});

function inbound(over: Partial<InboundMessage>): InboundMessage {
  return {
    messageId: `<${Math.random().toString(36).slice(2)}@mail.test>`,
    from: { address: student.email, name: student.name },
    recipients: [{ address: "helpdesk@ciaschool.edu.kh" }],
    subject: "Projector broken",
    text: "The projector in room 12 shows no signal.",
    headers: {},
    attachments: [],
    ...over,
  };
}

beforeAll(async () => {
  student = await makeUser("Student", "USER");
  friend = await makeUser("Friend", "USER");
  agent = await makeUser("Agent", "AGENT");
  admin = await makeUser("Admin", "SUPERADMIN");
  quiet = await makeUser("Quiet", "AGENT", { emailAlerts: false });
  wifiTopicId = (await prisma.helpTopic.findUniqueOrThrow({ where: { name: "Student Wifi" } })).id;
  // A fresh team so alerts go to known people only.
  const team = await prisma.team.create({ data: { name: `Team ${tag}`, members: { create: [{ userId: agent.id }, { userId: quiet.id }] } } });
  teamId = team.id;
});

afterAll(() => prisma.$disconnect());

async function openInTeam(who: AppUser, subject = "Wifi") {
  const t = await createTicket(who, { helpTopicId: wifiTopicId, subject, body: "It drops" });
  return prisma.ticket.update({ where: { id: t.id }, data: { assignedTeamId: teamId } });
}

describe("templates and tokens", () => {
  it("renders placeholders, dropping unknown ones", () => {
    expect(renderTemplate("Hi {{recipient.firstName}} {{nope}}!", { "recipient.firstName": "Dara" })).toBe("Hi Dara !");
  });

  it("escapes HTML and links URLs", () => {
    const html = textToHtml("<script>x</script>\nSee https://helpdesk.test/tickets/TKT-000001");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('<a href="https://helpdesk.test/tickets/TKT-000001">');
  });

  it("signs ticket references and rejects tampering", () => {
    const id = newMessageId("TKT-000042");
    expect(ticketFromHeaders(null, ["<other@x>", id])).toBe("TKT-000042");
    expect(ticketFromHeaders(id.replace("TKT-000042", "TKT-000043"))).toBeNull();
    expect(ticketFromHeaders(id.replace(/\.([0-9a-f]{16})@/, ".0000000000000000@"))).toBeNull();
    expect(ticketFromSubject("Re: [tkt-000007] Printer")).toBe("TKT-000007");
    expect(ticketFromSubject("Printer")).toBeNull();
  });
});

describe("reply cleanup and loop protection", () => {
  it("keeps only the new text", () => {
    expect(stripQuoted(`Still broken.\n\n${REPLY_MARKER}\n\nold stuff`)).toBe("Still broken.");
    expect(stripQuoted("Thanks!\n\nOn Tue, 21 Oct 2026 at 10:00, CIA IT\n<helpdesk@ciaschool.edu.kh> wrote:\n> earlier")).toBe("Thanks!");
    expect(stripQuoted("Done\r\n\r\n-----Original Message-----\r\nFrom: x")).toBe("Done");
    expect(stripQuoted("Ok\n________________________________\nFrom: IT\nSent: Monday")).toBe("Ok");
    expect(stripQuoted("Hi\n> quoted\nmore\n-- \nSok, Grade 10")).toBe("Hi\nmore");
  });

  it("recognises automated mail", () => {
    const base = { from: { address: "kid@ciaschool.edu.kh" }, headers: {} };
    expect(isAutomated(base)).toBeNull();
    expect(isAutomated({ ...base, headers: { "auto-submitted": "auto-replied" } })).toBeTruthy();
    expect(isAutomated({ ...base, headers: { "auto-submitted": "no" } })).toBeNull();
    expect(isAutomated({ ...base, headers: { precedence: "bulk" } })).toBeTruthy();
    expect(isAutomated({ from: { address: "Helpdesk@ciaschool.edu.kh" }, headers: {} })).toBeTruthy();
    expect(isAutomated({ from: { address: "MAILER-DAEMON@google.com" }, headers: {} })).toBeTruthy();
  });
});

describe("notifications", () => {
  it("confirms to the requester and alerts the team, minus opted-out staff", async () => {
    const t = await createTicket(student, { helpTopicId: wifiTopicId, subject: "Alert test", body: "help" });
    await prisma.ticket.update({ where: { id: t.id }, data: { assignedTeamId: teamId } });
    const mails = await outbox(t.id);
    const confirm = mails.find((m) => m.templateKey === "ticket.autoreply");
    expect(confirm).toMatchObject({ toAddress: student.email, status: "PENDING" });
    expect(confirm!.subject).toBe(`[${t.ticketNumber}] Alert test`);
    expect(confirm!.textBody.startsWith(REPLY_MARKER)).toBe(true);
    expect(confirm!.textBody).toContain(`https://helpdesk.test/tickets/${t.ticketNumber}`);
    expect(ticketFromHeaders(confirm!.messageId)).toBe(t.ticketNumber);
  });

  it("sends agent replies to requester and CCs, threads them, and alerts staff on requester replies", async () => {
    const t = await openInTeam(student);
    await addCollaborator(student, t.ticketNumber, { email: friend.email });
    await addMessage(agent, t.ticketNumber, { body: "Try restarting", mode: "reply" });
    let mails = await outbox(t.id);
    const replies = mails.filter((m) => m.templateKey === "ticket.reply");
    expect(replies.map((m) => m.toAddress).sort()).toEqual([friend.email, student.email].sort());
    expect(replies[0].textBody).toContain("Try restarting");
    // Threaded onto the student's own confirmation, not on staff alerts they never saw.
    const studentReply = replies.find((m) => m.toAddress === student.email)!;
    const confirmation = mails.find((m) => m.templateKey === "ticket.autoreply" && m.toAddress === student.email)!;
    expect(studentReply.inReplyTo).toBe(confirmation.messageId);
    expect(studentReply.references).toEqual([confirmation.messageId]);
    expect(replies.find((m) => m.toAddress === friend.email)!.inReplyTo).toBeNull();

    await addMessage(student, t.ticketNumber, { body: "Didn't help", mode: "client" });
    mails = await outbox(t.id);
    const alerts = mails.filter((m) => m.templateKey === "ticket.message.alert").map((m) => m.toAddress);
    expect(alerts).toEqual([agent.email]); // team member with alerts on; `quiet` opted out
  });

  it("alerts a new assignee (not self-assignment) and tells requesters about resolve/close", async () => {
    const t = await openInTeam(student);
    await updateTicketFields(admin, t.ticketNumber, { ...keep(t), assignedAgentId: agent.id });
    await updateTicketFields(agent, t.ticketNumber, { ...keep(t), assignedAgentId: agent.id, status: "RESOLVED" });
    const mails = await outbox(t.id);
    expect(mails.filter((m) => m.templateKey === "ticket.assigned").map((m) => m.toAddress)).toEqual([agent.email]);
    expect(mails.filter((m) => m.templateKey === "ticket.resolved").map((m) => m.toAddress)).toEqual([student.email]);

    const self = await openInTeam(student);
    await updateTicketFields(agent, self.ticketNumber, { ...keep(self), assignedAgentId: agent.id });
    expect((await outbox(self.id)).filter((m) => m.templateKey === "ticket.assigned")).toHaveLength(0);
  });

  it("honours template overrides, including switching an email off", async () => {
    await saveEmailTemplate(admin, { key: "ticket.autoreply", subject: "Got it: {{ticket.number}}", body: "Thanks {{recipient.firstName}}", isActive: true });
    const a = await createTicket(student, { helpTopicId: wifiTopicId, subject: "Override", body: "x" });
    expect((await outbox(a.id)).find((m) => m.templateKey === "ticket.autoreply")).toMatchObject({
      subject: `Got it: ${a.ticketNumber}`,
      textBody: `${REPLY_MARKER}\n\nThanks Student`,
    });

    await saveEmailTemplate(admin, { key: "ticket.autoreply", subject: "x", body: "x", isActive: false });
    const b = await createTicket(student, { helpTopicId: wifiTopicId, subject: "Off", body: "x" });
    expect((await outbox(b.id)).filter((m) => m.templateKey === "ticket.autoreply")).toHaveLength(0);
    await prisma.emailTemplate.deleteMany({ where: { key: "ticket.autoreply" } });
  });
});

describe("CC / collaborators", () => {
  it("lets the requester CC school addresses, and the CC see and reply but not close", async () => {
    const t = await openInTeam(student, "CC test");
    await expect(addCollaborator(student, t.ticketNumber, { email: "parent@gmail.com" })).rejects.toThrow("@ciaschool.edu.kh");
    await expect(addCollaborator(friend, t.ticketNumber, { email: mail("x") })).rejects.toThrow(TicketError);
    await addCollaborator(student, t.ticketNumber, { email: friend.email.toUpperCase() });
    await expect(addCollaborator(student, t.ticketNumber, { email: friend.email })).rejects.toThrow("already CC'd");
    await expect(addCollaborator(student, t.ticketNumber, { email: student.email })).rejects.toThrow("already the requester");

    expect(await getTicketForViewer(friend, t.ticketNumber)).not.toBeNull();
    expect((await listMyTickets(friend, "open")).map((x) => x.id)).toContain(t.id);
    await addMessage(friend, t.ticketNumber, { body: "Same here", mode: "client" });
    await expect(closeAsRequester(friend, t.ticketNumber)).rejects.toThrow(TicketError);

    await removeCollaborator(friend, t.ticketNumber, friend.id);
    expect(await getTicketForViewer(friend, t.ticketNumber)).toBeNull();
  });

  it("staff can CC outside addresses and create the account", async () => {
    const t = await openInTeam(student);
    const parent = await addCollaborator(agent, t.ticketNumber, { email: `parent-${tag}@gmail.com`, name: "A Parent" });
    expect(parent).toMatchObject({ role: "USER", name: "A Parent" });
  });
});

describe("inbound email", () => {
  it("opens a ticket from an allowed sender, CCs school recipients and confirms by email", async () => {
    const cc = mail("teacher");
    const r = await processInbound(
      inbound({
        recipients: [{ address: "helpdesk@ciaschool.edu.kh" }, { address: cc, name: "Teacher Sok" }, { address: "someone@gmail.com" }],
        attachments: [
          { filename: "photo.jpg", content: Buffer.from("jpg"), size: 3 },
          { filename: "virus.exe", content: Buffer.from("MZ"), size: 2 },
        ],
      }),
    );
    expect(r).toMatchObject({ status: "PROCESSED", reason: "new ticket" });
    const t = await prisma.ticket.findUniqueOrThrow({
      where: { ticketNumber: r.ticketNumber! },
      include: { helpTopic: true, collaborators: { include: { user: true } }, thread: { include: { attachments: true } } },
    });
    expect(t).toMatchObject({ source: "EMAIL", requesterId: student.id, subject: "Projector broken" });
    expect(t.helpTopic?.name).toBe("Other");
    expect(t.collaborators.map((c) => c.user.email)).toEqual([cc]);
    expect(t.thread[0].attachments.map((a) => a.fileName)).toEqual(["photo.jpg"]);
    expect(t.thread[0].body).toContain("[Not attached");
    expect((await outbox(t.id)).some((m) => m.templateKey === "ticket.autoreply" && m.toAddress === student.email)).toBe(true);
  });

  it("processes each message once", async () => {
    const msg = inbound({ messageId: `<dup-${tag}@mail.test>` });
    expect((await processInbound(msg)).status).toBe("PROCESSED");
    expect(await processInbound(msg)).toEqual({ status: "IGNORED", reason: "duplicate" });
  });

  it("rejects outside senders and ignores auto-replies", async () => {
    expect(await processInbound(inbound({ from: { address: "stranger@gmail.com" } }))).toMatchObject({ status: "REJECTED" });
    expect(await processInbound(inbound({ headers: { "auto-submitted": "auto-replied" } }))).toMatchObject({ status: "IGNORED" });
    expect(await processInbound(inbound({ text: `> only quoted\n` }))).toMatchObject({ status: "IGNORED", reason: "empty message" });
  });

  it("threads replies by signed header, strips quotes, and checks the sender", async () => {
    const t = await openInTeam(student, "Reply threading");
    const sentId = (await outbox(t.id))[0].messageId;

    const r = await processInbound(inbound({ subject: "Re: whatever", inReplyTo: sentId, text: `Now it works, thanks!\n\n${REPLY_MARKER}\nold` }));
    expect(r).toMatchObject({ status: "PROCESSED", reason: "reply", ticketNumber: t.ticketNumber });
    const last = await prisma.ticketThread.findFirstOrThrow({ where: { ticketId: t.id, type: "CLIENT_MESSAGE" }, orderBy: { createdAt: "desc" } });
    expect(last.body).toBe("Now it works, thanks!");

    const staff = await processInbound(inbound({ from: { address: agent.email }, inReplyTo: sentId, text: "Glad to hear it" }));
    expect(staff).toMatchObject({ status: "PROCESSED", reason: "staff reply" });
    expect(await prisma.ticketThread.count({ where: { ticketId: t.id, type: "AGENT_REPLY", body: "Glad to hear it" } })).toBe(1);

    const intruder = await processInbound(inbound({ from: { address: friend.email }, references: [sentId], text: "let me in" }));
    expect(intruder).toMatchObject({ status: "REJECTED" });
  });

  it("turns a reply to a closed ticket into a linked follow-up", async () => {
    const t = await openInTeam(student, "Old issue");
    await closeAsRequester(student, t.ticketNumber);
    const r = await processInbound(inbound({ subject: `Re: [${t.ticketNumber}] Old issue`, text: "It's back" }));
    expect(r.status).toBe("PROCESSED");
    expect(r.ticketNumber).not.toBe(t.ticketNumber);
    const followUp = await prisma.ticket.findUniqueOrThrow({ where: { ticketNumber: r.ticketNumber! }, include: { linksFrom: true } });
    expect(followUp.linksFrom[0]).toMatchObject({ toTicketId: t.id, kind: "LINKED" });
  });
});

describe("ensureUser", () => {
  it("creates new users with a lowercased email and a name from it", async () => {
    const { user } = await ensureUser({ email: `New@Staff.${tag}.edu` }, { actorId: null, via: "test" });
    expect(user).toMatchObject({ email: `new@staff.${tag}.edu`, name: "new" });
  });
});
