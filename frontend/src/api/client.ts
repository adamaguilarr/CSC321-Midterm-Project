import axios from "axios";
import { useAuthStore } from "../stores/authStore";
import { toast } from "../stores/toastStore";
import { toApiError } from "./errors";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api",
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState();
  if (token) config.headers.Authorization = `Token ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const apiError = toApiError(error);
    if (apiError.status === 401 && useAuthStore.getState().token) {
      useAuthStore.getState().clearSession();
      toast.info("Your session expired. Please log in again.");
    }
    return Promise.reject(apiError);
  },
);
