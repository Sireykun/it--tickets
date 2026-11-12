import { SearchX } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="border-b border-border bg-surface px-4 py-3 sm:px-6">
        <Link href="/go" className="inline-flex">
          <Brand subtitle="IT Help Desk" />
        </Link>
      </header>
      <main className="grid flex-1 place-items-center px-4 py-10">
        <EmptyState icon={<SearchX className="size-7" />} title="Page not found">
          <p>This ticket or page doesn't exist, or you don't have access to it.</p>
          <LinkButton href="/go" className="mt-4">
            Go to my tickets
          </LinkButton>
        </EmptyState>
      </main>
    </div>
  );
}
