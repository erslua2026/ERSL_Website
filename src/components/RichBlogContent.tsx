import React, { useEffect, useMemo, useState } from 'react';
import {
  ensureKatexLoaded,
  isHtmlRichText,
  renderEquationToHtml,
  sanitizeRichHtml,
} from '../lib/richTextUtils';
import { LinkedReferenceText } from './LinkedReferenceText';

interface RichBlogContentProps {
  content: string;
  className?: string;
  justifyByDefault?: boolean;
}

const EquationNode: React.FC<{ latex: string; displayMode: boolean }> = ({ latex, displayMode }) => {
  const [readyTick, setReadyTick] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).katex) {
      ensureKatexLoaded().then(() => setReadyTick(t => t + 1));
    }
  }, [latex]);

  const html = useMemo(
    () => renderEquationToHtml(latex, displayMode),
    [latex, displayMode, readyTick]
  );

  if (displayMode) {
    return (
      <span
        className="ersl-eq-block my-3 block overflow-x-auto rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 text-center"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return (
    <span
      className="ersl-eq-inline inline-block align-middle mx-0.5"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

/**
 * Legacy plain-text / markdown inline renderer supporting **bold**, `code`,
 * $inline$ / $$block$$ LaTeX equations, and auto-linked URLs & DOIs.
 */
function PlainOrMarkdownProse({ text }: { text: string }) {
  const tokens = text.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {tokens.map((tok, i) => {
        if (tok.startsWith('$$') && tok.endsWith('$$') && tok.length > 4) {
          return <EquationNode key={i} latex={tok.slice(2, -2).trim()} displayMode />;
        }
        if (tok.startsWith('$') && tok.endsWith('$') && tok.length > 2) {
          return <EquationNode key={i} latex={tok.slice(1, -1).trim()} displayMode={false} />;
        }
        if (tok.startsWith('**') && tok.endsWith('**') && tok.length > 4) {
          return (
            <strong key={i} className="font-bold text-slate-900">
              <LinkedReferenceText text={tok.slice(2, -2)} />
            </strong>
          );
        }
        if (tok.startsWith('`') && tok.endsWith('`') && tok.length > 2) {
          return (
            <code
              key={i}
              className="px-1.5 py-0.5 mx-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[0.88em] text-slate-800"
            >
              {tok.slice(1, -1)}
            </code>
          );
        }
        return <LinkedReferenceText key={i} text={tok} />;
      })}
    </>
  );
}

/**
 * Renders either sanitized Microsoft-Word-style HTML (fonts, colors, alignment,
 * underline, lists, tables, and KaTeX equations) OR legacy plain/markdown prose.
 */
export const RichBlogContent: React.FC<RichBlogContentProps> = ({
  content,
  className = '',
  justifyByDefault = true,
}) => {
  const [katexTick, setKatexTick] = useState(0);
  const isHtml = useMemo(() => isHtmlRichText(content), [content]);

  useEffect(() => {
    if (!content) return;
    if (typeof window !== 'undefined' && !(window as any).katex) {
      if (content.includes('data-latex') || /\$[^$\n]+\$/.test(content)) {
        ensureKatexLoaded().then(() => setKatexTick(t => t + 1));
      }
    }
  }, [content]);

  const renderedHtml = useMemo(() => {
    if (!isHtml) return '';
    const sanitized = sanitizeRichHtml(content);
    if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
      return sanitized;
    }

    try {
      const doc = new DOMParser().parseFromString(`<div>${sanitized}</div>`, 'text/html');
      const root = doc.body.firstElementChild;
      if (!root) return sanitized;

      // Render <span|div data-latex="..."> equations with KaTeX
      root.querySelectorAll('[data-latex]').forEach(el => {
        const latex = el.getAttribute('data-latex') || '';
        const isBlock =
          el.getAttribute('data-display') === 'block' || el.tagName.toLowerCase() === 'div';
        el.innerHTML = renderEquationToHtml(latex, isBlock);
      });

      // Also auto-render $$...$$ or $...$ typed inside plain text nodes inside HTML
      const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];
      let cur: Node | null = walker.nextNode();
      while (cur) {
        const parentTag = cur.parentElement?.tagName.toLowerCase();
        const inEquation = Boolean(cur.parentElement?.closest('[data-latex], code, pre'));
        if (!inEquation && parentTag !== 'a' && cur.nodeValue && /\$[^$\n]+\$/.test(cur.nodeValue)) {
          textNodes.push(cur as Text);
        }
        cur = walker.nextNode();
      }
      textNodes.forEach(tn => {
        const val = tn.nodeValue || '';
        const parts = val.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);
        if (parts.length <= 1) return;
        const frag = doc.createDocumentFragment();
        parts.forEach(part => {
          if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
            const box = doc.createElement('div');
            box.className = 'ersl-eq-block';
            box.innerHTML = renderEquationToHtml(part.slice(2, -2).trim(), true);
            frag.appendChild(box);
          } else if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
            const span = doc.createElement('span');
            span.className = 'ersl-eq-inline';
            span.innerHTML = renderEquationToHtml(part.slice(1, -1).trim(), false);
            frag.appendChild(span);
          } else if (part) {
            frag.appendChild(doc.createTextNode(part));
          }
        });
        tn.replaceWith(frag);
      });

      return root.innerHTML;
    } catch {
      return sanitized;
    }
  }, [content, isHtml, katexTick]);

  if (!content || !content.trim()) return null;

  if (isHtml) {
    return (
      <div
        className={`ersl-rich-content ${justifyByDefault ? 'text-justify' : ''} ${className}`}
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    );
  }

  return (
    <div className={`space-y-3 ${justifyByDefault ? 'text-justify' : ''} ${className}`}>
      {content
        .split(/\n{2,}/)
        .map(p => p.trim())
        .filter(Boolean)
        .map((para, idx) => (
          <p key={idx} className="whitespace-pre-line">
            <PlainOrMarkdownProse text={para} />
          </p>
        ))}
    </div>
  );
};
