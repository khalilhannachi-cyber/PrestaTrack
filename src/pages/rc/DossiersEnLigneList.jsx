import { toast } from 'react-hot-toast'
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
export default function DossiersEnLigneList() {
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
        .not('client_id', 'is', null) // Filtrer les dossiers créés en ligne par les clients
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
      console.error(' [DossiersList] Erreur:', error)
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
        .upsert({ dossier_id: dossier.id, date_reception: new Date().toISOString().split('T')[0], motif_instance: dossier.rc_details?.motif_instance || 'Non spécifié' }, { onConflict: 'dossier_id' })

      await supabase.from('historique_actions').insert([{
        dossier_id: dossier.id, user_id: user.id,
        action: 'ENVOI_PRESTATION',
        description: `Dossier envoyé au service Prestation par ${user.email}`,
        old_status: 'RELATION_CLIENT', new_status: 'PRESTATION'
      }])

      toast.success("Dossier envoyé au service Prestation !")
      await fetchDossiers()
    } catch (err) {
      toast.error(`Erreur : ${err.message}`)
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

      toast.success("Dossier supprimé.")
      setDossiers(prev => prev.filter(d => d.id !== dossier.id))
    } catch (err) {
      toast.error(`Erreur : ${err.message}`)
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
    const m = { RELATION_CLIENT: 'bg-comar-navy-50 text-comar-navy', PRESTATION: 'bg-emerald-50 text-emerald-700', FINANCE: 'bg-violet-50 text-violet-700' }
    return m[n] || 'bg-gray-100 text-gray-800'
  }
  const getEtatBadge = (e) => {
    const m = { EN_COURS: 'bg-sky-50 text-sky-700', EN_INSTANCE: 'bg-amber-50 text-amber-700', CLOTURE: 'bg-gray-100 text-gray-600' }
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
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-comar-navy border-t-transparent mb-4"></div>
              <p className="text-sm text-gray-500">Chargement de vos dossiers...</p>
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
            <h1 className="text-2xl font-bold text-comar-navy">Dossiers en Ligne</h1>
            <p className="text-sm text-gray-500 mt-1">
              {filteredDossiers.length} affiché{filteredDossiers.length > 1 ? 's' : ''} sur {dossiers.length}
            </p>
          </div>
        </div>

        {/* Statistiques */}
        {dossiers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-comar-neutral-border p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total</p><p className="text-2xl font-bold text-comar-navy mt-1">{dossiers.length}</p></div>
                <div className="w-10 h-10 rounded-xl bg-comar-navy-50 flex items-center justify-center"><svg className="w-5 h-5 text-comar-navy" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg></div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-comar-neutral-border p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-gray-500 font-medium uppercase tracking-wider">En cours</p><p className="text-2xl font-bold text-sky-600 mt-1">{dossiers.filter(d => d.etat === 'EN_COURS').length}</p></div>
                <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center"><svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg></div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-comar-neutral-border p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Clôturés</p><p className="text-2xl font-bold text-gray-600 mt-1">{dossiers.filter(d => d.etat === 'CLOTURE').length}</p></div>
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center"><svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-comar-neutral-border p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Transmis</p><p className="text-2xl font-bold text-emerald-600 mt-1">{dossiers.filter(d => d.niveau !== 'RELATION_CLIENT').length}</p></div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg></div>
              </div>
            </div>
          </div>
        )}

        {/* ══════ Filtres ══════ */}
        <div className="bg-white rounded-xl border border-comar-neutral-border p-4 mb-6">
          <h3 className="text-xs font-semibold text-comar-navy uppercase tracking-wider mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" /></svg>
            Filtres
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Souscripteur</label>
              <input type="text" value={filterSouscripteur} onChange={(e) => setFilterSouscripteur(e.target.value)}
                placeholder="Rechercher..." className="w-full px-3 py-2 border border-comar-neutral-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy transition-all" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">État</label>
              <select value={filterEtat} onChange={(e) => setFilterEtat(e.target.value)}
                className="w-full px-3 py-2 border border-comar-neutral-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy transition-all">
                <option value="">Tous</option>
                <option value="EN_COURS">En cours</option>
                <option value="EN_INSTANCE">En instance</option>
                <option value="CLOTURE">Clôturé</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date de réception</label>
              <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
                className="w-full px-3 py-2 border border-comar-neutral-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy transition-all" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Numéro Police</label>
              <input type="text" value={filterPolice} onChange={(e) => setFilterPolice(e.target.value)}
                placeholder="Rechercher..." className="w-full px-3 py-2 border border-comar-neutral-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy transition-all" />
            </div>
          </div>
          {(filterSouscripteur || filterEtat || filterDate || filterPolice) && (
            <button onClick={() => { setFilterSouscripteur(''); setFilterEtat(''); setFilterDate(''); setFilterPolice('') }}
              className="mt-3 text-xs text-comar-navy hover:text-comar-red font-medium transition-colors flex items-center gap-1 cursor-pointer">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              Réinitialiser les filtres
            </button>
          )}
        </div>

        {/* Contenu */}
        {dossiers.length === 0 ? (
          <div className="bg-white rounded-xl border border-comar-neutral-border p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-comar-navy-50 flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 text-comar-navy/40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg></div>
            <h3 className="text-lg font-semibold text-comar-navy mb-2">Aucun dossier en ligne</h3>
            <p className="text-sm text-gray-500 mb-6">Il n'y a actuellement aucune demande envoyée depuis la plateforme en ligne.</p>
          </div>
        ) : filteredDossiers.length === 0 ? (
          <div className="bg-white rounded-xl border border-comar-neutral-border p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg></div>
            <h3 className="text-lg font-semibold text-comar-navy mb-2">Aucun résultat</h3>
            <p className="text-sm text-gray-500">Aucun dossier ne correspond aux filtres appliqués.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-comar-neutral-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-comar-neutral-border">
                <thead className="bg-comar-navy">
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-white/80 uppercase tracking-wider">Souscripteur</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-white/80 uppercase tracking-wider">N° Police</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-white/80 uppercase tracking-wider">Date réception</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-white/80 uppercase tracking-wider">Demande initiale</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-white/80 uppercase tracking-wider">Agence</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-white/80 uppercase tracking-wider">Niveau</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-white/80 uppercase tracking-wider">État</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-white/80 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-comar-neutral-border">
                  {filteredDossiers.map((dossier) => {
                    const isRC = dossier.niveau === 'RELATION_CLIENT'
                    const isBusy = actionLoading === dossier.id

                    return (
                      <tr key={dossier.id} className="hover:bg-comar-navy-50/30 transition-colors duration-150">
                        <td className="px-4 py-3 whitespace-nowrap"><div className="text-sm font-semibold text-comar-navy">{dossier.souscripteur || 'N/A'}</div></td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-mono">{dossier.police_number || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {dossier.rc_details?.date_reception
                            ? new Date(dossier.rc_details.date_reception).toLocaleDateString('fr-FR')
                            : new Date(dossier.created_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{dossier.rc_details?.demande_initiale || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {dossier.agences ? dossier.agences.nom : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2.5 py-1 inline-flex text-[11px] leading-5 font-semibold rounded-lg ${getNiveauBadge(dossier.niveau)}`}>
                            {getNiveauLabel(dossier.niveau)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2.5 py-1 inline-flex text-[11px] leading-5 font-semibold rounded-lg ${getEtatBadge(dossier.etat)}`}>
                            {getEtatLabel(dossier.etat)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => handleEnvoyer(dossier)} disabled={!isRC || isBusy}
                              title={isRC ? 'Envoyer au service Prestation' : 'Dossier déjà transmis'}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white text-[11px] font-semibold rounded-lg hover:bg-emerald-700 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                              Envoyer
                            </button>
                            <button onClick={() => navigate(`/rc/dossiers/${dossier.id}`)} disabled={!isRC || isBusy}
                              title={isRC ? 'Modifier le dossier' : 'Modification impossible'}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-comar-navy text-white text-[11px] font-semibold rounded-lg hover:bg-comar-navy-light transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                              Modifier
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
