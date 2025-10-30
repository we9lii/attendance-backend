function getToken() {
  try {
    return localStorage.getItem('authToken') || '';
  } catch {
    return '';
  }
}

function withAuth(headers: Record<string, string> = {}) {
  const token = getToken();
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

export const api = {
  async get(path: string) {
    const base = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/api${path}`, {
      headers: withAuth({ 'Accept': 'application/json' }),
    });
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
    return res.json();
  },
  async post(path: string, body: any) {
    const base = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/api${path}`, {
      method: 'POST',
      headers: withAuth({ 'Content-Type': 'application/json', 'Accept': 'application/json' }),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
    return res.json();
  },
  async put(path: string, body: any) {
    const base = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/api${path}`, {
      method: 'PUT',
      headers: withAuth({ 'Content-Type': 'application/json', 'Accept': 'application/json' }),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`);
    return res.json();
  },
  async delete(path: string) {
    const base = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/api${path}`, {
      method: 'DELETE',
      headers: withAuth({ 'Accept': 'application/json' }),
    });
    if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
    return res.json();
  },
  async login(username: string, password: string) {
    const base = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error(`POST /login failed: ${res.status}`);
    return res.json();
  },
  async logout() {
    const base = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/api/logout`, { method: 'POST' });
    if (!res.ok) throw new Error(`POST /logout failed: ${res.status}`);
    return res.json();
  }
};