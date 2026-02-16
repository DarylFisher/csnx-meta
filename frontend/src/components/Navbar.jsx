import { NavLink } from "react-router-dom";

const link =
  "px-3 py-2 rounded-md text-sm font-medium transition-colors";
const active = `${link} bg-white/20 text-white`;
const inactive = `${link} text-blue-100 hover:bg-white/10`;

export default function Navbar() {
  return (
    <nav className="shadow" style={{ backgroundColor: "#1F4E79" }}>
      <div className="max-w-6xl mx-auto px-4 flex items-center h-14 gap-4">
        <NavLink to="/" className="text-white font-bold text-lg mr-6">
          Product Resources
        </NavLink>
        <NavLink to="/database" className={({ isActive }) => (isActive ? active : inactive)}>
          Database Information
        </NavLink>
        <NavLink to="/development" className={({ isActive }) => (isActive ? active : inactive)}>
          Development Status
        </NavLink>
      </div>
    </nav>
  );
}
