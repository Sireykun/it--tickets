import clsx from "clsx";
import { Avatar } from "@/components/ui/misc";

export function ProfileAvatar({ name, hasPhoto, className }: { name: string; hasPhoto: boolean; className?: string }) {
  if (!hasPhoto) return <Avatar name={name} className={className} />;
  // Authenticated image route; Next's public image optimization cannot fetch it.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/api/account/avatar" alt={`${name}'s profile photo`} className={clsx("shrink-0 rounded-full border border-border object-cover", className)} />;
}
