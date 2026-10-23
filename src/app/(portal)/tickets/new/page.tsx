import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
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
      select: { id: true, name: true, description: true, defaultPriority: true },
    }),
    prisma.campus.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div data-ticket-wizard className="mx-auto w-full max-w-3xl">
      <Link href="/" className="mb-7 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-strong px-4 font-bold text-gold-text hover:bg-surface-2"><ArrowLeft className="size-5" aria-hidden /> Back to tickets</Link>
      <PageHeader title="New ticket" subtitle="Answer a few questions, one step at a time." />
      <NewTicketForm topics={topics} campuses={campuses} requester={{ name: user.name, email: user.email }} accept={ACCEPT_ATTRIBUTE} />
    </div>
  );
}
