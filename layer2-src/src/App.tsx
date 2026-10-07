import { Routes, Route } from 'react-router'
import Home from './pages/Home'

export default function App() {
  return (
    <Routes>
      {/* Deployed as a standalone static file (concierge.html), not
          necessarily served at the URL root, so match any pathname. */}
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
