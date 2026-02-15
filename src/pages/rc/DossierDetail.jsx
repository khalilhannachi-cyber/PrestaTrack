import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

export default function DossierDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [dossier, setDossier] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDossier()
  }, [id])

  const fetchDossier = async () => {
    try {
      const { data, error } = await supabase
        .from('dossiers')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      setDossier(data)
    } catch (error) {
      console.error('Erreur lors du chargement du dossier:', error)
      alert('Dossier introuvable')
      navigate('/rc/dossiers')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-gray-600">Chargement...</div>
      </div>
    )
  }

  if (!dossier) return null

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate('/rc/dossiers')}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          ← Retour à la liste
        </button>
        <h1 className="text-2xl font-bold">Dossier #{dossier.id}</h1>
      </div>

      <div className="bg-white shadow rounded-lg p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
              Client
            </h3>
            <p className="text-lg font-semibold text-gray-900">{dossier.client_name}</p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
              Statut
            </h3>
            <span className="inline-block px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800">
              {dossier.statut}
            </span>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
            Description
          </h3>
          <p className="text-gray-900 leading-relaxed">
            {dossier.description || 'Aucune description'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200">
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
        </div>

        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={() => navigate(`/rc/dossiers/${id}/edit`)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
          >
            Modifier
          </button>
        </div>
      </div>
    </div>
  )
}
