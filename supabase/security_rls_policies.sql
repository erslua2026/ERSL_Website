-- ============================================================================
-- ERSL Portal — Supabase Row-Level Security (RLS) & Role Escalation Hardening
-- Run this script once in the Supabase Dashboard -> SQL Editor.
-- ============================================================================

-- 1. Helper functions for role checking without RLS recursion
CREATE OR REPLACE FUNCTION public.ersl_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.ersl_is_approved_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'member')
  );
$$;

-- ============================================================================
-- 2. PROFILES TABLE: Prevent self-promotion to admin/member & allow 'collaborator'
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'member', 'collaborator', 'pending'));

DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;

-- Authenticated users can read their own profile; admins & approved members can list lab roster
CREATE POLICY "profiles_select_policy"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.ersl_is_approved_member());

-- New users may only insert their own row with role = 'pending' (unless an admin inserts it)
CREATE POLICY "profiles_insert_policy"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  public.ersl_is_admin()
  OR (id = auth.uid() AND role = 'pending')
);

-- Users can update their own non-privilege fields; only admins can change any user's role
CREATE POLICY "profiles_update_policy"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid() OR public.ersl_is_admin())
WITH CHECK (
  public.ersl_is_admin()
  OR (
    id = auth.uid()
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  )
);

CREATE POLICY "profiles_delete_policy"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.ersl_is_admin());

-- ============================================================================
-- 3. RESERVOIR_MATRIX KEY-VALUE TABLE: Split Public vs Member vs Admin keys
-- ============================================================================
ALTER TABLE public.reservoir_matrix ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reservoir_matrix_public_read" ON public.reservoir_matrix;
DROP POLICY IF EXISTS "reservoir_matrix_member_read" ON public.reservoir_matrix;
DROP POLICY IF EXISTS "reservoir_matrix_write_policy" ON public.reservoir_matrix;
DROP POLICY IF EXISTS "reservoir_matrix_update_policy" ON public.reservoir_matrix;
DROP POLICY IF EXISTS "reservoir_matrix_delete_policy" ON public.reservoir_matrix;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.reservoir_matrix;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.reservoir_matrix;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.reservoir_matrix;

-- Public keys readable by anyone (including unauthenticated visitors)
CREATE POLICY "reservoir_matrix_public_read"
ON public.reservoir_matrix
FOR SELECT
TO anon, authenticated
USING (
  id IN (
    'ersl_site_config',
    'ersl_custom_pages',
    'ersl_sec_home',
    'ersl_sec_research',
    'ersl_sec_publications',
    'ersl_sec_instruments',
    'ersl_sec_people',
    'ersl_sec_news',
    'ersl_subpage_themes',
    'ersl_subpage_instruments',
    'ersl_subpage_projects'
  )
);

-- Private internal lab workspace keys readable only by approved members/admins
CREATE POLICY "reservoir_matrix_member_read"
ON public.reservoir_matrix
FOR SELECT
TO authenticated
USING (
  public.ersl_is_approved_member()
  AND id IN (
    'ersl_workplan_matrix',
    'ersl_reservoir_matrix',
    'ersl_sec_bulletins',
    'ersl_sec_bulletin_folders',
    'ersl_sec_teaching',
    'ersl_professional_hub',
    'ersl_professional_posts',
    'ersl_subpage_students'
  )
);

-- Audit logs readable only by admins
CREATE POLICY "reservoir_matrix_admin_read"
ON public.reservoir_matrix
FOR SELECT
TO authenticated
USING (
  public.ersl_is_admin()
  AND id = 'ersl_sec_auditlogs'
);

-- Approved members can insert/update operational workspace & content keys;
-- site customization, audit logs, and people roster edits require Admin.
CREATE POLICY "reservoir_matrix_write_policy"
ON public.reservoir_matrix
FOR INSERT
TO authenticated
WITH CHECK (
  public.ersl_is_admin()
  OR (
    public.ersl_is_approved_member()
    AND id NOT IN (
      'ersl_site_config',
      'ersl_custom_pages',
      'ersl_sec_auditlogs',
      'ersl_sec_people'
    )
  )
);

CREATE POLICY "reservoir_matrix_update_policy"
ON public.reservoir_matrix
FOR UPDATE
TO authenticated
USING (
  public.ersl_is_admin()
  OR (
    public.ersl_is_approved_member()
    AND id NOT IN (
      'ersl_site_config',
      'ersl_custom_pages',
      'ersl_sec_auditlogs',
      'ersl_sec_people'
    )
  )
)
WITH CHECK (
  public.ersl_is_admin()
  OR (
    public.ersl_is_approved_member()
    AND id NOT IN (
      'ersl_site_config',
      'ersl_custom_pages',
      'ersl_sec_auditlogs',
      'ersl_sec_people'
    )
  )
);

CREATE POLICY "reservoir_matrix_delete_policy"
ON public.reservoir_matrix
FOR DELETE
TO authenticated
USING (public.ersl_is_admin());

-- ============================================================================
-- 4. BOX_FOLDERS TABLE: Public vs Private visibility enforcement
-- ============================================================================
ALTER TABLE public.box_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.box_folders DROP CONSTRAINT IF EXISTS box_folders_visibility_check;

DROP POLICY IF EXISTS "box_folders_select_policy" ON public.box_folders;
DROP POLICY IF EXISTS "box_folders_admin_write" ON public.box_folders;
DROP POLICY IF EXISTS "box_folders_admin_update" ON public.box_folders;
DROP POLICY IF EXISTS "box_folders_admin_delete" ON public.box_folders;

CREATE POLICY "box_folders_select_policy"
ON public.box_folders
FOR SELECT
TO anon, authenticated
USING (
  visibility = 'public'
  OR (visibility = 'admin' AND public.ersl_is_admin())
  OR (visibility IN ('private', 'members') AND public.ersl_is_approved_member())
);

CREATE POLICY "box_folders_admin_write"
ON public.box_folders
FOR INSERT
TO authenticated
WITH CHECK (public.ersl_is_admin());

CREATE POLICY "box_folders_admin_update"
ON public.box_folders
FOR UPDATE
TO authenticated
USING (public.ersl_is_admin())
WITH CHECK (public.ersl_is_admin());

CREATE POLICY "box_folders_admin_delete"
ON public.box_folders
FOR DELETE
TO authenticated
USING (public.ersl_is_admin());
