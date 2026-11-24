import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Database,
  Edit2,
  ExternalLink,
  FolderGit2,
  Hash,
  Image as ImageIcon,
  IndentDecrease,
  IndentIncrease,
  Link2,
  Maximize2,
  Rocket,
  Trash2,
  X,
} from 'lucide-react';
import { ProjectContentBlock, ProjectReferenceLink, ProjectShowcaseTab } from '../types';
import {
  isBoxUrl,
  isSafeDataDocumentUrl,
  openOrDownloadResource,
  resolveAssetUrl,
  resolveReferenceUrl,
} from '../lib/boxUtils';
import { RichBlogContent } from './RichBlogContent';

interface ShowcaseBlogViewProps {
  resultTab: ProjectShowcaseTab;
  blocks: ProjectContentBlock[];
  canEdit: boolean;
  primaryColor: string;
  onEditTabMeta?: () => void;
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

function RichBlogProse({ text }: { text: string }) {
  return <RichBlogContent content={text} justifyByDefault={false} />;
}

export const ShowcaseBlogView: React.FC<ShowcaseBlogViewProps> = ({
  resultTab,
  blocks,
  canEdit,
  primaryColor,
  onEditTabMeta,
  onEdit,
  onDelete,
  onMove,
  onToggleSectionLevel,
}) => {
  const [lightbox, setLightbox] = useState<{ src: string; caption?: string } | null>(null);
  const [tocOpen, setTocOpen] = useState(true);
  const [copiedCitation, setCopiedCitation] = useState(false);

  const metrics = Array.isArray(resultTab.metrics) ? resultTab.metrics.filter(m => m.value?.trim() || m.label?.trim()) : [];
  const heroImgSrc = resultTab.heroImageUrl
    ? isSafeDataDocumentUrl(resultTab.heroImageUrl)
      ? resultTab.heroImageUrl
      : resolveAssetUrl(resultTab.heroImageUrl)
    : '';

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
    <article className="max-w-[860px] mx-auto text-left space-y-6 pb-2">
      {/* Editorial Article Header */}
      <header className="space-y-3 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2 flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-[1.85rem] font-black text-slate-900 leading-tight tracking-tight">
              {resultTab.articleTitle?.trim() || resultTab.label}
            </h1>
            {resultTab.summary && (
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                {resultTab.summary}
              </p>
            )}
          </div>
          {canEdit && onEditTabMeta && (
            <button
              type="button"
              onClick={onEditTabMeta}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Edit2 className="w-3 h-3" /> Edit Header / Metrics / Citation
            </button>
          )}
        </div>

        {/* Key Metrics Strip (matching scientific blog metric cards) */}
        {metrics.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {metrics.map(m => (
              <div
                key={m.id}
                className="bg-slate-50 border border-slate-200 border-l-4 rounded-lg px-4 py-3"
                style={{ borderLeftColor: primaryColor }}
              >
                <span className="text-base sm:text-lg font-extrabold block leading-snug" style={{ color: primaryColor }}>
                  {m.value}
                </span>
                <span className="text-xs text-slate-600 leading-snug block mt-0.5">
                  {m.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* Optional Hero Comparison Image / GIF */}
      {heroImgSrc && (
        <figure className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
          <div className="relative bg-white rounded-lg overflow-hidden flex justify-center p-1">
            <img
              src={heroImgSrc}
              alt={resultTab.heroCaption || resultTab.articleTitle || resultTab.label}
              onClick={() =>
                setLightbox({
                  src: heroImgSrc,
                  caption: resultTab.heroCaption || resultTab.articleTitle || resultTab.label,
                })
              }
              className="max-w-full max-h-[540px] object-contain rounded cursor-zoom-in"
              referrerPolicy="no-referrer"
            />
            <button
              type="button"
              onClick={() =>
                setLightbox({
                  src: heroImgSrc,
                  caption: resultTab.heroCaption || resultTab.articleTitle || resultTab.label,
                })
              }
              className="absolute top-2.5 right-2.5 px-2 py-1 rounded-md bg-slate-900/75 hover:bg-slate-900 text-white text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <Maximize2 className="w-3 h-3" /> Enlarge
            </button>
          </div>
          {resultTab.heroCaption && (
            <figcaption className="text-xs sm:text-[13px] text-slate-600 leading-relaxed px-1.5">
              <RichBlogProse text={resultTab.heroCaption} />
            </figcaption>
          )}
        </figure>
      )}

      {/* Collapsible Contents & Sub-Contents Navigation */}
      {numberedEntries.length > 0 && (
        <nav
          aria-label="Showcase Table of Contents"
          className="rounded-xl border border-slate-200 bg-slate-50/80 overflow-hidden"
        >
          <button
            type="button"
            onClick={() => setTocOpen(prev => !prev)}
            className="w-full px-4 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-slate-100/70 transition-colors cursor-pointer"
          >
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5" style={{ color: primaryColor }} />
              <span>Contents &amp; Sub-Contents ({numberedEntries.length})</span>
            </span>
            <span className="text-[11px] font-bold text-slate-500 inline-flex items-center gap-1">
              {tocOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <span>{tocOpen ? 'Hide' : 'Show'}</span>
            </span>
          </button>

          {tocOpen && (
            <div className="px-3 pb-3 pt-1 border-t border-slate-200/80 space-y-1">
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
                    className={`w-full text-left rounded-lg px-2.5 py-1 hover:bg-white border border-transparent hover:border-gray-200 transition-colors flex items-center justify-between gap-2 cursor-pointer group ${
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
          )}
        </nav>
      )}

      {/* Editorial Article Sections & Sub-Sections */}
      <div className="space-y-8">
        {numberedEntries.map(({ block, isSub, numLabel }, idx) => {
          const inlineImgRaw = block.type === 'image' ? block.url : block.imageUrl;
          const inlineImgSrc = inlineImgRaw
            ? isSafeDataDocumentUrl(inlineImgRaw)
              ? inlineImgRaw
              : resolveAssetUrl(inlineImgRaw)
            : '';

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
            <section
              key={block.id}
              id={`showcase-sec-${block.id}`}
              className={`scroll-mt-6 group ${
                isSub
                  ? 'ml-3 sm:ml-6 pl-4 sm:pl-5 border-l-2 border-slate-200 space-y-3'
                  : 'space-y-3.5'
              }`}
            >
              {/* Section Heading + Editorial Controls */}
              <div
                className={`flex items-start justify-between gap-3 ${
                  isSub ? '' : 'border-b-2 border-slate-200 pb-1.5'
                }`}
              >
                <div className="min-w-0 flex-1 flex flex-wrap items-baseline gap-2">
                  <span
                    className={`font-mono shrink-0 ${isSub ? 'text-xs font-bold text-slate-400' : 'text-base sm:text-lg font-black'}`}
                    style={!isSub ? { color: primaryColor } : undefined}
                  >
                    {numLabel}
                  </span>
                  {isSub ? (
                    <h3 className="text-base font-extrabold text-slate-800 leading-snug">
                      {block.title}
                    </h3>
                  ) : (
                    <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-snug">
                      {block.title}
                    </h2>
                  )}
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

                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0 opacity-85 group-hover:opacity-100 pb-0.5">
                    {onToggleSectionLevel && (
                      <button
                        type="button"
                        onClick={() => onToggleSectionLevel(block)}
                        className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-gray-200 text-slate-600 cursor-pointer"
                        title={isSub ? 'Promote to Main Section (h2)' : 'Make Sub-Section (h3)'}
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
                  className="rounded-lg border-l-4 bg-slate-50 px-4 py-3 text-xs sm:text-[13px] text-slate-700 leading-relaxed"
                  style={{ borderLeftColor: primaryColor }}
                >
                  <span className="text-[10px] font-extrabold uppercase tracking-wider block mb-0.5" style={{ color: primaryColor }}>
                    Context &amp; Highlights
                  </span>
                  <RichBlogProse text={block.contextNote} />
                </div>
              )}

              {/* Blog Prose Paragraphs or Objectives Checklist */}
              {block.body && (
                block.type === 'objectives' ? (
                  <ul className="space-y-2 text-sm text-slate-700">
                    {block.body
                      .split('\n')
                      .map(line => line.trim())
                      .filter(Boolean)
                      .map((line, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 shrink-0 mt-1 text-emerald-600" />
                          <span className="leading-relaxed">
                            <RichBlogProse text={line} />
                          </span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <div
                    className={`text-sm sm:text-[15px] text-slate-800 leading-relaxed ${
                      block.highlight ? 'bg-red-50/40 border border-red-100 rounded-xl p-4' : ''
                    }`}
                  >
                    <RichBlogContent content={block.body} justifyByDefault />
                  </div>
                )
              )}

              {/* Responsive Figure Card (Full width or 78% centered Scatter Plot + Caption) */}
              {inlineImgSrc && (
                <figure className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
                  <div className="relative bg-white rounded-lg overflow-hidden flex justify-center p-1">
                    <img
                      src={inlineImgSrc}
                      alt={block.caption || block.title}
                      onClick={() => setLightbox({ src: inlineImgSrc, caption: block.caption || block.title })}
                      className={`${
                        block.figureSize === 'compact' ? 'w-full sm:max-w-[78%]' : 'max-w-full'
                      } max-h-[540px] object-contain rounded cursor-zoom-in mx-auto block`}
                      referrerPolicy="no-referrer"
                    />
                    <button
                      type="button"
                      onClick={() => setLightbox({ src: inlineImgSrc, caption: block.caption || block.title })}
                      className="absolute top-2.5 right-2.5 px-2 py-1 rounded-md bg-slate-900/75 hover:bg-slate-900 text-white text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                      title="Open figure full size"
                    >
                      <Maximize2 className="w-3 h-3" /> Enlarge
                    </button>
                  </div>
                  {(block.caption || block.type === 'image') && (
                    <figcaption className="text-xs sm:text-[13px] text-slate-600 leading-relaxed px-1.5">
                      <RichBlogProse text={block.caption || block.title} />
                    </figcaption>
                  )}
                </figure>
              )}

              {/* Linked Results & References Bar */}
              {allRefs.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 inline-flex items-center gap-1">
                    <Link2 className="w-3 h-3" /> Linked Results &amp; References:
                  </span>
                  {allRefs.map(renderRefPill)}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Editorial Data, Code, Attribution & Citation Footer Box */}
      {(resultTab.attributionNote || resultTab.citationText) && (
        <footer className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-3 text-xs sm:text-[13px]">
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
            Data, Code &amp; Attribution
          </h3>
          {resultTab.attributionNote && (
            <p className="text-slate-700 leading-relaxed whitespace-pre-line">
              <RichBlogProse text={resultTab.attributionNote} />
            </p>
          )}
          {resultTab.citationText && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700">Suggested Citation:</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(resultTab.citationText || '');
                    setCopiedCitation(true);
                    setTimeout(() => setCopiedCitation(false), 2000);
                  }}
                  className="px-2 py-0.5 rounded bg-white border border-slate-200 hover:bg-slate-100 text-[10px] font-bold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                >
                  {copiedCitation ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCitation ? 'Copied!' : 'Copy Citation'}</span>
                </button>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 font-mono text-[11px] sm:text-xs text-slate-700 overflow-x-auto leading-relaxed">
                {resultTab.citationText}
              </div>
            </div>
          )}
        </footer>
      )}

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
    </article>
  );
};
