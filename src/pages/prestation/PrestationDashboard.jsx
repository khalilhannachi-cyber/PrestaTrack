// React hooks pour la gestion d'état et effets
import { useState, useEffect } from 'react'
// Navigation programmatique
import { useNavigate } from 'react-router-dom'
// Client Supabase pour les requêtes DB
import { supabase } from '../../lib/supabaseClient'
// Hook pour accéder au contexte d'authentification
import { useAuth } from '../../contexts/AuthContext'
// Layout spécifique aux pages Prestation
import PrestationLayout from '../../components/PrestationLayout'

/**
 * Dashboard des prestations
 * Affiche tous les dossiers au niveau PRESTATION
 * Avec toutes les informations jointes depuis les tables associées
 * 
 * @returns {React.ReactNode} La page dashboard dans le PrestationLayout
 */
export default function PrestationDashboard() {
  const { user } = useAuth() // Récupération de l'utilisateur connecté
  const navigate = useNavigate() // Navigation programmatique
  const [dossiers, setDossiers] = useState([]) // Liste des dossiers
  const [loading, setLoading] = useState(true) // Indicateur de chargement
  const [error, setError] = useState(null) // Erreur éventuelle
  
  // États pour la modal d'édition
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingDossier, setEditingDossier] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    montant: '',
    motif_instance: '',
    document_complet: false,
    quittance_signee: false
  })

  // Chargement des dossiers au montage du composant
  useEffect(() => {
    if (user) {
      fetchPrestationDossiers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  /**
   * Enregistre une action dans l'historique
   * Fonction réutilisable pour toutes les actions importantes
   * 
   * @param {number} dossierId - ID du dossier concerné
   * @param {string} action - Type d'action effectuée
   * @param {string} oldStatus - Ancien statut
   * @param {string} newStatus - Nouveau statut
   * @param {string} description - Description détaillée de l'action
   * @returns {Promise<boolean>} - True si succès, False si erreur
   */
  const logAction = async (dossierId, action, oldStatus, newStatus, description = '') => {
    try {
      console.log(` [PrestationDashboard] Enregistrement action: ${action} pour dossier #${dossierId}`)
      
      // Vérifier que l'utilisateur est authentifié
      if (!user || !user.id) {
        console.warn(' [PrestationDashboard] Utilisateur non authentifié - historique non enregistré')
        return false
      }
      
      const { error } = await supabase
        .from('historique_actions')
        .insert([
          {
            dossier_id: dossierId,
            user_id: user.id,
            action: action,
            description: description || `${action} - État: ${oldStatus} → ${newStatus}`,
            old_status: oldStatus,
            new_status: newStatus
          }
        ])

      if (error) {
        console.error(' [PrestationDashboard] Erreur insertion historique:', error)
        return false
      }

      console.log(' [PrestationDashboard] Action enregistrée dans l\'historique')
      return true
    } catch (err) {
      console.error(' [PrestationDashboard] Erreur lors de l\'enregistrement de l\'action:', err)
      return false
    }
  }

  /**
   * Récupère tous les dossiers au niveau PRESTATION depuis Supabase
   * Avec JOINs sur les tables dossier_details_prestation, dossier_details_rc et agences
   * Triés par date de création (plus récents en premier)
   */
  const fetchPrestationDossiers = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      setError(null)

      // Requête 1 : dossiers + agence + détails RC
      const { data: dossiers, error: fetchError } = await supabase
        .from('dossiers')
        .select(`
          id,
          souscripteur,
          police_number,
          niveau,
          etat,
          created_at,
          agences ( id, nom ),
          dossier_details_rc ( date_reception, motif_instance )
        `)
        .eq('niveau', 'PRESTATION')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      if (!dossiers || dossiers.length === 0) {
        setDossiers([])
        return
      }

      // Requête 2 : détails prestation en requête séparée (contourne RLS JOIN)
      const dossierIds = dossiers.map(d => d.id)
      const { data: prestationDetails } = await supabase
        .from('dossier_details_prestation')
        .select('dossier_id, montant, document_complet, quittance_signee')
        .in('dossier_id', dossierIds)

      // Fusion manuelle
      const prestationMap = {}
      if (prestationDetails) {
        prestationDetails.forEach(p => { prestationMap[p.dossier_id] = p })
      }

      const merged = dossiers.map(d => ({
        ...d,
        dossier_details_prestation: prestationMap[d.id] ? [prestationMap[d.id]] : []
      }))

      setDossiers(merged)
    } catch (err) {
      console.error(' [PrestationDashboard] Erreur lors du chargement:', err)
      setError(err.message || 'Erreur inconnue lors du chargement des dossiers')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  /**
   * Ouvre la modal d'édition avec les données du dossier
   * @param {Object} dossier - Dossier à éditer
   */
  const openEditModal = (dossier) => {
    // Vérification que le niveau est bien PRESTATION
    if (dossier.niveau !== 'PRESTATION') {
      alert(' Impossible d\'éditer ce dossier : il n\'est plus au niveau PRESTATION.')
      return
    }

    const detailsPrestation = dossier.dossier_details_prestation?.[0] || {}
    const detailsRC = dossier.dossier_details_rc?.[0] || {}

    setEditingDossier(dossier)
    setFormData({
      montant: detailsPrestation.montant || '',
      motif_instance: detailsRC.motif_instance || '',
      document_complet: detailsPrestation.document_complet || false,
      quittance_signee: detailsPrestation.quittance_signee || false
    })
    setIsEditModalOpen(true)
  }

  /**
   * Ferme la modal d'édition et réinitialise les états
   */
  const closeEditModal = () => {
    setIsEditModalOpen(false)
    setEditingDossier(null)
    setFormData({
      montant: '',
      motif_instance: '',
      document_complet: false,
      quittance_signee: false
    })
  }

  /**
   * Gère les changements dans le formulaire
   * @param {Event} e - Événement de changement
   */
  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  /**
   * Soumet les modifications du dossier
   * Processus en 2 étapes :
   * 1. Met à jour dossier_details_prestation et dossier_details_rc
   * 2. Insère dans historique_actions
   */
  const handleSubmitEdit = async (e) => {
    e.preventDefault()
    
    if (!editingDossier) return

    // Vérification d'authentification
    if (!user || !user.id) {
      alert(' Votre session a expiré. Veuillez vous reconnecter.')
      closeEditModal()
      navigate('/login')
      return
    }

    // Vérification de sécurité : niveau doit être PRESTATION
    if (editingDossier.niveau !== 'PRESTATION') {
      alert(' Impossible de modifier : le dossier n\'est plus au niveau PRESTATION.')
      closeEditModal()
      return
    }

    setIsSaving(true)

    try {
      console.log(' [PrestationDashboard] Début de la modification du dossier #', editingDossier.id)
      
      const oldEtat = editingDossier.etat
      
      // ─────────────────────────────────────────────────────────────
      // ÉTAPE 1 : Mise à jour de dossier_details_prestation
      // Vérifier si la ligne existe, sinon la créer
      // ─────────────────────────────────────────────────────────────
      console.log(' [PrestationDashboard] Étape 1 : Sauvegarde dossier_details_prestation')

      const prestationPayload = {
        montant: formData.montant !== '' ? parseFloat(formData.montant) : null,
        document_complet: formData.document_complet,
        quittance_signee: formData.quittance_signee
      }

      // Assurer l'existence de la ligne (INSERT si pas encore créée)
      // L'erreur 23505 (duplicate key) est normale et ignorée — ça veut juste dire que la ligne existe déjà
      const { error: ensureError } = await supabase
        .from('dossier_details_prestation')
        .insert({ dossier_id: editingDossier.id, montant: null, document_complet: false, quittance_signee: false })
      if (ensureError && ensureError.code !== '23505') {
        console.warn(' [PrestationDashboard] INSERT ensure:', ensureError.message)
      }

      // UPDATE systématique — la ligne existe forcément maintenant
      const { error: updateError } = await supabase
        .from('dossier_details_prestation')
        .update(prestationPayload)
        .eq('dossier_id', editingDossier.id)

      if (updateError) {
        console.error(' [PrestationDashboard] Erreur UPDATE prestation:', updateError)
        throw new Error(`Erreur mise à jour détails prestation: ${updateError.message}`)
      }

      console.log(' [PrestationDashboard] Détails prestation mis à jour')

      // ─────────────────────────────────────────────────────────────
      // ÉTAPE 1b : Mise à jour de motif_instance dans dossier_details_rc
      // ─────────────────────────────────────────────────────────────
      console.log(' [PrestationDashboard] Étape 1b : Mise à jour motif_instance dans dossier_details_rc')
      
      const { error: rcError } = await supabase
        .from('dossier_details_rc')
        .update({
          motif_instance: formData.motif_instance
        })
        .eq('dossier_id', editingDossier.id)

      if (rcError) {
        console.error(' [PrestationDashboard] Erreur mise à jour RC:', rcError)
        throw new Error(`Erreur lors de la mise à jour du motif d'instance: ${rcError.message}`)
      }

      console.log(' [PrestationDashboard] Motif d\'instance mis à jour')

      // ─────────────────────────────────────────────────────────────
      // ÉTAPE 2 : Mise à jour de l'état du dossier
      // L'état reste EN_COURS - Les boutons s'activent en fonction de document_complet
      // ─────────────────────────────────────────────────────────────
      console.log(' [PrestationDashboard] Étape 2 : Mise à jour de updated_at')
      
      const { error: dossierError } = await supabase
        .from('dossiers')
        .update({
          updated_at: new Date().toISOString()
        })
        .eq('id', editingDossier.id)
        .eq('niveau', 'PRESTATION') // Double vérification de sécurité

      if (dossierError) {
        console.error(' [PrestationDashboard] Erreur mise à jour dossier:', dossierError)
        throw new Error(`Erreur lors de la mise à jour du dossier: ${dossierError.message}`)
      }

      console.log(' [PrestationDashboard] Dossier mis à jour')

      // ─────────────────────────────────────────────────────────────
      // ÉTAPE 3 : Ajout dans l'historique des actions
      // ─────────────────────────────────────────────────────────────
      await logAction(
        editingDossier.id,
        'MODIFICATION_PRESTATION',
        oldEtat,
        oldEtat,
        `Modification prestation - Document complet: ${formData.document_complet ? 'Oui' : 'Non'}`
      )

      // ─────────────────────────────────────────────────────────────
      // SUCCÈS : Fermeture modal + mise à jour immédiate de l'état local
      // ─────────────────────────────────────────────────────────────
      closeEditModal()

      // Mise à jour directe du dossier dans la liste (pas de spinner)
      setDossiers(prev => prev.map(d => {
        if (d.id !== editingDossier.id) return d
        return {
          ...d,
          dossier_details_prestation: [{
            montant: parseFloat(formData.montant) || null,
            document_complet: formData.document_complet,
            quittance_signee: formData.quittance_signee
          }],
          dossier_details_rc: [{
            ...(d.dossier_details_rc?.[0] || {}),
            motif_instance: formData.motif_instance
          }]
        }
      }))

      alert(' Dossier modifié avec succès !')

    } catch (err) {
      console.error(' [PrestationDashboard] Erreur lors de la modification:', err)
      alert(` Erreur: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Traite les pièces d'un dossier
   * Processus en 3 étapes :
   * 1. Met à jour dossiers.etat à 'EN_INSTANCE'
   * 2. Crée des notifications pour les utilisateurs PRESTATION et FINANCE
   * 3. Insère dans historique_actions
   * 
   * @param {Object} dossier - Dossier à traiter
   */
  const handlePiecesATraiter = async (dossier) => {
    // Vérification d'authentification
    if (!user || !user.id) {
      alert(' Votre session a expiré. Veuillez vous reconnecter.')
      navigate('/login')
      return
    }

    // Vérification que le document est complet
    const detailsPrestation = dossier.dossier_details_prestation?.[0] || {}
    if (!detailsPrestation.document_complet) {
      alert(' Le document doit être marqué comme complet pour traiter les pièces.')
      return
    }

    // Confirmation
    const confirmAction = window.confirm(
      `Voulez-vous marquer les pièces du dossier "${dossier.souscripteur}" comme "à traiter" ?\n\nCela créera des notifications pour les équipes Prestation et Finance.`
    )

    if (!confirmAction) return

    setIsSaving(true)

    try {
      console.log(' [PrestationDashboard] Début du traitement des pièces pour dossier #', dossier.id)
      
      const oldEtat = dossier.etat

      // ─────────────────────────────────────────────────────────────
      // ÉTAPE 1 : Mise à jour de l'état du dossier à EN_INSTANCE
      // ─────────────────────────────────────────────────────────────
      console.log(' [PrestationDashboard] Étape 1 : Mise à jour de l\'état à EN_INSTANCE')
      
      const { error: dossierError } = await supabase
        .from('dossiers')
        .update({
          etat: 'EN_INSTANCE',
          updated_at: new Date().toISOString()
        })
        .eq('id', dossier.id)

      if (dossierError) {
        console.error(' [PrestationDashboard] Erreur mise à jour état:', dossierError)
        throw new Error(`Erreur lors de la mise à jour de l'état: ${dossierError.message}`)
      }

      console.log(' [PrestationDashboard] État mis à jour à EN_INSTANCE')

      // ─────────────────────────────────────────────────────────────
      // ÉTAPE 2 : Récupération des utilisateurs PRESTATION et FINANCE
      // ─────────────────────────────────────────────────────────────
      console.log(' [PrestationDashboard] Étape 2 : Récupération des utilisateurs à notifier')
      
      const { data: usersToNotify, error: usersError } = await supabase
        .from('users')
        .select(`
          id,
          email,
          full_name,
          roles!inner (
            name
          )
        `)
        .in('roles.name', ['PRESTATION', 'FINANCE'])

      if (usersError) {
        console.error(' [PrestationDashboard] Erreur récupération utilisateurs:', usersError)
        // On continue même si ça échoue
      } else {
        console.log(' [PrestationDashboard] Utilisateurs à notifier:', usersToNotify?.length || 0)
        
        // Création des notifications pour chaque utilisateur
        if (usersToNotify && usersToNotify.length > 0) {
          const notifications = usersToNotify.map(userToNotify => ({
            user_id: userToNotify.id,
            dossier_id: dossier.id,
            type: 'PIECE_A_TRAITER',
            message: `Pièces à traiter pour le dossier de ${dossier.souscripteur}`,
            is_read: false,
            created_at: new Date().toISOString()
          }))

          const { error: notifError } = await supabase
            .from('notifications')
            .insert(notifications)

          if (notifError) {
            console.error(' [PrestationDashboard] Erreur insertion notifications:', notifError)
            // On continue même si ça échoue
          } else {
            console.log(' [PrestationDashboard] Notifications créées')
          }
        }
      }

      // ─────────────────────────────────────────────────────────────
      // ÉTAPE 3 : Ajout dans l'historique des actions
      // ─────────────────────────────────────────────────────────────
      await logAction(
        dossier.id,
        'PIECE_TRANSFEREE',
        oldEtat,
        'EN_INSTANCE',
        `Pièces transférées pour traitement - État: ${oldEtat} → EN_INSTANCE`
      )

      // ─────────────────────────────────────────────────────────────
      // SUCCÈS : Rechargement des données
      // ─────────────────────────────────────────────────────────────
      // Mise à jour locale immédiate de l'état
      setDossiers(prev => prev.map(d =>
        d.id === dossier.id ? { ...d, etat: 'EN_INSTANCE' } : d
      ))

      alert(' Pièces marquées pour traitement ! Les équipes ont été notifiées.')

    } catch (err) {
      console.error(' [PrestationDashboard] Erreur lors du traitement des pièces:', err)
      alert(` Erreur: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Transfère la quittance au service Finance
   * Processus en 3 étapes :
   * 1. Met à jour dossiers.niveau à 'FINANCE'
   * 2. Crée des notifications pour les utilisateurs FINANCE
   * 3. Insère dans historique_actions
   * 
   * @param {Object} dossier - Dossier à transférer
   */
  const handleTransfertQuittance = async (dossier) => {
    // Vérification d'authentification
    if (!user || !user.id) {
      alert(' Votre session a expiré. Veuillez vous reconnecter.')
      navigate('/login')
      return
    }

    // Vérification que le document est complet ET quittance_signee est true
    const detailsPrestation = dossier.dossier_details_prestation?.[0] || {}
    if (!detailsPrestation.document_complet || !detailsPrestation.quittance_signee) {
      alert(' Le document doit être complet et la quittance signée pour transférer au service Finance.')
      return
    }

    // Confirmation
    const confirmAction = window.confirm(
      `Voulez-vous notifier le service Finance du transfert de la quittance signée du dossier "${dossier.souscripteur}" ?\n\nLe dossier restera en instance chez Prestation jusqu'à validation par Finance.`
    )

    if (!confirmAction) return

    setIsSaving(true)

    try {
      console.log(' [PrestationDashboard] Début du transfert de quittance pour dossier #', dossier.id)
      
      const currentEtat = dossier.etat

      // ─────────────────────────────────────────────────────────────
      // NOTE : Le niveau reste PRESTATION — la validation Finance
      // (depuis l'interface Finance) est ce qui fera passer le
      // dossier au niveau FINANCE (étapes 8-9 du workflow)
      // ─────────────────────────────────────────────────────────────

      // ─────────────────────────────────────────────────────────────
      // ÉTAPE 1 : Récupération des utilisateurs FINANCE
      // ─────────────────────────────────────────────────────────────
      console.log(' [PrestationDashboard] Étape 1 : Récupération des utilisateurs FINANCE à notifier')
      
      const { data: usersToNotify, error: usersError } = await supabase
        .from('users')
        .select(`
          id,
          email,
          full_name,
          roles!inner (
            name
          )
        `)
        .eq('roles.name', 'FINANCE')

      if (usersError) {
        console.error(' [PrestationDashboard] Erreur récupération utilisateurs:', usersError)
        // On continue même si ça échoue
      } else {
        console.log(' [PrestationDashboard] Utilisateurs FINANCE à notifier:', usersToNotify?.length || 0)
        
        // Création des notifications pour chaque utilisateur FINANCE
        if (usersToNotify && usersToNotify.length > 0) {
          const notifications = usersToNotify.map(userToNotify => ({
            user_id: userToNotify.id,
            dossier_id: dossier.id,
            type: 'QUITTANCE_TRANSFEREE',
            message: `Quittance transférée pour le dossier de ${dossier.souscripteur}`,
            is_read: false,
            created_at: new Date().toISOString()
          }))

          const { error: notifError } = await supabase
            .from('notifications')
            .insert(notifications)

          if (notifError) {
            console.error(' [PrestationDashboard] Erreur insertion notifications:', notifError)
            // On continue même si ça échoue
          } else {
            console.log(' [PrestationDashboard] Notifications créées pour Finance')
          }
        }
      }

      // ─────────────────────────────────────────────────────────────
      // ÉTAPE 2 : Ajout dans l'historique des actions
      // ─────────────────────────────────────────────────────────────
      await logAction(
        dossier.id,
        'QUITTANCE_TRANSFEREE',
        currentEtat,
        currentEtat,
        `Quittance signée transférée physiquement au service Finance - en attente de validation`
      )

      alert(' Quittance transférée au service Finance ! L\'équipe a été notifiée. Le dossier reste en instance jusqu\'à validation par Finance.')

    } catch (err) {
      console.error(' [PrestationDashboard] Erreur lors du transfert de quittance:', err)
      alert(` Erreur: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Formate une date pour l'affichage
   * Utilise date_reception si disponible, sinon created_at comme fallback
   * @param {string} dateString - Date au format ISO
   * @param {string} fallbackDate - Date de fallback si dateString est null
   * @returns {string} Date formatée ou 'N/A'
   */
  const formatDate = (dateString, fallbackDate = null) => {
    const dateToFormat = dateString || fallbackDate
    if (!dateToFormat) return 'N/A'
    try {
      return new Date(dateToFormat).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
    } catch {
      return 'N/A'
    }
  }

  /**
   * Formate un montant pour l'affichage
   * @param {number} montant - Montant numérique
   * @returns {string} Montant formaté avec devise
   */
  const formatMontant = (montant) => {
    if (!montant && montant !== 0) return 'N/A'
    try {
      return new Intl.NumberFormat('fr-TN', {
        style: 'currency',
        currency: 'TND'
      }).format(montant)
    } catch {
      return `${montant} TND`
    }
  }

  /**
   * Affiche un badge Oui/Non stylisé
   * @param {boolean} value - Valeur booléenne
   * @returns {React.ReactNode} Badge stylisé
   */
  const renderBooleanBadge = (value) => {
    if (value === null || value === undefined) {
      return <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-comar-neutral-bg text-gray-600">N/A</span>
    }
    
    return value ? (
      <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-emerald-50 text-emerald-700">
        ✓ Oui
      </span>
    ) : (
      <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
        ✗ Non
      </span>
    )
  }

  /**
   * Affiche un badge d'état stylisé
   * @param {string} etat - État du dossier
   * @returns {React.ReactNode} Badge stylisé
   */
  const renderEtatBadge = (etat) => {
    const etatConfig = {
      'EN_COURS': { bg: 'bg-comar-navy-50', text: 'text-comar-navy', label: 'En cours' },
      'EN_INSTANCE': { bg: 'bg-amber-50', text: 'text-amber-700', label: 'En instance' },
      'CLOTURE': { bg: 'bg-comar-neutral-bg', text: 'text-gray-800', label: 'Clôturé' },
      'ANNULE': { bg: 'bg-red-100', text: 'text-red-800', label: 'Annulé' }
    }

    const config = etatConfig[etat] || { bg: 'bg-comar-neutral-bg', text: 'text-gray-800', label: etat || 'N/A' }

    return (
      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    )
  }

  // Affichage du loader pendant le chargement
  if (loading) {
    return (
      <PrestationLayout>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-comar-navy mb-4"></div>
              <p className="text-gray-600">Chargement des dossiers prestations...</p>
            </div>
          </div>
        </div>
      </PrestationLayout>
    )
  }

  // Affichage de l'erreur si elle existe
  if (error) {
    return (
      <PrestationLayout>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-red-600 text-6xl mb-4"></div>
              <h2 className="text-2xl font-bold text-comar-navy mb-2">Erreur de chargement</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={fetchPrestationDossiers}
                className="bg-comar-navy text-white px-6 py-2 rounded-xl hover:bg-comar-navy-light transition"
              >
                Réessayer
              </button>
            </div>
          </div>
        </div>
      </PrestationLayout>
    )
  }

  return (
    <PrestationLayout>
      <div className="p-6">
        {/* En-tête */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-comar-navy">Dashboard Prestations</h1>
            <p className="text-gray-600 mt-1">
              Liste de tous les dossiers au niveau Prestation ({dossiers.length} au total)
            </p>
          </div>
          <button
            onClick={fetchPrestationDossiers}
            className="bg-comar-navy text-white px-6 py-3 rounded-xl hover:bg-comar-navy-light transition flex items-center gap-2 font-semibold"
          >
            <span className="text-xl"></span>
            Actualiser
          </button>
        </div>

        {/* Statistiques rapides */}
        {dossiers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
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

              {/* En cours */}
              <div className="bg-white rounded-xl border border-comar-neutral-border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">En cours</p>
                    <p className="text-2xl font-bold text-sky-600 mt-1">
                      {dossiers.filter(d => d.etat === 'EN_COURS').length}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center"><svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg></div>
                </div>
              </div>

              {/* Documents complets */}
              <div className="bg-white rounded-xl border border-comar-neutral-border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Docs complets</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">
                      {dossiers.filter(d => d.dossier_details_prestation?.[0]?.document_complet === true).length}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 019 9v.375M10.125 2.25A3.375 3.375 0 0113.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 013.375 3.375M9 15l2.25 2.25L15 12" /></svg></div>
                </div>
              </div>

              {/* En instance */}
              <div className="bg-white rounded-xl border border-comar-neutral-border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">En instance</p>
                    <p className="text-2xl font-bold text-amber-600 mt-1">
                      {dossiers.filter(d => d.etat === 'EN_INSTANCE').length}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center"><svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                </div>
              </div>

              {/* Quittances signées */}
              <div className="bg-white rounded-xl border border-comar-neutral-border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Quittances</p>
                    <p className="text-2xl font-bold text-violet-600 mt-1">
                      {dossiers.filter(d => d.dossier_details_prestation?.[0]?.quittance_signee === true).length}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center"><svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75" /></svg></div>
                </div>
              </div>
            </div>

        )}

        {/* Message si aucun dossier */}
        {dossiers.length === 0 ? (
          <div className="bg-white rounded-xl border border-comar-neutral-border p-12 text-center">
            <div className="text-6xl mb-4"></div>
            <h3 className="text-xl font-semibold text-comar-navy mb-2">Aucun dossier prestation</h3>
            <p className="text-gray-600">Aucun dossier n'est actuellement au niveau PRESTATION.</p>
          </div>
        ) : (
          /* Tableau des dossiers */
          <div className="bg-white rounded-xl border border-comar-neutral-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-comar-neutral-border">
                <thead className="bg-comar-navy">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white/80 uppercase tracking-wider">
                      Souscripteur
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white/80 uppercase tracking-wider">
                      N° Police
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white/80 uppercase tracking-wider">
                      Agence
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white/80 uppercase tracking-wider">
                      Date Réception
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white/80 uppercase tracking-wider">
                      Montant
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white/80 uppercase tracking-wider">
                      Doc. Complet
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white/80 uppercase tracking-wider">
                      Quittance Signée
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white/80 uppercase tracking-wider">
                      État
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white/80 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-comar-neutral-border">
                  {dossiers.map((dossier) => {
                    // Extraction des données jointes (peut être null/undefined)
                    const detailsRC = dossier.dossier_details_rc?.[0] || {}
                    const detailsPrestation = dossier.dossier_details_prestation?.[0] || {}
                    const agence = dossier.agences || {}

                    // Logique de désactivation des boutons
                    const isNiveauPrestation = dossier.niveau === 'PRESTATION'
                    const isDocumentComplet = detailsPrestation.document_complet === true
                    const isQuittanceSignee = detailsPrestation.quittance_signee === true

                    // Désactiver tous les boutons si niveau != PRESTATION
                    const canEdit = isNiveauPrestation && !isSaving
                    // "Pièces à traiter" actif uniquement si doc complet et niveau PRESTATION
                    const canMarkPieces = isNiveauPrestation && isDocumentComplet && !isSaving
                    // Désactiver "Transfert quittance" si le document n'est pas complet OU quittance_signee = false OU niveau != PRESTATION
                    const canTransferQuittance = isNiveauPrestation && isDocumentComplet && isQuittanceSignee && !isSaving

                    return (
                      <tr key={dossier.id} className="hover:bg-comar-navy-50/30 transition-colors duration-150">
                        {/* Souscripteur */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">
                            {dossier.souscripteur || 'N/A'}
                          </div>
                        </td>
                        
                        {/* Numéro de police */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
                          {dossier.police_number || '-'}
                        </td>
                        
                        {/* Agence */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {agence.nom || '-'}
                        </td>
                        
                        {/* Date de réception */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatDate(detailsRC.date_reception, dossier.created_at)}
                        </td>
                        
                        {/* Montant */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">
                            {formatMontant(detailsPrestation.montant)}
                          </div>
                        </td>
                        
                        {/* Document complet */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {renderBooleanBadge(detailsPrestation.document_complet)}
                        </td>
                        
                        {/* Quittance signée */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {renderBooleanBadge(detailsPrestation.quittance_signee)}
                        </td>
                        
                        {/* État */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {renderEtatBadge(dossier.etat)}
                        </td>
                        
                        {/* Actions */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex gap-2">
                            <button
                              onClick={() => openEditModal(dossier)}
                              disabled={!canEdit}
                              className={`px-3 py-1 rounded transition text-xs font-semibold ${
                                canEdit
                                  ? 'bg-comar-navy text-white hover:bg-comar-navy-light'
                                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              }`}
                              title={!isNiveauPrestation ? 'Le dossier n\'est plus au niveau PRESTATION' : 'Modifier le dossier'}
                            >
                               Modifier
                            </button>
                            <button
                              onClick={() => handlePiecesATraiter(dossier)}
                              disabled={!canMarkPieces}
                              className={`px-3 py-1 rounded transition text-xs font-semibold ${
                                canMarkPieces
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              }`}
                              title={
                                !isNiveauPrestation
                                  ? 'Le dossier n\'est plus au niveau PRESTATION'
                                  : !isDocumentComplet
                                  ? 'Le document doit être marqué comme complet'
                                  : 'Marquer les pièces comme à traiter'
                              }
                            >
                               Pièces à traiter
                            </button>
                            <button
                              onClick={() => handleTransfertQuittance(dossier)}
                              disabled={!canTransferQuittance}
                              className={`px-3 py-1 rounded transition text-xs font-semibold ${
                                canTransferQuittance
                                  ? 'bg-violet-600 text-white hover:bg-violet-700'
                                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              }`}
                              title={
                                !isNiveauPrestation
                                  ? 'Le dossier n\'est plus au niveau PRESTATION'
                                  : !isDocumentComplet
                                  ? 'Le document doit être marqué comme complet'
                                  : !isQuittanceSignee
                                  ? 'La quittance doit être signée'
                                  : 'Transférer la quittance au service Finance'
                              }
                            >
                               Transfert quittance
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer avec statistiques */}
            <div className="bg-comar-neutral-bg px-6 py-4 border-t border-comar-neutral-border">
              <div className="flex justify-between items-center text-sm text-gray-600">
                <span>
                  Total : <span className="font-semibold text-gray-900">{dossiers.length}</span> dossier{dossiers.length > 1 ? 's' : ''}
                </span>
                <span className="text-xs text-gray-500">
                  Dernière mise à jour : {new Date().toLocaleTimeString('fr-FR')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* Modal d'édition                                                 */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {isEditModalOpen && editingDossier && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Overlay */}
            <div 
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={closeEditModal}
            ></div>

            {/* Modal */}
            <div className="flex items-center justify-center min-h-screen p-4">
              <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
                {/* En-tête */}
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-comar-navy">
                    Modifier le dossier
                  </h2>
                  <button
                    onClick={closeEditModal}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ✕
                  </button>
                </div>

                {/* Informations du dossier */}
                <div className="bg-comar-neutral-bg rounded-xl p-4 mb-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-semibold text-gray-700">Souscripteur : </span>
                      <span className="text-gray-900">{editingDossier.souscripteur}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">Police : </span>
                      <span className="text-gray-900 font-mono">{editingDossier.police_number}</span>
                    </div>
                  </div>
                </div>

                {/* Formulaire */}
                <form onSubmit={handleSubmitEdit}>
                  <div className="space-y-4">
                    {/* Montant */}
                    <div>
                      <label htmlFor="montant" className="block text-sm font-medium text-gray-700 mb-2">
                        Montant (TND) *
                      </label>
                      <input
                        type="number"
                        id="montant"
                        name="montant"
                        value={formData.montant}
                        onChange={handleFormChange}
                        step="0.01"
                        min="0"
                        required
                        className="w-full px-4 py-2 border border-comar-neutral-border rounded-xl focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy"
                        placeholder="Ex: 1500.00"
                      />
                    </div>

                    {/* Motif d'instance */}
                    <div>
                      <label htmlFor="motif_instance" className="block text-sm font-medium text-gray-700 mb-2">
                        Motif d'instance *
                      </label>
                      <textarea
                        id="motif_instance"
                        name="motif_instance"
                        value={formData.motif_instance}
                        onChange={handleFormChange}
                        rows={4}
                        required
                        className="w-full px-4 py-2 border border-comar-neutral-border rounded-xl focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy"
                        placeholder="Décrivez le motif de l'instance..."
                      />
                    </div>

                    {/* Checkboxes */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Document complet */}
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="document_complet"
                          name="document_complet"
                          checked={formData.document_complet}
                          onChange={handleFormChange}
                          className="w-5 h-5 text-comar-navy border-comar-neutral-border rounded focus:ring-comar-navy/20"
                        />
                        <label htmlFor="document_complet" className="ml-3 text-sm font-medium text-gray-700">
                          Document complet
                        </label>
                      </div>

                      {/* Quittance signée */}
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="quittance_signee"
                          name="quittance_signee"
                          checked={formData.quittance_signee}
                          onChange={handleFormChange}
                          className="w-5 h-5 text-comar-navy border-comar-neutral-border rounded focus:ring-comar-navy/20"
                        />
                        <label htmlFor="quittance_signee" className="ml-3 text-sm font-medium text-gray-700">
                          Quittance signée
                        </label>
                      </div>
                    </div>

                    {/* Note d'information */}
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-yellow-700">
                            <strong>Note :</strong> Cochez "Document complet" pour activer les boutons <strong>Pièces à traiter</strong> et <strong>Transfert quittance</strong>.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Boutons d'action */}
                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={closeEditModal}
                      disabled={isSaving}
                      className="px-6 py-2 border border-comar-neutral-border text-gray-700 font-semibold rounded-xl hover:bg-comar-neutral-bg transition disabled:opacity-50"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-6 py-2 bg-comar-navy text-white font-semibold rounded-xl hover:bg-comar-navy-light transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Enregistrement...
                        </>
                      ) : (
                        <>
                           Enregistrer
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </PrestationLayout>
  )
}
