import { apiClient } from './apiClient'
import { AuthResponse, LoginCredentials, RegisterData, User } from '../../types/auth'

class AuthService {
  private token: string | null = null

  setToken(token: string) {
    this.token = token
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`
  }

  removeToken() {
    this.token = null
    delete apiClient.defaults.headers.common['Authorization']
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await apiClient.post('/auth/login', { email, password })
    if (response.data?.token) {
      this.setToken(response.data.token)
    }
    return response.data
  }

  async register(userData: RegisterData): Promise<AuthResponse> {
    const response = await apiClient.post('/auth/register', userData)
    return response.data
  }

  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get('/auth/me')
    return response.data.user
  }

  async refreshToken(): Promise<{ token: string }> {
    const response = await apiClient.post('/auth/refresh')
    if (response.data?.token) {
      this.setToken(response.data.token)
    }
    return response.data
  }

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout')
  }

  async forgotPassword(email: string): Promise<void> {
    await apiClient.post('/auth/forgot-password', { email })
  }

  async resetPassword(token: string, password: string): Promise<void> {
    await apiClient.post('/auth/reset-password', { token, password })
  }
}

export const authService = new AuthService()
