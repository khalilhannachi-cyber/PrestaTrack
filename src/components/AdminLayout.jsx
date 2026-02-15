import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AdminLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const navLinks = [
    { to: '/admin/users', label: 'Utilisateurs', icon: '👥' },
    { to: '/admin/agences', label: 'Agences', icon: '🏢' },
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header / Navigation */}
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo / Titre */}
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-800">
                ⚙️ Admin - PrestaTrack
              </h1>
            </div>

            {/* Liens de navigation */}
            <div className="flex items-center space-x-4">
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

              {/* Divider */}
              <div className="h-6 w-px bg-gray-300"></div>

              {/* User info */}
              <div className="text-sm text-gray-600">
                {user?.email}
              </div>

              {/* Bouton Déconnexion */}
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

      {/* Contenu principal */}
      <main>
        {children}
      </main>
    </div>
  )
}
