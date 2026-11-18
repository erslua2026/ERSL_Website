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

const compressImageFileToDataUrl = (file: File, maxDim = 1600, quality = 0.84): Promise<string> =>
  new Promise((resolve, reject) => {
    if (file.type === 'image/gif') {
      readFileAsDataUrl(file).then(resolve).catch(reject);
      return;
    }
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w / h > 1) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
        // Preserve PNG transparency if small/PNG, else compress cleanly as JPEG
        const mime = file.type === 'image/png' && file.size < 400_000 ? 'image/png' : 'image/jpeg';
        resolve(canvas.toDataURL(mime, quality));
        return;
      }
      readFileAsDataUrl(file).then(resolve).catch(reject);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      readFileAsDataUrl(file).then(resolve).catch(reject);
    };
    img.src = objUrl;
  });

/**
 * Upload a local image directly into UA Box `01_Website_Images/<category>` and return
 * the Box Direct Link. Falls back cleanly (with automatic compression) to a local data URL
 * so local upload and clipboard paste always succeed even without Box OIT authorization.
 */
export async function uploadImageWithBoxFallback(
  file: File,
  category: BoxImageCategory
): Promise<{ url: string; uploadedToBox: boolean; note?: string }> {
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Image size exceeds 15MB limit. Please choose a smaller image.');
  }

  try {
    const res = await invokeBoxUpload(file, `images/${category}`);
    if (res) {
      return { url: res.directUrl, uploadedToBox: true };
    }
  } catch {
    // Fall back cleanly below while waiting for UA OIT Box authorization
  }

  const dataUrl = await compressImageFileToDataUrl(file);
  if (dataUrl.length > 3.5 * 1024 * 1024) {
    throw new Error('Compressed image still exceeds 2.5MB cloud limit. Please use a slightly smaller image.');
  }

  return {
    url: dataUrl,
    uploadedToBox: false,
    note: 'Saved locally & synced via portal cloud (direct UA Box upload activates once OIT approves the Box app).',
  };
}

/**
 * Upload any document, PDF, dataset, spreadsheet, archive, or pasted image:
 * tries UA Box first and automatically falls back to compressed/local base64 storage (<= 3.5MB)
 * so uploads NEVER get blocked while waiting for UA OIT Box authorization.
 */
export async function uploadDocumentWithBoxFallback(
  file: File,
  destination: Exclude<BoxFileDestination, `images/${BoxImageCategory}`>
): Promise<{ url: string; shareUrl: string; fileName: string; uploadedToBox: boolean }> {
  try {
    if (file.size <= 25 * 1024 * 1024) {
      const res = await invokeBoxUpload(file, destination);
      if (res) {
        return {
          url: res.shareUrl || res.directUrl,
          shareUrl: res.shareUrl || res.directUrl,
          fileName: res.fileName,
          uploadedToBox: true,
        };
      }
    }
  } catch {
    // Fall back seamlessly to local/Supabase portal storage below
  }

  if (file.type.startsWith('image/')) {
    const dataUrl = await compressImageFileToDataUrl(file);
    return {
      url: dataUrl,
      shareUrl: dataUrl,
      fileName: file.name,
      uploadedToBox: false,
    };
  }

  const MAX_LOCAL_DOC_BYTES = 3.5 * 1024 * 1024;
  if (file.size > MAX_LOCAL_DOC_BYTES) {
    throw new Error(
      'Files over 3.5MB require UA Box direct link (pending UA OIT authorization). Upload files <= 3.5MB directly from your computer or paste a Box/Drive link.'
    );
  }

  const dataUrl = await readFileAsDataUrl(file);
  return {
    url: dataUrl,
    shareUrl: dataUrl,
    fileName: file.name,
    uploadedToBox: false,
  };
}

/**
 * Backward-compatible wrapper that supports Box upload with automatic local fallback.
 */
export async function uploadDocumentToBox(
  file: File,
  destination: Exclude<BoxFileDestination, `images/${BoxImageCategory}`>
): Promise<{ url: string; shareUrl: string; fileName: string; uploadedToBox: boolean }> {
  return uploadDocumentWithBoxFallback(file, destination);
}
