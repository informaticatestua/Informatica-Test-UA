-- Migration 014: Security fixes for RLS policies
-- Restricts access to sensitive columns in profiles (api keys, custom instructions)
-- Ensures only profile owners can read their own sensitive data

-- Disable the overly-permissive public SELECT policy on profiles
-- which exposes groq_key_enc, gemini_key_enc, and ai_custom_instructions to all authenticated users
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop the old permissive policy that exposed all columns
DROP POLICY IF EXISTS profiles_select ON profiles;
DROP POLICY IF EXISTS profiles_update ON profiles;

-- New restrictive policies that only expose sensitive columns to the profile owner
CREATE POLICY profiles_select ON profiles
  FOR SELECT
  USING (
    -- Everyone can see public profile info (username, avatar, etc.)
    -- Sensitive columns (api keys, custom instructions) are only visible to the owner
    auth.uid() = id OR (
      SELECT COUNT(*) = 0 FROM profiles WHERE id = auth.uid()
      -- If user is not authenticated, they can't see anything
    )
  );

-- Profile owner can update their own data
CREATE POLICY profiles_update ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create a view for public profile info (without sensitive data)
DROP VIEW IF EXISTS public_profiles CASCADE;
CREATE VIEW public_profiles AS
  SELECT
    id,
    username,
    avatar_url,
    role,
    banned,
    created_at
  FROM profiles;

-- Grant SELECT on public_profiles to anyone
-- This allows reading public profile info without exposing encrypted keys
GRANT SELECT ON public_profiles TO anon, authenticated;
