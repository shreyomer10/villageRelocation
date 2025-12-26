// src/components/DocumentModal.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { FileText, ArrowLeft, ArrowRight, X } from 'lucide-react';

/**
 * DocumentModal
 * Props:
 *  - open: boolean
 *  - onClose: fn
 *  - docs: array (strings or objects)
 *  - title: optional string
 *  - loading: optional boolean (shows spinner while parent is fetching)
 *
 * Behavior:
 *  - If no docs: show a small centered box.
 *  - If docs exist: show a large modal that covers most of the page (big viewer).
 */

function isPdf(url = '') {
  try { return String(url).toLowerCase().split('?')[0].endsWith('.pdf'); }
  catch { return false; }
}
function isImage(url = '') {
  try { return /\.(jpe?g|png|gif|webp|bmp|svg)(\?.*)?$/i.test(String(url)); }
  catch { return false; }
}

function tryExtractUrlFromObject(d) {
  if (!d || typeof d !== 'object') return null;
  const maybe = (
    d.url || d.link || d.s3 || d.path || d.file || d.uri || d.key || d.src || d.location || d.href ||
    (d.storage && (d.storage.url || d.storage.path)) || (d.location && d.location.url) || null
  );
  return maybe || null;
}

function normalizeDocs(input = []) {
  if (!Array.isArray(input)) return [];
  const out = [];

  for (const raw of input) {
    if (!raw && raw !== 0) continue;

    // If string, check if it looks like JSON first
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed) {
            // flatten parsed structures recursively
            const nested = Array.isArray(parsed) ? parsed : [parsed];
            const extracted = normalizeDocs(nested);
            out.push(...extracted);
            continue;
          }
        } catch (e) {
          // not JSON, treat as URL string
        }
      }

      const url = trimmed;
      const name = (url.split('/').pop() || url).split('?')[0] || url;
      out.push({ url, name });
      continue;
    }

    // If object
    if (typeof raw === 'object') {
      const urlCandidate = tryExtractUrlFromObject(raw);
      const nameCandidate = raw.name || raw.filename || raw.title || raw.key || null;
      if (urlCandidate) {
        out.push({ url: String(urlCandidate), name: nameCandidate || (String(urlCandidate).split('/').pop() || String(urlCandidate)).split('?')[0] });
        continue;
      }

      // If object doesn't contain url but has string values that could be urls
      const values = Object.values(raw).filter(v => typeof v === 'string');
      let found = null;
      for (const v of values) {
        if (/https?:\/\//i.test(v) || v.split('/').pop().includes('.')) { found = v; break; }
      }
      if (found) {
        out.push({ url: String(found), name: raw.name || (String(found).split('/').pop() || String(found)).split('?')[0] });
        continue;
      }

      // Last fallback: stringify object so UI doesn't break (no URL)
      out.push({ url: '', name: nameCandidate || 'Document' });
    }
  }

  return out;
}

