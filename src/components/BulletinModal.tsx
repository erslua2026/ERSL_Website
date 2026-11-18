import React, { useState } from 'react';
import { X, Save, Megaphone } from 'lucide-react';
import { BulletinItem } from '../types';
import { BoxUploadButton } from './BoxUploadButton';
import { ImageUploadField } from './ImageUploadField';

interface BulletinModalProps {
  item: BulletinItem | null;
  folders: string[];
  defaultFolder?: string;
  senderName: string;
  onSave: (bulletin: BulletinItem) => void;
  onClose: () => void;
}

export const BulletinModal: React.FC<BulletinModalProps> = ({
  item,
  folders,
  defaultFolder,
  senderName,
  onSave,
  onClose,
}) => {
  const [title, setTitle] = useState(item?.title || '');
  const [content, setContent] = useState(item?.content || '');
  const [priority, setPriority] = useState<'normal' | 'high'>(item?.priority || 'normal');
  const [folder, setFolder] = useState(item?.folder || (defaultFolder && defaultFolder !== 'All' ? defaultFolder : 'General'));
  const [image, setImage] = useState(item?.image || '');
  const [link, setLink] = useState(item?.link || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    onSave({
      id: item?.id || `bulletin-${Date.now()}`,
      title: title.trim(),
      content: content.trim(),
      priority,
      folder,
      sender: item?.sender || senderName || 'Dr. Hongxing Liu',
      date: item?.date || new Date().toISOString().replace('T', ' ').substring(0, 16),
      image: image.trim() || undefined,
      link: link.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100 text-left">
        <div className="bg-[#9E1B32] p-4 text-white flex justify-between items-center">
          <h3 className="font-extrabold text-sm flex items-center gap-2">
            <Megaphone className="w-4 h-4" />
            <span>{item ? 'Edit Lab Bulletin / Notice' : 'Post Lab Bulletin / News'}</span>
          </h3>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs max-h-[82vh] overflow-y-auto">
          <div className="space-y-1">
            <label className="font-bold text-gray-700">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., ADCP Black Warrior River Calibration Campaign"
              className="w-full p-2.5 bg-slate-50 border border-gray-300 rounded-lg focus:outline-none focus:border-[#9E1B32]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-gray-700">Folder</label>
              <select
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-gray-300 rounded-lg focus:outline-none focus:border-[#9E1B32]"
              >
                {folders.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-gray-700">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'normal' | 'high')}
                className="w-full p-2.5 bg-slate-50 border border-gray-300 rounded-lg focus:outline-none focus:border-[#9E1B32]"
              >
                <option value="normal">Normal Notice</option>
                <option value="high">Urgent / High Priority</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-gray-700">Message / News Body *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="Write announcement, field survey notes, or research updates..."
              className="w-full p-2.5 bg-slate-50 border border-gray-300 rounded-lg focus:outline-none focus:border-[#9E1B32]"
              required
            />
          </div>

          <div className="space-y-3">
            <ImageUploadField
              value={image}
              onChange={setImage}
              category="News"
              label="Bulletin Photo (Optional — Upload, Paste Clipboard, or URL)"
            />
            <div className="space-y-1">
              <label className="font-bold text-gray-700">Document / Attachment File or URL (Optional)</label>
              <input
                type="text"
                value={link.startsWith('data:') ? '' : link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://... or upload a local file/screenshot below"
                className="w-full p-2 bg-slate-50 border border-gray-300 rounded-lg focus:outline-none focus:border-[#9E1B32]"
              />
              <BoxUploadButton
                destination="bulletins"
                label="Upload Local Document / File"
                currentValue={link}
                onClear={() => setLink('')}
                onUploaded={(url) => setLink(url)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#9E1B32] hover:bg-red-800 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{item ? 'Save Bulletin' : 'Publish Bulletin'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

