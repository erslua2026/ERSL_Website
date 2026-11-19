import type { Publication } from '../types';
import { isSafeDataDocumentUrl, resolveReferenceUrl, sanitizeExternalUrl } from './boxUtils';

export interface DuplicateMatchResult {
  existing: Publication;
  reason: 'DOI' | 'URL' | 'Title';
}

export interface ResolvedPublicationLinks {
  primaryHref: string;
  isLocalFile: boolean;
  doi: string;
  doiUrl: string;
  externalUrl: string;
  scholarUrl: string;
  scholarLookupUrl: string;
}

export interface ReferenceTextSegment {
  type: 'text' | 'link';
  text: string;
  href?: string;
}

const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

export function decodeHtmlEntities(input?: string): string {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/gi, m => {
    const key = m.toLowerCase();
    return HTML_ENTITY_MAP[key] || m;
  });
}

export function extractNormalizedDoi(input?: string): string {
  if (!input || typeof input !== 'string') return '';
  const match = input.match(/10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/i);
  return match ? match[0].replace(/[.,;)\]]+$/, '').toLowerCase() : '';
}

export function resolvePublicationLinks(pub: Partial<Publication>): ResolvedPublicationLinks {
  const doi =
    extractNormalizedDoi(pub.doi) ||
    extractNormalizedDoi(pub.link) ||
    extractNormalizedDoi(pub.title) ||
    extractNormalizedDoi(pub.abstract);
  const doiUrl = doi ? `https://doi.org/${doi}` : '';
  const isLocalFile = Boolean(pub.link && isSafeDataDocumentUrl(pub.link));
  const externalUrl = !isLocalFile && pub.link ? resolveReferenceUrl(pub.link) : '';
  const scholarUrl = pub.scholarUrl ? sanitizeExternalUrl(pub.scholarUrl) : '';
  const cleanTitle = decodeHtmlEntities(pub.title || '');
  const cleanAuthors = decodeHtmlEntities(pub.authors || '').split(/[;,]/)[0]?.trim() || '';
  const scholarLookupQuery = [cleanTitle, cleanAuthors].filter(Boolean).join(' ');
  const scholarLookupUrl = scholarLookupQuery
    ? `https://scholar.google.com/scholar?q=${encodeURIComponent(scholarLookupQuery)}`
    : '';

  const primaryHref = doiUrl || externalUrl || scholarUrl || '';
  return {
    primaryHref,
    isLocalFile,
    doi,
    doiUrl,
    externalUrl,
    scholarUrl,
    scholarLookupUrl,
  };
}

/**
 * Splits prose or reference text into plain text segments and clickable URL/DOI links.
 */
export function splitTextWithReferenceLinks(text: string): ReferenceTextSegment[] {
  if (!text) return [];
  const pattern = /(https?:\/\/[^\s<>()]+|doi:\s*10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+|\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)/gi;
  const segments: ReferenceTextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    const raw = match[0];
    if (start > lastIndex) {
      segments.push({ type: 'text', text: text.slice(lastIndex, start) });
    }
    const cleanRaw = raw.replace(/[.,;)\]]+$/, '');
    const trailing = raw.slice(cleanRaw.length);
    const href = resolveReferenceUrl(cleanRaw);
    if (href) {
      segments.push({ type: 'link', text: cleanRaw, href });
    } else {
      segments.push({ type: 'text', text: cleanRaw });
    }
    if (trailing) {
      segments.push({ type: 'text', text: trailing });
    }
    lastIndex = start + raw.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIndex) });
  }
  return segments;
}

export function normalizePublicationTitle(title?: string): string {
  if (!title || typeof title !== 'string') return '';
  return title
    .toLowerCase()
    .replace(/<[^>]*>/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizePublicationUrl(url?: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('data:')) return '';
  try {
    const u = new URL(trimmed);
    return `${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/, '').toLowerCase()}`;
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, '');
  }
}

export function findDuplicatePublication(
  candidate: Partial<Publication>,
  existingList: Publication[],
  ignoreId?: string
): DuplicateMatchResult | null {
  if (!Array.isArray(existingList) || existingList.length === 0) return null;

  const candDoi =
    extractNormalizedDoi(candidate.doi) ||
    extractNormalizedDoi(candidate.link) ||
    extractNormalizedDoi(candidate.title);
  const candUrl = normalizePublicationUrl(candidate.link);
  const candTitle = normalizePublicationTitle(candidate.title);

  for (const pub of existingList) {
    if (ignoreId && pub.id === ignoreId) continue;

    if (candDoi) {
      const pubDoi =
        extractNormalizedDoi(pub.doi) ||
        extractNormalizedDoi(pub.link) ||
        extractNormalizedDoi(pub.title);
      if (pubDoi && pubDoi === candDoi) {
        return { existing: pub, reason: 'DOI' };
      }
    }

    if (candUrl) {
      const pubUrl = normalizePublicationUrl(pub.link);
      if (pubUrl && pubUrl === candUrl) {
        return { existing: pub, reason: 'URL' };
      }
    }

    if (candTitle && candTitle.length >= 6) {
      const pubTitle = normalizePublicationTitle(pub.title);
      if (pubTitle && pubTitle === candTitle) {
        return { existing: pub, reason: 'Title' };
      }
    }
  }

  return null;
}
