-- Drop all versions of the function if they exist (needed if return type changes)
DROP FUNCTION IF EXISTS report_slop(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS report_slop(TEXT, TEXT, TEXT, TEXT);

-- Create updated RPC function to report slop with optional user identifier
CREATE FUNCTION report_slop(
  p_item_id TEXT,
  p_platform TEXT,
  p_reporter_hash TEXT,
  p_user_identifier TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_report_count INTEGER;
  v_domain TEXT;
BEGIN
  -- Insert report if it doesn't exist (handles unique constraint)
  INSERT INTO slop_reports (item_id, platform, reporter_hash)
  VALUES (p_item_id, p_platform, p_reporter_hash)
  ON CONFLICT (item_id, platform, reporter_hash) DO NOTHING;

  -- If user_identifier is provided and platform is not 'website', update slop_users
  IF p_user_identifier IS NOT NULL AND p_user_identifier != '' AND p_platform != 'website' THEN
    INSERT INTO slop_users (user_identifier, platform, slop_count, first_seen_at, last_seen_at, updated_at)
    VALUES (p_user_identifier, p_platform, 1, NOW(), NOW(), NOW())
    ON CONFLICT (user_identifier, platform) 
    DO UPDATE SET 
      slop_count = slop_users.slop_count + 1,
      last_seen_at = NOW(),
      updated_at = NOW();
  END IF;

  -- If platform is 'website', extract domain and update slop_websites
  IF p_platform = 'website' THEN
    -- Extract domain from URL (p_item_id contains the URL for websites)
    BEGIN
      v_domain := regexp_replace(
        regexp_replace(p_item_id, '^https?://', '', 'i'),
        '/.*$', '', 'g'
      );
      -- Remove www. prefix for consistency
      v_domain := regexp_replace(v_domain, '^www\.', '', 'i');
      
      IF v_domain IS NOT NULL AND v_domain != '' THEN
        INSERT INTO slop_websites (domain, slop_count, first_seen_at, last_seen_at, updated_at)
        VALUES (v_domain, 1, NOW(), NOW(), NOW())
        ON CONFLICT (domain) 
        DO UPDATE SET 
          slop_count = slop_websites.slop_count + 1,
          last_seen_at = NOW(),
          updated_at = NOW();
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- If domain extraction fails, continue without updating slop_websites
        NULL;
    END;
  END IF;

  -- Get the report count for this item
  SELECT COUNT(*) INTO v_report_count
  FROM slop_reports
  WHERE item_id = p_item_id AND platform = p_platform;

  RETURN v_report_count;
END;
$$;
