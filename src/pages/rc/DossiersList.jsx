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
// Composant Timeline
import DossierTimeline from '../../components/DossierTimeline'

/**
 * Page de liste des dossiers – Conformité Cahier des Charges
 *
 * Colonnes : Souscripteur | Police | Date de réception | Demande initiale |
 *            Agence (code + nom) | Niveau dossier | Actions (Envoyer / Modifier / Supprimer)
 *
 * Filtres : Souscripteur | Date | Numéro Police
 */
export default function DossiersList() {
  const { user, role } = useAuth()
  const navigate = useNavigate()
  const [dossiers, setDossiers] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [activeTab, setActiveTab] = useState('actifs')
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [selectedDossierHistory, setSelectedDossierHistory] = useState([])
  const [selectedDossierName, setSelectedDossierName] = useState('')

  // ── Filtres ────────────────────────────────────────────────────
  const [filterSouscripteur, setFilterSouscripteur] = useState('')
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
        .order('created_at', { ascending: false })

      if (error) throw error

      const ids = (data || []).map(d => d.id)
      let rcMap = {}
      const cancelledByHistory = new Set()
      if (ids.length > 0) {
        const [{ data: rcData, error: rcError }, { data: historyData, error: historyError }] = await Promise.all([
          supabase
            .from('dossier_details_rc')
            .select('dossier_id, date_reception, demande_initiale, motif_instance, telephone')
            .in('dossier_id', ids),
          supabase
            .from('historique_actions')
            .select('dossier_id')
            .in('dossier_id', ids)
            .eq('action', 'ANNULATION_DOSSIER')
        ])

        if (rcError) throw rcError
        if (rcData) rcData.forEach(rc => { rcMap[rc.dossier_id] = rc })

        if (historyError) {
          console.warn(' [DossiersList] Impossible de lire historique_actions:', historyError.message)
        } else if (historyData) {
          historyData.forEach(item => cancelledByHistory.add(item.dossier_id))
        }
      }

      setDossiers((data || []).map(d => ({
        ...d,
        rc_details: rcMap[d.id] || null,
        is_cancelled: d.etat === 'ANNULE' || cancelledByHistory.has(d.id)
      })))
    } catch (error) {
      console.error(' [DossiersList] Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  const openHistory = async (dossier) => {
    setSelectedDossierName(dossier.souscripteur)
    setIsHistoryModalOpen(true)
    const { data, error } = await supabase
      .from('historique_actions')
      .select('*')
      .eq('dossier_id', dossier.id)
      .order('created_at', { ascending: false })
    
    if (!error) setSelectedDossierHistory(data || [])
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
    if (filterDate) {
      const dateRec = d.rc_details?.date_reception || d.created_at?.split('T')[0]
      if (!dateRec?.startsWith(filterDate)) return false
    }
    return true
  })

  const dossiersActifs = filteredDossiers.filter(d => d.etat !== 'CLOTURE' && !d.is_cancelled)
  const dossiersClotures = filteredDossiers.filter(d => d.etat === 'CLOTURE' && !d.is_cancelled)
  const dossiersAnnules = filteredDossiers.filter(d => d.is_cancelled)

  let displayedDossiers = dossiersActifs
  if (activeTab === 'clotures') displayedDossiers = dossiersClotures
  if (activeTab === 'annules') displayedDossiers = dossiersAnnules

  // ── Helpers d'affichage ───────────────────────────────────────
  const getNiveauBadge = (n) => {
    const m = { RELATION_CLIENT: 'bg-comar-navy-50 text-comar-navy', PRESTATION: 'bg-emerald-50 text-emerald-700', FINANCE: 'bg-violet-50 text-violet-700' }
    return m[n] || 'bg-gray-100 text-gray-800'
  }
  const getNiveauLabel = (n) => {
    const m = { RELATION_CLIENT: 'Relation Client', PRESTATION: 'Prestation', FINANCE: 'Finance' }
    return m[n] || n || '-'
  }

  const getDemandeInitialeLabel = (demandeInitiale, motifInstance) => {
    const demande = (demandeInitiale || '').trim()
    if (!demande) return '-'

    // Compatibilite legacy: "[Type] motif..." -> afficher uniquement "Type"
    const bracketMatch = demande.match(/^\[(.+?)\]/)
    if (bracketMatch?.[1]) return bracketMatch[1].trim()

    const motif = (motifInstance || '').trim()
    if (motif && demande.endsWith(motif)) {
      const withoutMotif = demande
        .slice(0, demande.length - motif.length)
        .trim()
        .replace(/[-:;,]+$/, '')
        .trim()

      if (withoutMotif) return withoutMotif
    }

    return demande
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
            <h1 className="text-2xl font-bold text-comar-navy">Mes Dossiers</h1>
            <p className="text-sm text-gray-500 mt-1">
              {displayedDossiers.length} affiché{displayedDossiers.length > 1 ? 's' : ''} sur {dossiers.length}
            </p>
          </div>
          {role !== 'ADMIN' && (
            <Link
              to="/rc/dossiers/nouveau"
              className="bg-comar-navy text-white px-5 py-2.5 rounded-xl hover:bg-comar-navy-light transition-all duration-200 flex items-center gap-2 font-semibold text-sm shadow-sm hover:shadow-md"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Nouveau Dossier
            </Link>
          )}
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
                <div><p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Clôturés</p><p className="text-2xl font-bold text-gray-600 mt-1">{dossiers.filter(d => d.etat === 'CLOTURE' && !d.is_cancelled).length}</p></div>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Souscripteur</label>
              <input type="text" value={filterSouscripteur} onChange={(e) => setFilterSouscripteur(e.target.value)}
                placeholder="Rechercher..." className="w-full px-3 py-2 border border-comar-neutral-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy transition-all" />
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
          {(filterSouscripteur || filterDate || filterPolice) && (
            <button onClick={() => { setFilterSouscripteur(''); setFilterDate(''); setFilterPolice('') }}
              className="mt-3 text-xs text-comar-navy hover:text-comar-red font-medium transition-colors flex items-center gap-1 cursor-pointer">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              Réinitialiser les filtres
            </button>
          )}
        </div>

        {/* Onglets dossiers */}
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('actifs')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'actifs'
                ? 'bg-comar-navy text-white'
                : 'bg-white border border-comar-neutral-border text-comar-navy hover:bg-comar-navy-50'
            }`}
          >
            Dossiers actifs ({dossiersActifs.length})
          </button>
          <button
            onClick={() => setActiveTab('clotures')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'clotures'
                ? 'bg-comar-navy text-white'
                : 'bg-white border border-comar-neutral-border text-comar-navy hover:bg-comar-navy-50'
            }`}
          >
            Dossiers clôturés ({dossiersClotures.length})
          </button>
          <button
            onClick={() => setActiveTab('annules')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'annules'
                ? 'bg-comar-navy text-white'
                : 'bg-white border border-comar-neutral-border text-comar-navy hover:bg-comar-navy-50'
            }`}
          >
            Dossiers annulés ({dossiersAnnules.length})
          </button>
        </div>

        {/* Contenu */}
        {dossiers.length === 0 ? (
          <div className="bg-white rounded-xl border border-comar-neutral-border p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-comar-navy-50 flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 text-comar-navy/40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg></div>
            <h3 className="text-lg font-semibold text-comar-navy mb-2">Aucun dossier</h3>
            <p className="text-sm text-gray-500 mb-6">Vous n'avez pas encore créé de dossier.</p>
            {role !== 'ADMIN' && (
              <Link to="/rc/dossiers/nouveau" className="inline-flex items-center gap-2 bg-comar-navy text-white px-5 py-2.5 rounded-xl hover:bg-comar-navy-light transition-all duration-200 font-semibold text-sm shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg> Créer votre premier dossier
              </Link>
            )}
          </div>
        ) : filteredDossiers.length === 0 ? (
          <div className="bg-white rounded-xl border border-comar-neutral-border p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg></div>
            <h3 className="text-lg font-semibold text-comar-navy mb-2">Aucun résultat</h3>
            <p className="text-sm text-gray-500">Aucun dossier ne correspond aux filtres appliqués.</p>
          </div>
        ) : displayedDossiers.length === 0 ? (
          <div className="bg-white rounded-xl border border-comar-neutral-border p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-comar-neutral-bg flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m5.25 2.25a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
            <h3 className="text-lg font-semibold text-comar-navy mb-2">Aucun dossier dans cet onglet</h3>
            <p className="text-sm text-gray-500">
              {activeTab === 'clotures'
                ? 'Aucun dossier clôturé pour le moment.'
                : activeTab === 'annules'
                ? 'Aucun dossier annulé pour le moment.'
                : 'Aucun dossier actif pour le moment.'}
            </p>
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
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-white/80 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-comar-neutral-border">
                  {displayedDossiers.map((dossier) => {
                    const isRC = dossier.niveau === 'RELATION_CLIENT'
                    const isCancelled = dossier.is_cancelled === true
                    const isCloture = dossier.etat === 'CLOTURE' && !isCancelled
                    const isLocked = isCloture || isCancelled
                    const isBusy = actionLoading === dossier.id
                    const canManage = isRC && !isLocked && !isBusy && role !== 'ADMIN'

                    return (
                      <tr key={dossier.id} className="hover:bg-comar-navy-50/30 transition-colors duration-150">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-comar-navy">{dossier.souscripteur || 'N/A'}</div>
                            {dossier.is_urgent && (
                              <span className="px-2 py-0.5 inline-flex text-[11px] font-semibold rounded-full bg-comar-red/10 text-comar-red">
                                Prioritaire
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-mono">{dossier.police_number || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {dossier.rc_details?.date_reception
                            ? new Date(dossier.rc_details.date_reception).toLocaleDateString('fr-FR')
                            : new Date(dossier.created_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {getDemandeInitialeLabel(dossier.rc_details?.demande_initiale, dossier.rc_details?.motif_instance)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {dossier.agences ? dossier.agences.nom : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2.5 py-1 inline-flex text-[11px] leading-5 font-semibold rounded-lg ${getNiveauBadge(dossier.niveau)}`}>
                            {getNiveauLabel(dossier.niveau)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5 min-w-[200px]">
                            <button onClick={() => openHistory(dossier)}
                               title="Voir l'historique complet"
                               className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white text-[11px] font-bold rounded-lg hover:bg-gray-700 transition-all duration-200">
                               <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                               Historique
                             </button>
                             <button onClick={() => handleEnvoyer(dossier)} disabled={!canManage}
                              title={
                                !isRC
                                  ? 'Dossier déjà transmis'
                                  : isCancelled
                                  ? 'Dossier annulé: action indisponible'
                                  : isCloture
                                  ? 'Dossier clôturé: action indisponible'
                                  : 'Envoyer au service Prestation'
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white text-[11px] font-semibold rounded-lg hover:bg-emerald-700 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                              Envoyer
                            </button>
                            <button onClick={() => navigate(`/rc/dossiers/${dossier.id}`)} disabled={!canManage}
                              title={
                                !isRC
                                  ? 'Modification impossible'
                                  : isCancelled
                                  ? 'Dossier annulé: modification indisponible'
                                  : isCloture
                                  ? 'Dossier clôturé: modification indisponible'
                                  : 'Modifier le dossier'
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-comar-navy text-white text-[11px] font-semibold rounded-lg hover:bg-comar-navy-light transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                              Modifier
                            </button>
                            <button onClick={() => handleSupprimer(dossier)} disabled={!canManage}
                              title={
                                !isRC
                                  ? 'Suppression impossible'
                                  : isCancelled
                                  ? 'Dossier annulé: suppression indisponible'
                                  : isCloture
                                  ? 'Dossier clôturé: suppression indisponible'
                                  : 'Supprimer le dossier'
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-comar-red text-white text-[11px] font-semibold rounded-lg hover:bg-comar-red-light transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                              Supprimer
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

      {/* Modal d'historique */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsHistoryModalOpen(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-comar-navy">
              <div>
                <h2 className="text-xl font-bold text-white">Historique du dossier</h2>
                <p className="text-white/70 text-xs mt-1">{selectedDossierName}</p>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="text-white/60 hover:text-white text-2xl">✕</button>
            </div>
            <div className="p-6 overflow-y-auto">
              <DossierTimeline history={selectedDossierHistory} />
            </div>
          </div>
        </div>
      )}
    </RCLayout>
  )
}
