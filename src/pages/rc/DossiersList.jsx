// React hooks pour la gestion d'état et effets
import { useState, useEffect } from 'react'
// Navigation entre les pages
import { Link } from 'react-router-dom'
// Client Supabase pour les requêtes DB
import { supabase } from '../../lib/supabaseClient'
// Hook pour accéder au contexte d'authentification
import { useAuth } from '../../contexts/AuthContext'
// Layout spécifique aux pages Relation Client
import RCLayout from '../../components/RCLayout'

/**
 * Page de liste des dossiers
 * Affiche tous les dossiers créés par l'utilisateur connecté
 * Avec badges d'état et d'urgence
 * 
 * @returns {React.ReactNode} La page avec la liste des dossiers dans le RCLayout
 */
export default function DossiersList() {
  const { user } = useAuth() // Récupération de l'utilisateur connecté pour filtrer les dossiers
  const [dossiers, setDossiers] = useState([]) // Liste des dossiers chargés depuis la DB
  const [loading, setLoading] = useState(true) // Indicateur de chargement

  // Chargement des dossiers au montage du composant et quand l'ID utilisateur change
  // ⚠️ Important : On utilise user?.id au lieu de user pour éviter les re-renders infinis
  // car l'objet user peut changer de référence même si les données restent identiques
  useEffect(() => {
    if (user) {
      fetchDossiers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]) // fetchDossiers est stable, pas besoin de l'inclure

  /**
   * Récupère tous les dossiers depuis Supabase
   * Filtrés par utilisateur connecté (created_by)
   * Triés par date de création (plus récents en premier)
   */
  const fetchDossiers = async () => {
    try {
      console.log('🔍 [DossiersList] Chargement des dossiers pour user:', user.id)
      
      // Requête SELECT avec tri par date, JOIN avec agences
      // Filtre par l'utilisateur connecté
      const { data, error } = await supabase
        .from('dossiers')
        .select(`
          *,
          agences (
            id,
            nom
          )
        `)
        .eq('created_by', user.id) // Filtre : uniquement les dossiers de l'utilisateur connecté
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ [DossiersList] Erreur Supabase:', error)
        throw error
      }
      
      console.log('✅ [DossiersList] Dossiers chargés:', data?.length || 0, 'résultat(s)')
      console.log('📦 [DossiersList] Données:', data)
      setDossiers(data || [])
    } catch (error) {
      console.error('❌ [DossiersList] Erreur lors du chargement des dossiers:', error)
    } finally {
      setLoading(false)
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
        {/* En-tête avec titre et bouton d'ajout */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">📁 Mes Dossiers</h1>
            <p className="text-gray-600 mt-1">
              Liste de vos dossiers créés ({dossiers.length} au total)
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

            {/* En cours (état) */}
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

            {/* Niveau RC */}
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Relation Client</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {dossiers.filter(d => d.niveau === 'RELATION_CLIENT').length}
                  </p>
                </div>
                <div className="text-3xl">👥</div>
              </div>
            </div>

            {/* Urgents */}
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Urgents</p>
                  <p className="text-2xl font-bold text-red-600">
                    {dossiers.filter(d => d.is_urgent).length}
                  </p>
                </div>
                <div className="text-3xl">🚨</div>
              </div>
            </div>

            {/* Transmis */}
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Transmis</p>
                  <p className="text-2xl font-bold text-green-600">
                    {dossiers.filter(d => d.niveau === 'PRESTATION').length}
                  </p>
                </div>
                <div className="text-3xl">✅</div>
              </div>
            </div>
          </div>
        )}

        {/* Message si aucun dossier */}
        {dossiers.length === 0 ? (
          <div className="bg-white shadow-lg rounded-lg p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Aucun dossier</h3>
            <p className="text-gray-600 mb-6">Vous n'avez pas encore créé de dossier.</p>
            <Link
              to="/rc/dossiers/nouveau"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              <span className="text-xl">➕</span>
              Créer votre premier dossier
            </Link>
          </div>
        ) : (
          /* Tableau des dossiers */
          <div className="bg-white shadow-lg rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Souscripteur
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Police
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Agence
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Niveau
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    État
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Urgence
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {/* Boucle sur chaque dossier */}
                {dossiers.map((dossier) => {
                  // Extraction de is_urgent depuis le dossier
                  const isUrgent = dossier.is_urgent || false
                  
                  // Détermination de la couleur du badge de niveau
                  const getNiveauBadge = (niveau) => {
                    switch (niveau) {
                      case 'RELATION_CLIENT':
                        return 'bg-blue-100 text-blue-800'
                      case 'PRESTATION':
                        return 'bg-green-100 text-green-800'
                      case 'FINANCE':
                        return 'bg-purple-100 text-purple-800'
                      case 'JURIDIQUE':
                        return 'bg-amber-100 text-amber-800'
                      default:
                        return 'bg-gray-100 text-gray-800'
                    }
                  }

                  // Détermination de la couleur du badge d'état
                  const getEtatBadge = (etat) => {
                    switch (etat) {
                      case 'EN_COURS':
                        return 'bg-blue-100 text-blue-800'
                      case 'EN_INSTANCE':
                        return 'bg-orange-100 text-orange-800'
                      case 'CLOTURE':
                        return 'bg-gray-100 text-gray-800'
                      case 'ANNULE':
                        return 'bg-red-100 text-red-800'
                      default:
                        return 'bg-gray-100 text-gray-800'
                    }
                  }

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
                        {dossier.agences?.nom || '-'}
                      </td>
                      
                      {/* Badge de niveau */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getNiveauBadge(dossier.niveau)}`}>
                          {dossier.niveau || 'RELATION_CLIENT'}
                        </span>
                      </td>

                      {/* Badge d'état */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getEtatBadge(dossier.etat)}`}>
                          {dossier.etat?.replaceAll('_', ' ') || 'EN COURS'}
                        </span>
                      </td>
                      
                      {/* Badge d'urgence */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isUrgent ? (
                          <span className="px-3 py-1 inline-flex items-center gap-1 text-xs leading-5 font-bold rounded-full bg-red-100 text-red-800">
                            🚨 URGENT
                          </span>
                        ) : (
                          <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-600">
                            Normal
                          </span>
                        )}
                      </td>
                      
                      {/* Date de création */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(dossier.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </td>
                      
                      {/* Bouton Voir */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link
                          to={`/rc/dossiers/${dossier.id}`}
                          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-semibold"
                        >
                          👁️ Voir
                        </Link>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </RCLayout>
  )
}
