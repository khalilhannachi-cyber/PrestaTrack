import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'

export default function NewDossier() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    client_name: '',
    description: '',
    statut: 'En cours'
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('dossiers')
        .insert([
          {
            ...formData,
            created_by: user.id
          }
        ])
        .select()

      if (error) throw error

      console.log('✅ Dossier créé:', data)
      alert('Dossier créé avec succès!')
      navigate('/rc/dossiers')
    } catch (error) {
      console.error('❌ Erreur lors de la création:', error)
      alert('Erreur lors de la création du dossier: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate('/rc/dossiers')}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          ← Retour à la liste
        </button>
        <h1 className="text-2xl font-bold">Nouveau Dossier</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
        <div>
          <label htmlFor="client_name" className="block text-sm font-medium text-gray-700 mb-2">
            Nom du Client <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="client_name"
            name="client_name"
            value={formData.client_name}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Ex: Société ABC"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Décrivez le dossier..."
          />
        </div>

        <div>
          <label htmlFor="statut" className="block text-sm font-medium text-gray-700 mb-2">
            Statut <span className="text-red-500">*</span>
          </label>
          <select
            id="statut"
            name="statut"
            value={formData.statut}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="En cours">En cours</option>
            <option value="Terminé">Terminé</option>
            <option value="En attente">En attente</option>
          </select>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Création...' : 'Créer le Dossier'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/rc/dossiers')}
            className="bg-gray-200 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-300 transition"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  )
}
