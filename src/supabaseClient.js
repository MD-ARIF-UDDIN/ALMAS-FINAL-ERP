import { createClient } from '@supabase/supabase-js';

// Retrieve Supabase credentials from Vite environment variables.
// These variables should be defined in a .env file at the root of the project:
// VITE_SUPABASE_URL=your-supabase-project-url
// VITE_SUPABASE_ANON_KEY=your-supabase-anon-public-key
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables are missing! Please create a .env file at the project root with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
