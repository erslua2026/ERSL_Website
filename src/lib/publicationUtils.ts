import type { Publication } from '../types';

export interface DuplicateMatchResult {
  existing: Publication;
  reason: 'DOI' | 'URL' | 'Title';
}

export function extractNormalizedDoi(input?: string): string {
  if (!input || typeof input !== 'string') return '';
  const match = input.match(/10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/i);
  return match ? match[0].replace(/[.,;)\]]+$/, '').toLowerCase() : '';
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
