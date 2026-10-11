# Legal Document Analysis System - Hackathon Demonstration Script

> **Challenge**: Streamlining Court Document Review and Organization  
> **Target Audience**: Hackathon Judges, Legal Tech Evaluators, Senior Judicial Clerks  
> **Estimated Duration**: 5 - 7 minutes

---

## 1. Executive Opening (1 Minute)

### Presenter Talking Points:
> "Good morning, judges. Indian courts process millions of pages of complex legal judgments annually. For judges, research clerks, and litigators, distilling a 50-page judgment into core facts, competitor submissions, cited precedents, and the precise operative holding takes hours of tedious manual review.
>
> Generic AI chatbots fail because:
> 1. They hallucinate non-existent statutory sections or precedents.
> 2. They mistake a discussion of an earlier overturned precedent for the current court's decision.
> 3. They lack verifiable, page-level attribution.
>
> Today, we present the **Legal Document Analysis System**: a specialized, context-aware judicial portal that provides hybrid retrieval, structured extraction, party-role separation, and evidence-grounded conversational intelligence with instant PDF page navigation."

---

## 2. Live Demo Workflow (4 Minutes)

### Step 1: Launch & Dashboard Overview (30s)
1. Open the portal at `http://localhost:5173`.
2. **Highlight Design**:
   - Government-inspired judicial color palette (Navy `#15385B`, Dark Navy `#0B2545`, Accessible Blue `#0866C6`).
   - Clean, trustworthy UI designed for prolonged judicial reading.
   - Live metrics calculated purely from the database — no artificial numbers.

### Step 2: Uploading a Legal Judgment (45s)
1. Click **"New Analysis"** in the sidebar.
2. Drag-and-drop an Indian court judgment PDF (e.g., Supreme Court or High Court ruling).
3. Point out security controls:
   - Client & server MIME type validation (`application/pdf`).
   - Magic bytes verification (`%PDF` header inspection).
   - Document size validation (50 MB limit).
4. Click **"Analyze Document"**.
5. **Show Live Progress Stepper**:
   - Step 1: Uploading document
   - Step 2: Extracting text (PyMuPDF per-page extraction + scanned OCR fallback)
   - Step 3: Identifying pages and structure
   - Step 4: Analyzing legal content (Gemini extraction with legal-aware prompt)
   - Step 5: Preparing searchable passages (Legal chunking + FAISS & BM25 indexing)
   - Step 6: Generating case summary
   - Step 7: Analysis complete

### Step 3: The 3-Panel Analysis Workspace (90s)
Once processing completes, the portal navigates automatically into the **3-Panel Workspace**:

1. **Left Panel: In-Browser Document Viewer**
   - High-fidelity PDF rendering powered by PDF.js / `react-pdf`.
   - Page navigation, zoom in/out, and direct page jumping.
2. **Middle Panel: Comprehensive Case Summary**
   - **Executive Summary & Operative Holding**: Highlight the green operative decision card. Emphasize that the system specifically isolates the *current* judgment's operative decree from historical precedents quoted in the text.
   - **Party-Role Separation**: Distinctly shows Petitioner/Appellant, Respondent, and Advocates.
   - **Statutory Provisions**: Shows whether each law was merely *mentioned* or *actually applied*.
   - **Cited Precedents**: Highlights whether earlier cases were *relied upon*, *distinguished*, or *overruled*.
   - **Evidence Badges (`p.X`)**: Click any page badge (e.g., `p.14`), and demonstrate that the Left Panel PDF viewer **instantly jumps** to that page!
3. **Right Panel: Grounded Conversational Legal Assistant**
   - Ask standard questions from the example chips:
     - *"What is the main legal issue in this case?"*
     - *"What were the arguments presented by the petitioner?"*
     - *"What was the final operative decision?"*
   - Point out that every AI response includes:
     - Clear, plain-English synthesis while preserving legal rigor.
     - Clickable page citation tags (`[Page 12]`, `[Page 27]`).
     - Clicking a chat citation badge jumps the PDF viewer to that exact passage.

### Step 4: Testing Legal Reliability & Hallucination Resistance (45s)
Demonstrate how the system handles tricky adversarial scenarios:

1. **Question Outside Document**:
   - Query: *"What is the weather in New Delhi today?"*
   - **Expected Result**: System responds honestly: *"This information is not found in the uploaded document"*, rather than fabricating an answer.
2. **Statutory Hallucination Test**:
   - Query: *"Does this judgment discuss the Prevention of Money Laundering Act (PMLA)?"*
   - If not in the judgment, the system explicitly confirms absence.

---

## 3. Technical Differentiators (1 Minute)

| Feature | How We Solved It |
|---|---|
| **Hybrid RAG** | Combines **FAISS dense embeddings** (semantic understanding) with **BM25 sparse tokens** (exact Indian statute citations like *Section 138 NI Act*), fused via Reciprocal Rank Fusion (RRF). |
| **Evidence Traceability** | Every claim is linked to an exact PDF page and paragraph anchor. |
| **Current vs. Precedent Separation** | System prompts explicitly instruct the LLM to differentiate between quoted precedents and the bench's own holding. |
| **Document Isolation** | Vector indexes and database queries strictly filter by `document_id`. No cross-case leakage. |
| **Zero-Config Hackathon Mode** | Automatic demo identity generation and SQLite persistence means the app works out-of-the-box. |

---

## 4. Closing & Judge Q&A Prep

### Expected Judge Questions & Answers:

**Q: "Can this handle scanned judgments from district courts?"**  
*A: "Yes. Our document extraction pipeline detects pages with low character counts (<50 chars) and automatically invokes OCR via PyMuPDF/Tesseract pixmap rendering."*

**Q: "How does the system ensure sensitive case documents remain confidential?"**  
*A: "Documents are stored using secure UUID filenames in non-public directories. Access is enforced at the database level with document ownership checks, returning 404s to unauthorized callers to prevent enumeration."*

**Q: "Why hybrid retrieval instead of just vector search?"**  
*A: "In Indian legal judgments, queries often rely on exact statutory terms (e.g., 'Section 482 CrPC' or 'Order 39 Rule 1 CPC'). Vector embeddings frequently cluster general procedural concepts together, whereas BM25 ensures exact-match recall for specific section numbers."*
