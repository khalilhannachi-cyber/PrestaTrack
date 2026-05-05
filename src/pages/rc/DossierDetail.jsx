import { toast } from 'react-hot-toast'
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
import ConfirmModal from '../../components/ConfirmModal'
import DossierTimeline from '../../components/DossierTimeline'

const POLICE_NUMBER_REGEX = /^\d{8}-\d$/

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
  const { user, role } = useAuth()
  const [dossier, setDossier] = useState(null)
  const [loading, setLoading] = useState(true)
  const [transmitting, setTransmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [agences, setAgences] = useState([])
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', type: 'warning', onConfirm: null })
  const [history, setHistory] = useState([])

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

      if (data.etat === 'ANNULE') {
        throw new Error("Ce dossier a été annulé par l'administration et n'est plus accessible.")
      }

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

      // Récupérer l'historique
      const { data: histData } = await supabase
        .from('historique_actions')
        .select('*')
        .eq('dossier_id', id)
        .order('created_at', { ascending: false })
      
      setHistory(histData || [])
    } catch (error) {
      console.error(' [DossierDetail] Erreur:', error)
      toast(`Dossier introuvable: ${error.message}`)
      navigate('/rc/dossiers')
    } finally {
      setLoading(false)
    }
  }

  // ── Sauvegarder les modifications ─────────────────────────────
  const handleSave = async () => {
    if (dossier?.etat === 'ANNULE') {
      toast.error("Ce dossier est annulé et n'est plus modifiable.")
      return
    }

    if (!editForm.souscripteur || !editForm.police_number || !editForm.motif_instance) {
      toast.error("Veuillez remplir tous les champs obligatoires (*).")
      return
    }

    const normalizedPoliceNumber = editForm.police_number.trim()
    if (!POLICE_NUMBER_REGEX.test(normalizedPoliceNumber)) {
      toast.error("Format numéro de police invalide. Format attendu: 12345678-9.")
      return
    }

    setSaving(true)
    try {
      const { error: updateError } = await supabase
        .from('dossiers')
        .update({
          souscripteur: editForm.souscripteur,
          police_number: normalizedPoliceNumber,
          agence_id: editForm.agence_id || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
      if (updateError) throw updateError

      const { error: rcError } = await supabase
        .from('dossier_details_rc')
        .upsert({
          dossier_id: id,
          telephone: editForm.telephone,
          demande_initiale: editForm.demande_initiale,
          motif_instance: editForm.motif_instance,
          date_reception: editForm.date_reception || null
        }, { onConflict: 'dossier_id' })
      if (rcError) throw rcError

      await supabase.from('historique_actions').insert([{
        dossier_id: parseInt(id), user_id: user.id,
        action: 'Modification du dossier',
        description: `Dossier modifié par ${user.email}`
      }])

      toast.success("Dossier modifié avec succès !")
      setEditing(false)
      await fetchDossier()
    } catch (err) {
      toast.error(`Erreur : ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleTransmitToPrestation = async () => {
    if (dossier?.etat === 'ANNULE') {
      toast.error("Ce dossier est annulé et n'est plus transmissible.")
      return
    }

    setConfirmConfig({
      isOpen: true,
      title: 'Transmettre le dossier',
      message: 'Transmettre ce dossier au service Prestation ?\n\nCette action est irréversible.',
      type: 'warning',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }))
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

          toast.success("Dossier transmis au service Prestation !")
          navigate('/rc/dossiers')
        } catch (err) {
          toast.error(`${err.message}`)
        } finally {
          setTransmitting(false)
        }
      }
    })
  }

  const handleDelete = async () => {
    if (dossier?.etat === 'ANNULE') {
      toast.error("Ce dossier est annulé et n'est plus supprimable depuis ce service.")
      return
    }

    setConfirmConfig({
      isOpen: true,
      title: 'Supprimer le dossier',
      message: `Supprimer définitivement le dossier de "${dossier.souscripteur}" ?\n\nCette action est irréversible.`,
      type: 'danger',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }))
        try {
          await supabase.from('historique_actions').delete().eq('dossier_id', id)
          await supabase.from('dossier_details_rc').delete().eq('dossier_id', id)
          const { error } = await supabase.from('dossiers').delete().eq('id', id)
          if (error) throw error
          toast.success("Dossier supprimé.")
          navigate('/rc/dossiers')
        } catch (err) {
          toast.error(`Erreur : ${err.message}`)
        }
      }
    })
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
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-comar-navy border-t-transparent mb-4"></div>
              <p className="text-sm text-gray-500">Chargement des détails du dossier...</p>
            </div>
          </div>
        </div>
      </RCLayout>
    )
  }

  if (!dossier) return null

  const detailsRC = dossier.dossier_details_rc?.[0] || null
  const isRC = dossier.niveau === 'RELATION_CLIENT'
  const isLocked = dossier.etat === 'CLOTURE' || dossier.etat === 'ANNULE'
  const canManageRc = isRC && !isLocked && role !== 'ADMIN'
  const niveauLabel = { RELATION_CLIENT: 'Relation Client', PRESTATION: 'Prestation', FINANCE: 'Finance' }
  const etatLabel = { EN_COURS: 'En cours', EN_INSTANCE: 'En instance', CLOTURE: 'Clôturé', ANNULE: 'Annulé' }

  return (
    <RCLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* En-tête */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <button onClick={() => navigate('/rc/dossiers')} className="text-comar-navy/60 hover:text-comar-navy mb-4 flex items-center gap-1.5 text-sm font-medium transition-colors cursor-pointer">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
              Retour à la liste
            </button>
            <h1 className="text-2xl font-bold text-comar-navy">{dossier.souscripteur}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block px-3 py-1.5 text-xs font-semibold rounded-lg bg-comar-navy-50 text-comar-navy">
              {niveauLabel[dossier.niveau] || dossier.niveau}
            </span>
            <span className={`inline-block px-3 py-1.5 text-xs font-semibold rounded-lg ${
              dossier.etat === 'EN_COURS' ? 'bg-sky-50 text-sky-700' :
              dossier.etat === 'EN_INSTANCE' ? 'bg-amber-50 text-amber-700' :
              dossier.etat === 'CLOTURE' ? 'bg-gray-100 text-gray-600' : 'bg-gray-100 text-gray-600'
            }`}>
              {etatLabel[dossier.etat] || dossier.etat}
            </span>
          </div>
        </div>

        {/* ══════ Mode lecture ══════ */}
        {!editing ? (
          <>
            {/* Informations Souscripteur */}
            <div className="bg-white rounded-xl border border-comar-neutral-border p-6 mb-6">
              <h2 className="text-base font-bold text-comar-navy mb-4 border-b border-comar-neutral-border pb-2 flex items-center gap-2">
                <svg className="w-5 h-5 text-comar-navy/50" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                Informations du Souscripteur
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Souscripteur</h3>
                  <p className="text-sm font-semibold text-comar-navy">{dossier.souscripteur || 'N/A'}</p>
                </div>
                <div>
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Numéro de Police</h3>
                  <p className="text-sm font-semibold text-comar-navy">{dossier.police_number || 'N/A'}</p>
                </div>
                <div>
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Téléphone</h3>
                  <p className="text-sm font-semibold text-comar-navy">{detailsRC?.telephone || 'N/A'}</p>
                </div>
                <div>
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Agence</h3>
                  <p className="text-sm font-semibold text-comar-navy">{dossier.agences ? `${dossier.agences.code ? dossier.agences.code + ' - ' : ''}${dossier.agences.nom}` : 'Non assignée'}</p>
                </div>
                <div>
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Date de réception</h3>
                  <p className="text-sm font-semibold text-comar-navy">{detailsRC?.date_reception ? new Date(detailsRC.date_reception).toLocaleDateString('fr-FR') : 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Détails de la Demande */}
            <div className="bg-white rounded-xl border border-comar-neutral-border p-6 mb-6">
              <h2 className="text-base font-bold text-comar-navy mb-4 border-b border-comar-neutral-border pb-2 flex items-center gap-2">
                <svg className="w-5 h-5 text-comar-navy/50" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                Détails de la Demande
              </h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Demande Initiale</h3>
                  <p className="text-sm text-comar-navy bg-comar-neutral-bg p-3 rounded-xl">{detailsRC?.demande_initiale || <span className="text-gray-400 italic">Non renseignée</span>}</p>
                </div>
                <div>
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Motif d'Instance</h3>
                  <p className="text-sm text-comar-navy bg-comar-neutral-bg p-3 rounded-xl">{detailsRC?.motif_instance || <span className="text-gray-400 italic">Non renseigné</span>}</p>
                </div>
                {dossier.piece_justificative_url && (
                  <div>
                    <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Pièce Justificative</h3>
                    <a href={dossier.piece_justificative_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-comar-teal-50 text-comar-teal font-medium rounded-xl hover:bg-comar-teal-100 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Voir la pièce
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Infos système */}
            <div className="bg-white rounded-xl border border-comar-neutral-border p-6 mb-6">
              <h2 className="text-base font-bold text-comar-navy mb-4 border-b border-comar-neutral-border pb-2 flex items-center gap-2">
                <svg className="w-5 h-5 text-comar-navy/50" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
                Informations Système
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Date de création</h3>
                  <p className="text-sm text-comar-navy">{new Date(dossier.created_at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}</p>
                </div>
                {dossier.updated_at && (
                  <div>
                    <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Dernière modification</h3>
                    <p className="text-sm text-comar-navy">{new Date(dossier.updated_at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Historique et Timeline */}
            <div className="bg-white rounded-xl border border-comar-neutral-border p-6 mb-6">
              <h2 className="text-base font-bold text-comar-navy mb-6 border-b border-comar-neutral-border pb-2 flex items-center gap-2">
                <svg className="w-5 h-5 text-comar-navy/50" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Historique des Actions (Timeline)
              </h2>
              <DossierTimeline history={history} />
            </div>
          </>
        ) : (
          /* ══════ Mode édition ══════ */
          <div className="bg-white rounded-xl border border-comar-neutral-border p-8 mb-6 space-y-6">
            <h2 className="text-base font-bold text-comar-navy border-b border-comar-neutral-border pb-2 flex items-center gap-2">
              <svg className="w-5 h-5 text-comar-navy/50" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
              Modifier le dossier
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-comar-navy mb-1.5">Souscripteur <span className="text-comar-red">*</span></label>
                <input type="text" name="souscripteur" value={editForm.souscripteur} onChange={handleEditChange} required
                  className="w-full px-4 py-2.5 border border-comar-neutral-border rounded-xl focus:outline-none focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-comar-navy mb-1.5">N° Police <span className="text-comar-red">*</span></label>
                <input type="text" name="police_number" value={editForm.police_number} onChange={handleEditChange} required maxLength={10} pattern="\\d{8}-\\d" title="Format attendu: 12345678-9" placeholder="Ex: 12345678-9"
                  className="w-full px-4 py-2.5 border border-comar-neutral-border rounded-xl focus:outline-none focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy transition-all" />
                <p className="mt-1 text-xs text-gray-400">Format requis: 8 chiffres, tiret, 1 chiffre</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-comar-navy mb-1.5">Téléphone</label>
                <input type="tel" name="telephone" value={editForm.telephone} onChange={handleEditChange}
                  className="w-full px-4 py-2.5 border border-comar-neutral-border rounded-xl focus:outline-none focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy transition-all" />
              </div>
              <div>
                  <label className="block text-sm font-medium text-comar-navy mb-1.5">Agence</label>
                  <select name="agence_id" value={editForm.agence_id} onChange={handleEditChange}
                  className="w-full px-4 py-2.5 border border-comar-neutral-border rounded-xl focus:outline-none focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy transition-all">
                  <option value="">-- Sélectionner --</option>
                  {agences.map(a => (
                    <option key={a.id} value={a.id}>{a.code ? `${a.code} - ` : ''}{a.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-comar-navy mb-1.5">Date de réception</label>
                <input type="date" name="date_reception" value={editForm.date_reception} onChange={handleEditChange}
                  className="w-full px-4 py-2.5 border border-comar-neutral-border rounded-xl focus:outline-none focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-comar-navy mb-1.5">Demande Initiale</label>
                <select name="demande_initiale" value={editForm.demande_initiale} onChange={handleEditChange}
                  className="w-full px-4 py-2.5 border border-comar-neutral-border rounded-xl focus:outline-none focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy transition-all">
                  <option value="">-- Sélectionner --</option>
                  <option value="Rachat Total">Rachat Total</option>
                  <option value="Rachat Partiel">Rachat Partiel</option>
                  <option value="Rachat Échu">Rachat Échu</option>
                  <option value="Transfert Contrat">Transfert Contrat</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-comar-navy mb-1.5">Motif d'Instance <span className="text-comar-red">*</span></label>
              <textarea name="motif_instance" value={editForm.motif_instance} onChange={handleEditChange} required rows={3}
                className="w-full px-4 py-2.5 border border-comar-neutral-border rounded-xl focus:outline-none focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy transition-all" />
            </div>
            <div className="flex gap-3 pt-4 border-t border-comar-neutral-border">
              <button onClick={handleSave} disabled={saving}
                className="bg-comar-navy text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-comar-navy-light disabled:opacity-50 transition-all duration-200 flex items-center gap-2 text-sm shadow-sm hover:shadow-md cursor-pointer">
                {saving ? 'Enregistrement...' : (<><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg> Enregistrer</>)}
              </button>
              <button type="button" onClick={() => { setEditing(false); fetchDossier() }}
                className="px-5 py-2.5 bg-white text-gray-500 border border-comar-neutral-border rounded-xl font-semibold hover:bg-comar-neutral-bg transition-all duration-200 text-sm cursor-pointer">
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* ══════ Barre d'actions ══════ */}
        <div className="bg-white rounded-xl border border-comar-neutral-border p-6">
          <div className="flex flex-wrap gap-3">
            {canManageRc && !editing && (
              <>
                <button onClick={() => setEditing(true)}
                  className="bg-comar-navy text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-comar-navy-light transition-all duration-200 flex items-center gap-2 text-sm shadow-sm hover:shadow-md cursor-pointer">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                  Modifier
                </button>
                <button onClick={handleTransmitToPrestation} disabled={transmitting}
                  className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-all duration-200 flex items-center gap-2 text-sm shadow-sm hover:shadow-md cursor-pointer">
                  {transmitting ? 'Envoi...' : (<><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg> Envoyer à Prestation</>)}
                </button>
                <button onClick={handleDelete}
                  className="bg-comar-red text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-comar-red-light transition-all duration-200 flex items-center gap-2 text-sm cursor-pointer">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                  Supprimer
                </button>
              </>
            )}
            {isRC && isLocked && (
              <div className="flex items-center gap-2 text-red-700 bg-red-50 px-5 py-2.5 rounded-xl border border-red-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 7.5h.008v.008H12v-.008z" /></svg>
                <span className="font-semibold text-sm">Ce dossier est {etatLabel[dossier.etat] || dossier.etat} et n'est plus accessible pour modification.</span>
              </div>
            )}
            {!isRC && (
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-5 py-2.5 rounded-xl border border-emerald-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="font-semibold text-sm">Dossier transmis au service {niveauLabel[dossier.niveau] || dossier.niveau}</span>
              </div>
            )}
          </div>
        </div>

        <ConfirmModal 
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          type={confirmConfig.type}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        />
      </div>
    </RCLayout>
  )
}
