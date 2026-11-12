// Notices from IT on the requester home page. Level keys are also the CHECK values in the
// announcements migration.

export const ANNOUNCEMENT_LEVELS = ["info", "warning", "outage"] as const;
export type AnnouncementLevel = (typeof ANNOUNCEMENT_LEVELS)[number];

export const ANNOUNCEMENT_LEVEL_LABEL: Record<AnnouncementLevel, string> = {
  info: "Information",
  warning: "Needs attention",
  outage: "Outage",
};
