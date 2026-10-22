import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/server/authz";
import { prisma } from "@/server/prisma";
import { ACCEPT_ATTRIBUTE } from "@/server/storage";
import { NewTicketForm } from "./new-ticket-form";

export const metadata: Metadata = { title: "New ticket" };

export default async function NewTicketPage({ searchParams }: PageProps<"/tickets/new">) {
  const user = await requireUser();
  const sp = await searchParams;
  const [topics, campuses, articles] = await Promise.all([
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
    // Titles only: the form matches them against the subject as the requester types.
    prisma.kbArticle.findMany({
      where: { isPublished: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: { id: true, title: true, helpTopicId: true },
    }),
  ]);
  const initialTopicId = typeof sp.topic === "string" && topics.some((t) => t.id === sp.topic) ? sp.topic : "";

  return (
    <div className="max-w-2xl">
      <PageHeader title="New ticket" subtitle="Tell us what's wrong and we'll get back to you." />
      <NewTicketForm
        topics={topics}
        campuses={campuses}
        articles={articles}
        initialTopicId={initialTopicId}
        requester={{ name: user.name, email: user.email }}
        accept={ACCEPT_ATTRIBUTE}
      />
    </div>
  );
}
