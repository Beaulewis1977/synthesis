import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';

const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const CollectionView = lazy(() =>
  import('./pages/CollectionView').then((m) => ({ default: m.CollectionView }))
);
const UploadPage = lazy(() =>
  import('./pages/UploadPage').then((m) => ({ default: m.UploadPage }))
);
const ChatPage = lazy(() => import('./pages/ChatPage').then((m) => ({ default: m.ChatPage })));
const SearchPage = lazy(() =>
  import('./pages/SearchPage').then((m) => ({ default: m.SearchPage }))
);
const CostDashboard = lazy(() =>
  import('./pages/CostDashboard').then((m) => ({ default: m.CostDashboard }))
);
const AgentIngestionPage = lazy(() =>
  import('./pages/AgentIngestionPage').then((m) => ({ default: m.AgentIngestionPage }))
);
const DocumentEditorPage = lazy(() =>
  import('./pages/DocumentEditorPage').then((m) => ({ default: m.DocumentEditorPage }))
);
const WorkflowsPage = lazy(() =>
  import('./pages/WorkflowsPage').then((m) => ({ default: m.WorkflowsPage }))
);
const ModelsPage = lazy(() =>
  import('./pages/settings/ModelsPage').then((m) => ({ default: m.ModelsPage }))
);
const GraphDebugPage = lazy(() =>
  import('./pages/GraphDebugPage').then((m) => ({ default: m.GraphDebugPage }))
);

function AppRoutes() {
  const navigate = useNavigate();
  return (
    <ErrorBoundary onReset={() => navigate('/')}>
      <Suspense
        fallback={
          <output className="flex items-center justify-center min-h-screen" aria-live="polite">
            Loading...
          </output>
        }
      >
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="collections/:id" element={<CollectionView />} />
            <Route path="upload/:id" element={<UploadPage />} />
            <Route path="chat/:collectionId" element={<ChatPage />} />
            <Route path="search/:collectionId" element={<SearchPage />} />
            <Route path="costs" element={<CostDashboard />} />
            <Route path="agent/ingest" element={<AgentIngestionPage />} />
            <Route path="documents/:id/edit" element={<DocumentEditorPage />} />
            <Route path="workflows/:collectionId" element={<WorkflowsPage />} />
            <Route path="settings/models" element={<ModelsPage />} />
            <Route path="graph" element={<GraphDebugPage />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
