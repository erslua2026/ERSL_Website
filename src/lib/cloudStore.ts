import { supabase } from './supabase';
import { syncSectionToBox } from './boxSync';

/**
 * Universal Cloud Storage Layer for ERSL Portal
 * Persists all editable portal states into Supabase `reservoir_matrix` table
 * which has full row-level security permissions enabled for all lab users.
 */

export interface CloudRecord {
  id: string;
  rounds: any;
  active_round?: number | null;
  updated_at?: string;
  updated_by?: string;
}

/**
 * Fetch a shared document from Supabase.
 * Returns null if not found or on network error.
 */
export async function getCloudData<T = any>(key: string): Promise<{ data: T | null; updated_at?: string; updated_by?: string }> {
  if (!supabase) return { data: null };
  try {
    const { data, error } = await supabase
      .from('reservoir_matrix')
      .select('*')
      .eq('id', key)
      .maybeSingle();

    if (!error && data && data.rounds !== undefined) {
      return {
        data: data.rounds as T,
        updated_at: data.updated_at,
        updated_by: data.updated_by
      };
    }
  } catch (err) {
    console.warn(`[CloudStore] Notice reading ${key}:`, err);
  }
  return { data: null };
}

let lastCloudError: string | null = null;

export function getLastCloudError(): string | null {
  return lastCloudError;
}

/**
 * Save a shared document to Supabase.
 * Returns boolean indicating whether the cloud save succeeded.
 */
export async function setCloudData<T = any>(
  key: string,
  payload: T,
  options?: { activeRound?: number | null; updatedBy?: string }
): Promise<boolean> {
  if (!supabase) {
    lastCloudError = 'Supabase client is not configured.';
    return false;
  }
  try {
    const [{ error }] = await Promise.all([
      supabase
        .from('reservoir_matrix')
        .upsert(
          {
            id: key,
            rounds: payload,
            active_round: options?.activeRound ?? 3,
            updated_at: new Date().toISOString(),
            updated_by: options?.updatedBy || 'Lab User',
          },
          { onConflict: 'id' }
        ),
      syncSectionToBox(key, payload, options?.updatedBy || 'Lab User'),
    ]);

    if (error) {
      lastCloudError = error.message;
      console.warn(`[CloudStore] Save error for ${key}:`, error.message);
      return false;
    }
    lastCloudError = null;
    return true;
  } catch (err: any) {
    lastCloudError = err?.message || 'Network error while saving to Supabase';
    console.warn(`[CloudStore] Network exception saving ${key}:`, err);
    return false;
  }
}
