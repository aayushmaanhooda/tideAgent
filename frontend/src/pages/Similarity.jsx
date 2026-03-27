import { useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import "./Similarity.css"

function ImageCard({ src, labels, caption, score }) {
  return (
    <div className="image-card">
      <img src={src} alt={caption} />
      {score !== undefined && (
        <p className="score">Similarity: {(score * 100).toFixed(1)}%</p>
      )}
      <p className="label">{caption}</p>
      {labels?.length > 0 && (
        <p className="labels">
          {Object.entries(
            labels.reduce((acc, l) => ({ ...acc, [l]: (acc[l] ?? 0) + 1 }), {})
          ).map(([label, count]) => `${label} (${count})`).join(", ")}
        </p>
      )}
    </div>
  )
}

export default function Similarity() {
  const [uploadedImage, setUploadedImage] = useState(null)
  const [results, setResults] = useState([])
  const [suggestedLabels, setSuggestedLabels] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef()
  const navigate = useNavigate()

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return

    setUploadedImage(URL.createObjectURL(file))
    setResults([])
    setSuggestedLabels([])
    setError(null)
    setLoading(true)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch("/v1/similar", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data = await res.json()
      setResults(data.results)
      setSuggestedLabels(data.suggested_labels ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="sim-page">
      <header className="sim-header">
        <button className="back-btn" onClick={() => navigate("/")}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M13 8H3M7 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Tide Agent
        </button>
        <h1>Similarity Search</h1>
        <p>Upload an image to find visually similar examples and get Claude's annotation suggestions</p>
      </header>

      <div className="sim-upload">
        <button className="btn-primary" onClick={() => inputRef.current.click()}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1v10M4 5l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Upload Image
        </button>
        <input ref={inputRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: "none" }} />
      </div>

      {error && <p className="sim-error">{error}</p>}

      {suggestedLabels.length > 0 && (
        <div className="suggested-labels">
          <h2>Claude suggests detecting:</h2>
          <div className="label-chips">
            {suggestedLabels.map((label) => (
              <span key={label} className="chip">{label}</span>
            ))}
          </div>
        </div>
      )}

      {(uploadedImage || results.length > 0) && (
        <div className="results-grid">
          {uploadedImage && (
            <ImageCard src={uploadedImage} labels={[]} caption="Your image" />
          )}
          {loading && <div className="spinner" />}
          {results.map((r, i) => (
            <ImageCard
              key={r.id}
              src={r.image_url}
              labels={r.labels}
              caption={`Match #${i + 1}`}
              score={r.similarity}
            />
          ))}
        </div>
      )}
    </div>
  )
}
