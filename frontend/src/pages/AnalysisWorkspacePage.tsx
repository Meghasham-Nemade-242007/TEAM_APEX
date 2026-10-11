// NOTE: The backend needs to serve the PDF at GET /api/documents/{id}/file
import React, { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Document as PdfDocument, Page as PdfPage, pdfjs } from 'react-pdf';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Send,
  Trash2,
  Copy,
  Check,
  FileText,
  AlertTriangle,
  Scale,
  Users,
  BookOpen,
  HelpCircle,
  Gavel,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { useDocument } from '../hooks/useDocument';
import { useChat } from '../hooks/useChat';
import { documentsAPI } from '../services/api';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { Alert } from '../components/ui/Alert';
import { Modal } from '../components/ui/Modal';
import clsx from 'clsx';

// Configure pdfjs worker for react-pdf
try {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
} catch (e) {
  console.warn('PDF worker setup:', e);
}

const EXAMPLE_QUESTIONS = [
  "What is the core holding and operative decision of the court?",
  "Which statutory provisions and sections were applied in this matter?",
  "What were the primary arguments presented by the petitioner?",
  "What precedents did the bench cite or distinguish?",
  "Are there any legal uncertainties, dissenting notes, or open questions?",
];

const resolveCaseType = (doc?: any, sum?: any): string => {
  const ct = sum?.case_type || doc?.case_category;
  if (ct && ct.toLowerCase() !== 'unknown' && ct.toLowerCase() !== 'unspecified' && ct.toLowerCase() !== 'null') {
    return ct;
  }
  const combined = `${doc?.original_filename || ''} ${sum?.executive_summary || ''}`.toLowerCase();
  if (combined.includes('writ petition') || combined.includes('w.p.')) return 'Writ Petition';
  if (combined.includes('special leave petition') || combined.includes('slp')) return 'Special Leave Petition';
  if (combined.includes('appeal')) return 'Appellate Proceedings';
  if (combined.includes('pil') || combined.includes('public interest')) return 'Public Interest Litigation';
  return 'Civil / Constitutional Matter';
};

const resolveCourtName = (doc?: any, sum?: any): string => {
  const cn = sum?.court_name || doc?.court_name;
  if (cn && cn.toLowerCase() !== 'unknown' && cn.toLowerCase() !== 'competent judicial forum' && cn.toLowerCase() !== 'null') {
    return cn;
  }
  const combined = `${doc?.original_filename || ''} ${sum?.executive_summary || ''}`.toLowerCase();
  if (combined.includes('bombay') || combined.includes('bombay high court')) return 'High Court of Judicature at Bombay';
  if (combined.includes('supreme court')) return 'Supreme Court of India';
  if (combined.includes('delhi')) return 'High Court of Delhi';
  return doc?.court_name || 'High Court of Judicature';
};

