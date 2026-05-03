import { toast } from 'react-hot-toast'
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

      toast.success(`Utilisateur ${newStatus ? 'activé' : 'désactivé'} avec succès`)
      fetchUsers()
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error)
      toast.error("Erreur lors de la mise à jour du statut")
    }
  }

  const handleOpenEditRole = (user) => {
    setEditingUser(user)
    setNewRoleId(user.role_id)
  }

  const handleUpdateRole = async () => {
    if (!newRoleId) {
      toast('Veuillez sélectionner un rôle')
      return
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ role_id: newRoleId })
        .eq('id', editingUser.id)

      if (error) throw error

      toast.success("Rôle mis à jour avec succès")
      setEditingUser(null)
      fetchUsers()
    } catch (error) {
      console.error('Erreur lors de la mise à jour du rôle:', error)
      toast.error("Erreur lors de la mise à jour du rôle")
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!confirm('️ Voulez-vous vraiment supprimer cet utilisateur ? Cette action est irréversible.')) return

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)

      if (error) throw error

      toast.success("Utilisateur supprimé avec succès")
      fetchUsers()
    } catch (error) {
      console.error('Erreur lors de la suppression:', error)
      toast.error(' Erreur lors de la suppression de l\'utilisateur')
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-comar-navy mb-4"></div>
              <p className="text-gray-600">Chargement des utilisateurs...</p>
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
            <h1 className="text-2xl font-extrabold text-comar-navy">Gestion des Utilisateurs</h1>
            <p className="text-sm text-gray-500">Administrez les comptes et les accès aux modules</p>
          </div>
          <Link
            to="/admin/users/nouveau"
            className="bg-comar-navy text-white px-6 py-3 rounded-xl hover:bg-comar-navy-light transition shadow-lg shadow-comar-navy/20 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-widest"
          >
            <span className="text-lg">+</span> Nouvel Utilisateur
          </Link>
        </div>

        {users.length === 0 ? (
          <div className="bg-white rounded-2xl border border-comar-neutral-border p-12 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">Aucun utilisateur trouvé.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-comar-neutral-border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-comar-neutral-border">
                <thead className="bg-comar-navy">
                  <tr>
                    <th className="px-6 py-4 text-left text-[11px] font-bold text-white/70 uppercase tracking-widest">Utilisateur</th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold text-white/70 uppercase tracking-widest">Nom complet</th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold text-white/70 uppercase tracking-widest">Rôle</th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold text-white/70 uppercase tracking-widest">Statut</th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold text-white/70 uppercase tracking-widest">Création</th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold text-white/70 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-comar-neutral-border">
                  {users.map((user) => (
                    <tr key={user.id} className={`hover:bg-comar-navy-50/30 transition-colors duration-150 ${!user.is_active ? 'bg-gray-50/50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-comar-navy">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 font-medium">{user.full_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 inline-flex text-[10px] font-bold rounded-full uppercase tracking-wider ${
                          user.roles?.name === 'ADMIN' ? 'bg-red-100 text-red-700 border border-red-200' :
                          user.roles?.name === 'RELATION_CLIENT' ? 'bg-comar-navy-50 text-comar-navy border border-comar-navy/10' :
                          user.roles?.name === 'FINANCE' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                          'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}>
                          {user.roles?.name || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 inline-flex text-[10px] font-bold rounded-full uppercase tracking-wider ${
                          user.is_active ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-400 border border-gray-200'
                        }`}>
                          {user.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">
                        {new Date(user.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleActive(user.id, user.is_active)}
                            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg uppercase tracking-wider transition ${
                              user.is_active 
                                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' 
                                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            }`}
                          >
                            {user.is_active ? 'Désactiver' : 'Activer'}
                          </button>
                          <button
                            onClick={() => handleOpenEditRole(user)}
                            className="px-3 py-1.5 text-[10px] font-bold rounded-lg bg-comar-navy text-white hover:bg-comar-navy-light uppercase tracking-wider transition shadow-sm"
                          >
                            Rôle
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="px-3 py-1.5 text-[10px] font-bold rounded-lg bg-red-100 text-red-600 hover:bg-red-200 uppercase tracking-wider transition"
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
          </div>
        )}


        {/* Modal pour modifier le rôle */}
        {editingUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold mb-4">Modifier le rôle</h2>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Utilisateur:</strong> {editingUser.full_name} ({editingUser.email})
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  <strong>Rôle actuel:</strong> {editingUser.roles?.name}
                </p>

                <label htmlFor="new_role" className="block text-sm font-medium text-comar-navy mb-2">
                  Nouveau rôle <span className="text-comar-red">*</span>
                </label>
                <select
                  id="new_role"
                  value={newRoleId}
                  onChange={(e) => setNewRoleId(e.target.value)}
                  className="w-full px-3 py-2 border border-comar-neutral-border rounded-md focus:outline-none focus:ring-2 focus:ring-comar-navy/20"
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
                  className="flex-1 bg-comar-navy text-white px-4 py-2 rounded hover:bg-comar-navy-light transition"
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
