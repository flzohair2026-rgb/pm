'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

type LoadingToken = string;

export interface GlobalLoadingAPI {
  show: (message?: string, opts?: { minMs?: number }) => LoadingToken;
  hide: (token: LoadingToken) => void;
  run: <T>(fn: () => Promise<T>, message?: string, opts?: { minMs?: number }) => Promise<T>;
}

const GlobalLoadingContext = createContext<GlobalLoadingAPI | null>(null);

export function GlobalLoadingProvider({ children }: { children: React.ReactNode }) {
  const tokensRef = useRef<Map<LoadingToken, { message: string; minMs: number; createdAt: number; hideTimer?: any }>>(new Map());
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState<string>('جاري التحميل...');
  const nextTokenRef = useRef(1);

  const syncFromTokens = useCallback(() => {
    const entries = Array.from(tokensRef.current.entries());
    if (entries.length === 0) {
      setVisible(false);
      setMessage('جاري التحميل...');
      return;
    }
    const latest = entries[entries.length - 1][1];
    setVisible(true);
    setMessage(latest.message || 'جاري التحميل...');
  }, []);

  const show = useCallback<GlobalLoadingAPI['show']>((msg, opts) => {
    const token = `L${nextTokenRef.current++}${Math.random().toString(36).slice(2, 7)}`;
    tokensRef.current.set(token, {
      message: msg || 'جاري التحميل...',
      minMs: Math.max(0, Number(opts?.minMs) || 0),
      createdAt: Date.now()
    });
    syncFromTokens();
    return token;
  }, [syncFromTokens]);

  const hide = useCallback<GlobalLoadingAPI['hide']>((token) => {
    const entry = tokensRef.current.get(token);
    if (!entry) return;

    const elapsed = Date.now() - entry.createdAt;
    const remaining = Math.max(0, entry.minMs - elapsed);

    const doHide = () => {
      const e = tokensRef.current.get(token);
      if (!e) return;
      tokensRef.current.delete(token);
      syncFromTokens();
    };

    if (remaining <= 0) {
      doHide();
      return;
    }

    if (entry.hideTimer) clearTimeout(entry.hideTimer);
    entry.hideTimer = setTimeout(doHide, remaining);
  }, [syncFromTokens]);

  const run = useCallback<GlobalLoadingAPI['run']>(async (fn, msg, opts) => {
    const token = show(msg, opts);
    try {
      return await fn();
    } finally {
      hide(token);
    }
  }, [show, hide]);

  const value = useMemo(() => ({ show, hide, run }), [show, hide, run]);

  return (
    <GlobalLoadingContext.Provider value={value}>
      {children}
      <GlobalLoadingIndicator visible={visible} message={message} />
    </GlobalLoadingContext.Provider>
  );
}

function GlobalLoadingIndicator({ visible, message }: { visible: boolean; message: string }) {
  return (
    <div
      aria-hidden={!visible}
      className="pointer-events-none fixed inset-0 z-[9999]"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 180ms ease' }}
    >
      <div className="absolute left-0 top-0 h-[3px] w-full overflow-hidden bg-transparent">
        <div
          className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"
          style={{
            width: '45%',
            transformOrigin: 'left center',
            animation: visible ? 'global-load-shimmer 1100ms ease-in-out infinite' : 'none'
          }}
        />
      </div>

      <div className="absolute right-5 bottom-5 max-w-[min(92vw,380px)]">
        <div
          className="pointer-events-none flex items-center gap-3 rounded-xl bg-white/95 px-4 py-3 shadow-lg ring-1 ring-gray-200 backdrop-blur transition-transform duration-200"
          style={{ transform: visible ? 'translateY(0)' : 'translateY(16px)' }}
        >
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-blue-600" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-gray-900">
              {message || 'جاري التحميل...'}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes global-load-shimmer {
          0% { transform: translateX(-60%); }
          100% { transform: translateX(280%); }
        }
      `}</style>
    </div>
  );
}

export function useGlobalLoading(): GlobalLoadingAPI {
  const ctx = useContext(GlobalLoadingContext);
  if (!ctx) {
    return {
      show: () => {
        if (typeof window !== 'undefined') {
          let bar = document.getElementById('fallback-global-load-bar');
          if (!bar) {
            bar = document.createElement('div');
            bar.id = 'fallback-global-load-bar';
            Object.assign(bar.style, {
              position: 'fixed',
              top: '0',
              left: '0',
              zIndex: '999999',
              height: '3px',
              width: '45%',
              background: 'linear-gradient(90deg, #3b82f6, #6366f1, #a855f7)',
              animation: 'fallback-global-load-shimmer 1100ms ease-in-out infinite'
            });
            const style = document.createElement('style');
            style.id = 'fallback-global-load-style';
            style.textContent = `@keyframes fallback-global-load-shimmer { 0% { transform: translateX(-60%); } 100% { transform: translateX(280%); } }`;
            document.head.appendChild(style);
            document.body.appendChild(bar);
          }
        }
        return `fallback-${Date.now()}`;
      },
      hide: () => {
        const bar = document.getElementById('fallback-global-load-bar');
        if (bar) bar.remove();
        const style = document.getElementById('fallback-global-load-style');
        if (style) style.remove();
      },
      run: async (fn) => await fn()
    };
  }
  return ctx;
}
