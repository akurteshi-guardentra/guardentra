import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { DemoProvider } from './lib/DemoContext';

const Landing = lazy(() => import('./pages/Landing').then((m) => ({ default: m.Landing })));
const AppAuthenticated = lazy(() => import('./AppAuthenticated'));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div
        className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"
        aria-label="Loading"
      />
    </div>
  );
}

/**
 * Public shell: Landing has no Firebase / Auth / Login UI in the entry graph.
 * All authenticated routes (and /login, /portal) load AppAuthenticated on demand.
 */
function App() {
  return (
    <DemoProvider>
      <Router>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="*" element={<AppAuthenticated />} />
          </Routes>
        </Suspense>
      </Router>
    </DemoProvider>
  );
}

export default App;
