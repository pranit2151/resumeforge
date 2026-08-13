import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { FileText, History, Database, Hammer } from 'lucide-react';
import Generate from './pages/Generate';
import HistoryPage from './pages/History';
import MasterEditor from './pages/MasterEditor';

export default function App() {
  const location = useLocation();

  return (
    <div className="app-shell">
      <nav className="nav">
        <div className="nav-inner">
          <NavLink to="/" className="nav-brand">
            <div className="nav-logo-icon">
              <Hammer size={16} color="white" />
            </div>
            <span className="nav-brand-name">ResumeForge</span>
          </NavLink>

          <ul className="nav-links">
            <li>
              <NavLink
                to="/"
                end
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <FileText size={15} />
                Generate
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/history"
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <History size={15} />
                History
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/master"
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <Database size={15} />
                Master Resume
              </NavLink>
            </li>
          </ul>
        </div>
      </nav>

      <main className="page-content">
        <Routes>
          <Route path="/" element={<Generate />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/master" element={<MasterEditor />} />
        </Routes>
      </main>
    </div>
  );
}
