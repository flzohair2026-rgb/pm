'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export type UserRole = 'admin' | 'manager' | 'receptionist' | 'housekeeping' | 'accountant' | 'marketing' | null;

export interface HotelInfo {
  id: string;
  name: string;
}

export interface AuthContextValue {
  loading: boolean;
  error: Error | null;
  user: any | null;
  role: UserRole;
  profile: any | null;
  hotels: HotelInfo[];
  activeHotelId: string | 'all' | null;
  setActiveHotelId: (id: string | 'all' | null) => void;
  isAdmin: boolean;
  isManager: boolean;
  isReceptionist: boolean;
  isHousekeeping: boolean;
  isAccountant: boolean;
  isMarketing: boolean;
  refreshAuth: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const CACHE_KEY_ROLE = 'auth_role_cache';
const CACHE_KEY_ROLE_TS = 'auth_role_cache_ts';
const CACHE_KEY_HOTELS = 'auth_hotels_cache';
const CACHE_KEY_HOTELS_TS = 'auth_hotels_cache_ts';
const CACHE_KEY_PROFILE = 'auth_profile_cache';
const CACHE_KEY_PROFILE_TS = 'auth_profile_cache_ts';
const CACHE_KEY_ACTIVE_HOTEL = 'active_hotel_id';
const CACHE_DURATION_ROLE = 30 * 60 * 1000;
const CACHE_DURATION_HOTELS = 60 * 60 * 1000;
const CACHE_DURATION_PROFILE = 60 * 60 * 1000;

const normalizeRole = (r: unknown): UserRole => {
  if (r === 'admin' || r === 'manager' || r === 'receptionist' || r === 'housekeeping' || r === 'accountant' || r === 'marketing') {
    return r;
  }
  return null;
};

const readCache = <T,>(key: string, tsKey: string, duration: number): T | null => {
  try {
    const raw = localStorage.getItem(key);
    const tsRaw = localStorage.getItem(tsKey);
    if (!raw || !tsRaw) return null;
    const ts = Number(tsRaw);
    if (Number.isFinite(ts) && Date.now() - ts < duration) {
      try { return JSON.parse(raw) as T; } catch { return null; }
    }
    return null;
  } catch {
    return null;
  }
};

const writeCache = <T,>(key: string, tsKey: string, value: T) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem(tsKey, String(Date.now()));
  } catch {}
};

const readActiveHotel = (): string | 'all' | null => {
  try {
    const v = localStorage.getItem(CACHE_KEY_ACTIVE_HOTEL);
    if (!v) return null;
    if (v === 'all') return 'all';
    return v;
  } catch { return null; }
};

