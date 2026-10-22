import { requireSuperadmin } from "@/server/authz";
import type { Metadata } from "next";
import { PRIORITY_LABEL } from "@/lib/labels";
import { prisma } from "@/server/prisma";
import { HelpTopicForm } from "../admin-forms";
import { AdminPage, editTarget } from "../entity-list";

export const metadata: Metadata = { title: "Help topics" };

export default async function HelpTopicsPage({ searchParams }: PageProps<"/staff/admin/help-topics">) {
  await requireSuperadmin();
  const sp = await searchParams;
  const active = { where: { isActive: true }, orderBy: { name: "asc" as const }, select: { id: true, name: true } };
  const [topics, departments, teams, slas] = await Promise.all([
    prisma.helpTopic.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: { defaultTeam: { select: { name: true } }, slaPolicy: { select: { name: true } } },
    }),
    prisma.department.findMany(active),
    prisma.team.findMany(active),
    prisma.slaPolicy.findMany(active),
  ]);
  const target = editTarget(sp.edit, topics);

  return (
    <AdminPage
      title="Help topics"
      subtitle="What requesters choose from. Each sets the default priority, team and SLA."
      newLabel="New topic"
      basePath="/staff/admin/help-topics"
      saved={sp.saved === "1"}
      editTitle={target.item ? `Edit ${target.item.name}` : "New help topic"}
      form={target.show ? <HelpTopicForm key={target.item?.id ?? "new"} topic={target.item} departments={departments} teams={teams} slas={slas} /> : undefined}
      rows={topics.map((t) => ({
        id: t.id,
        title: t.name,
        subtitle: `${PRIORITY_LABEL[t.defaultPriority]} priority · ${t.defaultTeam?.name ?? "No team"} · ${t.slaPolicy?.name ?? "No SLA"}`,
        inactive: !t.isActive,
      }))}
    />
  );
}
