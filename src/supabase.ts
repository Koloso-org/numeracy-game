// Supabase client for Number Rules.
//
// Configuration comes from environment variables so no keys are committed to
// git. For Expo, variables prefixed with EXPO_PUBLIC_ are inlined into the app
// at build time. Put them in a `.env` file at the project root:
//
//   EXPO_PUBLIC_SUPABASE_URL=https://YOURPROJECT.supabase.co
//   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
//
// The anon key is safe to ship in a client app — the database is protected by
// Row Level Security (see supabase/schema.sql). The service_role key must NEVER
// go in the app.

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** True once the project URL + anon key are present. */
export const isSupabaseConfigured = Boolean(url && anonKey);

// A single shared client, created only when configured.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
