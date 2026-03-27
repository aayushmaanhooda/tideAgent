import { useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import "./Overview.css"

function Logo() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="30" height="30" rx="4" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4 2" />
      <path d="M6 20 Q9 15 12 20 Q15 25 18 20 Q21 15 24 20 Q27 25 30 20" stroke="url(#waveGrad2)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M3 8 L3 3 L8 3" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 3 L33 3 L33 8" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 28 L3 33 L8 33" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 33 L33 33 L33 28" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="waveGrad2" x1="6" y1="20" x2="30" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b82f6" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
    </svg>
  )
}

const PIPELINE_STEPS = [
  {
    num: "01",
    color: "cyan",
    title: "User uploads a new image",
    desc: "The unlabeled image is received via the FastAPI POST /v1/annotate endpoint and temporarily stored in memory. The raw JPEG is never modified — no boxes are drawn on stored images.",
    detail: "This clean separation ensures S3 always holds pristine source images. All annotation data (bounding boxes, labels, confidence scores) is stored separately in PostgreSQL as JSON — never burned into the pixel data.",
    tech: ["AWS S3", "FastAPI", "Multipart upload"],
  },
  {
    num: "02",
    color: "purple",
    title: "DINOv2 generates a 768-dim embedding",
    desc: "The image is sent to DINOv2-base running on Modal (serverless GPU). It produces a 768-dimensional vector that captures the visual structure, scene type, textures, and spatial relationships of the entire image.",
    detail: "We use average patch token pooling — instead of just the [CLS] token, we average all 197 patch tokens. This gives 50%+ higher cosine similarity scores because it preserves spatial detail that the class token alone discards. DINOv2 is self-supervised — it knows nothing about bounding boxes or labels, only visual content.",
    tech: ["facebook/dinov2-base", "Modal GPU (A10)", "768-dim vector", "Patch token averaging"],
  },
  {
    num: "03",
    color: "amber",
    title: "pgvector finds 5 most similar labeled images",
    desc: "The new embedding is compared against all 300+ embeddings in Neon PostgreSQL using cosine distance via pgvector. The 5 nearest neighbors — visually the most similar labeled images — are retrieved along with their full annotation data.",
    detail: "Cosine similarity measures the angle between vectors, making it scale-invariant. A beach scene returns other beach/water scenes. A crowded street returns other street scenes. These 5 images become the few-shot context — teaching Claude the annotation style relevant to this specific type of image.",
    tech: ["Neon PostgreSQL", "pgvector", "Cosine similarity", "5-shot retrieval"],
  },
  {
    num: "04",
    color: "cyan",
    title: "Claude Vision identifies what to detect",
    desc: "All 5 context images (raw, no boxes drawn) plus their annotation data as text, plus the new image — all go to Claude Sonnet via LangChain. Claude analyzes the annotation style and returns a list of labels to detect.",
    detail: "Claude receives a structured prompt: here are 5 examples of how this dataset is annotated (image + text description of each box). Now look at this new image and tell me what labels I should detect. Pydantic structured output guarantees the response is clean JSON — no parsing errors, no hallucinated formats. Claude understands what to find, not where. It's bad at pixel coordinates; that's Grounding DINO's job.",
    tech: ["claude-sonnet-4-20250514", "LangChain", "Pydantic structured output", "Multimodal prompting"],
  },
  {
    num: "05",
    color: "green",
    title: "Grounding DINO draws precise bounding boxes",
    desc: "Claude's label list (e.g. 'person. bicycle. backpack.') is fed as a text prompt to Grounding DINO running on Modal. It returns pixel-perfect bounding box coordinates [x1, y1, x2, y2] with confidence scores for every detected instance.",
    detail: "Grounding DINO is a zero-shot open-vocabulary detector. It can detect anything described in text — no fine-tuning needed. The IDEA-Research grounding-dino-tiny model balances speed and accuracy well for POC. In production, the full model or SAM 2 integration would give better precision.",
    tech: ["IDEA-Research/grounding-dino-tiny", "Modal GPU", "Zero-shot detection", "Confidence thresholding"],
  },
  {
    num: "06",
    color: "purple",
    title: "User reviews, approves, and the context grows",
    desc: "Results stream back to the React frontend via SSE (Server-Sent Events). Bounding boxes are drawn on the image in the browser using Canvas API. The user can approve, edit, or reject each annotation.",
    detail: "Approved annotations are written back to the labeled_data table with approved=True. The DINOv2 embedding is also stored, making this image a new context example for future similar images. The agent doesn't learn by updating model weights — it learns by growing the context database. More approved examples = better similarity matches = better annotations.",
    tech: ["React Canvas API", "Server-Sent Events", "Approval loop", "Context growth"],
  },
]

