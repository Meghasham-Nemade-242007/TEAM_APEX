import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { UploadCloud, FileText, AlertCircle, X } from 'lucide-react';
import clsx from 'clsx';

export interface DropZoneProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClearFile: () => void;
  disabled?: boolean;
  maxSizeBytes?: number; // default 50 MB
}

export const DropZone: React.FC<DropZoneProps> = ({
  onFileSelect,
  selectedFile,
  onClearFile,
  disabled = false,
  maxSizeBytes = 50 * 1024 * 1024,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const validateAndHandleFile = (file: File) => {
    setErrorMessage(null);

    // Validate type
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setErrorMessage('Invalid file type. Only PDF documents are supported.');
      return;
    }

    // Validate size
    if (file.size > maxSizeBytes) {
      setErrorMessage(`File exceeds maximum size limit of ${formatFileSize(maxSizeBytes)}.`);
      return;
    }

    onFileSelect(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndHandleFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndHandleFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled}
      />

      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={clsx(
            'border-2 border-dashed rounded-xl p-8 md:p-12 text-center cursor-pointer transition-all duration-200 select-none flex flex-col items-center justify-center',
            isDragOver
              ? 'border-blue-primary bg-blue-light/50 scale-[0.99]'
              : 'border-slate-300 hover:border-blue-primary bg-white hover:bg-slate-50/50',
            disabled && 'opacity-60 cursor-not-allowed hover:border-slate-300 hover:bg-white'
          )}
        >
          <div
            className={clsx(
              'w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors',
              isDragOver ? 'bg-blue-primary text-white' : 'bg-blue-light text-blue-primary'
            )}
          >
            <UploadCloud className="w-8 h-8" />
          </div>

          <h3 className="text-base font-semibold text-navy mb-1">
            Upload Court or Legal Document
          </h3>
          <p className="text-xs text-text-secondary max-w-sm mb-4">
            Drag and drop your judgment, petition, or order here, or click to browse files on your computer.
          </p>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md text-xs font-medium border border-slate-200">
            <span>Supported: PDF files up to 50 MB</span>
          </div>
        </div>
      ) : (
        <div className="border border-border bg-white rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-lg bg-blue-light text-blue-primary flex items-center justify-center shrink-0 border border-blue-200">
              <FileText className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-navy truncate" title={selectedFile.name}>
                {selectedFile.name}
              </h4>
              <p className="text-xs text-text-secondary mt-0.5">
                {formatFileSize(selectedFile.size)} &bull; Ready for AI extraction
              </p>
            </div>
          </div>

          {!disabled && (
            <button
              type="button"
              onClick={onClearFile}
              className="p-1.5 text-text-secondary hover:text-error hover:bg-red-50 rounded-md transition-colors"
              aria-label="Remove selected file"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="mt-3 flex items-center gap-2 text-xs text-error bg-red-50 border border-red-200 rounded-md p-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
