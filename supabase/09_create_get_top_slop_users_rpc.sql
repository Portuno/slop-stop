-- Drop function if it exists
DROP FUNCTION IF EXISTS get_top_slop_users(TEXT, INTEGER);

-- Create RPC function to get top users with most slops
CREATE FUNCTION get_top_slop_users(
  p_platform TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Build query based on whether platform filter is provided
  IF p_platform IS NOT NULL THEN
    -- Filter by platform
    SELECT json_agg(
      json_build_object(
        'user_identifier', user_identifier,
        'platform', platform,
        'slop_count', slop_count,
        'first_seen_at', first_seen_at,
        'last_seen_at', last_seen_at
      )
      ORDER BY slop_count DESC, last_seen_at DESC
    )
    INTO v_result
    FROM slop_users
    WHERE platform = p_platform
    ORDER BY slop_count DESC, last_seen_at DESC
    LIMIT p_limit;
  ELSE
    -- No platform filter, return top users across all platforms
    SELECT json_agg(
      json_build_object(
        'user_identifier', user_identifier,
        'platform', platform,
        'slop_count', slop_count,
        'first_seen_at', first_seen_at,
        'last_seen_at', last_seen_at
      )
      ORDER BY slop_count DESC, last_seen_at DESC
    )
    INTO v_result
    FROM slop_users
    ORDER BY slop_count DESC, last_seen_at DESC
    LIMIT p_limit;
  END IF;

  -- Return empty array if no results
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
