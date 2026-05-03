import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import RCLayout from '../components/RCLayout'
import AdminLayout from '../components/AdminLayout'
import PrestationLayout from '../components/PrestationLayout'
import FinanceLayout from '../components/FinanceLayout'
import ConfirmModal from '../components/ConfirmModal'

export default function NotificationsPage() {
  const { user, role } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', type: 'warning', onConfirm: null })

  useEffect(() => {
    if (user) {
      fetchNotifications()
    }
  }, [user])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setNotifications(data || [])
    } catch (err) {
      console.error('Error fetching notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id) => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    } catch (err) {
      console.error('Error marking as read:', err)
    }
  }

  const markAllRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id)
      if (unreadIds.length === 0) return
      
      await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds)
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (err) {
      console.error('Error marking all as read:', err)
    }
  }

  const clearAll = async () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Supprimer les notifications',
      message: 'Êtes-vous sûr de vouloir supprimer toutes vos notifications ?',
      type: 'danger',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }))
        try {
          await supabase.from('notifications').delete().eq('user_id', user.id)
          setNotifications([])
        } catch (err) {
          console.error('Error deleting notifications:', err)
        }
      }
    })
  }

  const content = (
    <div className="max-w-4xl mx-auto space-y-6 pt-8 pb-12 px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-comar-navy">Vos Notifications</h1>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={markAllRead}
            className="text-sm font-medium text-comar-navy hover:text-comar-blue transition-colors"
            disabled={!notifications.some(n => !n.is_read)}
          >
            Tout marquer comme lu
          </button>
          <button 
            onClick={clearAll}
            className="text-sm font-medium text-comar-red hover:text-red-700 transition-colors"
            disabled={notifications.length === 0}
          >
            Tout supprimer
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-comar-neutral-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center">
            <svg className="w-12 h-12 mb-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            Vous n'avez aucune notification.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map(n => (
              <div 
                key={n.id} 
                className={`p-5 transition-colors ${!n.is_read ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className={`text-sm ${!n.is_read ? 'font-semibold text-comar-navy' : 'text-gray-700'}`}>
                      {n.message || n.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(n.created_at).toLocaleString('fr-FR', { 
                        dateStyle: 'long', 
                        timeStyle: 'short' 
                      })}
                    </p>
                  </div>
                  {!n.is_read && (
                    <button 
                      onClick={() => markAsRead(n.id)}
                      className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 hover:text-comar-navy transition-colors whitespace-nowrap"
                    >
                      Marquer comme lu
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  )

  // Adapter le Layout selon le rôle
  if (role === 'ADMIN') return <AdminLayout>{content}</AdminLayout>
  if (role === 'RELATION_CLIENT') return <RCLayout>{content}</RCLayout>
  if (role === 'PRESTATION') return <PrestationLayout>{content}</PrestationLayout>
  if (role === 'FINANCE') return <FinanceLayout>{content}</FinanceLayout>
  
  // Par défaut sans layout spécifique
  return <div className="min-h-screen bg-comar-neutral-bg">{content}</div>
}
