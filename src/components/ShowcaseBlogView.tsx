import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Calendar,
  CheckCircle2,
  Code2,
  Database,
  Edit2,
  ExternalLink,
  FileText,
  FolderGit2,
  Hash,
  Image as ImageIcon,
  IndentDecrease,
  IndentIncrease,
  Link2,
  ListChecks,
  Maximize2,
  Rocket,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { ProjectContentBlock, ProjectReferenceLink } from '../types';
import {
  isBoxUrl,
  isSafeDataDocumentUrl,
  openOrDownloadResource,
  resolveAssetUrl,
  resolveReferenceUrl,
} from '../lib/boxUtils';
import { LinkedReferenceText } from './LinkedReferenceText';

interface ShowcaseBlogViewProps {
  tabTitle: string;
  tabSummary?: string;
  blocks: ProjectContentBlock[];
  canEdit: boolean;
  primaryColor: string;
  onEdit: (block: ProjectContentBlock) => void;
  onDelete: (blockId: string) => void;
  onMove: (index: number, delta: -1 | 1) => void;
  onToggleSectionLevel?: (block: ProjectContentBlock) => void;
}

const REF_KIND_META: Record<
  NonNullable<ProjectReferenceLink['kind']>,
  { label: string; icon: React.ReactNode; pillCls: string }
> = {
  paper: {
    label: 'Paper / DOI',
    icon: <BookOpen className="w-3 h-3" />,
    pillCls: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
  },
  dataset: {
    label: 'Dataset',
    icon: <Database className="w-3 h-3" />,
    pillCls: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100',
  },
  code: {
    label: 'Code / Model',
    icon: <Code2 className="w-3 h-3" />,
    pillCls: 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100',
  },
  demo: {
    label: 'Result / App',
    icon: <Rocket className="w-3 h-3" />,
    pillCls: 'bg-rose-50 text-[#9E1B32] border-rose-200 hover:bg-rose-100',
  },
  box: {
    label: 'Box Archive',
    icon: <FolderGit2 className="w-3 h-3" />,
    pillCls: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  },
  other: {
    label: 'Reference',
    icon: <ExternalLink className="w-3 h-3" />,
    pillCls: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200',
  },
};

