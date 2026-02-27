import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatTime(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

export function truncate(str: string, length: number) {
  return str.length > length ? `${str.slice(0, length)}...` : str
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// User role utilities
export function isInstructor(user: any): boolean {
  if (!user) {
    console.log("❌ isInstructor: user is null/undefined");
    return false;
  }
  
  // Enhanced debugging
  console.log("🔍 isInstructor debug:", {
    userName: user.firstName || user.name || 'unknown',
    fullUser: user,
    hasRoleId: !!user.roleId,
    roleId: user.roleId,
    roleIdName: user.roleId?.name,
    role: user.role,
    isInstructor: user.isInstructor,
    userKeys: Object.keys(user),
    // Check nested properties
    nestedRole: user.user?.roleId,
    userType: typeof user
  });
  
  const result = user.roleId?.name === 'INSTRUCTOR' || 
         user.role === 'instructor' || 
         user.role.name === 'INSTRUCTOR' ||
         user.isInstructor === true;
         
  console.log(`🎯 isInstructor result for ${user.firstName || user.name || 'unknown'}: ${result}`);
  return result;
}

export function isStudent(user: any): boolean {
  if (!user) return false;
  return user.roleId?.name === 'STUDENT' || 
         user.role === 'student' || 
         user.role === 'STUDENT' ||
         !isInstructor(user); // Default to student if not instructor
}

export function getUserRole(user: any): 'instructor' | 'student' {
  return isInstructor(user) ? 'instructor' : 'student';
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}