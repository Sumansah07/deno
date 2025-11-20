-- Create increment_usage RPC function
-- This function safely increments usage counters for users

-- Drop existing function if it exists (with any signature)
DROP FUNCTION IF EXISTS increment_usage CASCADE;

CREATE OR REPLACE FUNCTION increment_usage(
  p_user_id UUID,
  p_usage_type TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Increment the appropriate counter based on usage type
  CASE p_usage_type
    WHEN 'screen_created' THEN
      UPDATE users
      SET ai_generations_count = COALESCE(ai_generations_count, 0) + 1
      WHERE id = p_user_id;
    
    WHEN 'figma_export' THEN
      UPDATE users
      SET figma_exports_count = COALESCE(figma_exports_count, 0) + 1
      WHERE id = p_user_id;
    
    ELSE
      -- Unknown usage type, do nothing
      NULL;
  END CASE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_usage(UUID, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION increment_usage IS 'Safely increments usage counters for users';
