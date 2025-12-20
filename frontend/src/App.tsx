import './App.css'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/auth/Login.tsx'
import Register from './pages/auth/Register.tsx'
import ProtectedRoute from './routes/ProtectedRoute.tsx'
import AppLayout from './layouts/AppLayout.tsx'
import Home from './pages/app/Home.tsx'
import Fun from './pages/app/Fun.tsx'
import History from './pages/app/History.tsx'
import Favorites from './pages/app/Favorites.tsx'
import MyPosts from './pages/app/MyPosts.tsx'
import MyViews from './pages/app/MyViews.tsx'
import MyLikes from './pages/app/MyLikes.tsx'
import MyBookmarks from './pages/app/MyBookmarks.tsx'
import OnlineLobby from './pages/app/OnlineLobby.tsx'
import Profile from './pages/app/Profile.tsx'
import LocalPlay from './pages/app/LocalPlay.tsx'
import CustomRuleEditor from './pages/app/CustomRuleEditor.tsx'
import CustomBattle from './pages/app/CustomBattle.tsx'
import VisualRuleEditor from './pages/app/VisualRuleEditor.tsx'
import TemplateManager from './pages/app/TemplateManager.tsx'
import LiveBattle from './pages/app/LiveBattle.tsx'
import CustomOnlineLobby from './pages/app/CustomOnlineLobby.tsx'
import CustomOnlineLiveBattle from './pages/app/CustomOnlineLiveBattle.tsx'
import RecordReplay from './pages/app/RecordReplay.tsx'
import EndgameHome from './pages/app/EndgameHome.tsx'
import EndgameSaved from './pages/app/EndgameSaved.tsx'
import EndgameSetup from './pages/app/EndgameSetup.tsx'
import Community from './pages/app/Community.tsx'
import PostDetail from './features/community/PostDetail.tsx'
import CreatePost from './features/community/CreatePost.tsx'
import UserProfile from './pages/app/UserProfile.tsx'

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
          <Route path="templates" element={<TemplateManager />} />
          <Route path="custom-battle" element={<CustomBattle />} />
          <Route path="fun" element={<Fun />} />
          <Route path="history" element={<History />} />
          <Route path="favorites" element={<Favorites />} />
          <Route path="my-posts" element={<MyPosts />} />
          <Route path="my-views" element={<MyViews />} />
          <Route path="my-likes" element={<MyLikes />} />
          <Route path="my-bookmarks" element={<MyBookmarks />} />
          <Route path="community" element={<Community />} />
          <Route path="community/new" element={<CreatePost />} />
          <Route path="community/:postId/edit" element={<CreatePost />} />
          <Route path="community/:postId" element={<PostDetail />} />
          <Route path="users/:userId" element={<UserProfile />} />
          <Route path="record/:id" element={<RecordReplay />} />
          <Route path="endgame" element={<EndgameHome />} />
          <Route path="endgame/setup" element={<EndgameSetup />} />
          <Route path="profile" element={<Profile />} />
          <Route path="online-lobby" element={<OnlineLobby />} />
          <Route path="live-battle" element={<LiveBattle />} />
          <Route path="custom-online-lobby" element={<CustomOnlineLobby />} />
          <Route path="custom-online-live-battle" element={<CustomOnlineLiveBattle />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
