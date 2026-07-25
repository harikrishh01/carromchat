import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainMenu } from './pages/MainMenu.jsx';
import { OfflineMenu } from './pages/OfflineMenu.jsx';
import { OfflineGame } from './pages/OfflineGame.jsx';
import { OnlineMenu } from './pages/OnlineMenu.jsx';
import { OnlineGame } from './pages/OnlineGame.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/offline" element={<OfflineMenu />} />
        <Route path="/game/offline" element={<OfflineGame />} />
        <Route path="/online" element={<OnlineMenu />} />
        <Route path="/game/online" element={<OnlineGame />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
