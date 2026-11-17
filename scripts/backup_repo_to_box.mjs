import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Automated GitHub -> UA Box Repository Backup
 * Triggered only when repository edits are pushed to main (or manually dispatched).
 * Uploads a clean git-tracked zip archive into `07_GitHub_Code_Backups` inside ERSL_Website_Storage.
 */

const BOX_CLIENT_ID = (process.env.BOX_CLIENT_ID || '').trim();
const BOX_CLIENT_SECRET = (process.env.BOX_CLIENT_SECRET || '').trim();
const BOX_ENTERPRISE_ID = (process.env.BOX_ENTERPRISE_ID || '306501').trim();
const BOX_ROOT_FOLDER_ID = (process.env.BOX_ROOT_FOLDER_ID || '436999117457').trim();
const BACKUP_SUBFOLDER_NAME = '07_GitHub_Code_Backups';

if (!BOX_CLIENT_ID || !BOX_CLIENT_SECRET) {
  console.log('Skipping UA Box backup: BOX_CLIENT_ID or BOX_CLIENT_SECRET secret is not configured yet.');
  process.exit(0);
}

async function getBoxAccessToken() {
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
    throw new Error(`Box authentication failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function ensureSubfolder(token, parentId, folderName) {
  const listRes = await fetch(
    `https://api.box.com/2.0/folders/${parentId}/items?fields=id,name,type&limit=1000`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!listRes.ok) {
    const errText = await listRes.text();
    throw new Error(`Failed to list Box folder ${parentId} (${listRes.status}): ${errText}`);
  }
  const listData = await listRes.json();
  const existing = (listData.entries || []).find(
    (entry) => entry.type === 'folder' && String(entry.name || '').toLowerCase() === folderName.toLowerCase()
  );
  if (existing) return existing.id;

  const createRes = await fetch('https://api.box.com/2.0/folders', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      parent: { id: parentId },
    }),
  });
  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create Box subfolder ${folderName} (${createRes.status}): ${errText}`);
  }
  const created = await createRes.json();
  return created.id;
}

async function findExistingFileId(token, folderId, fileName) {
  const listRes = await fetch(
    `https://api.box.com/2.0/folders/${folderId}/items?fields=id,name,type&limit=1000`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!listRes.ok) return null;
  const data = await listRes.json();
  const hit = (data.entries || []).find(
    (entry) => entry.type === 'file' && String(entry.name || '').toLowerCase() === fileName.toLowerCase()
  );
  return hit ? hit.id : null;
}

async function uploadZip(token, folderId, filePath, fileName) {
  const fileBuffer = fs.readFileSync(filePath);
  const existingId = await findExistingFileId(token, folderId, fileName);

  const form = new FormData();
  form.append(
    'attributes',
    JSON.stringify(existingId ? { name: fileName } : { name: fileName, parent: { id: folderId } })
  );
  form.append('file', new Blob([fileBuffer], { type: 'application/zip' }), fileName);

  const uploadUrl = existingId
    ? `https://upload.box.com/api/2.0/files/${existingId}/content`
    : 'https://upload.box.com/api/2.0/files/content';

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Box upload failed (${res.status}): ${errText}`);
  }
  const result = await res.json();
  const uploaded = result.entries?.[0];
  console.log(`Uploaded code backup to UA Box: ${uploaded?.name || fileName} (ID: ${uploaded?.id || 'ok'})`);
}

async function main() {
  const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  const dateStamp = new Date().toISOString().slice(0, 10);
  const zipName = `ERSL_Website_${dateStamp}_${sha}.zip`;
  const zipPath = path.resolve(process.cwd(), zipName);

  console.log(`Creating clean git archive: ${zipName}`);
  execSync(`git archive --format=zip -o "${zipPath}" HEAD`, { stdio: 'inherit' });

  try {
    const token = await getBoxAccessToken();
    const backupFolderId = await ensureSubfolder(token, BOX_ROOT_FOLDER_ID, BACKUP_SUBFOLDER_NAME);
    await uploadZip(token, backupFolderId, zipPath, zipName);
  } finally {
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

