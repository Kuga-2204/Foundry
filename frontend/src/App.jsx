import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import NavBar from "./components/NavBar.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Problems from "./pages/Problems.jsx";
import ProblemDetail from "./pages/ProblemDetail.jsx";
import PostProblem from "./pages/PostProblem.jsx";
import Startups from "./pages/Startups.jsx";
import StartupDetail from "./pages/StartupDetail.jsx";
import StartupForm from "./pages/StartupForm.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import UserProfile from "./pages/UserProfile.jsx";
import { useAuth } from "./context/AuthContext.jsx";

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

export default function App() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/users/:id" element={<UserProfile />} />
        <Route path="/problems" element={<Problems />} />
        <Route path="/problems/:id" element={<ProblemDetail />} />
        <Route path="/startups" element={<Startups />} />
        <Route path="/startups/new" element={<RequireAuth><StartupForm /></RequireAuth>} />
        <Route path="/startups/:id" element={<StartupDetail />} />
        <Route path="/startups/:id/edit" element={<RequireAuth><StartupForm edit /></RequireAuth>} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        {/* Public: people can write their problem before signing up; the
            submit step gates on auth and preserves the draft. */}
        <Route path="/post" element={<PostProblem />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
