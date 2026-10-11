import { useState, useEffect, useCallback, useRef } from 'react';
import { Document, CaseAnalysis } from '../types';
import { documentsAPI } from '../services/api';

export interface UseDocumentReturn {
  document: Document | null;
  summary: CaseAnalysis | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useDocument = (documentId?: string): UseDocumentReturn => {
  const [document, setDocument] = useState<Document | null>(null);
  const [summary, setSummary] = useState<CaseAnalysis | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  const fetchDocAndSummary = useCallback(async () => {
    if (!documentId) return;
    try {
      setError(null);
      const docRes = await documentsAPI.get(documentId);
      setDocument(docRes.data);

      if (docRes.data.status === 'complete' || docRes.data.has_summary) {
        try {
          const sumRes = await documentsAPI.getSummary(documentId);
          setSummary(sumRes.data);
        } catch {
          // Summary might not be available yet
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to fetch document';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (!documentId) return;

    setLoading(true);
    fetchDocAndSummary();

    return () => {
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current);
      }
    };
  }, [documentId, fetchDocAndSummary]);

  // Polling logic for status
  useEffect(() => {
    if (!documentId || !document) return;

    if (document.status === 'pending' || document.status === 'processing') {
      pollTimerRef.current = window.setTimeout(async () => {
        try {
          const statusRes = await documentsAPI.getStatus(documentId);
          setDocument((prev) =>
            prev
              ? {
                  ...prev,
                  status: statusRes.data.status,
                  status_message: statusRes.data.status_message,
                  progress_step: statusRes.data.progress_step,
                }
              : null
          );

          if (statusRes.data.status === 'complete') {
            const sumRes = await documentsAPI.getSummary(documentId);
            setSummary(sumRes.data);
          }
        } catch {
          // Ignore polling errors momentarily
        }
      }, 2000);
    }

    return () => {
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current);
      }
    };
  }, [documentId, document]);

  const refetch = useCallback(async () => {
    setLoading(true);
    await fetchDocAndSummary();
  }, [fetchDocAndSummary]);

  return { document, summary, loading, error, refetch };
};
