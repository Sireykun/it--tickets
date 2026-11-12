import type { Metadata } from "next";
import { ANNOUNCEMENT_LEVEL_LABEL, type AnnouncementLevel } from "@/lib/announcements";
import { formatDateTime } from "@/lib/format";
import { toLocalInputValue } from "@/lib/time";
import { requireSuperadmin } from "@/server/authz";
import { prisma } from "@/server/prisma";
import { AnnouncementForm } from "../admin-forms";
import { AdminPage, editTarget } from "../entity-list";

export const metadata: Metadata = { title: "Announcements" };

export default async function AnnouncementsPage({ searchParams }: PageProps<"/staff/admin/announcements">) {
  await requireSuperadmin();
  const sp = await searchParams;
  const showInactive = sp.inactive === "1";
  const [announcements, campuses] = await Promise.all([
    prisma.announcement.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "desc" }], include: { campus: { select: { name: true } } } }),
    prisma.campus.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
  ]);
  const target = editTarget(sp.edit, announcements);
  const now = new Date();
  // An ended notice is hidden from requesters but stays listed here so it can be extended.
  const isEnded = (a: { endsAt: Date | null }) => a.endsAt !== null && a.endsAt <= now;

  return (
    <AdminPage
      title="Announcements"
      subtitle="Notices on the requester home page, such as outages and planned work."
      newLabel="New announcement"
      basePath="/staff/admin/announcements"
      saved={sp.saved === "1"}
      deleted={sp.deleted === "1"}
      inactiveToggle={{
        count: announcements.filter((a) => !a.isActive).length,
        isShown: showInactive,
        href: showInactive ? "/staff/admin/announcements" : "/staff/admin/announcements?inactive=1",
      }}
      selectedId={target.item?.id}
      editTitle={target.item ? `Edit ${target.item.title}` : "New announcement"}
      form={
        target.show ? (
          <AnnouncementForm
            key={target.item?.id ?? "new"}
            announcement={
              target.item && {
                id: target.item.id,
                title: target.item.title,
                body: target.item.body,
                level: target.item.level as AnnouncementLevel,
                campusId: target.item.campusId,
                endsAtLocal: toLocalInputValue(target.item.endsAt),
                isActive: target.item.isActive,
              }
            }
            campuses={campuses}
          />
        ) : undefined
      }
      rows={announcements
        .filter((a) => showInactive || a.isActive)
        .map((a) => ({
          id: a.id,
          title: a.title,
          subtitle: `${ANNOUNCEMENT_LEVEL_LABEL[a.level as AnnouncementLevel]} · ${a.campus?.name ?? "All campuses"}`,
          meta: isEnded(a) ? "Ended" : a.endsAt ? `Until ${formatDateTime(a.endsAt)}` : "No end date",
          inactive: !a.isActive,
        }))}
    />
  );
}
