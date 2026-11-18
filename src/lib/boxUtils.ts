/**
 * Box Cloud Asset & Dataset Utilities for ERSL Portal
 * Supports University of Alabama Box (ua.box.com) and standard box.com links.
 */

function isAllowedBoxHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'box.com' ||
    host.endsWith('.box.com') ||
    host === 'boxcloud.com' ||
    host.endsWith('.boxcloud.com')
  );
}

/**
 * Sanitize external or relative URLs used in href/iframe attributes to prevent
 * javascript:, vbscript:, and unsafe data: URI injection.
 */
export function sanitizeExternalUrl(
  url?: string,
  options: { allowMailto?: boolean } = {}
): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Allow safe relative paths (/..., ./...) without protocol-relative (//) bypass
  if ((trimmed.startsWith('/') && !trimmed.startsWith('//')) || trimmed.startsWith('./')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol === 'https:' || protocol === 'http:') {
      return parsed.href;
    }
    if (options.allowMailto && protocol === 'mailto:') {
      return parsed.href;
    }
    return '';
  } catch {
    return '';
  }
}

export function isSafeDataDocumentUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return /^data:(image\/(png|jpe?g|webp|gif)|application\/(pdf|json|zip|x-zip-compressed|msword|octet-stream|vnd\.[A-Za-z0-9.+-]+)|text\/(plain|csv|markdown|x-python));base64,[A-Za-z0-9+/=]+$/i.test(
    trimmed
  );
}

/**
 * Returns true if the URL is either a safe external/relative URL OR a safe uploaded data document/image.
 */
export function isResolvableResourceUrl(url?: string): boolean {
  return Boolean(sanitizeExternalUrl(url, { allowMailto: true }) || isSafeDataDocumentUrl(url));
}

export function getUploadedFileLabel(url?: string): string {
  if (!url || !url.startsWith('data:')) return '';
  const mime = url.slice(5, url.indexOf(';')).toLowerCase();
  if (mime === 'application/pdf') return 'Uploaded Local PDF Document';
  if (mime.startsWith('image/')) return 'Uploaded / Pasted Image';
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime === 'text/csv') return 'Uploaded Local Spreadsheet / Data';
  if (mime.includes('word') || mime.includes('document')) return 'Uploaded Local Word Document';
  if (mime.includes('zip')) return 'Uploaded Local Archive (.zip)';
  return 'Uploaded Local File';
}

/**
 * Safely opens an external HTTP(S) link OR converts a locally uploaded data: document/image
 * into an object Blob URL so Chrome never blocks top-frame data: navigation.
 */
export function openOrDownloadResource(url?: string, fallbackFilename = 'ersl-file'): void {
  if (!url || typeof url !== 'string') return;
  const trimmed = url.trim();
  if (!trimmed) return;

  if (isSafeDataDocumentUrl(trimmed)) {
    try {
      const commaIdx = trimmed.indexOf(',');
      const meta = trimmed.slice(5, commaIdx);
      const mime = meta.split(';')[0] || 'application/octet-stream';
      const b64 = trimmed.slice(commaIdx + 1);
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      const blobUrl = URL.createObjectURL(blob);

      const extMap: Record<string, string> = {
        'application/pdf': 'pdf',
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'text/plain': 'txt',
        'text/csv': 'csv',
        'application/json': 'json',
        'application/zip': 'zip',
      };
      const ext = extMap[mime.toLowerCase()];
      const safeName = fallbackFilename.includes('.')
        ? fallbackFilename
        : ext
          ? `${fallbackFilename}.${ext}`
          : fallbackFilename;

      const isPreviewable = mime === 'application/pdf' || mime.startsWith('image/') || mime === 'text/plain';
      if (isPreviewable) {
        const win = window.open(blobUrl, '_blank', 'noopener,noreferrer');
        if (!win) {
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = safeName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } else {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = safeName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch {
      // ignore malformed base64
    }
    return;
  }

  const safe = sanitizeExternalUrl(trimmed, { allowMailto: true });
  if (safe) {
    window.open(safe, '_blank', 'noopener,noreferrer');
  }
}

export function isBoxUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url.trim());
    return (u.protocol === 'https:' || u.protocol === 'http:') && isAllowedBoxHostname(u.hostname);
  } catch {
    return false;
  }
}

/**
 * Converts a standard Box shared link (e.g. https://ua.box.com/s/abc123)
 * into an embeddable iframe URL (https://ua.app.box.com/embed/s/abc123).
 * Returns empty string for invalid or non-Box URLs.
 */
export function toBoxEmbedUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    if ((u.protocol !== 'https:' && u.protocol !== 'http:') || !isAllowedBoxHostname(u.hostname)) {
      return '';
    }
    const m = u.pathname.match(/\/s\/([A-Za-z0-9_-]+)/);
    if (!m) {
      return u.protocol === 'https:' ? u.href : `https://${u.hostname}${u.pathname}${u.search}`;
    }
    const host = u.hostname.includes('.app.box.com')
      ? u.hostname
      : u.hostname === 'app.box.com' || u.hostname === 'www.box.com' || u.hostname === 'box.com'
        ? 'app.box.com'
        : u.hostname.replace('.box.com', '.app.box.com');
    return `https://${host}/embed/s/${m[1]}`;
  } catch {
    return '';
  }
}

/**
 * Resolves an image or asset URL.
 * - Direct Box static links (`.../shared/static/...`), http/https URLs, and data URIs pass through.
 * - Box `/s/...` file share links are returned as-is (note: for <img> tags, Box Direct Links
 *   `https://ua.box.com/shared/static/<id>.<ext>` are required so browsers receive raw image bytes).
 */
export function resolveAssetUrl(
  assetPath: string | undefined,
  category?: 'home' | 'research' | 'instruments' | 'people' | 'news'
): string {
  if (!assetPath) return '';
  const trimmed = assetPath.trim();
  if (!trimmed) return '';
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  const base = import.meta.env.BASE_URL || './';
  if (trimmed.startsWith('/images/')) {
    return `${base}${trimmed.slice(1)}`;
  }
  if (trimmed.startsWith('images/')) {
    return `${base}${trimmed}`;
  }
  if (category) {
    return `${base}images/${category}/${trimmed}`;
  }
  return trimmed;
}

/**
 * Checks whether a Box link looks like a non-direct share page (/s/) rather than a direct file URL (/shared/static/).
 */
export function isBoxSharePageNotDirectFile(url?: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return isBoxUrl(lower) && lower.includes('/s/') && !lower.includes('/shared/static/');
}

