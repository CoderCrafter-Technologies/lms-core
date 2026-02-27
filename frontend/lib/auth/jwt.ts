export const AUTH_TOKEN_KEY = "authToken"

type JwtPayload = {
  exp?: number
  [key: string]: unknown
}

export const decodeJwtPayload = (token: string): JwtPayload | null => {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const decoded = JSON.parse(atob(payload))
    return decoded
  } catch {
    return null
  }
}

export const isJwtExpired = (token: string, skewSeconds = 15): boolean => {
  const payload = decodeJwtPayload(token)
  if (!payload || typeof payload.exp !== "number") return true
  const now = Math.floor(Date.now() / 1000)
  return payload.exp <= now + skewSeconds
}

export const clearStoredAuthTokens = () => {
  if (typeof window === "undefined") return
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem("refreshToken")
  // Legacy key cleanup
  localStorage.removeItem("token")
}

export const clearStoredAccessToken = () => {
  if (typeof window === "undefined") return
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem("token")
}

export const isProtectedPath = (pathname: string): boolean => {
  return pathname.startsWith("/dashboard") || pathname.startsWith("/classroom")
}

export const redirectToLogin = () => {
  if (typeof window === "undefined") return
  if (window.location.pathname.startsWith("/auth/login")) return
  window.location.replace("/auth/login")
}
