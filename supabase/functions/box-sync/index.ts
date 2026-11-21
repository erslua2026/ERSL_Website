// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const ADMIN_EMAILS = [
  'hongxing.liu@ua.edu',
  'hliu@ua.edu',
  'naveenpurushothaman1098@gmail.com',
  'npurushothaman@ua.edu',
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  if (origin === 'https://ersl.pages.dev') return true;
  if (/^https:\/\/[a-z0-9-]+\.ersl\.pages\.dev$/i.test(origin)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true;
  return false;
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin');
  const allowOrigin = origin && isAllowedOrigin(origin) ? origin : 'https://ersl.pages.dev';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

const BOX_CLIENT_ID = Deno.env.get('BOX_CLIENT_ID') ?? '';
const BOX_CLIENT_SECRET = Deno.env.get('BOX_CLIENT_SECRET') ?? '';
const BOX_ENTERPRISE_ID = Deno.env.get('BOX_ENTERPRISE_ID') ?? '306501';
const BOX_ROOT_FOLDER_ID = Deno.env.get('BOX_ROOT_FOLDER_ID') ?? '436999117457';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

// Explicit allowlist mapping ERSL portal JSON state keys cleanly into 06_Website_Data_Sync/JSON_Backups
const SECTION_FOLDER_MAP: Record<string, string> = {
  ersl_sec_datalayers: '06_Website_Data_Sync',
  ersl_sec_publications: '06_Website_Data_Sync',
  ersl_sec_themes: '06_Website_Data_Sync',
  ersl_subpage_themes: '06_Website_Data_Sync',
  ersl_sec_home: '06_Website_Data_Sync',
  ersl_sec_research: '06_Website_Data_Sync',
  ersl_sec_people: '06_Website_Data_Sync',
  ersl_sec_teaching: '06_Website_Data_Sync',
  ersl_sec_bulletins: '06_Website_Data_Sync',
  ersl_sec_bulletin_folders: '06_Website_Data_Sync',
  ersl_professional_hub: '06_Website_Data_Sync',
  ersl_professional_posts: '06_Website_Data_Sync',
  ersl_workplan: '06_Website_Data_Sync',
  ersl_workplan_matrix: '06_Website_Data_Sync',
  ersl_reservoir: '06_Website_Data_Sync',
  ersl_reservoir_matrix: '06_Website_Data_Sync',
  ersl_sec_projects: '06_Website_Data_Sync',
  ersl_subpage_projects: '06_Website_Data_Sync',
  ersl_subpage_students: '06_Website_Data_Sync',
  ersl_sec_software: '06_Website_Data_Sync',
  ersl_sec_instruments: '06_Website_Data_Sync',
  ersl_subpage_instruments: '06_Website_Data_Sync',
  ersl_sec_news: '06_Website_Data_Sync',
  ersl_site_config: '06_Website_Data_Sync',
  ersl_custom_pages: '06_Website_Data_Sync',
  ersl_sec_auditlogs: '06_Website_Data_Sync',
};

const ENTITY_CATEGORY_FOLDER_MAP: Record<string, string> = {
  people: 'People',
  projects: 'Projects',
  instruments: 'Instruments',
  datasets: 'Datasets',
  software: 'Software',
};

const PUBLIC_BUCKET = '01_Public';
const PRIVATE_BUCKET = '02_Private_Members';
const PRIVACY_BUCKET_CATEGORIES = new Set(['datasets', 'software']);
const LEGACY_ROOT_FOLDERS = [
  '02_Datasets_Public',
  '03_Datasets_Members',
  '04_Projects',
  '05_Softwares_And_Guides',
];

const PRIVATE_UPLOAD_DESTINATIONS = new Set(['workplan', 'bulletins', 'teaching']);

const FILE_DESTINATION_MAP: Record<string, [string, string?]> = {
  publications: ['06_Website_Data_Sync', 'Publications_Files'],
  teaching: ['06_Website_Data_Sync', 'Teaching_Materials'],
  bulletins: ['06_Website_Data_Sync', 'Bulletins_Docs'],
  workplan: ['06_Website_Data_Sync', 'Workplan_Attachments'],
  datasets: ['Datasets', PUBLIC_BUCKET],
  projects: ['Projects', '_Shared_Projects'],
  instruments: ['Instruments', '_Shared_Instruments'],
  software: ['Software', PUBLIC_BUCKET],
  people: ['People', '_Shared_People'],
  general: ['06_Website_Data_Sync', 'Uploads'],
};

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getBoxToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: BOX_CLIENT_ID,
    client_secret: BOX_CLIENT_SECRET,
    box_subject_type: 'enterprise',
    box_subject_id: BOX_ENTERPRISE_ID,
  });

  const res = await fetch('https://api.box.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Box auth failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  };
  return cachedToken.token;
}

