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
 * Page de création d'un nouveau dossier – Conformité Cahier des Charges
 *
 * Champs : Souscripteur* | Date réception bureau d'ordre (défaut aujourd'hui, modifiable) |
 *          Date envoi RC (auto aujourd'hui, lecture seule) | Téléphone | Agence* |
 *          N° Police* | Motif instance* | Demande initiale (select : R TOTAL / R Partiel / R ECHU / Transfert Contrat / AUTRE)
 *
 * Boutons : « Enregistrer » (sauvegarde, niveau = RELATION_CLIENT)
 *           « Envoyer » (sauvegarde + envoi Prestation, niveau = PRESTATION)
 */
export default function NewDossier() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [agences, setAgences] = useState([])
  const [loadingAgences, setLoadingAgences] = useState(true)

  const today = new Date().toISOString().split('T')[0]

  const [formData, setFormData] = useState({
    souscripteur: '',
    police_number: '',
    agence_id: '',
    telephone: '',
    demande_initiale: '',
    motif_instance: '',
    date_reception: today // Date réception bureau d'ordre – défaut aujourd'hui, modifiable
  })

  useEffect(() => {
    fetchAgences()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchAgences = async () => {
    try {
      const { data, error } = await supabase
        .from('agences')
        .select('id, nom, code')
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
   * Crée le dossier avec le niveau spécifié
   * @param {'RELATION_CLIENT'|'PRESTATION'} niveau
   */
  const handleSave = async (niveau) => {
    // Validation manuelle des champs requis
    if (!formData.souscripteur || !formData.police_number || !formData.agence_id || !formData.motif_instance) {
      alert('❌ Veuillez remplir tous les champs obligatoires (*).')
      return
    }

    setLoading(true)
    try {
      // ÉTAPE 1 : Insertion dans la table 'dossiers'
      const { data: dossierData, error: dossierError } = await supabase
        .from('dossiers')
        .insert([{
          souscripteur: formData.souscripteur,
          police_number: formData.police_number,
          agence_id: formData.agence_id || null,
          niveau,
          etat: 'EN_COURS',
          created_by: user.id
        }])
        .select()

      if (dossierError) throw new Error(`Erreur création dossier: ${dossierError.message}`)
      if (!dossierData || dossierData.length === 0) throw new Error('Aucune donnée retournée')

      const dossierId = dossierData[0].id

      // ÉTAPE 2 : Insertion dans 'dossier_details_rc'
      const { error: detailsError } = await supabase
        .from('dossier_details_rc')
        .insert([{
          dossier_id: dossierId,
          telephone: formData.telephone,
          demande_initiale: formData.demande_initiale,
          motif_instance: formData.motif_instance,
          date_reception: formData.date_reception
        }])

      if (detailsError) {
        await supabase.from('dossiers').delete().eq('id', dossierId)
        throw new Error(`Erreur ajout détails: ${detailsError.message}`)
      }

      // ÉTAPE 3 : Historique
      const actionLabel = niveau === 'PRESTATION' ? 'Création et envoi au service Prestation' : 'Création du dossier'
      await supabase.from('historique_actions').insert([{
        dossier_id: dossierId,
        user_id: user.id,
        action: actionLabel,
        description: `Dossier créé pour ${formData.souscripteur}`,
        old_status: null,
        new_status: niveau
      }])

      const msg = niveau === 'PRESTATION'
        ? '✅ Dossier créé et envoyé au service Prestation !'
        : '✅ Dossier enregistré avec succès !'
      alert(msg)
      navigate('/rc/dossiers')
    } catch (error) {
      console.error('❌ [NewDossier]', error)
      alert(`❌ ${error.message || 'Erreur lors de la création du dossier'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  return (
    <RCLayout>
      <div className="p-6 max-w-3xl mx-auto">
        {/* En-tête */}
        <div className="mb-6">
          <button onClick={() => navigate('/rc/dossiers')} className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2">
            ← Retour à la liste
          </button>
          <h1 className="text-3xl font-bold text-gray-800">📋 Nouveau Dossier</h1>
          <p className="text-gray-600 mt-2">Remplissez les informations du dossier</p>
        </div>

        {/* Formulaire */}
        <div className="bg-white shadow-lg rounded-lg p-8 space-y-6">

          {/* Section : Informations du souscripteur */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">👤 Informations du Souscripteur</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Souscripteur */}
              <div>
                <label htmlFor="souscripteur" className="block text-sm font-medium text-gray-700 mb-2">
                  Nom du Souscripteur <span className="text-red-500">*</span>
                </label>
                <input type="text" id="souscripteur" name="souscripteur" value={formData.souscripteur} onChange={handleChange} required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Jean Dupont" />
              </div>

              {/* N° Police */}
              <div>
                <label htmlFor="police_number" className="block text-sm font-medium text-gray-700 mb-2">
                  Numéro de Police <span className="text-red-500">*</span>
                </label>
                <input type="text" id="police_number" name="police_number" value={formData.police_number} onChange={handleChange} required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: POL-2024-12345" />
              </div>

              {/* Téléphone */}
              <div>
                <label htmlFor="telephone" className="block text-sm font-medium text-gray-700 mb-2">
                  Téléphone
                </label>
                <input type="tel" id="telephone" name="telephone" value={formData.telephone} onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: +212 6 12 34 56 78" />
              </div>

              {/* Agence (obligatoire) */}
              <div>
                <label htmlFor="agence_id" className="block text-sm font-medium text-gray-700 mb-2">
                  Agence <span className="text-red-500">*</span>
                </label>
                {loadingAgences ? (
                  <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">Chargement des agences...</div>
                ) : (
                  <select id="agence_id" name="agence_id" value={formData.agence_id} onChange={handleChange} required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    <option value="">-- Sélectionner une agence --</option>
                    {agences.map((a) => (
                      <option key={a.id} value={a.id}>{a.code ? `${a.code} - ` : ''}{a.nom}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Section : Dates */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">📅 Dates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Date réception bureau d'ordre (modifiable, défaut = aujourd'hui) */}
              <div>
                <label htmlFor="date_reception" className="block text-sm font-medium text-gray-700 mb-2">
                  Date de réception bureau d'ordre
                </label>
                <input type="date" id="date_reception" name="date_reception" value={formData.date_reception} onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>

              {/* Date envoi RC (auto = aujourd'hui, lecture seule) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date envoi RC
                </label>
                <input type="date" value={today} readOnly disabled
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                <p className="mt-1 text-xs text-gray-400">Renseignée automatiquement (aujourd'hui)</p>
              </div>
            </div>
          </div>

          {/* Section : Détails de la demande */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">📄 Détails de la Demande</h2>

            {/* Demande initiale – select conforme au cahier des charges */}
            <div className="mb-6">
              <label htmlFor="demande_initiale" className="block text-sm font-medium text-gray-700 mb-2">
                Demande Initiale
              </label>
              <select id="demande_initiale" name="demande_initiale" value={formData.demande_initiale} onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option value="">-- Sélectionner --</option>
                <option value="R TOTAL">R TOTAL</option>
                <option value="R Partiel">R Partiel</option>
                <option value="R ECHU">R ECHU</option>
                <option value="Transfert Contrat">Transfert Contrat</option>
                <option value="AUTRE">AUTRE</option>
              </select>
            </div>

            {/* Motif d'instance (obligatoire) */}
            <div>
              <label htmlFor="motif_instance" className="block text-sm font-medium text-gray-700 mb-2">
                Motif d'Instance <span className="text-red-500">*</span>
              </label>
              <textarea id="motif_instance" name="motif_instance" value={formData.motif_instance} onChange={handleChange} required rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Motif de l'instance (obligatoire)..." />
              <p className="mt-1 text-xs text-gray-500">Ce champ est obligatoire et décrit la raison de la création du dossier</p>
            </div>
          </div>

          {/* Boutons d'action – Enregistrer / Envoyer / Annuler */}
          <div className="flex flex-wrap gap-4 pt-6 border-t border-gray-200">
            {/* Enregistrer : sauvegarde seulement (niveau = RC) */}
            <button type="button" disabled={loading} onClick={() => handleSave('RELATION_CLIENT')}
              className="flex-1 min-w-[160px] bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
              {loading ? (
                <><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg> Enregistrement...</>
              ) : (
                <>💾 Enregistrer</>
              )}
            </button>

            {/* Envoyer : sauvegarde + envoi Prestation */}
            <button type="button" disabled={loading} onClick={() => handleSave('PRESTATION')}
              className="flex-1 min-w-[160px] bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
              {loading ? (
                <><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg> Envoi en cours...</>
              ) : (
                <>📤 Envoyer</>
              )}
            </button>

            {/* Annuler */}
            <button type="button" onClick={() => navigate('/rc/dossiers')} disabled={loading}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50 transition">
              Annuler
            </button>
          </div>
        </div>
      </div>
    </RCLayout>
  )
}
