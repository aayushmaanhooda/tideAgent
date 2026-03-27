import { BrowserRouter, Routes, Route } from "react-router-dom"
import Landing from "./pages/Landing"
import Similarity from "./pages/Similarity"
import Annotate from "./pages/Annotate"
import Overview from "./pages/Overview"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/similarity" element={<Similarity />} />
        <Route path="/annotate" element={<Annotate />} />
        <Route path="/overview" element={<Overview />} />
      </Routes>
    </BrowserRouter>
  )
}
