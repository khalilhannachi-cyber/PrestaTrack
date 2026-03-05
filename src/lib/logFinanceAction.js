// Client Supabase partagé
import { supabase } from './supabaseClient'

/**
 * Enregistre une action Finance dans la table historique_actions.
 *
 * @param {number}      dossierId - ID du dossier concerné
 * @param {string}      action    - Code de l'action (ex: 'VALIDATION_CONFORMITE', 'PAIEMENT_CONFIRME')
 * @param {string}      userId    - UUID de l'utilisateur connecté
 * @param {Object}      [opts]    - Options supplémentaires
 * @param {string}      [opts.description]  - Description lisible de l'action
 * @param {string|null} [opts.old_status]   - Statut avant l'action
 * @param {string|null} [opts.new_status]   - Statut après l'action
 *
 * @returns {Promise<{ data: Object|null, error: Object|null }>}
 *   Retourne l'objet Supabase { data, error } — les erreurs sont non-bloquantes
 *   par convention : le caller peut choisir de les ignorer ou de les loguer.
 */
export async function logFinanceAction(dossierId, action, userId, opts = {}) {
  const { description = null, old_status = null, new_status = null } = opts

  if (!dossierId || !action || !userId) {
    console.warn('[logFinanceAction] Paramètres manquants — insertion ignorée', {
      dossierId,
      action,
      userId,
    })
    return { data: null, error: new Error('Paramètres manquants') }
  }

  const payload = {
    dossier_id:  dossierId,
    user_id:     userId,
    action,
    created_at:  new Date().toISOString(),
    ...(description !== null && { description }),
    ...(old_status  !== null && { old_status }),
    ...(new_status  !== null && { new_status }),
  }

  console.log('[logFinanceAction] Insertion historique :', payload)

  const { data, error } = await supabase
    .from('historique_actions')
    .insert([payload])
    .select()
    .single()

  if (error) {
    console.warn('[logFinanceAction] Erreur insertion (non bloquant) :', error.message)
  } else {
    console.log('[logFinanceAction] ✅ Action enregistrée :', action)
  }

  return { data, error }
}
