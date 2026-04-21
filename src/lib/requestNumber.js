/**
 * Format de reference de dossier aligne avec l'interface client.
 * Priorite a un champ persiste si present, sinon fallback deterministic base sur l'ID.
 */
export const formatRequestNumber = (dossierOrId) => {
  if (!dossierOrId) return 'N/A'

  if (typeof dossierOrId === 'object') {
    const explicit = String(
      dossierOrId.request_number || dossierOrId.numero_demande || ''
    ).trim()

    if (explicit) return explicit

    const rawId = String(dossierOrId.id || dossierOrId.dossier_id || '').trim()
    if (!rawId) return 'N/A'
    return `DEM-${rawId.slice(0, 8).toUpperCase()}`
  }

  const rawId = String(dossierOrId).trim()
  if (!rawId) return 'N/A'
  return `DEM-${rawId.slice(0, 8).toUpperCase()}`
}

export const buildRequestNumberFromId = (dossierId) => {
  const rawId = String(dossierId || '').trim()
  if (!rawId) return 'N/A'
  return `DEM-${rawId.slice(0, 8).toUpperCase()}`
}
