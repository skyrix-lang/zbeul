CREATE TABLE "card_likes" (
	"card_id" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "reasons" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "card_likes" ADD CONSTRAINT "card_likes_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;