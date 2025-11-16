import './App.css'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/auth/Login.tsx'
import Register from './pages/auth/Register.tsx'
import ProtectedRoute from './routes/ProtectedRoute.tsx'
import AppLayout from './layouts/AppLayout.tsx'
import Home from './pages/app/Home.tsx'
import Fun from './pages/app/Fun.tsx'
import History from './pages/app/History.tsx'
import Profile from './pages/app/Profile.tsx'
import LocalPlay from './pages/app/LocalPlay.tsx'
import CustomRuleEditor from './pages/app/CustomRuleEditor.tsx'
import CustomBattle from './pages/app/CustomBattle.tsx'
import VisualRuleEditor from './pages/app/VisualRuleEditor.tsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/app" element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/app/home" replace />} />
          <Route path="home" element={<Home />} />
          <Route path="play" element={<LocalPlay />} />
          <Route path="custom-editor" element={<CustomRuleEditor />} />
          <Route path="visual-editor" element={<VisualRuleEditor />} />
          <Route path="custom-battle" element={<CustomBattle />} />
          <Route path="fun" element={<Fun />} />
          <Route path="history" element={<History />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
