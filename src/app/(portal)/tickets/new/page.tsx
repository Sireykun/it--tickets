import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/server/authz";
import { prisma } from "@/server/prisma";
import { ACCEPT_ATTRIBUTE } from "@/server/storage";
import { NewTicketForm } from "./new-ticket-form";

export const metadata: Metadata = { title: "New ticket" };

export default async function NewTicketPage() {
  await requireUser();
  const topics = await prisma.helpTopic.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, description: true },
  });

  return (
    <div className="max-w-2xl">
      <PageHeader title="New ticket" subtitle="Tell us what's wrong and we'll get back to you." />
      <NewTicketForm topics={topics} accept={ACCEPT_ATTRIBUTE} />
    </div>
  );
}
