-- Add Figma export tracking to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS figma_exports_count INTEGER NOT NULL DEFAULT 0;

-- Create index for figma exports count
CREATE INDEX IF NOT EXISTS idx_users_figma_exports ON users(figma_exports_count);

-- Drop existing function first
DROP FUNCTION IF EXISTS get_user_limits(uuid);

-- Update get_user_limits function to include Figma export limits
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
  
  CASE v_tier
    WHEN 'free' THEN
      RETURN QUERY SELECT 5, 100, 1, 0, FALSE;
    WHEN 'pro' THEN
      RETURN QUERY SELECT 20, 100, 10, 10, TRUE;
    WHEN 'enterprise' THEN
      RETURN QUERY SELECT 100, 1000, 100, 100, TRUE;
    WHEN 'enterprise_plus' THEN
      RETURN QUERY SELECT 200, 2000, 500, 300, TRUE;
    ELSE
      RETURN QUERY SELECT 5, 100, 1, 0, FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can export to Figma
CREATE OR REPLACE FUNCTION can_export_to_figma(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_count INTEGER;
  v_max_exports INTEGER;
  v_can_export BOOLEAN;
BEGIN
  SELECT figma_exports_count INTO v_current_count FROM users WHERE id = p_user_id;
  SELECT max_figma_exports, can_export_figma INTO v_max_exports, v_can_export FROM get_user_limits(p_user_id);
  
  -- If unlimited exports (max = -1) or within limit
  RETURN v_can_export AND (v_max_exports = -1 OR v_current_count < v_max_exports);
END;
$$ LANGUAGE plpgsql;

-- Function to increment Figma export counter
CREATE OR REPLACE FUNCTION increment_figma_export(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE users SET figma_exports_count = figma_exports_count + 1 WHERE id = p_user_id;
  
  INSERT INTO usage_analytics (user_id, event_type, metadata)
  VALUES (p_user_id, 'figma_export', '{"source": "export_to_figma"}'::jsonb);
END;
$$ LANGUAGE plpgsql;
