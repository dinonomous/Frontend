import api from '../utils/axios';

export interface LoginResponse {
  access: string;
  refresh: string;
  [key: string]: any;
}

export interface RegisterResponse {
  id: number;
  username: string;
  email: string;
  [key: string]: any;
}

export interface VerifyEmailResponse {
  message: string;
  [key: string]: any;
}

export interface RefreshTokenResponse {
  access: string;
  [key: string]: any;
}

export const login = async (
  username: string,
  password: string
): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/auth/login/', { username, password });
  return response.data;
};

export const register = async (
  username: string,
  email: string,
  password: string
): Promise<RegisterResponse> => {
  const response = await api.post<RegisterResponse>('/auth/register/', { username, email, password });
  return response.data;
};

export const verifyEmail = async (
  token: string
): Promise<VerifyEmailResponse> => {
  const response = await api.get<VerifyEmailResponse>(`/auth/verify-email/${token}/`);
  return response.data;
};

export const refreshToken = async (
  refresh: string
): Promise<RefreshTokenResponse> => {
  const response = await api.post<RefreshTokenResponse>('/auth/token/refresh/', { refresh });
  return response.data;
};