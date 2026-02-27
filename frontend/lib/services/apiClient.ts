import { clearStoredAuthTokens, redirectToLogin } from '../auth/jwt'
import axios from 'axios'
import { AxiosHeaders } from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
})

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      if (!config.headers) {
        config.headers = new AxiosHeaders()
      }
      if (config.headers instanceof AxiosHeaders) {
        config.headers.set('x-client-timezone', timezone)
      } else {
        (config.headers as Record<string, string>)['x-client-timezone'] = timezone
      }
    }

    // Add timestamp to prevent caching
    config.params = {
      ...config.params,
      _t: Date.now(),
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response
      
      switch (status) {
        case 401:
          // Unauthorized - redirect to login
          if (typeof window !== 'undefined') {
            clearStoredAuthTokens()
            redirectToLogin()
          }
          break
        case 403:
          // Forbidden - show error message
          console.error('Access denied:', data.message)
          break
        case 404:
          // Not found
          console.error('Resource not found:', data.message)
          break
        case 422:
          // Validation error
          console.error('Validation error:', data.details)
          break
        case 429:
          // Rate limit exceeded
          console.error('Rate limit exceeded')
          break
        default:
          console.error('API Error:', data.message || error.message)
      }
      
      return Promise.reject(error.response.data)
    } else if (error.request) {
      // Network error
      console.error('Network error:', error.message)
      return Promise.reject({
        error: 'Network Error',
        message: 'Unable to connect to the server. Please check your internet connection.',
      })
    } else {
      // Other error
      console.error('Error:', error.message)
      return Promise.reject({
        error: 'Unknown Error',
        message: error.message,
      })
    }
  }
)
