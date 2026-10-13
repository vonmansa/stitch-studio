import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import ProjectList from './pages/ProjectList.jsx';
import ProjectForm from './pages/ProjectForm.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import YardageCalculator from './pages/YardageCalculator.jsx';
import FitStudio from './pages/FitStudio.jsx';
import PatternLab from './pages/PatternLab.jsx';
import { MeasurementsProvider } from './fit/MeasurementsContext.jsx';

// three.js is large; only load it when the 3D Studio is opened.
const Studio3D = lazy(() => import('./pages/Studio3D.jsx'));

export default function App() {
  return (
    <MeasurementsProvider>
      <div className="app">
        <Navbar />
        <main className="app-content">
          <Routes>
            <Route path="/" element={<ProjectList />} />
            <Route path="/projects/new" element={<ProjectForm />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/projects/:id/edit" element={<ProjectForm />} />
            <Route path="/yardage" element={<YardageCalculator />} />
            <Route path="/fit" element={<FitStudio />} />
            <Route path="/pattern" element={<PatternLab />} />
            <Route
              path="/studio"
              element={
                <Suspense fallback={<p className="muted">Loading 3D Studio…</p>}>
                  <Studio3D />
                </Suspense>
              }
            />
          </Routes>
        </main>
      </div>
    </MeasurementsProvider>
  );
}
