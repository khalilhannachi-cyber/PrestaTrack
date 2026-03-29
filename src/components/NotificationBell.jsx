import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { checkStaleDossiers } from '../lib/checkStaleDossiers'

/**
 * Composant cloche de notifications
 * Affiche un badge avec le nombre de notifications non lues
 * et un dropdown avec la liste des messages.
 *
 * Intègre aussi la vérification des dossiers bloqués (> 3 jours)
 * qui est déclenchée au montage puis toutes les 5 minutes.
 */
export default function NotificationBell() {
  const { user, role } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Polling notifications (30 s)
  useEffect(() => {
    if (user) fetchNotifications()
    const interval = setInterval(() => { if (user) fetchNotifications() }, 30000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Vérification des dossiers bloqués (au montage + toutes les 5 min)
  useEffect(() => {
    if (user && role) {
      checkStaleDossiers(role).then(() => fetchNotifications())
    }
    const staleInterval = setInterval(() => {
      if (user && role) checkStaleDossiers(role).then(() => fetchNotifications())
    }, 5 * 60 * 1000) // 5 minutes
    return () => clearInterval(staleInterval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, role])

  // Fermer le dropdown au clic extérieur
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchNotifications = async () => {
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      setNotifications(data || [])
    } catch (err) {
      console.error('NotificationBell fetch error', err)
    }
  }

  const markAsRead = async (id) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id)
    if (unreadIds.length === 0) return
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const unreadCount = notifications.filter(n => !n.is_read).length
  const unreadNotifications = notifications.filter(n => !n.is_read)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        title="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold leading-none text-white bg-comar-red rounded-full shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-comar-neutral-border z-50 max-h-96 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-comar-neutral-border bg-comar-neutral-bg/50">
            <h3 className="text-sm font-semibold text-comar-navy">Notifications</h3>
            <div className="flex gap-2">
              <button onClick={() => { setOpen(false); navigate('/notifications') }} className="text-xs text-comar-blue hover:text-blue-700 font-medium transition-colors border-r pr-2 border-gray-300">
                Voir tout
              </button>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-comar-navy hover:text-comar-navy-light font-medium transition-colors">
                  Lu
                </button>
              )}
            </div>
          </div>

          {/* Liste */}
          <div className="overflow-y-auto flex-1">
            {unreadNotifications.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">
                <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
                Aucune nouvelle notification
              </div>
            ) : (
              unreadNotifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => { 
                    markAsRead(n.id);
                    setOpen(false);
                    navigate('/notifications');
                  }}
                  className="px-4 py-3 border-b border-comar-neutral-border/50 cursor-pointer hover:bg-comar-navy-50/50 transition-colors duration-150 bg-comar-navy-50 border-l-2 border-l-comar-navy"
                >
                  <p className="text-sm font-semibold text-comar-navy">
                    {n.message || n.title || 'Notification'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(n.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
