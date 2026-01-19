-- Drop function if it exists (needed if return type changes)
DROP FUNCTION IF EXISTS get_slop_status(TEXT, TEXT);

-- Create RPC function to get slop status
CREATE FUNCTION get_slop_status(
  p_item_id TEXT,
  p_platform TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_report_count INTEGER;
BEGIN
  -- Get the report count for this item
  SELECT COUNT(*) INTO v_report_count
  FROM slop_reports
  WHERE item_id = p_item_id AND platform = p_platform;

  -- Return JSON with report count
  RETURN json_build_object(
    'report_count', v_report_count,
    'is_slop', v_report_count > 0
  );
END;
$$;
