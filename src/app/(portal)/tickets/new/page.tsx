import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/server/authz";
import { listArticles } from "@/server/kb";
import { prisma } from "@/server/prisma";
import { ACCEPT_ATTRIBUTE } from "@/server/storage";
import { NewTicketForm } from "./new-ticket-form";

export const metadata: Metadata = { title: "New ticket" };

export default async function NewTicketPage() {
  const user = await requireUser();
  const [topics, campuses, articles] = await Promise.all([
    prisma.helpTopic.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true, defaultPriority: true },
    }),
    prisma.campus.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    listArticles(user),
  ]);
  // Published guides per topic, offered before the requester writes the ticket.
  const guides = articles.flatMap((a) => (a.helpTopic ? [{ id: a.id, title: a.title, topicId: a.helpTopic.id }] : []));

  return (
    <div data-ticket-wizard className="mx-auto w-full max-w-3xl">
      <PageHeader title="New ticket" subtitle="Answer a few questions, one step at a time." />
      <NewTicketForm topics={topics} guides={guides} campuses={campuses} homeCampusId={user.campusId} requester={{ name: user.name, email: user.email }} accept={ACCEPT_ATTRIBUTE} />
    </div>
  );
}
