import { SearchX } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <EmptyState icon={<SearchX className="size-7" />} title="Page not found">
        <p>This ticket or page doesn't exist, or you don't have access to it.</p>
        <LinkButton href="/go" className="mt-4">
          Go to my tickets
        </LinkButton>
      </EmptyState>
    </main>
  );
}
