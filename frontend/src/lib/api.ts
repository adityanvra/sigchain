import axios, { AxiosError } from "axios";
import { config } from "./config";

export const api = axios.create({
  baseURL: config.apiUrl,
  withCredentials: false,
});

const TOKEN_KEY = "sigchain_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((cfg) => {
  const token = getToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401 && getToken()) {
      clearToken();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export function apiErrorMessage(err: unknown, fallback = "Terjadi kesalahan"): string {
  const ax = err as AxiosError<{ message?: string }>;
  return ax?.response?.data?.message || ax?.message || fallback;
}
