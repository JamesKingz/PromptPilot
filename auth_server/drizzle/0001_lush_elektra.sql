ALTER TABLE "users" ADD COLUMN "prompt_history_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "prompt_retention_days" integer DEFAULT 30 NOT NULL;