import { toast } from 'react-hot-toast'
// React hooks pour la gestion d'état et effets
import { useState, useEffect } from 'react'
// Client Supabase pour les requêtes DB
import { supabase } from '../../lib/supabaseClient'
// Hook pour accéder au contexte d'authentification
import { useAuth } from '../../contexts/AuthContext'
// Layout spécifique aux pages Finance
import FinanceLayout from '../../components/FinanceLayout'
// Utilitaire d'enregistrement des actions Finance
import { logFinanceAction } from '../../lib/logFinanceAction'
import { formatRequestNumber } from '../../lib/requestNumber'

/**
 * Dashboard Finance
 * Affiche tous les dossiers au niveau FINANCE
 * Avec toutes les informations jointes depuis les tables associées
 *
 * Tables jointes :
 *   - agences
 *   - dossier_details_prestation  (montant, document_complet, quittance_signee)
 *   - dossier_details_finance     (conformite_validee)
 *   - dossier_details_rc          (date_reception)
 *
 * @returns {React.ReactNode} La page dashboard dans le FinanceLayout
 */
export default function FinanceDashboard() {
  const { user } = useAuth() // Récupération de l'utilisateur connecté
  const [dossiers, setDossiers] = useState([]) // Liste des dossiers
  const [loading, setLoading] = useState(true) // Indicateur de chargement
  const [error, setError] = useState(null) // Erreur éventuelle

  // États pour la modal de conformité
  const [isConformiteModalOpen, setIsConformiteModalOpen] = useState(false)
  const [conformiteDossier, setConformiteDossier] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [conformiteForm, setConformiteForm] = useState({
    conformite_validee: false,
    moyen_paiement: 'VIREMENT',
    commentaire_finance: ''
  })

  // Chargement des dossiers au montage du composant
  useEffect(() => {
    if (user) {
      fetchFinanceDossiers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  /**
   * Récupère tous les dossiers au niveau FINANCE depuis Supabase.
   *
   * Stratégie : requête principale (dossiers + agences + détails RC) puis deux
   * requêtes séparées pour dossier_details_prestation et dossier_details_finance
   * afin de contourner les contraintes RLS sur les JOINs imbriqués.
   * Les résultats sont ensuite fusionnés manuellement.
   */
  const fetchFinanceDossiers = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log(' [FinanceDashboard] Chargement des dossiers FINANCE...')

      // ─────────────────────────────────────────────────────────────
      // Requête 1 : dossiers + agence + détails RC
      // ─────────────────────────────────────────────────────────────
      const { data: dossiersData, error: fetchError } = await supabase
        .from('dossiers')
        .select(`
          id,
          souscripteur,
          police_number,
          niveau,
          etat,
          is_urgent,
          created_at,
          updated_at,
          piece_justificative_url,
          agences (
            id,
            nom
          ),
          dossier_details_rc (
            date_reception,
            demande_initiale,
            telephone,
            motif_instance
          )
        `)
        .or('niveau.eq.FINANCE,etat.eq.EN_INSTANCE')
        .neq('etat', 'ANNULE')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      if (!dossiersData || dossiersData.length === 0) {
        console.log('ℹ [FinanceDashboard] Aucun dossier au niveau FINANCE')
        setDossiers([])
        return
      }

      console.log(' [FinanceDashboard] Dossiers chargés :', dossiersData.length)

      const dossierIds = dossiersData.map((d) => d.id)

      // ─────────────────────────────────────────────────────────────
      // Requête 2 : détails prestation (contourne RLS JOIN)
      // ─────────────────────────────────────────────────────────────
      const { data: prestationDetails, error: prestError } = await supabase
        .from('dossier_details_prestation')
        .select('dossier_id, montant, document_complet, quittance_signee')
        .in('dossier_id', dossierIds)

      if (prestError) {
        console.warn(' [FinanceDashboard] Erreur détails prestation :', prestError.message)
      }

      // ─────────────────────────────────────────────────────────────
      // Requête 3 : détails finance (contourne RLS JOIN)
      // ─────────────────────────────────────────────────────────────
      const { data: financeDetails, error: finError } = await supabase
        .from('dossier_details_finance')
        .select('dossier_id, conformite_validee, moyen_paiement, commentaire_finance, date_paiement')
        .in('dossier_id', dossierIds)

      if (finError) {
        console.warn(' [FinanceDashboard] Erreur détails finance :', finError.message)
      }

      // ─────────────────────────────────────────────────────────────
      // Fusion manuelle des trois ensembles de données
      // ─────────────────────────────────────────────────────────────
      const prestationMap = {}
      if (prestationDetails) {
        prestationDetails.forEach((p) => { prestationMap[p.dossier_id] = p })
      }

      const financeMap = {}
      if (financeDetails) {
        financeDetails.forEach((f) => { financeMap[f.dossier_id] = f })
      }

      const merged = dossiersData.map((d) => ({
        ...d,
        dossier_details_prestation: prestationMap[d.id] ? [prestationMap[d.id]] : [],
        dossier_details_finance: financeMap[d.id] ? [financeMap[d.id]] : [],
      }))

      console.log(' [FinanceDashboard] Fusion terminée :', merged.length, 'dossier(s)')
      setDossiers(merged)
    } catch (err) {
      console.error(' [FinanceDashboard] Erreur lors du chargement :', err)
      setError(err.message || 'Erreur inconnue lors du chargement des dossiers')
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Gestion de la modal de conformité
  // ─────────────────────────────────────────────────────────────────

  /**
   * Ouvre la modal de vérification de conformité pour un dossier
   * @param {Object} dossier - Dossier à traiter
   */
  const openConformiteModal = (dossier) => {
    const existing = dossier.dossier_details_finance?.[0] || {}
    setConformiteDossier(dossier)
    setConformiteForm({
      conformite_validee: existing.conformite_validee ?? false,
      moyen_paiement: existing.moyen_paiement || 'VIREMENT',
      commentaire_finance: existing.commentaire_finance || ''
    })
    setIsConformiteModalOpen(true)
  }

  /**
   * Ferme la modal et réinitialise les états
   */
  const closeConformiteModal = () => {
    setIsConformiteModalOpen(false)
    setConformiteDossier(null)
    setConformiteForm({
      conformite_validee: false,
      moyen_paiement: 'VIREMENT',
      commentaire_finance: ''
    })
  }

  /**
   * Soumet la vérification de conformité :
   *   1. Upsert dans dossier_details_finance
   *   2. Insert dans historique_actions (action = 'VALIDATION_CONFORMITE')
   *   3. Rafraîchissement silencieux de la liste
   */
  const handleConformiteSubmit = async () => {
    if (!conformiteDossier) return

    if (conformiteDossier.etat === 'ANNULE') {
      toast.error('Ce dossier est annulé et n\'est plus accessible pour le service Finance.')
      closeConformiteModal()
      return
    }

    setIsSaving(true)

    try {
      console.log(' [FinanceDashboard] Validation conformité pour dossier #', conformiteDossier.id)

      // ── Étape 1 : Upsert dossier_details_finance ──────────────────
      const { error: upsertError } = await supabase
        .from('dossier_details_finance')
        .upsert(
          {
            dossier_id:          conformiteDossier.id,
            conformite_validee:  conformiteForm.conformite_validee,
            moyen_paiement:      conformiteForm.moyen_paiement,
            commentaire_finance: conformiteForm.commentaire_finance.trim() || null
          },
          { onConflict: 'dossier_id' }
        )

      if (upsertError) throw upsertError

      console.log(' [FinanceDashboard] dossier_details_finance mis à jour')

      // ── Étape 1b : Si conformité validée, changer niveau à FINANCE ──
      if (conformiteForm.conformite_validee) {
        const { error: niveauErr } = await supabase
          .from('dossiers')
          .update({ niveau: 'FINANCE', updated_at: new Date().toISOString() })
          .eq('id', conformiteDossier.id)

        if (niveauErr) {
          console.warn(' [FinanceDashboard] Erreur MAJ niveau:', niveauErr.message)
        } else {
          console.log(' [FinanceDashboard] Niveau mis à jour à FINANCE')
        }
      }

      // ── Étape 2 : Historique des actions ──────────────────────────
      if (user?.id) {
        await logFinanceAction(
          conformiteDossier.id,
          'VALIDATION_CONFORMITE',
          user.id,
          {
            description: `Conformité ${conformiteForm.conformite_validee ? 'validée' : 'non validée'} — Moyen de paiement : ${conformiteForm.moyen_paiement}${conformiteForm.commentaire_finance ? ` — ${conformiteForm.commentaire_finance.trim()}` : ''}`,
            old_status:  conformiteDossier.etat,
            new_status:  conformiteDossier.etat,
          }
        )
      }

      // ── Étape 3 : Rafraîchissement silencieux ─────────────────────
      closeConformiteModal()
      await fetchFinanceDossiers()

    } catch (err) {
      console.error(' [FinanceDashboard] Erreur validation conformité :', err)
      toast.error(`Erreur : ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Confirme le paiement d'un dossier :
   *   1. Met à jour dossier_details_finance  → date_paiement = aujourd'hui
   *   2. Met à jour dossiers                 → etat = 'CLOTURE'
   *   3. Insert historique_actions           → action = 'PAIEMENT_CONFIRME'
   *   4. Crée des notifications pour tous les utilisateurs Relation Client
   *
   * Condition d'activation : conformite_validee = true ET quittance_signee = true
   *
   * @param {Object} dossier - Dossier à clôturer
   */
  const handleConfirmerPaiement = async (dossier) => {
    if (dossier.etat === 'ANNULE') {
      toast.error('Ce dossier est annulé et n\'est plus accessible pour le service Finance.')
      return
    }

    const detailsFinance    = dossier.dossier_details_finance?.[0]    || {}
    const detailsPrestation = dossier.dossier_details_prestation?.[0] || {}

    if (!detailsFinance.conformite_validee || !detailsPrestation.quittance_signee) {
      toast.error("La conformité doit être validée et la quittance signée avant de confirmer le paiement.")
      return
    }

    const confirmed = window.confirm(
      `Confirmer le paiement du dossier "${dossier.souscripteur}" ?

Cette action clôturera définitivement le dossier.`
    )
    if (!confirmed) return

    setIsSaving(true)

    try {
      console.log(' [FinanceDashboard] Confirmation paiement pour dossier #', dossier.id)

      const todayISO = new Date().toISOString().split('T')[0] // YYYY-MM-DD

      // ── Étape 1 : date_paiement dans dossier_details_finance ──────
      const { error: dateErr } = await supabase
        .from('dossier_details_finance')
        .upsert(
          { dossier_id: dossier.id, date_paiement: todayISO },
          { onConflict: 'dossier_id' }
        )

      if (dateErr) throw dateErr
      console.log(' [FinanceDashboard] date_paiement mise à jour :', todayISO)

      // ── Étape 2 : etat = 'CLOTURE' dans dossiers ─────────────────
      const { error: etatErr } = await supabase
        .from('dossiers')
        .update({ etat: 'CLOTURE' })
        .eq('id', dossier.id)

      if (etatErr) throw etatErr
      console.log(' [FinanceDashboard] Dossier clôturé')

      // ── Étape 3 : Historique ──────────────────────────────────────
      if (user?.id) {
        await logFinanceAction(
          dossier.id,
          'PAIEMENT_CONFIRME',
          user.id,
          {
            description: `Paiement confirmé — dossier clôturé le ${todayISO}`,
            old_status:  'EN_INSTANCE',
            new_status:  'CLOTURE',
          }
        )
      }

      // ── Étape 4 : Notifications pour les RC ──────────────────────
      const { data: rcUsers, error: rcErr } = await supabase
        .from('users')
        .select('id, roles!inner(name)')
        .eq('roles.name', 'RC')

      if (rcErr) {
        console.warn(' [FinanceDashboard] Erreur récupération RC (non bloquant) :', rcErr.message)
      } else if (rcUsers && rcUsers.length > 0) {
        const notifications = rcUsers.map((u) => ({
          user_id:    u.id,
          dossier_id: dossier.id,
          type:       'PAIEMENT_CONFIRME',
          message:    `Paiement confirmé pour le dossier de ${dossier.souscripteur} — dossier clôturé.`,
          is_read:    false,
          created_at: new Date().toISOString()
        }))

        const { error: notifErr } = await supabase
          .from('notifications')
          .insert(notifications)

        if (notifErr) {
          console.warn(' [FinanceDashboard] Erreur notifications (non bloquant) :', notifErr.message)
        } else {
          console.log(' [FinanceDashboard] Notifications RC créées :', notifications.length)
        }
      }

      // ── Étape 5 : Rafraîchissement ────────────────────────────────
      await fetchFinanceDossiers()

    } catch (err) {
      console.error(' [FinanceDashboard] Erreur confirmation paiement :', err)
      toast.error(`Erreur : ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Helpers d'affichage
  // ─────────────────────────────────────────────────────────────────

  /**
   * Formate un montant en devise locale (TND)
   * @param {number|null|undefined} montant
   * @returns {string}
   */
  const formatMontant = (montant) => {
    if (montant === null || montant === undefined || montant === '') return '-'
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 3,
    }).format(Number(montant))
  }

  /**
   * Formate une date (fallback possible)
   * @param {string|null|undefined} dateString
   * @param {string|null|undefined} fallbackDate
   * @returns {string}
   */
  const formatDate = (dateString, fallbackDate = null) => {
    const value = dateString || fallbackDate
    if (!value) return '-'

    try {
      return new Date(value).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
    } catch {
      return '-'
    }
  }

  /**
   * Libellé lisible du niveau
   * @param {string|null|undefined} niveau
   * @returns {string}
   */
  const getNiveauLabel = (niveau) => {
    const niveauMap = {
      RELATION_CLIENT: 'Relation Client',
      PRESTATION: 'Prestation',
      FINANCE: 'Finance'
    }

    return niveauMap[niveau] || niveau || 'N/A'
  }

  /**
   * Nettoie l'affichage de la demande initiale (compat legacy)
   * @param {string|null|undefined} demandeInitiale
   * @param {string|null|undefined} motifInstance
   * @returns {string}
   */
  const getDemandeInitialeLabel = (demandeInitiale, motifInstance) => {
    const demande = (demandeInitiale || '').trim()
    if (!demande) return 'Non renseignée'

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

  /**
   * Retourne un badge JSX pour un champ booléen
   * @param {boolean|null|undefined} value
   * @param {string} labelTrue  - Libellé quand true
   * @param {string} labelFalse - Libellé quand false
   * @returns {React.ReactNode}
   */
  const BoolBadge = ({ value, labelTrue = 'Oui', labelFalse = 'Non' }) => {
    if (value === true) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
           {labelTrue}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
         {labelFalse}
      </span>
    )
  }

  /**
   * Retourne un badge JSX coloré selon l'état du dossier
   * @param {string} etat
   * @returns {React.ReactNode}
   */
  const EtatBadge = ({ etat }) => {
    const config = {
      EN_COURS:    { bg: 'bg-comar-navy-50',   text: 'text-comar-navy',   label: 'En cours' },
      EN_INSTANCE: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'En instance' },
      VALIDE:      { bg: 'bg-emerald-50',  text: 'text-emerald-700',  label: 'Validé' },
      REJETE:      { bg: 'bg-red-100',    text: 'text-red-800',    label: 'Rejeté' },
      ANNULE:      { bg: 'bg-red-100',    text: 'text-red-800',    label: 'Annulé' },
      CLOTURE:     { bg: 'bg-comar-neutral-bg',   text: 'text-gray-700',   label: 'Clôturé' },
    }
    const c = config[etat] || { bg: 'bg-comar-neutral-bg', text: 'text-gray-600', label: etat || '-' }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
        {c.label}
      </span>
    )
  }

  // ─────────────────────────────────────────────────────────────────
  // Affichage du loader
  // ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <FinanceLayout>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-comar-navy mb-4"></div>
              <p className="text-gray-600">Chargement des dossiers Finance...</p>
            </div>
          </div>
        </div>
      </FinanceLayout>
    )
  }

  // ─────────────────────────────────────────────────────────────────
  // Affichage de l'erreur
  // ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <FinanceLayout>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-red-600 text-6xl mb-4"></div>
              <h2 className="text-2xl font-bold text-comar-navy mb-2">Erreur de chargement</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={fetchFinanceDossiers}
                className="bg-comar-navy text-white px-6 py-2 rounded-xl hover:bg-comar-navy-light transition"
              >
                Réessayer
              </button>
            </div>
          </div>
        </div>
      </FinanceLayout>
    )
  }

  const modalRcDetails = conformiteDossier?.dossier_details_rc?.[0] || {}
  const modalPrestationDetails = conformiteDossier?.dossier_details_prestation?.[0] || {}
  const modalFinanceDetails = conformiteDossier?.dossier_details_finance?.[0] || {}

  // ─────────────────────────────────────────────────────────────────
  // Rendu principal
  // ─────────────────────────────────────────────────────────────────
  return (
    <FinanceLayout>
      <div className="p-6">

        {/* ── En-tête ── */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-comar-navy">Dashboard Finance</h1>
            <p className="text-gray-600 mt-1">
              Liste de tous les dossiers au niveau Finance ({dossiers.length} au total)
            </p>
          </div>
          <button
            onClick={fetchFinanceDossiers}
            className="bg-comar-navy text-white px-6 py-3 rounded-xl hover:bg-comar-navy-light transition flex items-center gap-2 font-semibold"
          >
            <span className="text-xl"></span>
            Actualiser
          </button>
        </div>

        {/* ── Statistiques rapides ── */}
        {dossiers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {/* Total */}
              <div className="bg-white rounded-xl border border-comar-neutral-border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total</p>
                    <p className="text-2xl font-bold text-comar-navy mt-1">{dossiers.length}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-comar-navy-50 flex items-center justify-center"><svg className="w-5 h-5 text-comar-navy" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg></div>
                </div>
              </div>

              {/* Conformités validées */}
              <div className="bg-white rounded-xl border border-comar-neutral-border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Conformités validées</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">
                      {dossiers.filter((d) => d.dossier_details_finance?.[0]?.conformite_validee === true).length}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg></div>
                </div>
              </div>

              {/* Documents complets */}
              <div className="bg-white rounded-xl border border-comar-neutral-border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Docs complets</p>
                    <p className="text-2xl font-bold text-sky-600 mt-1">
                      {dossiers.filter((d) => d.dossier_details_prestation?.[0]?.document_complet === true).length}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center"><svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 019 9v.375M10.125 2.25A3.375 3.375 0 0113.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 013.375 3.375M9 15l2.25 2.25L15 12" /></svg></div>
                </div>
              </div>

              {/* Quittances signées */}
              <div className="bg-white rounded-xl border border-comar-neutral-border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Quittances signées</p>
                    <p className="text-2xl font-bold text-violet-600 mt-1">
                      {dossiers.filter((d) => d.dossier_details_prestation?.[0]?.quittance_signee === true).length}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center"><svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75" /></svg></div>
                </div>
              </div>
            </div>

        )}

        {/* ── Message si aucun dossier ── */}
        {dossiers.length === 0 ? (
          <div className="bg-white rounded-xl border border-comar-neutral-border p-12 text-center">
            <h3 className="text-xl font-semibold text-comar-navy mb-2">Aucun dossier Finance</h3>
            <p className="text-gray-600">Aucun dossier n'est actuellement au niveau FINANCE.</p>
          </div>
        ) : (
          /* ── Tableau des dossiers ── */
          <div className="bg-white rounded-xl border border-comar-neutral-border overflow-hidden">
            <div className="hidden xl:block">
              <table className="w-full table-fixed divide-y divide-comar-neutral-border">
                <thead className="bg-comar-navy">
                  <tr>
                    <th className="px-3 py-3 text-left text-[11px] font-bold text-white/80 uppercase tracking-wider">Souscripteur</th>
                    <th className="px-3 py-3 text-left text-[11px] font-bold text-white/80 uppercase tracking-wider">N° Police</th>
                    <th className="hidden 2xl:table-cell px-3 py-3 text-left text-[11px] font-bold text-white/80 uppercase tracking-wider">Agence</th>
                    <th className="px-3 py-3 text-left text-[11px] font-bold text-white/80 uppercase tracking-wider">Montant</th>
                    <th className="px-3 py-3 text-left text-[11px] font-bold text-white/80 uppercase tracking-wider">Doc.</th>
                    <th className="px-3 py-3 text-left text-[11px] font-bold text-white/80 uppercase tracking-wider">Quittance</th>
                    <th className="px-3 py-3 text-left text-[11px] font-bold text-white/80 uppercase tracking-wider">Conformité</th>
                    <th className="hidden 2xl:table-cell px-3 py-3 text-left text-[11px] font-bold text-white/80 uppercase tracking-wider">Paiement</th>
                    <th className="px-3 py-3 text-left text-[11px] font-bold text-white/80 uppercase tracking-wider">État</th>
                    <th className="px-3 py-3 text-left text-[11px] font-bold text-white/80 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-comar-neutral-border">
                  {dossiers.map((dossier) => {
                    const detailsPrestation = dossier.dossier_details_prestation?.[0] || {}
                    const detailsFinance    = dossier.dossier_details_finance?.[0]    || {}
                    const agence            = dossier.agences                         || {}
                    const quittanceSignee = detailsPrestation.quittance_signee === true
                    const canConfirmerPaiement =
                      quittanceSignee &&
                      detailsFinance.conformite_validee === true &&
                      dossier.etat !== 'CLOTURE' &&
                      dossier.etat !== 'ANNULE' &&
                      !isSaving

                    return (
                      <tr key={dossier.id} className="hover:bg-comar-navy-50/30 transition-colors duration-150 align-top">
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-1">
                            <div className="text-sm font-semibold text-gray-900 break-words">{dossier.souscripteur || 'N/A'}</div>
                            {dossier.is_urgent && (
                              <span className="w-fit px-2 py-0.5 inline-flex text-[11px] font-semibold rounded-full bg-comar-red/10 text-comar-red">
                                Prioritaire
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-600 font-mono break-all">{dossier.police_number || '-'}</td>
                        <td className="hidden 2xl:table-cell px-3 py-3 text-sm text-gray-600 break-words">{agence.nom || '-'}</td>
                        <td className="px-3 py-3">
                          <div className="text-sm font-semibold text-gray-900">{formatMontant(detailsPrestation.montant)}</div>
                        </td>
                        <td className="px-3 py-3"><BoolBadge value={detailsPrestation.document_complet} /></td>
                        <td className="px-3 py-3"><BoolBadge value={detailsPrestation.quittance_signee} /></td>
                        <td className="px-3 py-3"><BoolBadge value={detailsFinance.conformite_validee} /></td>
                        <td className="hidden 2xl:table-cell px-3 py-3 text-sm text-gray-600">{formatDate(detailsFinance.date_paiement)}</td>
                        <td className="px-3 py-3"><EtatBadge etat={dossier.etat} /></td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-2">
                            {!quittanceSignee && (
                              <p className="text-xs font-semibold text-red-600 leading-snug">Paiement impossible : quittance non signée.</p>
                            )}

                            <button
                              onClick={() => openConformiteModal(dossier)}
                              disabled={!quittanceSignee || isSaving || dossier.etat === 'CLOTURE' || dossier.etat === 'ANNULE'}
                              title={
                                !quittanceSignee
                                  ? 'Quittance non signée'
                                  : dossier.etat === 'ANNULE'
                                  ? 'Dossier annulé par un administrateur'
                                  : dossier.etat === 'CLOTURE'
                                  ? 'Dossier déjà clôturé'
                                  : 'Vérifier la conformité du dossier'
                              }
                              className="w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-emerald-600 text-white text-[11px] font-semibold rounded-md hover:bg-emerald-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <span className="2xl:hidden">Conformité</span>
                              <span className="hidden 2xl:inline">Vérifier conformité</span>
                            </button>

                            <button
                              onClick={() => handleConfirmerPaiement(dossier)}
                              disabled={!canConfirmerPaiement}
                              title={
                                !quittanceSignee
                                  ? 'Quittance non signée'
                                  : !detailsFinance.conformite_validee
                                  ? 'La conformité doit être validée'
                                  : dossier.etat === 'ANNULE'
                                  ? 'Dossier annulé par un administrateur'
                                  : dossier.etat === 'CLOTURE'
                                  ? 'Dossier déjà clôturé'
                                  : 'Confirmer le paiement et clôturer le dossier'
                              }
                              className="w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 bg-comar-navy text-white text-[11px] font-semibold rounded-md hover:bg-comar-navy-light transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <span className="2xl:hidden">Paiement</span>
                              <span className="hidden 2xl:inline">Confirmer paiement</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="xl:hidden divide-y divide-comar-neutral-border">
              {dossiers.map((dossier) => {
                const detailsPrestation = dossier.dossier_details_prestation?.[0] || {}
                const detailsFinance    = dossier.dossier_details_finance?.[0]    || {}
                const agence            = dossier.agences                         || {}
                const quittanceSignee = detailsPrestation.quittance_signee === true
                const canConfirmerPaiement =
                  quittanceSignee &&
                  detailsFinance.conformite_validee === true &&
                  dossier.etat !== 'CLOTURE' &&
                  dossier.etat !== 'ANNULE' &&
                  !isSaving

                return (
                  <div key={dossier.id} className="p-4 sm:p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 break-words">{dossier.souscripteur || 'N/A'}</p>
                        <p className="text-xs text-gray-500 mt-0.5 font-mono break-all">{dossier.police_number || '-'}</p>
                        <p className="text-xs text-gray-500 mt-0.5 break-words">{agence.nom || '-'}</p>
                      </div>
                      <EtatBadge etat={dossier.etat} />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Montant</p>
                        <p className="font-semibold text-gray-900">{formatMontant(detailsPrestation.montant)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Date paiement</p>
                        <p className="text-gray-700">{formatDate(detailsFinance.date_paiement)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Doc. complet</p>
                        <BoolBadge value={detailsPrestation.document_complet} />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Quittance signée</p>
                        <BoolBadge value={detailsPrestation.quittance_signee} />
                      </div>
                      <div className="col-span-2">
                        <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Conformité validée</p>
                        <BoolBadge value={detailsFinance.conformite_validee} />
                      </div>
                    </div>

                    {!quittanceSignee && (
                      <p className="text-xs font-semibold text-red-600">Paiement impossible : quittance non signée.</p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        onClick={() => openConformiteModal(dossier)}
                        disabled={!quittanceSignee || isSaving || dossier.etat === 'CLOTURE' || dossier.etat === 'ANNULE'}
                        title={
                          !quittanceSignee
                            ? 'Quittance non signée'
                            : dossier.etat === 'ANNULE'
                            ? 'Dossier annulé par un administrateur'
                            : dossier.etat === 'CLOTURE'
                            ? 'Dossier déjà clôturé'
                            : 'Vérifier la conformité du dossier'
                        }
                        className="inline-flex items-center justify-center gap-1 px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-md hover:bg-emerald-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Vérifier conformité
                      </button>

                      <button
                        onClick={() => handleConfirmerPaiement(dossier)}
                        disabled={!canConfirmerPaiement}
                        title={
                          !quittanceSignee
                            ? 'Quittance non signée'
                            : !detailsFinance.conformite_validee
                            ? 'La conformité doit être validée'
                            : dossier.etat === 'ANNULE'
                            ? 'Dossier annulé par un administrateur'
                            : dossier.etat === 'CLOTURE'
                            ? 'Dossier déjà clôturé'
                            : 'Confirmer le paiement et clôturer le dossier'
                        }
                        className="inline-flex items-center justify-center gap-1 px-3 py-2 bg-comar-navy text-white text-xs font-semibold rounded-md hover:bg-comar-navy-light transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Confirmer paiement
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Modal — Vérification de conformité                          */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {isConformiteModalOpen && conformiteDossier && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={!isSaving ? closeConformiteModal : undefined}
          ></div>

          <div className="relative min-h-full flex items-start justify-center p-4 sm:p-6">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-y-auto max-h-[calc(100vh-2rem)] my-4">

            {/* ── En-tête modal ── */}
            <div className="bg-emerald-600 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white"> Vérification de conformité</h2>
                <p className="text-emerald-100 text-sm mt-0.5">
                  {conformiteDossier.souscripteur} — {conformiteDossier.police_number || 'N/A'} · Demande {formatRequestNumber(conformiteDossier)}
                </p>
              </div>
              <button
                onClick={closeConformiteModal}
                disabled={isSaving}
                className="text-white hover:text-emerald-200 text-2xl leading-none disabled:opacity-50"
              >
                ×
              </button>
            </div>

            {/* ── Résumé du dossier ── */}
            <div className="px-6 pt-5">
              <div className="bg-comar-neutral-bg rounded-xl p-4 border border-comar-neutral-border">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">N° demande</p>
                    <p className="text-gray-900 font-semibold">{formatRequestNumber(conformiteDossier)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Dernière mise à jour</p>
                    <p className="text-gray-900">{formatDate(conformiteDossier.updated_at, conformiteDossier.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Date de création</p>
                    <p className="text-gray-900">{formatDate(conformiteDossier.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Date de réception</p>
                    <p className="text-gray-900">{formatDate(modalRcDetails.date_reception, conformiteDossier.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Agence</p>
                    <p className="text-gray-900">{conformiteDossier.agences?.nom || 'Non renseignée'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Téléphone</p>
                    <p className="text-gray-900">{modalRcDetails.telephone || 'Non renseigné'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Niveau</p>
                    <p className="text-gray-900">{getNiveauLabel(conformiteDossier.niveau)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">État actuel</p>
                    <div>
                      <EtatBadge etat={conformiteDossier.etat} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Montant</p>
                    <p className="text-gray-900 font-semibold">{formatMontant(modalPrestationDetails.montant)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Moyen de paiement enregistré</p>
                    <p className="text-gray-900">{modalFinanceDetails.moyen_paiement || 'Non renseigné'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Date de paiement</p>
                    <p className="text-gray-900">{formatDate(modalFinanceDetails.date_paiement)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Document complet</p>
                    <div>
                      <BoolBadge value={modalPrestationDetails.document_complet} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Quittance signée</p>
                    <div>
                      <BoolBadge value={modalPrestationDetails.quittance_signee} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Conformité enregistrée</p>
                    <div>
                      <BoolBadge value={modalFinanceDetails.conformite_validee} />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Demande initiale</p>
                    <p className="text-gray-900 bg-white border border-comar-neutral-border rounded-lg px-3 py-2">
                      {getDemandeInitialeLabel(modalRcDetails.demande_initiale, modalRcDetails.motif_instance)}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Motif d'instance</p>
                    <p className="text-gray-900 bg-white border border-comar-neutral-border rounded-lg px-3 py-2 min-h-[42px]">
                      {modalRcDetails.motif_instance || 'Non renseigné'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Piece justificative ── */}
            <div className="px-6 pt-5">
              {conformiteDossier.piece_justificative_url ? (
                <a href={conformiteDossier.piece_justificative_url} target="_blank" rel="noopener noreferrer" className="inline-flex w-full justify-center items-center gap-2 px-4 py-2 bg-comar-teal-50 text-comar-teal font-medium rounded-xl hover:bg-comar-teal-100 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Voir la pièce justificative
                </a>
              ) : (
                <p className="text-sm text-gray-500 text-center">Aucune pièce justificative jointe à ce dossier.</p>
              )}
            </div>

            {/* ── Corps du formulaire ── */}
            <div className="px-6 py-5 space-y-5">

              {/* Conformité validée */}
              <div className="flex items-center justify-between rounded-xl border border-comar-neutral-border px-4 py-3">
                <label className="text-sm font-semibold text-gray-700 select-none" htmlFor="conformite_validee">
                  Conformité validée
                </label>
                <button
                  id="conformite_validee"
                  type="button"
                  onClick={() =>
                    setConformiteForm((prev) => ({
                      ...prev,
                      conformite_validee: !prev.conformite_validee
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    conformiteForm.conformite_validee ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      conformiteForm.conformite_validee ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Moyen de paiement */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="moyen_paiement">
                  Moyen de paiement
                </label>
                <select
                  id="moyen_paiement"
                  value={conformiteForm.moyen_paiement}
                  onChange={(e) =>
                    setConformiteForm((prev) => ({ ...prev, moyen_paiement: e.target.value }))
                  }
                  className="w-full border border-comar-neutral-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  <option value="VIREMENT"> Virement</option>
                  <option value="CHEQUE"> Chèque</option>
                  <option value="ESPECES"> Espèces</option>
                </select>
              </div>

              {/* Commentaire finance */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="commentaire_finance">
                  Commentaire finance
                  <span className="font-normal text-gray-400 ml-1">(optionnel)</span>
                </label>
                <textarea
                  id="commentaire_finance"
                  value={conformiteForm.commentaire_finance}
                  onChange={(e) =>
                    setConformiteForm((prev) => ({ ...prev, commentaire_finance: e.target.value }))
                  }
                  rows={3}
                  placeholder="Remarques ou observations..."
                  className="w-full border border-comar-neutral-border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

            </div>

            {/* ── Pied de modal ── */}
            <div className="px-6 py-4 bg-comar-neutral-bg flex justify-end gap-3 border-t border-comar-neutral-border">
              <button
                onClick={closeConformiteModal}
                disabled={isSaving}
                className="px-5 py-2 rounded-xl border border-comar-neutral-border text-sm font-medium text-gray-700 hover:bg-comar-neutral-bg transition disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleConformiteSubmit}
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    Enregistrement...
                  </>
                ) : (
                  ' Valider'
                )}
              </button>
            </div>

            </div>
          </div>
        </div>
      )}

    </FinanceLayout>
  )
}
