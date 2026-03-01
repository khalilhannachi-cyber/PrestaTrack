import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [isActive, setIsActive] = useState(true)
  const [loading, setLoading] = useState(true)

  /**
   * Récupère le rôle depuis la table users (avec JOIN roles)
   * @returns {{ roleName: string|null, active: boolean }}
   */
  const fetchRole = async (userId) => {
    console.log('🔍 [Auth] Fetching role for:', userId)
    const { data, error } = await supabase
      .from('users')
      .select('is_active, roles(name)')
      .eq('id', userId)
      .single()

    if (error || !data) {
      console.error('❌ [Auth] Role fetch error:', error?.message)
      return { roleName: null, active: false }
    }

    const roleName = Array.isArray(data.roles)
      ? data.roles[0]?.name || null
      : data.roles?.name || null

    console.log('✅ [Auth] Role:', roleName, '| Active:', data.is_active)
    return { roleName, active: data.is_active ?? false }
  }

  // ═══════════════════════════════════════════════════════════════
  // UNIQUE source de vérité : onAuthStateChange
  // Gère INITIAL_SESSION (refresh/nouvel onglet), SIGNED_IN, 
  // TOKEN_REFRESHED et SIGNED_OUT
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    let mounted = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔔 [Auth] Event:', event, session?.user?.email || 'no user')

        if (!mounted) return

        // ── SIGNED_OUT ──────────────────────────────────────────
        if (event === 'SIGNED_OUT' || !session?.user) {
          setUser(null)
          setRole(null)
          setIsActive(true)
          setLoading(false)
          return
        }

        // ── TOKEN_REFRESHED ─────────────────────────────────────
        // Le rôle ne change pas, on met juste à jour l'objet user
        if (event === 'TOKEN_REFRESHED') {
          console.log('🔄 [Auth] Token refreshed, updating user object')
          setUser(session.user)
          return
        }

        // ── INITIAL_SESSION ou SIGNED_IN ────────────────────────
        // On met le user immédiatement, puis on fetch le rôle
        // setTimeout(fn, 0) pour éviter le deadlock Supabase interne
        setUser(session.user)

        setTimeout(async () => {
          if (!mounted) return

          try {
            const { roleName, active } = await fetchRole(session.user.id)

            if (!mounted) return

            if (!active) {
              console.warn('⚠️ [Auth] User inactive, signing out')
              setUser(null)
              setRole(null)
              setIsActive(false)
              await supabase.auth.signOut()
            } else if (!roleName) {
              console.warn('⚠️ [Auth] No role, signing out')
              setUser(null)
              setRole(null)
              await supabase.auth.signOut()
            } else {
              setRole(roleName)
              setIsActive(true)
            }
          } catch (err) {
            console.error('❌ [Auth] Error in role fetch:', err)
            // En cas d'erreur réseau, on garde le user connecté
            // plutôt que de le déconnecter
          } finally {
            if (mounted) setLoading(false)
          }
        }, 0)
      }
    )

    // Timeout de sécurité : si rien ne se passe en 8 secondes, arrêter le loading
    const safetyTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('⚠️ [Auth] Safety timeout - forcing loading=false')
        setLoading(false)
      }
    }, 8000)

    return () => {
      mounted = false
      clearTimeout(safetyTimeout)
      subscription.unsubscribe()
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════
  // Connexion
  // ═══════════════════════════════════════════════════════════════
  const signIn = async (email, password) => {
    console.log('🔑 [Auth] Signing in:', email)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      console.error('❌ [Auth] Sign in error:', error.message)
      throw error
    }

    // Fetch le rôle immédiatement pour que Login puisse naviguer
    if (data?.user) {
      const { roleName, active } = await fetchRole(data.user.id)

      if (!active) {
        await supabase.auth.signOut()
        throw new Error('Votre compte a été désactivé. Contactez un administrateur.')
      }

      if (!roleName) {
        await supabase.auth.signOut()
        throw new Error('Aucun rôle valide assigné à votre compte. Contactez un administrateur.')
      }

      setUser(data.user)
      setRole(roleName)
      setIsActive(true)
      setLoading(false)
      console.log('✅ [Auth] Signed in successfully, role:', roleName)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Déconnexion
  // ═══════════════════════════════════════════════════════════════
  const signOut = async () => {
    console.log('🚪 [Auth] Signing out')
    await supabase.auth.signOut()
    setUser(null)
    setRole(null)
    setIsActive(true)
  }

  const value = { user, role, isActive, loading, signIn, signOut }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
