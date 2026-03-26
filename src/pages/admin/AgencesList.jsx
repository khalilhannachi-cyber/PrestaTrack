import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import AdminLayout from '../../components/AdminLayout'

export default function AgencesList() {
  const [agences, setAgences] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [formData, setFormData] = useState({
    code: '',
    nom: ''
  })

  // Chargement initial des agences au montage du composant
  useEffect(() => {
    fetchAgences()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // fetchAgences est stable

  const fetchAgences = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('agences')
        .select('*')
        .order('code', { ascending: true })

      if (error) throw error
      setAgences(data || [])
    } catch (error) {
      console.error(' Erreur lors du chargement des agences:', error)
      setError('Erreur lors du chargement des agences')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // Validation
    if (!formData.code.trim() || !formData.nom.trim()) {
      setError('Tous les champs sont requis')
      return
    }

    try {
      const { error } = await supabase
        .from('agences')
        .insert([{
          code: formData.code.trim().toUpperCase(),
          nom: formData.nom.trim()
        }])

      if (error) {
        if (error.code === '23505') { // Code d'erreur PostgreSQL pour violation de contrainte UNIQUE
          throw new Error('Ce code d\'agence existe déjà')
        }
        throw error
      }

      setSuccess('Agence créée avec succès !')
      setFormData({ code: '', nom: '' })
      setShowForm(false)
      fetchAgences()

      // Masquer le message de succès après 3 secondes
      setTimeout(() => setSuccess(null), 3000)
    } catch (error) {
      console.error(' Erreur lors de la création:', error)
      setError(error.message || 'Erreur lors de la création de l\'agence')
    }
  }

  const handleDelete = async (id, code) => {
    if (!confirm(`Voulez-vous vraiment supprimer l'agence "${code}" ?\n\nCette action est irréversible.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('agences')
        .delete()
        .eq('id', id)

      if (error) throw error

      setSuccess('Agence supprimée avec succès')
      fetchAgences()

      // Masquer le message de succès après 3 secondes
      setTimeout(() => setSuccess(null), 3000)
    } catch (error) {
      console.error(' Erreur lors de la suppression:', error)
      setError('Erreur lors de la suppression de l\'agence. Elle est peut-être utilisée par des dossiers.')
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-comar-navy mb-4"></div>
              <p className="text-gray-600">Chargement des agences...</p>
            </div>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-comar-navy">Gestion des Agences</h1>
        <Button
          onClick={() => {
            setShowForm(!showForm)
            setError(null)
            setSuccess(null)
          }}
          variant={showForm ? 'secondary' : 'primary'}
        >
          {showForm ? 'Annuler' : '+ Nouvelle Agence'}
        </Button>
      </div>

      {/* Messages de succès/erreur */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          {success}
        </div>
      )}

      {/* Formulaire d'ajout */}
      {showForm && (
        <div className="bg-white rounded-xl p-6 mb-6 border border-comar-neutral-border">
          <h2 className="text-xl font-semibold mb-4 text-comar-navy">Nouvelle Agence</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Code de l'agence"
                type="text"
                name="code"
                placeholder="Ex: PAR01"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                required
                maxLength={10}
              />

              <Input
                label="Nom de l'agence"
                type="text"
                name="nom"
                placeholder="Ex: Agence Paris Centre"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                required
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" variant="primary">
                Créer l'Agence
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowForm(false)
                  setFormData({ code: '', nom: '' })
                }}
              >
                Annuler
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des agences */}
      {agences.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-comar-neutral-border">
          <div className="text-gray-400 mb-2">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="text-gray-500 text-lg">Aucune agence trouvée</p>
          <p className="text-gray-400 text-sm mt-2">Cliquez sur "Nouvelle Agence" pour en créer une</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden border border-comar-neutral-border">
          <table className="min-w-full divide-y divide-comar-neutral-border">
            <thead className="bg-comar-navy">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                  Nom de l'agence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white/80 uppercase tracking-wider">
                  Date de création
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-white/80 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-comar-neutral-border">
              {agences.map((agence) => (
                <tr key={agence.id} className="hover:bg-comar-navy-50/30 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-comar-navy-50 text-comar-navy">
                        {agence.code}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{agence.nom}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {agence.created_at && new Date(agence.created_at).toLocaleDateString('fr-FR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleDelete(agence.id, agence.code)}
                      className="text-red-600 hover:text-red-900 hover:underline transition"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Compteur */}
      {agences.length > 0 && (
        <div className="mt-4 text-sm text-gray-500 text-center">
          {agences.length} agence{agences.length > 1 ? 's' : ''} au total
        </div>
      )}
      </div>
    </AdminLayout>
  )
}
