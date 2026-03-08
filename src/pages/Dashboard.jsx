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
    if (!role) return // Attendre que le rôle soit chargé
    
    if (role === 'ADMIN') {
      console.log('🔀 [Dashboard] Redirection Admin vers /admin/users')
      navigate('/admin/users', { replace: true })
    } else if (role === 'RELATION_CLIENT') {
      console.log('🔀 [Dashboard] Redirection RC vers /rc/dossiers')
      navigate('/rc/dossiers', { replace: true })
    } else if (role === 'PRESTATION') {
      console.log('🔀 [Dashboard] Redirection Prestation vers /prestation/dashboard')
      navigate('/prestation/dashboard', { replace: true })
    } else if (role === 'FINANCE') {
      console.log('🔀 [Dashboard] Redirection Finance vers /finance/dashboard')
      navigate('/finance/dashboard', { replace: true })
    }
  }, [role, navigate]) // Redirige dès que le rôle est disponible

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
      case 'PRESTATION':
        return {
          title: 'Espace Prestation',
          icon: '📊',
          description: 'Gérez les dossiers au niveau Prestation.'
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
    <div className="min-h-screen bg-comar-neutral-bg p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl border border-comar-neutral-border p-8">
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-comar-navy">
              {roleInfo.title}
            </h1>
          </div>
          
          <div className="mb-6">
            <p className="text-gray-600 mb-3">
              {roleInfo.description}
            </p>
            <div className="bg-comar-neutral-bg rounded-xl p-4 space-y-1">
              <p className="text-sm text-gray-600">
                Email : <span className="font-medium text-comar-navy">{user?.email}</span>
              </p>
              <p className="text-sm text-gray-600">
                Rôle : <span className="font-medium text-comar-navy">{role || 'Non défini'}</span>
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
