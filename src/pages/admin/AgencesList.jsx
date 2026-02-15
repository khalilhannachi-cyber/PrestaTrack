import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function AgencesList() {
  const [agences, setAgences] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    nom: '',
    ville: '',
    adresse: ''
  })

  useEffect(() => {
    fetchAgences()
  }, [])

  const fetchAgences = async () => {
    try {
      const { data, error } = await supabase
        .from('agences')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setAgences(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des agences:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      const { data, error } = await supabase
        .from('agences')
        .insert([formData])
        .select()

      if (error) throw error

      alert('Agence créée avec succès!')
      setFormData({ nom: '', ville: '', adresse: '' })
      setShowForm(false)
      fetchAgences()
    } catch (error) {
      console.error('Erreur lors de la création:', error)
      alert('Erreur lors de la création de l\'agence')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Voulez-vous vraiment supprimer cette agence ?')) return

    try {
      const { error } = await supabase
        .from('agences')
        .delete()
        .eq('id', id)

      if (error) throw error

      alert('Agence supprimée avec succès')
      fetchAgences()
    } catch (error) {
      console.error('Erreur lors de la suppression:', error)
      alert('Erreur lors de la suppression de l\'agence')
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-gray-600">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestion des Agences</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          {showForm ? 'Annuler' : '+ Nouvelle Agence'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Nouvelle Agence</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-2">
                Nom de l'agence <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="nom"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Agence Paris Centre"
              />
            </div>

            <div>
              <label htmlFor="ville" className="block text-sm font-medium text-gray-700 mb-2">
                Ville <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="ville"
                value={formData.ville}
                onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Paris"
              />
            </div>

            <div>
              <label htmlFor="adresse" className="block text-sm font-medium text-gray-700 mb-2">
                Adresse
              </label>
              <input
                type="text"
                id="adresse"
                value={formData.adresse}
                onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: 123 Rue de la Paix"
              />
            </div>

            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition"
            >
              Créer l'Agence
            </button>
          </form>
        </div>
      )}

      {agences.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center text-gray-500">
          Aucune agence trouvée. Créez votre première agence !
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agences.map((agence) => (
            <div key={agence.id} className="bg-white shadow rounded-lg p-6 hover:shadow-lg transition">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{agence.nom}</h3>
                <button
                  onClick={() => handleDelete(agence.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Supprimer
                </button>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  <span className="font-medium">Ville:</span> {agence.ville}
                </p>
                {agence.adresse && (
                  <p>
                    <span className="font-medium">Adresse:</span> {agence.adresse}
                  </p>
                )}
                <p className="text-xs text-gray-400 pt-2">
                  Créée le {new Date(agence.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
