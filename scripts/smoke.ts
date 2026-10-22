// End-to-end check of the schema through the generated client.
// Requires a migrated and seeded database. Cleans up the rows it creates.

import assert from "node:assert/strict";
import { createPrismaClient } from "../src/db.js";
import { Role, ThreadEntryType, TicketPriority } from "../src/generated/prisma/client.js";

const prisma = createPrismaClient();
const tag = `smoke-${Date.now()}`;
let passed = 0;

async function check(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
}

async function main() {
  const department = await prisma.department.findUniqueOrThrow({ where: { name: "IT Support" } });
  const topic = await prisma.helpTopic.findUniqueOrThrow({ where: { name: "Student Wifi" } });
  const agent = await prisma.user.findFirstOrThrow({ where: { role: { in: [Role.AGENT, Role.ADMIN] } } });

  const requester = await prisma.user.create({
    data: { email: `${tag}@example.test`, name: "Smoke Requester" },
  });

  const newTicket = (priority: TicketPriority) =>
    prisma.ticket.create({
      data: {
        subject: `${tag} ticket`,
        priority,
        requesterId: requester.id,
        departmentId: department.id,
        helpTopicId: topic.id,
        assignedTeamId: topic.defaultTeamId,
        assignedAgentId: agent.id,
        slaPolicyId: topic.slaPolicyId,
      },
    });

  try {
    const t1 = await newTicket(TicketPriority.EMERGENCY);
    const t2 = await newTicket(TicketPriority.NORMAL);

    await check("ticket numbers are formatted and sequential", async () => {
      assert.match(t1.ticketNumber, /^TKT-\d{6}$/);
      assert.match(t2.ticketNumber, /^TKT-\d{6}$/);
      assert.equal(Number(t2.ticketNumber.slice(4)), Number(t1.ticketNumber.slice(4)) + 1);
    });

    await check("priority_level is set from priority on insert", async () => {
      assert.equal(t1.priorityLevel, 4);
      assert.equal(t2.priorityLevel, 2);
    });

    await check("priority_level follows priority on update and ignores direct writes", async () => {
      const lowered = await prisma.ticket.update({ where: { id: t1.id }, data: { priority: TicketPriority.LOW } });
      assert.equal(lowered.priorityLevel, 1);
      const forced = await prisma.ticket.update({ where: { id: t1.id }, data: { priorityLevel: 99 } });
      assert.equal(forced.priorityLevel, 1);
    });

    await check("thread holds all three entry types with an attachment", async () => {
      await prisma.ticketThread.create({
        data: {
          ticketId: t1.id,
          authorId: requester.id,
          type: ThreadEntryType.CLIENT_MESSAGE,
          body: "Wifi drops every few minutes in room 204.",
          attachments: {
            create: {
              uploadedById: requester.id,
              fileName: "screenshot.png",
              mimeType: "image/png",
              sizeBytes: 5_000_000_000n, // > 2^32, exercises BIGINT
              storageKey: `${tag}/screenshot.png`,
              checksumSha256: "a".repeat(64),
            },
          },
        },
      });
      await prisma.ticketThread.create({
        data: { ticketId: t1.id, authorId: agent.id, type: ThreadEntryType.INTERNAL_NOTE, body: "Likely AP-3 overload." },
      });
      await prisma.ticketThread.create({
        data: { ticketId: t1.id, authorId: agent.id, type: ThreadEntryType.AGENT_REPLY, body: "We are looking into it." },
      });

      const full = await prisma.ticket.findUniqueOrThrow({
        where: { id: t1.id },
        include: {
          thread: { orderBy: { createdAt: "asc" }, include: { attachments: true } },
          requester: true,
          assignedAgent: true,
          assignedTeam: true,
          helpTopic: true,
          slaPolicy: true,
        },
      });
      assert.deepEqual(
        new Set(full.thread.map((e) => e.type)),
        new Set([ThreadEntryType.CLIENT_MESSAGE, ThreadEntryType.INTERNAL_NOTE, ThreadEntryType.AGENT_REPLY]),
      );
      assert.equal(full.thread[0].attachments[0].sizeBytes, 5_000_000_000n);
      assert.equal(full.assignedTeam?.name, "High School Team");
      assert.equal(full.slaPolicy?.name, "Standard");

      const visibleToRequester = await prisma.ticketThread.count({
        where: { ticketId: t1.id, type: { not: ThreadEntryType.INTERNAL_NOTE } },
      });
      assert.equal(visibleToRequester, 2);
    });

    await check("SLA hours must be positive", async () => {
      await assert.rejects(
        prisma.slaPolicy.create({ data: { name: `${tag} bad`, responseTimeHours: 0, resolutionTimeHours: 1 } }),
      );
    });

    await check("requester with tickets cannot be deleted", async () => {
      await assert.rejects(prisma.user.delete({ where: { id: requester.id } }));
    });

    await check("deleting a ticket cascades to thread and attachments", async () => {
      await prisma.ticket.delete({ where: { id: t1.id } });
      assert.equal(await prisma.ticketThread.count({ where: { ticketId: t1.id } }), 0);
      assert.equal(await prisma.attachment.count({ where: { storageKey: { startsWith: tag } } }), 0);
    });
  } finally {
    await prisma.ticket.deleteMany({ where: { requesterId: requester.id } });
    await prisma.user.delete({ where: { id: requester.id } });
  }

  console.log(`smoke: ${passed} checks passed`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