function sanitizeFolderSegment(name: string, fallback = 'Item'): string {
  const cleaned = String(name || '')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 75);
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    return fallback;
  }
  return cleaned;
}

async function listFolderItems(token: string, folderId: string) {
  const res = await fetch(
    `https://api.box.com/2.0/folders/${folderId}/items?fields=id,name,type,size,modified_at,shared_link&limit=1000`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Box list folder ${folderId} failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.entries || [];
}

async function getOrCreateFolderWithEntries(
  token: string,
  parentId: string,
  name: string,
  entriesCache?: any[]
): Promise<{ id: string; created: boolean; shareUrl?: string | null }> {
  const entries = entriesCache || (await listFolderItems(token, parentId));
  const existing = entries.find(
    (e: any) => e.type === 'folder' && String(e.name || '').toLowerCase() === name.toLowerCase()
  );
  if (existing) {
    return {
      id: existing.id,
      created: false,
      shareUrl: existing?.shared_link?.url || null,
    };
  }

  const createRes = await fetch('https://api.box.com/2.0/folders?fields=id,name,shared_link', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, parent: { id: parentId } }),
  });
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Box create folder "${name}" failed (${createRes.status}): ${text}`);
  }
  const created = await createRes.json();
  if (entriesCache) {
    entriesCache.push({ ...created, type: 'folder' });
  }
  return { id: created.id, created: true, shareUrl: created?.shared_link?.url || null };
}

async function ensureFolder(token: string, parentId: string, name: string): Promise<string> {
  const res = await getOrCreateFolderWithEntries(token, parentId, name);
  return res.id;
}

async function createFolderSharedLink(
  token: string,
  folderId: string,
  isPrivate = true
): Promise<string> {
  try {
    const res = await fetch(`https://api.box.com/2.0/folders/${folderId}?fields=shared_link`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shared_link: {
          access: isPrivate ? 'company' : 'open',
          permissions: {
            can_download: true,
            can_preview: true,
          },
        },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.shared_link?.url) return data.shared_link.url;
    }
  } catch {
    // Fall back to direct enterprise folder URL below
  }
  return `https://ua.app.box.com/folder/${folderId}`;
}

async function downscopeUploadToken(token: string, folderId: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      subject_token: token,
      subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      scope: 'item_upload item_preview item_readwrite',
      resource: `https://api.box.com/2.0/folders/${folderId}`,
    });
    const res = await fetch('https://api.box.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.access_token || null;
  } catch {
    return null;
  }
}

async function moveBoxEntry(
  token: string,
  entryId: string,
  entryType: 'file' | 'folder',
  targetParentId: string
): Promise<boolean> {
  const endpoint =
    entryType === 'folder'
      ? `https://api.box.com/2.0/folders/${entryId}`
      : `https://api.box.com/2.0/files/${entryId}`;
  const res = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ parent: { id: targetParentId } }),
  });
  return res.ok;
}

