import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

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
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
          Connexion
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            Connexion réussie ! Redirection...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            name="email"
            placeholder="exemple@email.com"
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
      </div>
    </div>
  )
}
