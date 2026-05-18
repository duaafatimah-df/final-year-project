import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';

import Home from './pages/Home';
import Auth from './pages/Auth';
import ContributorPortal from './pages/ContributorPortal';
import ReceiverPortal from './pages/ReceiverPortal';
import AdminPortal from './pages/AdminPortal';
import BrowsePage from './pages/BrowsePage';
import MapPage from './pages/MapPage';

import OrganizationProfile from './pages/OrganizationProfile';
import DonationWizard from './pages/DonationWizard';
import ZakatCalculator from './pages/ZakatCalculator';

import './App.css';

const AppContent = () => {
  const location = useLocation();
  const isPortal = location.pathname.startsWith('/contributor') || location.pathname.startsWith('/receiver') || location.pathname.startsWith('/admin') || location.pathname.startsWith('/map') || location.pathname.startsWith('/organization') || location.pathname.startsWith('/donate');

  return (
    <div className="app-container">
      {!isPortal && <Navbar />}
      <main>
        <GlobalErrorBoundary>
          <Routes>
          {/* Public routes */}
          <Route path="/" element={<Home />} />
          <Route path="/auth/:type" element={<Auth />} />
          <Route path="/organization/:id" element={<OrganizationProfile />} />
          <Route path="/donate/:orgId" element={<DonationWizard />} />
          <Route path="/zakat" element={<ZakatCalculator />} />
          <Route path="/browse" element={<BrowsePage />} />
          <Route path="/map" element={<MapPage />} />

          {/* Protected Routes */}
          <Route path="/contributor" element={<ProtectedRoute allowedRoles={['donor']}><ContributorPortal /></ProtectedRoute>} />
          <Route path="/receiver"    element={<ProtectedRoute allowedRoles={['receiver']}><ReceiverPortal /></ProtectedRoute>} />
          <Route path="/admin"       element={<ProtectedRoute allowedRoles={['admin']}><AdminPortal /></ProtectedRoute>} />
          </Routes>
        </GlobalErrorBoundary>
      </main>
      {!isPortal && <Footer />}
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
