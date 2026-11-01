// Khmer holiday themes for the login page and staff console. Season keys are also the
// `data-season` attribute values in globals.css and the CHECK values in the holiday_themes migration.

export const SEASONS = ["khmer-new-year", "pchum-ben", "bon-om-touk"] as const;
export type Season = (typeof SEASONS)[number];

export const HOLIDAY_MODES = ["auto", "off", ...SEASONS] as const;
export type HolidayMode = (typeof HOLIDAY_MODES)[number];

export const SEASON_INFO: Record<Season, { name: string; nameKm: string; greeting: string; greetingKm: string }> = {
  "khmer-new-year": {
    name: "Khmer New Year",
    nameKm: "បុណ្យចូលឆ្នាំខ្មែរ",
    greeting: "Happy Khmer New Year! Wishing you health, happiness and success.",
    greetingKm: "សួស្តីឆ្នាំថ្មី! សូមជូនពរឱ្យមានសុខភាពល្អ សុភមង្គល និងជោគជ័យ។",
  },
  // A festival for honouring ancestors, so the wish is for peace rather than "happy".
  "pchum-ben": {
    name: "Pchum Ben",
    nameKm: "បុណ្យភ្ជុំបិណ្ឌ",
    greeting: "Wishing you and your family peace this Pchum Ben.",
    greetingKm: "សូមជូនពរលោកអ្នក និងក្រុមគ្រួសារ សូមមានសេចក្តីសុខក្នុងឱកាសបុណ្យភ្ជុំបិណ្ឌ។",
  },
  "bon-om-touk": {
    name: "Water Festival",
    nameKm: "បុណ្យអុំទូក",
    greeting: "Happy Water Festival! Enjoy the boat races and celebrations.",
    greetingKm: "រីករាយបុណ្យអុំទូក បណ្តែតប្រទីប និងសំពះព្រះខែ អកអំបុក!",
  },
};

export type HolidayWindowDates = { season: string; startsOn: string; endsOn: string }; // "YYYY-MM-DD"

// "YYYY-MM-DD" strings compare correctly as text, so no Date parsing (and no timezone) is involved.
export function pickSeason(today: string, mode: string, windows: HolidayWindowDates[]): Season | null {
  if (mode === "off") return null;
  if (isSeason(mode)) return mode;
  const match = windows.find((w) => w.startsOn <= today && today <= w.endsOn && isSeason(w.season));
  return match ? (match.season as Season) : null;
}

export function isSeason(value: unknown): value is Season {
  return SEASONS.includes(value as Season);
}
