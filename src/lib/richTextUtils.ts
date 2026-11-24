const KATEX_CSS_ID = 'ersl-katex-css';
const KATEX_JS_ID = 'ersl-katex-js';
const KATEX_CSS_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
const KATEX_JS_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';

let katexLoaderPromise: Promise<any> | null = null;

/**
 * Lazily loads KaTeX CSS & JS once from CDN so LaTeX equations render crisply
 * across Showcase blogs, Project pages, and News articles without bundling bloat.
 */
export function ensureKatexLoaded(): Promise<any> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  const win = window as any;
  if (win.katex) {
    return Promise.resolve(win.katex);
  }

  if (!document.getElementById(KATEX_CSS_ID)) {
    const link = document.createElement('link');
    link.id = KATEX_CSS_ID;
    link.rel = 'stylesheet';
    link.href = KATEX_CSS_URL;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }

  if (katexLoaderPromise) return katexLoaderPromise;

  katexLoaderPromise = new Promise(resolve => {
    const existing = document.getElementById(KATEX_JS_ID) as HTMLScriptElement | null;
    if (existing) {
      if ((window as any).katex) {
        resolve((window as any).katex);
        return;
      }
      existing.addEventListener('load', () => resolve((window as any).katex || null), { once: true });
      existing.addEventListener('error', () => resolve(null), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = KATEX_JS_ID;
    script.src = KATEX_JS_URL;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve((window as any).katex || null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });

  return katexLoaderPromise;
}

export function renderEquationToHtml(latex: string, displayMode = false): string {
  const cleaned = (latex || '').trim();
  if (!cleaned) return '';
  if (typeof window !== 'undefined' && (window as any).katex) {
    try {
      return (window as any).katex.renderToString(cleaned, {
        displayMode,
        throwOnError: false,
        strict: false,
      });
    } catch {
      // Fallback below
    }
  }
  const escaped = escapeHtml(cleaned);
  return displayMode
    ? `<code class="ersl-math-fallback block text-center font-mono text-sm py-1">${escaped}</code>`
    : `<code class="ersl-math-fallback font-mono text-[0.9em] px-1 rounded bg-slate-100">${escaped}</code>`;
}

export function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isHtmlRichText(value?: string): boolean {
  if (!value) return false;
  return /<\/?(p|div|span|strong|b|em|i|u|s|strike|sub|sup|ul|ol|li|table|thead|tbody|tr|th|td|blockquote|h[1-6]|br|hr|a|code|pre)\b[^>]*>/i.test(
    value
  );
}

/**
 * Converts legacy plain text (`**bold**`, `` `code` ``, newlines) to editable HTML
 * when opening an existing block or news item in the Microsoft-Word-style editor.
 */
export function plainTextToInitialHtml(value?: string): string {
  if (!value || !value.trim()) return '';
  if (isHtmlRichText(value)) return sanitizeRichHtml(value);

  const paragraphs = value
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return '';

  return paragraphs
    .map(para => {
      const tokens = para.split(/(\*\*[^*]+\*\*|`[^`]+`|\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);
      const inner = tokens
        .map(tok => {
          if (tok.startsWith('**') && tok.endsWith('**') && tok.length > 4) {
            return `<strong>${escapeHtml(tok.slice(2, -2))}</strong>`;
          }
          if (tok.startsWith('`') && tok.endsWith('`') && tok.length > 2) {
            return `<code>${escapeHtml(tok.slice(1, -1))}</code>`;
          }
          if (tok.startsWith('$$') && tok.endsWith('$$') && tok.length > 4) {
            const latex = tok.slice(2, -2).trim();
            return `<div class="ersl-eq-block" data-latex="${escapeHtml(latex)}" data-display="block" contenteditable="false">${escapeHtml(latex)}</div>`;
          }
          if (tok.startsWith('$') && tok.endsWith('$') && tok.length > 2) {
            const latex = tok.slice(1, -1).trim();
            return `<span class="ersl-eq-inline" data-latex="${escapeHtml(latex)}" data-display="inline" contenteditable="false">${escapeHtml(latex)}</span>`;
          }
          return escapeHtml(tok).replace(/\n/g, '<br />');
        })
        .join('');
      return `<p>${inner}</p>`;
    })
    .join('');
}

const ALLOWED_TAGS = new Set([
  'p',
  'div',
  'br',
  'span',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'sub',
  'sup',
  'code',
  'pre',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'hr',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'a',
  'font',
]);

const ALLOWED_STYLE_PROPS = new Set([
  'color',
  'background-color',
  'background',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-decoration',
  'text-align',
  'vertical-align',
  'border',
  'border-collapse',
  'width',
  'padding',
  'margin',
]);

function filterSafeStyle(rawStyle: string): string {
  const safeParts: string[] = [];
  rawStyle.split(';').forEach(decl => {
    const colon = decl.indexOf(':');
    if (colon <= 0) return;
    const prop = decl.slice(0, colon).trim().toLowerCase();
    const val = decl.slice(colon + 1).trim();
    if (!ALLOWED_STYLE_PROPS.has(prop)) return;
    if (!val || /expression|javascript:|url\(/i.test(val)) return;
    safeParts.push(`${prop}: ${val}`);
  });
  return safeParts.join('; ');
}

/**
 * Sanitizes rich HTML created by the editor or pasted from Microsoft Word / Docs.
 */
export function sanitizeRichHtml(dirtyHtml: string): string {
  if (!dirtyHtml || !dirtyHtml.trim()) return '';
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return dirtyHtml;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${dirtyHtml}</div>`, 'text/html');
    const root = doc.body.firstElementChild;
    if (!root) return '';

    const cleanNode = (node: Node): Node | null => {
      if (node.nodeType === Node.TEXT_NODE) {
        return document.createTextNode(node.textContent || '');
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return null;

      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (tag === 'script' || tag === 'style' || tag === 'iframe' || tag === 'object' || tag === 'embed' || tag === 'form') {
        return null;
      }

      // Preserve equation containers cleanly without keeping old inner KaTeX DOM bloat
      const dataLatex = el.getAttribute('data-latex');
      if (dataLatex !== null) {
        const displayMode = el.getAttribute('data-display') === 'block' || tag === 'div';
        const eqEl = document.createElement(displayMode ? 'div' : 'span');
        eqEl.setAttribute('class', displayMode ? 'ersl-eq-block' : 'ersl-eq-inline');
        eqEl.setAttribute('data-latex', dataLatex);
        eqEl.setAttribute('data-display', displayMode ? 'block' : 'inline');
        eqEl.textContent = dataLatex;
        return eqEl;
      }

      if (!ALLOWED_TAGS.has(tag)) {
        const frag = document.createDocumentFragment();
        Array.from(el.childNodes).forEach(child => {
          const cleaned = cleanNode(child);
          if (cleaned) frag.appendChild(cleaned);
        });
        return frag;
      }

      // Normalize legacy <font> tags generated by some browsers' execCommand
      let targetTag = tag === 'font' ? 'span' : tag;
      const cleanEl = document.createElement(targetTag);

      if (tag === 'font') {
        const face = el.getAttribute('face');
        const color = el.getAttribute('color');
        const size = el.getAttribute('size');
        const fontStyles: string[] = [];
        if (face) fontStyles.push(`font-family: ${face}`);
        if (color) fontStyles.push(`color: ${color}`);
        if (size) {
          const sizeMap: Record<string, string> = {
            '1': '11px',
            '2': '13px',
            '3': '15px',
            '4': '17px',
            '5': '20px',
            '6': '24px',
            '7': '28px',
          };
          if (sizeMap[size]) fontStyles.push(`font-size: ${sizeMap[size]}`);
        }
        const combined = filterSafeStyle(
          [el.getAttribute('style') || '', ...fontStyles].filter(Boolean).join('; ')
        );
        if (combined) cleanEl.setAttribute('style', combined);
      } else {
        const rawStyle = el.getAttribute('style');
        if (rawStyle) {
          const safeStyle = filterSafeStyle(rawStyle);
          if (safeStyle) cleanEl.setAttribute('style', safeStyle);
        }
      }

      const alignAttr = el.getAttribute('align');
      if (alignAttr && /^(left|center|right|justify)$/i.test(alignAttr)) {
        const prevStyle = cleanEl.getAttribute('style') || '';
        if (!/text-align\s*:/i.test(prevStyle)) {
          cleanEl.setAttribute('style', `${prevStyle ? prevStyle + '; ' : ''}text-align: ${alignAttr.toLowerCase()}`);
        }
      }

      if (targetTag === 'a') {
        const href = (el.getAttribute('href') || '').trim();
        if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) {
          cleanEl.setAttribute('href', href);
          cleanEl.setAttribute('target', '_blank');
          cleanEl.setAttribute('rel', 'noopener noreferrer');
        }
      }

      if (targetTag === 'table') {
        cleanEl.setAttribute('class', 'ersl-rich-table');
      }

      if (targetTag === 'td' || targetTag === 'th') {
        const colspan = el.getAttribute('colspan');
        const rowspan = el.getAttribute('rowspan');
        if (colspan && /^\d+$/.test(colspan)) cleanEl.setAttribute('colspan', colspan);
        if (rowspan && /^\d+$/.test(rowspan)) cleanEl.setAttribute('rowspan', rowspan);
      }

      Array.from(el.childNodes).forEach(child => {
        const cleaned = cleanNode(child);
        if (cleaned) cleanEl.appendChild(cleaned);
      });

      return cleanEl;
    };

    const container = document.createElement('div');
    Array.from(root.childNodes).forEach(child => {
      const cleaned = cleanNode(child);
      if (cleaned) container.appendChild(cleaned);
    });
    return container.innerHTML;
  } catch {
    return dirtyHtml;
  }
}

export function stripRichHtmlToPlainText(value?: string): string {
  if (!value) return '';
  if (!isHtmlRichText(value)) {
    return value.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').trim();
  }
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(`<div>${value}</div>`, 'text/html');
      doc.querySelectorAll('br').forEach(br => br.replaceWith(' '));
      doc.querySelectorAll('p, div, li, tr, h1, h2, h3, h4').forEach(el => {
        el.appendChild(doc.createTextNode(' '));
      });
      doc.querySelectorAll('td, th').forEach(cell => {
        cell.appendChild(doc.createTextNode('  '));
      });
      return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
    } catch {
      // Fallback regex strip
    }
  }
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
