import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Applications from "./pages/Applications";
import Tables from "./pages/Tables";
import CrossRef from "./pages/CrossRef";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Routes>
          <Route path="/" element={<Navigate to="/apps" replace />} />
          <Route path="/apps" element={<Applications />} />
          <Route path="/tables" element={<Tables />} />
          <Route path="/xref" element={<CrossRef />} />
        </Routes>
      </main>
    </div>
  );
}
