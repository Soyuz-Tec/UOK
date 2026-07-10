BEGIN;

ALTER TABLE planning_resources
    ADD COLUMN IF NOT EXISTS resource_type TEXT NOT NULL DEFAULT 'human',
    ADD COLUMN IF NOT EXISTS capacity_value NUMERIC(14,3) NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS capacity_unit TEXT NOT NULL DEFAULT 'fte',
    ADD COLUMN IF NOT EXISTS canonical_target_kind TEXT,
    ADD COLUMN IF NOT EXISTS canonical_target_id TEXT,
    ADD COLUMN IF NOT EXISTS effective_start DATE,
    ADD COLUMN IF NOT EXISTS effective_end DATE;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_planning_resources_resource_type') THEN
        ALTER TABLE planning_resources ADD CONSTRAINT ck_planning_resources_resource_type
            CHECK (resource_type IN ('human','team','vehicle','equipment','material','budget','time_window','document','location','asset','custom'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_planning_resources_capacity_positive') THEN
        ALTER TABLE planning_resources ADD CONSTRAINT ck_planning_resources_capacity_positive CHECK (capacity_value > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_planning_resources_type_capacity_unit') THEN
        ALTER TABLE planning_resources ADD CONSTRAINT ck_planning_resources_type_capacity_unit CHECK (
            (resource_type = 'human' AND capacity_unit IN ('fte','hours_per_day','percent')) OR
            (resource_type = 'team' AND capacity_unit IN ('fte','people','hours_per_day','percent')) OR
            (resource_type IN ('vehicle','equipment','document','location','asset','custom') AND capacity_unit IN ('units','hours_per_day','percent')) OR
            (resource_type = 'material' AND capacity_unit IN ('units','kg','tonnes','liters')) OR
            (resource_type = 'budget' AND capacity_unit = 'currency') OR
            (resource_type = 'time_window' AND capacity_unit IN ('hours_per_day','percent'))
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_planning_resources_canonical_pair') THEN
        ALTER TABLE planning_resources ADD CONSTRAINT ck_planning_resources_canonical_pair
            CHECK ((canonical_target_kind IS NULL) = (canonical_target_id IS NULL));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_planning_resources_canonical_kind') THEN
        ALTER TABLE planning_resources ADD CONSTRAINT ck_planning_resources_canonical_kind CHECK (
            canonical_target_kind IS NULL OR canonical_target_kind IN ('party','document','location','asset','agreement','calendar_event')
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_planning_resources_type_canonical_kind') THEN
        ALTER TABLE planning_resources ADD CONSTRAINT ck_planning_resources_type_canonical_kind CHECK (
            canonical_target_kind IS NULL OR
            (resource_type IN ('human','team') AND canonical_target_kind = 'party') OR
            (resource_type IN ('vehicle','equipment','material','asset') AND canonical_target_kind = 'asset') OR
            (resource_type = 'budget' AND canonical_target_kind = 'agreement') OR
            (resource_type = 'time_window' AND canonical_target_kind = 'calendar_event') OR
            (resource_type = 'document' AND canonical_target_kind = 'document') OR
            (resource_type = 'location' AND canonical_target_kind = 'location') OR
            resource_type = 'custom'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_planning_resources_effective_order') THEN
        ALTER TABLE planning_resources ADD CONSTRAINT ck_planning_resources_effective_order
            CHECK (effective_end IS NULL OR effective_start IS NULL OR effective_end >= effective_start);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_planning_core_resources_org_project_type
    ON planning_resources (organization_id, project_id, resource_type);
CREATE INDEX IF NOT EXISTS ix_planning_core_resources_org_canonical
    ON planning_resources (organization_id, canonical_target_kind, canonical_target_id);

COMMIT;
