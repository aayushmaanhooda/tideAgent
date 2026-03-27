import { useNavigate } from "react-router-dom"
import "./Landing.css"

function Logo() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="30" height="30" rx="4" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4 2" />
      <path d="M6 20 Q9 15 12 20 Q15 25 18 20 Q21 15 24 20 Q27 25 30 20" stroke="url(#waveGrad)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M3 8 L3 3 L8 3" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 3 L33 3 L33 8" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 28 L3 33 L8 33" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 33 L33 33 L33 28" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="waveGrad" x1="6" y1="20" x2="30" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b82f6" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="landing">

      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-logo" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
          <Logo />
          <span className="nav-brand">Tide Agent</span>
        </div>
        <div className="nav-links">
          <a href="#about">About</a>
          <a href="#pricing">Pricing</a>
          <button className="nav-cta" onClick={() => navigate("/overview")}>
            Overview
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="glow glow-blue" />
        <div className="glow glow-purple" />

        <div className="hero-content">
          <div className="badge">
            <span className="badge-dot" />
            AI Annotation Agent
          </div>

          <h1 className="hero-title">
            Annotations that<br />
            <span className="gradient-text">learn your style</span>
          </h1>

          <p className="hero-desc">
            Tide Agent studies your labeled examples, finds visually similar images,
            and automatically annotates new data — the same way your team would.
            Better data. Faster cycles. Stronger models.
          </p>

          <div className="hero-actions">
            <button className="btn-primary" onClick={() => navigate("/annotate")}>
              <span>Start Annotation</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button className="btn-secondary" onClick={() => navigate("/similarity")}>
              Test Similarity Search
            </button>
          </div>

          <div className="stats">
            <div className="stat-pill">
              <span className="stat-num">300</span>
              <span className="stat-label">COCO images seeded</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-pill">
              <span className="stat-num">0</span>
              <span className="stat-label">fine-tuning needed</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-pill">
              <span className="stat-num">5-shot</span>
              <span className="stat-label">context examples</span>
            </div>
          </div>
        </div>

        {/* Hero visual card — full pipeline */}
        <div className="hero-card">
          <div className="card-header">
            <div className="card-dots"><span /><span /><span /></div>
            <span className="card-title">tide agent · live</span>
          </div>
          <div className="card-body">
            <div className="pipeline-step active">
              <div className="step-icon">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="1" width="14" height="14" rx="2" stroke="#3b82f6" strokeWidth="1.5"/>
                  <path d="M4 8h8M8 4v8" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <span>Image uploaded to S3</span>
              <span className="step-check">✓</span>
            </div>
            <div className="step-connector" />
            <div className="pipeline-step active">
              <div className="step-icon">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="#6366f1" strokeWidth="1.5"/>
                  <path d="M5 8h6M8 5v6" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <span>DINOv2 · 768-dim embedding</span>
              <span className="step-check">✓</span>
            </div>
            <div className="step-connector" />
            <div className="pipeline-step active">
              <div className="step-icon">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 14L8 2l6 12H2z" stroke="#8b5cf6" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
              </div>
              <span>pgvector · 5 similar images</span>
              <span className="step-check">✓</span>
            </div>
            <div className="step-connector" />
            <div className="pipeline-step active">
              <div className="step-icon">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1v3M8 12v3M1 8h3M12 8h3" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="8" cy="8" r="3" stroke="#a78bfa" strokeWidth="1.5"/>
                </svg>
              </div>
              <span>Claude Vision · labels detected</span>
              <span className="step-check">✓</span>
            </div>
            <div className="step-connector" />
            <div className="pipeline-step active">
              <div className="step-icon">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="2" width="12" height="12" rx="2" stroke="#22d3ee" strokeWidth="1.5"/>
                  <path d="M5 5h3v3H5zM8 8h3v3H8z" stroke="#22d3ee" strokeWidth="1"/>
                </svg>
              </div>
              <span>Grounding DINO · bbox coords</span>
              <span className="step-check">✓</span>
            </div>
            <div className="step-connector" />
            <div className="pipeline-step active">
              <div className="step-icon">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="1" width="14" height="14" rx="2" stroke="#4ade80" strokeWidth="1.5"/>
                  <path d="M4 5l2 2 2-2M6 7v5" stroke="#4ade80" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 8h3M9 11h3" stroke="#4ade80" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </div>
              <span>Annotations ready for review</span>
              <span className="step-check">✓</span>
            </div>
          </div>
          <div className="card-labels">
            <span className="label-chip">person 89%</span>
            <span className="label-chip">backpack 76%</span>
            <span className="label-chip">bicycle 91%</span>
            <span className="label-chip dim">+ 4 objects</span>
          </div>
        </div>
      </section>

      {/* About section — full pipeline explanation */}
      <section className="about-section" id="about">
        <h2 className="section-title">How it works</h2>
        <p className="section-sub">A 4-step AI pipeline from raw image to precise annotations</p>

        <div className="pipeline-explainer">
          {[
            {
              step: "01",
              // icon: "⚡",
              title: "DINOv2 Embedding",
              tech: "facebook/dinov2-base · Modal GPU",
              desc: "Your image is passed through DINOv2, a self-supervised vision transformer from Meta. It compresses the entire image into a 768-dimensional vector that captures visual structure, textures, and scene layout — without any labels.",
            },
            {
              step: "02",
              // icon: "🔍",
              title: "pgvector Similarity Search",
              tech: "PostgreSQL + pgvector · Neon",
              desc: "That 768-dim vector is compared against every embedding in the database using cosine similarity. The 5 most visually similar labeled images are retrieved instantly — these become the context for the AI agent.",
            },
            {
              step: "03",
              // icon: "🧠",
              title: "Claude Vision — Label Detection",
              tech: "claude-opus-4-6 · Anthropic API",
              desc: "Claude receives all 5 context images alongside their human-drawn bounding boxes and labels. It studies the annotation style — level of detail, object granularity, vocabulary — then decides which labels to detect in your new image. Claude understands what to find, not where.",
            },
            {
              step: "04",
              // icon: "🎯",
              title: "Grounding DINO — Bounding Boxes",
              tech: "IDEA-Research/grounding-dino-tiny · Modal GPU",
              desc: "Claude's label list is fed as a text prompt to Grounding DINO, a zero-shot object detector. It draws precise bounding boxes around every instance with confidence scores. Grounding DINO knows where, not what — the perfect complement to Claude.",
            },
          ].map((item) => (
            <div className="explainer-row" key={item.step}>
              <div className="explainer-step">{item.step}</div>
              <div className="explainer-body">
                <div className="explainer-header">
                  <span className="explainer-icon">{item.icon}</span>
                  <div>
                    <div className="explainer-title">{item.title}</div>
                    <div className="explainer-tech">{item.tech}</div>
                  </div>
                </div>
                <p className="explainer-desc">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing section */}
      <section className="pricing-section" id="pricing">
        <h2 className="section-title">Pricing</h2>
        <div className="pricing-cards">
          {[
            { name: "Starter", price: "$0", desc: "For solo annotators and researchers", features: ["500 images/month", "5 context examples", "Community support"] },
            { name: "Pro", price: "$49", desc: "For annotation teams", features: ["10,000 images/month", "Custom annotation style", "Priority support", "API access"], highlight: true },
            { name: "Enterprise", price: "Custom", desc: "For production pipelines", features: ["Unlimited images", "On-premise deploy", "SLA guarantee", "Dedicated support"] },
          ].map((plan) => (
            <div className={`pricing-card ${plan.highlight ? "highlight" : ""}`} key={plan.name}>
              <div className="plan-name">{plan.name}</div>
              <div className="plan-price">{plan.price}<span>/mo</span></div>
              <div className="plan-desc">{plan.desc}</div>
              <ul className="plan-features">
                {plan.features.map((f) => <li key={f}><span>✓</span>{f}</li>)}
              </ul>
              <button className={plan.highlight ? "btn-primary" : "btn-secondary"}>
                Get started
              </button>
            </div>
          ))}
        </div>
      </section>

      <footer className="footer">
        <Logo />
        <span>Tide Agent · Built for ResQVision</span>
      </footer>
    </div>
  )
}
