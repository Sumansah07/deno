-- Fix RLS policies and create missing functions

-- 1. Fix screens table RLS (allow users to query their own screens)
DROP POLICY IF EXISTS "Users can view own screens" ON screens;
CREATE POLICY "Users can view own screens" ON screens
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own screens" ON screens;
CREATE POLICY "Users can insert own screens" ON screens
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own screens" ON screens;
CREATE POLICY "Users can update own screens" ON screens
  FOR UPDATE USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- 2. Create get_user_limits function
DROP FUNCTION IF EXISTS get_user_limits CASCADE;
CREATE OR REPLACE FUNCTION get_user_limits(user_id UUID)
RETURNS TABLE (
  max_projects INT,
  max_ai_generations INT,
  max_storage_mb INT,
  max_figma_exports INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_tier TEXT;
BEGIN
  -- Get user's subscription tier
  SELECT subscription_tier INTO user_tier
  FROM users
  WHERE id = user_id;

  -- Return limits based on tier
  CASE COALESCE(user_tier, 'free')
    WHEN 'pro' THEN
      RETURN QUERY SELECT 50, 10000, 5000, 500;
    WHEN 'enterprise' THEN
      RETURN QUERY SELECT 200, 1000, 20000, 2000;
    WHEN 'enterprise_plus' THEN
      RETURN QUERY SELECT 500, 2000, 50000, 5000;
    ELSE -- free tier
      RETURN QUERY SELECT 10, 10, 500, 10;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_limits(UUID) TO authenticated;

-- 3. Clean up duplicate screens before adding unique constraint
-- Keep only the most recent screen for each (project_id, name) pair
DELETE FROM screens
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY project_id, name 
             ORDER BY created_at DESC
           ) as rn
    FROM screens
  ) t
  WHERE t.rn > 1
);

-- 4. Add unique constraint on screens (project_id + name) if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'screens_project_id_name_key'
  ) THEN
    ALTER TABLE screens 
    ADD CONSTRAINT screens_project_id_name_key 
    UNIQUE (project_id, name);
  END IF;
END $$;
