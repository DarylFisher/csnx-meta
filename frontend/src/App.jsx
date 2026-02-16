import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import DatabaseInfo from "./pages/DatabaseInfo";
import DevelopmentStatus from "./pages/DevelopmentStatus";
import Applications from "./pages/Applications";
import Tables from "./pages/Tables";
import CrossRef from "./pages/CrossRef";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Routes>
          <Route path="/" element={<Navigate to="/database" replace />} />
          <Route path="/database" element={<DatabaseInfo />} />
          <Route path="/database/apps" element={<Applications />} />
          <Route path="/database/tables" element={<Tables />} />
          <Route path="/database/xref" element={<CrossRef />} />
          <Route path="/development" element={<DevelopmentStatus />} />
          <Route
            path="/development/overall"
            element={
              <div>
                <h1 className="text-2xl font-bold mb-4">Overall Status</h1>
                <p className="text-gray-500">Coming soon.</p>
              </div>
            }
          />
          <Route
            path="/development/customer"
            element={
              <div>
                <h1 className="text-2xl font-bold mb-4">Customer Project Status</h1>
                <p className="text-gray-500">Coming soon.</p>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
