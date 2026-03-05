// React hooks pour la gestion d'état et effets
import { useState, useEffect } from 'react'
// Navigation entre les pages
import { Link, useNavigate } from 'react-router-dom'
// Client Supabase pour les requêtes DB
import { supabase } from '../../lib/supabaseClient'
// Hook pour accéder au contexte d'authentification
import { useAuth } from '../../contexts/AuthContext'
// Layout spécifique aux pages Relation Client
import RCLayout from '../../components/RCLayout'

/**
 * Page de liste des dossiers – Conformité Cahier des Charges
 *
 * Colonnes : Souscripteur | Police | Date de réception | Demande initiale |
 *            Agence (code + nom) | Niveau dossier | État | Actions (Envoyer / Modifier / Supprimer)
 *
 * Filtres : Souscripteur | État | Date | Numéro Police
 */
export default function DossiersList() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [dossiers, setDossiers] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  // ── Filtres ────────────────────────────────────────────────────
  const [filterSouscripteur, setFilterSouscripteur] = useState('')
  const [filterEtat, setFilterEtat] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [filterPolice, setFilterPolice] = useState('')

  useEffect(() => {
    if (user) fetchDossiers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  /**
   * Récupère tous les dossiers avec JOINs agences + dossier_details_rc
   */
  const fetchDossiers = async () => {
    try {
      const { data, error } = await supabase
        .from('dossiers')
        .select(`*, agences ( id, nom, code )`)
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const ids = (data || []).map(d => d.id)
      let rcMap = {}
      if (ids.length > 0) {
        const { data: rcData } = await supabase
          .from('dossier_details_rc')
          .select('dossier_id, date_reception, demande_initiale, motif_instance, telephone')
          .in('dossier_id', ids)
        if (rcData) rcData.forEach(rc => { rcMap[rc.dossier_id] = rc })
      }

      setDossiers((data || []).map(d => ({ ...d, rc_details: rcMap[d.id] || null })))
    } catch (error) {
      console.error('❌ [DossiersList] Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  // ── Envoyer au service Prestation ─────────────────────────────
  const handleEnvoyer = async (dossier) => {
    if (dossier.niveau !== 'RELATION_CLIENT') return
    if (!window.confirm(`Envoyer le dossier de "${dossier.souscripteur}" au service Prestation ?\n\nCette action est irréversible.`)) return

    setActionLoading(dossier.id)
    try {
      const { error: updateError } = await supabase
        .from('dossiers')
        .update({ niveau: 'PRESTATION', updated_at: new Date().toISOString() })
        .eq('id', dossier.id)
      if (updateError) throw updateError

      await supabase.from('dossier_details_rc')
        .update({ date_reception: new Date().toISOString().split('T')[0] })
        .eq('dossier_id', dossier.id)

      await supabase.from('historique_actions').insert([{
        dossier_id: dossier.id, user_id: user.id,
        action: 'ENVOI_PRESTATION',
        description: `Dossier envoyé au service Prestation par ${user.email}`,
        old_status: 'RELATION_CLIENT', new_status: 'PRESTATION'
      }])

      alert('✅ Dossier envoyé au service Prestation !')
      await fetchDossiers()
    } catch (err) {
      alert(`❌ Erreur : ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  // ── Supprimer un dossier ──────────────────────────────────────
  const handleSupprimer = async (dossier) => {
    if (dossier.niveau !== 'RELATION_CLIENT') return
    if (!window.confirm(`Supprimer le dossier de "${dossier.souscripteur}" ?\n\nCette action est définitive.`)) return

    setActionLoading(dossier.id)
    try {
      await supabase.from('historique_actions').delete().eq('dossier_id', dossier.id)
      await supabase.from('dossier_details_rc').delete().eq('dossier_id', dossier.id)
      const { error } = await supabase.from('dossiers').delete().eq('id', dossier.id)
      if (error) throw error

      alert('✅ Dossier supprimé.')
      setDossiers(prev => prev.filter(d => d.id !== dossier.id))
    } catch (err) {
      alert(`❌ Erreur : ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  // ── Filtrage côté client ──────────────────────────────────────
  const filteredDossiers = dossiers.filter(d => {
    if (filterSouscripteur && !d.souscripteur?.toLowerCase().includes(filterSouscripteur.toLowerCase())) return false
    if (filterPolice && !d.police_number?.toLowerCase().includes(filterPolice.toLowerCase())) return false
    if (filterEtat && d.etat !== filterEtat) return false
    if (filterDate) {
      const dateRec = d.rc_details?.date_reception || d.created_at?.split('T')[0]
      if (!dateRec?.startsWith(filterDate)) return false
    }
    return true
  })

  // ── Helpers d'affichage ───────────────────────────────────────
  const getNiveauBadge = (n) => {
    const m = { RELATION_CLIENT: 'bg-blue-100 text-blue-800', PRESTATION: 'bg-green-100 text-green-800', FINANCE: 'bg-purple-100 text-purple-800' }
    return m[n] || 'bg-gray-100 text-gray-800'
  }
  const getEtatBadge = (e) => {
    const m = { EN_COURS: 'bg-blue-100 text-blue-800', EN_INSTANCE: 'bg-orange-100 text-orange-800', CLOTURE: 'bg-gray-100 text-gray-800' }
    return m[e] || 'bg-gray-100 text-gray-800'
  }
  const getEtatLabel = (e) => {
    const m = { EN_COURS: 'En cours', EN_INSTANCE: 'En instance', CLOTURE: 'Clôturé' }
    return m[e] || e || '-'
  }
  const getNiveauLabel = (n) => {
    const m = { RELATION_CLIENT: 'Relation Client', PRESTATION: 'Prestation', FINANCE: 'Finance' }
    return m[n] || n || '-'
  }

  if (loading) {
    return (
      <RCLayout>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">Chargement de vos dossiers...</p>
            </div>
          </div>
        </div>
      </RCLayout>
    )
  }

  return (
    <RCLayout>
      <div className="p-6">
        {/* En-tête */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">📁 Mes Dossiers</h1>
            <p className="text-gray-600 mt-1">
              {filteredDossiers.length} affiché{filteredDossiers.length > 1 ? 's' : ''} sur {dossiers.length}
            </p>
          </div>
          <Link
            to="/rc/dossiers/nouveau"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 font-semibold"
          >
            <span className="text-xl">➕</span>
            Nouveau Dossier
          </Link>
        </div>

        {/* Statistiques */}
        {dossiers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-500 font-medium">Total</p><p className="text-2xl font-bold text-gray-800">{dossiers.length}</p></div>
                <div className="text-3xl">📋</div>
              </div>
            </div>
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-500 font-medium">En cours</p><p className="text-2xl font-bold text-blue-600">{dossiers.filter(d => d.etat === 'EN_COURS').length}</p></div>
                <div className="text-3xl">🔄</div>
              </div>
            </div>
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-500 font-medium">Clôturés</p><p className="text-2xl font-bold text-gray-600">{dossiers.filter(d => d.etat === 'CLOTURE').length}</p></div>
                <div className="text-3xl">✅</div>
              </div>
            </div>
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-500 font-medium">Transmis</p><p className="text-2xl font-bold text-green-600">{dossiers.filter(d => d.niveau !== 'RELATION_CLIENT').length}</p></div>
                <div className="text-3xl">📤</div>
              </div>
            </div>
          </div>
        )}

        {/* ══════ Filtres ══════ */}
        <div className="bg-white shadow rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">🔍 Filtres</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Souscripteur</label>
              <input type="text" value={filterSouscripteur} onChange={(e) => setFilterSouscripteur(e.target.value)}
                placeholder="Rechercher..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">État</label>
              <select value={filterEtat} onChange={(e) => setFilterEtat(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">Tous</option>
                <option value="EN_COURS">En cours</option>
                <option value="EN_INSTANCE">En instance</option>
                <option value="CLOTURE">Clôturé</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date de réception</label>
              <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Numéro Police</label>
              <input type="text" value={filterPolice} onChange={(e) => setFilterPolice(e.target.value)}
                placeholder="Rechercher..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          </div>
          {(filterSouscripteur || filterEtat || filterDate || filterPolice) && (
            <button onClick={() => { setFilterSouscripteur(''); setFilterEtat(''); setFilterDate(''); setFilterPolice('') }}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium">
              ✕ Réinitialiser les filtres
            </button>
          )}
        </div>

        {/* Contenu */}
        {dossiers.length === 0 ? (
          <div className="bg-white shadow-lg rounded-lg p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Aucun dossier</h3>
            <p className="text-gray-600 mb-6">Vous n'avez pas encore créé de dossier.</p>
            <Link to="/rc/dossiers/nouveau" className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold">
              <span className="text-xl">➕</span> Créer votre premier dossier
            </Link>
          </div>
        ) : filteredDossiers.length === 0 ? (
          <div className="bg-white shadow-lg rounded-lg p-12 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Aucun résultat</h3>
            <p className="text-gray-600">Aucun dossier ne correspond aux filtres appliqués.</p>
          </div>
        ) : (
          <div className="bg-white shadow-lg rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Souscripteur</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">N° Police</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Date réception</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Demande initiale</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Agence</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Niveau</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">État</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDossiers.map((dossier) => {
                    const isRC = dossier.niveau === 'RELATION_CLIENT'
                    const isBusy = actionLoading === dossier.id

                    return (
                      <tr key={dossier.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-4 whitespace-nowrap"><div className="text-sm font-semibold text-gray-900">{dossier.souscripteur || 'N/A'}</div></td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">{dossier.police_number || '-'}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                          {dossier.rc_details?.date_reception
                            ? new Date(dossier.rc_details.date_reception).toLocaleDateString('fr-FR')
                            : new Date(dossier.created_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{dossier.rc_details?.demande_initiale || '-'}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                          {dossier.agences ? `${dossier.agences.code ? dossier.agences.code + ' - ' : ''}${dossier.agences.nom}` : '-'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getNiveauBadge(dossier.niveau)}`}>
                            {getNiveauLabel(dossier.niveau)}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getEtatBadge(dossier.etat)}`}>
                            {getEtatLabel(dossier.etat)}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleEnvoyer(dossier)} disabled={!isRC || isBusy}
                              title={isRC ? 'Envoyer au service Prestation' : 'Dossier déjà transmis'}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-md hover:bg-green-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
                              📤 Envoyer
                            </button>
                            <button onClick={() => navigate(`/rc/dossiers/${dossier.id}`)} disabled={!isRC || isBusy}
                              title={isRC ? 'Modifier le dossier' : 'Modification impossible'}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
                              ✏️ Modifier
                            </button>
                            <button onClick={() => handleSupprimer(dossier)} disabled={!isRC || isBusy}
                              title={isRC ? 'Supprimer le dossier' : 'Suppression impossible'}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-md hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
                              🗑️ Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </RCLayout>
  )
}
