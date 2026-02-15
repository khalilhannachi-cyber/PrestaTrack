import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import AdminLayout from '../../components/AdminLayout'

export default function NewUser() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState([])
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role_id: ''
  })

  useEffect(() => {
    fetchRoles()
  }, [])

  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('name')

      if (error) throw error
      setRoles(data || [])
      
      // Sélectionner le premier rôle par défaut
      if (data && data.length > 0) {
        setFormData(prev => ({ ...prev, role_id: data[0].id }))
      }
    } catch (error) {
      console.error('Erreur lors du chargement des rôles:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      console.log('📝 Création de l\'utilisateur...', formData)

      // Créer l'utilisateur dans Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name
          }
        }
      })

      if (authError) throw authError
      
      if (!authData.user) {
        throw new Error('Aucun utilisateur créé')
      }

      console.log('✅ Utilisateur créé dans Auth:', authData.user.id)

      // Insérer dans la table users
      const { error: userError } = await supabase
        .from('users')
        .insert([
          {
            id: authData.user.id,
            email: formData.email,
            full_name: formData.full_name,
            role_id: formData.role_id,
            is_active: true
          }
        ])

      if (userError) throw userError

      console.log('✅ Utilisateur inséré dans la table users')
      alert('✅ Utilisateur créé avec succès!')
      navigate('/admin/users')
      
    } catch (error) {
      console.error('❌ Erreur lors de la création:', error)
      
      let errorMessage = 'Erreur lors de la création de l\'utilisateur'
      
      if (error.message.includes('already')) {
        errorMessage = 'Cet email est déjà utilisé'
      } else if (error.message.includes('password')) {
        errorMessage = 'Le mot de passe doit contenir au moins 6 caractères'
      } else if (error.message) {
        errorMessage = error.message
      }
      
      alert('❌ ' + errorMessage)
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
    <AdminLayout>
      <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate('/admin/users')}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          ← Retour à la liste
        </button>
        <h1 className="text-2xl font-bold">Nouvel Utilisateur</h1>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800">
          ℹ️ <strong>Important:</strong> Assurez-vous que la confirmation email est désactivée dans Supabase 
          (Authentication → Providers → Email → Décocher "Confirm email")
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="user@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
            Mot de passe <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            minLength={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Min. 6 caractères"
          />
        </div>

        <div>
          <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-2">
            Nom complet <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="full_name"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Jean Dupont"
          />
        </div>

        <div>
          <label htmlFor="role_id" className="block text-sm font-medium text-gray-700 mb-2">
            Rôle <span className="text-red-500">*</span>
          </label>
          <select
            id="role_id"
            name="role_id"
            value={formData.role_id}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {roles.length === 0 ? (
              <option value="">Chargement des rôles...</option>
            ) : (
              <>
                <option value="">Sélectionnez un rôle</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Création...' : 'Créer l\'Utilisateur'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/users')}
            className="bg-gray-200 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-300 transition"
          >
            Annuler
          </button>
        </div>
      </form>
      </div>
    </AdminLayout>
  )
}
