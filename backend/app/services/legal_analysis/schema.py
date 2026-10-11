"""
Comprehensive Legal Analysis Schema with typed fields, missing-state handling,
and metadata harmonization.
"""
from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class SourceReference(BaseModel):
    page_num: int
    passage: str
    confidence: float = 1.0


class Party(BaseModel):
    name: str
    role: str = "mentioned"  # petitioner|respondent|appellant|judge|advocate|witness|mentioned
    represented_by: Optional[str] = None


class LegalProvision(BaseModel):
    act_name: str
    section: str
    description: Optional[str] = None
    applied: bool = False  # True only if court actually applied it to decide
    sources: List[SourceReference] = []


class CitedPrecedent(BaseModel):
    case_name: str
    citation: Optional[str] = None
    court: Optional[str] = None
    how_cited: str = "mentioned"  # relied upon|distinguished|overruled|mentioned
    sources: List[SourceReference] = []


class CaseAnalysis(BaseModel):
    court_name: Optional[str] = None
    bench_judges: List[str] = Field(default_factory=list)
    case_number: Optional[str] = None
    case_type: Optional[str] = None
    case_type_confidence: float = 0.0
    case_date: Optional[str] = None
    document_type: Optional[str] = None  # judgment|order|petition|notice|unknown
    parties: List[Party] = Field(default_factory=list)
    counsel_details: List[str] = Field(default_factory=list)
    background_facts: List[str] = Field(default_factory=list)
    background_sources: List[SourceReference] = Field(default_factory=list)
    procedural_history: List[str] = Field(default_factory=list)
    legal_issues: List[str] = Field(default_factory=list)
    petitioner_arguments: List[str] = Field(default_factory=list)
    respondent_arguments: List[str] = Field(default_factory=list)
    legal_provisions: List[LegalProvision] = Field(default_factory=list)
    cited_precedents: List[CitedPrecedent] = Field(default_factory=list)
    court_reasoning: List[str] = Field(default_factory=list)
    reasoning_sources: List[SourceReference] = Field(default_factory=list)
    findings_and_holdings: List[str] = Field(default_factory=list)
    operative_decision: Optional[str] = None
    directions_conditions: List[str] = Field(default_factory=list)
    decision_sources: List[SourceReference] = Field(default_factory=list)
    executive_summary: Optional[str] = None
    legal_ambiguities: List[str] = Field(default_factory=list)
    uncertainties: List[str] = Field(default_factory=list)
    missing_information: List[str] = Field(default_factory=list)
    extraction_quality: str = "good"  # verified|good|partial|insufficient

    class Config:
        extra = "ignore"

    def harmonize(self, document_text: str = ""):
        """
        Harmonizes metadata across fields to eliminate inconsistent 'unknown' labels.
        Infers case_type, court_name, and document_type from case number and context text.
        """
        search_blob = f"{self.case_number or ''} {document_text[:3000]}".lower()

        # 1. Harmonize Case Type
        if not self.case_type or self.case_type.strip().lower() in ["unknown", "none", "null", "not specified", ""]:
            if "writ petition" in search_blob or "w.p." in search_blob or "w.p(" in search_blob or "wp no" in search_blob:
                if "criminal" in search_blob or "crl" in search_blob:
                    self.case_type = "Writ Petition (Criminal)"
                else:
                    self.case_type = "Writ Petition (Civil)"
                self.case_type_confidence = 0.95
            elif "special leave petition" in search_blob or "s.l.p." in search_blob or "slp" in search_blob:
                self.case_type = "Special Leave Petition"
                self.case_type_confidence = 0.95
            elif "criminal appeal" in search_blob or "crl.a" in search_blob or "crl appeal" in search_blob:
                self.case_type = "Criminal Appeal"
                self.case_type_confidence = 0.95
            elif "civil appeal" in search_blob or "c.a." in search_blob:
                self.case_type = "Civil Appeal"
                self.case_type_confidence = 0.95
            elif "public interest litigation" in search_blob or "pil" in search_blob:
                self.case_type = "Public Interest Litigation"
                self.case_type_confidence = 0.95
            elif "arbitration petition" in search_blob or "arb.p" in search_blob:
                self.case_type = "Arbitration Petition"
                self.case_type_confidence = 0.95
            elif "contempt petition" in search_blob or "con.p" in search_blob:
                self.case_type = "Contempt Petition"
                self.case_type_confidence = 0.95
            elif "notice of motion" in search_blob:
                self.case_type = "Notice of Motion"
                self.case_type_confidence = 0.90
            elif "interim application" in search_blob or "i.a." in search_blob:
                self.case_type = "Interim Application"
                self.case_type_confidence = 0.90
            else:
                self.case_type = "Civil / Criminal Matter"
                self.case_type_confidence = 0.50

        # 2. Harmonize Court Name
        if not self.court_name or self.court_name.strip().lower() in ["unknown", "none", "null", "not specified", ""]:
            if "bombay" in search_blob or "bombay" in document_text[-2500:].lower():
                self.court_name = "High Court of Judicature at Bombay"
            elif "supreme court" in search_blob:
                self.court_name = "Supreme Court of India"
            elif "delhi" in search_blob:
                self.court_name = "High Court of Delhi"
            elif "calcutta" in search_blob:
                self.court_name = "High Court of Calcutta"
            elif "madras" in search_blob:
                self.court_name = "High Court of Madras"

        # 3. Harmonize Document Type
        if not self.document_type or self.document_type.strip().lower() in ["unknown", "none", ""]:
            if "order" in search_blob and "judgment" not in search_blob[:800]:
                self.document_type = "Court Order"
            else:
                self.document_type = "Judgment"

        # 4. Normalize operative_decision text if placeholder
        if self.operative_decision and self.operative_decision.strip().lower() in ["unknown", "none", "null"]:
            self.operative_decision = "Unable to determine from the available text"

    @property
    def quality_rating(self) -> str:
        has_decision = bool(self.operative_decision and "unable to determine" not in self.operative_decision.lower())
        has_metadata = bool(self.court_name and self.case_number)
        has_reasoning = bool(len(self.court_reasoning) > 0 or len(self.background_facts) > 0)

        if has_decision and has_metadata and has_reasoning:
            return "verified"
        elif has_metadata and (has_decision or has_reasoning):
            return "good"
        elif has_metadata or has_decision:
            return "partial"
        return "insufficient"

    def ensure_comprehensive_summary(self) -> str:
        """
        Ensures executive_summary is rich, structured, and informative.
        If existing summary is short (< 150 words) or missing, builds a multi-section
        structured legal brief combining extracted factual, legal, and operative fields.
        """
        curr = (self.executive_summary or "").strip()
        word_count = len(curr.split())

        # If already an extensive summary with markdown headings or 180+ words, keep it
        if word_count >= 180 and ("###" in curr or "##" in curr or "\n\n" in curr):
            return curr

        # Build comprehensive multi-section legal brief
        sections = []

        # 1. Overview & Nature of Proceedings
        court_str = self.court_name or "Competent Judicial Forum"
        case_no_str = self.case_number or "Unnumbered Matter"
        case_type_str = self.case_type or "Legal Proceedings"
        date_str = f" on {self.case_date}" if self.case_date else ""
        bench_str = f" before Hon'ble Bench comprising {', '.join(self.bench_judges)}" if self.bench_judges else ""

        p_names = [p.name for p in self.parties if p.role in ["petitioner", "appellant"]]
        r_names = [p.name for p in self.parties if p.role in ["respondent", "state", "defendant"]]
        parties_str = ""
        if p_names and r_names:
            parties_str = f" instituted by **{', '.join(p_names[:2])}** against **{', '.join(r_names[:2])}**"
        elif p_names:
            parties_str = f" instituted by **{', '.join(p_names[:2])}**"

        ov_text = f"This matter involves **{case_type_str}** (Case No. **{case_no_str}**) adjudicated by the **{court_str}**{bench_str}{date_str}{parties_str}."
        if curr and word_count > 10:
            ov_text += f" {curr}"
        sections.append(f"### 1. Case Overview & Nature of Proceedings\n{ov_text}")

        # 2. Factual Matrix & Background Dispute
        if self.background_facts:
            facts_md = "\n".join(f"- {f.strip()}" for f in self.background_facts)
            sections.append(f"### 2. Factual Matrix & Genesis of Dispute\n{facts_md}")
        elif self.procedural_history:
            proc_md = "\n".join(f"- {p.strip()}" for p in self.procedural_history)
            sections.append(f"### 2. Factual Matrix & Procedural History\n{proc_md}")

        # 3. Points for Determination / Legal Issues
        if self.legal_issues:
            issues_md = "\n".join(f"{idx+1}. {issue.strip()}" for idx, issue in enumerate(self.legal_issues))
            sections.append(f"### 3. Key Issues Framed for Determination\n{issues_md}")

        # 4. Rival Submissions & Contentions
        if self.petitioner_arguments or self.respondent_arguments:
            args_parts = []
            if self.petitioner_arguments:
                p_args = "\n".join(f"  - {arg.strip()}" for arg in self.petitioner_arguments)
                args_parts.append(f"- **Petitioner's Submissions**:\n{p_args}")
            if self.respondent_arguments:
                r_args = "\n".join(f"  - {arg.strip()}" for arg in self.respondent_arguments)
                args_parts.append(f"- **Respondent's Submissions**:\n{r_args}")
            sections.append(f"### 4. Submissions & Rival Contentions\n" + "\n".join(args_parts))

        # 5. Judicial Reasoning & Statutory Precedents
        reasoning_parts = []
        if self.court_reasoning:
            reasoning_parts.extend(f"- {r.strip()}" for r in self.court_reasoning)
        if self.findings_and_holdings:
            reasoning_parts.extend(f"- **Holding**: {h.strip()}" for h in self.findings_and_holdings)
        if self.legal_provisions:
            applied_provs = [f"{p.act_name} §{p.section}" for p in self.legal_provisions if p.applied]
            if applied_provs:
                reasoning_parts.append(f"- **Statutory Provisions Applied**: {', '.join(applied_provs)}")
        if self.cited_precedents:
            relied_cases = [c.case_name for c in self.cited_precedents if c.how_cited in ["relied upon", "followed"]]
            if relied_cases:
                reasoning_parts.append(f"- **Precedents Relied Upon**: {', '.join(relied_cases[:3])}")

        if reasoning_parts:
            sections.append(f"### 5. Judicial Reasoning & Ratio Decidendi\n" + "\n".join(reasoning_parts))

        # 6. Operative Decision & Directives
        if self.operative_decision and "unable to determine" not in self.operative_decision.lower():
            op_md = f"**Final Order**: {self.operative_decision.strip()}"
            if self.directions_conditions:
                dirs = "\n".join(f"- {d.strip()}" for d in self.directions_conditions)
                op_md += f"\n\n**Specific Directives & Conditions**:\n{dirs}"
            sections.append(f"### 6. Operative Decision & Final Order\n{op_md}")

        combined = "\n\n".join(sections)
        self.executive_summary = combined
        return combined


# Type Aliases for backward compatibility and test consistency
ComprehensiveCaseAnalysis = CaseAnalysis
DecisionSource = SourceReference
