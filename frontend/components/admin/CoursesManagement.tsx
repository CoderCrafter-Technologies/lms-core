'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { CourseWithBatches, Course, Batch, LiveClass } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Calendar, 
  Users, 
  Clock,
  MoreHorizontal,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import CreateCourseModal from './CreateCourseModal';
import { BatchCreationModal } from '../modals/BatchCreationModal';
import ClassScheduleModal from './ClassScheduleModal';
import BatchDetailsModal from './BatchDetailsModal';

export default function CoursesManagement() {
  const [courses, setCourses] = useState<CourseWithBatches[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCourses, setOpenCourses] = useState<Set<string>>(new Set());
  const [openBatches, setOpenBatches] = useState<Set<string>>(new Set());
  
  // Modal states
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [showCreateBatch, setShowCreateBatch] = useState(false);
  const [showEditBatch, setShowEditBatch] = useState(false);
  const [showClassSchedule, setShowClassSchedule] = useState(false);
  const [showBatchDetails, setShowBatchDetails] = useState(false);
  
  // Selected items
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);

  useEffect(() => {
    fetchCoursesWithBatches();
  }, []);

  const fetchCoursesWithBatches = async () => {
    try {
      const response = await api.getCoursesWithBatches();
      setCourses(response.data);
    } catch (error) {
      console.error('Failed to fetch courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCourse = (courseId: string) => {
    const newOpen = new Set(openCourses);
    if (newOpen.has(courseId)) {
      newOpen.delete(courseId);
    } else {
      newOpen.add(courseId);
    }
    setOpenCourses(newOpen);
  };

  const toggleBatch = (batchId: string) => {
    const newOpen = new Set(openBatches);
    if (newOpen.has(batchId)) {
      newOpen.delete(batchId);
    } else {
      newOpen.add(batchId);
    }
    setOpenBatches(newOpen);
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (confirm('Are you sure you want to delete this course? This will also delete all associated batches and classes.')) {
      try {
        await api.deleteCourse(courseId);
        fetchCoursesWithBatches();
        toast.success('Course deleted successfully.');
      } catch (error) {
        console.error('Failed to delete course:', error);
        toast.error('Failed to delete course. Please try again.');
      }
    }
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (confirm('Are you sure you want to delete this batch? This will also delete all scheduled classes.')) {
      try {
        await api.deleteBatch(batchId);
        fetchCoursesWithBatches();
        toast.success('Batch deleted successfully.');
      } catch (error) {
        console.error('Failed to delete batch:', error);
        toast.error('Failed to delete batch. Please try again.');
      }
    }
  };

  const handleDeleteClass = async (batchId: string, classId: string) => {
    if (confirm('Are you sure you want to delete this class?')) {
      try {
        await api.deleteClass(batchId, classId);
        fetchCoursesWithBatches();
        toast.success('Class deleted successfully.');
      } catch (error) {
        console.error('Failed to delete class:', error);
        toast.error('Failed to delete class. Please try again.');
      }
    }
  };

  const handlePublishCourse = async (courseId: string) => {
    try {
      await api.publishCourse(courseId);
      fetchCoursesWithBatches();
      toast.success('Course published successfully.');
    } catch (error) {
      console.error('Failed to publish course:', error);
      toast.error('Failed to publish course. Please try again.');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      DRAFT: 'secondary',
      PUBLISHED: 'default',
      UPCOMING: 'outline',
      ACTIVE: 'default',
      COMPLETED: 'secondary',
      SCHEDULED: 'outline',
      LIVE: 'destructive',
      ENDED: 'secondary',
      CANCELLED: 'destructive'
    };

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Courses & Batches Management</h2>
        <Button onClick={() => setShowCreateCourse(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Course
        </Button>
      </div>

      <div className="space-y-4">
        {courses.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-64">
              <p className="text-gray-500 mb-4">No courses found</p>
              <Button onClick={() => setShowCreateCourse(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Course
              </Button>
            </CardContent>
          </Card>
        ) : (
          courses.map((course) => (
            <Card key={course.id} className="overflow-hidden">
              <Collapsible open={openCourses.has(course.id)}>
                <CollapsibleTrigger asChild>
                  <CardHeader 
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleCourse(course.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {openCourses.has(course.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <div>
                          <CardTitle className="text-lg">{course.title}</CardTitle>
                          <div className="flex items-center space-x-4 mt-1">
                            {getStatusBadge(course.status)}
                            <span className="text-sm text-gray-500">
                              {course.totalBatches} batch{course.totalBatches !== 1 ? 'es' : ''}
                            </span>
                            <span className="text-sm text-gray-500">
                              {course.totalStudents} student{course.totalStudents !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                        {course.status === 'DRAFT' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handlePublishCourse(course.id)}
                          >
                            Publish
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedCourse(course);
                            setShowCreateBatch(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Batch
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Course
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => handleDeleteCourse(course.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Course
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="border-t pt-4">
                      <p className="text-gray-600 mb-4">{course.description}</p>
                      
                      {course.batches.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No batches created yet</p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-2"
                            onClick={() => {
                              setSelectedCourse(course);
                              setShowCreateBatch(true);
                            }}
                          >
                            Create First Batch
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-gray-900">Batches</h4>
                          {course.batches.map((batch) => (
                            <Card key={batch.id} className="bg-gray-50">
                              <Collapsible open={openBatches.has(batch.id)}>
                                <CollapsibleTrigger asChild>
                                  <CardHeader 
                                    className="cursor-pointer hover:bg-gray-100 transition-colors pb-3"
                                    onClick={() => toggleBatch(batch.id)}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-3">
                                        {openBatches.has(batch.id) ? (
                                          <ChevronDown className="h-4 w-4" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4" />
                                        )}
                                        <div>
                                          <h5 className="font-medium">{batch.name}</h5>
                                          <div className="flex items-center space-x-4 mt-1">
                                            {getStatusBadge(batch.status)}
                                            <span className="text-sm text-gray-500 flex items-center">
                                              <Users className="h-3 w-3 mr-1" />
                                              {batch.totalStudents}/{batch.maxStudents}
                                            </span>
                                            <span className="text-sm text-gray-500 flex items-center">
                                              <Calendar className="h-3 w-3 mr-1" />
                                              {batch.totalClasses} classes
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          onClick={() => {
                                            setSelectedBatch(batch);
                                            setShowBatchDetails(true);
                                          }}
                                        >
                                          View Details
                                        </Button>
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          onClick={() => {
                                            setSelectedBatch(batch);
                                            setShowClassSchedule(true);
                                          }}
                                        >
                                          <Plus className="h-4 w-4 mr-1" />
                                          Add Class
                                        </Button>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm">
                                              <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent>
                                            <DropdownMenuItem onClick={() => {
                                              setSelectedBatch(batch);
                                              setSelectedCourse(course);
                                              setShowEditBatch(true);
                                            }}>
                                              <Edit className="h-4 w-4 mr-2" />
                                              Edit Batch
                                            </DropdownMenuItem>
                                            <DropdownMenuItem 
                                              className="text-red-600"
                                              onClick={() => handleDeleteBatch(batch.id)}
                                            >
                                              <Trash2 className="h-4 w-4 mr-2" />
                                              Delete Batch
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </div>
                                  </CardHeader>
                                </CollapsibleTrigger>

                                <CollapsibleContent>
                                  <CardContent className="pt-0">
                                    <div className="border-t pt-3">
                                      {batch.scheduledClasses.length === 0 ? (
                                        <div className="text-center py-6 text-gray-500">
                                          <Clock className="h-6 w-6 mx-auto mb-2 opacity-50" />
                                          <p className="text-sm">No classes scheduled yet</p>
                                          <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="mt-2"
                                            onClick={() => {
                                              setSelectedBatch(batch);
                                              setShowClassSchedule(true);
                                            }}
                                          >
                                            Schedule First Class
                                          </Button>
                                        </div>
                                      ) : (
                                        <div className="space-y-2">
                                          <h6 className="font-medium text-sm text-gray-900">Scheduled Classes</h6>
                                          {batch.scheduledClasses.map((liveClass: LiveClass) => (
                                            <div key={liveClass.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                                              <div>
                                                <h6 className="font-medium text-sm">{liveClass.title}</h6>
                                                <div className="flex items-center space-x-3 mt-1">
                                                  {getStatusBadge(liveClass.status)}
                                                  <span className="text-xs text-gray-500">
                                                    {new Date(liveClass.scheduledStartTime).toLocaleString()}
                                                  </span>
                                                </div>
                                              </div>
                                              <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                  <Button variant="ghost" size="sm">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                  </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                  <DropdownMenuItem>
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Edit Class
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem 
                                                    className="text-red-600"
                                                    onClick={() => handleDeleteClass(batch.id, liveClass.id)}
                                                  >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete Class
                                                  </DropdownMenuItem>
                                                </DropdownMenuContent>
                                              </DropdownMenu>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </CardContent>
                                </CollapsibleContent>
                              </Collapsible>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))
        )}
      </div>

      {/* Modals */}
      <CreateCourseModal 
        open={showCreateCourse}
        onClose={() => setShowCreateCourse(false)}
        onSuccess={() => {
          setShowCreateCourse(false);
          fetchCoursesWithBatches();
        }}
      />

      {selectedCourse && (
        <BatchCreationModal 
          isOpen={showCreateBatch}
          onClose={() => {
            setShowCreateBatch(false);
            setSelectedCourse(null);
          }}
          courseId={selectedCourse.id}
          courseName={selectedCourse.title}
          onBatchCreated={() => {
            setShowCreateBatch(false);
            setSelectedCourse(null);
            fetchCoursesWithBatches();
          }}
        />
      )}

      <ClassScheduleModal 
        open={showClassSchedule}
        onClose={() => {
          setShowClassSchedule(false);
          setSelectedBatch(null);
        }}
        onSuccess={() => {
          setShowClassSchedule(false);
          setSelectedBatch(null);
          fetchCoursesWithBatches();
        }}
        batch={selectedBatch}
      />

      <BatchDetailsModal 
        open={showBatchDetails}
        onClose={() => {
          setShowBatchDetails(false);
          setSelectedBatch(null);
        }}
        batch={selectedBatch}
      />

      {selectedBatch && selectedCourse && (
        <BatchCreationModal 
          isOpen={showEditBatch}
          onClose={() => {
            setShowEditBatch(false);
            setSelectedBatch(null);
            setSelectedCourse(null);
          }}
          courseId={selectedCourse.id}
          courseName={selectedCourse.title}
          onBatchCreated={() => {
            setShowEditBatch(false);
            setSelectedBatch(null);
            setSelectedCourse(null);
            fetchCoursesWithBatches();
          }}
          editingBatch={selectedBatch}
        />
      )}
    </div>
  );
}
