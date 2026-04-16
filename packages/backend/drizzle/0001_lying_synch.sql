ALTER TABLE "workflow_tasks" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."task_status";--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pending', 'assigned', 'in_progress', 'completed', 'failed', 'skipped');--> statement-breakpoint
ALTER TABLE "workflow_tasks" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."task_status";--> statement-breakpoint
ALTER TABLE "workflow_tasks" ALTER COLUMN "status" SET DATA TYPE "public"."task_status" USING "status"::"public"."task_status";--> statement-breakpoint
ALTER TABLE "workflows" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "workflows" ALTER COLUMN "status" SET DEFAULT 'created'::text;--> statement-breakpoint
DROP TYPE "public"."workflow_status";--> statement-breakpoint
CREATE TYPE "public"."workflow_status" AS ENUM('created', 'planning', 'in_progress', 'waiting_external', 'completed', 'failed', 'escalated');--> statement-breakpoint
ALTER TABLE "workflows" ALTER COLUMN "status" SET DEFAULT 'created'::"public"."workflow_status";--> statement-breakpoint
ALTER TABLE "workflows" ALTER COLUMN "status" SET DATA TYPE "public"."workflow_status" USING "status"::"public"."workflow_status";