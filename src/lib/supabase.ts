import { createClient } from '@supabase/supabase-js';

// @ts-ignore
let rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// @ts-ignore
let rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fallback values if environment variables are 'continue' or missing
const FALLBACK_URL = "https://zlqagjhyfbgudoghnnpf.supabase.co";
const FALLBACK_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpscWFnamh5ZmJndWRvZ2hubnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NzEyMDYsImV4cCI6MjA5MzQ0NzIwNn0.ELxLF-iGzN3OYxF_5ufbcTSOoDx-BFyhYxcVjEOiYts";

if (!rawSupabaseUrl || rawSupabaseUrl === 'continue' || rawSupabaseUrl === 'undefined') {
  rawSupabaseUrl = FALLBACK_URL;
}
if (!rawSupabaseAnonKey || rawSupabaseAnonKey === 'continue' || rawSupabaseAnonKey === 'undefined') {
  rawSupabaseAnonKey = FALLBACK_ANON_KEY;
}

export const supabaseUrl = rawSupabaseUrl;
export const supabaseAnonKey = rawSupabaseAnonKey;

const isValidUrl = (url: string) => {
  try {
    return url && (url.startsWith('http://') || url.startsWith('https://')) && url !== 'continue';
  } catch {
    return false;
  }
};

export const supabase = (isValidUrl(supabaseUrl) && supabaseAnonKey && supabaseAnonKey !== 'continue')
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any;

if (!supabase) {
  console.warn('Supabase configuration is missing or invalid. Check your environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).');
}

