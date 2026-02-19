// React hooks pour la gestion d'état et effets
import { createContext, useContext, useState, useEffect } from 'react'
// Client Supabase pour l'authentification et les requêtes DB
import { supabase } from '../lib/supabaseClient'

/**
 * Contexte d'authentification pour PrestaTrack
 * Gère l'état de connexion, les rôles utilisateurs et la vérification de session
 * Ce contexte est partagé dans toute l'application via AuthProvider
 */
const AuthContext = createContext({})

/**
 * Hook personnalisé pour accéder au contexte d'authentification
 * 
 * @throws {Error} Si utilisé en dehors d'un AuthProvider
 * @returns {Object} Le contexte d'authentification avec user, role, loading, signIn, signOut
 * 
 * @example
 * const { user, role, signIn, signOut, loading } = useAuth()
 */
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/**
 * Provider qui enveloppe l'application et fournit le contexte d'authentification
 * Gère automatiquement la vérification de session et l'écoute des changements d'auth
 * 
 * @param {Object} props - Propriétés du composant
 * @param {React.ReactNode} props.children - Composants enfants à envelopper
 */
export const AuthProvider = ({ children }) => {
  // ═══════════════════════════════════════════════════════════════
  // États locaux pour stocker les informations de l'utilisateur
  // ═══════════════════════════════════════════════════════════════
  const [user, setUser] = useState(null)        // Utilisateur Supabase Auth (id, email, etc.)
  const [role, setRole] = useState(null)        // Rôle depuis la table users (ADMIN, RELATION_CLIENT, etc.)
  const [isActive, setIsActive] = useState(true) // Statut actif de l'utilisateur dans la DB
  const [loading, setLoading] = useState(true)  // État de chargement initial (true jusqu'à vérification) (true jusqu'à vérification)

  // ═══════════════════════════════════════════════════════════════
  // Effect Hook - Initialisation et écoute des changements d'auth
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    // Vérification de la session au montage du composant
    checkUser()

    // Écoute en temps réel des changements d'état d'authentification
    // Se déclenche lors du login, logout, refresh token, etc.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Log de débogage pour suivre les événements d'authentification
      console.log('🔔 [AuthContext] Auth state changed:', event)
      
      if (session?.user) {
        // ─────────────────────────────────────────────────────────
        // Cas 1 : Utilisateur connecté - Vérification des droits
        // ─────────────────────────────────────────────────────────
        console.log('👤 [AuthContext] Session active pour:', session.user.email)
        
        try {
          // Vérifier que l'utilisateur existe dans la DB, est actif, et a un rôle valide
          await fetchUserRole(session.user.id)
          setUser(session.user)
          console.log('✅ [AuthContext] Utilisateur autorisé')
        } catch (error) {
          // Si l'utilisateur est inactif, n'existe pas, ou n'a pas de rôle valide
          console.error('❌ [AuthContext] Utilisateur non autorisé:', error.message)
          console.warn('🚪 [AuthContext] Déconnexion automatique')
          
          // Déconnexion forcée pour des raisons de sécurité
          await supabase.auth.signOut()
          setUser(null)
          setRole(null)
          setIsActive(false)
        }
      } else {
        // ─────────────────────────────────────────────────────────
        // Cas 2 : Utilisateur déconnecté - Réinitialisation
        // ─────────────────────────────────────────────────────────
        console.log('🚪 [AuthContext] Utilisateur déconnecté')
        setUser(null)
        setRole(null)
        setIsActive(true)
      }
    })

    // Nettoyage : désabonnement lors du démontage du composant
    return () => subscription.unsubscribe()
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // Fonction : Vérification de la session au chargement initial
  // ═══════════════════════════════════════════════════════════════
  /**
   * Vérifie si une session existe au chargement de l'application
   * Valide que l'utilisateur existe dans la DB, est actif et a un rôle
   */
  const checkUser = async () => {
    try {
      console.log('🔍 [AuthContext] Vérification de la session...')
      const { data: { session } } = await supabase.auth.getSession()
      console.log('📝 [AuthContext] Session récupérée:', session ? 'Utilisateur connecté' : 'Pas de session')
      
      if (session?.user) {
        console.log('👤 [AuthContext] Utilisateur trouvé:', session.user.email)
        
        try {
          // Vérifier que l'utilisateur existe dans la table users et est actif
          await fetchUserRole(session.user.id)
          
          // Si fetchUserRole réussit, l'utilisateur est valide
          setUser(session.user)
          console.log('✅ [AuthContext] Session valide, utilisateur autorisé')
        } catch (roleError) {
          // L'utilisateur n'existe pas dans users, est inactif, ou n'a pas de rôle valide
          console.error('❌ [AuthContext] Utilisateur non valide:', roleError.message)
          console.warn('🚪 [AuthContext] Déconnexion automatique - Utilisateur non autorisé')
          
          // Déconnecter l'utilisateur
          await supabase.auth.signOut()
          setUser(null)
          setRole(null)
          setIsActive(false)
        }
      }
    } catch (error) {
      console.error('❌ [AuthContext] Erreur lors de la vérification:', error)
      // En cas d'erreur, on déconnecte par sécurité
      await supabase.auth.signOut()
      setUser(null)
      setRole(null)
      setIsActive(false)
    } finally {
      setLoading(false)
      console.log('✅ [AuthContext] Vérification terminée')
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Fonction : Récupération du rôle et validation de l'utilisateur
  // ═══════════════════════════════════════════════════════════════
  /**
   * Récupère le rôle depuis la table 'users' et valide l'utilisateur
   * Effectue 3 vérifications critiques :
   * 1. L'utilisateur existe-t-il dans la table users ?
   * 2. L'utilisateur est-il actif (is_active = true) ?
   * 3. L'utilisateur a-t-il un rôle valide assigné ?
   * 
   * @param {string} userId - ID de l'utilisateur (correspond à auth.users.id)
   * @throws {Error} Si l'utilisateur n'existe pas, est inactif ou n'a pas de rôle
   * @returns {Object} Objet contenant roleName et isActive
   */
  const fetchUserRole = async (userId) => {
    try {
      console.log('🔍 [AuthContext] Récupération du rôle pour:', userId)
      
      // Requête SQL avec JOIN entre users et roles
      const { data, error } = await supabase
        .from('users')           // Table principale
        .select('role_id, is_active, roles(id, name, description)')  // JOIN avec la table roles
        .eq('id', userId)        // Filtre : WHERE id = userId
        .single()                // Attend exactement un résultat (lance une erreur si 0 ou >1)

      console.log('📦 [AuthContext] Données brutes reçues:', JSON.stringify(data, null, 2))
      
      // ─────────────────────────────────────────────────────────
      // VÉRIFICATION 1: L'utilisateur existe-t-il dans la table users ?
      // ─────────────────────────────────────────────────────────
      if (error) {
        console.error('❌ [AuthContext] Erreur Supabase:', error)
        if (error.code === 'PGRST116') {
          // Aucune ligne trouvée - l'utilisateur n'existe pas dans la table users
          throw new Error('Utilisateur non trouvé dans la base de données. Contactez un administrateur.')
        }
        throw error
      }
      
      if (!data) {
        console.error('❌ [AuthContext] Aucune donnée utilisateur trouvée')
        throw new Error('Utilisateur non trouvé dans la base de données. Contactez un administrateur.')
      }
      
      // ─────────────────────────────────────────────────────────
      // VÉRIFICATION 2: L'utilisateur est-il actif ?
      // ─────────────────────────────────────────────────────────
      const userIsActive = data?.is_active ?? false
      console.log('🔒 [AuthContext] Statut actif:', userIsActive)
      setIsActive(userIsActive)
      
      if (!userIsActive) {
        console.warn('⚠️ [AuthContext] Utilisateur inactif - Déconnexion forcée')
        await supabase.auth.signOut()
        setUser(null)
        setRole(null)
        throw new Error('Votre compte a été désactivé. Contactez un administrateur.')
      }
      
      // ─────────────────────────────────────────────────────────
      // VÉRIFICATION 3: L'utilisateur a-t-il un rôle valide ?
      // ─────────────────────────────────────────────────────────
      let roleName = null
      
      // Extraction du nom du rôle depuis la réponse du JOIN
      // (peut être un objet ou un tableau selon la config Supabase)
      if (data?.roles) {
        if (Array.isArray(data.roles)) {
          roleName = data.roles[0]?.name || null
        } else {
          roleName = data.roles.name || null
        }
      }
      
      console.log('✅ [AuthContext] Rôle extrait:', roleName || 'NON DÉFINI')
      
      if (!roleName) {
        console.error('❌ [AuthContext] Aucun rôle valide trouvé pour cet utilisateur')
        await supabase.auth.signOut()
        setUser(null)
        setRole(null)
        throw new Error('Aucun rôle valide assigné à votre compte. Contactez un administrateur.')
      }
      
      // ─────────────────────────────────────────────────────────
      // Tout est validé - Mise à jour de l'état
      // ─────────────────────────────────────────────────────────
      setRole(roleName)
      
      return { roleName, isActive: userIsActive }
    } catch (error) {
      console.error('❌ [AuthContext] Erreur lors de la récupération du rôle:', error)
      console.error('❌ [AuthContext] Détails:', error.message)
      setRole(null)
      setIsActive(false)
      throw error
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Fonction : Connexion (Sign In)
  // ═══════════════════════════════════════════════════════════════
  /**
   * Authentifie un utilisateur avec email et mot de passe
   * Vérifie automatiquement que l'utilisateur est actif et a un rôle valide
   * 
   * @param {string} email - Email de l'utilisateur
   * @param {string} password - Mot de passe
   * @throws {Error} Si les identifiants sont invalides ou l'utilisateur inactif
   */
  const signIn = async (email, password) => {
    console.log('🔑 [AuthContext] Tentative de connexion pour:', email)
    
    // Étape 1 : Authentification via Supabase Auth
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      console.error('❌ [AuthContext] Échec de connexion:', authError.message)
      throw authError
    }
    
    console.log('✅ [AuthContext] Connexion réussie')
    
    // Étape 2 : Récupération des informations utilisateur
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      console.log('👤 [AuthContext] Utilisateur connecté:', user.email)
      
      try {
        // Étape 3 : Vérification du rôle et du statut actif
        await fetchUserRole(user.id)
        // Si fetchUserRole réussit, l'utilisateur est valide et actif
      } catch (roleError) {
        // Si l'utilisateur est inactif ou n'a pas de rôle, on déconnecte
        console.error('❌ [AuthContext] Erreur lors de la vérification:', roleError.message)
        
        // Déconnexion forcée
        await supabase.auth.signOut()
        setUser(null)
        setRole(null)
        setIsActive(false)
        throw roleError
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Fonction : Déconnexion (Sign Out)
  // ═══════════════════════════════════════════════════════════════
  /**
   * Déconnecte l'utilisateur et réinitialise tous les états
   */
  const signOut = async () => {
    console.log('🚪 [AuthContext] Déconnexion en cours...')
    
    // Déconnexion via Supabase Auth
    await supabase.auth.signOut()
    
    // Réinitialisation de tous les états
    setUser(null)
    setRole(null)
    setIsActive(true)
    
    console.log('✅ [AuthContext] Déconnexion réussie')
  }

  // ═══════════════════════════════════════════════════════════════
  // Valeur du contexte exposée aux composants enfants
  // ═══════════════════════════════════════════════════════════════
  const value = {
    user,      // Objet utilisateur Supabase (id, email, metadata, etc.)
    role,      // Rôle de l'utilisateur (ADMIN, RELATION_CLIENT, FINANCE, etc.)
    isActive,  // Statut actif de l'utilisateur (true/false)
    loading,   // Indicateur de chargement (true pendant la vérification initiale)
    signIn,    // Fonction de connexion
    signOut,   // Fonction de déconnexion
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