async function deleteBoxFile(token: string, fileId: string): Promise<boolean> {
  const res = await fetch(`https://api.box.com/2.0/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok || res.status === 204;
}

async function deleteEmptyBoxFolder(token: string, folderId: string): Promise<boolean> {
  const res = await fetch(`https://api.box.com/2.0/folders/${folderId}?recursive=false`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok || res.status === 204;
}

async function ensureUniformItemFolder(params: {
  token: string;
  category: string;
  catFolderId: string;
  catEntries: any[];
  itemName: string;
  isPrivate: boolean;
}): Promise<{ id: string; folderPath: string; shareUrl: string; created: boolean }> {
  const { token, category, catFolderId, catEntries, itemName, isPrivate } = params;
  const rootName = ENTITY_CATEGORY_FOLDER_MAP[category];

  if (PRIVACY_BUCKET_CATEGORIES.has(category)) {
    const targetBucket = isPrivate ? PRIVATE_BUCKET : PUBLIC_BUCKET;
    const otherBucket = isPrivate ? PUBLIC_BUCKET : PRIVATE_BUCKET;

    const targetBucketRes = await getOrCreateFolderWithEntries(token, catFolderId, targetBucket, catEntries);
    const targetEntries = await listFolderItems(token, targetBucketRes.id);

    // Migrate cleanly if a flat folder existed directly under Datasets/Software or inside the opposite privacy bucket
    const flatMatch = catEntries.find(
      (e: any) =>
        e.type === 'folder' &&
        e.id !== targetBucketRes.id &&
        e.name !== PUBLIC_BUCKET &&
        e.name !== PRIVATE_BUCKET &&
        String(e.name || '').toLowerCase() === itemName.toLowerCase()
    );
    if (flatMatch) {
      const moved = await moveBoxEntry(token, flatMatch.id, 'folder', targetBucketRes.id);
      if (moved) {
        targetEntries.push(flatMatch);
      }
    } else {
      const otherBucketEntry = catEntries.find((e: any) => e.type === 'folder' && e.name === otherBucket);
      if (otherBucketEntry) {
        const otherEntries = await listFolderItems(token, otherBucketEntry.id);
        const oppositeMatch = otherEntries.find(
          (e: any) => e.type === 'folder' && String(e.name || '').toLowerCase() === itemName.toLowerCase()
        );
        if (oppositeMatch) {
          const moved = await moveBoxEntry(token, oppositeMatch.id, 'folder', targetBucketRes.id);
          if (moved) targetEntries.push(oppositeMatch);
        }
      }
    }

    const itemRes = await getOrCreateFolderWithEntries(token, targetBucketRes.id, itemName, targetEntries);
    const shareUrl = await createFolderSharedLink(token, itemRes.id, isPrivate);
    return {
      id: itemRes.id,
      folderPath: `${rootName}/${targetBucket}/${itemName}`,
      shareUrl,
      created: itemRes.created,
    };
  }

  // People, Projects, Instruments: create item folder + uniform 01_Public & 02_Private_Members subfolders inside
  const itemRes = await getOrCreateFolderWithEntries(token, catFolderId, itemName, catEntries);
  const subEntries = await listFolderItems(token, itemRes.id);
  const pubRes = await getOrCreateFolderWithEntries(token, itemRes.id, PUBLIC_BUCKET, subEntries);
  const privRes = await getOrCreateFolderWithEntries(token, itemRes.id, PRIVATE_BUCKET, subEntries);

  await Promise.all([
    createFolderSharedLink(token, pubRes.id, false),
    createFolderSharedLink(token, privRes.id, true),
  ]);
  const shareUrl = await createFolderSharedLink(token, itemRes.id, isPrivate);

  return {
    id: itemRes.id,
    folderPath: `${rootName}/${itemName}`,
    shareUrl,
    created: itemRes.created,
  };
}

async function archiveLegacyRootFolders(token: string): Promise<{ cleaned: string[]; archivedFiles: number }> {
  const rootEntries = await listFolderItems(token, BOX_ROOT_FOLDER_ID);
  const syncRootId = await ensureFolder(token, BOX_ROOT_FOLDER_ID, '06_Website_Data_Sync');
  const jsonBackupsId = await ensureFolder(token, syncRootId, 'JSON_Backups');
  const legacyArchiveRootId = await ensureFolder(token, syncRootId, '_Archived_Legacy_Folders');

  const cleaned: string[] = [];
  let archivedFiles = 0;

  // Move any loose JSON backup snapshots out of research category folders cleanly into JSON_Backups
  for (const rootFolderName of [...LEGACY_ROOT_FOLDERS, ...Object.values(ENTITY_CATEGORY_FOLDER_MAP)]) {
    const entry = rootEntries.find(
      (e: any) => e.type === 'folder' && String(e.name || '').toLowerCase() === rootFolderName.toLowerCase()
    );
    if (!entry) continue;

    const children = await listFolderItems(token, entry.id);
    const isLegacyFolder = LEGACY_ROOT_FOLDERS.some(l => l.toLowerCase() === rootFolderName.toLowerCase());
    let archiveSubId: string | null = null;

    for (const child of children) {
      if (child.type === 'file' && String(child.name || '').toLowerCase().endsWith('.json')) {
        const moved = await moveBoxEntry(token, child.id, 'file', jsonBackupsId);
        if (!moved) {
          await deleteBoxFile(token, child.id);
        }
        archivedFiles++;
      } else if (isLegacyFolder) {
        if (!archiveSubId) {
          archiveSubId = await ensureFolder(token, legacyArchiveRootId, rootFolderName);
        }
        await moveBoxEntry(token, child.id, child.type === 'folder' ? 'folder' : 'file', archiveSubId);
        archivedFiles++;
      }
    }

    if (isLegacyFolder) {
      const removed = await deleteEmptyBoxFolder(token, entry.id);
      if (removed) cleaned.push(rootFolderName);
    }
  }

  return { cleaned, archivedFiles };
}

async function upsertFileToBox(
  token: string,
  folderId: string,
  fileName: string,
  bytes: Uint8Array,
  mimeType: string
) {
  const entries = await listFolderItems(token, folderId);
  const existing = entries.find(
    (e: any) => e.type === 'file' && String(e.name || '').toLowerCase() === fileName.toLowerCase()
  );

  const form = new FormData();
  form.append(
    'attributes',
    JSON.stringify(existing ? { name: fileName } : { name: fileName, parent: { id: folderId } })
  );
  form.append('file', new Blob([bytes], { type: mimeType }), fileName);

  const uploadUrl = existing
    ? `https://upload.box.com/api/2.0/files/${existing.id}/content`
    : 'https://upload.box.com/api/2.0/files/content';

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Box upload "${fileName}" failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.entries?.[0];
}

async function createSharedLinks(
  token: string,
  fileId: string,
  isPrivate: boolean
): Promise<{ directUrl: string | null; shareUrl: string | null }> {
  const res = await fetch(`https://api.box.com/2.0/files/${fileId}?fields=shared_link`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      shared_link: {
        access: isPrivate ? 'company' : 'open',
        permissions: {
          can_download: true,
          can_preview: true,
        },
      },
    }),
  });
  if (!res.ok) return { directUrl: null, shareUrl: null };
  const data = await res.json();
  const directUrl = data?.shared_link?.download_url || data?.shared_link?.url || null;
  const shareUrl = data?.shared_link?.url || data?.shared_link?.download_url || null;
  return { directUrl, shareUrl };
}

