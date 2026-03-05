// React hooks pour la gestion d'état et effets
import { useState, useEffect } from 'react'
// Navigation et récupération des paramètres d'URL
import { useParams, useNavigate } from 'react-router-dom'
// Client Supabase pour les requêtes DB
import { supabase } from '../../lib/supabaseClient'
// Hook pour accéder au contexte d'authentification
import { useAuth } from '../../contexts/AuthContext'
// Layout spécifique aux pages Relation Client
import RCLayout from '../../components/RCLayout'

/**
 * Page de détail / modification d'un dossier – Conformité Cahier des Charges
 *
 * - Affiche les informations en lecture seule par défaut
 * - Mode édition si le dossier est au niveau RELATION_CLIENT
 * - Boutons : Modifier | Envoyer vers Prestation | Supprimer | Retour
 */
export default function DossierDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [dossier, setDossier] = useState(null)
  const [loading, setLoading] = useState(true)
  const [transmitting, setTransmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [agences, setAgences] = useState([])

  // Formulaire d'édition
  const [editForm, setEditForm] = useState({
    souscripteur: '',
    police_number: '',
    agence_id: '',
    telephone: '',
    demande_initiale: '',
    motif_instance: '',
    date_reception: ''
  })

  useEffect(() => {
    fetchDossier()
    fetchAgences()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const fetchAgences = async () => {
    const { data } = await supabase.from('agences').select('id, nom, code').order('nom', { ascending: true })
    setAgences(data || [])
  }

  const fetchDossier = async () => {
    try {
      const { data, error } = await supabase
        .from('dossiers')
        .select(`*, agences ( id, nom, code, adresse )`)
        .eq('id', id)
        .single()

      if (error) throw error
      if (!data) throw new Error("Le dossier n'existe pas")

      const { data: rcData } = await supabase
        .from('dossier_details_rc')
        .select('telephone, demande_initiale, motif_instance, date_reception')
        .eq('dossier_id', id)
        .maybeSingle()

      const fullDossier = { ...data, dossier_details_rc: rcData ? [rcData] : [] }
      setDossier(fullDossier)

      // Pré-remplir le formulaire d'édition
      setEditForm({
        souscripteur: data.souscripteur || '',
        police_number: data.police_number || '',
        agence_id: data.agence_id || '',
        telephone: rcData?.telephone || '',
        demande_initiale: rcData?.demande_initiale || '',
        motif_instance: rcData?.motif_instance || '',
        date_reception: rcData?.date_reception || ''
      })
    } catch (error) {
      console.error('❌ [DossierDetail] Erreur:', error)
      alert(`Dossier introuvable: ${error.message}`)
      navigate('/rc/dossiers')
    } finally {
      setLoading(false)
    }
  }

  // ── Sauvegarder les modifications ─────────────────────────────
  const handleSave = async () => {
    if (!editForm.souscripteur || !editForm.police_number || !editForm.agence_id || !editForm.motif_instance) {
      alert('❌ Veuillez remplir tous les champs obligatoires (*).')
      return
    }
    setSaving(true)
    try {
      const { error: updateError } = await supabase
        .from('dossiers')
        .update({
          souscripteur: editForm.souscripteur,
          police_number: editForm.police_number,
          agence_id: editForm.agence_id || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
      if (updateError) throw updateError

      const { error: rcError } = await supabase
        .from('dossier_details_rc')
        .update({
          telephone: editForm.telephone,
          demande_initiale: editForm.demande_initiale,
          motif_instance: editForm.motif_instance,
          date_reception: editForm.date_reception || null
        })
        .eq('dossier_id', id)
      if (rcError) throw rcError

      await supabase.from('historique_actions').insert([{
        dossier_id: parseInt(id), user_id: user.id,
        action: 'Modification du dossier',
        description: `Dossier modifié par ${user.email}`
      }])

      alert('✅ Dossier modifié avec succès !')
      setEditing(false)
      await fetchDossier()
    } catch (err) {
      alert(`❌ Erreur : ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  // ── Transmettre à Prestation ──────────────────────────────────
  const handleTransmitToPrestation = async () => {
    if (!window.confirm('Transmettre ce dossier au service Prestation ?\n\nCette action est irréversible.')) return
    setTransmitting(true)
    try {
      const { error: updateError } = await supabase
        .from('dossiers')
        .update({ niveau: 'PRESTATION', updated_at: new Date().toISOString() })
        .eq('id', id)
      if (updateError) throw updateError

      await supabase.from('historique_actions').insert([{
        dossier_id: parseInt(id), user_id: user.id,
        action: 'Transmission à Prestation',
        description: `Dossier transmis au service Prestation par ${user.email}`,
        old_status: 'RELATION_CLIENT', new_status: 'PRESTATION'
      }])

      alert('✅ Dossier transmis au service Prestation !')
      navigate('/rc/dossiers')
    } catch (err) {
      alert(`❌ ${err.message}`)
    } finally {
      setTransmitting(false)
    }
  }

  // ── Supprimer ─────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!window.confirm(`Supprimer définitivement le dossier de "${dossier.souscripteur}" ?\n\nCette action est irréversible.`)) return
    try {
      await supabase.from('historique_actions').delete().eq('dossier_id', id)
      await supabase.from('dossier_details_rc').delete().eq('dossier_id', id)
      const { error } = await supabase.from('dossiers').delete().eq('id', id)
      if (error) throw error
      alert('✅ Dossier supprimé.')
      navigate('/rc/dossiers')
    } catch (err) {
      alert(`❌ Erreur : ${err.message}`)
    }
  }

  const handleEditChange = (e) => {
    const { name, value } = e.target
    setEditForm(prev => ({ ...prev, [name]: value }))
  }

  if (loading) {
    return (
      <RCLayout>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">Chargement des détails du dossier...</p>
            </div>
          </div>
        </div>
      </RCLayout>
    )
  }

  if (!dossier) return null

  const detailsRC = dossier.dossier_details_rc?.[0] || null
  const isRC = dossier.niveau === 'RELATION_CLIENT'
  const niveauLabel = { RELATION_CLIENT: 'Relation Client', PRESTATION: 'Prestation', FINANCE: 'Finance' }
  const etatLabel = { EN_COURS: 'En cours', EN_INSTANCE: 'En instance', CLOTURE: 'Clôturé' }

  return (
    <RCLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* En-tête */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <button onClick={() => navigate('/rc/dossiers')} className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2">
              ← Retour à la liste
            </button>
            <h1 className="text-3xl font-bold text-gray-800">{dossier.souscripteur}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block px-4 py-2 text-sm font-semibold rounded-lg bg-blue-100 text-blue-800">
              {niveauLabel[dossier.niveau] || dossier.niveau}
            </span>
            <span className={`inline-block px-4 py-2 text-sm font-semibold rounded-lg ${
              dossier.etat === 'EN_COURS' ? 'bg-blue-100 text-blue-800' :
              dossier.etat === 'EN_INSTANCE' ? 'bg-orange-100 text-orange-800' :
              dossier.etat === 'CLOTURE' ? 'bg-gray-100 text-gray-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {etatLabel[dossier.etat] || dossier.etat}
            </span>
          </div>
        </div>

        {/* ══════ Mode lecture ══════ */}
        {!editing ? (
          <>
            {/* Informations Souscripteur */}
            <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">👤 Informations du Souscripteur</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Souscripteur</h3>
                  <p className="text-lg font-semibold text-gray-900">{dossier.souscripteur || 'N/A'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Numéro de Police</h3>
                  <p className="text-lg font-semibold text-gray-900">{dossier.police_number || 'N/A'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Téléphone</h3>
                  <p className="text-lg font-semibold text-gray-900">{detailsRC?.telephone || 'N/A'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Agence</h3>
                  <p className="text-lg font-semibold text-gray-900">
                    {dossier.agences ? `${dossier.agences.code ? dossier.agences.code + ' - ' : ''}${dossier.agences.nom}` : 'Non assignée'}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Date de réception</h3>
                  <p className="text-lg font-semibold text-gray-900">
                    {detailsRC?.date_reception ? new Date(detailsRC.date_reception).toLocaleDateString('fr-FR') : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Détails de la Demande */}
            <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">📄 Détails de la Demande</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Demande Initiale</h3>
                  <p className="text-gray-900 leading-relaxed bg-gray-50 p-4 rounded-lg">{detailsRC?.demande_initiale || <span className="text-gray-400 italic">Non renseignée</span>}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Motif d'Instance</h3>
                  <p className="text-gray-900 leading-relaxed bg-gray-50 p-4 rounded-lg">{detailsRC?.motif_instance || <span className="text-gray-400 italic">Non renseigné</span>}</p>
                </div>
              </div>
            </div>

            {/* Infos système */}
            <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">ℹ️ Informations Système</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Date de création</h3>
                  <p className="text-gray-900">{new Date(dossier.created_at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}</p>
                </div>
                {dossier.updated_at && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Dernière modification</h3>
                    <p className="text-gray-900">{new Date(dossier.updated_at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* ══════ Mode édition ══════ */
          <div className="bg-white shadow-lg rounded-lg p-8 mb-6 space-y-6">
            <h2 className="text-xl font-bold text-gray-800 border-b border-gray-200 pb-2">✏️ Modifier le dossier</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Souscripteur <span className="text-red-500">*</span></label>
                <input type="text" name="souscripteur" value={editForm.souscripteur} onChange={handleEditChange} required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">N° Police <span className="text-red-500">*</span></label>
                <input type="text" name="police_number" value={editForm.police_number} onChange={handleEditChange} required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <input type="tel" name="telephone" value={editForm.telephone} onChange={handleEditChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agence <span className="text-red-500">*</span></label>
                <select name="agence_id" value={editForm.agence_id} onChange={handleEditChange} required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- Sélectionner --</option>
                  {agences.map(a => (
                    <option key={a.id} value={a.id}>{a.code ? `${a.code} - ` : ''}{a.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de réception</label>
                <input type="date" name="date_reception" value={editForm.date_reception} onChange={handleEditChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Demande Initiale</label>
                <select name="demande_initiale" value={editForm.demande_initiale} onChange={handleEditChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- Sélectionner --</option>
                  <option value="R TOTAL">R TOTAL</option>
                  <option value="R Partiel">R Partiel</option>
                  <option value="R ECHU">R ECHU</option>
                  <option value="Transfert Contrat">Transfert Contrat</option>
                  <option value="AUTRE">AUTRE</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motif d'Instance <span className="text-red-500">*</span></label>
              <textarea name="motif_instance" value={editForm.motif_instance} onChange={handleEditChange} required rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-4 pt-4 border-t border-gray-200">
              <button onClick={handleSave} disabled={saving}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2">
                {saving ? 'Enregistrement...' : '💾 Enregistrer'}
              </button>
              <button type="button" onClick={() => { setEditing(false); fetchDossier() }}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition">
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* ══════ Barre d'actions ══════ */}
        <div className="bg-white shadow-lg rounded-lg p-6">
          <div className="flex flex-wrap gap-4">
            {isRC && !editing && (
              <>
                <button onClick={() => setEditing(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center gap-2">
                  ✏️ Modifier
                </button>
                <button onClick={handleTransmitToPrestation} disabled={transmitting}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition flex items-center gap-2">
                  {transmitting ? 'Envoi...' : '📤 Envoyer à Prestation'}
                </button>
                <button onClick={handleDelete}
                  className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition flex items-center gap-2">
                  🗑️ Supprimer
                </button>
              </>
            )}
            {!isRC && (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 px-6 py-3 rounded-lg border border-green-200">
                <span className="text-xl">✅</span>
                <span className="font-semibold">Dossier transmis au service {niveauLabel[dossier.niveau] || dossier.niveau}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </RCLayout>
  )
}
