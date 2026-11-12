CREATE TYPE "public"."card_audience" AS ENUM('gars', 'filles', 'autres');--> statement-breakpoint
CREATE TYPE "public"."card_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."content_theme" AS ENUM('contact', 'sexe', 'ex', 'couple', 'argent', 'avis', 'secrets', 'transgressions');--> statement-breakpoint
CREATE TYPE "public"."mini_game" AS ENUM('tu-preferes', 'jamais', 'action-verite', 'qui-pourrait', 'tribunal', 'duel', 'culture-g', 'chaine', 'valise', 'montre-ou-bois', 'tout-le-monde', 'sentence', 'regle', 'partenaire', 'pause');--> statement-breakpoint
CREATE TABLE "card_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" text NOT NULL,
	"admin_email" text NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" text PRIMARY KEY NOT NULL,
	"pack_id" text NOT NULL,
	"game" "mini_game" NOT NULL,
	"level" smallint NOT NULL,
	"text" text NOT NULL,
	"themes" "content_theme"[] DEFAULT '{}' NOT NULL,
	"audience" "card_audience",
	"double_tier" boolean DEFAULT false NOT NULL,
	"witness" boolean DEFAULT false NOT NULL,
	"rule_duration" smallint,
	"answer" text,
	"unit" text,
	"source" text,
	"status" "card_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_changes" ADD CONSTRAINT "card_changes_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_changes_card_id_idx" ON "card_changes" USING btree ("card_id","created_at");--> statement-breakpoint
CREATE INDEX "card_changes_created_at_idx" ON "card_changes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cards_status_idx" ON "cards" USING btree ("status");