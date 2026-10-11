import axios from 'axios';
import { User, Document, CaseAnalysis, Message, ChatResponse } from '../types';

const BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: BASE,
  timeout: 15000,
});

// Add auth token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  register: (email: string, password: string, full_name: string) =>
    api.post<{ access_token: string; token_type: string; user: User }>('/api/auth/register', { email, password, full_name }),
  login: (email: string, password: string) =>
    api.post<{ access_token: string; token_type: string; user: User }>('/api/auth/login', { email, password }),
  me: () => api.get<User>('/api/auth/me'),
};

export const documentsAPI = {
  list: () => api.get<Document[]>('/api/documents'),
  upload: (file: File, onProgress?: (p: number) => void) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post<{ id: string; message: string; document: Document }>('/api/documents/upload', fd, {
      onUploadProgress: (e) => onProgress?.(Math.round(((e.loaded || 0) / (e.total || 1)) * 100)),
    });
  },
  getStatus: (id: string) => api.get<{ status: Document['status']; status_message: string; progress_step: number }>(`/api/documents/${id}/status`),
  get: (id: string) => api.get<Document>(`/api/documents/${id}`),
  getSummary: (id: string) => api.get<CaseAnalysis>(`/api/documents/${id}/summary`),
  delete: (id: string) => api.delete<{ message: string }>(`/api/documents/${id}`),
  getFileUrl: (id: string, tokenOverride?: string) => {
    const token = tokenOverride || localStorage.getItem('token');
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${BASE}/api/documents/${id}/file${query}`;
  },
};

export const chatAPI = {
  send: (docId: string, question: string, conversationId?: string) =>
    api.post<ChatResponse>(`/api/documents/${docId}/chat`, { question, conversation_id: conversationId }),
  history: (docId: string) => api.get<Message[]>(`/api/documents/${docId}/chat/history`),
};

export const systemAPI = {
  health: () => api.get<{ status: string; gemini_configured?: boolean; version?: string }>('/api/health'),
};

export default api;
