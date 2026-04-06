import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useEffect } from 'react'
import Button from '../components/ui/Button'

export default function Dashboard() {
  const navigate = useNavigate()
  // Récupération des infos utilisateur depuis le contexte
  const { user, role, signOut } = useAuth()

  console.log(' [Dashboard] Rendu avec:', { email: user?.email, role })

  // Redirection automatique selon le rôle au montage du composant
  // ️ Important : Ne s'exécute qu'une fois au montage pour éviter les boucles de redirection
  // Le rôle ne devrait pas changer pendant la durée de vie de ce composant
  useEffect(() => {
    if (!role) return // Attendre que le rôle soit chargé
    
    if (role === 'ADMIN') {
      console.log(' [Dashboard] Redirection Admin vers /admin/monitoring')
      navigate('/admin/monitoring', { replace: true })
    } else if (role === 'RELATION_CLIENT') {
      console.log(' [Dashboard] Redirection RC vers /rc/dossiers')
      navigate('/rc/dossiers', { replace: true })
    } else if (role === 'PRESTATION') {
      console.log(' [Dashboard] Redirection Prestation vers /prestation/dashboard')
      navigate('/prestation/dashboard', { replace: true })
    } else if (role === 'FINANCE') {
      console.log(' [Dashboard] Redirection Finance vers /finance/dashboard')
      navigate('/finance/dashboard', { replace: true })
    }
  }, [role, navigate]) // Redirige dès que le rôle est disponible

  // Fonction de déconnexion
  const handleLogout = async () => {
    console.log(' [Dashboard] Déconnexion demandée')
    await signOut()           // Appel à Supabase pour déconnecter
    console.log(' [Dashboard] Redirection vers /login')
    navigate('/login')        // Redirection vers la page de login
  }

  // Affichage conditionnel basé sur le rôle de l'utilisateur
  // Chaque rôle a un titre, une icône et une description personnalisés
  const getRoleDisplay = () => {
    switch(role) {
      case 'RELATION_CLIENT':
        return {
          title: 'Espace Relation Client',
          icon: <svg className="w-10 h-10 mx-auto text-comar-navy" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
          description: 'Gérez vos dossiers clients.'
        }
      case 'PRESTATION':
        return {
          title: 'Espace Prestation',
          icon: <svg className="w-10 h-10 mx-auto text-comar-navy" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
          description: 'Gérez les dossiers au niveau Prestation.'
        }
      case 'FINANCE':
        return {
          title: 'Espace Finance',
          icon: <svg className="w-10 h-10 mx-auto text-comar-navy" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
          description: 'Accédez aux données financières.'
        }
      case 'ADMIN':
        return {
          title: 'Espace Administrateur',
          icon: <svg className="w-10 h-10 mx-auto text-comar-navy" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
          description: 'Gérez les utilisateurs et les paramètres.'
        }
      default:
        // Rôle par défaut si non défini ou inconnu
        return {
          title: 'Espace Utilisateur',
          icon: <svg className="w-10 h-10 mx-auto text-comar-navy" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>,
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
