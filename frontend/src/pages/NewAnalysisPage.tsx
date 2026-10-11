import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Clock,
  Sparkles,
} from 'lucide-react';
import { DropZone } from '../features/upload/DropZone';
import { documentsAPI } from '../services/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Spinner } from '../components/ui/Spinner';
import clsx from 'clsx';

const PROGRESS_STEPS = [
  'Uploading document',
  'Extracting text',
  'Identifying pages and structure',
  'Analyzing legal content',
  'Preparing searchable passages',
  'Generating case summary',
  'Analysis complete',
];

export const NewAnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const pollTimerRef = useRef<number | null>(null);

  // Poll backend status when processing
  useEffect(() => {
    if (!documentId || !isUploading) return;

    const checkStatus = async () => {
      try {
        const res = await documentsAPI.getStatus(documentId);
        const data = res.data;

        if (data.status_message) {
          setStatusMessage(data.status_message);
        }

        // Map progress_step from backend (1 to 7) or calculate step
        if (typeof data.progress_step === 'number' && data.progress_step > 0) {
          setCurrentStep(Math.min(data.progress_step, 7));
        }

        if (data.status === 'complete') {
          setCurrentStep(7);
          setStatusMessage('Analysis complete! Redirecting to workspace...');
          // Give user a brief moment to see 100% completion
          setTimeout(() => {
            navigate(`/documents/${documentId}`);
          }, 1200);
          return;
        }

        if (data.status === 'failed') {
          setError(data.status_message || 'Legal document analysis pipeline encountered an error.');
          setIsUploading(false);
          return;
        }

        // Continue polling
        pollTimerRef.current = window.setTimeout(checkStatus, 2000);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error polling analysis status';
        console.error(msg);
        // Continue polling even on intermittent network error
        pollTimerRef.current = window.setTimeout(checkStatus, 2500);
      }
    };

    pollTimerRef.current = window.setTimeout(checkStatus, 2000);

    return () => {
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current);
      }
    };
  }, [documentId, isUploading, navigate]);

  const handleStartAnalysis = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadPercent(0);
    setCurrentStep(1); // Step 1: Uploading
    setStatusMessage('Uploading document to secure judicial sandbox...');
    setError(null);

    try {
      const res = await documentsAPI.upload(selectedFile, (progress) => {
        setUploadPercent(progress);
        if (progress >= 100) {
          setCurrentStep(2); // Step 2: Extracting text
          setStatusMessage('Document uploaded. Extracting textual records...');
        }
      });

      const uploadedData = res.data as { document?: { id?: string; status?: string }; document_id?: string; id?: string; status?: string };
      const docId = uploadedData.document?.id || uploadedData.document_id || uploadedData.id;
      if (!docId) {
        throw new Error('Upload succeeded but no document ID was returned.');
      }
      setDocumentId(docId);

      if (uploadedData.document?.status === 'complete' || uploadedData.status === 'complete') {
        setCurrentStep(7);
        setStatusMessage('Analysis complete! Redirecting...');
        setTimeout(() => {
          navigate(`/documents/${docId}`);
        }, 1200);
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : err instanceof Error
          ? err.message
          : 'Failed to upload document to analysis server.';
      setError(String(msg));
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
    }
    setSelectedFile(null);
    setIsUploading(false);
    setUploadPercent(0);
    setDocumentId(null);
    setCurrentStep(0);
    setStatusMessage('');
    setError(null);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-navy tracking-tight">New Legal Document Analysis</h1>
        <p className="text-xs text-text-secondary mt-1">
          Upload any legal brief, high court ruling, Supreme Court judgment, or contract for comprehensive analysis.
        </p>
      </div>

      {error && (
        <Alert variant="error" title="Analysis Pipeline Error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Main Upload Card */}
      <Card>
        {!isUploading ? (
          <div className="space-y-6">
            <DropZone
              onFileSelect={(file) => setSelectedFile(file)}
              selectedFile={selectedFile}
              onClearFile={() => setSelectedFile(null)}
              disabled={isUploading}
            />

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="text-xs text-text-secondary">
                {selectedFile ? (
                  <span className="text-navy font-medium">1 PDF document ready for ingestion</span>
                ) : (
                  <span>Please select a PDF document to proceed</span>
                )}
              </div>

              <div className="flex gap-3">
                {selectedFile && (
                  <Button variant="secondary" onClick={() => setSelectedFile(null)}>
                    Clear
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="md"
                  disabled={!selectedFile}
                  onClick={handleStartAnalysis}
                  leftIcon={<Play className="w-4 h-4 fill-current" />}
                >
                  Analyze Document
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* In Progress Analysis Display */
          <div className="py-6 px-2 space-y-8">
            <div className="text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-blue-light text-blue-primary flex items-center justify-center mx-auto mb-4 border border-blue-200 shadow-xs">
                {currentStep === 7 ? (
                  <CheckCircle2 className="w-8 h-8 text-success" />
                ) : (
                  <Spinner size="lg" color="#0866C6" />
                )}
              </div>
              <h3 className="text-base font-semibold text-navy">
                {currentStep === 7 ? 'Legal Extraction Complete' : 'AI Analysis in Progress'}
              </h3>
              <p className="text-xs text-text-secondary mt-1 min-h-[1.5rem]">
                {statusMessage || 'Processing document sections, precedent citations, and statutory arguments...'}
              </p>
            </div>

            {/* Upload Progress Bar if in step 1 */}
            {currentStep <= 1 && uploadPercent < 100 && (
              <div className="max-w-md mx-auto space-y-1.5">
                <div className="flex justify-between text-xs text-text-secondary">
                  <span>Uploading document file</span>
                  <span>{uploadPercent}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-border">
                  <div
                    className="bg-blue-primary h-full transition-all duration-300 rounded-full"
                    style={{ width: `${uploadPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* 7-Step Progress Stepper */}
            <div className="max-w-xl mx-auto">
              <div className="space-y-3">
                {PROGRESS_STEPS.map((stepLabel, idx) => {
                  const stepNumber = idx + 1;
                  const isDone = currentStep > stepNumber || currentStep === 7;
                  const isCurrent = currentStep === stepNumber && currentStep !== 7;
                  const isPending = currentStep < stepNumber;

                  return (
                    <div
                      key={stepLabel}
                      className={clsx(
                        'flex items-center gap-3.5 p-3 rounded-lg border text-xs transition-all',
                        isDone && 'bg-emerald-50/60 border-emerald-200 text-navy',
                        isCurrent && 'bg-blue-light/50 border-blue-primary text-navy font-semibold shadow-xs',
                        isPending && 'bg-slate-50 border-border text-slate-400'
                      )}
                    >
                      <div className="shrink-0 flex items-center justify-center">
                        {isDone ? (
                          <div className="w-5 h-5 rounded-full bg-success text-white flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        ) : isCurrent ? (
                          <div className="w-5 h-5 rounded-full border-2 border-blue-primary text-blue-primary flex items-center justify-center font-bold text-[10px]">
                            <Spinner size="xs" color="#0866C6" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-slate-300 text-slate-400 flex items-center justify-center text-[10px] font-medium">
                            {stepNumber}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 flex items-center justify-between">
                        <span>{stepLabel}</span>
                        {isCurrent && (
                          <span className="text-[10px] text-blue-primary font-normal flex items-center gap-1">
                            <Clock className="w-3 h-3 animate-pulse" /> Running...
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action buttons if stalled or error */}
            <div className="pt-4 border-t border-border flex justify-end gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleReset}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Cancel / Reset
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Guide Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="bg-white border border-border rounded-lg p-4 text-xs space-y-1.5 shadow-subtle">
          <div className="flex items-center gap-2 font-semibold text-navy">
            <FileText className="w-4 h-4 text-blue-primary" />
            <span>Verifiable Citations</span>
          </div>
          <p className="text-text-secondary leading-relaxed">
            Every legal argument, extracted provision, and fact is anchored to exact PDF page numbers and passages.
          </p>
        </div>

        <div className="bg-white border border-border rounded-lg p-4 text-xs space-y-1.5 shadow-subtle">
          <div className="flex items-center gap-2 font-semibold text-navy">
            <Sparkles className="w-4 h-4 text-blue-primary" />
            <span>Statutory Provisions</span>
          </div>
          <p className="text-text-secondary leading-relaxed">
            Identifies legal codes, section numbers, acts cited, and whether the court applied or distinguished them.
          </p>
        </div>

        <div className="bg-white border border-border rounded-lg p-4 text-xs space-y-1.5 shadow-subtle">
          <div className="flex items-center gap-2 font-semibold text-navy">
            <AlertCircle className="w-4 h-4 text-blue-primary" />
            <span>Operative Decision</span>
          </div>
          <p className="text-text-secondary leading-relaxed">
            Isolates the binding holding, court orders, costs awarded, and legal uncertainties identified by the AI.
          </p>
        </div>
      </div>
    </div>
  );
};
