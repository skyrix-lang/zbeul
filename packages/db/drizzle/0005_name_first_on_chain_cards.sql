-- Chaîne and Valise cards named their first player at the end ("… [J1], tu
-- commences."), which read badly aloud. The name now comes first:
--   "[J1], tu commences. Chaîne : les pays d'Europe."
--   "[J1], tu commences : dans ma valise pour la plage, je mets…"
-- Only cards still written the old way are touched; each change is recorded
-- in the history, as the admin's own are.
WITH renamed AS (
  SELECT
    "id",
    "text" AS old_text,
    CASE
      WHEN "text" ~ '… \[J1\], tu commences\.$' THEN
        '[J1], tu commences : ' || lower(left("text", 1)) ||
        substr(regexp_replace("text", ' \[J1\], tu commences\.$', ''), 2)
      ELSE
        '[J1], tu commences. ' ||
        regexp_replace("text", ' \[J1\], tu commences\.$', '')
    END AS new_text
  FROM "cards"
  WHERE "game" IN ('chaine', 'valise')
    AND "text" ~ '^[^\[]+ \[J1\], tu commences\.$'
), updated AS (
  UPDATE "cards"
  SET "text" = renamed.new_text, "updated_at" = now()
  FROM renamed
  WHERE "cards"."id" = renamed."id"
  RETURNING "cards"."id"
)
INSERT INTO "card_changes" ("card_id", "admin_email", "action", "before", "after")
SELECT
  renamed."id",
  'migration',
  'updated',
  jsonb_build_object('text', renamed.old_text),
  jsonb_build_object('text', renamed.new_text)
FROM renamed
JOIN updated ON updated."id" = renamed."id";
