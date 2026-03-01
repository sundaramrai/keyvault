import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  if (globalThis.window !== undefined) {
    const token = sessionStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_URL}/api/auth/refresh`, {
          refresh_token: refreshToken,
        });

        sessionStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch {
        // Refresh failed — clear tokens and redirect to login
        sessionStorage.clear();
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('vault_salt');
        globalThis.location.href = '/auth';
      }
    }
    throw error;
  },
);

// Auth

export const authApi = {
  register: (email: string, password: string, fullName?: string, masterHint?: string) =>
    api.post('/api/auth/register', { email, password, full_name: fullName, master_hint: masterHint }),

  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),

  refresh: (refreshToken: string) =>
    api.post('/api/auth/refresh', { refresh_token: refreshToken }),

  logout: (refreshToken: string) =>
    api.post('/api/auth/logout', { refresh_token: refreshToken }),

  me: () => api.get('/api/auth/me'),
};

// Vault

export const vaultApi = {
  list: (params?: { category?: string; search?: string; favourites_only?: boolean }) =>
    api.get('/api/vault', { params }),

  get: (id: string) => api.get(`/api/vault/${id}`),

  create: (data: {
    name: string;
    category: string;
    encrypted_data: string;
    favicon_url?: string;
    is_favourite?: boolean;
  }) => api.post('/api/vault', data),

  update: (id: string, data: Partial<{
    name: string;
    category: string;
    encrypted_data: string;
    favicon_url: string;
    is_favourite: boolean;
  }>) => api.patch(`/api/vault/${id}`, data),

  delete: (id: string) => api.delete(`/api/vault/${id}`),

  export: () => api.get('/api/vault/export/json'),
};
