import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ProtectedRoute from './components/ProtectedRoute'
import DossiersList from './pages/rc/DossiersList'
import NewDossier from './pages/rc/NewDossier'
import DossierDetail from './pages/rc/DossierDetail'
import UsersList from './pages/admin/UsersList'
import NewUser from './pages/admin/NewUser'
import AgencesList from './pages/admin/AgencesList'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Routes Relation Client */}
          <Route
            path="/rc/dossiers"
            element={
              <ProtectedRoute allowedRoles={['RELATION_CLIENT']}>
                <DossiersList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rc/dossiers/nouveau"
            element={
              <ProtectedRoute allowedRoles={['RELATION_CLIENT']}>
                <NewDossier />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rc/dossiers/:id"
            element={
              <ProtectedRoute allowedRoles={['RELATION_CLIENT']}>
                <DossierDetail />
              </ProtectedRoute>
            }
          />

          {/* Routes Admin */}
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <UsersList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users/nouveau"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <NewUser />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/agences"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AgencesList />
              </ProtectedRoute>
            }
          />

          {/* Page non autorisé */}
          <Route 
            path="/unauthorized" 
            element={
              <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-gray-800 mb-2">Accès non autorisé</h1>
                  <p className="text-gray-600 mb-4">Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
                  <button 
                    onClick={() => window.history.back()} 
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    Retour
                  </button>
                </div>
              </div>
            } 
          />
          
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