async function resolveUploadFolderId(
  token: string,
  destination: string,
  isPrivate = false
): Promise<string> {
  if (destination.startsWith('images/')) {
    const sub = sanitizeFolderSegment(destination.slice('images/'.length), 'General');
    const rootImagesId = await ensureFolder(token, BOX_ROOT_FOLDER_ID, '01_Website_Images');
    return ensureFolder(token, rootImagesId, sub);
  }
  const bucket = isPrivate ? PRIVATE_BUCKET : PUBLIC_BUCKET;

  if (destination.startsWith('students/')) {
    const rawName = sanitizeFolderSegment(destination.slice('students/'.length), 'General');
    const rootPeopleId = await ensureFolder(token, BOX_ROOT_FOLDER_ID, 'People');
    const personId = await ensureFolder(token, rootPeopleId, rawName);
    return ensureFolder(token, personId, bucket);
  }

  for (const [catKey, rootName] of Object.entries(ENTITY_CATEGORY_FOLDER_MAP)) {
    const prefix = `${catKey}/`;
    if (destination.startsWith(prefix)) {
      const subName = sanitizeFolderSegment(destination.slice(prefix.length), 'General');
      const catFolderId = await ensureFolder(token, BOX_ROOT_FOLDER_ID, rootName);
      if (PRIVACY_BUCKET_CATEGORIES.has(catKey)) {
        const privacyId = await ensureFolder(token, catFolderId, bucket);
        return ensureFolder(token, privacyId, subName);
      }
      const itemId = await ensureFolder(token, catFolderId, subName);
      return ensureFolder(token, itemId, bucket);
    }
  }

  if (destination === 'datasets' || destination === 'software') {
    const rootId = await ensureFolder(token, BOX_ROOT_FOLDER_ID, ENTITY_CATEGORY_FOLDER_MAP[destination]);
    return ensureFolder(token, rootId, bucket);
  }

  const [parentName, childName] = FILE_DESTINATION_MAP[destination] || ['06_Website_Data_Sync', 'Uploads'];
  const parentId = await ensureFolder(token, BOX_ROOT_FOLDER_ID, parentName);
  return childName ? ensureFolder(token, parentId, childName) : parentId;
}

