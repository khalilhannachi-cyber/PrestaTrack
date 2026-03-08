/**
 * Page de création d'un nouvel utilisateur par l'admin
 * 
 * Fonctionnalités :
 * - Formulaire de création avec validation @comar.tn
 * - Validation en temps réel de l'email
 * - Affichage d'une fiche récapitulative après création
 * - Export PDF de la fiche utilisateur
 * - Options : créer un autre utilisateur ou retourner à la liste
 * 
 * ⚠️ Important : La fiche contient le mot de passe en clair
 * Elle doit être téléchargée et conservée en sécurité
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import AdminLayout from '../../components/AdminLayout'

export default function NewUser() {
  const navigate = useNavigate()
  const ficheRef = useRef(null) // Référence pour la zone imprimable
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState([])
  const [emailValid, setEmailValid] = useState(null) // null = pas encore vérifié, true = valide, false = invalide
  const [showFiche, setShowFiche] = useState(false) // Afficher la fiche après création
  const [createdUser, setCreatedUser] = useState(null) // Données de l'utilisateur créé
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role_id: ''
  })

  // Chargement initial des rôles disponibles au montage du composant
  useEffect(() => {
    fetchRoles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // fetchRoles est stable

  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('name')

      if (error) throw error
      setRoles(data || [])
      
      // Sélectionner le premier rôle par défaut
      if (data && data.length > 0) {
        setFormData(prev => ({ ...prev, role_id: data[0].id }))
      }
    } catch (error) {
      console.error('Erreur lors du chargement des rôles:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // ═══════════════════════════════════════════════════════════════
    // VALIDATION : Email @comar.tn uniquement
    // ═══════════════════════════════════════════════════════════════
    if (!formData.email.toLowerCase().endsWith('@comar.tn')) {
      alert('❌ L\'email doit se terminer par @comar.tn\n\nExemple : utilisateur@comar.tn')
      return
    }
    
    setLoading(true)

    try {
      console.log('📝 Création de l\'utilisateur via Edge Function...', formData)

      // ─────────────────────────────────────────────────────────
      // APPEL DE LA EDGE FUNCTION create-user
      // Utilise supabase.functions.invoke() pour une authentification correcte
      // ─────────────────────────────────────────────────────────
      
      console.log('🔗 Appel de la fonction create-user...')

      // Invoquer la fonction avec le SDK Supabase (gère automatiquement l'auth)
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          role_id: formData.role_id
        }
      })

      console.log('📦 Réponse de la fonction:')
      console.log('  ↳ data:', data)
      console.log('  ↳ error:', error)
      console.log('  ↳ error.message:', error?.message)
      console.log('  ↳ error.context:', error?.context)

      if (error) {
        console.error('❌ Erreur retournée:', error)
        // Extraire le message d'erreur détaillé si disponible
        const errorDetails = error.context?.body ? ` - ${JSON.stringify(error.context.body)}` : ''
        throw new Error(error.message + errorDetails || 'Erreur lors de la création de l\'utilisateur')
      }

      if (!data || !data.success || !data.user) {
        console.error('❌ Réponse invalide:', data)
        throw new Error('Réponse invalide de la fonction de création')
      }

      console.log('✅ Utilisateur créé avec succès:', data.user.id)
      
      // ─────────────────────────────────────────────────────────
      // PRÉPARATION DE LA FICHE UTILISATEUR
      // ─────────────────────────────────────────────────────────
      
      // Récupérer le nom du rôle pour l'affichage
      const selectedRole = roles.find(r => r.id === formData.role_id)
      
      // Créer l'objet utilisateur complet pour la fiche
      const userInfo = {
        id: data.user.id,
        email: formData.email,
        password: formData.password, // ⚠️ Pour affichage uniquement dans la fiche
        full_name: formData.full_name,
        role_name: selectedRole?.name || 'Non défini',
        role_description: selectedRole?.description || '',
        created_at: new Date().toISOString()
      }
      
      // ─────────────────────────────────────────────────────────
      // AFFICHAGE DE LA FICHE (au lieu de la redirection)
      // ─────────────────────────────────────────────────────────
      setCreatedUser(userInfo)
      setShowFiche(true)
      
    } catch (error) {
      console.error('❌ Erreur lors de la création:', error)
      
      let errorMessage = 'Erreur lors de la création de l\'utilisateur'
      
      if (error?.message) {
        if (error.message.includes('already')) {
          errorMessage = 'Cet email est déjà utilisé'
        } else if (error.message.includes('password')) {
          errorMessage = 'Le mot de passe doit contenir au moins 6 caractères'
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Impossible de contacter le serveur. Vérifiez votre connexion internet.'
        } else {
          errorMessage = error.message
        }
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      
      console.error('📢 Message final affiché:', errorMessage)
      alert('❌ ' + errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    
    setFormData({
      ...formData,
      [name]: value
    })
    
    // Validation en temps réel de l'email
    if (name === 'email') {
      if (value.trim() === '') {
        setEmailValid(null) // Champ vide, pas encore de validation
      } else {
        setEmailValid(value.toLowerCase().endsWith('@comar.tn'))
      }
    }
  }

  /**
   * Télécharger la fiche en PDF
   * Utilise l'API window.print() avec un style d'impression personnalisé
   */
  const handleDownloadPDF = () => {
    window.print()
  }

  /**
   * Créer un nouvel utilisateur (réinitialise le formulaire)
   */
  const handleCreateAnother = () => {
    setShowFiche(false)
    setCreatedUser(null)
    setFormData({
      email: '',
      password: '',
      full_name: '',
      role_id: roles[0]?.id || ''
    })
    setEmailValid(null)
  }

  /**
   * Retourner à la liste des utilisateurs
   */
  const handleBackToList = () => {
    navigate('/admin/users')
  }

  // Si la fiche est affichée, montrer la fiche utilisateur
  if (showFiche && createdUser) {
    return (
      <AdminLayout>
        <div className="p-6 max-w-4xl mx-auto">
          {/* Boutons d'action - cachés à l'impression */}
          <div className="mb-6 flex gap-4 print:hidden">
            <button
              onClick={handleDownloadPDF}
              className="bg-comar-navy text-white px-6 py-3 rounded-lg hover:bg-comar-navy-light transition flex items-center gap-2 font-semibold"
            >
              Télécharger en PDF
            </button>
            <button
              onClick={handleCreateAnother}
              className="bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition flex items-center gap-2 font-semibold"
            >
              Créer un autre utilisateur
            </button>
            <button
              onClick={handleBackToList}
              className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition flex items-center gap-2 font-semibold"
            >
              Retour à la liste
            </button>
          </div>

          {/* Fiche utilisateur - contenu imprimable */}
          <div
            ref={ficheRef}
            className="bg-white rounded-xl p-8 border-2 border-comar-neutral-border"
          >
            {/* En-tête */}
            <div className="text-center mb-8 border-b-2 border-comar-navy pb-6">
              <h1 className="text-3xl font-bold text-comar-navy mb-2">
                Fiche Utilisateur
              </h1>
              <p className="text-gray-600">Compte créé avec succès</p>
              <div className="mt-4 inline-block bg-green-100 text-green-800 px-4 py-2 rounded-full font-semibold">
                ✅ Activation réussie
              </div>
            </div>

            {/* Informations utilisateur */}
            <div className="space-y-6">
              {/* ID */}
              <div className="border-l-4 border-comar-navy pl-4">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Identifiant unique
                </p>
                <p className="text-lg font-mono text-gray-900 mt-1 break-all">
                  {createdUser.id}
                </p>
              </div>

              {/* Nom complet */}
              <div className="border-l-4 border-green-600 pl-4">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Nom complet
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {createdUser.full_name}
                </p>
              </div>

              {/* Email */}
              <div className="border-l-4 border-purple-600 pl-4">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Adresse email
                </p>
                <p className="text-xl font-semibold text-gray-900 mt-1">
                  {createdUser.email}
                </p>
              </div>

              {/* Mot de passe */}
              <div className="border-l-4 border-red-600 pl-4 bg-red-50 p-4 rounded">
                <p className="text-sm font-medium text-red-700 uppercase tracking-wider flex items-center gap-2">
                  <span>🔒</span> Mot de passe temporaire
                </p>
                <p className="text-xl font-mono font-bold text-red-900 mt-2">
                  {createdUser.password}
                </p>
                <p className="text-xs text-red-600 mt-2">
                  ⚠️ <strong>Important :</strong> Conservez ce mot de passe en lieu sûr. 
                  Il ne sera plus accessible après fermeture de cette page.
                </p>
              </div>

              {/* Rôle */}
              <div className="border-l-4 border-amber-600 pl-4">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Rôle assigné
                </p>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {createdUser.role_name}
                </p>
                {createdUser.role_description && (
                  <p className="text-sm text-gray-600 mt-1">
                    {createdUser.role_description}
                  </p>
                )}
              </div>

              {/* Date de création */}
              <div className="border-l-4 border-gray-600 pl-4">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Date de création
                </p>
                <p className="text-lg text-gray-900 mt-1">
                  {new Date(createdUser.created_at).toLocaleString('fr-FR', {
                    dateStyle: 'full',
                    timeStyle: 'long'
                  })}
                </p>
              </div>
            </div>

            {/* Pied de page */}
            <div className="mt-8 pt-6 border-t-2 border-comar-neutral-border text-center text-sm text-gray-500">
              <p>PrestaTrack - Système de gestion COMAR</p>
              <p className="mt-1">Document généré automatiquement</p>
            </div>
          </div>

          {/* Instructions - cachées à l'impression */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 print:hidden">
            <p className="text-sm text-blue-800">
              <strong>📌 Instructions :</strong>
            </p>
            <ul className="list-disc list-inside text-sm text-blue-700 mt-2 space-y-1">
              <li>Cliquez sur "Télécharger en PDF" pour sauvegarder cette fiche</li>
              <li>Communiquez les identifiants à l'utilisateur en toute sécurité</li>
              <li>Le mot de passe ne sera plus accessible après fermeture de cette page</li>
              <li>L'utilisateur pourra se connecter immédiatement avec ces identifiants</li>
            </ul>
          </div>
        </div>

        {/* Styles d'impression */}
        <style>{`
          @media print {
            @page {
              margin: 1cm;
              size: A4;
            }
            
            body {
              margin: 0;
              padding: 0;
            }
            
            /* Cacher tout sauf la fiche */
            body * {
              visibility: hidden;
            }
            
            .print\\:hidden {
              display: none !important;
            }
            
            /* Afficher uniquement la fiche */
            div[class*="bg-white shadow-2xl"],
            div[class*="bg-white shadow-2xl"] * {
              visibility: visible;
            }
            
            div[class*="bg-white shadow-2xl"] {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              box-shadow: none !important;
              border: 2px solid #333 !important;
              page-break-after: avoid;
            }
            
            /* Améliorer la lisibilité à l'impression */
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
          }
        `}</style>
      </AdminLayout>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // FORMULAIRE DE CRÉATION D'UTILISATEUR
  // ═══════════════════════════════════════════════════════════════

  return (
    <AdminLayout>
      <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate('/admin/users')}
          className="text-comar-navy hover:text-comar-navy-light mb-4"
        >
          ← Retour à la liste
        </button>
        <h1 className="text-2xl font-bold">Nouvel Utilisateur</h1>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800">
          ℹ️ <strong>Important:</strong> Assurez-vous que la confirmation email est désactivée dans Supabase 
          (Authentication → Providers → Email → Décocher "Confirm email")
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-comar-neutral-border p-6 space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-comar-navy mb-2">
            Email <span className="text-comar-red">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-comar-navy/20 ${
              emailValid === null ? 'border-comar-neutral-border' :
              emailValid ? 'border-green-500 bg-green-50' :
              'border-red-500 bg-red-50'
            }`}
            placeholder="utilisateur@comar.tn"
          />
          
          {/* Message de validation en temps réel */}
          {emailValid === false && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              ❌ L'email doit se terminer par <span className="font-mono bg-red-100 px-1 rounded">@comar.tn</span>
            </p>
          )}
          
          {emailValid === true && (
            <p className="mt-1 text-sm text-green-600 flex items-center gap-1">
              ✅ Format d'email valide
            </p>
          )}
          
          {emailValid === null && formData.email === '' && (
            <p className="mt-1 text-sm text-gray-600">
              ⚠️ <strong>Obligatoire :</strong> L'email doit se terminer par <span className="font-mono bg-gray-100 px-1 rounded">@comar.tn</span>
            </p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-comar-navy mb-2">
            Mot de passe <span className="text-comar-red">*</span>
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            minLength={6}
            className="w-full px-3 py-2 border border-comar-neutral-border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy"
            placeholder="Min. 6 caractères"
          />
        </div>

        <div>
          <label htmlFor="full_name" className="block text-sm font-medium text-comar-navy mb-2">
            Nom complet <span className="text-comar-red">*</span>
          </label>
          <input
            type="text"
            id="full_name"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-comar-neutral-border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy"
            placeholder="Jean Dupont"
          />
        </div>

        <div>
          <label htmlFor="role_id" className="block text-sm font-medium text-comar-navy mb-2">
            Rôle <span className="text-comar-red">*</span>
          </label>
          <select
            id="role_id"
            name="role_id"
            value={formData.role_id}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-comar-neutral-border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy"
          >
            {roles.length === 0 ? (
              <option value="">Chargement des rôles...</option>
            ) : (
              <>
                <option value="">Sélectionnez un rôle</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="bg-comar-navy text-white px-6 py-2 rounded-md hover:bg-comar-navy-light disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Création...' : 'Créer l\'Utilisateur'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/users')}
            className="bg-gray-200 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-300 transition"
          >
            Annuler
          </button>
        </div>
      </form>
      </div>
    </AdminLayout>
  )
}
