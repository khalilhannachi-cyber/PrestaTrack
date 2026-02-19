// React hooks pour la gestion d'état et effets
import { useState, useEffect } from 'react'
// Navigation programmatique
import { useNavigate } from 'react-router-dom'
// Client Supabase pour les requêtes DB
import { supabase } from '../../lib/supabaseClient'
// Hook pour accéder au contexte d'authentification
import { useAuth } from '../../contexts/AuthContext'
// Layout spécifique aux pages Relation Client
import RCLayout from '../../components/RCLayout'

/**
 * Page de création d'un nouveau dossier
 * Formulaire complet avec tous les champs requis et gestion multi-tables
 * 
 * Processus de création :
 * 1. Insère dans la table 'dossiers'
 * 2. Récupère l'ID du dossier créé
 * 3. Insère les détails dans 'dossier_details_rc'
 * 4. Ajoute une entrée dans 'historique_actions'
 * 
 * @returns {React.ReactNode} La page de formulaire dans le RCLayout
 */
export default function NewDossier() {
  const navigate = useNavigate()
  const { user } = useAuth() // Récupération de l'utilisateur connecté
  const [loading, setLoading] = useState(false) // Indicateur de chargement pendant la création
  const [agences, setAgences] = useState([]) // Liste des agences pour le select
  const [loadingAgences, setLoadingAgences] = useState(true) // Chargement des agences
  
  // État du formulaire avec tous les champs requis
  const [formData, setFormData] = useState({
    souscripteur: '',
    police_number: '',
    agence_id: '',
    telephone: '',
    demande_initiale: '',
    motif_instance: '',
    is_urgent: false
  })

  // ═══════════════════════════════════════════════════════════════
  // Chargement des agences au montage du composant
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    fetchAgences()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // fetchAgences est stable, pas besoin de l'inclure

  /**
   * Récupère la liste des agences depuis Supabase
   * Pour alimenter le select d'agences
   */
  const fetchAgences = async () => {
    try {
      const { data, error } = await supabase
        .from('agences')
        .select('id, nom')
        .order('nom', { ascending: true })

      if (error) throw error
      setAgences(data || [])
    } catch (error) {
      console.error('❌ Erreur lors du chargement des agences:', error)
      alert('Impossible de charger les agences. Réessayez.')
    } finally {
      setLoadingAgences(false)
    }
  }

  /**
   * Gère la soumission du formulaire
   * Processus en 3 étapes avec gestion d'erreurs et rollback
   */
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      console.log('🚀 [NewDossier] Début de la création du dossier')
      
      // ─────────────────────────────────────────────────────────────
      // ÉTAPE 1 : Insertion dans la table 'dossiers'
      // ─────────────────────────────────────────────────────────────
      console.log('📝 [NewDossier] Étape 1 : Insertion dans dossiers')
      const { data: dossierData, error: dossierError } = await supabase
        .from('dossiers')
        .insert([
          {
            souscripteur: formData.souscripteur,
            police_number: formData.police_number,
            agence_id: formData.agence_id || null,
            niveau: 'RELATION_CLIENT', // Niveau initial par défaut
            etat: 'EN_COURS', // État initial du dossier
            is_urgent: formData.is_urgent, // Urgence du dossier
            created_by: user.id // Associe le dossier à l'utilisateur connecté
          }
        ])
        .select() // Important : récupère l'ID du dossier créé

      if (dossierError) {
        console.error('❌ [NewDossier] Erreur insertion dossier:', dossierError)
        throw new Error(`Erreur lors de la création du dossier: ${dossierError.message}`)
      }

      // Vérification que l'insertion a retourné des données
      if (!dossierData || dossierData.length === 0) {
        throw new Error('Aucune donnée retournée après la création du dossier')
      }

      const dossierId = dossierData[0].id
      console.log('✅ [NewDossier] Dossier créé avec ID:', dossierId)

      // ─────────────────────────────────────────────────────────────
      // ÉTAPE 2 : Insertion dans 'dossier_details_rc'
      // ─────────────────────────────────────────────────────────────
      console.log('📝 [NewDossier] Étape 2 : Insertion dans dossier_details_rc')
      const { error: detailsError } = await supabase
        .from('dossier_details_rc')
        .insert([
          {
            dossier_id: dossierId,
            telephone: formData.telephone,
            demande_initiale: formData.demande_initiale,
            motif_instance: formData.motif_instance
          }
        ])

      if (detailsError) {
        console.error('❌ [NewDossier] Erreur insertion détails RC:', detailsError)
        // Rollback : supprimer le dossier créé
        await supabase.from('dossiers').delete().eq('id', dossierId)
        throw new Error(`Erreur lors de l'ajout des détails: ${detailsError.message}`)
      }

      console.log('✅ [NewDossier] Détails RC insérés')

      // ─────────────────────────────────────────────────────────────
      // ÉTAPE 3 : Ajout d'une entrée dans 'historique_actions'
      // ─────────────────────────────────────────────────────────────
      console.log('📝 [NewDossier] Étape 3 : Insertion dans historique_actions')
      const { error: historiqueError } = await supabase
        .from('historique_actions')
        .insert([
          {
            dossier_id: dossierId,
            user_id: user.id,
            action: 'Création du dossier',
            description: `Dossier créé pour ${formData.souscripteur}${formData.is_urgent ? ' (URGENT)' : ''}`
          }
        ])

      if (historiqueError) {
        console.error('⚠️ [NewDossier] Erreur insertion historique:', historiqueError)
        // On ne fait pas de rollback ici car c'est moins critique
        // Le dossier et les détails sont déjà créés
      } else {
        console.log('✅ [NewDossier] Historique ajouté')
      }

      // ─────────────────────────────────────────────────────────────
      // SUCCÈS : Affichage message et redirection
      // ─────────────────────────────────────────────────────────────
      console.log('🎉 [NewDossier] Dossier créé avec succès')
      alert('✅ Dossier créé avec succès!')
      navigate(`/rc/dossiers/${dossierId}`) // Redirection vers le détail du dossier
      
    } catch (error) {
      console.error('❌ [NewDossier] Erreur globale:', error)
      alert(`❌ ${error.message || 'Erreur lors de la création du dossier'}`)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Met à jour l'état du formulaire lors des changements
   * Gère les champs texte, select et checkbox
   */
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    })
  }

  return (
    <RCLayout>
      <div className="p-6 max-w-3xl mx-auto">
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* En-tête avec bouton retour                                      */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/rc/dossiers')}
            className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2"
          >
            ← Retour à la liste
          </button>
          <h1 className="text-3xl font-bold text-gray-800">📋 Nouveau Dossier</h1>
          <p className="text-gray-600 mt-2">Remplissez les informations du dossier</p>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* Formulaire de création                                          */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <form onSubmit={handleSubmit} className="bg-white shadow-lg rounded-lg p-8 space-y-6">
          
          {/* Section : Informations du souscripteur */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">👤 Informations du Souscripteur</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Champ : Souscripteur */}
              <div>
                <label htmlFor="souscripteur" className="block text-sm font-medium text-gray-700 mb-2">
                  Nom du Souscripteur <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="souscripteur"
                  name="souscripteur"
                  value={formData.souscripteur}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Jean Dupont"
                />
              </div>

              {/* Champ : Numéro de police */}
              <div>
                <label htmlFor="police_number" className="block text-sm font-medium text-gray-700 mb-2">
                  Numéro de Police <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="police_number"
                  name="police_number"
                  value={formData.police_number}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: POL-2024-12345"
                />
              </div>

              {/* Champ : Téléphone */}
              <div>
                <label htmlFor="telephone" className="block text-sm font-medium text-gray-700 mb-2">
                  Téléphone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  id="telephone"
                  name="telephone"
                  value={formData.telephone}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: +33 6 12 34 56 78"
                />
              </div>

              {/* Champ : Agence (Select) */}
              <div>
                <label htmlFor="agence_id" className="block text-sm font-medium text-gray-700 mb-2">
                  Agence
                </label>
                {loadingAgences ? (
                  <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                    Chargement des agences...
                  </div>
                ) : (
                  <select
                    id="agence_id"
                    name="agence_id"
                    value={formData.agence_id}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- Sélectionner une agence --</option>
                    {agences.map((agence) => (
                      <option key={agence.id} value={agence.id}>
                        {agence.nom}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Section : Détails de la demande */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">📄 Détails de la Demande</h2>
            
            {/* Champ : Demande initiale */}
            <div className="mb-6">
              <label htmlFor="demande_initiale" className="block text-sm font-medium text-gray-700 mb-2">
                Demande Initiale
              </label>
              <textarea
                id="demande_initiale"
                name="demande_initiale"
                value={formData.demande_initiale}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Décrivez la demande initiale du client..."
              />
            </div>

            {/* Champ : Motif d'instance (OBLIGATOIRE) */}
            <div>
              <label htmlFor="motif_instance" className="block text-sm font-medium text-gray-700 mb-2">
                Motif d'Instance <span className="text-red-500">*</span>
              </label>
              <textarea
                id="motif_instance"
                name="motif_instance"
                value={formData.motif_instance}
                onChange={handleChange}
                required
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Motif de l'instance (obligatoire)..."
              />
              <p className="mt-1 text-xs text-gray-500">
                Ce champ est obligatoire et décrit la raison de la création du dossier
              </p>
            </div>
          </div>

          {/* Section : Options */}
          <div className="pb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">⚙️ Options</h2>
            
            {/* Checkbox : Dossier urgent */}
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  id="is_urgent"
                  name="is_urgent"
                  checked={formData.is_urgent}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>
              <div className="ml-3">
                <label htmlFor="is_urgent" className="font-medium text-gray-700 flex items-center gap-2">
                  🚨 Marquer comme urgent
                </label>
                <p className="text-sm text-gray-500">
                  Cochez cette case si le dossier nécessite un traitement prioritaire
                </p>
              </div>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex gap-4 pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Création en cours...
                </>
              ) : (
                <>
                  ✅ Créer le Dossier
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate('/rc/dossiers')}
              disabled={loading}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50 transition"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </RCLayout>
  )
}
