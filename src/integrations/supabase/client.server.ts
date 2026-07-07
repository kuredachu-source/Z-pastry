// Server-side Supabase client with service role key - bypasses RLS.
// Use this for admin operations in server functions and server routes only.
// For user-authenticated queries (with RLS), use the auth middleware instead.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

const FALLBACK_SUPABASE_PROJECT_ID = 'lfhpprfwldwyaientkyo';

function createConfigurationError() {
  return new Error(
    'Supabase admin is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel Project Settings → Environment Variables, then redeploy.',
  );
}

function createNoopAdminClient(): SupabaseClient<Database> {
  const error = createConfigurationError();
  const result = { data: null, error };

  const builder = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === 'then') return Promise.resolve(result).then.bind(Promise.resolve(result));
        if (prop === 'catch') return Promise.resolve(result).catch.bind(Promise.resolve(result));
        if (prop === 'finally') return Promise.resolve(result).finally.bind(Promise.resolve(result));
        return () => builder;
      },
    },
  );

  return {
    from: () => builder,
    auth: { admin: {} },
  } as unknown as SupabaseClient<Database>;
}

function createSupabaseAdminClient(): SupabaseClient<Database> {
  const SUPABASE_URL = process.env.SUPABASE_URL || `https://${process.env.SUPABASE_PROJECT_ID || FALLBACK_SUPABASE_PROJECT_ID}.supabase.co`;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ['SUPABASE_URL'] : []),
      ...(!SUPABASE_SERVICE_ROLE_KEY ? ['SUPABASE_SERVICE_ROLE_KEY'] : []),
    ];
    const message = `Missing Supabase admin environment variable(s): ${missing.join(', ')}. Server admin features are disabled until these values are added in Vercel.`;
    console.warn(`[Supabase] ${message}`);
    return createNoopAdminClient();
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    }
  });
}

let _supabaseAdmin: SupabaseClient<Database> | undefined;

// Server-side Supabase client with service role - bypasses RLS
// SECURITY: Only use this for trusted server-side operations, never expose to client code
// Import like: import { supabaseAdmin } from "@/integrations/supabase/client.server";
export const supabaseAdmin = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
