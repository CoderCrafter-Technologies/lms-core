export interface Role {
  id: string
  name: 'ADMIN' | 'MANAGER' | 'INSTRUCTOR' | 'STUDENT'
  displayName: string
  level: number
}

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  avatar?: {
    url: string
    publicId: string
  }
  phone?: string
  role: Role
  isEmailVerified: boolean
  lastLogin?: string
  createdAt: string
}

export interface AuthResponse {
  message: string
  user: User
  token: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  firstName: string
  lastName: string
  role?: string
}