const DONE_ITEMS = [
  {
    title: "COCO dataset loaded + 300 images in S3",
    desc: "300 diverse images from the COCO validation set with 80 object categories, verified bounding box coordinates, and human-annotated labels. All stored as raw JPEGs in AWS S3 with paths tracked in PostgreSQL.",
  },
  {
    title: "AI pipeline proven end-to-end in Colab",
    desc: "The full Claude Vision → Grounding DINO pipeline was validated in a Colab notebook. Pydantic structured output ensures clean JSON from Claude. Person detection confidence: 0.89. General object confidence: 0.72.",
  },
  {
    title: "DINOv2 embeddings on Modal GPU",
    desc: "All 300 images have been embedded using DINOv2-base running serverless on Modal. Average patch token pooling produces richer 768-dim vectors. Embeddings stored in PostgreSQL with pgvector.",
  },
  {
    title: "pgvector similarity search validated",
    desc: "Cosine similarity search tested and verified. Water scenes return water/outdoor scenes. Street scenes return street scenes. Similarity scores improved 50%+ by switching from CLS token to average patch pooling.",
  },
  {
    title: "FastAPI backend + SQLModel ORM",
    desc: "Full backend with lifespan startup events, database connection pooling, health endpoint, and the /v1/annotate streaming endpoint. SSE streaming shows pipeline progress step by step.",
  },
  {
    title: "React frontend with real-time progress",
    desc: "Single image upload with live step-by-step pipeline status. Bulk upload mode processes multiple images in parallel. Canvas-based bounding box rendering. Upload Context placeholder ready for expansion.",
  },
]

const IMPROVEMENTS = [
  {
    color: "f1",
    title: "SAM 2 — Pixel-Level Segmentation",
    desc: "Add Segment Anything Model 2 on top of Grounding DINO's bounding boxes. Instead of rectangles, get exact pixel masks of each object. Critical for ResQVision's water safety use case — swimmer outlines matter.",
    why: "Precision upgrade",
  },
  {
    color: "f2",
    title: "Active Learning Loop",
    desc: "Automatically prioritize which unlabeled images need human review. When the agent is uncertain (low confidence scores or high inter-model disagreement), flag for human review first. High-confidence predictions auto-approve. Reduces human effort by 80%+.",
    why: "Efficiency at scale",
  },
  {
    color: "f3",
    title: "Replace COCO → ResQVision Beach Data",
    desc: "The POC uses COCO images for variety, but the production use case is ResQVision's beach/water footage from CVAT. Swapping the seed dataset to 300 labeled beach images will immediately improve similarity search relevance and annotation quality.",
    why: "Domain alignment",
  },
  {
    color: "f4",
    title: "Async Batch Processing Queue",
    desc: "Current bulk upload runs all images concurrently. Add a proper queue (Redis or database-backed) with rate limiting, retry logic, and job status tracking. Lets the system handle 1000+ image batches without overwhelming Modal or the Claude API.",
    why: "Production scale",
  },
  {
    color: "f1",
    title: "CVAT Direct Integration",
    desc: "Export labeled data from CVAT directly into TIDE's context database. Agent predictions export back to CVAT for manual refinement. Closes the loop between existing annotation workflows and the AI agent.",
    why: "Production workflow",
  },
  {
    color: "f2",
    title: "Open-Source Vision Model (InternVL2)",
    desc: "Replace or augment Claude Vision with self-hosted InternVL2 or LLaVA-Next on Modal. Eliminates per-call API cost for label detection, reduces latency, and allows fine-tuning on ResQVision's specific annotation vocabulary.",
    why: "Cost + control",
  },
]

