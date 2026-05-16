// src/store-factory.js
import { LocalAdapter }    from './store.js';
import { SupabaseAdapter } from './store-cloud.js';

const CONFIG_KEY = 'comment-tool-config';

export function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
  } catch { return {}; }
}

export function saveConfig({ supabaseUrl, supabaseKey }) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ supabaseUrl, supabaseKey }));
}

/**
 * Returns the appropriate StorageAdapter based on saved config.
 * Falls back to LocalAdapter if Supabase credentials are absent.
 */
export function getStore() {
  const { supabaseUrl, supabaseKey } = loadConfig();
  if (supabaseUrl && supabaseKey) {
    return new SupabaseAdapter({ supabaseUrl, supabaseKey });
  }
  return new LocalAdapter();
}
