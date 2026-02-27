import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, Clock } from 'lucide-react';

interface BatchDetailsModalProps {
  open: boolean;
  onClose: () => void;
  batch?: any;
}

export default function BatchDetailsModal({ 
  open, 
  onClose,
  batch 
}: BatchDetailsModalProps) {
  if (!batch) return null;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      DRAFT: 'secondary',
      PUBLISHED: 'default',
      UPCOMING: 'outline',
      ACTIVE: 'default',
      COMPLETED: 'secondary',
    };

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {status}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Batch Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">{batch.name}</h3>
            <div className="flex items-center space-x-2 mt-1">
              {getStatusBadge(batch.status)}
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Users className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm text-gray-500">Students</p>
                <p>{batch.totalStudents}/{batch.maxStudents}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Calendar className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm text-gray-500">Start Date</p>
                <p>{new Date(batch.startDate).toLocaleDateString()}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Calendar className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm text-gray-500">End Date</p>
                <p>{new Date(batch.endDate).toLocaleDateString()}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Clock className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm text-gray-500">Schedule</p>
                <p>{batch.schedule}</p>
              </div>
            </div>
          </div>
          
          {batch.description && (
            <div>
              <p className="text-sm text-gray-500 mb-1">Description</p>
              <p className="text-sm">{batch.description}</p>
            </div>
          )}
          
          <div className="pt-4">
            <Button variant="outline" onClick={onClose} className="w-full">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}