import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useEffect } from 'react'
import Button from '../components/ui/Button'

export default function Dashboard() {
  const navigate = useNavigate()
  // Récupération des infos utilisateur depuis le contexte
  const { user, role, signOut } = useAuth()

  console.log('📊 [Dashboard] Rendu avec:', { email: user?.email, role })

  // Redirection automatique selon le rôle au montage du composant
  // ⚠️ Important : Ne s'exécute qu'une fois au montage pour éviter les boucles de redirection
  // Le rôle ne devrait pas changer pendant la durée de vie de ce composant
  useEffect(() => {
    if (role === 'ADMIN') {
      console.log('🔀 [Dashboard] Redirection Admin vers /admin/users')
      navigate('/admin/users', { replace: true })
    } else if (role === 'RELATION_CLIENT') {
      console.log('🔀 [Dashboard] Redirection RC vers /rc/dossiers')
      navigate('/rc/dossiers', { replace: true })
    } else if (role === 'FINANCE') {
      console.log('🔀 [Dashboard] Redirection Finance vers /finance/dashboard')
      // navigate('/finance/dashboard', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // On évite [role, navigate] pour ne rediriger qu'une seule fois

  // Fonction de déconnexion
  const handleLogout = async () => {
    console.log('🚪 [Dashboard] Déconnexion demandée')
    await signOut()           // Appel à Supabase pour déconnecter
    console.log('🔀 [Dashboard] Redirection vers /login')
    navigate('/login')        // Redirection vers la page de login
  }

  // Affichage conditionnel basé sur le rôle de l'utilisateur
  // Chaque rôle a un titre, une icône et une description personnalisés
  const getRoleDisplay = () => {
    switch(role) {
      case 'RELATION_CLIENT':
        return {
          title: 'Espace Relation Client',
          icon: '💼',
          description: 'Gérez vos dossiers clients.'
        }
      case 'FINANCE':
        return {
          title: 'Espace Finance',
          icon: '💰',
          description: 'Accédez aux données financières.'
        }
      case 'ADMIN':
        return {
          title: 'Espace Administrateur',
          icon: '⚙️',
          description: 'Gérez les utilisateurs et les paramètres.'
        }
      default:
        // Rôle par défaut si non défini ou inconnu
        return {
          title: 'Espace Utilisateur',
          icon: '👤',
          description: 'Bienvenue sur PrestaTrack.'
        }
    }
  }

  const roleInfo = getRoleDisplay()

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">{roleInfo.icon}</span>
            <h1 className="text-3xl font-bold text-gray-800">
              {roleInfo.title}
            </h1>
          </div>
          
          <div className="mb-6">
            <p className="text-gray-600 mb-3">
              {roleInfo.description}
            </p>
            <div className="bg-gray-50 rounded-lg p-4 space-y-1">
              <p className="text-sm text-gray-600">
                Email : <span className="font-medium text-gray-700">{user?.email}</span>
              </p>
              <p className="text-sm text-gray-600">
                Rôle : <span className="font-medium text-gray-700">{role || 'Non défini'}</span>
              </p>
            </div>
          </div>
          
          <div className="max-w-xs">
            <Button variant="secondary" onClick={handleLogout}>
              Se déconnecter
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
