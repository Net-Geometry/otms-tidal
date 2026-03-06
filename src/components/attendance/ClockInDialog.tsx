import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/ot/FileUpload';

interface ClockInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClockIn: (attachmentUrls: string[]) => Promise<void>;
  isClockingIn: boolean;
}

export function ClockInDialog({ open, onOpenChange, onClockIn, isClockingIn }: ClockInDialogProps) {
  const [files, setFiles] = useState<string[]>([]);

  const handleSubmit = async () => {
    await onClockIn(files);
    setFiles([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Clock In</DialogTitle>
          <DialogDescription>
            Upload at least one photo as proof of attendance.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <FileUpload
            onUploadComplete={(urls) => setFiles(urls)}
            onRemove={(index) => setFiles((prev) => prev.filter((_, i) => i !== index))}
            currentFiles={files}
            maxFiles={3}
            bucket="attendance-attachments"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={files.length === 0 || isClockingIn}
            >
              {isClockingIn ? 'Clocking In...' : 'Clock In'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
