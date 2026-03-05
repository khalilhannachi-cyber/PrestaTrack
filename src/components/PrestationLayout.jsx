// Composants de navigation et gestion des routes
import { Link, useNavigate, useLocation } from 'react-router-dom'
// Hook pour accéder au contexte d'authentification
import { useAuth } from '../contexts/AuthContext'
import NotificationBell from './NotificationBell'

/**
 * Layout (mise en page) pour les pages Prestation
 * Affiche une barre de navigation avec les liens prestation et les informations utilisateur
 * 
 * @param {Object} props - Propriétés du composant
 * @param {React.ReactNode} props.children - Contenu de la page à afficher dans le layout
 * 
 * @returns {React.ReactNode} Le layout avec navigation et contenu
 */
export default function PrestationLayout({ children }) {
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

  // Configuration des liens de navigation pour la prestation
  const navLinks = [
    { to: '/prestation/dashboard', label: 'Dashboard', icon: '📊' },
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ══════════════════════════════════════════════════════════ */}
      {/* Header / Barre de navigation                               */}
      {/* ══════════════════════════════════════════════════════════ */}
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo / Titre de la section prestation */}
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-800">
                📋 Prestation - PrestaTrack
              </h1>
            </div>

            {/* Liens de navigation et actions utilisateur */}
            <div className="flex items-center space-x-4">
              {/* Génération dynamique des liens de navigation */}
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                    isActive(link.to)
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="mr-2">{link.icon}</span>
                  {link.label}
                </Link>
              ))}

              {/* Séparateur visuel */}
              <div className="h-6 w-px bg-gray-300"></div>

              <NotificationBell />

              {/* Affichage de l'email de l'utilisateur connecté */}
              <div className="text-sm text-gray-600">
                {user?.email}
              </div>

              {/* Bouton de déconnexion */}
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition"
              >
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* Contenu principal de la page                               */}
      {/* ══════════════════════════════════════════════════════════ */}
      <main>
        {children}
      </main>
    </div>
  )
}
