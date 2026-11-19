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
  ersl_sec_datalayers: '02_Datasets_Public',
  ersl_sec_publications: '02_Datasets_Public',
  ersl_sec_themes: '02_Datasets_Public',
  ersl_subpage_themes: '02_Datasets_Public',
  ersl_sec_home: '06_Website_Data_Sync',
  ersl_sec_research: '02_Datasets_Public',
  ersl_sec_people: '03_Datasets_Members',
  ersl_sec_teaching: '03_Datasets_Members',
  ersl_sec_bulletins: '03_Datasets_Members',
  ersl_sec_bulletin_folders: '03_Datasets_Members',
  ersl_professional_hub: '03_Datasets_Members',
  ersl_professional_posts: '03_Datasets_Members',
  ersl_workplan: '03_Datasets_Members',
  ersl_workplan_matrix: '03_Datasets_Members',
  ersl_reservoir: '03_Datasets_Members',
  ersl_reservoir_matrix: '03_Datasets_Members',
  ersl_sec_projects: '04_Projects',
  ersl_subpage_projects: '04_Projects',
  ersl_subpage_students: '07_Students',
  ersl_sec_software: '05_Softwares_And_Guides',
  ersl_sec_instruments: '06_Website_Data_Sync',
  ersl_subpage_instruments: '06_Website_Data_Sync',
  ersl_sec_news: '06_Website_Data_Sync',
  ersl_site_config: '06_Website_Data_Sync',
  ersl_custom_pages: '06_Website_Data_Sync',
  ersl_sec_auditlogs: '06_Website_Data_Sync',
};

const PRIVATE_UPLOAD_DESTINATIONS = new Set(['workplan', 'bulletins', 'teaching']);

const FILE_DESTINATION_MAP: Record<string, [string, string?]> = {
  publications: ['02_Datasets_Public', 'Publications'],
  datasets: ['02_Datasets_Public', 'Datasets'],
  teaching: ['03_Datasets_Members', 'Teaching_Materials'],
  bulletins: ['03_Datasets_Members', 'Bulletins_Docs'],
  workplan: ['03_Datasets_Members', 'Workplan_Attachments'],
  projects: ['04_Projects', 'Project_Files'],
  software: ['05_Softwares_And_Guides', 'Files'],
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

async function listFolderItems(token: string, folderId: string) {
  const res = await fetch(
    `https://api.box.com/2.0/folders/${folderId}/items?fields=id,name,type&limit=1000`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Box list folder ${folderId} failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.entries || [];
}

async function ensureFolder(token: string, parentId: string, name: string): Promise<string> {
  const entries = await listFolderItems(token, parentId);
  const existing = entries.find(
    (e: any) => e.type === 'folder' && String(e.name || '').toLowerCase() === name.toLowerCase()
  );
  if (existing) return existing.id;

  const createRes = await fetch('https://api.box.com/2.0/folders', {
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
  return created.id;
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
    const sub = destination.slice('images/'.length) || 'General';
    const rootImagesId = await ensureFolder(token, BOX_ROOT_FOLDER_ID, '01_Website_Images');
    return ensureFolder(token, rootImagesId, sub);
  }
  if (destination.startsWith('students/')) {
    const rawName = destination.slice('students/'.length).replace(/[^A-Za-z0-9._-]/g, '_') || 'General';
    const rootStudentsId = await ensureFolder(token, BOX_ROOT_FOLDER_ID, '07_Students');
    return ensureFolder(token, rootStudentsId, rawName);
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

    if (action === 'upload_file' || action === 'upload_image') {
      const {
        destination,
        category = 'General',
        fileName,
        contentType = 'application/octet-stream',
        base64Data,
      } = body;
      if (!fileName || !base64Data) {
        return new Response(
          JSON.stringify({ ok: false, error: 'fileName and base64Data are required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const resolvedDestination = String(destination || `images/${String(category)}`);
      const targetFolderId = await resolveUploadFolderId(token, resolvedDestination);
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
        resolvedDestination.startsWith('students/');
      const links = uploaded?.id
        ? await createSharedLinks(token, uploaded.id, isPrivateDest)
        : { directUrl: null, shareUrl: null };

      return new Response(
        JSON.stringify({
          ok: true,
          fileId: uploaded?.id,
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

