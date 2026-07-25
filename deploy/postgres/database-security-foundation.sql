\set ON_ERROR_STOP on

-- UOK-3.1.0-alpha.3
-- PostgreSQL least-privilege and tenant-policy foundation.
--
-- This script deliberately creates policies without enabling RLS. Enabling
-- RLS before the API sets trusted transaction-local actor context would break
-- authentication and could leak context across pooled connections. Use
-- scripts/verify_database_security.py --live after applying this foundation.

BEGIN;

DO $uok_roles$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'uok_owner') THEN
        CREATE ROLE uok_owner;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'uok_migrator') THEN
        CREATE ROLE uok_migrator;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'uok_runtime') THEN
        CREATE ROLE uok_runtime;
    END IF;
END
$uok_roles$;

ALTER ROLE uok_owner
    NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT
    NOREPLICATION NOBYPASSRLS;
ALTER ROLE uok_migrator
    NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT
    NOREPLICATION NOBYPASSRLS;
ALTER ROLE uok_runtime
    NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT
    NOREPLICATION NOBYPASSRLS;

-- Converge every incoming and outgoing edge involving the protected roles.
-- Deployment logins are granted only after this foundation passes.
DO $uok_role_memberships$
DECLARE
    membership record;
BEGIN
    FOR membership IN
        SELECT granted.rolname AS role_name, member.rolname AS member_name
        FROM pg_auth_members AS edge
        JOIN pg_roles AS granted ON granted.oid = edge.roleid
        JOIN pg_roles AS member ON member.oid = edge.member
        WHERE granted.rolname IN ('uok_owner', 'uok_migrator', 'uok_runtime')
           OR member.rolname IN ('uok_owner', 'uok_migrator', 'uok_runtime')
        ORDER BY granted.rolname, member.rolname
    LOOP
        EXECUTE format(
            'REVOKE %I FROM %I',
            membership.role_name,
            membership.member_name
        );
    END LOOP;
END
$uok_role_memberships$;

GRANT uok_owner TO uok_migrator
    WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;

DO $uok_database_grants$
BEGIN
    EXECUTE format(
        'GRANT CONNECT ON DATABASE %I TO uok_migrator, uok_runtime',
        current_database()
    );
END
$uok_database_grants$;

REVOKE ALL PRIVILEGES ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;

ALTER SCHEMA public OWNER TO uok_owner;

DO $uok_ownership$
DECLARE
    relation record;
BEGIN
    FOR relation IN
        SELECT n.nspname AS schema_name, c.relname AS relation_name, c.relkind
        FROM pg_class AS c
        JOIN pg_namespace AS n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p', 'S')
        ORDER BY
            CASE WHEN c.relkind IN ('r', 'p') THEN 0 ELSE 1 END,
            c.relname
    LOOP
        IF relation.relkind = 'S' THEN
            EXECUTE format(
                'ALTER SEQUENCE %I.%I OWNER TO uok_owner',
                relation.schema_name,
                relation.relation_name
            );
        ELSE
            EXECUTE format(
                'ALTER TABLE %I.%I OWNER TO uok_owner',
                relation.schema_name,
                relation.relation_name
            );
        END IF;
    END LOOP;
END
$uok_ownership$;

REVOKE ALL PRIVILEGES ON SCHEMA public FROM uok_runtime;
GRANT USAGE ON SCHEMA public TO uok_runtime;
REVOKE ALL PRIVILEGES
    ON ALL TABLES IN SCHEMA public FROM uok_runtime;
REVOKE ALL PRIVILEGES
    ON ALL SEQUENCES IN SCHEMA public FROM uok_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
    ON ALL TABLES IN SCHEMA public TO uok_runtime;
GRANT USAGE, SELECT
    ON ALL SEQUENCES IN SCHEMA public TO uok_runtime;

-- Identity and release metadata are not general application write surfaces.
REVOKE INSERT, UPDATE, DELETE
    ON TABLE public.organizations, public.users, public.schema_versions
    FROM uok_runtime;
GRANT SELECT
    ON TABLE public.organizations, public.users, public.schema_versions
    TO uok_runtime;

-- Schema-scoped defaults are additive and cannot cancel a global grant.
-- Remove every global Public/runtime table and sequence default first, then
-- rebuild the only declared schema-scoped defaults below.
ALTER DEFAULT PRIVILEGES FOR ROLE uok_owner
    REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE uok_owner
    REVOKE ALL ON TABLES FROM uok_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE uok_owner
    REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE uok_owner
    REVOKE ALL ON SEQUENCES FROM uok_runtime;

