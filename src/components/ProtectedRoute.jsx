import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// Composant de protection des routes
// Vérifie si l'utilisateur est authentifié avant d'afficher le contenu
// Utilisation : <ProtectedRoute allowedRoles={['RELATION_CLIENT']}><Dashboard /></ProtectedRoute>
export default function ProtectedRoute({ children, allowedRoles }) {
  // Récupération de l'état d'authentification depuis le contexte
  const { user, role, loading } = useAuth()

  console.log('🛡️ [ProtectedRoute] État:', { loading, authenticated: !!user, role, allowedRoles })

  // Pendant le chargement initial, affichage d'un loader
  // Évite de rediriger trop tôt avant de vérifier l'authentification
  if (loading) {
    console.log('⏳ [ProtectedRoute] Chargement en cours...')
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-600">Chargement...</div>
      </div>
    )
  }

  // Si aucun utilisateur n'est connecté, redirection vers /login
  // 'replace' empêche de revenir en arrière vers la page protégée
  if (!user) {
    console.log('🚫 [ProtectedRoute] Non authentifié, redirection vers /login')
    return <Navigate to="/login" replace />
  }

  // Vérifier si le rôle est autorisé (si des rôles sont spécifiés)
  if (allowedRoles && !allowedRoles.includes(role)) {
    console.log('🚫 [ProtectedRoute] Rôle non autorisé, redirection vers /unauthorized')
    return <Navigate to="/unauthorized" replace />
  }

  console.log('✅ [ProtectedRoute] Accès autorisé')
  // Si l'utilisateur est authentifié, affichage du contenu protégé
  return children
}
