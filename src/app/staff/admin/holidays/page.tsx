import type { Metadata } from "next";
import { Card } from "@/components/ui/misc";
import { isSeason, SEASON_INFO } from "@/lib/holidays";
import { requireSuperadmin } from "@/server/authz";
import { getActiveSeason, getHolidaySettings } from "@/server/holidays";
import { HolidayModeForm, HolidayWindowForm } from "../admin-forms";
import { AdminPage, editTarget } from "../entity-list";

export const metadata: Metadata = { title: "Holiday themes" };

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default async function HolidaysPage({ searchParams }: PageProps<"/staff/admin/holidays">) {
  const actor = await requireSuperadmin();
  const sp = await searchParams;
  const [{ mode, windows }, active] = await Promise.all([getHolidaySettings(actor), getActiveSeason()]);
  const target = editTarget(sp.edit, windows);

  return (
    <AdminPage
      title="Holiday themes"
      subtitle="Khmer holiday colors, greeting and decorations on the login page and staff console."
      newLabel="Add dates"
      basePath="/staff/admin/holidays"
      saved={sp.saved === "1"}
      deleted={sp.deleted === "1"}
      selectedId={target.item?.id}
      editTitle={target.item ? "Edit holiday dates" : "Add holiday dates"}
      form={target.show ? <HolidayWindowForm key={target.item?.id ?? "new"} holiday={target.item} /> : undefined}
      toolbar={
        <Card className="mb-4 p-4 sm:p-5">
          <HolidayModeForm key={mode} mode={mode} />
          <p className="mt-2 text-sm text-muted">
            Showing today: <strong className="text-text">{active ? SEASON_INFO[active].name : "No holiday theme"}</strong>.
            Pchum Ben and the Water Festival follow the lunar calendar, so add next year&apos;s dates once they&apos;re announced.
          </p>
        </Card>
      }
      rows={windows.map((w) => ({
        id: w.id,
        title: isSeason(w.season) ? SEASON_INFO[w.season].name : w.season,
        subtitle: `${DAY.format(new Date(`${w.startsOn}T00:00:00Z`))} – ${DAY.format(new Date(`${w.endsOn}T00:00:00Z`))}`,
        meta: isSeason(w.season) ? <span lang="km">{SEASON_INFO[w.season].nameKm}</span> : undefined,
      }))}
    />
  );
}
