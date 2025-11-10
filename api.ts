function getToken() {
  try {
    return localStorage.getItem('authToken') || '';
  } catch {
    return '';
  }
}

function withAuth(headers: Record<string, string> = {}) {
  // Attach Authorization header if token exists
  try {
    const token = getToken();
    if (token) {
      return { ...headers, Authorization: `Bearer ${token}` };
    }
  } catch {}
  return headers;
}

let apiBaseCache: string | null = null;

async function resolveApiBase(): Promise<string> {
  if (apiBaseCache) return apiBaseCache;
  // 1) In local dev (localhost/LAN) and not Capacitor, use Vite proxy via same-origin '/api' (return empty base)
  try {
    const w = (typeof window !== 'undefined') ? (window as any) : {};
    const host = w?.location?.hostname || '';
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    const isLan = /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);
    const isCapacitor = String(w?.location?.protocol || '').startsWith('capacitor');
    if ((isLocal || isLan) && !isCapacitor) {
      // Returning empty base means fetch will use relative '/api/...', which Vite will proxy to the remote backend
      apiBaseCache = '';
      return apiBaseCache;
    }
  } catch {}

  // 2) Prefer runtime config (window.__CONFIG__ or public/config.json) for production or deployed environments
  try {
    const w = (typeof window !== 'undefined') ? (window as any) : {};
    const runtime = w.__CONFIG__ && w.__CONFIG__.API_BASE;
    if (runtime && typeof runtime === 'string') {
      apiBaseCache = runtime.replace(/\/+$/, '');
      return apiBaseCache;
    }
    if (typeof window !== 'undefined') {
      const resp = await fetch('/config.json', { cache: 'no-cache' });
      if (resp.ok) {
        const cfg = await resp.json();
        if (cfg && cfg.API_BASE) {
          w.__CONFIG__ = cfg;
          apiBaseCache = String(cfg.API_BASE).replace(/\/+$/, '');
          return apiBaseCache;
        }
      }
    }
  } catch {}

  // 3) Fallback to build-time env or localhost server
  const envBase = (import.meta as any).env?.VITE_SERVER_URL || 'http://localhost:4000';
  apiBaseCache = String(envBase).replace(/\/+$/, '');
  return apiBaseCache;
}

// Helper: perform fetch and, if local proxy fails (e.g., ERR_ABORTED), retry directly against the remote backend once.
async function fetchWithProxyFallback(path: string, init?: RequestInit) {
  const base = await resolveApiBase();
  const url = `${base}/api${path}`;
  try {
    const res = await fetch(url, init);
    return res;
  } catch (e: any) {
    // In some dev environments the proxy can intermittently abort requests.
    // If we're in local dev (base === ''), retry against the known remote backend once.
    const isLocalBase = base === '';
    const looksAborted = typeof e?.message === 'string' && e.message.toLowerCase().includes('abort');
    if (isLocalBase && looksAborted) {
      const remote = 'https://attendance-backend-u99p.onrender.com';
      const remoteUrl = `${remote}/api${path}`;
      try {
        return await fetch(remoteUrl, init);
      } catch (e2) {
        throw e; // keep original error context
      }
    }
    throw e;
  }
}

export const api = {
  async get(path: string) {
    const res = await fetchWithProxyFallback(path, {
      headers: withAuth({ 'Accept': 'application/json' }),
    });
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
    return res.json();
  },
  async post(path: string, body: any) {
    const res = await fetchWithProxyFallback(path, {
      method: 'POST',
      headers: withAuth({ 'Content-Type': 'application/json', 'Accept': 'application/json' }),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
    return res.json();
  },
  async put(path: string, body: any) {
    const res = await fetchWithProxyFallback(path, {
      method: 'PUT',
      headers: withAuth({ 'Content-Type': 'application/json', 'Accept': 'application/json' }),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`);
    return res.json();
  },
  async delete(path: string) {
    const res = await fetchWithProxyFallback(path, {
      method: 'DELETE',
      headers: withAuth({ 'Accept': 'application/json' }),
    });
    if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
    return res.json();
  },
  async login(username: string, password: string) {
    const res = await fetchWithProxyFallback('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error(`POST /login failed: ${res.status}`);
    return res.json();
  },
  async logout() {
    const res = await fetchWithProxyFallback('/logout', { method: 'POST' });
    if (!res.ok) throw new Error(`POST /logout failed: ${res.status}`);
    return res.json();
  }
};