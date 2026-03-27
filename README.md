<div align="center">

<svg width="72" height="72" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="36" height="36" rx="6" fill="#0a0a1a"/>
  <rect x="3" y="3" width="30" height="30" rx="4" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4 2"/>
  <path d="M6 20 Q9 15 12 20 Q15 25 18 20 Q21 15 24 20 Q27 25 30 20" stroke="url(#wg)" stroke-width="2.5" stroke-linecap="round" fill="none"/>
  <path d="M3 8 L3 3 L8 3" stroke="#6366f1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M28 3 L33 3 L33 8" stroke="#6366f1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M3 28 L3 33 L8 33" stroke="#6366f1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M28 33 L33 33 L33 28" stroke="#6366f1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <defs>
    <linearGradient id="wg" x1="6" y1="20" x2="30" y2="20" gradientUnits="userSpaceOnUse">
      <stop stop-color="#3b82f6"/>
      <stop offset="1" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
</svg>

# Tide

**AI-powered annotation agent for computer vision teams**

</div>

---

## Research (Colab)

| Notebook | Description |
|---|---|
| [AI Pipeline Prototype](https://colab.research.google.com/drive/1kwIzOvkCFFfhrtgSXYvRp2jH2V1z8jHF?usp=sharing) | End-to-end pipeline: load COCO examples → ask Claude Vision what labels to detect → run Grounding DINO for precise bounding boxes → visualize results |
| [DINOv2 Embeddings + Similarity Search](https://colab.research.google.com/drive/1k-CIb4CgfDBSZRxZqxbWoPpmvlT59L5Y?usp=sharing) | Generate 768-dim DINOv2 embeddings for labeled images and test pgvector similarity search to surface the most relevant context examples |

---

## What is Tide?

Tide is a CVAT-style annotation agent built for AI public safety companies. It learns annotation style from a small set of human-labeled examples, then automatically annotates new images the same way a human expert would — dramatically cutting the time and cost of building training datasets.

The agent doesn't just run inference. It gets better over time: every annotation a human approves gets added back as context, so the more you use it, the more accurately it mirrors your team's labeling style.

Built for [ResQVision](https://resqvision.com) — an AI company focused on public safety applications like beach and water surveillance.

---

## The Problem

Good annotations are the foundation of good computer vision models. But manual annotation is slow, expensive, and doesn't scale. Existing tools (CVAT, Labelbox, etc.) still require a human to draw every box. Tide automates that first pass.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python) |
| Database | Neon PostgreSQL + pgvector |
| ORM | SQLModel |
| Image Storage | AWS S3 |
| Similarity Search | DINOv2 (768-dim embeddings) |
| Label Detection | Claude Vision via LangChain |
| Bounding Boxes | Grounding DINO (HuggingFace) |
| Frontend | React + Vite |
| Deployment | EC2 (backend) + Vercel (frontend) |

---

## Full Pipeline

```
User uploads labeled examples (images + bounding boxes + labels)
                        ↓
         DINOv2 generates a 768-dim embedding per image
                        ↓
        Embeddings stored in Neon with pgvector extension
                        ↓
              New unlabeled image arrives
                        ↓
        DINOv2 embeds the new image → pgvector finds
          5 most visually similar labeled examples
                        ↓
     5 context images + their annotations + new image
              → Claude Vision (claude-sonnet-4)
                        ↓
       Claude returns: what labels to detect
           e.g. ["person", "life jacket", "wave"]
                        ↓
         Labels + new image → Grounding DINO
                        ↓
      Grounding DINO returns precise bounding boxes
                + confidence scores
                        ↓
        Result surfaces in UI for human review
                        ↓
         Approve → stored as new labeled example
                   (context grows)
         Edit    → corrected annotation stored
         Reject  → discarded
```

**Key design choices:**
- Claude handles *understanding* (what to detect) — not coordinates. It's bad at precise pixel math.
- Grounding DINO handles *precision* (exact bounding box coordinates).
- Images are always stored raw in S3 — bounding boxes are never drawn on stored images.
- The agent learns by growing its context database, not by updating model weights.
