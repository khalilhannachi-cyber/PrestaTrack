// Gestion du routage et de la navigation
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
// Contexte d'authentification pour toute l'application
import { AuthProvider } from './contexts/AuthContext'
// Pages publiques
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
// Composant de protection des routes
import ProtectedRoute from './components/ProtectedRoute'
// Pages Relation Client
import DossiersList from './pages/rc/DossiersList'
import NewDossier from './pages/rc/NewDossier'
import DossierDetail from './pages/rc/DossierDetail'
// Pages Administrateur
import UsersList from './pages/admin/UsersList'
import NewUser from './pages/admin/NewUser'
import AgencesList from './pages/admin/AgencesList'

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
          
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* Routes Relation Client - Réservées au rôle RELATION_CLIENT     */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          
          {/* Liste de tous les dossiers */}
          <Route
            path="/rc/dossiers"
            element={
              <ProtectedRoute allowedRoles={['RELATION_CLIENT']}>
                <DossiersList />
              </ProtectedRoute>
            }
          />
          
          {/* Création d'un nouveau dossier */}
          <Route
            path="/rc/dossiers/nouveau"
            element={
              <ProtectedRoute allowedRoles={['RELATION_CLIENT']}>
                <NewDossier />
              </ProtectedRoute>
            }
          />
          
          {/* Détail d'un dossier spécifique (avec paramètre :id) */}
          <Route
            path="/rc/dossiers/:id"
            element={
              <ProtectedRoute allowedRoles={['RELATION_CLIENT']}>
                <DossierDetail />
              </ProtectedRoute>
            }
          />

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* Routes Administration - Réservées au rôle ADMIN                */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          
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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
