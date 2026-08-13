import { createClient } from '@supabase/supabase-js';

// Fallback values if environment variables are 'continue' or missing
const FALLBACK_URL = "https://zlqagjhyfbgudoghnnpf.supabase.co";
const FALLBACK_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpscWFnamh5ZmJndWRvZ2hubnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NzEyMDYsImV4cCI6MjA5MzQ0NzIwNn0.ELxLF-iGzN3OYxF_5ufbcTSOoDx-BFyhYxcVjEOiYts";

const getCustomConfig = () => {
  if (typeof window === 'undefined') return { url: null, key: null };
  try {
    const url = localStorage.getItem('custom_supabase_url');
    const key = localStorage.getItem('custom_supabase_anon_key');
    return { url, key };
  } catch {
    return { url: null, key: null };
  }
};

const { url: customUrl, key: customKey } = getCustomConfig();

// @ts-ignore
let rawSupabaseUrl = customUrl || import.meta.env.VITE_SUPABASE_URL;
// @ts-ignore
let rawSupabaseAnonKey = customKey || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!rawSupabaseUrl || rawSupabaseUrl === 'continue' || rawSupabaseUrl === 'undefined' || rawSupabaseUrl.trim() === '') {
  rawSupabaseUrl = FALLBACK_URL;
}
if (!rawSupabaseAnonKey || rawSupabaseAnonKey === 'continue' || rawSupabaseAnonKey === 'undefined' || rawSupabaseAnonKey.trim() === '') {
  rawSupabaseAnonKey = FALLBACK_ANON_KEY;
}

export const supabaseUrl = rawSupabaseUrl;
export const supabaseAnonKey = rawSupabaseAnonKey;

export const isUsingCustomCredentials = () => {
  return Boolean(customUrl && customUrl.trim() !== '' && customKey && customKey.trim() !== '');
};

export const saveCustomSupabaseCredentials = (url: string, key: string) => {
  if (typeof window !== 'undefined') {
    if (url && key) {
      localStorage.setItem('custom_supabase_url', url.trim());
      localStorage.setItem('custom_supabase_anon_key', key.trim());
    } else {
      localStorage.removeItem('custom_supabase_url');
      localStorage.removeItem('custom_supabase_anon_key');
    }
    window.location.reload();
  }
};

export const clearCustomSupabaseCredentials = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('custom_supabase_url');
    localStorage.removeItem('custom_supabase_anon_key');
    window.location.reload();
  }
};

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


