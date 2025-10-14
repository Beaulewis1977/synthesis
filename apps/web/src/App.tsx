import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ChatPage } from './pages/ChatPage';
import { CollectionView } from './pages/CollectionView';
import { CostDashboard } from './pages/CostDashboard';
import { Dashboard } from './pages/Dashboard';
import { UploadPage } from './pages/UploadPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="collections/:id" element={<CollectionView />} />
          <Route path="upload/:id" element={<UploadPage />} />
          <Route path="chat/:collectionId" element={<ChatPage />} />
          <Route path="costs" element={<CostDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
