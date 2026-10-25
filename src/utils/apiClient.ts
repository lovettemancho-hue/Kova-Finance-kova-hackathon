import { auth } from '../lib/firebase';

const API_BASE = import.meta.env.VITE_API_URL || '';

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const currentUser = auth.currentUser;
  let token: string | null = null;

  if (currentUser) {
    try {
      token = await currentUser.getIdToken();
    } catch (e) {
      console.warn('[fetchWithAuth] Failed to retrieve fresh token:', e);
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Ensure absolute URL resolution whether local or pointing to cloud hosting
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const targetUrl = endpoint.startsWith('http') ? endpoint : `${API_BASE}${cleanEndpoint}`;

  return fetch(targetUrl, {
    ...options,
    headers,
  });
}

