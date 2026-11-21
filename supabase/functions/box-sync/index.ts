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

// Explicit allowlist mapping ERSL portal keys to ERSL_Website_Storage folders
const SECTION_FOLDER_MAP: Record<string, string> = {
  ersl_sec_datalayers: 'Datasets',
  ersl_sec_publications: '02_Datasets_Public',
  ersl_sec_themes: '02_Datasets_Public',
  ersl_subpage_themes: '02_Datasets_Public',
  ersl_sec_home: '06_Website_Data_Sync',
  ersl_sec_research: '02_Datasets_Public',
  ersl_sec_people: 'People',
  ersl_sec_teaching: '03_Datasets_Members',
  ersl_sec_bulletins: '03_Datasets_Members',
  ersl_sec_bulletin_folders: '03_Datasets_Members',
  ersl_professional_hub: '03_Datasets_Members',
  ersl_professional_posts: '03_Datasets_Members',
  ersl_workplan: '03_Datasets_Members',
  ersl_workplan_matrix: '03_Datasets_Members',
  ersl_reservoir: '03_Datasets_Members',
  ersl_reservoir_matrix: '03_Datasets_Members',
  ersl_sec_projects: 'Projects',
  ersl_subpage_projects: 'Projects',
  ersl_subpage_students: 'People',
  ersl_sec_software: 'Software',
  ersl_sec_instruments: 'Instruments',
  ersl_subpage_instruments: 'Instruments',
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

const PRIVATE_UPLOAD_DESTINATIONS = new Set(['workplan', 'bulletins', 'teaching']);

const FILE_DESTINATION_MAP: Record<string, [string, string?]> = {
  publications: ['02_Datasets_Public', 'Publications'],
  datasets: ['Datasets', '_Shared_Datasets'],
  teaching: ['03_Datasets_Members', 'Teaching_Materials'],
  bulletins: ['03_Datasets_Members', 'Bulletins_Docs'],
  workplan: ['03_Datasets_Members', 'Workplan_Attachments'],
  projects: ['Projects', '_Shared_Project_Files'],
  instruments: ['Instruments', '_Shared_Manuals'],
  software: ['Software', '_Shared_Releases'],
  people: ['People', '_Shared_Files'],
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

async function resolveUploadFolderId(token: string, destination: string): Promise<string> {
  if (destination.startsWith('images/')) {
    const sub = sanitizeFolderSegment(destination.slice('images/'.length), 'General');
    const rootImagesId = await ensureFolder(token, BOX_ROOT_FOLDER_ID, '01_Website_Images');
    return ensureFolder(token, rootImagesId, sub);
  }
  if (destination.startsWith('students/')) {
    const rawName = sanitizeFolderSegment(destination.slice('students/'.length), 'General');
    const rootPeopleId = await ensureFolder(token, BOX_ROOT_FOLDER_ID, 'People');
    return ensureFolder(token, rootPeopleId, rawName);
  }

  for (const [catKey, rootName] of Object.entries(ENTITY_CATEGORY_FOLDER_MAP)) {
    const prefix = `${catKey}/`;
    if (destination.startsWith(prefix)) {
      const subName = sanitizeFolderSegment(destination.slice(prefix.length), 'General');
      const catFolderId = await ensureFolder(token, BOX_ROOT_FOLDER_ID, rootName);
      return ensureFolder(token, catFolderId, subName);
    }
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
      const itemRes = await getOrCreateFolderWithEntries(token, catRes.id, safeName);
      const shareUrl = itemRes.shareUrl || (await createFolderSharedLink(token, itemRes.id, isPrivate));

      return new Response(
        JSON.stringify({
          ok: true,
          category,
          categoryFolderId: catRes.id,
          folderId: itemRes.id,
          folderName: safeName,
          folderPath: `${rootFolderName}/${safeName}`,
          shareUrl,
          created: itemRes.created,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'sync_entity_folders') {
      const items = Array.isArray(body?.items) ? body.items : [];
      const rootEntries = await listFolderItems(token, BOX_ROOT_FOLDER_ID);
      const categoryFolderMap: Record<string, { id: string; shareUrl: string; entries: any[] }> = {};

      for (const [catKey, rootName] of Object.entries(ENTITY_CATEGORY_FOLDER_MAP)) {
        const catRes = await getOrCreateFolderWithEntries(token, BOX_ROOT_FOLDER_ID, rootName, rootEntries);
        const catShareUrl = catRes.shareUrl || (await createFolderSharedLink(token, catRes.id, catKey === 'people' || catKey === 'projects'));
        const catEntries = await listFolderItems(token, catRes.id);
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
        const itemRes = await getOrCreateFolderWithEntries(token, catInfo.id, safeName, catInfo.entries);
        const isPrivate = item?.isPrivate !== undefined ? Boolean(item.isPrivate) : (catKey === 'people' || catKey === 'projects');
        const shareUrl = itemRes.shareUrl || (await createFolderSharedLink(token, itemRes.id, isPrivate));

        results.push({
          category: catKey,
          id: String(item.id),
          folderId: itemRes.id,
          folderName: safeName,
          folderPath: `${ENTITY_CATEGORY_FOLDER_MAP[catKey]}/${safeName}`,
          shareUrl,
          created: itemRes.created,
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
          targetFolderId = await ensureFolder(token, catId, safeSub);
          resolvedPath = `${rootName}/${safeSub}`;
        } else {
          targetFolderId = catId;
          resolvedPath = rootName;
        }
      }

      const [entries, folderShareUrl] = await Promise.all([
        listFolderItems(token, targetFolderId),
        createFolderSharedLink(token, targetFolderId, category === 'people' || category === 'projects'),
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
      const targetFolderId = body?.folderId
        ? String(body.folderId).trim()
        : await resolveUploadFolderId(token, resolvedDestination);
      const [uploadToken, folderShareUrl] = await Promise.all([
        downscopeUploadToken(token, targetFolderId),
        createFolderSharedLink(
          token,
          targetFolderId,
          PRIVATE_UPLOAD_DESTINATIONS.has(resolvedDestination) ||
            resolvedDestination.startsWith('people/') ||
            resolvedDestination.startsWith('students/') ||
            resolvedDestination.startsWith('projects/')
        ),
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
      const targetFolderId = explicitFolderId
        ? String(explicitFolderId).trim()
        : await resolveUploadFolderId(token, resolvedDestination);
      const cleanName = String(fileName).replace(/[^A-Za-z0-9._-]/g, '_');
      const uploaded = await upsertFileToBox(
        token,
        targetFolderId,
        cleanName,
        decodeBase64(base64Data),
        contentType
      );
      const isPrivateDest =
        PRIVATE_UPLOAD_DESTINATIONS.has(resolvedDestination) ||
        resolvedDestination.startsWith('students/') ||
        resolvedDestination.startsWith('people/') ||
        Boolean(body?.isPrivate);
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

      const targetSubfolder = SECTION_FOLDER_MAP[keyStr];
      const folderId = await ensureFolder(token, BOX_ROOT_FOLDER_ID, targetSubfolder);
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
        folderId,
        `${cleanKey}.json`,
        new TextEncoder().encode(jsonText),
        'application/json'
      );

      return new Response(
        JSON.stringify({
          ok: true,
          fileId: uploaded?.id,
          folder: targetSubfolder,
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