ALTER DEFAULT PRIVILEGES FOR ROLE uok_owner IN SCHEMA public
    REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE uok_owner IN SCHEMA public
    REVOKE ALL ON TABLES FROM uok_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE uok_owner IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO uok_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE uok_owner IN SCHEMA public
    REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE uok_owner IN SCHEMA public
    REVOKE ALL ON SEQUENCES FROM uok_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE uok_owner IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO uok_runtime;

-- Every directly tenant-owned table receives the same fail-closed policy.
-- Missing or empty context evaluates to NULL/false.
DO $uok_direct_policies$
DECLARE
    tenant_table record;
    existing_policy record;
BEGIN
    FOR tenant_table IN
        SELECT c.table_schema, c.table_name
        FROM information_schema.columns AS c
        JOIN information_schema.tables AS t
          ON t.table_schema = c.table_schema
         AND t.table_name = c.table_name
        WHERE c.table_schema = 'public'
          AND c.column_name = 'organization_id'
          AND t.table_type = 'BASE TABLE'
        ORDER BY c.table_name
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I NO FORCE ROW LEVEL SECURITY',
            tenant_table.table_schema,
            tenant_table.table_name
        );
        EXECUTE format(
            'ALTER TABLE %I.%I DISABLE ROW LEVEL SECURITY',
            tenant_table.table_schema,
            tenant_table.table_name
        );
        FOR existing_policy IN
            SELECT policyname
            FROM pg_policies
            WHERE schemaname = tenant_table.table_schema
              AND tablename = tenant_table.table_name
            ORDER BY policyname
        LOOP
            EXECUTE format(
                'DROP POLICY %I ON %I.%I',
                existing_policy.policyname,
                tenant_table.table_schema,
                tenant_table.table_name
            );
        END LOOP;
        EXECUTE format(
            'CREATE POLICY uok_tenant_isolation ON %I.%I '
            'AS PERMISSIVE FOR ALL TO uok_runtime '
            'USING (organization_id = NULLIF(current_setting('
            '''uok.organization_id'', true), '''')) '
            'WITH CHECK (organization_id = NULLIF(current_setting('
            '''uok.organization_id'', true), ''''))',
            tenant_table.table_schema,
            tenant_table.table_name
        );
    END LOOP;
END
$uok_direct_policies$;

DO $uok_global_policies$
DECLARE
    target_table text;
    existing_policy record;
BEGIN
    FOREACH target_table IN ARRAY ARRAY['organizations', 'users'] LOOP
        EXECUTE format(
            'ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY',
            target_table
        );
        EXECUTE format(
            'ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY',
            target_table
        );
        FOR existing_policy IN
            SELECT policyname
            FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = target_table
            ORDER BY policyname
        LOOP
            EXECUTE format(
                'DROP POLICY %I ON public.%I',
                existing_policy.policyname,
                target_table
            );
        END LOOP;
    END LOOP;

    CREATE POLICY uok_tenant_isolation ON public.organizations
        AS PERMISSIVE FOR ALL TO uok_runtime
        USING (
            id = NULLIF(current_setting('uok.organization_id', true), '')
        )
        WITH CHECK (
            id = NULLIF(current_setting('uok.organization_id', true), '')
        );

    CREATE POLICY uok_tenant_isolation ON public.users
        AS PERMISSIVE FOR ALL TO uok_runtime
        USING (
            EXISTS (
                SELECT 1
                FROM public.memberships AS membership
                WHERE membership.user_id = users.id
                  AND membership.organization_id = NULLIF(
                      current_setting('uok.organization_id', true),
                      ''
                  )
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1
                FROM public.memberships AS membership
                WHERE membership.user_id = users.id
                  AND membership.organization_id = NULLIF(
                      current_setting('uok.organization_id', true),
                      ''
                  )
            )
        );

    FOR existing_policy IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'schema_versions'
        ORDER BY policyname
    LOOP
        EXECUTE format(
            'DROP POLICY %I ON public.schema_versions',
            existing_policy.policyname
        );
    END LOOP;
    ALTER TABLE public.schema_versions NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE public.schema_versions DISABLE ROW LEVEL SECURITY;
END
$uok_global_policies$;

-- Deliberately absent:
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ... FORCE ROW LEVEL SECURITY;

COMMIT;
