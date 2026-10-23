// Seeds reference data and the first admin account. Safe to run repeatedly:
// every row is upserted by a unique key.
//
// Env:
//   SEED_ADMIN_EMAIL     (default admin@ciaschool.edu.kh)
//   SEED_ADMIN_PASSWORD  (required; only used when the admin is first created)
//   SEED_SAMPLE_PASSWORD (optional; password for the sample accounts if they have none)
//   SEED_REQUESTER_EMAIL / SEED_REQUESTER_PASSWORD (optional local requester login)
//   NODE_ENV=production  skips the sample agent and requester accounts

import bcrypt from "bcryptjs";
import { createPrismaClient } from "../src/db.js";
import { Role, TicketPriority } from "../src/generated/prisma/client.js";

const prisma = createPrismaClient();

const departments = [
  { name: "IT Support", description: "Day-to-day help for students and staff" },
  { name: "Infrastructure", description: "Network, servers, and campus systems" },
];

const teams = [
  { name: "High School Team", department: "IT Support" },
  { name: "Primary School Team", department: "IT Support" },
  { name: "Infrastructure Team", department: "Infrastructure" },
];

const slaPolicies = [
  { name: "Low", responseTimeHours: 24, resolutionTimeHours: 120 },
  { name: "Standard", responseTimeHours: 8, resolutionTimeHours: 72 },
  { name: "High", responseTimeHours: 2, resolutionTimeHours: 24 },
  { name: "Emergency", responseTimeHours: 1, resolutionTimeHours: 4 },
];

