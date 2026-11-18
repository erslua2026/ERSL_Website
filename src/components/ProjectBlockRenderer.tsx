import React from 'react';
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
  Image as ImageIcon,
  ListChecks,
  MapPin,
  Trash2,
  Users,
} from 'lucide-react';
import { ProjectContentBlock, ProjectContentBlockType } from '../types';
import { isBoxUrl, resolveAssetUrl, toBoxEmbedUrl } from '../lib/boxUtils';

export interface BlockTypeMeta {
  type: ProjectContentBlockType;
  label: string;
  shortLabel: string;
  description: string;
}

export const BLOCK_TYPE_OPTIONS: BlockTypeMeta[] = [
  {
    type: 'paragraph',
    label: 'Text Paragraph / Information',
    shortLabel: 'Text Paragraph',
    description: 'Rich narrative section describing project background, methods, policies, or updates.',
  },
  {
    type: 'objectives',
    label: 'Objectives / Bullet List',
    shortLabel: 'Objectives / List',
    description: 'Numbered/checked list of project deliverables, tasks, or key points.',
  },
  {
    type: 'dataset',
    label: 'Dataset / Data Product',
    shortLabel: 'Dataset',
    description: 'Link or upload a dataset to UA Box with availability status and Box preview.',
  },
  {
    type: 'software',
    label: 'Software / Code / Model',
    shortLabel: 'Software',
    description: 'Code repository, model package, language/version badge, and Box archive link.',
  },
  {
    type: 'meeting-note',
    label: 'Meeting Notes / Decision Log',
    shortLabel: 'Meeting Note',
    description: 'Record meeting date, attendees, key decisions, action items, and minutes link.',
  },
  {
    type: 'event',
    label: 'Event / Field Campaign',
    shortLabel: 'Event',
    description: 'Field campaign, workshop, or milestone with date, location, and details link.',
  },
  {
    type: 'link',
    label: 'Useful Resource / Document Link',
    shortLabel: 'Resource / Link',
    description: 'Reference article, SOP document, portal URL, or UA Box file link.',
  },
  {
    type: 'box-folder',
    label: 'Embedded UA Box Folder',
    shortLabel: 'Box Folder',
    description: 'Direct UA Box folder card with inline live embedded preview.',
  },
  {
    type: 'image',
    label: 'Photo / Figure / Map',
    shortLabel: 'Photo',
    description: 'Field survey photo, workflow diagram, or study-area map.',
  },
];

interface ProjectBlockRendererProps {
  block: ProjectContentBlock;
  index: number;
  total: number;
  canEdit: boolean;
  primaryColor: string;
  embeddedBoxUrl: string | null;
  onToggleEmbed: (url: string) => void;
  onEdit: (block: ProjectContentBlock) => void;
  onDelete: (blockId: string) => void;
  onMove: (index: number, delta: -1 | 1) => void;
}

function getBlockIcon(type: ProjectContentBlockType) {
  switch (type) {
    case 'paragraph':
      return <BookOpen className="w-4 h-4" />;
    case 'objectives':
      return <ListChecks className="w-4 h-4 text-emerald-600" />;
    case 'dataset':
      return <Database className="w-4 h-4 text-emerald-600" />;
    case 'software':
      return <Code2 className="w-4 h-4 text-indigo-600" />;
    case 'meeting-note':
      return <FileText className="w-4 h-4 text-blue-600" />;
    case 'event':
      return <Calendar className="w-4 h-4 text-amber-600" />;
    case 'box-folder':
      return <FolderGit2 className="w-4 h-4 text-blue-600" />;
    case 'image':
      return <ImageIcon className="w-4 h-4 text-purple-600" />;
    case 'link':
    default:
      return <ExternalLink className="w-4 h-4 text-slate-600" />;
  }
}

