import { supabase } from './supabaseClient'

/**
 * Délai en jours au-delà duquel un dossier est considéré comme bloqué.
 */
const STALE_DAYS = 3

/**
 * Mapping niveau dossier → nom du rôle dans la table `roles`.
 * Permet de retrouver les utilisateurs du service concerné.
 */
const NIVEAU_TO_ROLE = {
  RELATION_CLIENT: 'RELATION_CLIENT',
  PRESTATION: 'PRESTATION',
  FINANCE: 'FINANCE'
}

/**
 * Vérifie si des dossiers sont restés bloqués plus de 3 jours
 * au niveau du service de l'utilisateur connecté et crée des
 * notifications `DOSSIER_BLOQUE` pour tous les membres du service.
 *
 * Anti-spam : ne crée pas de doublon si une notification DOSSIER_BLOQUE
 * existe déjà pour le même dossier dans les dernières 24 h.
 *
 * @param {string} userRole - Rôle de l'utilisateur courant (ex. 'PRESTATION')
 */
export async function checkStaleDossiers(userRole) {
  try {
    if (!userRole) return
    const isAdmin = userRole === 'ADMIN'

    // ── 1. Dossiers bloqués : updated_at > 3 jours, non clôturés ──
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - STALE_DAYS)
    const cutoffISO = cutoff.toISOString()

    let query = supabase
      .from('dossiers')
      .select('id, souscripteur, police_number, niveau, updated_at, created_at')
      .neq('etat', 'CLOTURE')
      .neq('etat', 'ANNULE')
      .lt('updated_at', cutoffISO)

    // Si pas admin, on ne regarde que son propre service
    if (!isAdmin) {
      query = query.eq('niveau', userRole)
    }

    const { data: staleDossiers, error: staleErr } = await query

    if (staleErr) {
      console.error('[checkStaleDossiers] query error:', staleErr.message)
      return
    }

    if (!staleDossiers || staleDossiers.length === 0) return

    // ── 2. Vérifier les notifications déjà envoyées (anti-spam 24 h) ──────────
    const last24h = new Date()
    last24h.setHours(last24h.getHours() - 24)
    const last24hISO = last24h.toISOString()

    const dossierIds = staleDossiers.map(d => d.id)

    const { data: recentNotifs } = await supabase
      .from('notifications')
      .select('dossier_id')
      .in('dossier_id', dossierIds)
      .eq('type', 'DOSSIER_BLOQUE')
      .gte('created_at', last24hISO)

    const alreadyNotified = new Set((recentNotifs || []).map(n => n.dossier_id))
    const dossiersToNotify = staleDossiers.filter(d => !alreadyNotified.has(d.id))

    if (dossiersToNotify.length === 0) return

    // ── 3. Récupérer les utilisateurs à notifier (Admins + Service concerné) ──
    // On notifie toujours les Admins, et si c'est un service spécifique, on notifie aussi ses membres.
    const roleToNotify = NIVEAU_TO_ROLE[userRole] || userRole
    
    const { data: allUsersToNotify, error: usersErr } = await supabase
      .from('users')
      .select('id, roles!inner ( name )')
      .or(`roles.name.eq.ADMIN${!isAdmin ? `,roles.name.eq.${roleToNotify}` : ''}`)

    if (usersErr || !allUsersToNotify || allUsersToNotify.length === 0) return

    // ── 4. Créer les notifications ────────────────────────────────────────────
    const niveauLabel = {
      RELATION_CLIENT: 'Relation Client',
      PRESTATION: 'Prestation',
      FINANCE: 'Finance'
    }

    const now = new Date().toISOString()
    const rows = []

    for (const dossier of dossiersToNotify) {
      const daysSince = Math.floor(
        (Date.now() - new Date(dossier.updated_at || dossier.created_at).getTime()) /
        (1000 * 60 * 60 * 24)
      )

      // On crée une notification pour chaque utilisateur cible
      for (const u of allUsersToNotify) {
        // Optionnel : On peut filtrer pour ne pas notifier un membre d'un autre service 
        // si le dossier ne le concerne pas, mais ici on notifie Admin + Membres du service du dossier.
        // Comme on a filtré la liste usersToNotify plus haut, on peut insérer pour tous.
        
        // Si on veut être très précis : l'admin reçoit tout, les autres ne reçoivent que leur niveau.
        const userIsAdmin = u.roles.name === 'ADMIN'
        const userMatchesDossierNiveau = u.roles.name === dossier.niveau

        if (userIsAdmin || userMatchesDossierNiveau) {
          rows.push({
            user_id: u.id,
            dossier_id: dossier.id,
            type: 'DOSSIER_BLOQUE',
            message: `⚠️ DOSSIER BLOQUÉ : "${dossier.souscripteur}" est en attente au niveau ${niveauLabel[dossier.niveau] || dossier.niveau} depuis ${daysSince} jours.`,
            is_read: false,
            created_at: now
          })
        }
      }
    }

    if (rows.length > 0) {
      const { error: insertErr } = await supabase.from('notifications').insert(rows)
      if (insertErr) {
        console.error('[checkStaleDossiers] insert error:', insertErr.message)
      } else {
        console.log(`[checkStaleDossiers] ${rows.length} notification(s) de blocage créée(s).`)
      }
    }
  } catch (err) {
    console.error('[checkStaleDossiers] unexpected error:', err)
  }
}
