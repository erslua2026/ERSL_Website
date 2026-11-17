import React, { useState } from 'react';
import { X, Save, Sparkles, Link as LinkIcon, Image as ImageIcon, Upload } from 'lucide-react';
import { NewsItem, NewsCategory } from '../data/news';
import { isBoxSharePageNotDirectFile } from '../lib/boxUtils';
import { uploadImageWithBoxFallback } from '../lib/boxSync';

interface NewsModalProps {
  item: NewsItem | null;
  onSave: (savedItem: NewsItem) => void;
  onClose: () => void;
}

const CATEGORY_OPTIONS: { id: NewsCategory; label: string; icon: string; badgeCls: string }[] = [
  { id: 'publication', label: 'Recent Publication', icon: '🎓', badgeCls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  { id: 'achievement', label: 'Achievement / Award', icon: '🏆', badgeCls: 'bg-amber-50 text-amber-800 border-amber-200' },
  { id: 'field', label: 'Field Campaign', icon: '🚁', badgeCls: 'bg-sky-50 text-sky-800 border-sky-200' },
  { id: 'blog', label: 'Blog / Research Note', icon: '✍️', badgeCls: 'bg-purple-50 text-purple-800 border-purple-200' },
  { id: 'general', label: 'Lab Announcement', icon: '📢', badgeCls: 'bg-slate-50 text-slate-800 border-slate-200' },
];

export const NewsModal: React.FC<NewsModalProps> = ({ item, onSave, onClose }) => {
  const [title, setTitle] = useState(item?.title || '');
  const [category, setCategory] = useState<NewsCategory>(item?.category || 'publication');
  const [date, setDate] = useState(item?.date || new Date().toISOString().split('T')[0]);
  const [summary, setSummary] = useState(item?.summary || '');
  const [link, setLink] = useState(item?.link || '');
  const [image, setImage] = useState(item?.image || '');
  const [imageCaption, setImageCaption] = useState(item?.imageCaption || '');
  const [error, setError] = useState('');

  const applyTemplate = (cat: NewsCategory) => {
    setCategory(cat);
    if (cat === 'publication') {
      setTitle('New Research Paper Published: [Paper Title Here]');
      setSummary('Our team has published a new peer-reviewed paper in [Journal Name] detailing [brief summary of findings, models, or datasets].');
      setLink('#publications');
    } else if (cat === 'achievement') {
      setTitle('ERSL Researcher Awarded [Grant / Fellowship / Recognition]');
      setSummary('Congratulations to [Researcher Name] for receiving [Award / Honor] for exceptional research contributions in remote sensing and hydrology.');
      setLink('#people');
    } else if (cat === 'field') {
      setTitle('Completed Field Survey: [Location / River Reach]');
      setSummary('The lab completed UAV LiDAR scanning and in-situ hydrologic water quality sampling in [Location], synchronized with satellite overpasses.');
      setLink('#field');
    } else if (cat === 'blog') {
      setTitle('Lab Research Note: [Topic or Method Overview]');
      setSummary('A quick look inside our latest modeling workflows: how we apply GeoAI and satellite altimetry to solve continental water challenges.');
      setLink('');
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadImageWithBoxFallback(file, 'News');
      setImage(result.url);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Image upload failed. You can also paste a Box Direct Link.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a news headline / title.');
      return;
    }
    if (!summary.trim()) {
      setError('Please provide a summary or description for the news story.');
      return;
    }

    const savedItem: NewsItem = {
      id: item?.id || 'news-' + Date.now(),
      title: title.trim(),
      category,
      date: date || new Date().toISOString().split('T')[0],
      summary: summary.trim(),
      link: link.trim() || undefined,
      image: image.trim() || undefined,
      imageCaption: imageCaption.trim() || undefined,
    };

    onSave(savedItem);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200 text-left">
        {/* Header */}
        <div className="bg-[#9E1B32] p-4 text-white flex justify-between items-center">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-lg">📰</span>
              <h3 className="font-extrabold text-sm tracking-tight">
                {item ? 'Edit News & Announcements' : 'Post News, Publication, or Achievement'}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg font-medium">
              {error}
            </div>
          )}

          {/* Quick starter templates */}
          {!item && (
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl space-y-1.5">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-[#9E1B32]" /> Quick Templates:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => applyTemplate('publication')} className="text-[11px] bg-white hover:bg-emerald-50 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg font-semibold cursor-pointer">
                  🎓 New Paper
                </button>
                <button type="button" onClick={() => applyTemplate('achievement')} className="text-[11px] bg-white hover:bg-amber-50 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg font-semibold cursor-pointer">
                  🏆 Award / Grant
                </button>
                <button type="button" onClick={() => applyTemplate('field')} className="text-[11px] bg-white hover:bg-sky-50 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg font-semibold cursor-pointer">
                  🚁 Field Campaign
                </button>
                <button type="button" onClick={() => applyTemplate('blog')} className="text-[11px] bg-white hover:bg-purple-50 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg font-semibold cursor-pointer">
                  ✍️ Blog / Story
                </button>
              </div>
            </div>
          )}

          {/* Category Selector */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1.5">Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORY_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCategory(opt.id)}
                  className={`text-xs p-2 rounded-xl border text-left flex items-center space-x-2 transition-all cursor-pointer ${
                    category === opt.id
                      ? 'border-[#9E1B32] bg-red-50/40 text-[#9E1B32] font-bold shadow-xs ring-1 ring-[#9E1B32]'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <span className="text-sm">{opt.icon}</span>
                  <span className="truncate">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                Headline / Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. New Paper Accepted in RSE"
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#9E1B32]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#9E1B32]"
              />
            </div>
          </div>

          {/* Story Summary */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1">
              Summary / Content <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="Describe the research milestone, publication findings, or field campaign..."
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#9E1B32] leading-relaxed"
              required
            />
          </div>

          {/* News Image (Box Direct Link / URL / Upload) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-[#9E1B32]" />
                <span>News Image (Box Direct Link, URL, or Upload)</span>
              </label>
              {image && (
                <button
                  type="button"
                  onClick={() => setImage('')}
                  className="text-[10px] font-bold text-red-600 hover:underline cursor-pointer"
                >
                  Remove Image
                </button>
              )}
            </div>

            {image && (
              <div className="rounded-lg overflow-hidden border border-slate-200 bg-white max-h-36 flex items-center justify-center">
                <img src={image} alt="News preview" className="w-full h-32 object-cover" />
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={image.startsWith('data:') ? '' : image}
                onChange={e => setImage(e.target.value)}
                placeholder="Paste Box Direct Link (https://ua.box.com/shared/static/...) or image URL"
                className="flex-1 text-xs p-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#9E1B32]"
              />
              <label className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold px-3 py-2 rounded-lg cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload</span>
                <input type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
              </label>
            </div>

            {isBoxSharePageNotDirectFile(image) && (
              <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded">
                Tip: Standard Box <code>/s/...</code> links open a webpage rather than a raw image. In UA Box, open Shared Link Settings &rarr; copy the <strong>Direct Link</strong> (<code>.../shared/static/...</code>) so the image displays directly!
              </p>
            )}

            <input
              type="text"
              value={imageCaption}
              onChange={e => setImageCaption(e.target.value)}
              placeholder="Optional image caption..."
              className="w-full text-[11px] p-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#9E1B32]"
            />
          </div>

          {/* Optional Link URL */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1">Target Link (Optional)</label>
            <div className="relative">
              <input
                type="text"
                value={link}
                onChange={e => setLink(e.target.value)}
                placeholder="e.g. https://doi.org/... or #publications or #field"
                className="w-full text-xs p-2.5 pl-8 rounded-lg border border-slate-300 focus:outline-none focus:border-[#9E1B32]"
              />
              <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 text-xs font-bold text-white bg-[#9E1B32] hover:bg-red-800 rounded-lg shadow-sm cursor-pointer flex items-center space-x-1.5">
              <Save className="w-3.5 h-3.5" />
              <span>{item ? 'Save Changes' : 'Publish Story'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
