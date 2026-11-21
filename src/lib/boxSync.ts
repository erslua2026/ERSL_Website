import { supabase } from './supabase';
import type {
  BoxEntityCategory,
  DataLayer,
  Instrument,
  Person,
  Project,
  Software,
} from '../types';

export type { BoxEntityCategory };

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
  | `students/${string}`
  | `people/${string}`
  | `projects/${string}`
  | `instruments/${string}`
  | `datasets/${string}`
  | `software/${string}`
  | 'publications'
  | 'datasets'
  | 'teaching'
  | 'bulletins'
  | 'workplan'
  | 'projects'
  | 'instruments'
  | 'people'
  | 'software'
  | 'general';

export const ENTITY_CATEGORY_ROOTS: Record<BoxEntityCategory, string> = {
  people: 'People',
  projects: 'Projects',
  instruments: 'Instruments',
  datasets: 'Datasets',
  software: 'Software',
};

export interface BoxFolderEntry {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size: number;
  modifiedAt?: string | null;
  shareUrl?: string | null;
  directUrl?: string | null;
}

export interface BoxEntityFolderResult {
  category: BoxEntityCategory;
  id: string;
  folderId: string;
  folderName: string;
  folderPath: string;
  shareUrl: string;
  created: boolean;
}

export interface BoxSyncStatus {
  state: 'idle' | 'synced' | 'pending_auth' | 'error';
  message?: string;
}

let lastBoxStatus: BoxSyncStatus = { state: 'idle' };

export function getLastBoxStatus(): BoxSyncStatus {
  return lastBoxStatus;
}

export function buildEntityBoxFolderName(nameOrTitle?: string, fallbackId = 'Item'): string {
  const cleaned = String(nameOrTitle || '')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 75);
  return cleaned || String(fallbackId || 'Item').replace(/[^A-Za-z0-9._-]/g, '_');
}

export function formatBoxFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
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

export function getExpectedBoxFolderPath(
  category: BoxEntityCategory,
  itemName?: string,
  itemId = 'Item',
  isPrivate = false
): string {
  const root = ENTITY_CATEGORY_ROOTS[category];
  const folderName = buildEntityBoxFolderName(itemName, itemId);
  const bucket = isPrivate ? '02_Private_Members' : '01_Public';
  if (category === 'datasets' || category === 'software') {
    return `${root}/${bucket}/${folderName}`;
  }
  return `${root}/${folderName}/${bucket}`;
}

