import { useState } from 'react';
import { Upload, X, FileText, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FileUploadProps {
  onUploadComplete: (urls: string[]) => void;
  onRemove: (index: number) => void;
  currentFiles?: string[];
  maxFiles?: number;
  bucket?: string;
}

interface UploadedFile {
  name: string;
  url: string;
  type: string;
  size: number;
}

export function FileUpload({ 
  onUploadComplete, 
  onRemove, 
  currentFiles = [], 
  maxFiles = 5,
  bucket = 'ot-attachments',
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const { toast } = useToast();

  const isImageFile = (url: string, type?: string): boolean => {
    if (type) {
      return type.startsWith('image/');
    }
    const extension = url.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png'].includes(extension || '');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Check total file count
    const totalFiles = currentFiles.length + files.length;
    if (totalFiles > maxFiles) {
      toast({
        title: 'Too many files',
        description: `Maximum ${maxFiles} files allowed. You can upload ${maxFiles - currentFiles.length} more file(s).`,
        variant: 'destructive',
      });
      return;
    }

    // Validate each file
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    const maxSize = 3 * 1024 * 1024; // 3MB

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: 'Invalid file type',
          description: `${file.name}: Only PDF, JPG, and PNG files are allowed`,
          variant: 'destructive',
        });
        return;
      }

      if (file.size > maxSize) {
        toast({
          title: 'File too large',
          description: `${file.name}: File size must be less than 3MB`,
          variant: 'destructive',
        });
        return;
      }
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const uploadedUrls: string[] = [];
      const uploadedFileData: UploadedFile[] = [];

      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
        uploadedFileData.push({ 
          name: file.name, 
          url: publicUrl, 
          type: file.type,
          size: file.size 
        });
      }

      const allUrls = [...currentFiles, ...uploadedUrls];
      setUploadedFiles([...uploadedFiles, ...uploadedFileData]);
      onUploadComplete(allUrls);

      toast({
        title: 'Success',
        description: `${files.length} file(s) uploaded successfully`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      // Reset input
      event.target.value = '';
    }
  };

  const handleRemove = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    onRemove(index);
  };

  const getFileInfo = (url: string, index: number) => {
    const uploadedFile = uploadedFiles.find(f => f.url === url);
    if (uploadedFile) {
      return {
        name: uploadedFile.name,
        type: uploadedFile.type,
        size: uploadedFile.size
      };
    }
    
    // Try to extract filename from URL
    try {
      const urlParts = url.split('/');
      const filename = urlParts[urlParts.length - 1];
      return {
        name: decodeURIComponent(filename),
        type: '',
        size: 0
      };
    } catch {
      return {
        name: `Attachment ${index + 1}`,
        type: '',
        size: 0
      };
    }
  };

  return (
    <div className="space-y-3">
      {/* Display uploaded files */}
      {currentFiles.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            {currentFiles.length}/{maxFiles} file(s) uploaded
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {currentFiles.map((url, index) => {
              const fileInfo = getFileInfo(url, index);
              const isImage = isImageFile(url, fileInfo.type);
              
              return (
                <div 
                  key={index} 
                  className="relative group border border-border rounded-lg overflow-hidden bg-muted/50 hover:border-primary/50 transition-colors"
                >
                  {isImage ? (
                    <>
                      <div 
                        className="relative cursor-pointer aspect-video"
                        onClick={() => setPreviewImage(url)}
                      >
                        <img 
                          src={url} 
                          alt={fileInfo.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      <div className="p-2 bg-background/95">
                        <p className="text-xs truncate font-medium">{fileInfo.name}</p>
                        {fileInfo.size > 0 && (
                          <p className="text-xs text-muted-foreground">{formatFileSize(fileInfo.size)}</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="p-4 flex flex-col items-center justify-center min-h-[120px]">
                      <FileText className="h-10 w-10 text-muted-foreground mb-2" />
                      <p className="text-xs text-center truncate w-full font-medium">{fileInfo.name}</p>
                      {fileInfo.size > 0 && (
                        <p className="text-xs text-muted-foreground">{formatFileSize(fileInfo.size)}</p>
                      )}
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemove(index)}
                    disabled={uploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload area - only show if under max files */}
      {currentFiles.length < maxFiles && (
        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            disabled={uploading}
            multiple
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {uploading ? 'Uploading...' : 'Click to upload attachments'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, JPG, PNG (Max 3MB each)
            </p>
            <p className="text-xs text-muted-foreground">
              Maximum {maxFiles} files total
            </p>
          </label>
        </div>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <img 
              src={previewImage} 
              alt="Preview"
              className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