export const ShowcaseBlogView: React.FC<ShowcaseBlogViewProps> = ({
  tabTitle,
  tabSummary,
  blocks,
  canEdit,
  primaryColor,
  onEdit,
  onDelete,
  onMove,
  onToggleSectionLevel,
}) => {
  const [lightbox, setLightbox] = useState<{ src: string; caption?: string } | null>(null);

  // Build hierarchical numbering (1., 1.1, 1.2, 2., 2.1 ...) for blog outline & sections
  const numberedEntries = useMemo(() => {
    let mainIdx = 0;
    let subIdx = 0;
    return blocks.map(blk => {
      const isSub = blk.sectionLevel === 'subsection';
      if (isSub && mainIdx > 0) {
        subIdx += 1;
        return { block: blk, isSub: true, numLabel: `${mainIdx}.${subIdx}` };
      }
      mainIdx += 1;
      subIdx = 0;
      return { block: blk, isSub: false, numLabel: `${mainIdx}.` };
    });
  }, [blocks]);

  const scrollToBlock = (id: string) => {
    const el = document.getElementById(`showcase-sec-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const renderRefPill = (ref: ProjectReferenceLink) => {
    const meta = REF_KIND_META[ref.kind || 'other'] || REF_KIND_META.other;
    const raw = (ref.url || '').trim();
    if (!raw) return null;

    if (isSafeDataDocumentUrl(raw)) {
      return (
        <button
          key={ref.id}
          type="button"
          onClick={() => openOrDownloadResource(raw, ref.label || 'result-file')}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${meta.pillCls}`}
        >
          {meta.icon}
          <span>{ref.label || meta.label}</span>
        </button>
      );
    }

    const safe = resolveReferenceUrl(raw);
    if (!safe) return null;

    return (
      <a
        key={ref.id}
        href={safe}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors ${meta.pillCls}`}
      >
        {meta.icon}
        <span>{ref.label || meta.label}</span>
        <ExternalLink className="w-2.5 h-2.5 opacity-75" />
      </a>
    );
  };

  return (
    <div className="space-y-6 text-left">
      {/* Article Masthead */}
      <div className="border-b border-gray-200 pb-4 space-y-1.5">
        <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: primaryColor }}>
          <Sparkles className="w-3.5 h-3.5" />
          <span>Research Model &amp; Results Showcase</span>
        </div>
        <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
          {tabTitle}
        </h2>
        {tabSummary && (
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {tabSummary}
          </p>
        )}
      </div>

      {/* Table of Contents (Contents & Sub-Contents) */}
      {numberedEntries.length > 0 && (
        <nav
          aria-label="Showcase Table of Contents"
          className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5" style={{ color: primaryColor }} />
              <span>Contents &amp; Sub-Contents</span>
            </span>
            <span className="text-[10px] font-bold text-slate-400">
              {numberedEntries.length} {numberedEntries.length === 1 ? 'section' : 'sections'} · click to jump
            </span>
          </div>

          <div className="space-y-1">
            {numberedEntries.map(({ block, isSub, numLabel }) => {
              const hasImg = Boolean(block.type === 'image' ? block.url : block.imageUrl);
              const refCount =
                (block.references?.length || 0) +
                (block.url && block.type !== 'image' ? 1 : 0) +
                (block.boxUrl ? 1 : 0);

              return (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => scrollToBlock(block.id)}
                  className={`w-full text-left rounded-lg px-2.5 py-1.5 hover:bg-white border border-transparent hover:border-gray-200 transition-colors flex items-center justify-between gap-2 cursor-pointer group ${
                    isSub ? 'pl-6 text-xs text-slate-600' : 'text-xs font-extrabold text-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className={`font-mono shrink-0 ${isSub ? 'text-[11px] text-slate-400' : 'text-xs font-black'}`}
                      style={!isSub ? { color: primaryColor } : undefined}
                    >
                      {numLabel}
                    </span>
                    <span className="truncate group-hover:underline">{block.title}</span>
                  </span>

                  <span className="flex items-center gap-1.5 shrink-0 text-[10px] font-bold text-slate-400">
                    {block.category && (
                      <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-white border border-gray-200 text-slate-500">
                        {block.category}
                      </span>
                    )}
                    {hasImg && (
                      <span className="px-1.5 py-0.5 rounded bg-white border border-gray-200 text-slate-600 inline-flex items-center gap-0.5">
                        <ImageIcon className="w-2.5 h-2.5" /> Figure
                      </span>
                    )}
                    {refCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-white border border-gray-200 text-blue-700 inline-flex items-center gap-0.5">
                        <Link2 className="w-2.5 h-2.5" /> {refCount}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Blog Article Body */}
      <div className="space-y-7">
        {numberedEntries.map(({ block, isSub, numLabel }, idx) => {
          const inlineImgRaw = block.type === 'image' ? block.url : block.imageUrl;
          const inlineImgSrc = inlineImgRaw
            ? isSafeDataDocumentUrl(inlineImgRaw)
              ? inlineImgRaw
              : resolveAssetUrl(inlineImgRaw)
            : '';

          // Collect all reference links attached to this blog section (structured references + legacy url/boxUrl)
          const allRefs: ProjectReferenceLink[] = [
            ...(Array.isArray(block.references) ? block.references : []),
          ];
          if (block.type !== 'image' && block.url?.trim()) {
            allRefs.push({
              id: `${block.id}-url`,
              label:
                block.type === 'software'
                  ? 'Repository / Model Link'
                  : block.type === 'dataset'
                    ? 'Dataset Access Link'
                    : 'Corresponding Result / Reference',
              url: block.url.trim(),
              kind:
                block.type === 'software'
                  ? 'code'
                  : block.type === 'dataset'
                    ? 'dataset'
                    : 'paper',
            });
          }
          if (block.boxUrl?.trim()) {
            allRefs.push({
              id: `${block.id}-box`,
              label: isSafeDataDocumentUrl(block.boxUrl)
                ? 'Download Attached Result File'
                : isBoxUrl(block.boxUrl)
                  ? 'Open Results in UA Box'
                  : 'Attached Result File',
              url: block.boxUrl.trim(),
              kind: 'box',
            });
          }

          return (
            <article
              key={block.id}
              id={`showcase-sec-${block.id}`}
              className={`scroll-mt-6 group ${
                isSub
                  ? 'ml-3 sm:ml-6 pl-4 sm:pl-5 border-l-2 border-slate-200 space-y-3'
                  : 'pt-2 pb-4 border-b border-gray-100 last:border-b-0 space-y-3.5'
              }`}
            >
              {/* Section Header + Editorial Toolbar */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`font-black font-mono ${isSub ? 'text-xs text-slate-500' : 'text-sm sm:text-base'}`}
                      style={!isSub ? { color: primaryColor } : undefined}
                    >
                      {numLabel}
                    </span>
                    <h3
                      className={`font-extrabold text-slate-900 leading-snug ${
                        isSub ? 'text-sm sm:text-base' : 'text-base sm:text-lg'
                      }`}
                    >
                      {block.title}
                    </h3>
                    {block.category && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-gray-200">
                        {block.category}
                      </span>
                    )}
                    {block.type === 'dataset' && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                        Dataset · {block.availability || 'Public'}
                      </span>
                    )}
                    {block.type === 'software' && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
                        {block.language || 'Code'}{block.version ? ` v${block.version}` : ''}
                      </span>
                    )}
                    {block.type === 'event' && block.date && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 inline-flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5" /> {block.date}
                      </span>
                    )}
                  </div>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0 opacity-85 group-hover:opacity-100">
                    {onToggleSectionLevel && (
                      <button
                        type="button"
                        onClick={() => onToggleSectionLevel(block)}
                        className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-gray-200 text-slate-600 cursor-pointer"
                        title={isSub ? 'Promote to Main Section (1.)' : 'Make Sub-Section (1.1)'}
                      >
                        {isSub ? <IndentDecrease className="w-3.5 h-3.5" /> : <IndentIncrease className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => onMove(idx, -1)}
                      className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-gray-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx >= numberedEntries.length - 1}
                      onClick={() => onMove(idx, 1)}
                      className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-gray-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(block)}
                      className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 cursor-pointer"
                      title="Edit blog section"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(block.id)}
                      className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 cursor-pointer"
                      title="Delete section"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Context Callout Strip */}
              {block.contextNote && (
                <div
                  className="rounded-lg border-l-4 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700 leading-relaxed"
                  style={{ borderLeftColor: primaryColor }}
                >
                  <span className="text-[10px] font-extrabold uppercase tracking-wider block mb-0.5" style={{ color: primaryColor }}>
                    Context &amp; Key Takeaway
                  </span>
                  <LinkedReferenceText text={block.contextNote} />
                </div>
              )}

              {/* Blog Prose / Checklist Body */}
              {block.body && (
                block.type === 'objectives' ? (
                  <ul className="space-y-1.5 text-xs sm:text-[13px] text-slate-700">
                    {block.body
                      .split('\n')
                      .map(line => line.trim())
                      .filter(Boolean)
                      .map((line, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                          <span className="leading-relaxed">
                            <LinkedReferenceText text={line} />
                          </span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <div
                    className={`text-xs sm:text-[13px] text-slate-700 leading-relaxed whitespace-pre-line text-justify ${
                      block.highlight ? 'bg-red-50/40 border border-red-100 rounded-xl p-4' : ''
                    }`}
                  >
                    <LinkedReferenceText text={block.body} />
                  </div>
                )
              )}

              {/* Embedded Figure / Validation Plot */}
              {inlineImgSrc && (
                <figure className="rounded-xl border border-gray-200 bg-slate-50/70 overflow-hidden">
                  <div className="relative bg-white p-2 flex justify-center">
                    <img
                      src={inlineImgSrc}
                      alt={block.caption || block.title}
                      onClick={() => setLightbox({ src: inlineImgSrc, caption: block.caption || block.title })}
                      className="w-full max-h-[520px] object-contain rounded cursor-zoom-in"
                      referrerPolicy="no-referrer"
                    />
                    <button
                      type="button"
                      onClick={() => setLightbox({ src: inlineImgSrc, caption: block.caption || block.title })}
                      className="absolute top-3 right-3 px-2 py-1 rounded-md bg-slate-900/75 hover:bg-slate-900 text-white text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer shadow-xs"
                      title="Open figure full size"
                    >
                      <Maximize2 className="w-3 h-3" /> Enlarge
                    </button>
                  </div>
                  {(block.caption || block.type === 'image') && (
                    <figcaption className="px-4 py-2 text-[11px] font-semibold text-slate-600 border-t border-gray-200 bg-slate-50 flex items-center justify-between gap-2">
                      <span>{block.caption || block.title}</span>
                    </figcaption>
                  )}
                </figure>
              )}

              {/* Corresponding Result Reference Links Bar */}
              {allRefs.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 inline-flex items-center gap-1">
                    <Link2 className="w-3 h-3" /> Linked Results &amp; References:
                  </span>
                  {allRefs.map(renderRefPill)}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Full-Resolution Figure Zoom Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          onClick={() => setLightbox(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
              <span className="text-xs font-extrabold text-slate-800 truncate">
                {lightbox.caption || 'Result Figure'}
              </span>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-slate-50 overflow-auto flex-1 flex items-center justify-center">
              <img
                src={lightbox.src}
                alt={lightbox.caption || 'Result Figure'}
                className="max-w-full max-h-[80vh] object-contain rounded"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
