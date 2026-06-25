import { Routes, Route, Navigate } from 'react-router-dom'
import { VisualizerEditor } from './features/visualizer/editor/VisualizerEditor'
import { AuthPage } from './pages/AuthPage'
import { ProfilePage } from './pages/ProfilePage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { AdminPage } from './pages/AdminPage'
import { ShareViewer } from './pages/ShareViewer'
import { AdminGuard } from './lib/AdminGuard'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<VisualizerEditor />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/admin" element={<AdminGuard><AdminPage /></AdminGuard>} />
      <Route path="/p/:shareToken" element={<ShareViewer />} />
    </Routes>
  )
}
