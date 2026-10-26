// Capa única de acceso al backend. Si Swagger difiere, ajusta SOLO este archivo.
const BASE = import.meta.env.VITE_API_URL ?? 'https://ritechbackend.onrender.com/api';
const TOKEN_KEY = 'ritech_token';
const USER_KEY = 'ritech_user';

export type Role = 'USER' | 'MANAGER';
export interface User { email: string; name?: string; role: Role; [k: string]: unknown }
export type Row = Record<string, any>;

export const session = {
  get token() { return localStorage.getItem(TOKEN_KEY); },
  get user(): User | null {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
  },
  set(token: string, user: User) { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)); },
  clear() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); },
};

export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;
  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message); this.status = status; this.fieldErrors = fieldErrors;
  }
}

// ---- estado de carga global (RF-036) ----
type Listener = (s: { pending: number; slow: boolean }) => void;
let pending = 0; let slow = false; let timer: number | undefined;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach(l => l({ pending, slow }));
export const loadingStore = {
  subscribe(l: Listener) { listeners.add(l); l({ pending, slow }); return () => { listeners.delete(l); }; },
};
function start() {
  pending++; if (pending === 1) { slow = false; timer = window.setTimeout(() => { slow = true; emit(); }, 4000); }
  emit();
}
function end() {
  pending = Math.max(0, pending - 1);
  if (pending === 0) { window.clearTimeout(timer); slow = false; }
  emit();
}

function parseFieldErrors(body: any): Record<string, string> {
  const fe = body?.fieldErrors; const out: Record<string, string> = {};
  if (!fe) return out;
  if (Array.isArray(fe)) fe.forEach((e: any) => { if (e?.field) out[e.field] = e.message ?? e.defaultMessage ?? ''; });
  else if (typeof fe === 'object') Object.entries(fe).forEach(([k, v]) => { out[k] = String(v); });
  return out;
}

async function request<T = any>(method: string, path: string, opts: { body?: unknown; query?: Record<string, string | undefined>; silent?: boolean } = {}): Promise<T> {
  const url = new URL(BASE.replace(/\/$/, '') + path);
  Object.entries(opts.query ?? {}).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  if (!opts.silent) start();
  try {
    let res: Response;
    try {
      res = await fetch(url, { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
    } catch {
      throw new ApiError(0, 'No se pudo conectar con el servidor. Intenta de nuevo en unos segundos.');
    }
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (res.status === 401 && path !== '/auth/login') {
      session.clear(); window.dispatchEvent(new Event('ritech:unauthorized'));
      throw new ApiError(401, 'Tu sesión venció. Inicia sesión nuevamente.');
    }
    if (!res.ok) {
      throw new ApiError(res.status, data?.message ?? data?.error ?? `Error ${res.status}`, parseFieldErrors(data));
    }
    return data as T;
  } finally { if (!opts.silent) end(); }
}

const list = (d: any): Row[] => Array.isArray(d) ? d : d?.content ?? d?.items ?? d?.data ?? d?.alerts ?? d?.simulations ?? d?.rows ?? [];

export const api = {
  login: async (email: string, password: string) => {
    const d = await request('POST', '/auth/login', { body: { email, password } });
    const user: User = { ...(d.user ?? {}), email: d.user?.email ?? d.email ?? email, role: (d.user?.role ?? d.role) as Role };
    session.set(d.token ?? d.accessToken, user);
    return user;
  },
  logout: async () => { try { await request('POST', '/auth/logout', { silent: true }); } catch { /* ignorar */ } session.clear(); },
  recover: (email: string) => request('POST', '/auth/password-recovery', { body: { email } }),
  marketSummary: (silent = false) => request<Row>('GET', '/market/summary', { silent }),
  marketHistory: async (range: string) => { const d = await request('GET', '/market/history', { query: { range } }); return list(d?.points ?? d); },
  alerts: async (q: { types?: string; from?: string; to?: string; page?: string; size?: string } = {}) => list(await request('GET', '/alerts', { query: q })),
  alert: (id: string | number) => request<Row>('GET', `/alerts/${id}`),
  simulate: (capital: number, variation: number) => request<Row>('POST', '/simulations', { body: { capital, variation } }),
  simulations: async (q: { q?: string; from?: string; to?: string } = {}) => list(await request('GET', '/simulations', { query: q })),
  simulation: (id: string | number) => request<Row>('GET', `/simulations/${id}`),
  reportHistory: async () => list(await request('GET', '/reports/history')),
  reportStats: (range: string) => request<Row>('GET', '/reports/statistics', { query: { range } }),
};
