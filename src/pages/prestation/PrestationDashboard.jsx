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
      console.log(`📝 [PrestationDashboard] Enregistrement action: ${action} pour dossier #${dossierId}`)
      
      // Vérifier que l'utilisateur est authentifié
      if (!user || !user.id) {
        console.warn('⚠️ [PrestationDashboard] Utilisateur non authentifié - historique non enregistré')
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
        console.error('⚠️ [PrestationDashboard] Erreur insertion historique:', error)
        return false
      }

      console.log('✅ [PrestationDashboard] Action enregistrée dans l\'historique')
      return true
    } catch (err) {
      console.error('❌ [PrestationDashboard] Erreur lors de l\'enregistrement de l\'action:', err)
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
      
      console.log('🔍 [PrestationDashboard] Chargement des dossiers PRESTATION')
      
      // Requête SELECT avec JOINs multiples et filtre sur niveau
      const { data, error: fetchError } = await supabase
        .from('dossiers')
        .select(`
          id,
          souscripteur,
          police_number,
          niveau,
          etat,
          created_at,
          agences (
            id,
            nom
          ),
          dossier_details_rc (
            date_reception,
            motif_instance
          ),
          dossier_details_prestation (
            montant,
            document_complet,
            quittance_signee
          )
        `)
        .eq('niveau', 'PRESTATION') // Filtre : uniquement les dossiers au niveau PRESTATION
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('❌ [PrestationDashboard] Erreur Supabase:', fetchError)
        throw fetchError
      }
      
      console.log('✅ [PrestationDashboard] Dossiers chargés:', data?.length || 0, 'résultat(s)')
      
      setDossiers(data || [])
    } catch (err) {
      console.error('❌ [PrestationDashboard] Erreur lors du chargement:', err)
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
      alert('⚠️ Impossible d\'éditer ce dossier : il n\'est plus au niveau PRESTATION.')
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
      alert('⚠️ Votre session a expiré. Veuillez vous reconnecter.')
      closeEditModal()
      navigate('/login')
      return
    }

    // Vérification de sécurité : niveau doit être PRESTATION
    if (editingDossier.niveau !== 'PRESTATION') {
      alert('⚠️ Impossible de modifier : le dossier n\'est plus au niveau PRESTATION.')
      closeEditModal()
      return
    }

    setIsSaving(true)

    try {
      console.log('🚀 [PrestationDashboard] Début de la modification du dossier #', editingDossier.id)
      
      const oldEtat = editingDossier.etat
      
      // ─────────────────────────────────────────────────────────────
      // ÉTAPE 1 : Mise à jour de dossier_details_prestation
      // Vérifier si la ligne existe, sinon la créer
      // ─────────────────────────────────────────────────────────────
      console.log('📝 [PrestationDashboard] Étape 1 : Sauvegarde dossier_details_prestation')

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
        console.warn('⚠️ [PrestationDashboard] INSERT ensure:', ensureError.message)
      }

      // UPDATE systématique — la ligne existe forcément maintenant
      const { error: updateError } = await supabase
        .from('dossier_details_prestation')
        .update(prestationPayload)
        .eq('dossier_id', editingDossier.id)

      if (updateError) {
        console.error('❌ [PrestationDashboard] Erreur UPDATE prestation:', updateError)
        throw new Error(`Erreur mise à jour détails prestation: ${updateError.message}`)
      }

      console.log('✅ [PrestationDashboard] Détails prestation mis à jour')

      // ─────────────────────────────────────────────────────────────
      // ÉTAPE 1b : Mise à jour de motif_instance dans dossier_details_rc
      // ─────────────────────────────────────────────────────────────
      console.log('📝 [PrestationDashboard] Étape 1b : Mise à jour motif_instance dans dossier_details_rc')
      
      const { error: rcError } = await supabase
        .from('dossier_details_rc')
        .update({
          motif_instance: formData.motif_instance
        })
        .eq('dossier_id', editingDossier.id)

      if (rcError) {
        console.error('❌ [PrestationDashboard] Erreur mise à jour RC:', rcError)
        throw new Error(`Erreur lors de la mise à jour du motif d'instance: ${rcError.message}`)
      }

      console.log('✅ [PrestationDashboard] Motif d\'instance mis à jour')

      // ─────────────────────────────────────────────────────────────
      // ÉTAPE 2 : Mise à jour de l'état du dossier
      // L'état reste EN_COURS - Les boutons s'activent en fonction de document_complet
      // ─────────────────────────────────────────────────────────────
      console.log('📝 [PrestationDashboard] Étape 2 : Mise à jour de updated_at')
      
      const { error: dossierError } = await supabase
        .from('dossiers')
        .update({
          updated_at: new Date().toISOString()
        })
        .eq('id', editingDossier.id)
        .eq('niveau', 'PRESTATION') // Double vérification de sécurité

      if (dossierError) {
        console.error('❌ [PrestationDashboard] Erreur mise à jour dossier:', dossierError)
        throw new Error(`Erreur lors de la mise à jour du dossier: ${dossierError.message}`)
      }

      console.log('✅ [PrestationDashboard] Dossier mis à jour')

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

      alert('✅ Dossier modifié avec succès !')

    } catch (err) {
      console.error('❌ [PrestationDashboard] Erreur lors de la modification:', err)
      alert(`❌ Erreur: ${err.message}`)
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
      alert('⚠️ Votre session a expiré. Veuillez vous reconnecter.')
      navigate('/login')
      return
    }

    // Vérification que le document est complet
    const detailsPrestation = dossier.dossier_details_prestation?.[0] || {}
    if (!detailsPrestation.document_complet) {
      alert('⚠️ Le document doit être marqué comme complet pour traiter les pièces.')
      return
    }

    // Confirmation
    const confirmAction = window.confirm(
      `Voulez-vous marquer les pièces du dossier "${dossier.souscripteur}" comme "à traiter" ?\n\nCela créera des notifications pour les équipes Prestation et Finance.`
    )

    if (!confirmAction) return

    setIsSaving(true)

    try {
      console.log('🚀 [PrestationDashboard] Début du traitement des pièces pour dossier #', dossier.id)
      
      const oldEtat = dossier.etat

      // ─────────────────────────────────────────────────────────────
      // ÉTAPE 1 : Mise à jour de l'état du dossier à EN_INSTANCE
      // ─────────────────────────────────────────────────────────────
      console.log('📝 [PrestationDashboard] Étape 1 : Mise à jour de l\'état à EN_INSTANCE')
      
      const { error: dossierError } = await supabase
        .from('dossiers')
        .update({
          etat: 'EN_INSTANCE',
          updated_at: new Date().toISOString()
        })
        .eq('id', dossier.id)

      if (dossierError) {
        console.error('❌ [PrestationDashboard] Erreur mise à jour état:', dossierError)
        throw new Error(`Erreur lors de la mise à jour de l'état: ${dossierError.message}`)
      }

      console.log('✅ [PrestationDashboard] État mis à jour à EN_INSTANCE')

      // ─────────────────────────────────────────────────────────────
      // ÉTAPE 2 : Récupération des utilisateurs PRESTATION et FINANCE
      // ─────────────────────────────────────────────────────────────
      console.log('📝 [PrestationDashboard] Étape 2 : Récupération des utilisateurs à notifier')
      
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
        console.error('❌ [PrestationDashboard] Erreur récupération utilisateurs:', usersError)
        // On continue même si ça échoue
      } else {
        console.log('✅ [PrestationDashboard] Utilisateurs à notifier:', usersToNotify?.length || 0)
        
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
            console.error('⚠️ [PrestationDashboard] Erreur insertion notifications:', notifError)
            // On continue même si ça échoue
          } else {
            console.log('✅ [PrestationDashboard] Notifications créées')
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

      alert('✅ Pièces marquées pour traitement ! Les équipes ont été notifiées.')

    } catch (err) {
      console.error('❌ [PrestationDashboard] Erreur lors du traitement des pièces:', err)
      alert(`❌ Erreur: ${err.message}`)
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
      alert('⚠️ Votre session a expiré. Veuillez vous reconnecter.')
      navigate('/login')
      return
    }

    // Vérification que le document est complet ET quittance_signee est true
    const detailsPrestation = dossier.dossier_details_prestation?.[0] || {}
    if (!detailsPrestation.document_complet || !detailsPrestation.quittance_signee) {
      alert('⚠️ Le document doit être complet et la quittance signée pour transférer au service Finance.')
      return
    }

    // Confirmation
    const confirmAction = window.confirm(
      `Voulez-vous notifier le service Finance du transfert de la quittance signée du dossier "${dossier.souscripteur}" ?\n\nLe dossier restera en instance chez Prestation jusqu'à validation par Finance.`
    )

    if (!confirmAction) return

    setIsSaving(true)

    try {
      console.log('🚀 [PrestationDashboard] Début du transfert de quittance pour dossier #', dossier.id)
      
      const currentEtat = dossier.etat

      // ─────────────────────────────────────────────────────────────
      // NOTE : Le niveau reste PRESTATION — la validation Finance
      // (depuis l'interface Finance) est ce qui fera passer le
      // dossier au niveau FINANCE (étapes 8-9 du workflow)
      // ─────────────────────────────────────────────────────────────

      // ─────────────────────────────────────────────────────────────
      // ÉTAPE 1 : Récupération des utilisateurs FINANCE
      // ─────────────────────────────────────────────────────────────
      console.log('📝 [PrestationDashboard] Étape 1 : Récupération des utilisateurs FINANCE à notifier')
      
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
        console.error('❌ [PrestationDashboard] Erreur récupération utilisateurs:', usersError)
        // On continue même si ça échoue
      } else {
        console.log('✅ [PrestationDashboard] Utilisateurs FINANCE à notifier:', usersToNotify?.length || 0)
        
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
            console.error('⚠️ [PrestationDashboard] Erreur insertion notifications:', notifError)
            // On continue même si ça échoue
          } else {
            console.log('✅ [PrestationDashboard] Notifications créées pour Finance')
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

      alert('✅ Quittance transférée au service Finance ! L\'équipe a été notifiée. Le dossier reste en instance jusqu\'à validation par Finance.')

    } catch (err) {
      console.error('❌ [PrestationDashboard] Erreur lors du transfert de quittance:', err)
      alert(`❌ Erreur: ${err.message}`)
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
      return <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-600">N/A</span>
    }
    
    return value ? (
      <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
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
      'EN_COURS': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'En cours' },
      'EN_INSTANCE': { bg: 'bg-orange-100', text: 'text-orange-800', label: 'En instance' },
      'CLOTURE': { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Clôturé' },
      'ANNULE': { bg: 'bg-red-100', text: 'text-red-800', label: 'Annulé' }
    }

    const config = etatConfig[etat] || { bg: 'bg-gray-100', text: 'text-gray-800', label: etat || 'N/A' }

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
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
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
              <div className="text-red-600 text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Erreur de chargement</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={fetchPrestationDossiers}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
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
            <h1 className="text-3xl font-bold text-gray-800">📊 Dashboard Prestations</h1>
            <p className="text-gray-600 mt-1">
              Liste de tous les dossiers au niveau Prestation ({dossiers.length} au total)
            </p>
          </div>
          <button
            onClick={fetchPrestationDossiers}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 font-semibold"
          >
            <span className="text-xl">🔄</span>
            Actualiser
          </button>
        </div>

        {/* Statistiques rapides */}
        {dossiers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            {/* Total */}
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Total</p>
                  <p className="text-2xl font-bold text-gray-800">{dossiers.length}</p>
                </div>
                <div className="text-3xl">📋</div>
              </div>
            </div>

            {/* En cours */}
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">En cours</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {dossiers.filter(d => d.etat === 'EN_COURS').length}
                  </p>
                </div>
                <div className="text-3xl">🔄</div>
              </div>
            </div>

            {/* Documents complets */}
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Docs complets</p>
                  <p className="text-2xl font-bold text-green-600">
                    {dossiers.filter(d => d.dossier_details_prestation?.[0]?.document_complet === true).length}
                  </p>
                </div>
                <div className="text-3xl">✅</div>
              </div>
            </div>

            {/* En instance */}
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">En instance</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {dossiers.filter(d => d.etat === 'EN_INSTANCE').length}
                  </p>
                </div>
                <div className="text-3xl">⏳</div>
              </div>
            </div>

            {/* Quittances signées */}
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Quittances</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {dossiers.filter(d => d.dossier_details_prestation?.[0]?.quittance_signee === true).length}
                  </p>
                </div>
                <div className="text-3xl">📝</div>
              </div>
            </div>
          </div>
        )}

        {/* Message si aucun dossier */}
        {dossiers.length === 0 ? (
          <div className="bg-white shadow-lg rounded-lg p-12 text-center">
            <div className="text-6xl mb-4">📂</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Aucun dossier prestation</h3>
            <p className="text-gray-600">Aucun dossier n'est actuellement au niveau PRESTATION.</p>
          </div>
        ) : (
          /* Tableau des dossiers */
          <div className="bg-white shadow-lg rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Souscripteur
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      N° Police
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Agence
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Date Réception
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Montant
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Doc. Complet
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Quittance Signée
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      État
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
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
                    // Désactiver "Pièces à traiter" si le document n'est pas complet OU niveau != PRESTATION OU déjà traité (EN_INSTANCE)
                    const canMarkPieces = isNiveauPrestation && isDocumentComplet && dossier.etat !== 'EN_INSTANCE' && !isSaving
                    // Désactiver "Transfert quittance" si le document n'est pas complet OU quittance_signee = false OU niveau != PRESTATION
                    const canTransferQuittance = isNiveauPrestation && isDocumentComplet && isQuittanceSignee && !isSaving

                    return (
                      <tr key={dossier.id} className="hover:bg-gray-50 transition">
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
                                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              }`}
                              title={!isNiveauPrestation ? 'Le dossier n\'est plus au niveau PRESTATION' : 'Modifier le dossier'}
                            >
                              ✏️ Modifier
                            </button>
                            <button
                              onClick={() => handlePiecesATraiter(dossier)}
                              disabled={!canMarkPieces}
                              className={`px-3 py-1 rounded transition text-xs font-semibold ${
                                canMarkPieces
                                  ? 'bg-green-600 text-white hover:bg-green-700'
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
                              📋 Pièces à traiter
                            </button>
                            <button
                              onClick={() => handleTransfertQuittance(dossier)}
                              disabled={!canTransferQuittance}
                              className={`px-3 py-1 rounded transition text-xs font-semibold ${
                                canTransferQuittance
                                  ? 'bg-purple-600 text-white hover:bg-purple-700'
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
                              💼 Transfert quittance
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
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
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
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={closeEditModal}
            ></div>

            {/* Modal */}
            <div className="flex items-center justify-center min-h-screen p-4">
              <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
                {/* En-tête */}
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">
                    ✏️ Modifier le dossier
                  </h2>
                  <button
                    onClick={closeEditModal}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ✕
                  </button>
                </div>

                {/* Informations du dossier */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
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
                          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
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
                      className="px-6 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                          💾 Enregistrer
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