function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  const reqOrigin = req.headers.get('Origin');
  if (reqOrigin && !isAllowedOrigin(reqOrigin)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Origin not allowed.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!BOX_CLIENT_ID || !BOX_CLIENT_SECRET) {
    return new Response(
      JSON.stringify({
        ok: false,
        configured: false,
        error: 'Box credentials are not configured on this Edge Function yet.',
      }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Require an authenticated AND approved ERSL member/admin JWT
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Server authentication environment is not configured.' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const authHeader = req.headers.get('Authorization') || '';
  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supabaseClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Authentication required to write to UA Box.' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const userEmail = String(userData.user.email || '').toLowerCase().trim();
  const isBootstrapAdmin = ADMIN_EMAILS.includes(userEmail);
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();

  const callerRole = String(profile?.role || '').toLowerCase();
  if (!isBootstrapAdmin && callerRole !== 'admin' && callerRole !== 'member') {
    return new Response(
      JSON.stringify({ ok: false, error: 'Approved ERSL member or admin role required.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const action = body?.action;
    const token = await getBoxToken();

    if (action === 'health') {
      const entries = await listFolderItems(token, BOX_ROOT_FOLDER_ID);
      return new Response(
        JSON.stringify({
          ok: true,
          configured: true,
          rootFolderId: BOX_ROOT_FOLDER_ID,
          subfolders: entries.filter((e: any) => e.type === 'folder').map((e: any) => e.name),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'cleanup_legacy_folders') {
      if (!isBootstrapAdmin && callerRole !== 'admin') {
        return new Response(
          JSON.stringify({ ok: false, error: 'Administrator permission required to reorganize root folders.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const summary = await archiveLegacyRootFolders(token);
      return new Response(
        JSON.stringify({ ok: true, ...summary }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'ensure_entity_folder') {
      const category = String(body?.category || '').toLowerCase();
      const rootFolderName = ENTITY_CATEGORY_FOLDER_MAP[category];
      if (!rootFolderName) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Invalid Box entity category.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const rawName = String(body?.folderName || body?.itemName || body?.itemId || 'Item');
      const safeName = sanitizeFolderSegment(rawName, 'Item');
      const isPrivate = body?.isPrivate !== false;

      const rootEntries = await listFolderItems(token, BOX_ROOT_FOLDER_ID);
      const catRes = await getOrCreateFolderWithEntries(token, BOX_ROOT_FOLDER_ID, rootFolderName, rootEntries);
      const catEntries = await listFolderItems(token, catRes.id);
      const ensured = await ensureUniformItemFolder({
        token,
        category,
        catFolderId: catRes.id,
        catEntries,
        itemName: safeName,
        isPrivate,
      });

      return new Response(
        JSON.stringify({
          ok: true,
          category,
          categoryFolderId: catRes.id,
          folderId: ensured.id,
          folderName: safeName,
          folderPath: ensured.folderPath,
          shareUrl: ensured.shareUrl,
          created: ensured.created,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'sync_entity_folders') {
      const items = Array.isArray(body?.items) ? body.items : [];
      if (body?.cleanupLegacy && (isBootstrapAdmin || callerRole === 'admin')) {
        await archiveLegacyRootFolders(token).catch(() => {});
      }

      const rootEntries = await listFolderItems(token, BOX_ROOT_FOLDER_ID);
      const categoryFolderMap: Record<string, { id: string; shareUrl: string; entries: any[] }> = {};

      for (const [catKey, rootName] of Object.entries(ENTITY_CATEGORY_FOLDER_MAP)) {
        const catRes = await getOrCreateFolderWithEntries(token, BOX_ROOT_FOLDER_ID, rootName, rootEntries);
        const catShareUrl = catRes.shareUrl || (await createFolderSharedLink(token, catRes.id, catKey === 'people' || catKey === 'projects'));
        const catEntries = await listFolderItems(token, catRes.id);
        if (PRIVACY_BUCKET_CATEGORIES.has(catKey)) {
          await getOrCreateFolderWithEntries(token, catRes.id, PUBLIC_BUCKET, catEntries);
          await getOrCreateFolderWithEntries(token, catRes.id, PRIVATE_BUCKET, catEntries);
        }
        categoryFolderMap[catKey] = { id: catRes.id, shareUrl: catShareUrl, entries: catEntries };
      }

      const results: Array<{
        category: string;
        id: string;
        folderId: string;
        folderName: string;
        folderPath: string;
        shareUrl: string;
        created: boolean;
      }> = [];

      for (const item of items) {
        const catKey = String(item?.category || '').toLowerCase();
        const catInfo = categoryFolderMap[catKey];
        if (!catInfo || !item?.id) continue;

        const safeName = sanitizeFolderSegment(String(item.folderName || item.name || item.id), String(item.id));
        const isPrivate = item?.isPrivate !== undefined ? Boolean(item.isPrivate) : (catKey === 'people' || catKey === 'projects');

        const ensured = await ensureUniformItemFolder({
          token,
          category: catKey,
          catFolderId: catInfo.id,
          catEntries: catInfo.entries,
          itemName: safeName,
          isPrivate,
        });

        results.push({
          category: catKey,
          id: String(item.id),
          folderId: ensured.id,
          folderName: safeName,
          folderPath: ensured.folderPath,
          shareUrl: ensured.shareUrl,
          created: ensured.created,
        });
      }

      const categoryRoots: Record<string, { folderId: string; rootName: string; shareUrl: string }> = {};
      for (const [catKey, rootName] of Object.entries(ENTITY_CATEGORY_FOLDER_MAP)) {
        categoryRoots[catKey] = {
          folderId: categoryFolderMap[catKey].id,
          rootName,
          shareUrl: categoryFolderMap[catKey].shareUrl,
        };
      }

      return new Response(
        JSON.stringify({
          ok: true,
          categoryRoots,
          results,
          createdCount: results.filter(r => r.created).length,
          totalSynced: results.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'list_box_folder') {
      const requestedFolderId = body?.folderId ? String(body.folderId).trim() : '';
      const category = body?.category ? String(body.category).toLowerCase() : '';
      const rawSubName = body?.folderName ? String(body.folderName).trim() : '';
      const isPrivate = body?.isPrivate !== undefined ? Boolean(body.isPrivate) : (category === 'people' || category === 'projects');

      let targetFolderId = BOX_ROOT_FOLDER_ID;
      let resolvedPath = 'ERSL_Website_Storage';

      if (requestedFolderId) {
        targetFolderId = requestedFolderId;
        resolvedPath = String(body?.folderPath || requestedFolderId);
      } else if (category && ENTITY_CATEGORY_FOLDER_MAP[category]) {
        const rootName = ENTITY_CATEGORY_FOLDER_MAP[category];
        const catId = await ensureFolder(token, BOX_ROOT_FOLDER_ID, rootName);
        if (rawSubName) {
          const safeSub = sanitizeFolderSegment(rawSubName, 'Item');
          const catEntries = await listFolderItems(token, catId);
          const ensured = await ensureUniformItemFolder({
            token,
            category,
            catFolderId: catId,
            catEntries,
            itemName: safeSub,
            isPrivate,
          });
          targetFolderId = ensured.id;
          resolvedPath = ensured.folderPath;
        } else {
          targetFolderId = catId;
          resolvedPath = rootName;
        }
      }

      const [entries, folderShareUrl] = await Promise.all([
        listFolderItems(token, targetFolderId),
        createFolderSharedLink(token, targetFolderId, isPrivate),
      ]);

      const normalizedEntries = entries.map((e: any) => ({
        id: String(e.id),
        name: String(e.name || 'Untitled'),
        type: e.type === 'folder' ? 'folder' : 'file',
        size: Number(e.size || 0),
        modifiedAt: e.modified_at || null,
        shareUrl: e?.shared_link?.url || null,
        directUrl: e?.shared_link?.download_url || e?.shared_link?.url || null,
      }));

      return new Response(
        JSON.stringify({
          ok: true,
          folderId: targetFolderId,
          folderPath: resolvedPath,
          shareUrl: folderShareUrl,
          entries: normalizedEntries,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_box_file_link') {
      const fileId = String(body?.fileId || '').trim();
      const isPrivate = Boolean(body?.isPrivate);
      if (!fileId) {
        return new Response(
          JSON.stringify({ ok: false, error: 'fileId is required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const links = await createSharedLinks(token, fileId, isPrivate);
      return new Response(
        JSON.stringify({
          ok: true,
          fileId,
          shareUrl: links.shareUrl,
          directUrl: links.directUrl,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_upload_token') {
      const resolvedDestination = String(body?.destination || 'general');
      const isPrivateDest =
        body?.isPrivate !== undefined
          ? Boolean(body.isPrivate)
          : PRIVATE_UPLOAD_DESTINATIONS.has(resolvedDestination) ||
            resolvedDestination.startsWith('people/') ||
            resolvedDestination.startsWith('students/') ||
            resolvedDestination.startsWith('projects/');

      const targetFolderId = body?.folderId
        ? String(body.folderId).trim()
        : await resolveUploadFolderId(token, resolvedDestination, isPrivateDest);
      const [uploadToken, folderShareUrl] = await Promise.all([
        downscopeUploadToken(token, targetFolderId),
        createFolderSharedLink(token, targetFolderId, isPrivateDest),
      ]);

      return new Response(
        JSON.stringify({
          ok: Boolean(uploadToken),
          uploadToken,
          folderId: targetFolderId,
          folderShareUrl,
          error: uploadToken ? undefined : 'Direct upload token unavailable.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'upload_file' || action === 'upload_image') {
      const {
        destination,
        category = 'General',
        fileName,
        contentType = 'application/octet-stream',
        base64Data,
        folderId: explicitFolderId,
      } = body;
      if (!fileName || !base64Data) {
        return new Response(
          JSON.stringify({ ok: false, error: 'fileName and base64Data are required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const resolvedDestination = String(destination || `images/${String(category)}`);
      const isPrivateDest =
        body?.isPrivate !== undefined
          ? Boolean(body.isPrivate)
          : PRIVATE_UPLOAD_DESTINATIONS.has(resolvedDestination) ||
            resolvedDestination.startsWith('students/') ||
            resolvedDestination.startsWith('people/');

      const targetFolderId = explicitFolderId
        ? String(explicitFolderId).trim()
        : await resolveUploadFolderId(token, resolvedDestination, isPrivateDest);
      const cleanName = String(fileName).replace(/[^A-Za-z0-9._-]/g, '_');
      const uploaded = await upsertFileToBox(
        token,
        targetFolderId,
        cleanName,
        decodeBase64(base64Data),
        contentType
      );
      const links = uploaded?.id
        ? await createSharedLinks(token, uploaded.id, isPrivateDest)
        : { directUrl: null, shareUrl: null };

      return new Response(
        JSON.stringify({
          ok: true,
          fileId: uploaded?.id,
          folderId: targetFolderId,
          fileName: uploaded?.name || cleanName,
          directUrl: links.directUrl,
          shareUrl: links.shareUrl,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'sync_json') {
      const { key, payload, updatedBy = 'Admin' } = body;
      const keyStr = String(key || '');
      if (!keyStr || payload === undefined) {
        return new Response(
          JSON.stringify({ ok: false, error: 'key and payload are required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (!Object.prototype.hasOwnProperty.call(SECTION_FOLDER_MAP, keyStr)) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Unsupported sync key.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const syncRootId = await ensureFolder(token, BOX_ROOT_FOLDER_ID, '06_Website_Data_Sync');
      const jsonBackupsId = await ensureFolder(token, syncRootId, 'JSON_Backups');
      const cleanKey = keyStr.replace(/[^A-Za-z0-9._-]/g, '_');
      const jsonText = JSON.stringify(
        {
          key: cleanKey,
          updatedAt: new Date().toISOString(),
          updatedBy,
          data: payload,
        },
        null,
        2
      );
      const uploaded = await upsertFileToBox(
        token,
        jsonBackupsId,
        `${cleanKey}.json`,
        new TextEncoder().encode(jsonText),
        'application/json'
      );

      return new Response(
        JSON.stringify({
          ok: true,
          fileId: uploaded?.id,
          folder: '06_Website_Data_Sync/JSON_Backups',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: false, error: 'Unknown action.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('box-sync error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: 'Box sync operation failed.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

