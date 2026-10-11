export interface User {
  id: string;
  email: string;
  full_name: string;
}

export type DocumentStatus =
  | 'pending'
  | 'uploaded'
  | 'extracting'
  | 'analyzing'
  | 'processing'
  | 'complete'
  | 'completed'
  | 'completed_with_warnings'
  | 'failed';

export interface Document {
  id: string;
  original_filename: string;
  file_size: number;
  page_count: number | null;
  status: DocumentStatus;
  status_message: string;
  progress_step: number;
  case_category: string | null;
  court_name: string | null;
  case_number: string | null;
  case_date: string | null;
  has_summary: boolean;
  uploaded_at: string;
}

export interface Party {
  name: string;
  role: string;
  represented_by: string | null;
}

export interface SourceReference {
  page_num: number;
  passage: string;
  confidence: number;
}

export interface LegalProvision {
  act_name: string;
  section: string;
  description: string | null;
  sources: SourceReference[];
  applied: boolean;
}

export interface CitedPrecedent {
  case_name: string;
  citation: string | null;
  court: string | null;
  how_cited: string;
  sources: SourceReference[];
}

export interface CaseAnalysis {
  court_name?: string | null;
  bench_judges?: string[];
  case_number?: string | null;
  case_date?: string | null;
  case_type?: string | null;
  case_type_confidence?: number;
  document_type?: string | null;
  parties?: Party[];
  counsel_details?: string[];
  background_facts?: string[];
  background_sources?: SourceReference[];
  procedural_history?: string[];
  legal_issues?: string[];
  petitioner_arguments?: string[];
  respondent_arguments?: string[];
  legal_provisions?: LegalProvision[];
  cited_precedents?: CitedPrecedent[];
  court_reasoning?: string[];
  reasoning_sources?: SourceReference[];
  findings_and_holdings?: string[];
  operative_decision?: string | null;
  directions_conditions?: string[];
  decision_sources?: SourceReference[];
  executive_summary?: string | null;
  legal_ambiguities?: string[];
  uncertainties?: string[];
  missing_information?: string[];
  extraction_quality?: 'verified' | 'good' | 'partial' | 'insufficient' | string;
}

export interface Citation {
  text: string;
  page_num: number;
  passage: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  created_at: string;
}

export interface ChatResponse {
  answer: string;
  reasoning: string;
  citations: Citation[];
  uncertainty: string;
  conversation_id: string;
}

export interface UploadProgress {
  step: number;
  message: string;
  total: number;
}
