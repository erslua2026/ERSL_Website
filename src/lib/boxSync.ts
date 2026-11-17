import { supabase } from './supabase';

export type BoxImageCategory =
  | 'People'
  | 'News'
  | 'Research'
  | 'Instruments'
  | 'Projects'
  | 'Logos'
  | 'General';

export type BoxFileDestination =
  | `images/${BoxImageCategory}`
  | 'publications'
  | 'datasets'
  | 'teaching'
  | 'bulletins'
  | 'workplan'
  | 'projects'
  | 'software'
  | 'general';

export interface BoxSyncStatus {
  state: 'idle' | 'synced' | 'pending_auth' | 'error';
  message?: string;
}

let lastBoxStatus: BoxSyncStatus = { state: 'idle' };

export function getLastBoxStatus(): BoxSyncStatus {
  return lastBoxStatus;
}

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to read file.'));
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });

async function invokeBoxUpload(
  file: File,
  destination: BoxFileDestination
): Promise<{ directUrl: string; shareUrl: string; fileName: string } | null> {
  if (!supabase) return null;

  const dataUrl = await readFileAsDataUrl(file);
  const commaIdx = dataUrl.indexOf(',');
  const base64Data = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : '';
  if (!base64Data) return null;

  const stamp = new Date().toISOString().slice(0, 10);
  const cleanName = `${stamp}_${Date.now()}_${file.name.replace(/[^A-Za-z0-9._-]/g, '_')}`;

  const { data, error } = await supabase.functions.invoke('box-sync', {
    body: {
      action: 'upload_file',
      destination,
      fileName: cleanName,
      contentType: file.type || 'application/octet-stream',
      base64Data,
    },
  });

  if (error || !data?.ok || !(data?.directUrl || data?.shareUrl)) {
    throw new Error(data?.error || error?.message || 'UA Box upload is not authorized yet.');
  }

  lastBoxStatus = { state: 'synced', message: `Uploaded ${cleanName} to UA Box` };
  return {
    directUrl: data.directUrl || data.shareUrl,
    shareUrl: data.shareUrl || data.directUrl,
    fileName: data.fileName || cleanName,
  };
}

/**
 * Sync any ERSL website section JSON directly into UA Box (`ERSL_Website_Storage`)
 * via the `box-sync` Supabase Edge Function. Safe no-op until OIT approves & secrets are deployed.
 */
export async function syncSectionToBox<T>(
  key: string,
  payload: T,
  updatedBy = 'Admin'
): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.functions.invoke('box-sync', {
      body: { action: 'sync_json', key, payload, updatedBy },
    });

    if (error || !data?.ok) {
      const msg = data?.error || error?.message || 'UA Box authorization pending';
      lastBoxStatus = {
        state: data?.configured === false ? 'pending_auth' : 'error',
        message: msg,
      };
      return false;
    }

    lastBoxStatus = {
      state: 'synced',
      message: `Synced to UA Box (${data.folder})`,
    };
    return true;
  } catch (err: any) {
    lastBoxStatus = { state: 'pending_auth', message: err?.message || 'Box sync unavailable' };
    return false;
  }
}

/**
 * Upload a local image directly into UA Box `01_Website_Images/<category>` and return
 * the Box Direct Link. Falls back cleanly to a local <2MB data URL while waiting for OIT approval.
 */
export async function uploadImageWithBoxFallback(
  file: File,
  category: BoxImageCategory
): Promise<{ url: string; uploadedToBox: boolean; note?: string }> {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image size exceeds 5MB limit. Please choose a smaller compressed image.');
  }

  try {
    const res = await invokeBoxUpload(file, `images/${category}`);
    if (res) {
      return { url: res.directUrl, uploadedToBox: true };
    }
  } catch {
    // Fall back cleanly below while waiting for UA OIT Box authorization
  }

  if (file.size > 2 * 1024 * 1024) {
    throw new Error(
      'Image exceeds 2MB local fallback limit (UA Box direct upload is awaiting OIT authorization). Please use a smaller file or paste a Box Direct Link.'
    );
  }

  const dataUrl = await readFileAsDataUrl(file);
  return {
    url: dataUrl,
    uploadedToBox: false,
    note: 'Saved locally (direct UA Box upload activates once OIT approves the Box app).',
  };
}

/**
 * Upload any document, PDF, dataset, archive, or guide directly to the matching subfolder in UA Box
 * (`02_Datasets_Public`, `03_Datasets_Members`, `04_Projects`, `05_Softwares_And_Guides`, etc.).
 */
export async function uploadDocumentToBox(
  file: File,
  destination: Exclude<BoxFileDestination, `images/${BoxImageCategory}`>
): Promise<{ url: string; shareUrl: string; fileName: string }> {
  if (file.size > 25 * 1024 * 1024) {
    throw new Error(
      'Files over 25MB should be uploaded directly in alabama.box.com inside your ERSL folder, then paste its Shared/Direct link here.'
    );
  }

  const res = await invokeBoxUpload(file, destination);
  if (!res) {
    throw new Error('UA Box upload is unavailable until Supabase + OIT Box authorization are active.');
  }

  return {
    url: res.shareUrl || res.directUrl,
    shareUrl: res.shareUrl,
    fileName: res.fileName,
  };
}
