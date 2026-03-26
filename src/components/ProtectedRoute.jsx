// Gestion de la navigation et redirection
import { Navigate } from 'react-router-dom'
// Hook personnalisé pour accéder au contexte d'authentification
import { useAuth } from '../contexts/AuthContext'

/**
 * Composant de protection des routes
 * Vérifie si l'utilisateur est authentifié et autorisé avant d'afficher le contenu
 * 
 * @param {Object} props - Propriétés du composant
 * @param {React.ReactNode} props.children - Contenu à protéger (affiché uniquement si autorisé)
 * @param {Array<string>} props.allowedRoles - Liste des rôles autorisés (optionnel)
 * 
 * @example
 * <ProtectedRoute allowedRoles={['RELATION_CLIENT']}>
 *   <Dashboard />
 * </ProtectedRoute>
 * 
 * @returns {React.ReactNode} Le contenu protégé, un loader ou une redirection
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  // Récupération de l'état d'authentification depuis le contexte
  const { user, role, loading } = useAuth()

  // Log pour le débogage de l'état d'authentification et d'autorisation
  console.log('️ [ProtectedRoute] État:', { loading, authenticated: !!user, role, allowedRoles })

  // ─────────────────────────────────────────────────────────────────────
  // Étape 1 : Gestion de l'état de chargement
  // ─────────────────────────────────────────────────────────────────────
  // Pendant le chargement initial, affichage d'un loader
  // Évite de rediriger trop tôt avant de vérifier l'authentification
  if (loading) {
    // Log de l'état de chargement pour le débogage
    console.log('⏳ [ProtectedRoute] Chargement en cours...')
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-600">Chargement...</div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────
  // Étape 2 : Vérification de l'authentification
  // ─────────────────────────────────────────────────────────────────────
  // Si aucun utilisateur n'est connecté, redirection vers /login
  // L'option 'replace' empêche de revenir en arrière vers la page protégée
  if (!user) {
    // Log de la redirection pour le débogage
    console.log(' [ProtectedRoute] Non authentifié, redirection vers /login')
    return <Navigate to="/login" replace />
  }

  // ─────────────────────────────────────────────────────────────────────
  // Étape 3 : Vérification de l'autorisation par rôle
  // ─────────────────────────────────────────────────────────────────────
  // Vérifier si le rôle de l'utilisateur est autorisé (si des rôles sont spécifiés)
  // Si allowedRoles est défini et que le rôle actuel n'est pas dans la liste
  if (allowedRoles && !allowedRoles.includes(role)) {
    // Log du refus d'accès pour le débogage
    console.log(' [ProtectedRoute] Rôle non autorisé, redirection vers /unauthorized')
    return <Navigate to="/unauthorized" replace />
  }

  // ─────────────────────────────────────────────────────────────────────
  // Étape 4 : Accès autorisé - Affichage du contenu
  // ─────────────────────────────────────────────────────────────────────
  // Log de succès pour le débogage
  console.log(' [ProtectedRoute] Accès autorisé')
  // Si l'utilisateur est authentifié ET autorisé (par rôle), affichage du contenu protégé
  return children
}
