import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ChatPage } from './pages/ChatPage';
import { CollectionView } from './pages/CollectionView';
import { Dashboard } from './pages/Dashboard';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="collections/:id" element={<CollectionView />} />
          <Route path="chat/:collectionId" element={<ChatPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
