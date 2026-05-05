// Gestion du routage et de la navigation
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
// Contexte d'authentification pour toute l'application
import { AuthProvider } from './contexts/AuthContext'
// Pages publiques
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
// Composant de protection des routes
import ProtectedRoute from './components/ProtectedRoute'
import { Toaster } from 'react-hot-toast'
// Pages Relation Client
import DossiersList from './pages/rc/DossiersList'
import NewDossier from './pages/rc/NewDossier'
import DossierDetail from './pages/rc/DossierDetail'
// Pages Administrateur
import ServicesMonitoring from './pages/admin/ServicesMonitoring'
import UsersList from './pages/admin/UsersList'
import NewUser from './pages/admin/NewUser'
import AgencesList from './pages/admin/AgencesList'
// Pages Prestation
import PrestationDashboard from './pages/prestation/PrestationDashboard'
// Pages Finance
import FinanceDashboard from './pages/Finance/FinanceDashboard'
// Page Notifications
import NotificationsPage from './pages/NotificationsPage'

/**
 * Composant principal de l'application PrestaTrack
 * Définit toutes les routes et gère la protection par authentification et rôles
 * 
 * Structure des routes :
 * - / : Redirection vers /login
 * - /login : Page de connexion (publique)
 * - /dashboard : Tableau de bord (protégé)
 * - /rc/* : Pages Relation Client (rôle RELATION_CLIENT requis)
 * - /admin/* : Pages Administration (rôle ADMIN requis)
 * - /unauthorized : Page d'erreur d'accès
 */
function App() {
  return (
    // AuthProvider enveloppe toute l'application pour fournir le contexte d'authentification
    <AuthProvider>
      <Toaster 
        position="top-center" 
        toastOptions={{
          style: {
            background: '#ffffff',
            color: '#1a202c',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            borderRadius: '0.75rem',
            padding: '16px',
            fontSize: '14px',
            fontWeight: '500'
          },
          success: {
            iconTheme: {
              primary: '#059669', // emerald-600
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#dc2626', // red-600
              secondary: '#fff',
            },
          },
        }}
      />
      <BrowserRouter>
        <Routes>
          {/* Route publique - Page de connexion */}
          <Route path="/login" element={<Login />} />
          
          {/* Route protégée - Dashboard accessible à tous les utilisateurs authentifiés */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Route protégée - Notifications globales */}
          <Route 
            path="/notifications" 
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            } 
          />
          
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* Routes Relation Client - Réservées au rôle RELATION_CLIENT     */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          
          {/* Liste de tous les dossiers */}
          <Route
            path="/rc/dossiers"
            element={
              <ProtectedRoute allowedRoles={['RELATION_CLIENT', 'ADMIN']}>
                <DossiersList />
              </ProtectedRoute>
            }
          />

            <Route
              path="/rc/dossiers/nouveau"
              element={
                <ProtectedRoute allowedRoles={['RELATION_CLIENT', 'ADMIN']}>
                  <NewDossier />
                </ProtectedRoute>
              }
            />

            <Route
              path="/rc/dossiers-en-ligne"
              element={
                <ProtectedRoute allowedRoles={['RELATION_CLIENT', 'ADMIN']}>
                  <Navigate to="/rc/dossiers" replace />
                </ProtectedRoute>
              }
            />
          
          {/* Détail d'un dossier spécifique (avec paramètre :id) */}
          <Route
            path="/rc/dossiers/:id"
            element={
              <ProtectedRoute allowedRoles={['RELATION_CLIENT', 'ADMIN']}>
                <DossierDetail />
              </ProtectedRoute>
            }
          />

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* Routes Administration - Réservées au rôle ADMIN                */}
          {/* ═══════════════════════════════════════════════════════════════ */}

          {/* Monitoring des services (RC / Prestation / Finance) */}
          <Route
            path="/admin/monitoring"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <ServicesMonitoring />
              </ProtectedRoute>
            }
          />
          
          {/* Liste de tous les utilisateurs */}
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <UsersList />
              </ProtectedRoute>
            }
          />
          
          {/* Création d'un nouvel utilisateur */}
          <Route
            path="/admin/users/nouveau"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <NewUser />
              </ProtectedRoute>
            }
          />
          
          {/* Gestion des agences */}
          <Route
            path="/admin/agences"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AgencesList />
              </ProtectedRoute>
            }
          />

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* Routes Prestation - Réservées au rôle PRESTATION              */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          
          {/* Dashboard des prestations */}
          <Route
            path="/prestation/dashboard"
            element={
              <ProtectedRoute allowedRoles={['PRESTATION', 'ADMIN']}>
                <PrestationDashboard />
              </ProtectedRoute>
            }
          />

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* Routes Finance - Réservées au rôle FINANCE                     */}
          {/* ═══════════════════════════════════════════════════════════════ */}

          {/* Dashboard Finance */}
          <Route
            path="/finance/dashboard"
            element={
              <ProtectedRoute allowedRoles={['FINANCE', 'ADMIN']}>
                <FinanceDashboard />
              </ProtectedRoute>
            }
          />

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* Routes d'erreur et de redirection                              */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          
          {/* Page affichée quand l'utilisateur n'a pas les droits requis */}
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
          
          {/* Route racine - Redirection automatique vers la page de connexion */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Route 404 - Page non trouvée */}
          <Route 
            path="*" 
            element={
              <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center">
                  <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Page non trouvée</h2>
                  <p className="text-gray-600 mb-6">La page que vous recherchez n'existe pas.</p>
                  <button 
                    onClick={() => window.location.href = '/login'} 
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
                  >
                    Retour à l'accueil
                  </button>
                </div>
              </div>
            } 
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