export const ProjectBlockRenderer: React.FC<ProjectBlockRendererProps> = ({
  block,
  index,
  total,
  canEdit,
  primaryColor,
  embeddedBoxUrl,
  onToggleEmbed,
  onEdit,
  onDelete,
  onMove,
}) => {
  const editActions = canEdit ? (
    <div className="flex items-center gap-1 shrink-0">
      <button
        type="button"
        disabled={index === 0}
        onClick={() => onMove(index, -1)}
        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer"
        title="Move up"
      >
        <ArrowUp className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        disabled={index === total - 1}
        onClick={() => onMove(index, 1)}
        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer"
        title="Move down"
      >
        <ArrowDown className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onEdit(block)}
        className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
        title="Edit section"
      >
        <Edit2 className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onDelete(block.id)}
        className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"
        title="Delete section"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  ) : null;

  if (block.type === 'paragraph') {
    return (
      <section
        className={`rounded-xl border p-4 md:p-5 space-y-2.5 ${
          block.highlight ? 'bg-red-50/35 border-[#9E1B32]/25' : 'bg-white border-gray-200'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <h4
            className="text-xs md:text-sm font-extrabold uppercase tracking-wider flex items-center gap-2"
            style={{ color: primaryColor }}
          >
            {getBlockIcon(block.type)}
            <span>{block.title}</span>
          </h4>
          {editActions}
        </div>
        {block.body && (
          <div className="text-xs md:text-sm text-slate-700 leading-relaxed whitespace-pre-line text-justify">
            {block.body}
          </div>
        )}
        {(block.url || block.boxUrl) && (
          <div className="flex flex-wrap gap-3 pt-1">
            {block.boxUrl && (
              <a
                href={block.boxUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                <FolderGit2 className="w-3.5 h-3.5" /> Open in UA Box
              </a>
            )}
            {block.url && (
              <a
                href={block.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold hover:underline inline-flex items-center gap-1"
                style={{ color: primaryColor }}
              >
                <ExternalLink className="w-3.5 h-3.5" /> Related Link
              </a>
            )}
          </div>
        )}
      </section>
    );
  }

  if (block.type === 'objectives') {
    const lines = (block.body || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-4 md:p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-2">
            {getBlockIcon(block.type)}
            <span>{block.title}</span>
          </h4>
          {editActions}
        </div>
        {lines.length > 0 ? (
          <ul className="space-y-2">
            {lines.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 border border-slate-100 p-3 rounded-xl"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-400 italic">No list items added yet.</p>
        )}
      </section>
    );
  }

  if (block.type === 'image') {
    const imgSrc = resolveAssetUrl(block.url || block.boxUrl || '');
    return (
      <figure className="rounded-xl overflow-hidden border border-gray-200 bg-slate-900">
        {imgSrc && (
          <img
            src={imgSrc}
            alt={block.caption || block.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="w-full max-h-96 object-contain mx-auto"
          />
        )}
        <figcaption className="p-3 bg-white border-t border-gray-100 flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-slate-800">{block.caption || block.title}</p>
            {block.body && <p className="text-[11px] text-slate-500 mt-0.5 whitespace-pre-line text-justify">{block.body}</p>}
          </div>
          {editActions}
        </figcaption>
      </figure>
    );
  }

  const boxLink = block.boxUrl || (block.type === 'box-folder' ? block.url : undefined);
  const canEmbedBox = Boolean(boxLink && isBoxUrl(boxLink));
  const isShowingEmbed = Boolean(canEmbedBox && embeddedBoxUrl === boxLink);

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-white border border-gray-200 text-slate-700">
              {getBlockIcon(block.type)}
              <span>
                {block.category ||
                  (block.type === 'dataset'
                    ? 'Dataset'
                    : block.type === 'software'
                      ? 'Software'
                      : block.type === 'meeting-note'
                        ? 'Meeting Notes'
                        : block.type === 'event'
                          ? 'Event'
                          : block.type === 'box-folder'
                            ? 'UA Box Folder'
                            : 'Resource')}
              </span>
            </span>

            {block.availability && (
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-white border border-gray-200 text-slate-700">
                {block.availability}
              </span>
            )}
            {block.language && (
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700">
                {block.language}
                {block.version ? ` v${block.version}` : ''}
              </span>
            )}
            {block.date && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-white px-2 py-0.5 rounded border border-gray-200 text-slate-700">
                <Calendar className="w-3 h-3" /> {block.date}
              </span>
            )}
            {block.location && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-white px-2 py-0.5 rounded border border-gray-200 text-slate-700">
                <MapPin className="w-3 h-3" /> {block.location}
              </span>
            )}
            {block.attendees && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-blue-700">
                <Users className="w-3 h-3" /> {block.attendees}
              </span>
            )}
          </div>

          <h4 className="font-extrabold text-sm text-slate-900">{block.title}</h4>
          {block.body && (
            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line text-justify">{block.body}</p>
          )}
        </div>

        {editActions}
      </div>

      {(boxLink || (block.url && block.type !== 'box-folder')) && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200/70">
          {canEmbedBox && boxLink && (
            <button
              type="button"
              onClick={() => onToggleEmbed(boxLink)}
              className="text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-lg cursor-pointer"
            >
              {isShowingEmbed ? 'Hide Box Preview' : 'Preview Box Folder'}
            </button>
          )}
          {boxLink && (
            <a
              href={boxLink}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-lg inline-flex items-center gap-1"
            >
              <FolderGit2 className="w-3.5 h-3.5" />
              <span>Open in UA Box</span>
            </a>
          )}
          {block.url && block.url !== boxLink && (
            <a
              href={block.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold text-white px-3 py-1.5 rounded-lg inline-flex items-center gap-1"
              style={{ backgroundColor: primaryColor }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>
                {block.type === 'software'
                  ? 'Open Repository / Tool'
                  : block.type === 'dataset'
                    ? 'Access Dataset'
                    : 'Visit Link'}
              </span>
            </a>
          )}
        </div>
      )}

      {isShowingEmbed && boxLink && (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white mt-2">
          <div className="px-4 py-2 bg-slate-50 border-b border-gray-200 flex items-center justify-between text-xs font-bold text-slate-700">
            <span>UA Box Embedded Storage Viewer</span>
            <button
              type="button"
              onClick={() => onToggleEmbed(boxLink)}
              className="text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Close
            </button>
          </div>
          <iframe title={block.title} src={toBoxEmbedUrl(boxLink)} className="w-full h-[460px]" allowFullScreen />
        </div>
      )}
    </div>
  );
};