async function uploadDirectToBoxWithDownscopedToken(
  file: File,
  destination: BoxFileDestination,
  cleanName: string,
  options?: { folderId?: string; isPrivate?: boolean }
): Promise<{ directUrl: string; shareUrl: string; fileName: string; folderId?: string } | null> {
  if (!supabase) return null;

  const { data: tokData, error: tokErr } = await supabase.functions.invoke('box-sync', {
    body: {
      action: 'get_upload_token',
      destination,
      folderId: options?.folderId,
      isPrivate: options?.isPrivate,
    },
  });

  if (tokErr || !tokData?.ok || !tokData?.uploadToken || !tokData?.folderId) {
    return null;
  }

  const form = new FormData();
  form.append(
    'attributes',
    JSON.stringify({ name: cleanName, parent: { id: tokData.folderId } })
  );
  form.append('file', file, cleanName);

  const upRes = await fetch('https://upload.box.com/api/2.0/files/content', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokData.uploadToken}` },
    body: form,
  });

  if (!upRes.ok) {
    return null;
  }

  const upJson = await upRes.json();
  const uploadedFileId = upJson?.entries?.[0]?.id;
  if (!uploadedFileId) return null;

  const { data: linkData } = await supabase.functions.invoke('box-sync', {
    body: {
      action: 'get_box_file_link',
      fileId: uploadedFileId,
      isPrivate: Boolean(options?.isPrivate),
    },
  });

  const shareUrl = linkData?.shareUrl || linkData?.directUrl || tokData.folderShareUrl || '';
  const directUrl = linkData?.directUrl || shareUrl;
  if (!shareUrl && !directUrl) return null;

  lastBoxStatus = { state: 'synced', message: `Uploaded ${cleanName} directly to UA Box` };
  return {
    directUrl,
    shareUrl: shareUrl || directUrl,
    fileName: upJson?.entries?.[0]?.name || cleanName,
    folderId: tokData.folderId,
  };
}

export async function invokeBoxUpload(
  file: File,
  destination: BoxFileDestination,
  options?: { folderId?: string; isPrivate?: boolean }
): Promise<{ directUrl: string; shareUrl: string; fileName: string; folderId?: string } | null> {
  if (!supabase) return null;

  const stamp = new Date().toISOString().slice(0, 10);
  const cleanName = `${stamp}_${Date.now()}_${file.name.replace(/[^A-Za-z0-9._-]/g, '_')}`;

  // For files > 3.5MB (up to 50MB), try direct browser upload using a folder-scoped Box token first
  if (file.size > 3.5 * 1024 * 1024) {
    const directRes = await uploadDirectToBoxWithDownscopedToken(file, destination, cleanName, options);
    if (directRes) return directRes;
    throw new Error(
      'Direct >3.5MB browser upload requires UA Box token & CORS setup. Upload the file directly in your Box folder, then click "Browse Box Folder" to attach it to the website.'
    );
  }

  const dataUrl = await readFileAsDataUrl(file);
  const commaIdx = dataUrl.indexOf(',');
  const base64Data = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : '';
  if (!base64Data) return null;

  const { data, error } = await supabase.functions.invoke('box-sync', {
    body: {
      action: 'upload_file',
      destination,
      folderId: options?.folderId,
      isPrivate: options?.isPrivate,
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
    folderId: data.folderId,
  };
}

export async function checkBoxConnectionHealth(): Promise<{
  ok: boolean;
  configured: boolean;
  subfolders: string[];
  error?: string;
}> {
  if (!supabase) {
    return { ok: false, configured: false, subfolders: [], error: 'Supabase not configured' };
  }
  try {
    const { data, error } = await supabase.functions.invoke('box-sync', {
      body: { action: 'health' },
    });
    if (error || !data?.ok) {
      return {
        ok: false,
        configured: data?.configured !== false,
        subfolders: [],
        error: data?.error || error?.message || 'Box sync unavailable',
      };
    }
    return {
      ok: true,
      configured: true,
      subfolders: Array.isArray(data.subfolders) ? data.subfolders : [],
    };
  } catch (err: any) {
    return { ok: false, configured: false, subfolders: [], error: err?.message || 'Box sync unavailable' };
  }
}

export async function ensureEntityBoxFolder(params: {
  category: BoxEntityCategory;
  itemId: string;
  itemName: string;
  isPrivate?: boolean;
}): Promise<{
  ok: boolean;
  folderId?: string;
  folderName?: string;
  folderPath?: string;
  shareUrl?: string;
  error?: string;
}> {
  if (!supabase) return { ok: false, error: 'Supabase not configured' };
  const folderName = buildEntityBoxFolderName(params.itemName, params.itemId);
  try {
    const { data, error } = await supabase.functions.invoke('box-sync', {
      body: {
        action: 'ensure_entity_folder',
        category: params.category,
        itemId: params.itemId,
        folderName,
        isPrivate: params.isPrivate ?? (params.category === 'people' || params.category === 'projects'),
      },
    });
    if (error || !data?.ok) {
      return {
        ok: false,
        error: data?.error || error?.message || 'Could not ensure Box folder yet.',
      };
    }
    lastBoxStatus = { state: 'synced', message: `Ready: Box/${data.folderPath}` };
    return {
      ok: true,
      folderId: data.folderId,
      folderName: data.folderName,
      folderPath: data.folderPath,
      shareUrl: data.shareUrl,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Could not reach Box sync service.' };
  }
}

export async function syncAllEntityBoxFolders(params: {
  people: Person[];
  projects: Project[];
  instruments: Instrument[];
  datasets: DataLayer[];
  software: Software[];
  cleanupLegacy?: boolean;
}): Promise<{
  ok: boolean;
  configured?: boolean;
  categoryRoots?: Record<string, { folderId: string; rootName: string; shareUrl: string }>;
  results?: BoxEntityFolderResult[];
  createdCount?: number;
  error?: string;
}> {
  if (!supabase) return { ok: false, error: 'Supabase not configured' };

  const items = [
    ...params.people.map(p => ({
      category: 'people' as BoxEntityCategory,
      id: p.id,
      folderName: buildEntityBoxFolderName(p.name, p.id),
      isPrivate: true,
    })),
    ...params.projects.map(proj => ({
      category: 'projects' as BoxEntityCategory,
      id: proj.id,
      folderName: buildEntityBoxFolderName(proj.title, proj.id),
      isPrivate: true,
    })),
    ...params.instruments.map(inst => ({
      category: 'instruments' as BoxEntityCategory,
      id: inst.id,
      folderName: buildEntityBoxFolderName(inst.name, inst.id),
      isPrivate: false,
    })),
    ...params.datasets.map(ds => ({
      category: 'datasets' as BoxEntityCategory,
      id: ds.id,
      folderName: buildEntityBoxFolderName(ds.name, ds.id),
      isPrivate: ds.availability !== 'Public',
    })),
    ...params.software.map(soft => ({
      category: 'software' as BoxEntityCategory,
      id: soft.id,
      folderName: buildEntityBoxFolderName(soft.title, soft.id),
      isPrivate: Boolean(soft.visibility && soft.visibility !== 'public'),
    })),
  ];

  try {
    const { data, error } = await supabase.functions.invoke('box-sync', {
      body: {
        action: 'sync_entity_folders',
        items,
        cleanupLegacy: Boolean(params.cleanupLegacy),
      },
    });
    if (error || !data?.ok) {
      return {
        ok: false,
        configured: data?.configured,
        error: data?.error || error?.message || 'UA Box folder sync is pending authorization.',
      };
    }
    lastBoxStatus = {
      state: 'synced',
      message: `Synced ${data.totalSynced || items.length} Box folders`,
    };
    return {
      ok: true,
      configured: true,
      categoryRoots: data.categoryRoots,
      results: Array.isArray(data.results) ? data.results : [],
      createdCount: Number(data.createdCount || 0),
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network notice syncing Box folders.' };
  }
}

export async function cleanupLegacyBoxFolders(): Promise<{
  ok: boolean;
  cleaned?: string[];
  archivedFiles?: number;
  error?: string;
}> {
  if (!supabase) return { ok: false, error: 'Supabase not configured' };
  try {
    const { data, error } = await supabase.functions.invoke('box-sync', {
      body: { action: 'cleanup_legacy_folders' },
    });
    if (error || !data?.ok) {
      return { ok: false, error: data?.error || error?.message || 'Legacy folder cleanup failed.' };
    }
    return {
      ok: true,
      cleaned: Array.isArray(data.cleaned) ? data.cleaned : [],
      archivedFiles: Number(data.archivedFiles || 0),
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error cleaning Box folders.' };
  }
}

export async function listBoxFolderContents(params: {
  folderId?: string;
  category?: BoxEntityCategory;
  folderName?: string;
  folderPath?: string;
  isPrivate?: boolean;
}): Promise<{
  ok: boolean;
  folderId?: string;
  folderPath?: string;
  shareUrl?: string;
  entries: BoxFolderEntry[];
  error?: string;
}> {
  if (!supabase) return { ok: false, entries: [], error: 'Supabase not configured' };
  try {
    const { data, error } = await supabase.functions.invoke('box-sync', {
      body: { action: 'list_box_folder', ...params },
    });
    if (error || !data?.ok) {
      return {
        ok: false,
        entries: [],
        error: data?.error || error?.message || 'Could not browse Box folder yet.',
      };
    }
    return {
      ok: true,
      folderId: data.folderId,
      folderPath: data.folderPath,
      shareUrl: data.shareUrl,
      entries: Array.isArray(data.entries) ? data.entries : [],
    };
  } catch (err: any) {
    return { ok: false, entries: [], error: err?.message || 'Box folder listing failed.' };
  }
}

export async function getBoxFileShareLinks(
  fileId: string,
  isPrivate = false
): Promise<{ ok: boolean; shareUrl?: string; directUrl?: string; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase not configured' };
  try {
    const { data, error } = await supabase.functions.invoke('box-sync', {
      body: { action: 'get_box_file_link', fileId, isPrivate },
    });
    if (error || !data?.ok) {
      return { ok: false, error: data?.error || error?.message || 'Could not generate Box file link.' };
    }
    return {
      ok: true,
      shareUrl: data.shareUrl || data.directUrl,
      directUrl: data.directUrl || data.shareUrl,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Box link error.' };
  }
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

const compressImageFileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    if (file.type === 'image/gif') {
      readFileAsDataUrl(file).then(resolve).catch(reject);
      return;
    }
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);

      const renderAt = (maxDim: number, mime: string, quality: number): string | null => {
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
        if (!ctx) return null;
        if (mime === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(img, 0, 0, w, h);
        return canvas.toDataURL(mime, quality);
      };

      const TARGET_MAX_DATA_URL_LEN = 2_400_000;
      // Preserve PNG only if small; otherwise use progressive high-res JPEG passes
      if (file.type === 'image/png' && file.size < 350_000) {
        const pngOut = renderAt(1800, 'image/png', 0.92);
        if (pngOut && pngOut.length <= TARGET_MAX_DATA_URL_LEN) {
          resolve(pngOut);
          return;
        }
      }

      const passes = [
        { maxDim: 1800, quality: 0.84 },
        { maxDim: 1500, quality: 0.76 },
        { maxDim: 1200, quality: 0.68 },
        { maxDim: 960, quality: 0.58 },
        { maxDim: 800, quality: 0.5 },
      ];
      let best = '';
      for (const p of passes) {
        const out = renderAt(p.maxDim, 'image/jpeg', p.quality);
        if (!out) continue;
        best = out;
        if (out.length <= TARGET_MAX_DATA_URL_LEN) {
          resolve(out);
          return;
        }
      }
      if (best) {
        resolve(best);
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
 * Upload a local image directly into UA Box — either into the entity's own uniform folder
 * (People, Projects, Instruments, Datasets, Software) when entityContext is provided,
 * or into `01_Website_Images/<category>` for global site assets (News, Research Themes, Logos).
 */
export async function uploadImageWithBoxFallback(
  file: File,
  category: BoxImageCategory,
  entityContext?: {
    category: BoxEntityCategory;
    itemId?: string;
    itemName?: string;
    isPrivate?: boolean;
  }
): Promise<{ url: string; uploadedToBox: boolean; note?: string }> {
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Image size exceeds 15MB limit. Please choose a smaller image.');
  }

  const destination: BoxFileDestination =
    entityContext?.category && (entityContext.itemName || entityContext.itemId)
      ? (`${entityContext.category}/${buildEntityBoxFolderName(entityContext.itemName, entityContext.itemId || 'Item')}` as BoxFileDestination)
      : `images/${category}`;

  try {
    const res = await invokeBoxUpload(file, destination, {
      isPrivate: Boolean(entityContext?.isPrivate),
    });
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
  destination: Exclude<BoxFileDestination, `images/${BoxImageCategory}`>,
  options?: { folderId?: string; isPrivate?: boolean }
): Promise<{ url: string; shareUrl: string; fileName: string; uploadedToBox: boolean }> {
  try {
    if (file.size <= 50 * 1024 * 1024) {
      const res = await invokeBoxUpload(file, destination, options);
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
    // Fall back seamlessly to compressed/local storage below if Box credentials/CORS unavailable
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
      'File exceeds the 3.5MB browser fallback limit. Drop this file directly into its UA Box folder ("Open Box Folder"), then click "Browse Box Folder" below to attach it to the website.'
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
  destination: Exclude<BoxFileDestination, `images/${BoxImageCategory}`>,
  options?: { folderId?: string; isPrivate?: boolean }
): Promise<{ url: string; shareUrl: string; fileName: string; uploadedToBox: boolean }> {
  return uploadDocumentWithBoxFallback(file, destination, options);
}

const PROTECTED_BOX_TOKENS = [
  'bl5k9qrcbymh4xgvlt03u8fdw81j8vlq', // Default ERSL Logo
  'ys8ovh6ya40h0ut2fl6br3i9b671dn01', // Default Water Quality Slide
  'q4sdyxc0fcn1ohc5k8ycqi5nvpfrmy0m', // Default Flood Mapping Slide
];

export function isDeletableBoxFileUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('data:')) return false;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith('box.com') && !host.endsWith('boxcloud.com')) return false;
    if (parsed.pathname.includes('/folder/')) return false;
    if (PROTECTED_BOX_TOKENS.some(tok => trimmed.includes(tok))) return false;
    return (
      parsed.pathname.includes('/shared/static/') ||
      parsed.pathname.includes('/s/') ||
      parsed.pathname.includes('/file/')
    );
  } catch {
    return false;
  }
}

export async function deleteBoxFileById(fileId: string): Promise<boolean> {
  if (!supabase || !fileId.trim()) return false;
  try {
    const { data, error } = await supabase.functions.invoke('box-sync', {
      body: { action: 'delete_box_file', fileId: fileId.trim() },
    });
    return Boolean(!error && data?.ok && (data?.deletedCount || 0) > 0);
  } catch {
    return false;
  }
}

export async function deleteBoxFilesByUrls(urls: Array<string | undefined>): Promise<number> {
  if (!supabase) return 0;
  const deletable = Array.from(new Set(urls.filter((u): u is string => isDeletableBoxFileUrl(u))));
  if (deletable.length === 0) return 0;
  try {
    const { data, error } = await supabase.functions.invoke('box-sync', {
      body: { action: 'delete_box_file', urls: deletable },
    });
    if (error || !data?.ok) return 0;
    return Number(data.deletedCount || 0);
  } catch {
    return 0;
  }
}

export async function deleteBoxFileFromUrl(url?: string): Promise<boolean> {
  if (!isDeletableBoxFileUrl(url)) return false;
  const count = await deleteBoxFilesByUrls([url]);
  return count > 0;
}
