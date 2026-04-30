import { useEffect, useLayoutEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import AppShell from './components/layout/AppShell.jsx';
import useAuth from './hooks/useAuth.js';
import { applyTheme } from './store/theme.store.js';
import Dashboard from './pages/Dashboard.jsx';
import GitHubCallback from './pages/GitHubCallback.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import NotFound from './pages/NotFound.jsx';
import Project from './pages/Project.jsx';
import Register from './pages/Register.jsx';
import Room from './pages/Room.jsx';
import ProtectedRoute from './utils/protectedRoute.jsx';

const App = () => {
  const { initialized, checkAuth } = useAuth();

  useEffect(() => {
    if (!initialized) {
      checkAuth();
    }
  }, [checkAuth, initialized]);

  useLayoutEffect(() => {
    applyTheme();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="github/callback" element={<GitHubCallback />} />
          <Route path="rooms/:roomId" element={<Room />} />
          <Route path="projects/:projectId" element={<Project />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default App;
