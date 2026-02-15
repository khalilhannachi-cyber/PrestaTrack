import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// Création du contexte d'authentification
// Ce contexte permettra de partager l'état d'authentification dans toute l'app
const AuthContext = createContext({})

// Hook personnalisé pour accéder au contexte d'authentification
// Utilisation : const { user, role, signIn, signOut } = useAuth()
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Provider qui enveloppe l'application et fournit le contexte d'auth
export const AuthProvider = ({ children }) => {
  // États locaux pour stocker les infos de l'utilisateur
  const [user, setUser] = useState(null)        // Utilisateur Supabase Auth
  const [role, setRole] = useState(null)        // Rôle depuis la table users
  const [isActive, setIsActive] = useState(true) // Statut actif de l'utilisateur
  const [loading, setLoading] = useState(true)  // État de chargement initial

  useEffect(() => {
    // Vérification de l'utilisateur au montage du composant
    checkUser()

    // Écoute des changements d'état d'authentification
    // Se déclenche lors du login/logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔔 [AuthContext] Auth state changed:', event)
      
      if (session?.user) {
        // Si l'utilisateur est connecté, on récupère son rôle
        console.log('👤 [AuthContext] Session active pour:', session.user.email)
        
        try {
          // Vérifier que l'utilisateur existe, est actif, et a un rôle valide
          await fetchUserRole(session.user.id)
          setUser(session.user)
          console.log('✅ [AuthContext] Utilisateur autorisé')
        } catch (error) {
          // Si l'utilisateur est inactif, n'existe pas, ou n'a pas de rôle valide
          console.error('❌ [AuthContext] Utilisateur non autorisé:', error.message)
          console.warn('🚪 [AuthContext] Déconnexion automatique')
          
          // Déconnexion forcée
          await supabase.auth.signOut()
          setUser(null)
          setRole(null)
          setIsActive(false)
        }
      } else {
        // Si déconnecté, on réinitialise les états
        console.log('🚪 [AuthContext] Utilisateur déconnecté')
        setUser(null)
        setRole(null)
        setIsActive(true)
      }
    })

    // Nettoyage : désabonnement lors du démontage
    return () => subscription.unsubscribe()
  }, [])

  // Vérification de la session au chargement initial de l'app
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

  // Récupération du rôle depuis la table 'users' dans Supabase
  // L'ID correspond à l'ID de auth.users
  const fetchUserRole = async (userId) => {
    try {
      console.log('🔍 [AuthContext] Récupération du rôle pour:', userId)
      const { data, error } = await supabase
        .from('users')           // Requête sur la table 'users'
        .select('role_id, is_active, roles(id, name, description)')  // JOIN avec la table roles + is_active
        .eq('id', userId)        // Filtre : id = userId
        .single()                // On attend un seul résultat

      console.log('📦 [AuthContext] Données brutes reçues:', JSON.stringify(data, null, 2))
      
      // VÉRIFICATION 1: L'utilisateur existe-t-il dans la table users ?
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
      
      // VÉRIFICATION 2: L'utilisateur est-il actif ?
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
      
      // VÉRIFICATION 3: L'utilisateur a-t-il un rôle valide ?
      let roleName = null
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
      
      // Tout est ok, on peut définir le rôle
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

  // Fonction de connexion avec email/password
  const signIn = async (email, password) => {
    console.log('🔑 [AuthContext] Tentative de connexion pour:', email)
    
    // Appel à l'API Supabase Auth pour authentifier l'utilisateur
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      console.error('❌ [AuthContext] Échec de connexion:', authError.message)
      throw authError
    }
    
    console.log('✅ [AuthContext] Connexion réussie')
    
    // Récupération des infos utilisateur après connexion
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      console.log('👤 [AuthContext] Utilisateur connecté:', user.email)
      
      try {
        // Récupérer le rôle et vérifier si l'utilisateur est actif
        await fetchUserRole(user.id)
        // Si fetchUserRole réussit, l'utilisateur est actif
      } catch (roleError) {
        // Si l'utilisateur est inactif, fetchUserRole lance une erreur
        console.error('❌ [AuthContext] Erreur lors de la vérification:', roleError.message)
        // Déconnecter l'utilisateur
        await supabase.auth.signOut()
        setUser(null)
        setRole(null)
        setIsActive(false)
        throw roleError
      }
    }
  }

  // Fonction de déconnexion
  const signOut = async () => {
    console.log('🚪 [AuthContext] Déconnexion en cours...')
    await supabase.auth.signOut()  // Déconnexion Supabase
    setUser(null)
    setRole(null)
    setIsActive(true)
    console.log('✅ [AuthContext] Déconnexion réussie')
  }

  // Valeurs exposées aux composants enfants
  const value = {
    user,      // Objet utilisateur Supabase (id, email, etc.)
    role,      // Rôle de l'utilisateur (RC, Finance, Admin)
    isActive,  // Statut actif de l'utilisateur
    loading,   // true pendant la vérification initiale
    signIn,    // Fonction de connexion
    signOut,   // Fonction de déconnexion
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