export default function DocumentModal({ open, onClose, docs = [], title = 'Documents', loading = false }) {
  const [items, setItems] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewerLoading, setViewerLoading] = useState(true);
  const [viewerError, setViewerError] = useState(null);

  useEffect(() => {
    const n = normalizeDocs(docs);
    setItems(n);
    setSelectedIndex(0);
    setViewerLoading(true);
    setViewerError(null);
  }, [docs]);

  useEffect(() => {
    if (!open) {
      setItems([]);
      setSelectedIndex(0);
      setViewerLoading(false);
      setViewerError(null);
    }
  }, [open]);

  const current = items[selectedIndex] || null;
  const hasDocs = items.length > 0;

  const handleSelect = useCallback((i) => {
    if (i < 0 || i >= items.length) return;
    setSelectedIndex(i);
    setViewerLoading(true);
    setViewerError(null);
  }, [items.length]);

  const handleOpenInNewTab = useCallback((url) => {
    if (!url) return;
    try { window.open(url, '_blank', 'noopener,noreferrer'); }
    catch (e) { /* ignore */ }
  }, []);

  // keyboard navigation
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') { onClose && onClose(); }
      if (e.key === 'ArrowLeft') { handleSelect(Math.max(0, selectedIndex - 1)); }
      if (e.key === 'ArrowRight') { handleSelect(Math.min((items.length - 1) || 0, selectedIndex + 1)); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, selectedIndex, items.length, handleSelect, onClose]);

  if (!open) return null;

  // Outer wrapper sizes: small centered card when no docs; large modal when docs exist
  const wrapperMaxWidth = hasDocs ? 'max-w-8xl mx-7' : 'max-w-md mx-auto';
  const contentHeightClass = hasDocs ? 'h-[90vh]' : 'auto';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black opacity-40" onClick={onClose} />

      {/* Modal container */}
      <div role="dialog" aria-modal="true" className={`relative z-10 w-full ${wrapperMaxWidth}`}>
        <div className={`bg-[#f8f0dc] rounded-lg shadow-lg overflow-hidden ${hasDocs ? 'flex flex-col' : ''}`} style={{ height: contentHeightClass === 'auto' ? undefined : 'auto' }}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <div className="text-lg font-semibold">{title}</div>
              <div className="text-xs text-slate-500">{items.length} document{items.length !== 1 ? 's' : ''}</div>
            </div>

            <div className="flex items-center gap-2">
              {hasDocs && (
                <>
                  <button onClick={() => handleSelect(Math.max(0, selectedIndex - 1))} disabled={selectedIndex <= 0} className="px-2 py-1 rounded bg-white border hover:bg-gray-50">
                    <ArrowLeft size={16} />
                  </button>
                  <button onClick={() => handleSelect(Math.min(items.length - 1, selectedIndex + 1))} disabled={selectedIndex >= items.length - 1} className="px-2 py-1 rounded bg-white border hover:bg-gray-50">
                    <ArrowRight size={16} />
                  </button>
                </>
              )}
              <button onClick={onClose} aria-label="Close" className="px-3 py-1 rounded bg-gray-100">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Body: small center card when no docs; large split view when docs exist */}
          {!hasDocs ? (
            <div className="p-6 flex flex-col items-center justify-center gap-3 text-center">
              {loading ? (
                <div className="flex items-center gap-3">
                  <div className="animate-spin h-6 w-6 text-slate-600" style={{ border: '3px solid rgba(0,0,0,0.1)', borderTopColor: 'rgba(0,0,0,0.6)', borderRadius: '50%' }} />
                  <div className="text-sm text-slate-700">Loading documents…</div>
                </div>
              ) : (
                <>
                  <div className="text-sm text-slate-700">No documents available.</div>
                  <div className="text-xs text-slate-500">Upload documents or select another item to preview.</div>
                  <div className="pt-2">
                    <button onClick={onClose} className="px-3 py-1 rounded bg-slate-100 border">Close</button>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Large viewer layout */
            <div className="p-4 max-h-[90vh] overflow-hidden grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ height: '90vh' }}>
              <div className="lg:col-span-3 bg-white rounded border p-3 flex items-center justify-center relative">
                {/* Viewer area */}
                {(viewerLoading || loading) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/30 z-10">
                    <div className="animate-spin h-6 w-6 text-slate-600" style={{ border: '3px solid rgba(0,0,0,0.1)', borderTopColor: 'rgba(0,0,0,0.6)', borderRadius: '50%' }} />
                  </div>
                )}

                {!current ? (
                  <div className="text-sm text-slate-600">No document selected.</div>
                ) : current.url ? (
                  <>
                    {viewerError && (
                      <div className="absolute top-4 left-4 z-30 bg-red-50 text-red-700 px-3 py-1 rounded">Failed to load document</div>
                    )}

                    {isPdf(current.url) ? (
                      <iframe
                        title={current.name}
                        src={current.url}
                        onLoad={() => { setViewerLoading(false); setViewerError(null); }}
                        onError={() => { setViewerLoading(false); setViewerError('error'); }}
                        className="w-full h-[80vh] border rounded"
                        style={{ minHeight: 480 }}
                      />
                    ) : isImage(current.url) ? (
                      <img
                        src={current.url}
                        alt={current.name}
                        onLoad={() => { setViewerLoading(false); setViewerError(null); }}
                        onError={() => { setViewerLoading(false); setViewerError('error'); }}
                        className="max-h-[80vh] object-contain"
                      />
                    ) : (
                      <iframe
                        title={current.name}
                        src={current.url}
                        onLoad={() => { setViewerLoading(false); setViewerError(null); }}
                        onError={() => { setViewerLoading(false); setViewerError('error'); }}
                        className="w-full h-[80vh] border rounded"
                        style={{ minHeight: 480 }}
                      />
                    )}
                  </>
                ) : (
                  <div className="text-sm text-slate-600">Document has no URL to preview. Use Open to open in a new tab (if available).</div>
                )}
              </div>

              <div className="bg-white rounded border p-3 overflow-y-auto max-h-[80vh]">
                {items.length === 0 ? (
                  <div className="text-sm text-slate-600">No documents available.</div>
                ) : (
                  <div className="space-y-2">
                    {items.map((d, i) => (
                      <div key={`${d.url || '__no_url__'}-${i}`}>
                        <button
                          type="button"
                          onClick={() => handleSelect(i)}
                          className={`w-full text-left flex items-center gap-3 p-2 rounded hover:bg-gray-50 ${i === selectedIndex ? 'bg-slate-100 border' : ''}`}
                        >
                          <div className="flex-shrink-0 w-12 h-8 flex items-center justify-center bg-white border rounded overflow-hidden">
                            {isImage(d.url) ? (
                              <img src={d.url} alt={d.name} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <FileText size={18} />
                            )}
                          </div>

                          <div className="truncate">
                            <div className="text-sm font-medium text-slate-800 truncate">{d.name || d.url || 'Document'}</div>
                            <div className="text-xs text-slate-500">{d.url ? (isPdf(d.url) ? 'PDF' : (isImage(d.url) ? 'Image' : 'File')) : 'No URL'}</div>
                          </div>

                          <div className="ml-auto text-xs">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); if (d.url) handleOpenInNewTab(d.url); }}
                              disabled={!d.url}
                              className={`text-sky-600 underline ${!d.url ? 'opacity-40 pointer-events-none' : ''}`}
                            >
                              Open
                            </button>
                          </div>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