const helpTopics = [
  { name: "Student Wifi", priority: TicketPriority.NORMAL, department: "IT Support", team: "High School Team", sla: "Standard", description: "Can't connect to or slow student wireless network" },
  { name: "Printer Setup", priority: TicketPriority.LOW, department: "IT Support", team: "Primary School Team", sla: "Low", description: "Adding, configuring, or fixing printers" },
  { name: "Email & Accounts", priority: TicketPriority.NORMAL, department: "IT Support", team: "High School Team", sla: "Standard", description: "Password resets, locked accounts, mailbox issues" },
  { name: "Hardware Repair", priority: TicketPriority.NORMAL, department: "IT Support", team: "Primary School Team", sla: "Standard", description: "Broken laptops, projectors, and peripherals" },
  { name: "Software Installation", priority: TicketPriority.LOW, department: "IT Support", team: "High School Team", sla: "Low", description: "Requests to install or update software" },
  { name: "Other", priority: TicketPriority.NORMAL, department: "IT Support", team: "High School Team", sla: "Standard", description: "Anything else, including requests sent by email" },
  { name: "Network Outage", priority: TicketPriority.EMERGENCY, department: "Infrastructure", team: "Infrastructure Team", sla: "Emergency", description: "Campus-wide or building-wide loss of connectivity" },
];

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@ciaschool.edu.kh").toLowerCase();
  const requesterEmail = (process.env.SEED_REQUESTER_EMAIL ?? "student@ciaschool.edu.kh").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error("SEED_ADMIN_PASSWORD is required to seed the admin account");
  }

  const departmentIds = new Map<string, string>();
  for (const d of departments) {
    const row = await prisma.department.upsert({
      where: { name: d.name },
      update: { description: d.description },
      create: d,
    });
    departmentIds.set(d.name, row.id);
  }

  const teamIds = new Map<string, string>();
  for (const t of teams) {
    const departmentId = departmentIds.get(t.department)!;
    const row = await prisma.team.upsert({
      where: { name: t.name },
      update: { departmentId },
      create: { name: t.name, departmentId },
    });
    teamIds.set(t.name, row.id);
  }

  const slaIds = new Map<string, string>();
  for (const s of slaPolicies) {
    const row = await prisma.slaPolicy.upsert({
      where: { name: s.name },
      update: { responseTimeHours: s.responseTimeHours, resolutionTimeHours: s.resolutionTimeHours },
      create: s,
    });
    slaIds.set(s.name, row.id);
  }

  for (const h of helpTopics) {
    const data = {
      description: h.description,
      defaultPriority: h.priority,
      defaultDepartmentId: departmentIds.get(h.department)!,
      defaultTeamId: teamIds.get(h.team)!,
      slaPolicyId: slaIds.get(h.sla)!,
    };
    await prisma.helpTopic.upsert({
      where: { name: h.name },
      update: data,
      create: { name: h.name, ...data },
    });
  }

  const cannedReplies = [
    {
      title: "Wifi: forget and rejoin",
      body: "Hi {requester.firstName},\n\nPlease try this first: open Wi-Fi settings, choose \"Forget this network\" for CIA-Student, then join again with your school email and password.\n\nIf it still drops, reply here with your room number and device model.\n\n{agent.name}, IT Team",
    },
    {
      title: "Resolved: please confirm",
      body: "Hi {requester.firstName},\n\nWe believe {ticket.number} is fixed. Could you check and reply if anything is still wrong? Otherwise you can close the ticket.\n\nThanks,\n{agent.name}",
    },
  ];
  for (const c of cannedReplies) {
    await prisma.cannedResponse.upsert({ where: { title: c.title }, update: {}, create: c });
  }

  // Campuses: placeholders on first run only, so a superadmin's renames survive re-seeding.
  if ((await prisma.campus.count()) === 0) {
    for (const name of ["SS1", "SS2", "CA1", "RK"]) {
      await prisma.campus.create({ data: { name } });
      await new Promise((r) => setTimeout(r, 5)); // distinct createdAt keeps "SS1" first
    }
  }
  const campuses = await prisma.campus.findMany({ orderBy: { createdAt: "asc" } });
  const main = campuses[0];

  // Records from before campuses existed belong to the main campus.
  const before = { lt: main.createdAt };
  await prisma.ticket.updateMany({ where: { campusId: null, createdAt: before }, data: { campusId: main.id } });
  await prisma.user.updateMany({ where: { campusId: null, createdAt: before, role: { not: Role.SUPERADMIN } }, data: { campusId: main.id } });
  const unplacedStaff = await prisma.user.findMany({
    where: { role: { in: [Role.AGENT, Role.ADMIN] }, createdAt: before, staffCampuses: { none: {} } },
  });
  for (const s of unplacedStaff) await prisma.staffCampus.create({ data: { userId: s.id, campusId: main.id } });

  // Never overwrite an existing admin's password on re-seed.
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: Role.SUPERADMIN, isActive: true },
    create: {
      email: adminEmail,
      name: "System Administrator",
      role: Role.SUPERADMIN,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      departmentId: departmentIds.get("IT Support"),
    },
  });
  await prisma.staffCampus.deleteMany({ where: { userId: admin.id } }); // superadmins see every campus anyway

  if (process.env.NODE_ENV !== "production") {
    const sample = async (email: string, name: string, role: Role, campusId: string, permissions: string[] = []) => {
      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, name, role, campusId, departmentId: departmentIds.get("IT Support") },
      });
      if (role !== Role.USER) {
        await prisma.staffCampus.upsert({
          where: { userId_campusId: { userId: user.id, campusId } },
          update: {},
          create: { userId: user.id, campusId, permissions },
        });
      }
      return user;
    };
    const agent = await sample("agent@ciaschool.edu.kh", "Sample Agent", Role.AGENT, main.id);
    await sample(requesterEmail, "Temporary Requester", Role.USER, main.id);
    await sample("campusadmin@ciaschool.edu.kh", "Sample Campus Admin", Role.ADMIN, main.id, ["users.manage"]);
    await sample("agent2@ciaschool.edu.kh", "Campus 2 Agent", Role.AGENT, campuses[1]?.id ?? main.id);
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: teamIds.get("High School Team")!, userId: agent.id } },
      update: {},
      create: { teamId: teamIds.get("High School Team")!, userId: agent.id },
    });

    // Give the sample accounts a dev password, without touching one that was already set.
    const samplePassword = process.env.SEED_SAMPLE_PASSWORD;
    if (samplePassword) {
      await prisma.user.updateMany({
        where: {
          email: { in: ["agent@ciaschool.edu.kh", "campusadmin@ciaschool.edu.kh", "agent2@ciaschool.edu.kh"] },
          passwordHash: null,
        },
        data: { passwordHash: await bcrypt.hash(samplePassword, 12) },
      });
    }
    const requesterPassword = process.env.SEED_REQUESTER_PASSWORD || samplePassword;
    if (requesterPassword) {
      await prisma.user.updateMany({
        where: { email: requesterEmail, passwordHash: null },
        data: { passwordHash: await bcrypt.hash(requesterPassword, 12) },
      });
    }
  }

  // Starter help articles, only on a fresh install so edits and deletions survive re-seeding.
  if ((await prisma.kbArticle.count()) === 0) {
    const topicId = async (name: string) => (await prisma.helpTopic.findUnique({ where: { name } }))?.id ?? null;
    await prisma.kbArticle.createMany({
      data: [
        {
          title: "Connect to the student Wi‑Fi",
          helpTopicId: await topicId("Student Wifi"),
          isPublished: true,
          createdById: admin.id,
          body: "1. Open Wi‑Fi settings and choose the student network.\n2. Sign in with your school email and password.\n3. If it says \"can't join\", choose Forget this network and join again.\n\nStill slow or not connecting? Restart the device, then open a ticket with your room number.",
        },
        {
          title: "Printer shows offline or won't print",
          helpTopicId: await topicId("Printer Setup"),
          isPublished: true,
          createdById: admin.id,
          body: "1. Check the printer is on and has paper.\n2. On your computer, remove the stuck jobs from the print queue.\n3. Turn the printer off for 30 seconds, then on again.\n\nIf it still shows offline, open a ticket and include the printer's name or room.",
        },
        {
          title: "Reset a forgotten password",
          helpTopicId: await topicId("Email & Accounts"),
          isPublished: true,
          createdById: admin.id,
          body: "Go to the school sign-in page and choose Forgot password. A reset link is sent to your recovery email or phone.\n\nNo recovery option set up? Open a ticket under Email & Accounts and IT will verify your identity and reset it.",
        },
      ],
    });
  }

  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: teamIds.get("Infrastructure Team")!, userId: admin.id } },
    update: { isLead: true },
    create: { teamId: teamIds.get("Infrastructure Team")!, userId: admin.id, isLead: true },
  });

  console.log(
    `Seeded ${departments.length} departments, ${teams.length} teams, ${slaPolicies.length} SLA policies, ` +
      `${helpTopics.length} help topics, ${campuses.length} campuses; superadmin: ${adminEmail}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
