// Wspolny klient REST + przechowywanie sesji.
const KEY = 'offline2074.session';

export function session() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}

export function saveSession(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

export function logout() {
  localStorage.removeItem(KEY);
  location.href = '/';
}

export function requireSession() {
  const s = session();
  if (!s || !s.token) { location.href = '/'; throw new Error('brak sesji'); }
  return s;
}

export async function api(path, { method = 'GET', body } = {}) {
  const s = session();
  const headers = { 'Content-Type': 'application/json' };
  if (s?.token) headers.Authorization = `Bearer ${s.token}`;
  const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (res.status === 401 && !path.startsWith('/api/auth')) { logout(); throw new Error('Sesja wygasła'); }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error || `Błąd ${res.status}`);
  return data;
}
