import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/server/authz";
import { prisma } from "@/server/prisma";
import { ACCEPT_ATTRIBUTE } from "@/server/storage";
import { NewTicketForm } from "./new-ticket-form";

export const metadata: Metadata = { title: "New ticket" };

export default async function NewTicketPage() {
  const user = await requireUser();
  const [topics, campuses] = await Promise.all([
    prisma.helpTopic.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true },
    }),
    prisma.campus.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="max-w-2xl">
      <PageHeader title="New ticket" subtitle="Tell us what's wrong and we'll get back to you." />
      <NewTicketForm topics={topics} campuses={campuses} requester={{ name: user.name, email: user.email }} accept={ACCEPT_ATTRIBUTE} />
    </div>
  );
}
