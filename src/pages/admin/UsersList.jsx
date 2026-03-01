import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import AdminLayout from '../../components/AdminLayout'

export default function UsersList() {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState(null)
  const [newRoleId, setNewRoleId] = useState('')

  // Chargement initial des utilisateurs et rôles au montage du composant
  useEffect(() => {
    fetchUsers()
    fetchRoles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Les fonctions fetch sont stables

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, roles(id, name, description)')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('name')

      if (error) throw error
      setRoles(data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des rôles:', error)
    }
  }

  const handleToggleActive = async (userId, currentStatus) => {
    const newStatus = !currentStatus
    const action = newStatus ? 'activer' : 'désactiver'
    
    if (!confirm(`Voulez-vous vraiment ${action} cet utilisateur ?`)) return

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: newStatus })
        .eq('id', userId)

      if (error) throw error

      alert(`✅ Utilisateur ${newStatus ? 'activé' : 'désactivé'} avec succès`)
      fetchUsers()
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error)
      alert('❌ Erreur lors de la mise à jour du statut')
    }
  }

  const handleOpenEditRole = (user) => {
    setEditingUser(user)
    setNewRoleId(user.role_id)
  }

  const handleUpdateRole = async () => {
    if (!newRoleId) {
      alert('Veuillez sélectionner un rôle')
      return
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ role_id: newRoleId })
        .eq('id', editingUser.id)

      if (error) throw error

      alert('✅ Rôle mis à jour avec succès')
      setEditingUser(null)
      fetchUsers()
    } catch (error) {
      console.error('Erreur lors de la mise à jour du rôle:', error)
      alert('❌ Erreur lors de la mise à jour du rôle')
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!confirm('⚠️ Voulez-vous vraiment supprimer cet utilisateur ? Cette action est irréversible.')) return

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)

      if (error) throw error

      alert('✅ Utilisateur supprimé avec succès')
      fetchUsers()
    } catch (error) {
      console.error('Erreur lors de la suppression:', error)
      alert('❌ Erreur lors de la suppression de l\'utilisateur')
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">Chargement des utilisateurs...</p>
            </div>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestion des Utilisateurs</h1>
        <Link
          to="/admin/users/nouveau"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          + Nouvel Utilisateur
        </Link>
      </div>

      {users.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-8 text-center text-gray-500">
          Aucun utilisateur trouvé.
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom complet
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rôle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date de création
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className={`hover:bg-gray-50 ${!user.is_active ? 'opacity-60' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.full_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.roles?.name === 'ADMIN' ? 'bg-red-100 text-red-800' :
                      user.roles?.name === 'RELATION_CLIENT' ? 'bg-blue-100 text-blue-800' :
                      user.roles?.name === 'FINANCE' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {user.roles?.name || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {user.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleActive(user.id, user.is_active)}
                        className={`${
                          user.is_active ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'
                        } font-medium text-xs`}
                        title={user.is_active ? 'Désactiver' : 'Activer'}
                      >
                        {user.is_active ? 'Désactiver' : 'Activer'}
                      </button>
                      <button
                        onClick={() => handleOpenEditRole(user)}
                        className="text-blue-600 hover:text-blue-900 font-medium text-xs"
                        title="Modifier le rôle"
                      >
                        Modifier rôle
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 hover:text-red-900 font-medium text-xs"
                        title="Supprimer"
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal pour modifier le rôle */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Modifier le rôle</h2>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Utilisateur:</strong> {editingUser.full_name} ({editingUser.email})
              </p>
              <p className="text-sm text-gray-600 mb-4">
                <strong>Rôle actuel:</strong> {editingUser.roles?.name}
              </p>
              
              <label htmlFor="new_role" className="block text-sm font-medium text-gray-700 mb-2">
                Nouveau rôle <span className="text-red-500">*</span>
              </label>
              <select
                id="new_role"
                value={newRoleId}
                onChange={(e) => setNewRoleId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sélectionnez un rôle</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleUpdateRole}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
              >
                Modifier
              </button>
              <button
                onClick={() => setEditingUser(null)}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  )
}
