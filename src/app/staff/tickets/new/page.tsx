import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/server/authz";
import { prisma } from "@/server/prisma";
import { ACCEPT_ATTRIBUTE } from "@/server/storage";
import { StaffNewTicketForm } from "./staff-new-ticket-form";

export const metadata: Metadata = { title: "New ticket" };

export default async function StaffNewTicketPage() {
  const user = await requireStaff();
  const [topics, campuses] = await Promise.all([
    prisma.helpTopic.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.campus.findMany({
      where: { isActive: true, ...(user.campusScope === "all" ? {} : { id: { in: user.campusScope } }) },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return (
    <div className="max-w-3xl">
      <PageHeader title="New ticket" subtitle="Log a phone call, walk-in or email for someone." />
      <StaffNewTicketForm topics={topics} campuses={campuses} accept={ACCEPT_ATTRIBUTE} />
    </div>
  );
}
