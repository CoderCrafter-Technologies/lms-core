import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { DateTimePicker } from '@/components/ui/date-time-picker';

interface ClassScheduleModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  batch?: any;
}

export default function ClassScheduleModal({ 
  open, 
  onClose, 
  onSuccess,
  batch 
}: ClassScheduleModalProps) {
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState<Date | undefined>(new Date());
  const [duration, setDuration] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startTime) return;
    
    setIsSubmitting(true);
    try {
      // Here you would typically call your API to schedule the class
      // await api.scheduleClass(batch.id, { title, startTime, duration });
      onSuccess();
      setTitle('');
      setStartTime(new Date());
      setDuration(60);
    } catch (error) {
      console.error('Failed to schedule class:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {batch ? `Schedule Class for ${batch.name}` : 'Schedule Class'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Class Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter class title"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Start Time</Label>
              <DateTimePicker 
                date={startTime}
                setDate={setStartTime}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                min="30"
                step="15"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Scheduling...' : 'Schedule Class'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}