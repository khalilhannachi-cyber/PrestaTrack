// Composants de navigation et gestion des routes
import { Link, useNavigate, useLocation } from 'react-router-dom'
// Hook pour accéder au contexte d'authentification
import { useAuth } from '../contexts/AuthContext'
import NotificationBell from './NotificationBell'
import comarLogo from '../assets/LogoCOMAR.png'

/**
 * Layout (mise en page) pour les pages d'administration
 * Affiche une barre de navigation avec les liens admin et les informations utilisateur
 * 
 * @param {Object} props - Propriétés du composant
 * @param {React.ReactNode} props.children - Contenu de la page à afficher dans le layout
 * 
 * @returns {React.ReactNode} Le layout avec navigation et contenu
 */
export default function AdminLayout({ children }) {
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

  // Configuration des liens de navigation pour l'administration
  const navLinks = [
    { to: '/admin/monitoring', label: 'Suivi Services', icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" /></svg>) },
    { to: '/admin/users', label: 'Utilisateurs', icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>) },
    { to: '/admin/agences', label: 'Agences', icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5M3.75 3v18m4.5-18v18m4.5-18v18m4.5-18v18M5.25 7.5h1.5m-1.5 3h1.5m-1.5 3h1.5m4.5-6h1.5m-1.5 3h1.5m-1.5 3h1.5m4.5-6h1.5m-1.5 3h1.5m-1.5 3h1.5" /></svg>) },
  ]

  return (
    <div className="min-h-screen bg-comar-neutral-bg">
      {/* Navbar */}
      <nav className="bg-comar-navy shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="bg-white rounded-lg px-2 py-1">
                <img src={comarLogo} alt="COMAR Assurances" className="h-7 w-auto object-contain" />
              </div>
              <div className="h-6 w-px bg-white/20"></div>
              <p className="text-xs text-white/60 font-medium">Administration</p>
            </div>

            {/* Nav links + actions */}
            <div className="flex items-center gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive(link.to)
                      ? 'bg-white/15 text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/8'
                  }`}
                >
                  {link.icon}
                  {link.label}
                </Link>
              ))}

              <div className="h-5 w-px bg-white/15 mx-1"></div>

              <NotificationBell />

              <div className="flex items-center gap-2 ml-1">
                <div className="w-7 h-7 rounded-full bg-comar-red/20 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-comar-red-light">{user?.email?.[0]?.toUpperCase() || 'U'}</span>
                </div>
                <span className="text-xs text-white/70 hidden sm:inline max-w-32 truncate">{user?.email}</span>
              </div>

              <button
                onClick={handleLogout}
                className="ml-1 px-3 py-1.5 bg-white/8 text-white/70 text-xs font-medium rounded-lg hover:bg-comar-red hover:text-white transition-all duration-200 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Contenu principal */}
      <main>
        {children}
      </main>
    </div>
  )
}
