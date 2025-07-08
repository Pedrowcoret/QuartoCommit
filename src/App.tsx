import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Admin Pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';

// Auth Pages
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import ConfirmEmail from './pages/auth/ConfirmEmail';
import ResetPassword from './pages/auth/ResetPassword';
import AuthCallback from './pages/auth/AuthCallback';

// Dashboard Pages
import Dashboard from './pages/dashboard/Dashboard';
import IniciarTransmissao from './pages/dashboard/IniciarTransmissao';
import DadosConexao from './pages/dashboard/DadosConexao';
import Configuracoes from './pages/dashboard/Configuracoes';
import Players from './pages/dashboard/Players';
import GerenciarVideos from './pages/dashboard/Gerenciarvideos';
import Playlists from './pages/dashboard/Playlists';
import Agendamentos from './pages/dashboard/Agendamentos';
import Comerciais from './pages/dashboard/Comerciais';
import DownloadYoutube from './pages/dashboard/DownloadYoutube';
import MigrarVideosFTP from './pages/dashboard/MigrarVideosFTP';
import Espectadores from './pages/dashboard/Espectadores';
import RelayRTMP from './pages/dashboard/RelayRTMP';

// Layouts
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Context
import { AuthProvider, useAuth } from './context/AuthContext';
import { StreamProvider } from './context/StreamContext';
import PrivateRoute from './components/PrivateRoute';

// Componente que redireciona baseado na autenticação
const RedirectToProperPlace = () => {
  const { user } = useAuth();
  return <Navigate to={user ? '/dashboard' : '/login'} />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <StreamProvider>
          <Routes>
            {/* Admin Routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/*" element={<Navigate to="/admin/dashboard" />} />

            {/* Auth Routes */}
            <Route path="/" element={<AuthLayout />}>
              <Route index element={<RedirectToProperPlace />} />
              <Route path="login" element={<Login />} />
              <Route path="forgot-password" element={<ForgotPassword />} />
              <Route path="confirm" element={<ConfirmEmail />} />
              <Route path="reset-password" element={<ResetPassword />} />
              <Route path="auth/callback" element={<AuthCallback />} />
            </Route>

            {/* Dashboard Routes */}
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <DashboardLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="iniciar-transmissao" element={<IniciarTransmissao />} />
              <Route path="dados-conexao" element={<DadosConexao />} />
              <Route path="configuracoes" element={<Configuracoes />} />
              <Route path="players" element={<Players />} />
              <Route path="gerenciarvideos" element={<GerenciarVideos />} />
              <Route path="playlists" element={<Playlists />} />
              <Route path="agendamentos" element={<Agendamentos />} /> 
              <Route path="comerciais" element={<Comerciais />} />
              <Route path="downloadyoutube" element={<DownloadYoutube />} />
              <Route path="migrar-videos-ftp" element={<MigrarVideosFTP />} />
              <Route path="espectadores" element={<Espectadores />} />
              <Route path="relayrtmp" element={<RelayRTMP />} />
            </Route>

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
          <ToastContainer position="top-right" autoClose={3000} theme="colored" />
        </StreamProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;