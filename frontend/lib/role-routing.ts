type RoleLike =
  | string
  | {
      name?: string
      role?: string | { name?: string }
      roleId?: string | { name?: string }
    }

export function getNormalizedRoleName(input: RoleLike | null | undefined): string {
  if (!input) return ''

  if (typeof input === 'string') {
    return input.toUpperCase()
  }

  const direct = input.name
  if (direct) return String(direct).toUpperCase()

  const nestedRole = input.role
  if (typeof nestedRole === 'string' && nestedRole) return nestedRole.toUpperCase()
  if (nestedRole && typeof nestedRole === 'object' && nestedRole.name) return String(nestedRole.name).toUpperCase()

  const roleId = input.roleId
  if (typeof roleId === 'string') return roleId.toUpperCase()
  if (roleId && typeof roleId === 'object' && roleId.name) return String(roleId.name).toUpperCase()

  return ''
}

export function getDashboardRouteForRole(input: RoleLike | null | undefined): string {
  const roleName = getNormalizedRoleName(input)

  switch (roleName) {
    case 'ADMIN':
      return '/dashboard/admin'
    case 'MANAGER':
      return '/dashboard/manager'
    case 'INSTRUCTOR':
      return '/dashboard/instructor'
    case 'STUDENT':
      return '/dashboard/student'
    default:
      return '/dashboard'
  }
}
