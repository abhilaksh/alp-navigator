'use client';

import { useState, useCallback, useRef } from 'react';
import { Search, Image as ImageIcon, X, Loader2, ExternalLink } from 'lucide-react';

interface PexelsPhoto {
  id: number;
  url: string;
  thumb: string;
  alt: string;
  photographer: string;
  pexelsUrl: string;
}

interface PhotoPickerProps {
  currentUrl: string | null;
  onSelect: (url: string | null) => void;
  placeholder?: string;
}

export function PhotoPicker({ currentUrl, onSelect, placeholder = 'Search Pexels…' }: PhotoPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [photos, setPhotos] = useState<PexelsPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [pasteUrl, setPasteUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/photos?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setPhotos(data.photos ?? []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  function handleOpen() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleClose() {
    setOpen(false);
    setPhotos([]);
    setQuery('');
    setPasteUrl('');
  }

  function handleSelectPhoto(url: string) {
    onSelect(url);
    handleClose();
  }

  function handlePasteUrl() {
    const u = pasteUrl.trim();
    if (u) { onSelect(u); handleClose(); }
  }

  return (
    <div className="relative">
      {/* Trigger button */}
      {currentUrl ? (
        <div className="relative group">
          <img
            src={currentUrl}
            alt=""
            className="w-full h-[120px] object-cover rounded-[3px]"
            style={{ border: '1px solid rgba(22,26,23,0.1)' }}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-[3px] flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <button
              onClick={handleOpen}
              className="text-white text-[11px] px-2.5 py-1 rounded-[3px] hover:bg-white/20 transition-colors"
            >
              Change
            </button>
            <button
              onClick={() => onSelect(null)}
              className="text-white text-[11px] px-2.5 py-1 rounded-[3px] hover:bg-white/20 transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleOpen}
          className="flex items-center gap-2 text-[11px] py-1.5 px-3 rounded-[3px] transition-colors w-full"
          style={{
            border: '1px dashed rgba(22,26,23,0.2)',
            color: '#8A9189',
            background: 'transparent',
          }}
        >
          <ImageIcon size={12} />
          <span>Add destination photo</span>
        </button>
      )}

      {/* Popover */}
      {open && (
        <div
          className="absolute left-0 top-full mt-2 z-50 rounded-[6px] shadow-xl"
          style={{
            width: 420,
            background: '#FFFFFF',
            border: '1px solid rgba(22,26,23,0.12)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid rgba(22,26,23,0.08)' }}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: '#4A514B' }}>
              Photo search
            </span>
            <button onClick={handleClose} className="text-ink-mute hover:text-ink transition-colors">
              <X size={14} />
            </button>
          </div>

          {/* Search */}
          <div className="p-4 space-y-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') search(query); }}
                placeholder={placeholder}
                className="flex-1 text-[12px] px-3 py-1.5 rounded-[3px] outline-none"
                style={{
                  border: '1px solid rgba(22,26,23,0.15)',
                  background: '#F6F4EE',
                  color: '#161A17',
                }}
              />
              <button
                onClick={() => search(query)}
                disabled={loading}
                className="px-3 py-1.5 rounded-[3px] text-white text-[12px] transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: '#1E3A2F' }}
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
              </button>
            </div>

            {/* Results grid */}
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 max-h-[280px] overflow-y-auto">
                {photos.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPhoto(p.url)}
                    className="relative group rounded-[3px] overflow-hidden aspect-video"
                    title={`${p.alt} — ${p.photographer}`}
                  >
                    <img src={p.thumb} alt={p.alt} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors" />
                    <div className="absolute bottom-0 left-0 right-0 p-1 opacity-0 group-hover:opacity-100">
                      <p className="text-white text-[9px] truncate leading-tight">{p.photographer}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {photos.length === 0 && !loading && query && (
              <p className="text-[11px] text-center py-4" style={{ color: '#8A9189' }}>
                No results. Try a different search term.
              </p>
            )}

            {/* Divider */}
            <div
              className="text-[9px] uppercase tracking-[0.1em] text-center py-1"
              style={{ color: '#C9D2CC' }}
            >
              or paste a URL
            </div>

            {/* URL paste */}
            <div className="flex gap-2">
              <input
                type="url"
                value={pasteUrl}
                onChange={e => setPasteUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handlePasteUrl(); }}
                placeholder="https://images.pexels.com/…"
                className="flex-1 text-[12px] px-3 py-1.5 rounded-[3px] outline-none"
                style={{
                  border: '1px solid rgba(22,26,23,0.15)',
                  background: '#F6F4EE',
                  color: '#161A17',
                }}
              />
              <button
                onClick={handlePasteUrl}
                disabled={!pasteUrl.trim()}
                className="px-3 py-1.5 rounded-[3px] text-[12px] transition-colors disabled:opacity-40"
                style={{ background: '#EDEAE1', color: '#1E3A2F' }}
              >
                Use
              </button>
            </div>
            <p className="text-[10px]" style={{ color: '#8A9189' }}>
              Photos via{' '}
              <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer"
                className="underline underline-offset-2"
                style={{ color: '#A98B52' }}>
                Pexels
              </a>
              {' '}· Free to use, no attribution required in proposals.
            </p>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={handleClose} />
      )}
    </div>
  );
}
