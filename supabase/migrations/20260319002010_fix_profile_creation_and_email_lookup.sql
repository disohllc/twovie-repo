/*
  # Fix Profile Creation and Email Lookup Issues

  1. Changes
    - Create a trigger to automatically create profiles when users sign up
    - Add a function to handle profile creation from auth.users
    - Create an index on lower(email) for case-insensitive email lookups
    - Backfill any missing profiles from existing auth.users

  2. Security
    - Maintains existing RLS policies
    - Ensures all users have profiles automatically
*/

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create case-insensitive index for email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON profiles(LOWER(email));

-- Backfill profiles for any existing users without profiles
INSERT INTO public.profiles (id, email, display_name)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1))
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
