// Composants de navigation et gestion des routes
import { Link, useNavigate, useLocation } from 'react-router-dom'
// Hook pour accéder au contexte d'authentification
import { useAuth } from '../contexts/AuthContext'
import NotificationBell from './NotificationBell'
import comarLogo from '../assets/LogoCOMAR.png'

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
    { to: '/rc/dossiers', label: 'Mes Dossiers', icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>) },
    { to: '/rc/dossiers/nouveau', label: 'Nouveau Dossier', icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>) },
  ]

  return (
    <div className="min-h-screen bg-comar-neutral-bg">
      {/* Sidebar */}
      <aside className="w-64 bg-comar-navy fixed h-full flex flex-col shadow-xl">
        {/* Header branding */}
        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="bg-white rounded-lg px-2 py-1">
              <img src={comarLogo} alt="COMAR Assurances" className="h-8 w-auto object-contain" />
            </div>
            <NotificationBell />
          </div>
          <p className="text-[11px] text-white/40 mt-1">Relation Client</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 overflow-y-auto">
          <p className="px-3 py-2 text-[10px] font-semibold text-white/40 uppercase tracking-wider">Menu</p>
          <div className="space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive(link.to)
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-white/60 hover:text-white hover:bg-white/8'
                }`}
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Footer utilisateur */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-comar-red/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-comar-red-light">{user?.email?.[0]?.toUpperCase() || 'U'}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-white/40">Connecté</p>
              <p className="text-xs font-medium text-white/80 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-3 py-2 bg-white/8 text-white/70 text-sm font-medium rounded-xl hover:bg-comar-red hover:text-white transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Contenu principal */}
      <main className="ml-64">
        {children}
      </main>
    </div>
  )
}
