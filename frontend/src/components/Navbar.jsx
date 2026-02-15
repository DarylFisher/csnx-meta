import { NavLink } from "react-router-dom";

const link =
  "px-3 py-2 rounded-md text-sm font-medium transition-colors";
const active = `${link} bg-indigo-700 text-white`;
const inactive = `${link} text-indigo-100 hover:bg-indigo-500`;

export default function Navbar() {
  return (
    <nav className="bg-indigo-600 shadow">
      <div className="max-w-6xl mx-auto px-4 flex items-center h-14 gap-4">
        <span className="text-white font-bold text-lg mr-6">CSNX Meta</span>
        <NavLink to="/apps" className={({ isActive }) => (isActive ? active : inactive)}>
          Applications
        </NavLink>
        <NavLink to="/tables" className={({ isActive }) => (isActive ? active : inactive)}>
          Tables &amp; Columns
        </NavLink>
        <NavLink to="/xref" className={({ isActive }) => (isActive ? active : inactive)}>
          Cross Reference
        </NavLink>
      </div>
    </nav>
  );
}
