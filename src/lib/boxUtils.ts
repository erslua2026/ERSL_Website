/**
 * Box Cloud Asset & Dataset Utilities for ERSL Portal
 * Supports University of Alabama Box (ua.box.com) and standard box.com links.
 */

export function isBoxUrl(url?: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes('box.com/') || lower.includes('boxcloud.com/');
}

/**
 * Converts a standard Box shared link (e.g. https://ua.box.com/s/abc123)
 * into an embeddable iframe URL (https://ua.app.box.com/embed/s/abc123).
 */
export function toBoxEmbedUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    const m = u.pathname.match(/\/s\/([A-Za-z0-9_-]+)/);
    if (!m) return url.trim();
    const host = u.hostname.includes('.app.box.com')
      ? u.hostname
      : u.hostname === 'app.box.com' || u.hostname === 'www.box.com' || u.hostname === 'box.com'
        ? 'app.box.com'
        : u.hostname.replace('.box.com', '.app.box.com');
    return `https://${host}/embed/s/${m[1]}`;
  } catch {
    return url.trim();
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

