-- CreateTable
CREATE TABLE "holiday_windows" (
    "id" UUID NOT NULL,
    "season" TEXT NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "holiday_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holiday_theme_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "mode" TEXT NOT NULL DEFAULT 'auto',
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "holiday_theme_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "holiday_windows_starts_on_ends_on_idx" ON "holiday_windows"("starts_on", "ends_on");

-- Hand-written: keep in sync with SEASONS in src/lib/holidays.ts.
ALTER TABLE "holiday_windows"
    ADD CONSTRAINT "holiday_windows_season_check" CHECK ("season" IN ('khmer-new-year', 'pchum-ben', 'bon-om-touk')),
    ADD CONSTRAINT "holiday_windows_dates_check" CHECK ("ends_on" >= "starts_on");

ALTER TABLE "holiday_theme_settings"
    ADD CONSTRAINT "holiday_theme_settings_single_row_check" CHECK ("id" = 1),
    ADD CONSTRAINT "holiday_theme_settings_mode_check" CHECK ("mode" IN ('auto', 'off', 'khmer-new-year', 'pchum-ben', 'bon-om-touk'));
