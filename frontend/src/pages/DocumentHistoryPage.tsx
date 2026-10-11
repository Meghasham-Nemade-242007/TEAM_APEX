import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Trash2,
  ExternalLink,
  FileText,
  Calendar,
  Layers,
  RefreshCw,
  FolderOpen,
  FilePlus,
  AlertCircle,
} from 'lucide-react';
import { documentsAPI } from '../services/api';
import { Document } from '../types';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import { Alert } from '../components/ui/Alert';

export const DocumentHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [docToDelete, setDocToDelete] = useState<Document | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await documentsAPI.list();
      setDocuments(Array.isArray(res.data) ? res.data : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch document history';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleDelete = async () => {
    if (!docToDelete) return;
    setDeleting(true);
    try {
      await documentsAPI.delete(docToDelete.id);
      setDocuments((prev) => prev.filter((d) => d.id !== docToDelete.id));
      setDocToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete legal record';
      alert(msg);
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (status: Document['status']) => {
    switch (status) {
      case 'complete':
        return <Badge variant="success">Complete</Badge>;
      case 'processing':
        return <Badge variant="info">Processing</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'failed':
        return <Badge variant="error">Failed</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      return new Date(isoStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  const filteredDocs = documents.filter((doc) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      doc.original_filename.toLowerCase().includes(q) ||
      (doc.case_number && doc.case_number.toLowerCase().includes(q)) ||
      (doc.court_name && doc.court_name.toLowerCase().includes(q));

    const matchesStatus =
      statusFilter === 'all' || doc.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Title & Top Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy tracking-tight">Document Repository & History</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Complete registry of uploaded court briefs, petitions, and judicial precedents.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => navigate('/new-analysis')}
          leftIcon={<FilePlus className="w-4 h-4" />}
        >
          New Analysis
        </Button>
      </div>

      {error && (
        <Alert variant="error" title="Repository Access Error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-border shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by filename, court, case number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-border rounded-md text-navy placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-primary focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-border rounded-md px-3 py-1.5 text-navy focus:outline-none focus:ring-2 focus:ring-blue-primary"
          >
            <option value="all">All Statuses</option>
            <option value="complete">Complete</option>
            <option value="processing">Processing</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>

          <Button
            variant="secondary"
            size="sm"
            onClick={fetchDocuments}
            isLoading={loading}
            title="Refresh repository"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white border border-border rounded-xl shadow-subtle overflow-hidden">
        {loading && documents.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center">
            <Spinner size="lg" color="#0866C6" />
            <p className="mt-3 text-xs text-text-secondary">Retrieving records from repository...</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-16 text-center">
            <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-navy">No Documents Found</h3>
            <p className="text-xs text-text-secondary max-w-sm mx-auto mt-1 mb-4">
              {searchTerm || statusFilter !== 'all'
                ? 'No legal documents match your active filter criteria.'
                : 'Your repository is currently empty. Upload your first PDF to begin.'}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/new-analysis')}
                leftIcon={<FilePlus className="w-4 h-4" />}
              >
                Upload Document
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-border text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Court / Forum</th>
                  <th className="py-3 px-4">Case Number</th>
                  <th className="py-3 px-4">Date Uploaded</th>
                  <th className="py-3 px-4 text-center">Pages</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Filename */}
                    <td className="py-3.5 px-4 font-medium text-navy max-w-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded bg-blue-light text-blue-primary flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <Link
                            to={`/documents/${doc.id}`}
                            className="font-semibold text-navy hover:text-blue-primary transition-colors truncate block"
                            title={doc.original_filename}
                          >
                            {doc.original_filename}
                          </Link>
                          {doc.case_category && (
                            <span className="text-[10px] text-text-secondary block">
                              {doc.case_category}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Court */}
                    <td className="py-3.5 px-4 text-text-main max-w-xs truncate">
                      {doc.court_name || <span className="text-slate-400 italic">Not detected</span>}
                    </td>

                    {/* Case Number */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-text-secondary">
                      {doc.case_number || <span className="text-slate-400 italic">—</span>}
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 text-text-secondary whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatDate(doc.uploaded_at)}</span>
                      </div>
                    </td>

                    {/* Pages */}
                    <td className="py-3.5 px-4 text-center text-text-secondary whitespace-nowrap">
                      {doc.page_count !== null ? (
                        <span className="inline-flex items-center gap-1">
                          <Layers className="w-3 h-3 text-slate-400" />
                          <span>{doc.page_count}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getStatusBadge(doc.status)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/documents/${doc.id}`}>
                          <Button variant="secondary" size="sm" rightIcon={<ExternalLink className="w-3 h-3" />}>
                            Open
                          </Button>
                        </Link>
                        <button
                          onClick={() => setDocToDelete(doc)}
                          className="p-1.5 text-text-secondary hover:text-error hover:bg-red-50 rounded transition-colors"
                          title="Delete Document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!docToDelete}
        onClose={() => setDocToDelete(null)}
        title="Delete Legal Document"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDocToDelete(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
              isLoading={deleting}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Permanently Delete
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-xs text-text-main">
            Are you sure you want to permanently delete the document{' '}
            <strong className="text-navy">{docToDelete?.original_filename}</strong>?
          </p>
          <p className="text-[11px] text-text-secondary">
            This will remove all extracted legal arguments, generated summaries, citations, and conversation history. This action cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  );
};
