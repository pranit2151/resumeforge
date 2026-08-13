import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 120000, // 2 min for LLM + PDF generation
});

// Attach Authorization Bearer token to all requests across default axios & custom api instances
const attachAuthInterceptors = (instance: typeof axios) => {
  instance.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      if (
        error.response?.status === 401 &&
        !originalRequest._retry &&
        !originalRequest.url?.includes('/auth/login') &&
        !originalRequest.url?.includes('/auth/register')
      ) {
        originalRequest._retry = true;
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          try {
            const res = await axios.post('/api/auth/refresh-token', { refreshToken });
            const { accessToken, refreshToken: newRefreshToken } = res.data;
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', newRefreshToken);
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return instance(originalRequest);
          } catch (err) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('authUser');
            window.location.href = '/login';
          }
        }
      }
      return Promise.reject(error);
    }
  );
};

attachAuthInterceptors(axios);
attachAuthInterceptors(api as any);

export interface GenerateRequest {
  jd: string;
  mode: 'backend-focused' | 'fullstack-focused';
  targetPages: 1 | 2;
  tempSkills?: string[];
}

export interface TailoredBullet {
  id: string;
  originalText: string;
  tailoredText: string;
  relevanceScore: number;
  source: string;
  tags: string[];
  included: boolean;
  reason?: string;
}

export interface GenerateResponse {
  success: boolean;
  applicationId: number;
  jobTitle: string;
  company: string;
  atsScore: number;
  keywordsMatched: string[];
  keywordsMissing: string[];
  matchFlags: { have: string[]; missing: string[] };
  includedBullets: TailoredBullet[];
  cutBullets: TailoredBullet[];
  pdfFileName: string;
  docxFileName: string;
  pageCount: number;
  targetPages: number;
  coverEmail?: string;
}

export interface ApplicationRecord {
  id: number;
  job_title: string;
  company: string;
  jd_text: string;
  resume_mode: string;
  ats_score: number;
  pdf_path: string;
  docx_path: string;
  bullets_used: TailoredBullet[];
  bullets_cut: TailoredBullet[];
  keywords_matched: string[];
  keywords_missing: string[];
  target_pages: number;
  actual_pages: number;
  cover_email?: string;
  created_at: string;
}

export const generateResume = (data: GenerateRequest) =>
  api.post<GenerateResponse>('/generate', data).then((r) => r.data);

export const finalizeResume = (data: {
  jd: string;
  mode: string;
  targetPages: number;
  overrideBullets: TailoredBullet[];
  tempSkills?: string[];
}) => api.post<GenerateResponse>('/generate/finalize', data).then((r) => r.data);

export const getHistory = () =>
  api.get<{ applications: ApplicationRecord[] }>('/history').then((r) => r.data.applications);

export const getMasterResume = () => api.get('/master').then((r) => r.data);

export const saveMasterResume = (data: unknown) =>
  api.put('/master', data).then((r) => r.data);

export const getHealth = () => api.get('/health').then((r) => r.data);

export const downloadUrl = (fileName: string) => `/api/download/${encodeURIComponent(fileName)}`;

export default api;
