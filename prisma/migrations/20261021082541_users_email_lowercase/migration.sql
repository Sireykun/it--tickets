-- Hand-written: emails are unique case-insensitively, so they must be stored lowercased.
UPDATE "users" SET "email" = lower("email") WHERE "email" <> lower("email");

ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_check" CHECK ("email" = lower("email"));
