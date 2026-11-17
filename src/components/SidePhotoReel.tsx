import React from 'react';
import { Camera } from 'lucide-react';
import { resolveAssetUrl } from '../lib/boxUtils';

export interface ReelPhotoItem {
  id: string;
  url: string;
  caption: string;
  projectId?: string;
  tag?: string;
}

interface SidePhotoReelProps {
  items: ReelPhotoItem[];
  direction?: 'up' | 'down';
  title?: string;
  accentColor?: string;
  onSelect?: (item: ReelPhotoItem) => void;
}

/** Vertical auto-scrolling crystal glass field & project photo filmstrip for wide screens. */
export const SidePhotoReel: React.FC<SidePhotoReelProps> = ({
  items,
  direction = 'up',
  title = 'Field Reel',
  accentColor = '#9E1B32',
  onSelect,
}) => {
  if (!items || items.length === 0) return null;

  // Duplicate list once so translateY(-50%) loops seamlessly
  const loopItems = [...items, ...items];

  return (
    <aside
      aria-label={title}
      className="hidden xl:flex flex-col w-40 2xl:w-48 shrink-0 sticky top-20 h-[calc(100vh-6.25rem)] select-none"
    >
      <div className="flex items-center justify-between px-2.5 py-1.5 mb-2 rounded-full bg-white/70 backdrop-blur-md border border-white/75 shadow-xs">
        <span
          className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 truncate"
          style={{ color: accentColor }}
        >
          <Camera className="w-3 h-3 shrink-0" />
          <span>{title}</span>
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
      </div>

      <div className="ersl-reel-container ersl-reel-mask flex-1 overflow-hidden relative rounded-2xl">
        <div
          className={`flex flex-col gap-3 pb-3 ${
            direction === 'down' ? 'ersl-reel-track-down' : 'ersl-reel-track-up'
          }`}
        >
          {loopItems.map((item, idx) => {
            const imgUrl = resolveAssetUrl(item.url);
            return (
              <button
                key={`${item.id}-${idx}`}
                type="button"
                onClick={() => onSelect?.(item)}
                title={item.projectId ? `${item.caption} — Click to open project` : item.caption}
                className="group relative rounded-2xl overflow-hidden bg-white/70 backdrop-blur-md border border-white/80 shadow-sm hover:shadow-md transition-all text-left cursor-pointer shrink-0"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-slate-200">
                  <img
                    src={imgUrl}
                    alt={item.caption}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="px-2.5 py-2">
                  {item.tag && (
                    <span
                      className="text-[9px] font-extrabold uppercase tracking-wider block truncate"
                      style={{ color: accentColor }}
                    >
                      {item.tag}
                    </span>
                  )}
                  <p className="text-[11px] font-bold text-slate-800 leading-tight line-clamp-2 mt-0.5">
                    {item.caption}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};

