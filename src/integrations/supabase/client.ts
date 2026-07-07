import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

const FALLBACK_SUPABASE_PROJECT_ID = 'lfhpprfwldwyaientkyo';
const FALLBACK_SUPABASE_URL = `https://${FALLBACK_SUPABASE_PROJECT_ID}.supabase.co`;

export function getSupabaseConfig() {
  const viteProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const viteUrl = import.meta.env.VITE_SUPABASE_URL;
  const vitePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const nodeEnv = typeof process !== 'undefined' ? process.env : {};

  const projectId = viteProjectId || nodeEnv.SUPABASE_PROJECT_ID || FALLBACK_SUPABASE_PROJECT_ID;
  const url = viteUrl || nodeEnv.SUPABASE_URL || (projectId ? `https://${projectId}.supabase.co` : FALLBACK_SUPABASE_URL);
  const publishableKey = vitePublishableKey || nodeEnv.SUPABASE_PUBLISHABLE_KEY;

  return { projectId, url, publishableKey };
}

export function getMissingSupabaseEnv() {
  const { url, publishableKey } = getSupabaseConfig();
  return [
    ...(!url ? ['VITE_SUPABASE_URL / SUPABASE_URL'] : []),
    ...(!publishableKey ? ['VITE_SUPABASE_PUBLISHABLE_KEY / SUPABASE_PUBLISHABLE_KEY'] : []),
  ];
}

export function isSupabaseConfigured() {
  return getMissingSupabaseEnv().length === 0;
}

function createConfigurationError() {
  return new Error(
    'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Vercel Project Settings → Environment Variables, then redeploy.',
  );
}

function createNoopQueryBuilder(resolveWithData: unknown = []) {
  const selectResult: { data: unknown; error: Error | null } = { data: resolveWithData, error: null };
  const writeResult: { data: unknown; error: Error | null } = { data: null, error: createConfigurationError() };
  let currentResult = selectResult;

  const builder = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === 'then') {
          return Promise.resolve(currentResult).then.bind(Promise.resolve(currentResult));
        }

        if (prop === 'catch') {
          return Promise.resolve(currentResult).catch.bind(Promise.resolve(currentResult));
        }

        if (prop === 'finally') {
          return Promise.resolve(currentResult).finally.bind(Promise.resolve(currentResult));
        }

        if (prop === 'single' || prop === 'maybeSingle') {
          return () => {
            currentResult = { data: null, error: null };
            return builder;
          };
        }

        if (['insert', 'update', 'upsert', 'delete'].includes(String(prop))) {
          return () => {
            currentResult = writeResult;
            return builder;
          };
        }

        return () => builder;
      },
    },
  );

  return builder;
}

function createNoopRealtimeChannel() {
  const channel = {
    on: () => channel,
    subscribe: () => channel,
    unsubscribe: async () => ({ error: null }),
  };

  return channel;
}

function createMissingSupabaseClient(): SupabaseClient<Database> {
  const missing = getMissingSupabaseEnv();
  const message = `Missing Supabase environment variable(s): ${missing.join(', ')}. The app will render, but live menu/order data is disabled until these values are added in Vercel.`;

  if (typeof console !== 'undefined') console.warn(`[Supabase] ${message}`);

  return {
    from: () => createNoopQueryBuilder(),
    channel: () => createNoopRealtimeChannel(),
    removeChannel: async () => ({ error: null }),
    auth: {
      getSession: async () => ({ data: { session: null }, error: createConfigurationError() }),
      getUser: async () => ({ data: { user: null }, error: createConfigurationError() }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    },
  } as unknown as SupabaseClient<Database>;
}

function createSupabaseClient(): SupabaseClient<Database> {
  const { url, publishableKey } = getSupabaseConfig();

  if (!url || !publishableKey) {
    return createMissingSupabaseClient();
  }

  return createClient<Database>(url, publishableKey, {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    }
  });
}

let _supabase: SupabaseClient<Database> | undefined;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});

