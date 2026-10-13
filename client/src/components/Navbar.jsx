import { NavLink } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="navbar">
      <span className="navbar-brand">🧵 Stitch Studio</span>
      <div className="navbar-links">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          Projects
        </NavLink>
        <NavLink to="/yardage" className={({ isActive }) => (isActive ? 'active' : '')}>
          Yardage Calculator
        </NavLink>
        <NavLink to="/fit" className={({ isActive }) => (isActive ? 'active' : '')}>
          Fit Studio
        </NavLink>
        <NavLink to="/pattern" className={({ isActive }) => (isActive ? 'active' : '')}>
          Pattern Lab
        </NavLink>
        <NavLink to="/studio" className={({ isActive }) => (isActive ? 'active' : '')}>
          3D Studio
        </NavLink>
      </div>
    </nav>
  );
}
