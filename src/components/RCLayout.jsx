// Composants de navigation et gestion des routes
import { Link, useNavigate, useLocation } from 'react-router-dom'
// Hook pour accéder au contexte d'authentification
import { useAuth } from '../contexts/AuthContext'
import NotificationBell from './NotificationBell'

/**
 * Layout (mise en page) pour les pages Relation Client
 * Affiche une sidebar avec les menus RC et les informations utilisateur
 * 
 * @param {Object} props - Propriétés du composant
 * @param {React.ReactNode} props.children - Contenu de la page à afficher dans le layout
 * 
 * @returns {React.ReactNode} Le layout avec sidebar et contenu
 */
export default function RCLayout({ children }) {
  const navigate = useNavigate() // Hook pour la navigation programmatique
  const location = useLocation() // Hook pour obtenir la route actuelle
  const { user, signOut } = useAuth() // Récupération des données utilisateur et fonction de déconnexion

  /**
   * Gère la déconnexion de l'utilisateur
   * Appelle la fonction signOut puis redirige vers /login
   */
  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  /**
   * Vérifie si un lien de navigation est actif
   * @param {string} path - Chemin à vérifier
   * @returns {boolean} true si le chemin correspond à la route actuelle ou à un sous-chemin
   */
  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  // Configuration des liens de navigation pour Relation Client
  const navLinks = [
    { to: '/rc/dossiers', label: 'Mes Dossiers', icon: '📁' },
    { to: '/rc/dossiers/nouveau', label: 'Nouveau Dossier', icon: '➕' },
  ]

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Sidebar - Navigation secondaire                                */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <aside className="w-64 bg-white shadow-lg fixed h-full">
        {/* Header de la sidebar */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">📋 Relation Client</h1>
              <p className="text-sm text-gray-500 mt-1">PrestaTrack</p>
            </div>
            <NotificationBell />
          </div>
        </div>

        {/* Navigation principale */}
        <nav className="p-4">
          <div className="space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition ${
                  isActive(link.to)
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="text-xl mr-3">{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Footer de la sidebar - Informations utilisateur */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
          {/* Informations utilisateur */}
          <div className="mb-3">
            <p className="text-xs text-gray-500">Connecté en tant que :</p>
            <p className="text-sm font-medium text-gray-800 truncate">
              {user?.email}
            </p>
          </div>

          {/* Bouton de déconnexion */}
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition flex items-center justify-center"
          >
            <span className="mr-2">🚪</span>
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Contenu principal de la page                                   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <main className="flex-1 ml-64">
        {children}
      </main>
    </div>
  )
}
