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

function AppRoutes() {
  const navigate = useNavigate();
  return (
    <ErrorBoundary onReset={() => navigate('/')}>
      <Suspense
        fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}
      >
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="collections/:id" element={<CollectionView />} />
            <Route path="upload/:id" element={<UploadPage />} />
            <Route path="chat/:collectionId" element={<ChatPage />} />
            <Route path="search/:collectionId" element={<SearchPage />} />
            <Route path="costs" element={<CostDashboard />} />
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
