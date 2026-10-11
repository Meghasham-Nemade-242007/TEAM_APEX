import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FilePlus,
  Search,
  FileText,
  Calendar,
  Layers,
  ArrowRight,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { documentsAPI } from '../services/api';
import { Document } from '../types';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { Alert } from '../components/ui/Alert';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await Promise.race([
        documentsAPI.list(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Network timeout')), 3000)),
      ]);
      setDocuments(Array.isArray(res.data) ? res.data : []);
    } catch (err: unknown) {
      // Don't show hard error for empty repository on initial connection
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const getStatusBadge = (status: Document['status']) => {
    switch (status) {
      case 'complete':
        return <Badge variant="success">Analyzed</Badge>;
      case 'processing':
        return <Badge variant="info">Processing</Badge>;
      case 'pending':
        return <Badge variant="warning">Queued</Badge>;
      case 'failed':
        return <Badge variant="error">Failed</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-US', {
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
    return (
      doc.original_filename.toLowerCase().includes(q) ||
      (doc.case_number && doc.case_number.toLowerCase().includes(q)) ||
      (doc.court_name && doc.court_name.toLowerCase().includes(q))
    );
  });

  const recentDocs = filteredDocs.slice(0, 5);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-navy to-navy-dark rounded-xl p-6 md:p-8 text-white shadow-md border border-navy-dark flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold tracking-wider bg-blue-primary/40 text-blue-200 uppercase mb-2 border border-blue-400/20">
            Judicial Analysis Suite
          </span>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            Welcome back, {user?.full_name || 'Counsel'}
          </h1>
          <p className="mt-1 text-slate-300 text-xs md:text-sm max-w-xl">
            Upload judgments, petitions, and legal records for verifiable AI analysis, statutory provision extraction, and interactive source citations.
          </p>
        </div>

        <div className="flex shrink-0">
          <Button
            size="lg"
            variant="primary"
            onClick={() => navigate('/new-analysis')}
            leftIcon={<FilePlus className="w-5 h-5" />}
            className="shadow-lg shadow-blue-primary/30"
          >
            New Document Analysis
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="error" title="Error Connecting to Legal Document Repository">
          {error}
        </Alert>
      )}

      {/* Main Workspace Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-navy tracking-tight">Recent Analyses</h2>
            <p className="text-xs text-text-secondary">
              Recently uploaded court cases and analysis records
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Bar */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by title, case #..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-border rounded-md text-navy placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-primary"
              />
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={loadDocuments}
              isLoading={loading}
              title="Refresh list"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Loading state */}
        {loading && documents.length === 0 ? (
          <div className="bg-card-bg rounded-xl border border-border p-12 text-center flex flex-col items-center justify-center">
            <Spinner size="lg" color="#0866C6" />
            <p className="mt-3 text-xs text-text-secondary">Loading legal document repository...</p>
          </div>
        ) : recentDocs.length === 0 ? (
          /* Empty State */
          <Card className="text-center py-12 px-4 border-dashed border-2">
            <div className="w-14 h-14 bg-blue-light text-blue-primary rounded-full flex items-center justify-center mx-auto mb-3">
              <FolderOpen className="w-7 h-7" />
            </div>
            <h3 className="text-base font-semibold text-navy">No Legal Documents Found</h3>
            <p className="text-xs text-text-secondary max-w-md mx-auto mt-1 mb-5">
              {searchTerm
                ? `No documents match "${searchTerm}". Try a different search query.`
                : 'Upload your first judgment or court order PDF to start automated legal extraction, citation verification, and AI-assisted cross-examination.'}
            </p>
            <Button
              variant="primary"
              onClick={() => navigate('/new-analysis')}
              leftIcon={<FilePlus className="w-4 h-4" />}
            >
              Upload Document Now
            </Button>
          </Card>
        ) : (
          /* Recent Documents Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentDocs.map((doc) => (
              <div
                key={doc.id}
                className="bg-card-bg border border-border rounded-xl p-5 shadow-xs hover:shadow-card-hover hover:border-blue-primary/40 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-light text-blue-primary flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    {getStatusBadge(doc.status)}
                  </div>

                  <h3
                    className="text-sm font-semibold text-navy line-clamp-2 group-hover:text-blue-primary transition-colors mb-2"
                    title={doc.original_filename}
                  >
                    {doc.original_filename}
                  </h3>

                  <div className="space-y-1.5 text-xs text-text-secondary mb-4">
                    {doc.court_name && (
                      <div className="truncate text-navy font-medium">
                        🏛️ {doc.court_name}
                      </div>
                    )}
                    {doc.case_number && (
                      <div className="truncate font-mono text-[11px] text-slate-500">
                        № {doc.case_number}
                      </div>
                    )}
                    <div className="flex items-center gap-3 pt-1 text-[11px]">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(doc.uploaded_at)}
                      </span>
                      {doc.page_count !== null && (
                        <span className="flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5" />
                          {doc.page_count} pages
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-[11px] text-text-secondary truncate max-w-[140px]">
                    {doc.status_message || (doc.status === 'complete' ? 'Ready for review' : doc.status)}
                  </span>
                  <Link
                    to={`/documents/${doc.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-primary hover:text-navy transition-colors"
                  >
                    <span>Open Case</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {documents.length > 5 && (
          <div className="pt-2 flex justify-center">
            <Link to="/history">
              <Button variant="secondary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                View All {documents.length} Documents in History
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
