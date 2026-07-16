BEGIN;

ALTER TABLE communication_threads
    ADD COLUMN IF NOT EXISTS archived_from_status VARCHAR(40),
    ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;

UPDATE communication_threads
SET archived_from_status = 'open'
WHERE status = 'archived' AND archived_from_status IS NULL;

UPDATE communication_threads
SET archived_from_status = NULL
WHERE status IN ('open', 'closed') AND archived_from_status IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_communication_thread_revision_positive'
          AND conrelid = 'communication_threads'::regclass
    ) THEN
        ALTER TABLE communication_threads
            ADD CONSTRAINT ck_communication_thread_revision_positive CHECK (revision >= 1);
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_communication_thread_archive_state'
          AND conrelid = 'communication_threads'::regclass
    ) THEN
        ALTER TABLE communication_threads
            ADD CONSTRAINT ck_communication_thread_archive_state CHECK (
                (status = 'archived' AND archived_from_status IN ('open', 'closed')) OR
                (status IN ('open', 'closed') AND archived_from_status IS NULL)
            );
    END IF;
END $$;

COMMIT;
