import { useState, useRef, useEffect } from "react"
import "./Annotate.css"

const STEPS = [
  { key: "embedding",      label: "DINOv2 Embedding"  },
  { key: "similarity",     label: "Similarity Search"  },
  { key: "claude",         label: "Claude Vision"      },
  { key: "grounding_dino", label: "Grounding DINO"     },
]

const BOX_COLORS = [
  "#3b82f6","#22c55e","#f59e0b","#ef4444",
  "#8b5cf6","#06b6d4","#ec4899","#f97316",
]

function AnnotatedCanvas({ imageUrl, annotations, naturalWidth, naturalHeight }) {
  const imgRef = useRef()
  const canvasRef = useRef()

  function draw() {
    const img = imgRef.current
    const canvas = canvasRef.current
    if (!img || !canvas || !annotations.length) return

    const scaleX = img.clientWidth / naturalWidth
    const scaleY = img.clientHeight / naturalHeight
    canvas.width = img.clientWidth
    canvas.height = img.clientHeight

    const ctx = canvas.getContext("2d")
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    annotations.forEach(({ bbox, label, confidence }, i) => {
      const color = BOX_COLORS[i % BOX_COLORS.length]
      const [x1, y1, x2, y2] = bbox
      const sx = x1 * scaleX, sy = y1 * scaleY
      const sw = (x2 - x1) * scaleX, sh = (y2 - y1) * scaleY

      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.strokeRect(sx, sy, sw, sh)

      const text = `${label} ${(confidence * 100).toFixed(0)}%`
      ctx.font = "bold 11px system-ui"
      const tw = ctx.measureText(text).width
      ctx.fillStyle = color
      ctx.fillRect(sx, sy - 18, tw + 10, 18)

      ctx.fillStyle = "#fff"
      ctx.fillText(text, sx + 5, sy - 5)
    })
  }

  useEffect(() => {
    const img = imgRef.current
    if (!img) return
    if (img.complete) draw()
    else img.addEventListener("load", draw)
    return () => img?.removeEventListener("load", draw)
  }, [imageUrl, annotations, naturalWidth, naturalHeight])

  return (
    <div className="canvas-wrapper">
      <img ref={imgRef} src={imageUrl} alt="Annotated" />
      <canvas ref={canvasRef} className="anno-canvas" />
    </div>
  )
}