const writeActiveHotelCookie = (value: string | 'all' | null) => {
  try {
    if (!value) {
      document.cookie = `${CACHE_KEY_ACTIVE_HOTEL}=; Path=/; Max-Age=0; SameSite=Lax`;
    } else {
      const maxAge = 60 * 60 * 24 * 365;
      document.cookie = `${CACHE_KEY_ACTIVE_HOTEL}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    }
  } catch {}
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [hotels, setHotels] = useState<HotelInfo[]>([]);
  const [activeHotelId, setActiveHotelIdState] = useState<string | 'all' | null>(null);
  const initializedRef = useRef(false);
  const fetchPromiseRef = useRef<Promise<void> | null>(null);
  const authSubRef = useRef<{ unsubscribe: () => void } | null>(null);
  const lastFetchTsRef = useRef(0);
  const FETCH_THROTTLE_MS = 15000;

  const setActiveHotelId = useCallback((id: string | 'all' | null) => {
    setActiveHotelIdState(id);
    try {
      if (!id) {
        localStorage.removeItem(CACHE_KEY_ACTIVE_HOTEL);
      } else {
        localStorage.setItem(CACHE_KEY_ACTIVE_HOTEL, id);
      }
      writeActiveHotelCookie(id);
      window.dispatchEvent(new Event('active_hotel_changed'));
    } catch {}
  }, []);

  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isReceptionist = role === 'receptionist';
  const isHousekeeping = role === 'housekeeping';
  const isAccountant = role === 'accountant';
  const isMarketing = role === 'marketing';

  const fetchAll = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && fetchPromiseRef.current) return fetchPromiseRef.current;
    if (!force && now - lastFetchTsRef.current < FETCH_THROTTLE_MS) return;
    lastFetchTsRef.current = now;

    const p = (async () => {
      try {
        setError(null);

        const cachedRole = readCache<UserRole>(CACHE_KEY_ROLE, CACHE_KEY_ROLE_TS, CACHE_DURATION_ROLE);
        const cachedHotels = readCache<HotelInfo[]>(CACHE_KEY_HOTELS, CACHE_KEY_HOTELS_TS, CACHE_DURATION_HOTELS);
        const cachedProfile = readCache<any>(CACHE_KEY_PROFILE, CACHE_KEY_PROFILE_TS, CACHE_DURATION_PROFILE);
        const cachedActive = readActiveHotel();

        if (cachedRole !== null) setRole(cachedRole);
        if (cachedHotels) setHotels(cachedHotels);
        if (cachedProfile) setProfile(cachedProfile);
        if (cachedActive) setActiveHotelIdState(cachedActive);

        const { data: { session } } = await supabase.auth.getSession();
        let currentUser = session?.user ?? null;

        if (!currentUser) {
          const { data: { user: verifiedUser } } = await supabase.auth.getUser();
          currentUser = verifiedUser ?? null;
        }

        if (!currentUser) {
          setUser(null);
          setRole(null);
          setProfile(null);
          setHotels([]);
          setLoading(false);
          return;
        }

        setUser(currentUser);

        let finalRole: UserRole = null;
        try {
          const { data: rpcRole } = await supabase.rpc('get_my_role_safe');
          finalRole = normalizeRole(rpcRole);
        } catch {}

        if (!finalRole) {
          try {
            const { data } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', currentUser.id)
              .maybeSingle();
            finalRole = normalizeRole(data?.role) ?? 'receptionist';
          } catch {
            finalRole = cachedRole ?? 'receptionist';
          }
        }

        setRole(finalRole);
        writeCache(CACHE_KEY_ROLE, CACHE_KEY_ROLE_TS, finalRole);

        const normalizedRole = finalRole;
        const userIsAdmin = normalizedRole === 'admin';

        let finalHotels: HotelInfo[] = [];
        let finalProfile: any = null;

        const [hotelsRes, profileRes] = await Promise.allSettled([
          (async () => {
            if (userIsAdmin) {
              const { data, error } = await supabase
                .from('hotels')
                .select('id, name')
                .order('name', { ascending: true });
              if (error) throw error;
              return (data || []) as HotelInfo[];
            } else {
              const { data: idsRaw, error: idsErr } = await supabase.rpc('get_my_hotels');
              if (idsErr) throw idsErr;
              const ids = Array.isArray(idsRaw)
                ? (idsRaw as any[])
                    .map((x) => (typeof x === 'string' ? x : (x?.hotel_id ?? x?.id ?? null)))
                    .filter((x): x is string => typeof x === 'string' && x.length > 0)
                : [];
              if (ids.length === 0) return [];
              const { data: hotelRows, error: hErr } = await supabase
                .from('hotels')
                .select('id, name')
                .in('id', ids)
                .order('name', { ascending: true });
              if (hErr) throw hErr;
              return (hotelRows || []) as HotelInfo[];
            }
          })(),
          (async () => {
            const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', currentUser.id)
              .maybeSingle();
            if (error) throw error;
            return data;
          })()
        ]);

        if (hotelsRes.status === 'fulfilled') {
          finalHotels = hotelsRes.value;
          setHotels(finalHotels);
          writeCache(CACHE_KEY_HOTELS, CACHE_KEY_HOTELS_TS, finalHotels);
        } else if (cachedHotels) {
          finalHotels = cachedHotels;
        }

        if (profileRes.status === 'fulfilled' && profileRes.value) {
          finalProfile = profileRes.value;
          setProfile(finalProfile);
          writeCache(CACHE_KEY_PROFILE, CACHE_KEY_PROFILE_TS, finalProfile);
        } else if (cachedProfile) {
          finalProfile = cachedProfile;
        }

        const existingActiveHotel = readActiveHotel();
        if (existingActiveHotel) {
          const valid = userIsAdmin
            ? (existingActiveHotel === 'all' || finalHotels.some((h) => h.id === existingActiveHotel))
            : finalHotels.some((h) => h.id === existingActiveHotel);
          if (!valid) {
            if (userIsAdmin) setActiveHotelId('all');
            else if (finalHotels.length > 0) setActiveHotelId(finalHotels[0].id);
            else setActiveHotelId(null);
          }
        } else {
          if (userIsAdmin) {
            setActiveHotelId('all');
          } else if (finalHotels.length > 0) {
            try {
              const { data: defId } = await supabase.rpc('get_my_default_hotel');
              const defaultId = defId && typeof defId === 'string' && finalHotels.some((h) => h.id === defId) ? defId : finalHotels[0].id;
              try {
                try { await supabase.rpc('set_my_default_hotel', { p_hotel_id: defaultId }); } catch {}
              } catch {}
              setActiveHotelId(defaultId);
            } catch {
              setActiveHotelId(finalHotels[0].id);
            }
          } else {
            setActiveHotelId(null);
          }
        }

      } catch (err: any) {
        const message = String(err?.message || err);
        setError(new Error(message));
      } finally {
        setLoading(false);
      }
    })();

    fetchPromiseRef.current = p;
    try { await p; } finally { fetchPromiseRef.current = null; }
    return p;
  }, [setActiveHotelId]);

  const refreshAuth = useCallback(async () => {
    localStorage.removeItem(CACHE_KEY_ROLE);
    localStorage.removeItem(CACHE_KEY_ROLE_TS);
    localStorage.removeItem(CACHE_KEY_HOTELS);
    localStorage.removeItem(CACHE_KEY_HOTELS_TS);
    localStorage.removeItem(CACHE_KEY_PROFILE);
    localStorage.removeItem(CACHE_KEY_PROFILE_TS);
    lastFetchTsRef.current = 0;
    return fetchAll(true);
  }, [fetchAll]);

  const signOut = useCallback(async () => {
    localStorage.removeItem(CACHE_KEY_ROLE);
    localStorage.removeItem(CACHE_KEY_ROLE_TS);
    localStorage.removeItem(CACHE_KEY_HOTELS);
    localStorage.removeItem(CACHE_KEY_HOTELS_TS);
    localStorage.removeItem(CACHE_KEY_PROFILE);
    localStorage.removeItem(CACHE_KEY_PROFILE_TS);
    localStorage.removeItem(CACHE_KEY_ACTIVE_HOTEL);
    writeActiveHotelCookie(null);
    try { await supabase.auth.signOut(); } catch {}
    setUser(null);
    setRole(null);
    setProfile(null);
    setHotels([]);
    setActiveHotelIdState(null);
  }, [setActiveHotelId]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (authSubRef.current) return;
    const { data } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem(CACHE_KEY_ROLE);
        localStorage.removeItem(CACHE_KEY_ROLE_TS);
        localStorage.removeItem(CACHE_KEY_HOTELS);
        localStorage.removeItem(CACHE_KEY_HOTELS_TS);
        localStorage.removeItem(CACHE_KEY_PROFILE);
        localStorage.removeItem(CACHE_KEY_PROFILE_TS);
        setUser(null);
        setRole(null);
        setProfile(null);
        setHotels([]);
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        lastFetchTsRef.current = 0;
        void fetchAll(true);
      }
    });
    authSubRef.current = { unsubscribe: () => data?.subscription?.unsubscribe() };
    return () => {
      authSubRef.current?.unsubscribe();
      authSubRef.current = null;
    };
  }, [fetchAll]);

  const value = useMemo<AuthContextValue>(() => ({
    loading,
    error,
    user,
    role,
    profile,
    hotels,
    activeHotelId,
    setActiveHotelId,
    isAdmin,
    isManager,
    isReceptionist,
    isHousekeeping,
    isAccountant,
    isMarketing,
    refreshAuth,
    signOut,
  }), [loading, error, user, role, profile, hotels, activeHotelId, setActiveHotelId, isAdmin, isManager, isReceptionist, isHousekeeping, isAccountant, isMarketing, refreshAuth, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return ctx;
}
