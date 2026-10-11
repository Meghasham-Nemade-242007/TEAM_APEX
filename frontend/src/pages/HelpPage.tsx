import React, { useState } from 'react';
import {
  HelpCircle,
  FileCheck,
  Search,
  MessageSquare,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Mail,
  Scale,
} from 'lucide-react';
import { Card } from '../components/ui/Card';

export const HelpPage: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does the legal document analysis pipeline work?',
      a: 'When you upload a legal document (judgment, petition, contract, or affidavit), our pipeline executes a multi-stage process: optical character recognition and structure layout parsing, statutory provision identification, case law precedent mapping, argument clustering (petitioner vs. respondent), and binding holding determination.',
    },
    {
      q: 'How are source citations verified?',
      a: 'Every extracted factual proposition, statutory reference, and court ratio is indexed with exact page numbers and verbatim passage extracts. Clicking any "p.X" badge in the analysis panel or chat interface instantly navigates the PDF viewer to that exact page.',
    },
    {
      q: 'What types of legal documents are best supported?',
      a: 'The system is optimized for Indian Supreme Court, High Court, and Tribunal judgments, writ petitions, special leave petitions, statutory appeals, commercial contracts, and arbitral awards.',
    },
    {
      q: 'Can the chatbot make mistakes or hallucinate?',
      a: 'Our prompt architecture strictly constrains the AI model to reason solely from the ingested document corpus and statutory citations. Any ambiguous or missing information is explicitly highlighted in the "Uncertainties" section.',
    },
  ];

  const exampleQuestions = [
    {
      category: 'Operative Orders',
      query: 'What was the specific relief or decree granted by the court in the final order?',
    },
    {
      category: 'Statutory Sections',
      query: 'Which specific sections of the Indian Penal Code or relevant Act were interpreted or applied?',
    },
    {
      category: 'Procedural History',
      query: 'What was the decision of the lower court or appellate tribunal prior to this judgment?',
    },
    {
      category: 'Submissions',
      query: 'What was the core contention raised by senior counsel for the appellant?',
    },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy tracking-tight">Help Center & User Guide</h1>
        <p className="text-xs text-text-secondary mt-0.5">
          Documentation, query guidelines, and support resources for the legal intelligence platform.
        </p>
      </div>

      {/* 1. Getting Started Guide */}
      <Card title="Quick Start Guide" subtitle="Four simple steps to full judicial analysis">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-3.5 bg-slate-50 border border-border rounded-lg space-y-2">
            <div className="w-8 h-8 rounded-full bg-blue-light text-blue-primary font-bold flex items-center justify-center text-xs">
              1
            </div>
            <h4 className="text-xs font-semibold text-navy">Upload Document</h4>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              Navigate to "New Analysis" and drag in any judgment or court order PDF (up to 50 MB).
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-border rounded-lg space-y-2">
            <div className="w-8 h-8 rounded-full bg-blue-light text-blue-primary font-bold flex items-center justify-center text-xs">
              2
            </div>
            <h4 className="text-xs font-semibold text-navy">Automated Pipeline</h4>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              Watch real-time extraction of facts, legal issues, precedents, and ratio decidendi.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-border rounded-lg space-y-2">
            <div className="w-8 h-8 rounded-full bg-blue-light text-blue-primary font-bold flex items-center justify-center text-xs">
              3
            </div>
            <h4 className="text-xs font-semibold text-navy">Interactive Workspace</h4>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              Review side-by-side: original PDF, structured legal brief, and instant page jumps.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-border rounded-lg space-y-2">
            <div className="w-8 h-8 rounded-full bg-blue-light text-blue-primary font-bold flex items-center justify-center text-xs">
              4
            </div>
            <h4 className="text-xs font-semibold text-navy">Inquire via AI Chat</h4>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              Pose complex legal inquiries to the assistant with verified source page citations.
            </p>
          </div>
        </div>
      </Card>

      {/* 2. Example Questions */}
      <Card title="Effective Legal Prompts & Questions">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {exampleQuestions.map((ex, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg border border-border bg-slate-50/50 space-y-1"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-primary">
                {ex.category}
              </span>
              <p className="text-xs text-navy font-medium leading-relaxed">
                "{ex.query}"
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* 3. Frequently Asked Questions */}
      <Card title="Frequently Asked Questions (FAQ)">
        <div className="divide-y divide-border">
          {faqs.map((faq, idx) => (
            <div key={idx} className="py-3">
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full flex items-center justify-between text-left gap-3 text-xs font-semibold text-navy hover:text-blue-primary transition-colors"
              >
                <span>{faq.q}</span>
                {openFaq === idx ? (
                  <ChevronUp className="w-4 h-4 text-text-secondary shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-text-secondary shrink-0" />
                )}
              </button>
              {openFaq === idx && (
                <p className="mt-2 text-xs text-text-secondary leading-relaxed">
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* 4. Legal Disclaimer */}
      <div className="p-4 bg-amber-50/60 border border-amber-300 rounded-lg flex items-start gap-3 text-xs text-amber-950">
        <ShieldAlert className="w-5 h-5 text-warning shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold text-xs uppercase tracking-wider text-warning">
            Judicial & Statutory Disclaimer
          </h4>
          <p className="text-[11px] leading-relaxed">
            The Legal Document Analysis System provides automated decision-support and legal document synthesis. It is designed to assist qualified legal practitioners, researchers, and judicial officers. It does not constitute formal legal advice or substitute for human legal analysis of official gazette and certified court copies.
          </p>
        </div>
      </div>

      {/* 5. Support Contact */}
      <Card title="Technical Support & Inquiries">
        <div className="flex items-center gap-3 text-xs text-text-secondary">
          <Mail className="w-4 h-4 text-navy" />
          <span>For technical issues or integration inquiries, contact: <a href="mailto:support@legal.local" className="text-blue-primary font-medium hover:underline">support@legal.local</a></span>
        </div>
      </Card>
    </div>
  );
};
