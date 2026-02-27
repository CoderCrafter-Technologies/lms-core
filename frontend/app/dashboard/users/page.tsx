'use client'

import { Plus, Users, CheckCircle, GraduationCap, User, Search, Filter, Download, Shield, X } from 'lucide-react'
import { useAuth } from '../../../components/providers/AuthProvider'
import { useEffect, useMemo, useState } from 'react'
import api from '@/lib/api'
import { toast } from 'sonner'

type RoleRef = {
  id?: string
  _id?: string
  name: string
  displayName: string
}

type UserListItem = {
  id: string
  firstName: string
  lastName: string
  name: string
  email: string
  phone?: string
  status: 'active' | 'inactive'
  isActive: boolean
  role: RoleRef
  createdAt?: string
  lastLogin?: string | null
  managerPermissions?: string[]
}

type UserStatsResponse = {
  total: number
  active: number
  inactive: number
  byRole: Array<{ _id: string; count: number; active: number }>
}

type PermissionItem = { key: string; label: string }
type PermissionGroup = { key: string; title: string; permissions: PermissionItem[] }

const initialManagerForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  sendEmail: true,
}

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Never'
  return date.toLocaleString()
}

export default function UsersPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<UserListItem[]>([])
  const [userStats, setUserStats] = useState<UserStatsResponse | null>(null)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [managerForm, setManagerForm] = useState(initialManagerForm)
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([])
  const [defaultPermissions, setDefaultPermissions] = useState<string[]>([])
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canManageUsers = user?.role?.name === 'ADMIN' || user?.role?.name === 'MANAGER'
  const isAdmin = user?.role?.name === 'ADMIN'

  const fetchUsers = async () => {
    if (!canManageUsers) return

    try {
      setLoading(true)
      const [usersResponse, statsResponse] = await Promise.all([
        api.getUsers({ limit: 200 }),
        api.getUserStats(),
      ])

      const mappedUsers: UserListItem[] = (usersResponse?.users || []).map((item: any) => {
        const role = item.roleId || { name: 'UNKNOWN', displayName: 'Unknown' }
        return {
          id: item.id || item._id,
          firstName: item.firstName || '',
          lastName: item.lastName || '',
          name: `${item.firstName || ''} ${item.lastName || ''}`.trim() || item.email,
          email: item.email,
          phone: item.phone || '',
          status: item.isActive ? 'active' : 'inactive',
          isActive: !!item.isActive,
          role,
          createdAt: item.createdAt,
          lastLogin: item.lastLogin || null,
          managerPermissions: Array.isArray(item.managerPermissions) ? item.managerPermissions : [],
        }
      })

      setUsers(mappedUsers)
      setUserStats(statsResponse || null)
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageUsers])

  const loadPermissionCatalog = async () => {
    if (permissionGroups.length > 0) return

    try {
      const response = await api.getManagerPermissionCatalog()
      const groups = response?.data?.groups || []
      const defaults = response?.data?.defaults || []
      setPermissionGroups(groups)
      setDefaultPermissions(defaults)
      setSelectedPermissions(new Set(defaults))
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load manager permissions')
    }
  }

  const openCreateManagerModal = async () => {
    setIsModalOpen(true)
    await loadPermissionCatalog()
  }

  const closeCreateManagerModal = () => {
    if (isSubmitting) return
    setIsModalOpen(false)
    setManagerForm(initialManagerForm)
    setSelectedPermissions(new Set(defaultPermissions))
  }

  const togglePermission = (permissionKey: string) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev)
      if (next.has(permissionKey)) {
        next.delete(permissionKey)
      } else {
        next.add(permissionKey)
      }
      return next
    })
  }

  const handleCreateManager = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!managerForm.firstName.trim() || !managerForm.lastName.trim() || !managerForm.email.trim()) {
      toast.error('First name, last name, and email are required.')
      return
    }

    if (selectedPermissions.size === 0) {
      toast.error('Select at least one permission for the manager.')
      return
    }

    try {
      setIsSubmitting(true)
      await api.createAdminManager({
        firstName: managerForm.firstName.trim(),
        lastName: managerForm.lastName.trim(),
        email: managerForm.email.trim(),
        phone: managerForm.phone.trim(),
        password: managerForm.password.trim() || undefined,
        sendEmail: managerForm.sendEmail,
        managerPermissions: Array.from(selectedPermissions),
      })

      closeCreateManagerModal()
      await fetchUsers()
      toast.success('Manager account created successfully.')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create manager')
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredUsers = useMemo(() => {
    return users.filter((userItem) => {
      const matchesSearch =
        userItem.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        userItem.email.toLowerCase().includes(searchTerm.toLowerCase())

      if (!matchesSearch) return false
      if (filter === 'all') return true
      if (filter === 'active') return userItem.status === 'active'
      if (filter === 'inactive') return userItem.status === 'inactive'

      return userItem.role?.name?.toLowerCase() === filter.toLowerCase()
    })
  }, [users, searchTerm, filter])

  if (!canManageUsers) {
    return (
      <div className="flex-1 p-6 max-w-full" style={{ backgroundColor: 'var(--color-background)' }}>
        <div
          className="border rounded-lg p-6 text-center"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="text-2xl mb-4 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
            LOCKED
          </div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
            Access Restricted
          </h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            You don&apos;t have permission to access user management.
          </p>
        </div>
      </div>
    )
  }

  const statsByRole: Record<string, number> = {}
  for (const roleEntry of userStats?.byRole || []) {
    statsByRole[roleEntry._id] = roleEntry.count
  }

  const stats = [
    {
      label: 'Total Users',
      value: userStats?.total ?? users.length,
      icon: Users,
      borderColor: 'var(--color-primary)',
      iconBg: 'var(--color-primary-light)',
    },
    {
      label: 'Active Users',
      value: userStats?.active ?? users.filter((u) => u.status === 'active').length,
      icon: CheckCircle,
      borderColor: 'var(--color-success)',
      iconBg: 'var(--color-success-light)',
    },
    {
      label: 'Instructors',
      value: statsByRole.INSTRUCTOR || users.filter((u) => u.role?.name === 'INSTRUCTOR').length,
      icon: GraduationCap,
      borderColor: 'var(--color-purple-500)',
      iconBg: 'rgba(168, 85, 247, 0.15)',
    },
    {
      label: 'Students',
      value: statsByRole.STUDENT || users.filter((u) => u.role?.name === 'STUDENT').length,
      icon: User,
      borderColor: 'var(--color-warning)',
      iconBg: 'var(--color-warning-light)',
    },
  ]

  const getRoleBadgeStyle = (roleName?: string) => {
    switch (roleName) {
      case 'ADMIN':
        return {
          backgroundColor: 'var(--color-error-light)',
          color: 'var(--color-error)',
        }
      case 'MANAGER':
        return {
          backgroundColor: 'var(--color-primary-light)',
          color: 'var(--color-primary)',
        }
      case 'INSTRUCTOR':
        return {
          backgroundColor: 'var(--color-purple-500)',
          color: 'white',
        }
      case 'STUDENT':
        return {
          backgroundColor: 'var(--color-success-light)',
          color: 'var(--color-success)',
        }
      default:
        return {
          backgroundColor: 'var(--color-secondary)',
          color: 'var(--color-text-secondary)',
        }
    }
  }

  const getStatusBadgeStyle = (status: string) => {
    return status === 'active'
      ? { backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)' }
      : { backgroundColor: 'var(--color-error-light)', color: 'var(--color-error)' }
  }

  return (
    <>
      <div className="flex-1 p-6 max-w-full overflow-x-auto" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="mb-8 py-2 md:py-7 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
                User Management
              </h1>
              <p className="mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                Manage users, roles, and permissions
              </p>
            </div>
            {isAdmin && (
              <button
                className="px-4 py-2 flex items-center gap-2 text-white rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--color-primary)' }}
                onClick={openCreateManagerModal}
              >
                <Plus className="w-4 h-4" />
                Add Manager
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon
            return (
              <div
                key={index}
                className="p-6 rounded-lg shadow-sm border-l-4"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderLeftColor: stat.borderColor,
                  borderTop: '1px solid var(--color-card-border)',
                  borderRight: '1px solid var(--color-card-border)',
                  borderBottom: '1px solid var(--color-card-border)',
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                      {stat.label}
                    </p>
                    <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
                      {stat.value}
                    </p>
                  </div>
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: stat.iconBg }}
                  >
                    <Icon className="w-6 h-6" style={{ color: stat.borderColor }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div
          className="rounded-lg border p-6 mb-8"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4"
                style={{ color: 'var(--color-text-secondary)' }}
              />
              <input
                type="text"
                placeholder="Search users by name or email..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Filter className="h-5 w-5 self-center" style={{ color: 'var(--color-text-secondary)' }} />
              <select
                className="px-4 py-2 border rounded-lg focus:outline-none"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                }}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All Users</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="admin">Admins</option>
                <option value="manager">Managers</option>
                <option value="instructor">Instructors</option>
                <option value="student">Students</option>
              </select>
              <button
                className="px-4 py-2 border rounded-lg transition-colors flex items-center gap-2"
                style={{
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                  backgroundColor: 'transparent',
                }}
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </div>

        <div
          className="rounded-lg border overflow-hidden"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              Users ({filteredUsers.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>
              Loading users...
            </div>
          ) : filteredUsers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y" style={{ borderColor: 'var(--color-border)' }}>
                <thead style={{ backgroundColor: 'var(--color-surface-muted)' }}>
                  <tr>
                    {['User', 'Role', 'Status', 'Last Login', 'Actions'].map((header) => (
                      <th
                        key={header}
                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                  {filteredUsers.map((userItem) => {
                    const roleStyle = getRoleBadgeStyle(userItem.role?.name)
                    const statusStyle = getStatusBadgeStyle(userItem.status)

                    return (
                      <tr key={userItem.id} className="transition-colors" style={{ backgroundColor: 'var(--color-surface)' }}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div
                                className="h-10 w-10 rounded-full flex items-center justify-center text-white font-medium"
                                style={{ backgroundColor: 'var(--color-primary)' }}
                              >
                                {userItem.name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .substring(0, 2)
                                  .toUpperCase()}
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                                {userItem.name}
                              </div>
                              <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                {userItem.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full" style={roleStyle}>
                            {userItem.role?.displayName || userItem.role?.name || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full" style={statusStyle}>
                            {userItem.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {formatDateTime(userItem.lastLogin)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-3">
                            <button className="transition-colors" style={{ color: 'var(--color-primary)' }}>
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--color-text-tertiary)' }} />
              <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                No users found
              </h3>
              <p className="mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                {searchTerm ? 'No users match your search criteria' : 'No users available'}
              </p>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className="w-full max-w-5xl rounded-xl border shadow-xl max-h-[90vh] overflow-hidden"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
                  Add New Manager
                </h2>
                <p style={{ color: 'var(--color-text-secondary)' }}>
                  Create manager account and assign custom access permissions.
                </p>
              </div>
              <button
                className="p-2 rounded-md"
                style={{ color: 'var(--color-text-secondary)' }}
                onClick={closeCreateManagerModal}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManager} className="overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                      First Name
                    </span>
                    <input
                      type="text"
                      value={managerForm.firstName}
                      onChange={(e) => setManagerForm((prev) => ({ ...prev, firstName: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border rounded-md"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                      Last Name
                    </span>
                    <input
                      type="text"
                      value={managerForm.lastName}
                      onChange={(e) => setManagerForm((prev) => ({ ...prev, lastName: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border rounded-md"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                      Email
                    </span>
                    <input
                      type="email"
                      value={managerForm.email}
                      onChange={(e) => setManagerForm((prev) => ({ ...prev, email: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border rounded-md"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                      Phone
                    </span>
                    <input
                      type="text"
                      value={managerForm.phone}
                      onChange={(e) => setManagerForm((prev) => ({ ...prev, phone: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border rounded-md"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                      Password (optional)
                    </span>
                    <input
                      type="password"
                      value={managerForm.password}
                      onChange={(e) => setManagerForm((prev) => ({ ...prev, password: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border rounded-md"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text)',
                      }}
                      placeholder="Leave blank to auto-generate"
                    />
                  </label>

                  <label className="inline-flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      checked={managerForm.sendEmail}
                      onChange={(e) => setManagerForm((prev) => ({ ...prev, sendEmail: e.target.checked }))}
                    />
                    <span style={{ color: 'var(--color-text-secondary)' }}>Send credentials by email</span>
                  </label>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                      <Shield className="w-4 h-4" />
                      Permissions
                    </h3>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-xs px-2 py-1 rounded border"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                        onClick={() => setSelectedPermissions(new Set(defaultPermissions))}
                      >
                        Defaults
                      </button>
                      <button
                        type="button"
                        className="text-xs px-2 py-1 rounded border"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                        onClick={() => {
                          const allPermissions = permissionGroups.flatMap((group) =>
                            group.permissions.map((permission) => permission.key)
                          )
                          setSelectedPermissions(new Set(allPermissions))
                        }}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        className="text-xs px-2 py-1 rounded border"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                        onClick={() => setSelectedPermissions(new Set())}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div
                    className="border rounded-md p-3 max-h-[460px] overflow-y-auto space-y-4"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    {permissionGroups.map((group) => (
                      <div key={group.key}>
                        <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
                          {group.title}
                        </h4>
                        <div className="space-y-2">
                          {group.permissions.map((permission) => (
                            <label key={permission.key} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={selectedPermissions.has(permission.key)}
                                onChange={() => togglePermission(permission.key)}
                              />
                              <span style={{ color: 'var(--color-text-secondary)' }}>{permission.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                    Selected permissions: {selectedPermissions.size}
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 border-t flex justify-end gap-3" style={{ borderColor: 'var(--color-border)' }}>
                <button
                  type="button"
                  className="px-4 py-2 rounded-md border"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                  onClick={closeCreateManagerModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md text-white"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create Manager'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
