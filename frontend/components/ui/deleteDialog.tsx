import { AlertCircle } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog"
import { Button } from "./button"

interface DialogElement {
  type: 'Course' | 'Batch' | 'Resource' | 'Class';
  element: string;
}

interface DeleteDialogProps {
  showDialog: boolean;
  setShowDialog: (value: boolean) => void;
  element: DialogElement;
  callback: () => void;
  disabled?: boolean;
}

export const DeleteDialog = ({showDialog, setShowDialog, element, callback, disabled }: DeleteDialogProps) => {
  // Get the appropriate message based on element type
  const getMessage = () => {
    switch (element.type) {
      case 'Course':
        return `Are you sure you want to delete the course "${element.element}"? This action will permanently delete the course and all associated data including batches, enrollments, and resources. This action cannot be undone.`;
      case 'Batch':
        return `Are you sure you want to delete the batch "${element.element}"? This action will permanently delete the batch and all associated data including classes, enrollments, and student progress. This action cannot be undone.`;
      case 'Resource':
        return `Are you sure you want to delete the resource "${element.element}"? This action cannot be undone.`;
      case 'Class':
        return `Are you sure you want to delete the class "${element.element}"? This action will permanently delete the class and all associated data including recordings and attendance. This action cannot be undone.`;
      default:
        return `Are you sure you want to delete "${element.element}"? This action cannot be undone.`;
    }
  }

  const getTitle = () => {
    return `Confirm ${element.type} Deletion`;
  }

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle 
              className="h-5 w-5" 
              style={{ color: 'var(--color-error)' }} 
            />
            <span style={{ color: 'var(--color-text)' }}>{getTitle()}</span>
          </DialogTitle>
          <DialogDescription className="mt-2">
            {getMessage()}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowDialog(false)}
            disabled={disabled}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={callback}
            disabled={disabled}
          >
            {disabled ? 'Deleting...' : `Delete ${element.type}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