export default function Annotate() {
  const inputRef = useRef()
  const bulkInputRef = useRef()

  // Single upload state
  const [uploadedImage, setUploadedImage] = useState(null)
  const [steps, setSteps] = useState({})
  const [annotations, setAnnotations] = useState([])
  const [imgDims, setImgDims] = useState({ width: 0, height: 0 })
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  // Bulk upload state
  const [bulkQueue, setBulkQueue] = useState([])
  const [bulkRunning, setBulkRunning] = useState(false)

  function updateStep(key, status, detail) {
    setSteps(prev => ({ ...prev, [key]: { status, detail } }))
  }

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return

    setUploadedImage(URL.createObjectURL(file))
    setSteps({})
    setAnnotations([])
    setError(null)
    setDone(false)
    setRunning(true)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch("/v1/annotate", { method: "POST", body: formData })
      if (!res.ok) throw new Error(`Server error ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split("\n\n")
        buffer = parts.pop()

        for (const part of parts) {
          const dataLine = part.split("\n").find(l => l.startsWith("data: "))
          if (!dataLine) continue
          const msg = JSON.parse(dataLine.slice(6).trim())

          if (msg.type === "step") {
            updateStep(msg.step, msg.status, msg.detail)
          } else if (msg.type === "result") {
            setAnnotations(msg.annotations)
            setImgDims({ width: msg.width, height: msg.height })
            setDone(true)
          } else if (msg.type === "error") {
            setError(msg.message)
          }
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setRunning(false)
    }
  }

  // ── Bulk processing ────────────────────────────────────────────────

  async function processBulkItem(id, file) {
    setBulkQueue(prev => prev.map(item =>
      item.id === id ? { ...item, status: "running", steps: {} } : item
    ))

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch("/v1/annotate", { method: "POST", body: formData })
      if (!res.ok) throw new Error(`Server error ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split("\n\n")
        buffer = parts.pop()

        for (const part of parts) {
          const dataLine = part.split("\n").find(l => l.startsWith("data: "))
          if (!dataLine) continue
          const msg = JSON.parse(dataLine.slice(6).trim())

          if (msg.type === "step") {
            setBulkQueue(prev => prev.map(item =>
              item.id === id
                ? { ...item, steps: { ...item.steps, [msg.step]: { status: msg.status, detail: msg.detail } } }
                : item
            ))
          } else if (msg.type === "result") {
            setBulkQueue(prev => prev.map(item =>
              item.id === id
                ? { ...item, status: "done", annotations: msg.annotations, dims: { width: msg.width, height: msg.height } }
                : item
            ))
          } else if (msg.type === "error") {
            setBulkQueue(prev => prev.map(item =>
              item.id === id ? { ...item, status: "error", error: msg.message } : item
            ))
          }
        }
      }
    } catch (err) {
      setBulkQueue(prev => prev.map(item =>
        item.id === id ? { ...item, status: "error", error: err.message } : item
      ))
    }
  }

  async function handleBulkUpload(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return

    const newItems = files.map((file, i) => ({
      id: `${Date.now()}-${i}`,
      file,
      objectUrl: URL.createObjectURL(file),
      name: file.name,
      status: "pending",  // pending | running | done | error
      steps: {},
      annotations: [],
      dims: { width: 0, height: 0 },
      error: null,
      expanded: false,
    }))

    setBulkQueue(prev => [...prev, ...newItems])
    setBulkRunning(true)

    await Promise.all(newItems.map(item => processBulkItem(item.id, item.file)))

    setBulkRunning(false)
  }

  function toggleExpand(id) {
    setBulkQueue(prev => prev.map(item =>
      item.id === id ? { ...item, expanded: !item.expanded } : item
    ))
  }

  function clearBulkQueue() {
    setBulkQueue([])
  }

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="annotate-page">
      <header className="anno-header">
        <a className="back-btn" href="/">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M13 8H3M7 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Tide Agent
        </a>
        <h1>Annotate Image</h1>
        <p>Upload an image and the agent will detect and label every object automatically</p>
      </header>

      <div className="anno-actions">
        <button className="btn-disabled" disabled>
          Upload Context
          <span className="coming-soon">coming soon</span>
        </button>

        <button className="btn-primary" onClick={() => inputRef.current.click()} disabled={running}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1v10M4 5l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {running ? "Processing..." : "Upload Image"}
        </button>

        <button className="btn-secondary" onClick={() => bulkInputRef.current.click()} disabled={bulkRunning}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M2 4v9a1 1 0 001 1h10a1 1 0 001-1V4M2 4l1-2h10l1 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 7v5M6 9l2-2 2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {bulkRunning ? "Processing..." : "Bulk Upload"}
        </button>

        <input ref={inputRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: "none" }} />
        <input ref={bulkInputRef} type="file" accept="image/*" multiple onChange={handleBulkUpload} style={{ display: "none" }} />
      </div>

      {error && <div className="anno-error">{error}</div>}

      {/* Single image pipeline status */}
      {Object.keys(steps).length > 0 && !done && (
        <div className="status-bar">
          {STEPS.map(({ key, label }, i) => {
            const s = steps[key]
            if (!s) return null
            const isLast = i === STEPS.length - 1
            return (
              <span key={key} className="status-crumb">
                <span className={`status-icon ${s.status}`}>
                  {s.status === "running" ? <span className="inline-spinner" /> : "✓"}
                </span>
                <span className={`status-text ${s.status}`}>
                  {s.status === "running" ? s.detail : label}
                </span>
                {!isLast && s.status === "done" && <span className="status-sep">›</span>}
              </span>
            )
          })}
        </div>
      )}

      {/* Single image result */}
      {uploadedImage && done && (
        <div className="result-section">
          <div className="result-header">
            <h2>Annotation Result</h2>
            <span className="result-badge">{annotations.length} objects detected</span>
          </div>
          <div className="result-layout">
            <AnnotatedCanvas
              imageUrl={uploadedImage}
              annotations={annotations}
              naturalWidth={imgDims.width}
              naturalHeight={imgDims.height}
            />
          </div>
        </div>
      )}

      {/* Single image preview while processing */}
      {uploadedImage && !done && (
        <div className="preview-section">
          <img src={uploadedImage} alt="Preview" className="preview-img" />
          {running && <div className="preview-overlay"><span className="big-spinner" /></div>}
        </div>
      )}

      {/* Bulk queue */}
      {bulkQueue.length > 0 && (
        <div className="bulk-section">
          <div className="bulk-header">
            <h2>
              Bulk Queue
              <span className="bulk-count">
                {bulkQueue.filter(i => i.status === "done").length}/{bulkQueue.length} done
              </span>
            </h2>
            {!bulkRunning && (
              <button className="bulk-clear-btn" onClick={clearBulkQueue}>Clear</button>
            )}
          </div>

          <div className="bulk-list">
            {bulkQueue.map(item => (
              <div key={item.id} className={`bulk-item bulk-item--${item.status}`}>
                <div className="bulk-item-main">
                  <img src={item.objectUrl} alt={item.name} className="bulk-thumb" />

                  <div className="bulk-info">
                    <span className="bulk-name">{item.name}</span>

                    {item.status === "pending" && (
                      <span className="bulk-detail">Waiting...</span>
                    )}

                    {item.status === "running" && (
                      <div className="bulk-steps">
                        {STEPS.map(({ key, label }) => {
                          const s = item.steps[key]
                          if (!s) return null
                          return (
                            <span key={key} className="bulk-step">
                              <span className={`status-icon ${s.status}`}>
                                {s.status === "running" ? <span className="inline-spinner" /> : "✓"}
                              </span>
                              <span className={`status-text ${s.status}`}>
                                {s.status === "running" ? s.detail : label}
                              </span>
                            </span>
                          )
                        })}
                      </div>
                    )}

                    {item.status === "done" && (
                      <span className="bulk-detail bulk-detail--done">
                        {item.annotations.length} objects detected
                      </span>
                    )}

                    {item.status === "error" && (
                      <span className="bulk-detail bulk-detail--error">{item.error}</span>
                    )}
                  </div>

                  <div className="bulk-status-col">
                    {item.status === "pending" && <span className="bulk-badge bulk-badge--pending">Pending</span>}
                    {item.status === "running" && <span className="inline-spinner" />}
                    {item.status === "done" && (
                      <button className="bulk-expand-btn" onClick={() => toggleExpand(item.id)}>
                        {item.expanded ? "Hide" : "View"}
                      </button>
                    )}
                    {item.status === "error" && <span className="bulk-badge bulk-badge--error">Error</span>}
                  </div>
                </div>

                {item.expanded && item.status === "done" && (
                  <div className="bulk-expanded">
                    <AnnotatedCanvas
                      imageUrl={item.objectUrl}
                      annotations={item.annotations}
                      naturalWidth={item.dims.width}
                      naturalHeight={item.dims.height}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