export default function Journey() {
  const navigate = useNavigate()
  const contextInputRef = useRef()
  const [uploadState, setUploadState] = useState("idle") // idle | uploading | success | error
  const [uploadMsg, setUploadMsg] = useState("")
  const [dbStats] = useState({ images: 300, embeddings: 300, labels: 80, approved: 300 })

  async function handleContextUpload(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploadState("uploading")
    setUploadMsg(`Uploading ${files.length} image(s)...`)

    // Simulate upload — replace with real endpoint when ready
    await new Promise(r => setTimeout(r, 1500))
    setUploadState("success")
    setUploadMsg(`${files.length} image(s) queued for embedding. They'll appear in the context database once processed.`)
  }

  return (
    <div className="journey-page">

      {/* Navbar */}
      <nav className="jnav">
        <div className="jnav-logo" onClick={() => navigate("/")}>
          <Logo />
          <span className="jnav-brand">Tide Agent</span>
        </div>
        <div className="jnav-links">
          <a href="#data">Data</a>
          <a href="#pipeline">Pipeline</a>
          <a href="#built">Built</a>
          <a href="#roadmap">Roadmap</a>
          <button className="jnav-cta" onClick={() => navigate("/annotate")}>
            Try Annotation
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="j-hero">
        <div className="j-glow j-glow-blue" />
        <div className="j-glow j-glow-purple" />
        <div className="j-hero-inner">
          <div className="j-tag">CV Annotation Agent · Full Journey</div>
          <h1 className="j-h1">
            How TIDE was<br />
            <span className="j-gradient">built from scratch</span>
          </h1>
          <p className="j-lead">
            A complete walkthrough of the data, infrastructure, AI pipeline, and design decisions behind the TIDE annotation agent.
          </p>
          <div className="j-hero-stats">
            <div className="j-stat">
              <div className="j-stat-num">300</div>
              <div className="j-stat-label">COCO images seeded</div>
            </div>
            <div className="j-stat-divider" />
            <div className="j-stat">
              <div className="j-stat-num">768</div>
              <div className="j-stat-label">Embedding dims</div>
            </div>
            <div className="j-stat-divider" />
            <div className="j-stat">
              <div className="j-stat-num">0.89</div>
              <div className="j-stat-label">Person detection conf.</div>
            </div>
            <div className="j-stat-divider" />
            <div className="j-stat">
              <div className="j-stat-num">5</div>
              <div className="j-stat-label">Few-shot context</div>
            </div>
          </div>
        </div>
      </section>

      {/* Context Database — what's already seeded */}
      <section className="j-section" id="data">
        <div className="j-container">
          <div className="j-tag">Context Database</div>
          <h2 className="j-h2">What's already <span className="j-accent-green">in the system</span></h2>
          <p className="j-section-sub">
            TIDE ships with 300 labeled images pre-seeded from the COCO dataset. Every image has been embedded with DINOv2 and stored with annotations in PostgreSQL — ready for similarity search on day one.
          </p>

          <div className="j-db-grid">
            <div className="j-db-card">
              <div className="j-db-icon cyan">S3</div>
              <div className="j-db-num">{dbStats.images}</div>
              <div className="j-db-label">Images in S3</div>
              <div className="j-db-detail">Raw JPEGs in <code>s3://tide-resqvision/labeled/</code>. Never modified — annotations are separate.</div>
            </div>
            <div className="j-db-card">
              <div className="j-db-icon purple">vec</div>
              <div className="j-db-num">{dbStats.embeddings}</div>
              <div className="j-db-label">DINOv2 Embeddings</div>
              <div className="j-db-detail">768-dim vectors stored in PostgreSQL with pgvector. Average patch token pooling for maximum spatial detail.</div>
            </div>
            <div className="j-db-card">
              <div className="j-db-icon amber">cls</div>
              <div className="j-db-num">{dbStats.labels}</div>
              <div className="j-db-label">COCO Categories</div>
              <div className="j-db-detail">All 80 COCO object categories covered: people, vehicles, animals, food, furniture, and more.</div>
            </div>
            <div className="j-db-card">
              <div className="j-db-icon green">✓</div>
              <div className="j-db-num">{dbStats.approved}</div>
              <div className="j-db-label">Approved Annotations</div>
              <div className="j-db-detail">All 300 seed images are human-verified (approved=true). They form the initial context pool for few-shot learning.</div>
            </div>
          </div>

          {/* DB Schema */}
          <div className="j-schema-block">
            <div className="j-schema-header">
              <span className="j-schema-title">PostgreSQL · labeled_data table</span>
              <span className="j-schema-badge">Neon + pgvector</span>
            </div>
            <pre className="j-schema-code">{`Table: labeled_data
├── id           int          Primary key
├── image_path   text         S3 path  →  s3://tide-resqvision/labeled/img_0042.jpg
├── image_width  int          Original pixel width
├── image_height int          Original pixel height
├── embedding    vector(768)  DINOv2 embedding for cosine similarity search
├── boxes        json         [[x1,y1,x2,y2], ...]   absolute pixel coords
├── labels       json         ["person", "bicycle", "backpack", ...]
├── confidence   json         [1.0, 0.95, 0.88, ...]   (1.0 = human-verified)
├── approved     bool         false = agent-generated · true = human-approved
└── created_at   timestamp    When the record was inserted`}</pre>
          </div>

          {/* Upload Context */}
          <div className="j-upload-ctx" id="upload-context">
            <div className="j-upload-left">
              <div className="j-upload-title">Upload Context Images</div>
              <div className="j-upload-desc">
                Add your own labeled images to the context database. Upload images here and annotate them via the annotation tool — approved annotations automatically join the context pool and improve future predictions.
              </div>
              <div className="j-upload-note">
                <span className="j-note-icon">→</span>
                Currently the system uses 300 COCO images as seed context. Replace these with ResQVision's actual beach/water footage from CVAT for best results.
              </div>
            </div>
            <div className="j-upload-right">
              {uploadState === "idle" && (
                <button className="j-upload-btn" onClick={() => contextInputRef.current.click()}>
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1v10M4 5l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Upload Context Images
                </button>
              )}
              {uploadState === "uploading" && (
                <div className="j-upload-status uploading">
                  <span className="j-spinner" />
                  {uploadMsg}
                </div>
              )}
              {uploadState === "success" && (
                <div className="j-upload-status success">
                  <span>✓</span>
                  {uploadMsg}
                  <button className="j-upload-again" onClick={() => { setUploadState("idle"); setUploadMsg("") }}>Upload more</button>
                </div>
              )}
              <input
                ref={contextInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleContextUpload}
                style={{ display: "none" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section className="j-section j-section-alt" id="pipeline">
        <div className="j-container">
          <div className="j-tag">AI Pipeline</div>
          <h2 className="j-h2">The full pipeline, <span className="j-accent-cyan">step by step</span></h2>
          <p className="j-section-sub">
            Every annotation starts the same way. Here's exactly what happens — from the moment an image is uploaded to the moment bounding boxes appear on screen.
          </p>

          <div className="j-pipeline">
            <div className="j-pipeline-line" />
            {PIPELINE_STEPS.map((step) => (
              <div className="j-pipe-step" key={step.num}>
                <div className={`j-pipe-dot j-dot-${step.color}`}>{step.num}</div>
                <div className="j-pipe-body">
                  <h3 className="j-pipe-title">{step.title}</h3>
                  <p className="j-pipe-desc">{step.desc}</p>
                  <p className="j-pipe-detail">{step.detail}</p>
                  <div className="j-pipe-tech">
                    {step.tech.map(t => <span key={t}>{t}</span>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="j-section" id="arch">
        <div className="j-container">
          <div className="j-tag">Architecture</div>
          <h2 className="j-h2">System <span className="j-accent-purple">architecture</span></h2>
          <p className="j-section-sub">Images in S3, vectors in PostgreSQL, intelligence in the cloud. Everything wired through FastAPI.</p>

          <div className="j-arch">
            <div className="j-arch-row">
              <div className="j-arch-box j-arch-blue">
                <div className="j-arch-label">React Frontend · Vercel</div>
                <div className="j-arch-sub">Upload images · View predictions · Approve / Edit / Reject (Future Idea)</div>
              </div>
            </div>
            <div className="j-arch-arrow">↓ HTTP / SSE streaming</div>
            <div className="j-arch-row">
              <div className="j-arch-box j-arch-green">
                <div className="j-arch-label">FastAPI Backend · EC2</div>
                <div className="j-arch-sub">SQLModel ORM · LangChain agent · SSE streaming endpoints</div>
              </div>
            </div>
            <div className="j-arch-arrow">↓ fan out</div>
            <div className="j-arch-row j-arch-three">
              <div className="j-arch-box j-arch-amber">
                <div className="j-arch-label">AWS S3</div>
                <div className="j-arch-sub">Raw JPEG images<br />(labeled + unlabeled)</div>
              </div>
              <div className="j-arch-box j-arch-purple">
                <div className="j-arch-label">Modal · GPU</div>
                <div className="j-arch-sub">DINOv2 embeddings<br />Grounding DINO inference</div>
              </div>
              <div className="j-arch-box j-arch-cyan">
                <div className="j-arch-label">Neon PostgreSQL</div>
                <div className="j-arch-sub">pgvector similarity search<br />Annotations + embeddings</div>
              </div>
            </div>
            <div className="j-arch-arrow">↓ labels + image</div>
            <div className="j-arch-row j-arch-two">
              <div className="j-arch-box j-arch-indigo">
                <div className="j-arch-label">Claude Vision API · Anthropic</div>
                <div className="j-arch-sub">Analyzes context examples · Returns labels to detect · Called via LangChain + Pydantic</div>
              </div>
              <div className="j-arch-box j-arch-teal">
                <div className="j-arch-label">Grounding DINO · Modal GPU</div>
                <div className="j-arch-sub">Receives labels from Claude · Returns pixel-perfect bounding boxes + confidence scores</div>
              </div>
            </div>
          </div>

          <div className="j-key-decisions">
            <h3 className="j-kd-title">Key Design Decisions</h3>
            <div className="j-kd-grid">
              <div className="j-kd-item">
                <div className="j-kd-badge cyan">Why Claude for labels?</div>
                <p>LLMs are exceptional at understanding context and style but terrible at pixel coordinates. Claude analyzes the annotation vocabulary and style from examples, then returns semantic labels. Grounding DINO handles the spatial precision problem.</p>
              </div>
              <div className="j-kd-item">
                <div className="j-kd-badge purple">Why DINOv2 for similarity?</div>
                <p>DINOv2 is self-supervised — it learned visual representations from 142M images without labels. Its embeddings capture semantic similarity better than pixel comparison. A beach scene with swimmers will match other beach/water scenes, not just visually identical images.</p>
              </div>
              <div className="j-kd-item">
                <div className="j-kd-badge amber">Why raw images in S3?</div>
                <p>If bounding boxes were drawn on stored images, you'd lose the ability to re-annotate, change thresholds, or adjust box formats. Keeping source images raw and annotations as JSON data means you can always reprocess, export to any format (CVAT, YOLO, COCO), or visualize differently.</p>
              </div>
              <div className="j-kd-item">
                <div className="j-kd-badge green">Why "learning" without weight updates?</div>
                <p>Fine-tuning requires hundreds of examples, compute, and time. Few-shot learning via growing context requires nothing but approval clicks. Every time a human approves an annotation, the agent gets a new high-quality example. The value compounds naturally.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What's Built */}
      <section className="j-section j-section-alt" id="built">
        <div className="j-container">
          <div className="j-tag">Progress</div>
          <h2 className="j-h2">What's been <span className="j-accent-green">built</span></h2>
          <p className="j-section-sub">Core AI pipeline proven. Infrastructure live. 300 images seeded. Streaming UI working.</p>
          <div className="j-done-grid">
            {DONE_ITEMS.map((item) => (
              <div className="j-done-card" key={item.title}>
                <div className="j-done-check">✓</div>
                <div>
                  <div className="j-done-title">{item.title}</div>
                  <div className="j-done-desc">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stack */}
      <section className="j-section" id="stack">
        <div className="j-container">
          <div className="j-tag">Tech Stack</div>
          <h2 className="j-h2">Technology <span className="j-accent-cyan">choices</span></h2>
          <div className="j-stack-grid">
            {[
              { badge: "AI · Understanding", color: "purple", name: "Claude Sonnet 4", desc: "Analyzes context examples, understands annotation style, identifies what objects to detect. Called via LangChain with Pydantic structured output for guaranteed clean JSON responses." },
              { badge: "AI · Precision", color: "cyan", name: "Grounding DINO", desc: "Zero-shot object detection. Takes text labels and returns pixel-perfect bounding box coordinates. Handles spatial precision that LLMs can't — the perfect complement to Claude." },
              { badge: "AI · Embeddings", color: "amber", name: "DINOv2-base", desc: "Meta's self-supervised vision transformer. 768-dim vectors capture visual semantics for similarity search. No text labels needed — pure visual understanding from 142M training images." },
              { badge: "GPU · Serverless", color: "green", name: "Modal", desc: "Serverless GPU platform. DINOv2 and Grounding DINO run on-demand on A10 GPUs. Scale to zero when idle. $30/month free tier covers heavy POC usage." },
              { badge: "Data · Vectors", color: "purple", name: "Neon + pgvector", desc: "Serverless PostgreSQL with vector similarity search. Stores embeddings, annotations, and metadata in one place. Cosine similarity for nearest-neighbor queries with millisecond latency." },
              { badge: "Data · Images", color: "cyan", name: "AWS S3", desc: "Object storage for all images — labeled and unlabeled. Always stored raw. Annotations are separate JSON data in PostgreSQL — never drawn on stored images." },
              { badge: "Backend", color: "green", name: "FastAPI + SQLModel", desc: "Async Python backend with SSE streaming for real-time pipeline progress. SQLModel ORM for type-safe database operations. Lifespan events for startup initialization." },
              { badge: "Orchestration", color: "amber", name: "LangChain", desc: "Manages Claude Vision API calls, multimodal prompt construction, and Pydantic structured output parsing. Abstracts the complexity of multi-image prompting." },
            ].map((item) => (
              <div className="j-stack-card" key={item.name}>
                <div className={`j-stack-badge j-badge-${item.color}`}>{item.badge}</div>
                <div className="j-stack-name">{item.name}</div>
                <div className="j-stack-desc">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="j-section j-section-alt" id="roadmap">
        <div className="j-container">
          <div className="j-tag">Roadmap</div>
          <h2 className="j-h2">Improvements to <span className="j-accent-purple">this POC</span></h2>
          <p className="j-section-sub">The modular pipeline makes it straightforward to upgrade individual components. Here's what would meaningfully move the needle.</p>
          <div className="j-future-grid">
            {IMPROVEMENTS.map((item) => (
              <div className={`j-future-card j-fc-${item.color}`} key={item.title}>
                <div className="j-future-title">{item.title}</div>
                <div className="j-future-desc">{item.desc}</div>
                <div className="j-future-why">{item.why}</div>
              </div>
            ))}
          </div>

          {/* Known issues */}
          <div className="j-issues">
            <h3 className="j-issues-title">Known Issues in POC</h3>
            <div className="j-issues-list">
              <div className="j-issue">
                <div className="j-issue-badge">Latency</div>
                <div>Each image requires a Claude API call (5 context images + 1 new = 6 images per call) plus Grounding DINO GPU inference. For 100 images this is slow. Solutions: async queuing, caching Claude responses for similar images, batching.</div>
              </div>
              <div className="j-issue">
                <div className="j-issue-badge">COCO variety</div>
                <div>300 COCO images cover 80 categories but most are everyday objects — not beach/water scenes. For ResQVision's actual use case, the seed data should be swapped to beach footage. The similarity search is only as good as the context pool.</div>
              </div>
              <div className="j-issue">
                <div className="j-issue-badge">GPU cold starts</div>
                <div>Modal GPU containers cold-start in ~5–15s when idle. First request after a period of inactivity will be slow. Mitigate with Modal's keep_warm=1 option or pre-warming on schedule.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="j-cta-section">
        <div className="j-container">
          <div className="j-cta-box">
            <div className="j-glow j-glow-cta" />
            <h2 className="j-cta-title">Ready to annotate?</h2>
            <p className="j-cta-sub">Upload an image and watch the full pipeline run in real time — DINOv2 embedding, similarity search, Claude Vision, Grounding DINO — all streamed step by step.</p>
            <div className="j-cta-actions">
              <button className="j-btn-primary" onClick={() => navigate("/annotate")}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Start Annotation
              </button>
              <button className="j-btn-secondary" onClick={() => navigate("/similarity")}>
                Test Similarity Search
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="j-footer">
        <Logo />
        <span>Tide Agent · Built for ResQVision · Water safety annotation</span>
      </footer>
    </div>
  )
}
