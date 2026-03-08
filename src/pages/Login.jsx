import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import comarLogo from '../assets/LogoCOMAR.png'

export default function Login() {
  const navigate = useNavigate()
  const { signIn } = useAuth()  // Fonction de connexion depuis le contexte
  
  // États locaux pour le formulaire
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)        // État de chargement pendant la requête
  const [error, setError] = useState(null)             // Message d'erreur global
  const [success, setSuccess] = useState(false)        // Indicateur de succès
  const [fieldErrors, setFieldErrors] = useState({})   // Erreurs par champ (email, password)

  // Validation côté client avant l'envoi
  const validate = () => {
    const errors = {}
    // Vérification de l'email
    if (!email.trim()) errors.email = 'L\'email est requis'
    else if (!/\S+@\S+\.\S+/.test(email)) errors.email = 'Email invalide'
    
    // Vérification du mot de passe
    if (!password) errors.password = 'Le mot de passe est requis'
    else if (password.length < 6) errors.password = '6 caractères minimum'
    
    return errors
  }

  // Soumission du formulaire
  const handleSubmit = async (e) => {
    e.preventDefault()  // Empêche le rechargement de la page
    console.log('📝 [Login] Soumission du formulaire')
    setError(null)
    setSuccess(false)

    // Validation des champs
    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      console.log('⚠️ [Login] Erreurs de validation:', errors)
      return  // Arrêt si erreurs de validation
    }

    console.log('✅ [Login] Validation réussie, tentative de connexion...')
    setLoading(true)  // Activation du loader

    try {
      // Appel à la fonction de connexion (via AuthContext)
      // Cette fonction appelle Supabase Auth et récupère le rôle
      await signIn(email, password)
      
      console.log('🎉 [Login] Connexion réussie ! Redirection dans 1s...')
      setSuccess(true)
      // Redirection vers le dashboard après 1 seconde
      setTimeout(() => {
        console.log('🔀 [Login] Redirection vers /dashboard')
        navigate('/dashboard')
      }, 1000)
    } catch (err) {
      // Gestion des erreurs (mauvais identifiants, problème réseau, etc.)
      console.error('❌ [Login] Erreur:', err.message)
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)  // Désactivation du loader
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-comar-navy via-comar-navy-light to-comar-navy-dark relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-comar-red/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-comar-navy-light/30 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-10">
          {/* Logo area */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-24 h-16 mb-4">
              <img src={comarLogo} alt="COMAR Assurances" className="h-full w-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-comar-navy">
              PrestaTrack
            </h1>
            <p className="text-sm text-gray-500 mt-1">COMAR Assurances — Gestion des Prestations</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-comar-red-50 border border-comar-red/20 text-comar-red rounded-xl text-sm flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              Connexion réussie ! Redirection...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email"
              type="email"
              name="email"
              placeholder="exemple@comar.tn"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: null })) }}
              error={fieldErrors.email}
              disabled={loading}
            />

            <Input
              label="Mot de passe"
              type="password"
              name="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: null })) }}
              error={fieldErrors.password}
              disabled={loading}
            />

            <Button type="submit" variant="primary" loading={loading}>
              Se connecter
            </Button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            © {new Date().getFullYear()} COMAR Assurances — PrestaTrack
          </p>
        </div>
      </div>
    </div>
  )
}
