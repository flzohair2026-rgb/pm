'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useGlobalLoading } from './GlobalLoadingProvider';

export function AppRouteLoading() {
  const { show, hide, run } = useGlobalLoading();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    void run(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 80);
      });
    }, 'جاري الانتقال...', { minMs: 350 });
  }, [pathname, searchParams, run]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const { fetch: origFetch } = window as any;
    if (!origFetch || (origFetch as any).__glPatched) return;

    const fetchRe = /\/api\/(?!chat\/?$)[a-zA-Z0-9_-]/;

    const patchedFetch: typeof fetch = async function (...args: any[]) {
      const input: any = args[0];
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? String(input)
            : input && typeof input === 'object' && input.url
              ? String(input.url)
              : '';
      const needsLoading = url && fetchRe.test(url);
      const token = needsLoading ? show('جاري معالجة العملية...', { minMs: 250 }) : '';
      try {
        return await origFetch.apply(window, args as any);
      } finally {
        if (token) hide(token);
      }
    };
    (patchedFetch as any).__glPatched = true;
    (window as any).fetch = patchedFetch;
  }, [show, hide]);

  return null;
}
