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
 * Page de détail d'un dossier
 * Affiche toutes les informations d'un dossier spécifique en lecture seule
 * Permet de transmettre le dossier au service Prestation
 * 
 * @returns {React.ReactNode} La page de détail dans le RCLayout
 */
export default function DossierDetail() {
  const { id } = useParams() // Récupération de l'ID depuis l'URL
  const navigate = useNavigate()
  const { user } = useAuth() // Récupération de l'utilisateur connecté
  const [dossier, setDossier] = useState(null) // Données du dossier
  const [loading, setLoading] = useState(true) // Indicateur de chargement
  const [transmitting, setTransmitting] = useState(false) // Indicateur de transmission en cours

  // Chargement du dossier au montage et quand l'ID change
  useEffect(() => {
    fetchDossier()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]) // fetchDossier est stable, pas besoin de l'inclure

  /**
   * Récupère les détails d'un dossier spécifique
   * Avec JOIN sur agences et dossier_details_rc
   * Redirige vers la liste si le dossier n'existe pas
   */
  const fetchDossier = async () => {
    try {
      // Requête SELECT avec filtre sur l'ID et JOINs
      const { data, error } = await supabase
        .from('dossiers')
        .select(`
          *,
          agences (
            id,
            nom,
            adresse
          ),
          dossier_details_rc (
            telephone,
            demande_initiale,
            motif_instance
          )
        `)
        .eq('id', id)
        .single() // Attend un seul résultat

      if (error) {
        console.error('❌ [DossierDetail] Erreur Supabase:', error)
        console.error('❌ [DossierDetail] Code:', error.code)
        console.error('❌ [DossierDetail] Message:', error.message)
        console.error('❌ [DossierDetail] Details:', error.details)
        throw error
      }
      
      if (!data) {
        console.error('❌ [DossierDetail] Aucune donnée retournée')
        throw new Error('Le dossier n\'existe pas')
      }
      
      console.log('✅ [DossierDetail] Dossier chargé:', data)
      setDossier(data)
    } catch (error) {
      console.error('❌ [DossierDetail] Erreur lors du chargement du dossier:', error)
      alert(`Dossier introuvable: ${error.message || 'Erreur inconnue'}`)
      navigate('/rc/dossiers') // Redirection en cas d'erreur
    } finally {
      setLoading(false)
    }
  }

  /**
   * Transmet le dossier au service Prestation
   * Processus en 2 étapes :
   * 1. Met à jour le niveau du dossier à 'PRESTATION'
   * 2. Ajoute une entrée dans l'historique des actions
   */
  const handleTransmitToPrestation = async () => {
    // Confirmation avant transmission
    const confirmTransmit = window.confirm(
      `Êtes-vous sûr de vouloir transmettre le dossier #${id} au service Prestation ?\n\nCette action est irréversible.`
    )

    if (!confirmTransmit) return

    setTransmitting(true)

    try {
      console.log('🚀 [DossierDetail] Début de la transmission à Prestation')

      // ─────────────────────────────────────────────────────────────
      // ÉTAPE 1 : Mise à jour du niveau du dossier
      // ─────────────────────────────────────────────────────────────
      console.log('📝 [DossierDetail] Étape 1 : Mise à jour du niveau')
      const { error: updateError } = await supabase
        .from('dossiers')
        .update({
          niveau: 'PRESTATION',
          updated_at: new Date().toISOString() // Mise à jour explicite du timestamp
        })
        .eq('id', id)

      if (updateError) {
        console.error('❌ [DossierDetail] Erreur mise à jour niveau:', updateError)
        throw new Error(`Erreur lors de la mise à jour du dossier: ${updateError.message}`)
      }

      console.log('✅ [DossierDetail] Niveau mis à jour à PRESTATION')

      // ─────────────────────────────────────────────────────────────
      // ÉTAPE 2 : Ajout dans l'historique des actions
      // ─────────────────────────────────────────────────────────────
      console.log('📝 [DossierDetail] Étape 2 : Ajout à l\'historique')
      const { error: historiqueError } = await supabase
        .from('historique_actions')
        .insert([
          {
            dossier_id: parseInt(id),
            user_id: user.id,
            action: 'Transmission à Prestation',
            description: `Dossier transmis du service Relation Client vers le service Prestation par ${user.email}`
          }
        ])

      if (historiqueError) {
        console.error('⚠️ [DossierDetail] Erreur insertion historique:', historiqueError)
        // On ne bloque pas ici car le dossier est déjà mis à jour
        // On informe juste l'utilisateur
        alert('⚠️ Dossier transmis mais erreur lors de l\'enregistrement de l\'historique.')
      } else {
        console.log('✅ [DossierDetail] Historique ajouté')
      }

      // ─────────────────────────────────────────────────────────────
      // SUCCÈS : Affichage message et redirection
      // ─────────────────────────────────────────────────────────────
      console.log('🎉 [DossierDetail] Transmission réussie')
      alert('✅ Dossier transmis au service Prestation avec succès!')
      navigate('/rc/dossiers') // Redirection vers la liste

    } catch (error) {
      console.error('❌ [DossierDetail] Erreur globale:', error)
      alert(`❌ ${error.message || 'Erreur lors de la transmission du dossier'}`)
    } finally {
      setTransmitting(false)
    }
  }

  // Affichage du loader pendant le chargement
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

  // Extraction des détails RC (peut être null si pas encore créé)
  const detailsRC = dossier.dossier_details_rc?.[0] || null

  return (
    <RCLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* En-tête avec bouton retour et titre                             */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate('/rc/dossiers')}
              className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2"
            >
              ← Retour à la liste
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-800">Dossier #{dossier.id}</h1>
              {dossier.is_urgent && (
                <span className="px-3 py-1 bg-red-100 text-red-800 text-sm font-semibold rounded-full flex items-center gap-1">
                  🚨 URGENT
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Badge Niveau */}
            <span className="inline-block px-4 py-2 text-sm font-semibold rounded-lg bg-blue-100 text-blue-800">
              {dossier.niveau || 'RELATION_CLIENT'}
            </span>
            {/* Badge État */}
            <span className={`inline-block px-4 py-2 text-sm font-semibold rounded-lg ${
              dossier.etat === 'EN_COURS' ? 'bg-blue-100 text-blue-800' :
              dossier.etat === 'EN_ATTENTE' ? 'bg-yellow-100 text-yellow-800' :
              dossier.etat === 'CLOTURE' ? 'bg-gray-100 text-gray-800' :
              dossier.etat === 'ANNULE' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {dossier.etat?.replace('_', ' ') || 'EN COURS'}
            </span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* Section : Informations du Souscripteur                          */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
            👤 Informations du Souscripteur
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                Souscripteur
              </h3>
              <p className="text-lg font-semibold text-gray-900">{dossier.souscripteur || 'N/A'}</p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                Numéro de Police
              </h3>
              <p className="text-lg font-semibold text-gray-900">{dossier.police_number || 'N/A'}</p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                Téléphone
              </h3>
              <p className="text-lg font-semibold text-gray-900">
                <a href={`tel:${detailsRC?.telephone}`} className="text-blue-600 hover:underline">
                  {detailsRC?.telephone || 'N/A'}
                </a>
              </p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                Agence
              </h3>
              <p className="text-lg font-semibold text-gray-900">
                {dossier.agences?.nom || 'Non assignée'}
              </p>
              {dossier.agences?.adresse && (
                <p className="text-sm text-gray-600 mt-1">{dossier.agences.adresse}</p>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* Section : Détails de la Demande (RC)                            */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {detailsRC && (
          <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
              📄 Détails de la Demande
            </h2>

            <div className="space-y-4">
              {detailsRC.demande_initiale && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Demande Initiale
                  </h3>
                  <p className="text-gray-900 leading-relaxed bg-gray-50 p-4 rounded-lg">
                    {detailsRC.demande_initiale}
                  </p>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Motif d'Instance
                </h3>
                <p className="text-gray-900 leading-relaxed bg-gray-50 p-4 rounded-lg">
                  {detailsRC.motif_instance || 'Non renseigné'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* Section : Informations Système                                  */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
            ℹ️ Informations Système
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                Date de création
              </h3>
              <p className="text-gray-900">
                {new Date(dossier.created_at).toLocaleString('fr-FR', {
                  dateStyle: 'long',
                  timeStyle: 'short'
                })}
              </p>
            </div>

            {dossier.updated_at && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Dernière modification
                </h3>
                <p className="text-gray-900">
                  {new Date(dossier.updated_at).toLocaleString('fr-FR', {
                    dateStyle: 'long',
                    timeStyle: 'short'
                  })}
                </p>
              </div>
            )}

            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                ID du dossier
              </h3>
              <p className="text-gray-900 font-mono">#{dossier.id}</p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                Niveau actuel
              </h3>
              <span className={`inline-block px-4 py-2 text-sm font-semibold rounded-lg ${
                dossier.niveau === 'RELATION_CLIENT' 
                  ? 'bg-blue-100 text-blue-800' 
                  : dossier.niveau === 'PRESTATION'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {dossier.niveau || 'RELATION_CLIENT'}
              </span>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex gap-4">
              {/* Bouton Modifier - Toujours visible */}
              <button
                onClick={() => navigate(`/rc/dossiers/${id}/edit`)}
                className="bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition flex items-center gap-2"
              >
                ✏️ Modifier le dossier
              </button>

              {/* Bouton Transmettre - Visible uniquement si niveau = RELATION_CLIENT */}
              {dossier.niveau === 'RELATION_CLIENT' && (
                <button
                  onClick={handleTransmitToPrestation}
                  disabled={transmitting}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                >
                  {transmitting ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Transmission en cours...
                    </>
                  ) : (
                    <>
                      ✅ Transmettre à Prestation
                    </>
                  )}
                </button>
              )}

              {/* Message si déjà transmis */}
              {dossier.niveau !== 'RELATION_CLIENT' && (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 px-6 py-3 rounded-lg border border-green-200">
                  <span className="text-xl">✅</span>
                  <span className="font-semibold">Dossier déjà transmis au service {dossier.niveau}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </RCLayout>
  )
}
