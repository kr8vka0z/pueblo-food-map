-- migrations/0024_reject_undoes_new_alias.sql
--
-- Venue Data Rebuild step 2: a strong Care and Share match links itself
-- (writes venue_id_aliases) the run it is first found, and that run's
-- proposal carries proposed_diff.meta.new_alias (scripts/refresh/
-- careAndShare.ts). If Kyle rejects that proposal, the link was wrong too:
-- this trigger deletes exactly that alias row, so the listing is matched
-- afresh next run instead of staying tied to the wrong venue.
--
-- A trigger rather than a second statement in the reject route, so every
-- path that sets status = 'rejected' undoes the link, in the same
-- statement. NOTE for any future rebuild of change_proposals (0020 did
-- one): DROP TABLE drops this trigger; re-create it after the rename.
-- Idempotent (IF NOT EXISTS).

CREATE TRIGGER IF NOT EXISTS trg_reject_undoes_new_alias
AFTER UPDATE OF status ON change_proposals
WHEN NEW.status = 'rejected' AND OLD.status != 'rejected'
  AND json_extract(NEW.proposed_diff, '$.meta.new_alias.upstream_id') IS NOT NULL
BEGIN
  DELETE FROM venue_id_aliases
  WHERE source = NEW.source
    AND venue_id = NEW.target_venue_id
    AND upstream_id = json_extract(NEW.proposed_diff, '$.meta.new_alias.upstream_id');
END;
