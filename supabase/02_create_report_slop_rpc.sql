-- Drop function if it exists (needed if return type changes)
DROP FUNCTION IF EXISTS report_slop(TEXT, TEXT, TEXT);

-- Create RPC function to report slop
CREATE FUNCTION report_slop(
  p_item_id TEXT,
  p_platform TEXT,
  p_reporter_hash TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_report_count INTEGER;
BEGIN
  -- Insert report if it doesn't exist (handles unique constraint)
  INSERT INTO slop_reports (item_id, platform, reporter_hash)
  VALUES (p_item_id, p_platform, p_reporter_hash)
  ON CONFLICT (item_id, platform, reporter_hash) DO NOTHING;

  -- Get the report count for this item
  SELECT COUNT(*) INTO v_report_count
  FROM slop_reports
  WHERE item_id = p_item_id AND platform = p_platform;

  RETURN v_report_count;
END;
$$;
