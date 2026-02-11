import { FileUpload } from '@/components/ot/FileUpload';

interface PettyCashReceiptUploadProps {
  value: string[];
  onChange: (value: string[]) => void;
  maxFiles?: number;
}

export function PettyCashReceiptUpload({ value, onChange, maxFiles = 5 }: PettyCashReceiptUploadProps) {
  return (
    <FileUpload
      bucket="petty-cash-receipts"
      currentFiles={value}
      maxFiles={maxFiles}
      onUploadComplete={(urls) => onChange(urls)}
      onRemove={(index) => {
        onChange(value.filter((_, i) => i !== index));
      }}
    />
  );
}
