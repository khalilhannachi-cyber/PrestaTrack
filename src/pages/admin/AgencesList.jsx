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
      <div className="p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-comar-navy">Gestion des Agences</h1>
            <p className="text-sm text-gray-500">Configurez les points de vente COMAR Assurances</p>
          </div>
          <Button
            onClick={() => {
              setShowForm(!showForm)
              setError(null)
              setSuccess(null)
            }}
            className={`px-6 py-3 rounded-xl transition shadow-lg flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-widest ${
              showForm 
                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' 
                : 'bg-comar-navy text-white hover:bg-comar-navy-light shadow-comar-navy/20'
            }`}
          >
            {showForm ? 'Annuler' : '+ Nouvelle Agence'}
          </Button>
        </div>

        {/* Messages de succès/erreur */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3 animate-shake">
            <span className="text-xl">⚠️</span>
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-3 animate-fade-in">
            <span className="text-xl">✅</span>
            <span className="text-sm font-medium">{success}</span>
          </div>
        )}

        {/* Formulaire d'ajout */}
        {showForm && (
          <div className="bg-white rounded-2xl p-6 mb-8 border border-comar-neutral-border shadow-sm animate-slide-down">
            <h2 className="text-lg font-bold mb-4 text-comar-navy">Détails de la nouvelle agence</h2>
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
                  className="rounded-lg"
                />

                <Input
                  label="Nom de l'agence"
                  type="text"
                  name="nom"
                  placeholder="Ex: Agence Paris Centre"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                  className="rounded-lg"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="submit" 
                  className="bg-comar-navy text-white px-6 py-2.5 rounded-xl hover:bg-comar-navy-light transition text-[11px] font-bold uppercase tracking-widest shadow-lg shadow-comar-navy/20"
                >
                  Créer l'Agence
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setFormData({ code: '', nom: '' })
                  }}
                  className="bg-gray-100 text-gray-600 px-6 py-2.5 rounded-xl hover:bg-gray-200 transition text-[11px] font-bold uppercase tracking-widest"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Liste des agences */}
        {agences.length === 0 ? (
          <div className="bg-white rounded-2xl border border-comar-neutral-border p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">Aucune agence trouvée.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-comar-neutral-border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-comar-neutral-border">
                <thead className="bg-comar-navy">
                  <tr>
                    <th className="px-6 py-4 text-left text-[11px] font-bold text-white/70 uppercase tracking-widest">Code</th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold text-white/70 uppercase tracking-widest">Nom de l'agence</th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold text-white/70 uppercase tracking-widest">Création</th>
                    <th className="px-6 py-4 text-right text-[11px] font-bold text-white/70 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-comar-neutral-border">
                  {agences.map((agence) => (
                    <tr key={agence.id} className="hover:bg-comar-navy-50/30 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-comar-navy-50 text-comar-navy border border-comar-navy/10">
                          {agence.code}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-comar-navy">{agence.nom}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs text-gray-500 font-medium">
                          {agence.created_at && new Date(agence.created_at).toLocaleDateString('fr-FR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleDelete(agence.id, agence.code)}
                          className="px-4 py-2 text-[10px] font-bold rounded-lg bg-red-100 text-red-600 hover:bg-red-200 uppercase tracking-wider transition"
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
