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
  const [loading, setLoading] = useState(true)  // État de chargement initial

  useEffect(() => {
    // Vérification de l'utilisateur au montage du composant
    checkUser()

    // Écoute des changements d'état d'authentification
    // Se déclenche lors du login/logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        // Si l'utilisateur est connecté, on récupère son rôle
        await fetchUserRole(session.user.id)
        setUser(session.user)
      } else {
        // Si déconnecté, on réinitialise les états
        setUser(null)
        setRole(null)
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
        setUser(session.user)
        console.log('👤 [AuthContext] Utilisateur:', session.user.email)
        await fetchUserRole(session.user.id)
      }
    } catch (error) {
      console.error('❌ [AuthContext] Erreur lors de la vérification:', error)
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
        .select('role_id, roles(id, name, description)')  // JOIN avec la table roles
        .eq('id', userId)        // Filtre : id = userId
        .single()                // On attend un seul résultat

      console.log('📦 [AuthContext] Données brutes reçues:', JSON.stringify(data, null, 2))
      
      if (error) {
        console.error('❌ [AuthContext] Erreur Supabase:', error)
        throw error
      }
      
      // Extraire le nom du rôle - peut être dans data.roles.name ou data.roles[0].name
      let roleName = null
      if (data?.roles) {
        if (Array.isArray(data.roles)) {
          roleName = data.roles[0]?.name || null
        } else {
          roleName = data.roles.name || null
        }
      }
      
      console.log('✅ [AuthContext] Rôle extrait:', roleName || 'Non défini')
      setRole(roleName)
    } catch (error) {
      console.error('❌ [AuthContext] Erreur lors de la récupération du rôle:', error)
      console.error('❌ [AuthContext] Détails:', error.message)
      setRole(null)
    }
  }

  // Fonction de connexion avec email/password
  const signIn = async (email, password) => {
    console.log('🔑 [AuthContext] Tentative de connexion pour:', email)
    // Appel à l'API Supabase Auth pour authentifier l'utilisateur
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      console.error('❌ [AuthContext] Échec de connexion:', error.message)
      throw error
    }
    
    console.log('✅ [AuthContext] Connexion réussie')
    // Récupération des infos utilisateur après connexion
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      console.log('👤 [AuthContext] Utilisateur connecté:', user.email)
      await fetchUserRole(user.id)
    }
  }

  // Fonction de déconnexion
  const signOut = async () => {
    console.log('🚪 [AuthContext] Déconnexion en cours...')
    await supabase.auth.signOut()  // Déconnexion Supabase
    setUser(null)
    setRole(null)
    console.log('✅ [AuthContext] Déconnexion réussie')
  }

  // Valeurs exposées aux composants enfants
  const value = {
    user,      // Objet utilisateur Supabase (id, email, etc.)
    role,      // Rôle de l'utilisateur (RC, Finance, Admin)
    loading,   // true pendant la vérification initiale
    signIn,    // Fonction de connexion
    signOut,   // Fonction de déconnexion
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
