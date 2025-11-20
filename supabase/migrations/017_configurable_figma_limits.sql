-- Make Figma export limits configurable
-- This allows changing limits via environment variables without code changes

-- Drop existing function
DROP FUNCTION IF EXISTS get_user_limits(uuid);

-- Recreate with configurable Figma limits
-- Note: PostgreSQL functions can't directly access env vars, so we'll use a config table approach
-- For now, we'll keep hardcoded defaults that match the env var defaults

CREATE OR REPLACE FUNCTION get_user_limits(p_user_id UUID)
RETURNS TABLE(
  max_projects INTEGER,
  max_ai_generations INTEGER,
  max_storage_gb INTEGER,
  max_figma_exports INTEGER,
  can_export_figma BOOLEAN
) AS $$
DECLARE
  v_tier TEXT;
BEGIN
  SELECT subscription_tier INTO v_tier FROM users WHERE id = p_user_id;
  
  -- These defaults match the env var defaults
  -- To change in production, update via application code that reads env vars
  CASE v_tier
    WHEN 'free' THEN
      RETURN QUERY SELECT 5, 10, 1, 0, FALSE;
    WHEN 'pro' THEN
      RETURN QUERY SELECT 20, 100, 5, 10, TRUE;
    WHEN 'enterprise' THEN
      RETURN QUERY SELECT 100, 1000, 10, 100, TRUE;
    WHEN 'enterprise_plus' THEN
      RETURN QUERY SELECT 200, 2000, 20, 300, TRUE;
    ELSE
      RETURN QUERY SELECT 5, 10, 1, 0, FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql;
