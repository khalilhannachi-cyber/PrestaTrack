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
    if (!userRole || !NIVEAU_TO_ROLE[userRole]) return

    // ── 1. Dossiers bloqués : updated_at > 3 jours, même niveau, non clôturés ──
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - STALE_DAYS)
    const cutoffISO = cutoff.toISOString()

    const { data: staleDossiers, error: staleErr } = await supabase
      .from('dossiers')
      .select('id, souscripteur, police_number, niveau, updated_at, created_at')
      .eq('niveau', userRole)
      .neq('etat', 'CLOTURE')
      .lt('updated_at', cutoffISO)

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

    // ── 3. Récupérer les utilisateurs du service concerné ──────────────────────
    const roleName = NIVEAU_TO_ROLE[userRole]
    const { data: serviceUsers, error: usersErr } = await supabase
      .from('users')
      .select('id, roles!inner ( name )')
      .eq('roles.name', roleName)

    if (usersErr || !serviceUsers || serviceUsers.length === 0) return

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

      for (const u of serviceUsers) {
        rows.push({
          user_id: u.id,
          dossier_id: dossier.id,
          type: 'DOSSIER_BLOQUE',
          message: `⚠️ Le dossier de "${dossier.souscripteur}" (${dossier.police_number || 'N/A'}) est bloqué au niveau ${niveauLabel[dossier.niveau] || dossier.niveau} depuis ${daysSince} jour${daysSince > 1 ? 's' : ''}.`,
          is_read: false,
          created_at: now
        })
      }
    }

    if (rows.length > 0) {
      const { error: insertErr } = await supabase.from('notifications').insert(rows)
      if (insertErr) {
        console.error('[checkStaleDossiers] insert error:', insertErr.message)
      } else {
        console.log(`[checkStaleDossiers] ${rows.length} notification(s) créée(s) pour ${dossiersToNotify.length} dossier(s) bloqué(s).`)
      }
    }
  } catch (err) {
    console.error('[checkStaleDossiers] unexpected error:', err)
  }
}
