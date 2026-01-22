-- Drop function if it exists
DROP FUNCTION IF EXISTS get_user_slop_count(TEXT, TEXT);

-- Create RPC function to get slop count for a specific user
CREATE FUNCTION get_user_slop_count(
  p_user_identifier TEXT,
  p_platform TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slop_count INTEGER;
BEGIN
  -- Get the slop count for this user and platform
  SELECT COALESCE(slop_count, 0) INTO v_slop_count
  FROM slop_users
  WHERE user_identifier = p_user_identifier 
    AND platform = p_platform;

  -- Return 0 if user not found
  RETURN COALESCE(v_slop_count, 0);
END;
$$;
