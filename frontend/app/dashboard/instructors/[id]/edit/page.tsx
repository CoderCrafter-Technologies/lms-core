'use client'

import { useAuth } from '../../../../../components/providers/AuthProvider'
import { api } from '@/lib/api'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '../../../../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../components/ui/card'
import { Input } from '../../../../../components/ui/input'
import { Label } from '../../../../../components/ui/label'
import { Textarea } from '../../../../../components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../components/ui/select'
import { Badge } from '../../../../../components/ui/badge'
import { Separator } from '../../../../../components/ui/seperator'
import { toast } from 'sonner'
import { UserIcon, SaveIcon, XIcon } from 'lucide-react'

interface InstructorFormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  isActive: boolean
  isEmailVerified: boolean
  profile: {
    bio: string
    specialization: string[]
    experience: number | string
    qualification: string
  }
}

export default function EditInstructorPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const instructorId = params.id as string

  const [formData, setFormData] = useState<InstructorFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    isActive: true,
    isEmailVerified: false,
    profile: {
      bio: '',
      specialization: [],
      experience: '',
      qualification: ''
    }
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newSpecialization, setNewSpecialization] = useState('')

  // Check permissions
  const canEditInstructor = user?.role.name === 'ADMIN'

  useEffect(() => {
    if (canEditInstructor && instructorId) {
      fetchInstructorData()
    }
  }, [instructorId])

  const fetchInstructorData = async () => {
    setLoading(true)
    try {
      const data = await api.getInstructorById(instructorId as string)
      const instructor = data?.data

      setFormData({
        firstName: instructor.firstName || '',
        lastName: instructor.lastName || '',
        email: instructor.email || '',
        phone: instructor.phone || '',
        isActive: instructor.isActive ?? true,
        isEmailVerified: instructor.isEmailVerified ?? false,
        profile: {
          bio: instructor.profile?.bio || '',
          specialization: instructor.profile?.specialization || [],
          experience: instructor.profile?.experience || '',
          qualification: instructor.profile?.qualification || ''
        }
      })
    } catch (error) {
      console.error('Error fetching instructor:', error)
      toast.error('Failed to load instructor data')
      router.push('/dashboard/instructors')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    if (field.startsWith('profile.')) {
      const profileField = field.replace('profile.', '')
      setFormData(prev => ({
        ...prev,
        profile: {
          ...prev.profile,
          [profileField]: value
        }
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }))
    }
  }

  const addSpecialization = () => {
    if (newSpecialization.trim() && !formData.profile.specialization.includes(newSpecialization.trim())) {
      setFormData(prev => ({
        ...prev,
        profile: {
          ...prev.profile,
          specialization: [...prev.profile.specialization, newSpecialization.trim()]
        }
      }))
      setNewSpecialization('')
    }
  }

  const removeSpecialization = (index: number) => {
    setFormData(prev => ({
      ...prev,
      profile: {
        ...prev.profile,
        specialization: prev.profile.specialization.filter((_, i) => i !== index)
      }
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      await api.updateInstructorById(instructorId as string, {
        ...formData,
        profile: {
          ...formData.profile,
          experience: formData.profile.experience ? Number(formData.profile.experience) : undefined
        }
      })
      toast.success('Instructor profile updated successfully')
      router.push(`/dashboard/instructors/${instructorId}`)
    } catch (error) {
      console.error('Error updating instructor:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update instructor')
    } finally {
      setSaving(false)
    }
  }

  if (!canEditInstructor) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-6xl mb-4">🚫</div>
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-gray-600">You don't have permission to edit instructor profiles.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-96 bg-gray-200 rounded"></div>
            <div className="h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Button 
            variant="ghost" 
            onClick={() => router.push(`/dashboard/instructors/${instructorId}`)}
            className="mb-4"
          >
            ← Back to Profile
          </Button>
          <h1 className="text-3xl font-bold">Edit Instructor Profile</h1>
          <p className="text-gray-600">Update instructor information and settings</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="w-5 h-5" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="+1234567890"
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium">Account Status</h3>
                
                <div className="flex items-center gap-4">
                  <Label htmlFor="isActive">Account Status:</Label>
                  <Select
                    value={formData.isActive.toString()}
                    onValueChange={(value) => handleInputChange('isActive', value === 'true')}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-4">
                  <Label htmlFor="isEmailVerified">Email Status:</Label>
                  <Select
                    value={formData.isEmailVerified.toString()}
                    onValueChange={(value) => handleInputChange('isEmailVerified', value === 'true')}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Verified</SelectItem>
                      <SelectItem value="false">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Professional Information */}
          <Card>
            <CardHeader>
              <CardTitle>Professional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="qualification">Qualification</Label>
                <Input
                  id="qualification"
                  value={formData.profile.qualification}
                  onChange={(e) => handleInputChange('profile.qualification', e.target.value)}
                  placeholder="e.g., PhD in Computer Science"
                />
              </div>

              <div>
                <Label htmlFor="experience">Years of Experience</Label>
                <Input
                  id="experience"
                  type="number"
                  min="0"
                  value={formData.profile.experience}
                  onChange={(e) => handleInputChange('profile.experience', e.target.value)}
                  placeholder="5"
                />
              </div>

              <div>
                <Label>Specializations</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newSpecialization}
                    onChange={(e) => setNewSpecialization(e.target.value)}
                    placeholder="Add specialization"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecialization())}
                  />
                  <Button type="button" onClick={addSpecialization} variant="outline">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.profile.specialization.map((spec, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {spec}
                      <XIcon 
                        className="w-3 h-3 cursor-pointer hover:text-red-500" 
                        onClick={() => removeSpecialization(index)}
                      />
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={formData.profile.bio}
                  onChange={(e) => handleInputChange('profile.bio', e.target.value)}
                  placeholder="Brief description about the instructor..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/dashboard/instructors/${instructorId}`)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving} className="flex items-center gap-2">
            <SaveIcon className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}

