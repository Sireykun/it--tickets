import { PageHeader } from "@/components/ui/misc";
import { isSuperadmin, requireUserManager } from "@/server/authz";
import { PeopleTabs } from "./people-tabs";

// Users and Campuses under one heading. Campus admins only reach Users,
// so they get no tab bar; each page still enforces its own access.
export default async function PeopleLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireUserManager();
  return (
    <>
      <PageHeader title="People" subtitle="Who can sign in, and which campuses they work at." />
      {isSuperadmin(actor) && <PeopleTabs />}
      {children}
    </>
  );
}