export const AnalysisWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { document, summary, loading, error, refetch } = useDocument(id);
  const {
    messages,
    sendMessage,
    isLoading: chatLoading,
    clearConversation,
  } = useChat(id);

  // Layout tabs for tablet/mobile
  const [activeTab, setActiveTab] = useState<'pdf' | 'summary' | 'chat'>('summary');

  // PDF Viewer State
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [pdfScale, setPdfScale] = useState<number>(1.0);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [useNativeViewer, setUseNativeViewer] = useState<boolean>(false);
  const [pageInputValue, setPageInputValue] = useState<string>('1');

  // Chat State
  const [inputQuestion, setInputQuestion] = useState<string>('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Collapsible Sections in Case Summary
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    facts: false,
    procedural: false,
    holdings: false,
    issues: false,
    arguments: false,
    provisions: false,
    precedents: false,
    reasoning: false,
    uncertainties: false,
  });

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Jump to specific PDF page (from citations, source badges, etc.)
  const jumpToPage = (targetPage: number) => {
    if (!targetPage) return;
    const validPage = Math.max(1, Math.min(targetPage, numPages || targetPage));
    setPageNumber(validPage);
    setPageInputValue(String(validPage));

    // If on mobile/tablet, switch view to PDF tab
    if (window.innerWidth < 1280) {
      setActiveTab('pdf');
    }
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  // Handle PDF load
  const onDocumentLoadSuccess = ({ numPages: total }: { numPages: number }) => {
    setNumPages(total);
    setPdfError(null);
  };

  const onDocumentLoadError = (err: Error) => {
    setPdfError(err.message || 'Failed to load PDF file.');
  };

  const handlePrevPage = () => {
    if (pageNumber > 1) {
      const p = pageNumber - 1;
      setPageNumber(p);
      setPageInputValue(String(p));
    }
  };

  const handleNextPage = () => {
    if (numPages && pageNumber < numPages) {
      const p = pageNumber + 1;
      setPageNumber(p);
      setPageInputValue(String(p));
    }
  };

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(pageInputValue, 10);
    if (!isNaN(p) && p >= 1 && (!numPages || p <= numPages)) {
      setPageNumber(p);
    } else {
      setPageInputValue(String(pageNumber));
    }
  };

  const handleSendChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputQuestion.trim() || chatLoading) return;
    const q = inputQuestion;
    setInputQuestion('');
    await sendMessage(q);
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const token = localStorage.getItem('token') || '';
  const pdfUrl = id ? documentsAPI.getFileUrl(id, token) : '';
  const pdfFileConfig = React.useMemo(() => {
    if (!pdfUrl) return null;
    return {
      url: pdfUrl,
      httpHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      withCredentials: false,
    };
  }, [pdfUrl, token]);

  const sanitizedUncertainties = React.useMemo(() => {
    if (!summary?.uncertainties) return [];
    return summary.uncertainties.filter((u) => {
      const lower = u.toLowerCase();
      if (lower.includes('llm returned malformed json')) return false;
      if (lower.includes('expecting value: line')) return false;
      if (lower.includes('traceback')) return false;
      if (lower.includes('fallback:')) return false;
      return true;
    });
  }, [summary?.uncertainties]);

  if (loading && !document) {
    return (
      <div className="h-[calc(100vh-64px)] flex flex-col items-center justify-center p-6 bg-page-bg">
        <Spinner size="xl" color="#0866C6" />
        <h3 className="mt-4 text-sm font-semibold text-navy">Loading Case Workspace</h3>
        <p className="text-xs text-text-secondary mt-1">Retrieving legal document, analysis, and citations...</p>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="p-8 max-w-xl mx-auto mt-12">
        <Alert variant="error" title="Case Record Unavailable">
          {error || 'Document could not be located in the database.'}
        </Alert>
        <div className="mt-4 flex justify-end gap-3">
          <Link to="/">
            <Button variant="secondary" size="sm">Back to Dashboard</Button>
          </Link>
          <Button variant="primary" size="sm" onClick={() => refetch()}>Retry Connection</Button>
        </div>
      </div>
    );
  }

  const currentCaseType = resolveCaseType(document, summary);
  const currentCourtName = resolveCourtName(document, summary);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-page-bg overflow-hidden">
      {/* Top Bar / Meta Ribbon */}
      <div className="bg-white border-b border-border px-4 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/"
            className="p-1.5 text-text-secondary hover:text-navy hover:bg-slate-100 rounded-md transition-colors shrink-0"
            title="Return to Dashboard"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xs md:text-sm font-bold text-navy truncate" title={document.original_filename}>
                {document.original_filename}
              </h1>
              <Badge variant="info" size="sm">{currentCaseType}</Badge>
              {document.status === 'complete' ? (
                <Badge variant="success" size="sm">Analysis Verified</Badge>
              ) : document.status === 'completed_with_warnings' ? (
                <Badge variant="warning" size="sm">Completed with Notices</Badge>
              ) : (
                <Badge variant="warning" size="sm">{document.status_message || document.status}</Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-text-secondary truncate mt-0.5">
              <span>🏛️ {currentCourtName}</span>
              {document.case_number && <span>№ {document.case_number}</span>}
              {document.case_date && <span>📅 {document.case_date}</span>}
            </div>
          </div>
        </div>

        {/* Responsive Tab Bar for screens < 1280px */}
        <div className="flex xl:hidden items-center bg-slate-100 p-0.5 rounded-lg border border-border">
          <button
            onClick={() => setActiveTab('pdf')}
            className={clsx(
              'px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5',
              activeTab === 'pdf' ? 'bg-white text-blue-primary shadow-xs' : 'text-text-secondary hover:text-navy'
            )}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={clsx(
              'px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5',
              activeTab === 'summary' ? 'bg-white text-blue-primary shadow-xs' : 'text-text-secondary hover:text-navy'
            )}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Analysis</span>
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={clsx(
              'px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5',
              activeTab === 'chat' ? 'bg-white text-blue-primary shadow-xs' : 'text-text-secondary hover:text-navy'
            )}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Legal Chat</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-navy hover:bg-slate-100 rounded-md border border-border transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-text-secondary" />
            <span>Download PDF</span>
          </a>
        </div>
      </div>

      {/* Main 3-Panel Workspace Body */}
      <div className="flex-1 flex min-h-0 divide-x divide-border">
        {/* ========================================================= */}
        {/* PANEL 1: LEFT PANEL (30% WIDTH) - PDF VIEWER              */}
        {/* ========================================================= */}
        <div
          className={clsx(
            'flex flex-col bg-slate-100 h-full overflow-hidden transition-all duration-200',
            'xl:w-[30%] xl:flex',
            activeTab === 'pdf' ? 'w-full flex' : 'hidden xl:flex'
          )}
        >
          {/* PDF Toolbar */}
          <div className="bg-white border-b border-border px-3 py-2 flex items-center justify-between gap-2 shrink-0 select-none">
            {/* Page navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevPage}
                disabled={pageNumber <= 1}
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent text-navy"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <form onSubmit={handlePageInputSubmit} className="flex items-center text-xs">
                <input
                  type="text"
                  value={pageInputValue}
                  onChange={(e) => setPageInputValue(e.target.value)}
                  onBlur={handlePageInputSubmit}
                  className="w-10 text-center py-0.5 border border-border rounded font-mono text-xs focus:outline-none focus:border-blue-primary text-navy"
                />
                <span className="text-text-secondary ml-1.5 font-mono">
                  / {numPages || '...'}
                </span>
              </form>

              <button
                onClick={handleNextPage}
                disabled={!!numPages && pageNumber >= numPages}
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent text-navy"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPdfScale((s) => Math.max(0.6, s - 0.15))}
                className="p-1 rounded hover:bg-slate-100 text-text-secondary hover:text-navy"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono text-text-secondary w-9 text-center">
                {Math.round(pdfScale * 100)}%
              </span>
              <button
                onClick={() => setPdfScale((s) => Math.min(2.0, s + 0.15))}
                className="p-1 rounded hover:bg-slate-100 text-text-secondary hover:text-navy"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPdfScale(1.0)}
                className="p-1 rounded hover:bg-slate-100 text-text-secondary hover:text-navy ml-0.5"
                title="Reset Zoom"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <div className="h-4 w-px bg-border mx-1" />
              <button
                onClick={() => setUseNativeViewer(!useNativeViewer)}
                className={clsx(
                  'px-2 py-0.5 text-[10px] font-semibold rounded border transition-colors',
                  useNativeViewer
                    ? 'bg-blue-primary text-white border-blue-primary'
                    : 'bg-slate-50 text-navy hover:bg-slate-100 border-border'
                )}
                title="Toggle between Canvas PDF.js and Native Browser Viewer"
              >
                {useNativeViewer ? 'Browser View' : 'Native Mode'}
              </button>
            </div>
          </div>

          {/* PDF Page Container */}
          <div className="flex-1 overflow-auto p-4 flex justify-center items-start bg-slate-200/70">
            {useNativeViewer ? (
              <div className="w-full h-full bg-white rounded shadow-xs flex flex-col overflow-hidden">
                <div className="bg-slate-100 px-3 py-1.5 border-b border-border flex items-center justify-between text-xs text-text-secondary">
                  <span className="font-medium text-navy text-[11px]">Native Browser PDF Viewer (Full Fidelity)</span>
                  <button
                    onClick={() => setUseNativeViewer(false)}
                    className="text-blue-primary hover:underline text-[11px]"
                  >
                    Switch to Canvas View
                  </button>
                </div>
                <iframe
                  src={`${pdfUrl}#page=${pageNumber}`}
                  title="Document Preview"
                  className="w-full flex-1 border-0"
                />
              </div>
            ) : pdfError ? (
              <div className="p-6 text-center max-w-sm bg-white rounded-lg border border-border shadow-xs my-auto">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <h4 className="text-xs font-semibold text-navy">PDF.js Preview Notice</h4>
                <p className="text-[11px] text-text-secondary mt-1">
                  Canvas engine could not render page. You can switch to the high-performance native browser viewer.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setUseNativeViewer(true)}
                  >
                    Switch to Native Browser Viewer
                  </Button>
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1 text-xs text-blue-primary hover:underline font-medium"
                  >
                    <span>Open direct file URL</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="shadow-lg bg-white rounded transition-transform origin-top">
                <PdfDocument
                  file={pdfFileConfig || pdfUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading={
                    <div className="p-12 text-center flex flex-col items-center">
                      <Spinner size="md" color="#0866C6" />
                      <span className="text-xs text-text-secondary mt-2">Rendering page...</span>
                    </div>
                  }
                  error={
                    <div className="p-6 text-center text-xs text-error max-w-xs space-y-2">
                      <p>Unable to render PDF stream in canvas.</p>
                      <Button variant="secondary" size="sm" onClick={() => setUseNativeViewer(true)}>
                        Use Native Viewer
                      </Button>
                    </div>
                  }
                >
                  <PdfPage
                    pageNumber={pageNumber}
                    scale={pdfScale}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    className="overflow-hidden"
                  />
                </PdfDocument>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* PANEL 2: MIDDLE PANEL (40% WIDTH) - CASE SUMMARY          */}
        {/* ========================================================= */}
        <div
          className={clsx(
            'flex flex-col bg-card-bg h-full overflow-hidden transition-all duration-200',
            'xl:w-[40%] xl:flex',
            activeTab === 'summary' ? 'w-full flex' : 'hidden xl:flex'
          )}
        >
          {/* Summary Panel Header */}
          <div className="px-5 py-3 border-b border-border bg-slate-50/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-blue-primary" />
              <h2 className="text-xs font-bold text-navy uppercase tracking-wider">
                Comprehensive Case Analysis
              </h2>
            </div>
            {summary?.extraction_quality && (
              <Badge variant="info" size="sm">
                Quality: {summary.extraction_quality}
              </Badge>
            )}
          </div>

          {/* Scrollable Summary Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm leading-relaxed">
            {/* If analysis still processing */}
            {document.status === 'processing' || document.status === 'pending' ? (
              <div className="py-12 text-center space-y-4">
                <Spinner size="lg" color="#0866C6" />
                <h3 className="text-sm font-semibold text-navy">Legal Analysis in Progress</h3>
                <p className="text-xs text-text-secondary max-w-sm mx-auto">
                  {document.status_message || 'Extracting background facts, arguments, and statutory precedents...'}
                </p>
                <div className="w-48 bg-slate-200 h-1.5 rounded-full mx-auto overflow-hidden">
                  <div className="bg-blue-primary h-full w-2/3 animate-pulse" />
                </div>
              </div>
            ) : !summary ? (
              <div className="py-12 text-center space-y-3">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                <h3 className="text-sm font-semibold text-navy">Analysis Not Generated</h3>
                <p className="text-xs text-text-secondary max-w-xs mx-auto">
                  The case record does not have a generated legal brief yet.
                </p>
                <Button variant="secondary" size="sm" onClick={() => refetch()}>
                  Refresh Status
                </Button>
              </div>
            ) : (
              <>
                {/* 1. Header Metadata Box */}
                <div className="bg-slate-50 border border-border rounded-lg p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <span className="font-semibold text-navy">
                      {currentCourtName}
                    </span>
                    <span className="font-mono text-slate-500 text-[11px]">
                      {summary.case_date || document.case_date || 'Date Unspecified'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-text-secondary pt-1">
                    <div>
                      <span className="text-slate-400">Case No:</span>{' '}
                      <span className="font-mono text-navy font-medium">
                        {summary.case_number || document.case_number || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Case Type:</span>{' '}
                      <span className="text-navy font-medium">
                        {currentCaseType}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bench Judges & Coram */}
                {summary.bench_judges && summary.bench_judges.length > 0 && (
                  <div className="bg-slate-50/70 border border-border rounded-lg p-3 space-y-1.5 text-xs">
                    <span className="font-bold text-navy text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-blue-primary" />
                      <span>Judicial Bench ({summary.bench_judges.length} Judges)</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {summary.bench_judges.map((judge, ji) => (
                        <span key={ji} className="px-2 py-0.5 bg-white border border-border rounded text-[11px] font-medium text-navy shadow-xs">
                          ⚖️ {judge}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Comprehensive Legal Brief & Executive Summary */}
                {summary.executive_summary && (
                  <div className="bg-gradient-to-b from-blue-50/60 to-white border border-blue-200/90 rounded-lg p-4 space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                      <div className="flex items-center gap-1.5 text-blue-primary text-xs font-bold uppercase tracking-wider">
                        <Sparkles className="w-4 h-4" />
                        <span>Comprehensive Legal Brief & Case Summary</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(summary.executive_summary || '', -1)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-text-secondary hover:text-blue-primary hover:bg-blue-50/80 transition-colors"
                        title="Copy entire legal brief to clipboard"
                      >
                        {copiedIndex === -1 ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-success" />
                            <span className="text-success font-semibold">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Brief</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="text-xs text-slate-800 leading-relaxed font-normal space-y-2">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h3: ({ node, ...props }) => (
                            <h3 className="text-xs font-bold text-navy uppercase tracking-wider mt-3 mb-1.5 pb-1 border-b border-blue-100/70 flex items-center gap-1.5 first:mt-0" {...props} />
                          ),
                          h4: ({ node, ...props }) => (
                            <h4 className="text-xs font-semibold text-slate-900 mt-2 mb-1" {...props} />
                          ),
                          p: ({ node, ...props }) => (
                            <p className="text-xs text-slate-800 leading-relaxed my-1.5 whitespace-pre-line" {...props} />
                          ),
                          ul: ({ node, ...props }) => (
                            <ul className="list-disc pl-4 space-y-1 my-1.5 text-slate-800" {...props} />
                          ),
                          ol: ({ node, ...props }) => (
                            <ol className="list-decimal pl-4 space-y-1 my-1.5 text-slate-800" {...props} />
                          ),
                          li: ({ node, ...props }) => (
                            <li className="text-xs leading-relaxed" {...props} />
                          ),
                          strong: ({ node, ...props }) => (
                            <strong className="font-semibold text-navy" {...props} />
                          ),
                        }}
                      >
                        {summary.executive_summary}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* 3. Operative Decision (Prominent Box with Green Border) */}
                {summary.operative_decision && summary.operative_decision.toLowerCase() !== 'unknown' && summary.operative_decision.toLowerCase() !== 'null' ? (
                  <div className="bg-emerald-50/60 border-2 border-emerald-500 rounded-lg p-4 space-y-2 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-success text-xs font-bold uppercase tracking-wider">
                        <Gavel className="w-4 h-4" />
                        <span>Operative Decision & Final Order</span>
                      </div>
                      {summary.decision_sources && summary.decision_sources.length > 0 && (
                        <div className="flex items-center gap-1">
                          {summary.decision_sources.map((s, i) => (
                            <button
                              key={i}
                              onClick={() => jumpToPage(s.page_num)}
                              className="px-1.5 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-success rounded text-[10px] font-mono font-bold transition-colors"
                              title={s.passage}
                            >
                              p.{s.page_num}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-emerald-950 font-medium leading-relaxed">
                      {summary.operative_decision}
                    </p>
                    {summary.directions_conditions && summary.directions_conditions.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-emerald-200 text-xs text-emerald-900 space-y-1">
                        <span className="font-semibold text-[11px] uppercase tracking-wider text-emerald-800">Directives & Conditions:</span>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                          {summary.directions_conditions.map((d, di) => (
                            <li key={di}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-amber-50/80 border border-amber-300 rounded-lg p-3.5 space-y-1.5 text-xs text-amber-900 shadow-xs">
                    <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-amber-800 text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Operative Decree Guidance</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      The concluding paragraph does not contain standard operative decree formula keywords. Please examine concluding pages directly in the document viewer.
                    </p>
                  </div>
                )}

                {/* 4. Parties to the Matter */}
                {summary.parties && summary.parties.length > 0 && (
                  <div className="border border-border rounded-lg overflow-hidden bg-white">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-border flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-navy">
                        <Users className="w-4 h-4 text-blue-primary" />
                        <span>Parties to the Proceedings</span>
                      </div>
                      <Badge variant="default" size="sm">{summary.parties.length} Parties</Badge>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/80 text-[11px] font-semibold text-text-secondary uppercase border-b border-border">
                          <tr>
                            <th className="py-2 px-3">Party Name</th>
                            <th className="py-2 px-3">Role</th>
                            <th className="py-2 px-3">Advocate / Representative</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {summary.parties.map((p, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3 font-medium text-navy">{p.name}</td>
                              <td className="py-2 px-3 text-text-secondary">
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-slate-100 font-medium text-slate-700">
                                  {p.role}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-text-secondary italic">
                                {p.represented_by || 'Appeared in person / Unspecified'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Procedural History & Prior Proceedings (Collapsible) */}
                {summary.procedural_history && summary.procedural_history.length > 0 && (
                  <div className="border border-border rounded-lg overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => toggleSection('procedural')}
                      className="w-full px-4 py-2.5 bg-slate-50 flex items-center justify-between text-left hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-navy">
                        <FileText className="w-4 h-4 text-blue-primary" />
                        <span>Procedural History & Prior Proceedings ({summary.procedural_history.length})</span>
                      </div>
                      {collapsedSections.procedural ? (
                        <ChevronDown className="w-4 h-4 text-text-secondary" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-text-secondary" />
                      )}
                    </button>

                    {!collapsedSections.procedural && (
                      <div className="p-4 space-y-2">
                        <ul className="space-y-2 list-none">
                          {summary.procedural_history.map((step, idx) => (
                            <li key={idx} className="flex items-start gap-2.5 text-xs text-navy">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mt-1.5 shrink-0" />
                              <span className="flex-1 leading-relaxed">{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Background Facts (Collapsible) */}
                {summary.background_facts && summary.background_facts.length > 0 && (
                  <div className="border border-border rounded-lg overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => toggleSection('facts')}
                      className="w-full px-4 py-2.5 bg-slate-50 flex items-center justify-between text-left hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-navy">
                        <BookOpen className="w-4 h-4 text-blue-primary" />
                        <span>Background Facts & Material History ({summary.background_facts.length})</span>
                      </div>
                      {collapsedSections.facts ? (
                        <ChevronDown className="w-4 h-4 text-text-secondary" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-text-secondary" />
                      )}
                    </button>

                    {!collapsedSections.facts && (
                      <div className="p-4 space-y-2.5">
                        <ul className="space-y-2 list-none">
                          {summary.background_facts.map((fact, idx) => {
                            const source = summary.background_sources?.[idx];
                            return (
                              <li key={idx} className="flex items-start gap-2.5 text-xs text-navy">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-primary mt-1.5 shrink-0" />
                                <span className="flex-1 leading-relaxed">{fact}</span>
                                {source && (
                                  <button
                                    onClick={() => jumpToPage(source.page_num)}
                                    className="px-1.5 py-0.5 bg-blue-light hover:bg-blue-100 text-blue-primary rounded text-[10px] font-mono font-semibold shrink-0 transition-colors"
                                    title={source.passage}
                                  >
                                    p.{source.page_num}
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* 6. Legal Issues Framed (Collapsible) */}
                {summary.legal_issues && summary.legal_issues.length > 0 && (
                  <div className="border border-border rounded-lg overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => toggleSection('issues')}
                      className="w-full px-4 py-2.5 bg-slate-50 flex items-center justify-between text-left hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-navy">
                        <HelpCircle className="w-4 h-4 text-blue-primary" />
                        <span>Issues for Consideration ({summary.legal_issues.length})</span>
                      </div>
                      {collapsedSections.issues ? (
                        <ChevronDown className="w-4 h-4 text-text-secondary" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-text-secondary" />
                      )}
                    </button>

                    {!collapsedSections.issues && (
                      <div className="p-4 space-y-2">
                        <ol className="space-y-2.5 list-decimal list-inside text-xs text-navy">
                          {summary.legal_issues.map((issue, idx) => (
                            <li key={idx} className="leading-relaxed pl-1">
                              <span className="font-medium text-navy">{issue}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                )}

                {/* 7. Submissions & Arguments: Petitioner vs Respondent */}
                {((summary.petitioner_arguments && summary.petitioner_arguments.length > 0) ||
                  (summary.respondent_arguments && summary.respondent_arguments.length > 0)) && (
                  <div className="border border-border rounded-lg overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => toggleSection('arguments')}
                      className="w-full px-4 py-2.5 bg-slate-50 flex items-center justify-between text-left hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-navy">
                        <Scale className="w-4 h-4 text-blue-primary" />
                        <span>Rival Submissions: Petitioner vs Respondent</span>
                      </div>
                      {collapsedSections.arguments ? (
                        <ChevronDown className="w-4 h-4 text-text-secondary" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-text-secondary" />
                      )}
                    </button>

                    {!collapsedSections.arguments && (
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Petitioner Column */}
                        <div className="bg-slate-50/70 border border-slate-200 rounded-lg p-3 space-y-2">
                          <h4 className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-border">
                            <span className="w-2 h-2 rounded-full bg-blue-primary" />
                            Petitioner / Appellant
                          </h4>
                          <ul className="space-y-2 text-xs text-navy">
                            {summary.petitioner_arguments.map((arg, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-blue-primary font-mono text-[10px] font-bold mt-0.5">
                                  {idx + 1}.
                                </span>
                                <span className="leading-relaxed">{arg}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Respondent Column */}
                        <div className="bg-slate-50/70 border border-slate-200 rounded-lg p-3 space-y-2">
                          <h4 className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-border">
                            <span className="w-2 h-2 rounded-full bg-slate-600" />
                            Respondent / State
                          </h4>
                          <ul className="space-y-2 text-xs text-navy">
                            {summary.respondent_arguments.map((arg, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-slate-600 font-mono text-[10px] font-bold mt-0.5">
                                  {idx + 1}.
                                </span>
                                <span className="leading-relaxed">{arg}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 8. Statutory Legal Provisions */}
                {summary.legal_provisions && summary.legal_provisions.length > 0 && (
                  <div className="border border-border rounded-lg overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => toggleSection('provisions')}
                      className="w-full px-4 py-2.5 bg-slate-50 flex items-center justify-between text-left hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-navy">
                        <FileText className="w-4 h-4 text-blue-primary" />
                        <span>Statutory Provisions Cited ({summary.legal_provisions.length})</span>
                      </div>
                      {collapsedSections.provisions ? (
                        <ChevronDown className="w-4 h-4 text-text-secondary" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-text-secondary" />
                      )}
                    </button>

                    {!collapsedSections.provisions && (
                      <div className="p-4 space-y-2.5">
                        {summary.legal_provisions.map((prov, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg border border-border bg-slate-50/50 flex flex-col gap-1.5"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-xs font-bold text-navy">
                                {prov.act_name} - {prov.section}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {prov.applied ? (
                                  <Badge variant="success" size="sm">Applied by Bench</Badge>
                                ) : (
                                  <Badge variant="default" size="sm">Mentioned / Distinguished</Badge>
                                )}
                                {prov.sources && prov.sources.map((s, si) => (
                                  <button
                                    key={si}
                                    onClick={() => jumpToPage(s.page_num)}
                                    className="px-1.5 py-0.5 bg-blue-light hover:bg-blue-100 text-blue-primary rounded text-[10px] font-mono font-bold transition-colors"
                                    title={s.passage}
                                  >
                                    p.{s.page_num}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {prov.description && (
                              <p className="text-[11px] text-text-secondary leading-relaxed">
                                {prov.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 9. Cited Precedents */}
                {summary.cited_precedents && summary.cited_precedents.length > 0 && (
                  <div className="border border-border rounded-lg overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => toggleSection('precedents')}
                      className="w-full px-4 py-2.5 bg-slate-50 flex items-center justify-between text-left hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-navy">
                        <BookOpen className="w-4 h-4 text-blue-primary" />
                        <span>Judicial Precedents & Case Laws ({summary.cited_precedents.length})</span>
                      </div>
                      {collapsedSections.precedents ? (
                        <ChevronDown className="w-4 h-4 text-text-secondary" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-text-secondary" />
                      )}
                    </button>

                    {!collapsedSections.precedents && (
                      <div className="p-4 space-y-2.5">
                        {summary.cited_precedents.map((prec, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg border border-border bg-slate-50/50 flex flex-col gap-1.5"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-xs font-bold text-navy">{prec.case_name}</span>
                              <div className="flex items-center gap-1.5">
                                <Badge variant="info" size="sm">{prec.how_cited}</Badge>
                                {prec.sources && prec.sources.map((s, si) => (
                                  <button
                                    key={si}
                                    onClick={() => jumpToPage(s.page_num)}
                                    className="px-1.5 py-0.5 bg-blue-light hover:bg-blue-100 text-blue-primary rounded text-[10px] font-mono font-bold transition-colors"
                                    title={s.passage}
                                  >
                                    p.{s.page_num}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-text-secondary">
                              {prec.citation && <span>Citation: {prec.citation}</span>}
                              {prec.court && <span>Court: {prec.court}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 10. Court Reasoning (Collapsible) */}
                {summary.court_reasoning && summary.court_reasoning.length > 0 && (
                  <div className="border border-border rounded-lg overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => toggleSection('reasoning')}
                      className="w-full px-4 py-2.5 bg-slate-50 flex items-center justify-between text-left hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-navy">
                        <Scale className="w-4 h-4 text-blue-primary" />
                        <span>Court's Reasoning & Ratio Decidendi ({summary.court_reasoning.length})</span>
                      </div>
                      {collapsedSections.reasoning ? (
                        <ChevronDown className="w-4 h-4 text-text-secondary" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-text-secondary" />
                      )}
                    </button>

                    {!collapsedSections.reasoning && (
                      <div className="p-4 space-y-2.5">
                        <ul className="space-y-2 list-none">
                          {summary.court_reasoning.map((reason, idx) => {
                            const source = summary.reasoning_sources?.[idx];
                            return (
                              <li key={idx} className="flex items-start gap-2.5 text-xs text-navy">
                                <span className="w-1.5 h-1.5 rounded-full bg-navy mt-1.5 shrink-0" />
                                <span className="flex-1 leading-relaxed">{reason}</span>
                                {source && (
                                  <button
                                    onClick={() => jumpToPage(source.page_num)}
                                    className="px-1.5 py-0.5 bg-blue-light hover:bg-blue-100 text-blue-primary rounded text-[10px] font-mono font-semibold shrink-0 transition-colors"
                                    title={source.passage}
                                  >
                                    p.{source.page_num}
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Court Findings & Definitive Holdings (Collapsible) */}
                {summary.findings_and_holdings && summary.findings_and_holdings.length > 0 && (
                  <div className="border border-border rounded-lg overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => toggleSection('holdings')}
                      className="w-full px-4 py-2.5 bg-slate-50 flex items-center justify-between text-left hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-navy">
                        <Scale className="w-4 h-4 text-blue-primary" />
                        <span>Court Findings & Legal Holdings ({summary.findings_and_holdings.length})</span>
                      </div>
                      {collapsedSections.holdings ? (
                        <ChevronDown className="w-4 h-4 text-text-secondary" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-text-secondary" />
                      )}
                    </button>

                    {!collapsedSections.holdings && (
                      <div className="p-4 space-y-2">
                        <ul className="space-y-2 list-none">
                          {summary.findings_and_holdings.map((holding, idx) => (
                            <li key={idx} className="flex items-start gap-2.5 text-xs text-navy">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                              <span className="flex-1 leading-relaxed font-medium">{holding}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* 11. Uncertainties (Yellow Warning Box) */}
                {sanitizedUncertainties.length > 0 && (
                  <div className="bg-amber-50/70 border border-amber-300 rounded-lg p-4 space-y-2 shadow-xs">
                    <div className="flex items-center gap-2 text-warning text-xs font-bold uppercase tracking-wider">
                      <ShieldAlert className="w-4 h-4" />
                      <span>Legal Ambiguities & Open Queries</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-amber-950">
                      {sanitizedUncertainties.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-warning font-bold">•</span>
                          <span className="leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* PANEL 3: RIGHT PANEL (30% WIDTH) - LEGAL CHAT             */}
        {/* ========================================================= */}
        <div
          className={clsx(
            'flex flex-col bg-white h-full overflow-hidden transition-all duration-200',
            'xl:w-[30%] xl:flex',
            activeTab === 'chat' ? 'w-full flex' : 'hidden xl:flex'
          )}
        >
          {/* Chat Panel Header */}
          <div className="px-4 py-3 border-b border-border bg-slate-50/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="w-4 h-4 text-blue-primary shrink-0" />
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-navy truncate">
                  AI Legal Assistant
                </h3>
                <p className="text-[10px] text-text-secondary truncate">
                  Ask questions regarding this case
                </p>
              </div>
            </div>

            {messages.length > 0 && (
              <button
                onClick={() => setIsClearModalOpen(true)}
                className="p-1.5 text-text-secondary hover:text-error hover:bg-red-50 rounded transition-colors"
                title="Clear conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Example Questions Chips */}
          <div className="p-3 border-b border-border bg-slate-50/40 shrink-0">
            <p className="text-[10px] uppercase font-semibold tracking-wider text-text-secondary mb-1.5">
              Suggested Legal Inquiries
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {EXAMPLE_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(q)}
                  disabled={chatLoading}
                  className="text-left text-[11px] bg-white hover:bg-blue-light/60 hover:text-blue-primary text-navy border border-border rounded-full px-2.5 py-1 transition-colors leading-tight disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/20">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-text-secondary">
                <Scale className="w-8 h-8 text-slate-300 mb-2" />
                <h4 className="text-xs font-semibold text-navy">Legal Assistant Standby</h4>
                <p className="text-[11px] text-text-secondary max-w-xs mt-1">
                  Query the judgment text, extract party submissions, or verify legal precedents. Every reply includes grounded page citations.
                </p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id || index}
                    className={clsx('flex flex-col', isUser ? 'items-end' : 'items-start')}
                  >
                    <div
                      className={clsx(
                        'max-w-[92%] rounded-xl p-3 text-xs shadow-xs relative group',
                        isUser
                          ? 'bg-navy text-white rounded-br-none'
                          : 'bg-white border border-border text-navy rounded-bl-none'
                      )}
                    >
                      {/* Message Content */}
                      {isUser ? (
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      ) : (
                        <div className="prose prose-xs max-w-none prose-navy leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>

                          {/* Citations badges */}
                          {msg.citations && msg.citations.length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-border flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">
                                Sources:
                              </span>
                              {msg.citations.map((c, cIdx) => (
                                <button
                                  key={cIdx}
                                  onClick={() => jumpToPage(c.page_num)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-light hover:bg-blue-100 text-blue-primary text-[10px] font-mono font-bold transition-colors"
                                  title={c.passage || c.text}
                                >
                                  <span>p.{c.page_num}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Copy button on assistant messages */}
                      {!isUser && (
                        <button
                          onClick={() => handleCopy(msg.content, index)}
                          className="absolute top-2 right-2 p-1 text-slate-400 hover:text-navy opacity-0 group-hover:opacity-100 transition-opacity rounded bg-white/90 border border-border shadow-xs"
                          title="Copy answer"
                        >
                          {copiedIndex === index ? (
                            <Check className="w-3 h-3 text-success" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Chat Loading Animation (3 animated dots) */}
            {chatLoading && (
              <div className="flex items-center gap-1.5 p-3 rounded-lg bg-white border border-border w-24">
                <div className="w-2 h-2 rounded-full bg-blue-primary animate-bounce [animation-delay:-0.3s]" />
                <div className="w-2 h-2 rounded-full bg-blue-primary animate-bounce [animation-delay:-0.15s]" />
                <div className="w-2 h-2 rounded-full bg-blue-primary animate-bounce" />
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Chat Input Box */}
          <div className="p-3 border-t border-border bg-white shrink-0">
            <form onSubmit={handleSendChat} className="relative">
              <textarea
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
                placeholder="Ask about this case (Enter to send, Shift+Enter for newline)..."
                rows={2}
                disabled={chatLoading}
                className="w-full text-xs p-2.5 pr-10 border border-border rounded-lg text-navy placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-primary resize-none disabled:bg-slate-50"
              />
              <button
                type="submit"
                disabled={!inputQuestion.trim() || chatLoading}
                className="absolute right-2.5 bottom-3.5 p-1.5 rounded-md bg-blue-primary text-white hover:bg-[#0759af] disabled:opacity-40 disabled:hover:bg-blue-primary transition-colors"
                title="Send Question"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Clearing Chat */}
      <Modal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        title="Clear Conversation History"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIsClearModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                clearConversation();
                setIsClearModalOpen(false);
              }}
            >
              Clear History
            </Button>
          </>
        }
      >
        <p className="text-xs text-text-secondary">
          Are you sure you want to clear this legal dialogue? The conversational context will be reset.
        </p>
      </Modal>
    </div>
  );
};
