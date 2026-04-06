import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import AdminLayout from '../../components/AdminLayout'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'

const DEFAULT_SLA_THRESHOLDS = {
  RELATION_CLIENT: 3,
  PRESTATION: 3,
  FINANCE: 3,
}

const ACTION_HISTORY_DAYS = 180

const SERVICE_FILTERS = [
  { key: 'ALL', label: 'Tous les services' },
  { key: 'RELATION_CLIENT', label: 'Relation Client' },
  { key: 'PRESTATION', label: 'Prestation' },
  { key: 'FINANCE', label: 'Finance' },
]

const PERIOD_PRESETS = [
  { key: 'TODAY', label: "Aujourd'hui" },
  { key: '7D', label: '7 derniers jours' },
  { key: '30D', label: '30 derniers jours' },
  { key: 'CUSTOM', label: 'Période personnalisée' },
  { key: 'ALL', label: 'Toutes périodes' },
]

const TREND_MODES = [
  { key: 'DAY', label: 'Tendance vs hier' },
  { key: 'WEEK', label: 'Tendance vs 7j précédents' },
]

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date) {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function clampThreshold(value) {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) return 1
  return Math.max(1, Math.min(30, parsed))
}

function buildPeriodFromPreset(preset, customStartDate, customEndDate) {
  const now = new Date()

  if (preset === 'ALL') {
    return {
      key: 'ALL',
      start: null,
      end: null,
      isValid: true,
      label: 'Toutes périodes',
    }
  }

  if (preset === 'TODAY') {
    return {
      key: 'TODAY',
      start: startOfDay(now),
      end: now,
      isValid: true,
      label: "Aujourd'hui",
    }
  }

  if (preset === '7D') {
    const start = startOfDay(new Date(now.getTime() - (6 * 24 * 60 * 60 * 1000)))
    return {
      key: '7D',
      start,
      end: now,
      isValid: true,
      label: '7 derniers jours',
    }
  }

  if (preset === '30D') {
    const start = startOfDay(new Date(now.getTime() - (29 * 24 * 60 * 60 * 1000)))
    return {
      key: '30D',
      start,
      end: now,
      isValid: true,
      label: '30 derniers jours',
    }
  }

  if (preset === 'CUSTOM') {
    if (!customStartDate || !customEndDate) {
      return {
        key: 'CUSTOM',
        start: null,
        end: null,
        isValid: false,
        label: 'Période personnalisée incomplète',
      }
    }

    const start = startOfDay(new Date(customStartDate))
    const end = endOfDay(new Date(customEndDate))

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return {
        key: 'CUSTOM',
        start: null,
        end: null,
        isValid: false,
        label: 'Période personnalisée invalide',
      }
    }

    return {
      key: 'CUSTOM',
      start,
      end,
      isValid: true,
      label: `Du ${start.toLocaleDateString('fr-FR')} au ${end.toLocaleDateString('fr-FR')}`,
    }
  }

  return {
    key: 'ALL',
    start: null,
    end: null,
    isValid: true,
    label: 'Toutes périodes',
  }
}

function isDateInRange(dateValue, range) {
  if (!dateValue) return false

  if (!range || (!range.start && !range.end)) {
    return true
  }

  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return false

  if (range.start && date < range.start) return false
  if (range.end && date > range.end) return false
  return true
}

function daysSinceDate(dateValue) {
  if (!dateValue) return 0

  const msPerDay = 1000 * 60 * 60 * 24
  const diff = Date.now() - new Date(dateValue).getTime()
  return Math.max(0, Math.floor(diff / msPerDay))
}

function getEtatLabel(etat) {
  const labels = {
    EN_COURS: 'En cours',
    EN_INSTANCE: 'En instance',
    CLOTURE: 'Clôturé',
    ANNULE: 'Annulé',
    VALIDE: 'Validé',
    REJETE: 'Rejeté',
  }

  return labels[etat] || etat || 'N/A'
}

function resolveOperationalService(dossier) {
  if (!dossier) return 'RELATION_CLIENT'

  if (dossier.etat === 'EN_INSTANCE' || dossier.niveau === 'FINANCE') {
    return 'FINANCE'
  }

  if (dossier.niveau === 'PRESTATION') {
    return 'PRESTATION'
  }

  return 'RELATION_CLIENT'
}

function getServiceLabel(service) {
  const labels = {
    RELATION_CLIENT: 'Relation Client',
    PRESTATION: 'Prestation',
    FINANCE: 'Finance',
  }

  return labels[service] || service || 'N/A'
}

function getServiceRoles(service) {
  if (service === 'RELATION_CLIENT') {
    return ['RELATION_CLIENT', 'RC']
  }

  if (service === 'PRESTATION') {
    return ['PRESTATION']
  }

  if (service === 'FINANCE') {
    return ['FINANCE']
  }

  return []
}

function computeAverageAgeInDays(rows) {
  if (!rows || rows.length === 0) return 0

  const total = rows.reduce((sum, row) => {
    return sum + daysSinceDate(row.lastDate || row.updated_at || row.created_at)
  }, 0)

  return total / rows.length
}

function computeSlaRate(rows, getThresholdForRow) {
  if (!rows || rows.length === 0) return 100

  const inSla = rows.filter((row) => {
    const threshold = getThresholdForRow ? getThresholdForRow(row) : 3
    return row.staleDays <= threshold
  }).length

  return (inSla / rows.length) * 100
}

function formatMontant(value) {
  const amount = Number(value || 0)
  return new Intl.NumberFormat('fr-TN', {
    style: 'currency',
    currency: 'TND',
    minimumFractionDigits: 3,
  }).format(amount)
}

function formatDate(value) {
  if (!value) return '-'

  try {
    return new Date(value).toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return '-'
  }
}

function escapeCsvValue(value) {
  const text = String(value ?? '')
  const escaped = text.replace(/"/g, '""')
  return `"${escaped}"`
}

function buildCsv(headers, rows) {
  const headerLine = headers.map((header) => escapeCsvValue(header.label)).join(',')
  const bodyLines = rows.map((row) => {
    return headers.map((header) => escapeCsvValue(row[header.key])).join(',')
  })

  return [headerLine, ...bodyLines].join('\n')
}

function downloadCsvFile(filename, csvContent) {
  const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function buildTrendDescriptor(delta, label, options = {}) {
  const {
    decimals = 0,
    suffix = '',
    increaseIsGood = true,
  } = options

  const rounded = delta.toFixed(decimals)
  const signed = `${delta > 0 ? '+' : ''}${rounded}${suffix}`

  if (delta === 0) {
    return {
      text: `${label}: ${signed}`,
      className: 'text-gray-500',
    }
  }

  const isGood = (delta > 0 && increaseIsGood) || (delta < 0 && !increaseIsGood)

  return {
    text: `${label}: ${signed}`,
    className: isGood ? 'text-emerald-700' : 'text-comar-red',
  }
}

function KpiCard({ title, value, subtitle, valueClassName = 'text-comar-navy' }) {
  return (
    <div className="bg-white rounded-xl border border-comar-neutral-border p-4">
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">{title}</p>
      <p className={`text-3xl font-bold mt-2 ${valueClassName}`}>{value}</p>
      {subtitle ? <p className="text-xs text-gray-500 mt-1">{subtitle}</p> : null}
    </div>
  )
}

function ServiceStat({ label, value, tone = 'text-comar-navy' }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className={`font-semibold ${tone}`}>{value}</span>
    </div>
  )
}

function boolBadge(value) {
  if (value === true) {
    return <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-emerald-50 text-emerald-700">Oui</span>
  }

  if (value === false) {
    return <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Non</span>
  }

  return <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-comar-neutral-bg text-gray-600">N/A</span>
}

export default function ServicesMonitoring() {
  const { user } = useAuth()

  const [dossiers, setDossiers] = useState([])
  const [prestationDetails, setPrestationDetails] = useState([])
  const [financeDetails, setFinanceDetails] = useState([])
  const [actionHistory, setActionHistory] = useState([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  const [serviceFilter, setServiceFilter] = useState('ALL')
  const [agencyFilter, setAgencyFilter] = useState('ALL')
  const [periodPreset, setPeriodPreset] = useState('7D')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [trendMode, setTrendMode] = useState('DAY')

  const [actionBusy, setActionBusy] = useState({})
  const [exporting, setExporting] = useState(false)

  const [slaThresholds, setSlaThresholds] = useState(DEFAULT_SLA_THRESHOLDS)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('admin_sla_thresholds_v1')
      if (!stored) return

      const parsed = JSON.parse(stored)
      setSlaThresholds((prev) => ({
        RELATION_CLIENT: clampThreshold(parsed.RELATION_CLIENT ?? prev.RELATION_CLIENT),
        PRESTATION: clampThreshold(parsed.PRESTATION ?? prev.PRESTATION),
        FINANCE: clampThreshold(parsed.FINANCE ?? prev.FINANCE),
      }))
    } catch (storageError) {
      console.warn('[ServicesMonitoring] Impossible de charger les SLA locaux:', storageError)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('admin_sla_thresholds_v1', JSON.stringify(slaThresholds))
  }, [slaThresholds])

  const fetchDashboardData = async ({ silent = false } = {}) => {
    try {
      if (silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      setError(null)

      const { data: dossiersData, error: dossiersError } = await supabase
        .from('dossiers')
        .select(`
          id,
          souscripteur,
          police_number,
          niveau,
          etat,
          is_urgent,
          created_at,
          updated_at,
          agences ( id, nom )
        `)
        .order('updated_at', { ascending: false })

      if (dossiersError) throw dossiersError

      const safeDossiers = dossiersData || []
      setDossiers(safeDossiers)

      if (safeDossiers.length === 0) {
        setPrestationDetails([])
        setFinanceDetails([])
        setActionHistory([])
        return
      }

      const dossierIds = safeDossiers.map((row) => row.id)
      const historyStart = new Date()
      historyStart.setDate(historyStart.getDate() - ACTION_HISTORY_DAYS)

      const [prestationResult, financeResult, actionResult] = await Promise.all([
        supabase
          .from('dossier_details_prestation')
          .select('dossier_id, montant, document_complet, quittance_signee')
          .in('dossier_id', dossierIds),
        supabase
          .from('dossier_details_finance')
          .select('dossier_id, conformite_validee, date_paiement')
          .in('dossier_id', dossierIds),
        supabase
          .from('historique_actions')
          .select('dossier_id, action, created_at')
          .gte('created_at', historyStart.toISOString())
      ])

      if (prestationResult.error) {
        console.warn('[ServicesMonitoring] Erreur details prestation:', prestationResult.error.message)
      }

      if (financeResult.error) {
        console.warn('[ServicesMonitoring] Erreur details finance:', financeResult.error.message)
      }

      if (actionResult.error) {
        console.warn('[ServicesMonitoring] Erreur historique actions:', actionResult.error.message)
      }

      setPrestationDetails(prestationResult.data || [])
      setFinanceDetails(financeResult.data || [])
      setActionHistory(actionResult.data || [])
    } catch (err) {
      console.error('[ServicesMonitoring] Erreur de chargement:', err)
      setError(err.message || 'Erreur inconnue pendant le chargement du dashboard admin.')
    } finally {
      if (silent) {
        setRefreshing(false)
      } else {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    fetchDashboardData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const prestationByDossier = useMemo(() => {
    const map = {}
    for (const row of prestationDetails) {
      map[row.dossier_id] = row
    }
    return map
  }, [prestationDetails])

  const financeByDossier = useMemo(() => {
    const map = {}
    for (const row of financeDetails) {
      map[row.dossier_id] = row
    }
    return map
  }, [financeDetails])

  const allRows = useMemo(() => {
    const rows = dossiers.map((dossier) => {
      const prestation = prestationByDossier[dossier.id] || {}
      const finance = financeByDossier[dossier.id] || {}
      const service = resolveOperationalService(dossier)
      const threshold = Number(slaThresholds[service] || DEFAULT_SLA_THRESHOLDS[service] || 3)
      const lastDate = finance.date_paiement || dossier.updated_at || dossier.created_at
      const staleDays = daysSinceDate(lastDate)
      const isActive = dossier.etat !== 'CLOTURE'

      return {
        ...dossier,
        service,
        serviceLabel: getServiceLabel(service),
        etatLabel: getEtatLabel(dossier.etat),
        agenceId: dossier.agences?.id ? String(dossier.agences.id) : 'NONE',
        agenceNom: dossier.agences?.nom || 'Non affectée',
        montant: prestation.montant,
        documentComplet: prestation.document_complet,
        quittanceSignee: prestation.quittance_signee,
        conformiteValidee: finance.conformite_validee,
        datePaiement: finance.date_paiement,
        lastDate,
        staleDays,
        isActive,
        slaThreshold: threshold,
        isSlaBreached: isActive && staleDays > threshold,
      }
    })

    rows.sort((a, b) => {
      if (b.staleDays !== a.staleDays) return b.staleDays - a.staleDays
      return new Date(a.lastDate).getTime() - new Date(b.lastDate).getTime()
    })

    return rows
  }, [dossiers, prestationByDossier, financeByDossier, slaThresholds])

  const agencyOptions = useMemo(() => {
    const map = new Map()

    for (const row of allRows) {
      if (!map.has(row.agenceId)) {
        map.set(row.agenceId, row.agenceNom)
      }
    }

    return Array.from(map.entries())
      .map(([id, nom]) => ({ id, nom }))
      .sort((a, b) => a.nom.localeCompare(b.nom))
  }, [allRows])

  const selectedAgencyLabel = useMemo(() => {
    if (agencyFilter === 'ALL') return 'Toutes agences'
    const found = agencyOptions.find((agency) => agency.id === agencyFilter)
    return found?.nom || 'Agence inconnue'
  }, [agencyFilter, agencyOptions])

  const selectedPeriod = useMemo(() => {
    return buildPeriodFromPreset(periodPreset, customStartDate, customEndDate)
  }, [periodPreset, customStartDate, customEndDate])

  const effectivePeriod = useMemo(() => {
    if (selectedPeriod.isValid) {
      return selectedPeriod
    }

    return {
      key: 'ALL',
      start: null,
      end: null,
      isValid: true,
      label: 'Toutes périodes',
    }
  }, [selectedPeriod])

  const agencyFilteredRows = useMemo(() => {
    if (agencyFilter === 'ALL') {
      return allRows
    }

    return allRows.filter((row) => row.agenceId === agencyFilter)
  }, [allRows, agencyFilter])

  const periodFilteredRows = useMemo(() => {
    return agencyFilteredRows.filter((row) => isDateInRange(row.lastDate, effectivePeriod))
  }, [agencyFilteredRows, effectivePeriod])

  const agencyDossierIds = useMemo(() => {
    return new Set(agencyFilteredRows.map((row) => row.id))
  }, [agencyFilteredRows])

  const periodActionCounts = useMemo(() => {
    const periodActions = actionHistory.filter((action) => {
      return agencyDossierIds.has(action.dossier_id) && isDateInRange(action.created_at, effectivePeriod)
    })

    return periodActions.reduce((acc, action) => {
      const key = action.action || 'AUTRE'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
  }, [actionHistory, agencyDossierIds, effectivePeriod])

  const dashboard = useMemo(() => {
    const activeRows = periodFilteredRows.filter((row) => row.isActive)
    const closedRows = periodFilteredRows.filter((row) => !row.isActive)

    const serviceBuckets = {
      RELATION_CLIENT: [],
      PRESTATION: [],
      FINANCE: [],
    }

    for (const row of activeRows) {
      serviceBuckets[row.service].push(row)
    }

    const blockedRows = activeRows.filter((row) => row.isSlaBreached)

    const globalKpis = {
      activeCount: activeRows.length,
      blockedCount: blockedRows.length,
      slaRate: computeSlaRate(activeRows, (row) => row.slaThreshold),
      averageAge: computeAverageAgeInDays(activeRows),
      closedCount: closedRows.length,
    }

    const rcRows = serviceBuckets.RELATION_CLIENT
    const prestationRows = serviceBuckets.PRESTATION
    const financeRows = serviceBuckets.FINANCE

    const financeMontantAttente = financeRows.reduce((sum, row) => {
      return sum + Number(row.montant || 0)
    }, 0)

    const serviceStats = {
      RELATION_CLIENT: {
        backlog: rcRows.length,
        enCours: rcRows.filter((row) => row.etat === 'EN_COURS').length,
        transfertsPeriode: periodActionCounts.ENVOI_PRESTATION || 0,
        averageAge: computeAverageAgeInDays(rcRows),
        slaRate: computeSlaRate(rcRows, (row) => row.slaThreshold),
        slaThreshold: slaThresholds.RELATION_CLIENT,
      },
      PRESTATION: {
        backlog: prestationRows.length,
        documentsIncomplets: prestationRows.filter((row) => row.documentComplet !== true).length,
        enInstance: prestationRows.filter((row) => row.etat === 'EN_INSTANCE').length,
        quittancesSignees: prestationRows.filter((row) => row.quittanceSignee === true).length,
        actionsPeriode: (periodActionCounts.PIECE_TRANSFEREE || 0) + (periodActionCounts.QUITTANCE_TRANSFEREE || 0),
        slaRate: computeSlaRate(prestationRows, (row) => row.slaThreshold),
        slaThreshold: slaThresholds.PRESTATION,
      },
      FINANCE: {
        backlog: financeRows.length,
        conformitesAValider: financeRows.filter((row) => row.conformiteValidee !== true).length,
        paiementsPrets: financeRows.filter((row) => {
          return row.conformiteValidee === true && row.quittanceSignee === true
        }).length,
        validationsPeriode: periodActionCounts.VALIDATION_CONFORMITE || 0,
        paiementsPeriode: periodActionCounts.PAIEMENT_CONFIRME || 0,
        montantAttente: financeMontantAttente,
        slaRate: computeSlaRate(financeRows, (row) => row.slaThreshold),
        slaThreshold: slaThresholds.FINANCE,
      },
    }

    const flow = [
      { key: 'RELATION_CLIENT', label: 'Relation Client', count: rcRows.length },
      { key: 'PRESTATION', label: 'Prestation', count: prestationRows.length },
      { key: 'FINANCE', label: 'Finance', count: financeRows.length },
      { key: 'CLOTURE', label: 'Clôturés', count: closedRows.length },
    ]

    return {
      globalKpis,
      serviceStats,
      flow,
      activeRows,
      blockedRows,
      dossiersCount: periodFilteredRows.length,
    }
  }, [periodFilteredRows, periodActionCounts, slaThresholds])

  const filteredOperations = useMemo(() => {
    if (serviceFilter === 'ALL') {
      return dashboard.activeRows
    }

    return dashboard.activeRows.filter((row) => row.service === serviceFilter)
  }, [dashboard.activeRows, serviceFilter])

  const filteredBlockedRows = useMemo(() => {
    if (serviceFilter === 'ALL') {
      return dashboard.blockedRows
    }

    return dashboard.blockedRows.filter((row) => row.service === serviceFilter)
  }, [dashboard.blockedRows, serviceFilter])

  const trendRanges = useMemo(() => {
    const now = new Date()

    if (trendMode === 'DAY') {
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)

      return {
        label: 'vs hier',
        current: { start: startOfDay(now), end: now },
        previous: { start: startOfDay(yesterday), end: endOfDay(yesterday) },
      }
    }

    const currentStart = startOfDay(new Date(now.getTime() - (6 * 24 * 60 * 60 * 1000)))
    const previousEnd = new Date(currentStart.getTime() - 1)
    const previousStart = startOfDay(new Date(previousEnd.getTime() - (6 * 24 * 60 * 60 * 1000)))

    return {
      label: 'vs 7j précédents',
      current: { start: currentStart, end: now },
      previous: { start: previousStart, end: previousEnd },
    }
  }, [trendMode])

  const trendSnapshot = useMemo(() => {
    const computeMetricPack = (rows) => {
      const activeRows = rows.filter((row) => row.isActive)
      const closedRows = rows.filter((row) => !row.isActive)

      return {
        activeCount: activeRows.length,
        blockedCount: activeRows.filter((row) => row.isSlaBreached).length,
        slaRate: computeSlaRate(activeRows, (row) => row.slaThreshold),
        averageAge: computeAverageAgeInDays(activeRows),
        closedCount: closedRows.length,
      }
    }

    const currentRows = agencyFilteredRows.filter((row) => isDateInRange(row.lastDate, trendRanges.current))
    const previousRows = agencyFilteredRows.filter((row) => isDateInRange(row.lastDate, trendRanges.previous))

    const current = computeMetricPack(currentRows)
    const previous = computeMetricPack(previousRows)

    return {
      label: trendRanges.label,
      activeDelta: current.activeCount - previous.activeCount,
      blockedDelta: current.blockedCount - previous.blockedCount,
      slaDelta: current.slaRate - previous.slaRate,
      closedDelta: current.closedCount - previous.closedCount,
      ageDelta: current.averageAge - previous.averageAge,
    }
  }, [agencyFilteredRows, trendRanges])

  const kpiTrends = useMemo(() => {
    return {
      active: buildTrendDescriptor(trendSnapshot.activeDelta, trendSnapshot.label, { increaseIsGood: true }),
      blocked: buildTrendDescriptor(trendSnapshot.blockedDelta, trendSnapshot.label, { increaseIsGood: false }),
      sla: buildTrendDescriptor(trendSnapshot.slaDelta, trendSnapshot.label, {
        decimals: 1,
        suffix: ' pt',
        increaseIsGood: true,
      }),
      closed: buildTrendDescriptor(trendSnapshot.closedDelta, trendSnapshot.label, { increaseIsGood: true }),
      age: buildTrendDescriptor(trendSnapshot.ageDelta, trendSnapshot.label, {
        decimals: 1,
        suffix: ' j',
        increaseIsGood: false,
      }),
    }
  }, [trendSnapshot])

  const setRowBusy = (dossierId, actionName) => {
    setActionBusy((prev) => ({ ...prev, [dossierId]: actionName }))
  }

  const clearRowBusy = (dossierId) => {
    setActionBusy((prev) => {
      const next = { ...prev }
      delete next[dossierId]
      return next
    })
  }

  const logAdminAction = async (row, action, description) => {
    if (!user?.id) return

    try {
      await supabase
        .from('historique_actions')
        .insert([
          {
            dossier_id: row.id,
            user_id: user.id,
            action,
            description,
            old_status: row.etat,
            new_status: row.etat,
          }
        ])
    } catch (logError) {
      console.warn('[ServicesMonitoring] Impossible de logger action admin:', logError)
    }
  }

  const handleSendAlert = async (row, mode = 'RELANCE_ADMIN') => {
    const busyLabel = mode === 'ESCALADE_ADMIN' ? 'ESCALADE' : 'RELANCE'
    setRowBusy(row.id, busyLabel)

    try {
      const serviceRoles = getServiceRoles(row.service)
      const targetRoles = mode === 'ESCALADE_ADMIN'
        ? Array.from(new Set([...serviceRoles, 'ADMIN']))
        : serviceRoles

      if (targetRoles.length === 0) {
        toast.error('Aucun destinataire trouvé pour ce service.')
        return
      }

      const { data: recipients, error: recipientsError } = await supabase
        .from('users')
        .select('id, roles!inner(name)')
        .in('roles.name', targetRoles)

      if (recipientsError) throw recipientsError

      const recipientIds = Array.from(new Set((recipients || []).map((item) => item.id).filter(Boolean)))
      if (recipientIds.length === 0) {
        toast.error('Aucun utilisateur actif à notifier pour cette relance.')
        return
      }

      const title = mode === 'ESCALADE_ADMIN' ? 'Escalade admin' : 'Relance admin'
      const message = `${title}: dossier ${row.police_number || row.id} bloqué depuis ${row.staleDays} jours au service ${row.serviceLabel}.`

      const notifications = recipientIds.map((recipientId) => ({
        user_id: recipientId,
        dossier_id: row.id,
        type: mode,
        message,
        is_read: false,
        created_at: new Date().toISOString(),
      }))

      const { error: notifyError } = await supabase
        .from('notifications')
        .insert(notifications)

      if (notifyError) throw notifyError

      await logAdminAction(row, mode, message)

      toast.success(`${title} envoyée à ${recipientIds.length} utilisateur(s).`)
    } catch (err) {
      console.error('[ServicesMonitoring] Erreur alerte admin:', err)
      toast.error(`Erreur alerte: ${err.message}`)
    } finally {
      clearRowBusy(row.id)
    }
  }

  const handleMarkUrgent = async (row) => {
    setRowBusy(row.id, 'URGENT')

    try {
      const { error: updateError } = await supabase
        .from('dossiers')
        .update({ is_urgent: true })
        .eq('id', row.id)

      if (updateError) throw updateError

      setDossiers((prev) => {
        return prev.map((item) => {
          if (item.id !== row.id) return item
          return { ...item, is_urgent: true }
        })
      })

      await logAdminAction(
        row,
        'MARQUER_URGENT',
        `Dossier ${row.police_number || row.id} marqué prioritaire par un administrateur.`
      )

      toast.success('Dossier marqué comme prioritaire.')
    } catch (err) {
      console.error('[ServicesMonitoring] Erreur marquage prioritaire:', err)

      if (String(err.message || '').toLowerCase().includes('is_urgent')) {
        toast.error("La colonne is_urgent n'existe pas encore en base. Lance la migration SQL.")
      } else {
        toast.error(`Erreur priorité: ${err.message}`)
      }
    } finally {
      clearRowBusy(row.id)
    }
  }

  const handleSlaThresholdChange = (service, value) => {
    setSlaThresholds((prev) => ({
      ...prev,
      [service]: clampThreshold(value),
    }))
  }

  const exportKpisCsv = async () => {
    setExporting(true)

    try {
      const headers = [
        { key: 'indicateur', label: 'Indicateur' },
        { key: 'valeur', label: 'Valeur' },
        { key: 'periode', label: 'Période' },
        { key: 'agence', label: 'Agence' },
      ]

      const rows = [
        { indicateur: 'Dossiers actifs', valeur: dashboard.globalKpis.activeCount, periode: effectivePeriod.label, agence: selectedAgencyLabel },
        { indicateur: 'Dossiers bloqués', valeur: dashboard.globalKpis.blockedCount, periode: effectivePeriod.label, agence: selectedAgencyLabel },
        { indicateur: 'SLA global', valeur: `${dashboard.globalKpis.slaRate.toFixed(1)}%`, periode: effectivePeriod.label, agence: selectedAgencyLabel },
        { indicateur: 'Clôtures période', valeur: dashboard.globalKpis.closedCount, periode: effectivePeriod.label, agence: selectedAgencyLabel },
        { indicateur: 'Âge moyen actif', valeur: `${dashboard.globalKpis.averageAge.toFixed(1)} jours`, periode: effectivePeriod.label, agence: selectedAgencyLabel },
        { indicateur: 'SLA RC', valeur: `${dashboard.serviceStats.RELATION_CLIENT.slaRate.toFixed(1)}% (seuil ${dashboard.serviceStats.RELATION_CLIENT.slaThreshold}j)`, periode: effectivePeriod.label, agence: selectedAgencyLabel },
        { indicateur: 'SLA Prestation', valeur: `${dashboard.serviceStats.PRESTATION.slaRate.toFixed(1)}% (seuil ${dashboard.serviceStats.PRESTATION.slaThreshold}j)`, periode: effectivePeriod.label, agence: selectedAgencyLabel },
        { indicateur: 'SLA Finance', valeur: `${dashboard.serviceStats.FINANCE.slaRate.toFixed(1)}% (seuil ${dashboard.serviceStats.FINANCE.slaThreshold}j)`, periode: effectivePeriod.label, agence: selectedAgencyLabel },
      ]

      const csv = buildCsv(headers, rows)
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      downloadCsvFile(`reporting-kpi-${stamp}.csv`, csv)
      toast.success('Export KPI généré.')
    } finally {
      setExporting(false)
    }
  }

  const exportOperationsCsv = async () => {
    setExporting(true)

    try {
      const headers = [
        { key: 'souscripteur', label: 'Souscripteur' },
        { key: 'police', label: 'N° Police' },
        { key: 'service', label: 'Service' },
        { key: 'etat', label: 'État' },
        { key: 'agence', label: 'Agence' },
        { key: 'docComplet', label: 'Document complet' },
        { key: 'quittanceSignee', label: 'Quittance signée' },
        { key: 'conformiteValidee', label: 'Conformité validée' },
        { key: 'montant', label: 'Montant' },
        { key: 'derniereMaj', label: 'Dernière MAJ' },
        { key: 'ageJours', label: 'Âge (jours)' },
        { key: 'slaService', label: 'Seuil SLA (jours)' },
        { key: 'isUrgent', label: 'Prioritaire' },
      ]

      const rows = filteredOperations.map((row) => ({
        souscripteur: row.souscripteur || 'N/A',
        police: row.police_number || '-',
        service: row.serviceLabel,
        etat: row.etatLabel,
        agence: row.agenceNom,
        docComplet: row.documentComplet === true ? 'Oui' : row.documentComplet === false ? 'Non' : 'N/A',
        quittanceSignee: row.quittanceSignee === true ? 'Oui' : row.quittanceSignee === false ? 'Non' : 'N/A',
        conformiteValidee: row.conformiteValidee === true ? 'Oui' : row.conformiteValidee === false ? 'Non' : 'N/A',
        montant: row.montant || row.montant === 0 ? formatMontant(row.montant) : '-',
        derniereMaj: formatDate(row.lastDate),
        ageJours: row.staleDays,
        slaService: row.slaThreshold,
        isUrgent: row.is_urgent ? 'Oui' : 'Non',
      }))

      const csv = buildCsv(headers, rows)
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      downloadCsvFile(`reporting-dossiers-${stamp}.csv`, csv)
      toast.success('Export dossiers généré.')
    } finally {
      setExporting(false)
    }
  }

  const exportBlockedCsv = async () => {
    setExporting(true)

    try {
      const headers = [
        { key: 'souscripteur', label: 'Souscripteur' },
        { key: 'police', label: 'N° Police' },
        { key: 'service', label: 'Service' },
        { key: 'etat', label: 'État' },
        { key: 'agence', label: 'Agence' },
        { key: 'ageJours', label: 'Ancienneté (jours)' },
        { key: 'slaService', label: 'Seuil SLA (jours)' },
        { key: 'prioritaire', label: 'Prioritaire' },
        { key: 'action', label: 'Action recommandée' },
      ]

      const rows = filteredBlockedRows.map((row) => ({
        souscripteur: row.souscripteur || 'N/A',
        police: row.police_number || '-',
        service: row.serviceLabel,
        etat: row.etatLabel,
        agence: row.agenceNom,
        ageJours: row.staleDays,
        slaService: row.slaThreshold,
        prioritaire: row.is_urgent ? 'Oui' : 'Non',
        action: row.is_urgent ? 'Escalade admin' : 'Relance ou marquage prioritaire',
      }))

      const csv = buildCsv(headers, rows)
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      downloadCsvFile(`reporting-bloques-${stamp}.csv`, csv)
      toast.success('Export dossiers bloqués généré.')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-comar-navy mb-4"></div>
              <p className="text-gray-600">Chargement du dashboard de supervision...</p>
            </div>
          </div>
        </div>
      </AdminLayout>
    )
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="p-6">
          <div className="bg-white rounded-xl border border-comar-neutral-border p-8 text-center">
            <h2 className="text-2xl font-bold text-comar-navy mb-2">Erreur de chargement</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => fetchDashboardData()}
              className="bg-comar-navy text-white px-6 py-3 rounded-xl hover:bg-comar-navy-light transition"
            >
              Réessayer
            </button>
          </div>
        </div>
      </AdminLayout>
    )
  }

  const flowBase = Math.max(1, dashboard.flow.reduce((sum, step) => sum + step.count, 0))

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-comar-navy">Supervision Opérationnelle</h1>
            <p className="text-gray-600 mt-1">
              Vue consolidée Relation Client, Prestation et Finance ({dashboard.dossiersCount} dossiers dans le périmètre filtré)
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-gray-500 font-medium">
              {refreshing ? 'Mise à jour en cours...' : 'Données à jour'}
            </span>
            <button
              onClick={() => fetchDashboardData({ silent: true })}
              className="bg-comar-navy text-white px-4 py-2 rounded-lg hover:bg-comar-navy-light transition font-semibold text-sm"
            >
              Actualiser
            </button>
            <button
              onClick={exportKpisCsv}
              disabled={exporting}
              className="bg-sky-600 text-white px-3 py-2 rounded-lg hover:bg-sky-700 transition text-xs font-semibold disabled:opacity-50"
            >
              Export KPI
            </button>
            <button
              onClick={exportOperationsCsv}
              disabled={exporting}
              className="bg-emerald-600 text-white px-3 py-2 rounded-lg hover:bg-emerald-700 transition text-xs font-semibold disabled:opacity-50"
            >
              Export dossiers
            </button>
            <button
              onClick={exportBlockedCsv}
              disabled={exporting}
              className="bg-amber-600 text-white px-3 py-2 rounded-lg hover:bg-amber-700 transition text-xs font-semibold disabled:opacity-50"
            >
              Export bloqués
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-comar-neutral-border p-5 space-y-4">
          <h2 className="text-lg font-bold text-comar-navy">Filtres et Comparaison</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">
                Période
              </label>
              <select
                value={periodPreset}
                onChange={(event) => setPeriodPreset(event.target.value)}
                className="w-full px-3 py-2 border border-comar-neutral-border rounded-lg text-sm"
              >
                {PERIOD_PRESETS.map((preset) => (
                  <option key={preset.key} value={preset.key}>{preset.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">
                Agence
              </label>
              <select
                value={agencyFilter}
                onChange={(event) => setAgencyFilter(event.target.value)}
                className="w-full px-3 py-2 border border-comar-neutral-border rounded-lg text-sm"
              >
                <option value="ALL">Toutes les agences</option>
                {agencyOptions.map((agency) => (
                  <option key={agency.id} value={agency.id}>{agency.nom}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">
                Tendance KPI
              </label>
              <select
                value={trendMode}
                onChange={(event) => setTrendMode(event.target.value)}
                className="w-full px-3 py-2 border border-comar-neutral-border rounded-lg text-sm"
              >
                {TREND_MODES.map((mode) => (
                  <option key={mode.key} value={mode.key}>{mode.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">
                Service (tableau)
              </label>
              <select
                value={serviceFilter}
                onChange={(event) => setServiceFilter(event.target.value)}
                className="w-full px-3 py-2 border border-comar-neutral-border rounded-lg text-sm"
              >
                {SERVICE_FILTERS.map((filter) => (
                  <option key={filter.key} value={filter.key}>{filter.label}</option>
                ))}
              </select>
            </div>
          </div>

          {periodPreset === 'CUSTOM' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">
                  Date de début
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(event) => setCustomStartDate(event.target.value)}
                  className="w-full px-3 py-2 border border-comar-neutral-border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">
                  Date de fin
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(event) => setCustomEndDate(event.target.value)}
                  className="w-full px-3 py-2 border border-comar-neutral-border rounded-lg text-sm"
                />
              </div>
            </div>
          )}

          {!selectedPeriod.isValid && (
            <p className="text-xs text-comar-red font-semibold">
              Période personnalisée invalide: le dashboard bascule automatiquement sur toutes périodes.
            </p>
          )}

          <p className="text-xs text-gray-500">
            Périmètre actif: {effectivePeriod.label} - {selectedAgencyLabel}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-comar-neutral-border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-comar-navy">Paramètres SLA par service</h2>
            <p className="text-xs text-gray-500">Valeurs stockées localement (navigateur admin)</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">
                SLA Relation Client (jours)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={slaThresholds.RELATION_CLIENT}
                onChange={(event) => handleSlaThresholdChange('RELATION_CLIENT', event.target.value)}
                className="w-full px-3 py-2 border border-comar-neutral-border rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">
                SLA Prestation (jours)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={slaThresholds.PRESTATION}
                onChange={(event) => handleSlaThresholdChange('PRESTATION', event.target.value)}
                className="w-full px-3 py-2 border border-comar-neutral-border rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">
                SLA Finance (jours)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={slaThresholds.FINANCE}
                onChange={(event) => handleSlaThresholdChange('FINANCE', event.target.value)}
                className="w-full px-3 py-2 border border-comar-neutral-border rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <KpiCard
            title="Dossiers actifs"
            value={dashboard.globalKpis.activeCount}
            subtitle="Hors dossiers clôturés"
            trend={kpiTrends.active}
          />
          <KpiCard
            title="Dossiers bloqués"
            value={dashboard.globalKpis.blockedCount}
            subtitle="Au-delà des seuils SLA par service"
            valueClassName="text-amber-700"
            trend={kpiTrends.blocked}
          />
          <KpiCard
            title="SLA global"
            value={`${dashboard.globalKpis.slaRate.toFixed(1)}%`}
            subtitle="Conforme aux seuils SLA configurés"
            valueClassName={dashboard.globalKpis.slaRate >= 80 ? 'text-emerald-700' : 'text-comar-red'}
            trend={kpiTrends.sla}
          />
          <KpiCard
            title="Clôtures période"
            value={dashboard.globalKpis.closedCount}
            subtitle={effectivePeriod.label}
            valueClassName="text-sky-700"
            trend={kpiTrends.closed}
          />
          <KpiCard
            title="Âge moyen actif"
            value={`${dashboard.globalKpis.averageAge.toFixed(1)} j`}
            subtitle="Depuis la dernière mise à jour"
            valueClassName="text-violet-700"
            trend={kpiTrends.age}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-comar-neutral-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-comar-navy">Service Relation Client</h2>
              <span className="text-xs text-gray-500">SLA: {dashboard.serviceStats.RELATION_CLIENT.slaThreshold} j</span>
            </div>
            <div className="space-y-2">
              <ServiceStat label="Backlog" value={dashboard.serviceStats.RELATION_CLIENT.backlog} />
              <ServiceStat label="En cours" value={dashboard.serviceStats.RELATION_CLIENT.enCours} />
              <ServiceStat label="Transferts période" value={dashboard.serviceStats.RELATION_CLIENT.transfertsPeriode} tone="text-emerald-700" />
              <ServiceStat label="Âge moyen" value={`${dashboard.serviceStats.RELATION_CLIENT.averageAge.toFixed(1)} j`} />
              <ServiceStat
                label="SLA"
                value={`${dashboard.serviceStats.RELATION_CLIENT.slaRate.toFixed(1)}%`}
                tone={dashboard.serviceStats.RELATION_CLIENT.slaRate >= 80 ? 'text-emerald-700' : 'text-comar-red'}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-comar-neutral-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-comar-navy">Service Prestation</h2>
              <span className="text-xs text-gray-500">SLA: {dashboard.serviceStats.PRESTATION.slaThreshold} j</span>
            </div>
            <div className="space-y-2">
              <ServiceStat label="Backlog" value={dashboard.serviceStats.PRESTATION.backlog} />
              <ServiceStat label="Documents incomplets" value={dashboard.serviceStats.PRESTATION.documentsIncomplets} tone="text-comar-red" />
              <ServiceStat label="En instance" value={dashboard.serviceStats.PRESTATION.enInstance} tone="text-amber-700" />
              <ServiceStat label="Quittances signées" value={dashboard.serviceStats.PRESTATION.quittancesSignees} tone="text-emerald-700" />
              <ServiceStat label="Actions période" value={dashboard.serviceStats.PRESTATION.actionsPeriode} />
              <ServiceStat
                label="SLA"
                value={`${dashboard.serviceStats.PRESTATION.slaRate.toFixed(1)}%`}
                tone={dashboard.serviceStats.PRESTATION.slaRate >= 80 ? 'text-emerald-700' : 'text-comar-red'}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-comar-neutral-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-comar-navy">Service Finance</h2>
              <span className="text-xs text-gray-500">SLA: {dashboard.serviceStats.FINANCE.slaThreshold} j</span>
            </div>
            <div className="space-y-2">
              <ServiceStat label="Backlog" value={dashboard.serviceStats.FINANCE.backlog} />
              <ServiceStat label="Conformités à valider" value={dashboard.serviceStats.FINANCE.conformitesAValider} tone="text-comar-red" />
              <ServiceStat label="Paiements prêts" value={dashboard.serviceStats.FINANCE.paiementsPrets} tone="text-emerald-700" />
              <ServiceStat label="Validations période" value={dashboard.serviceStats.FINANCE.validationsPeriode} />
              <ServiceStat label="Paiements période" value={dashboard.serviceStats.FINANCE.paiementsPeriode} />
              <ServiceStat label="Montant en attente" value={formatMontant(dashboard.serviceStats.FINANCE.montantAttente)} />
              <ServiceStat
                label="SLA"
                value={`${dashboard.serviceStats.FINANCE.slaRate.toFixed(1)}%`}
                tone={dashboard.serviceStats.FINANCE.slaRate >= 80 ? 'text-emerald-700' : 'text-comar-red'}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-comar-neutral-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-comar-navy">Flux Inter-services</h2>
            <p className="text-xs text-gray-500">Répartition actuelle des dossiers dans la période</p>
          </div>

          <div className="space-y-3">
            {dashboard.flow.map((step) => {
              const percent = (step.count / flowBase) * 100
              return (
                <div key={step.key}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{step.label}</span>
                    <span className="font-semibold text-comar-navy">{step.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-comar-neutral-bg overflow-hidden">
                    <div
                      className="h-2 rounded-full bg-comar-navy"
                      style={{ width: `${Math.max(percent, 3)}%` }}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-comar-neutral-border overflow-hidden">
          <div className="px-5 py-4 border-b border-comar-neutral-border">
            <h2 className="text-lg font-bold text-comar-navy">Dossiers Bloqués</h2>
            <p className="text-sm text-gray-500">Alertes actionnables pour les dossiers au-delà du SLA service</p>
          </div>

          {filteredBlockedRows.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">
              Aucun dossier bloqué sur le périmètre sélectionné.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-comar-neutral-border">
                <thead className="bg-comar-navy">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">Souscripteur</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">N° Police</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">Service</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">État</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">Ancienneté</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">SLA service</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">Priorité</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-comar-neutral-border">
                  {filteredBlockedRows.slice(0, 20).map((row) => {
                    const busyLabel = actionBusy[row.id]
                    const isBusy = Boolean(busyLabel)

                    return (
                      <tr key={row.id} className="hover:bg-comar-navy-50/30">
                        <td className="px-4 py-3 text-sm font-semibold text-comar-navy whitespace-nowrap">{row.souscripteur || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap font-mono">{row.police_number || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{row.serviceLabel}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{row.etatLabel}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full ${row.staleDays > (row.slaThreshold + 4) ? 'bg-comar-red/10 text-comar-red' : 'bg-amber-50 text-amber-700'}`}>
                            {row.staleDays} jours
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{row.slaThreshold} jours</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {row.is_urgent ? (
                            <span className="px-2 py-1 inline-flex text-xs font-semibold rounded-full bg-comar-red/10 text-comar-red">
                              Prioritaire
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">Standard</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSendAlert(row, 'RELANCE_ADMIN')}
                              disabled={isBusy}
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-40"
                            >
                              {busyLabel === 'RELANCE' ? 'Relance...' : 'Relancer'}
                            </button>
                            <button
                              onClick={() => handleSendAlert(row, 'ESCALADE_ADMIN')}
                              disabled={isBusy}
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-40"
                            >
                              {busyLabel === 'ESCALADE' ? 'Escalade...' : 'Escalader'}
                            </button>
                            <button
                              onClick={() => handleMarkUrgent(row)}
                              disabled={isBusy || row.is_urgent}
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-comar-red text-white hover:bg-comar-red-light disabled:opacity-40"
                            >
                              {busyLabel === 'URGENT' ? 'Maj...' : 'Prioritaire'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-comar-neutral-border overflow-hidden">
          <div className="px-5 py-4 border-b border-comar-neutral-border flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-comar-navy">Vue Dossiers Opérationnels</h2>
              <p className="text-sm text-gray-500">Suivi détaillé par service, SLA et âge dossier</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {SERVICE_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setServiceFilter(filter.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    serviceFilter === filter.key
                      ? 'bg-comar-navy text-white'
                      : 'bg-comar-neutral-bg text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {filteredOperations.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">
              Aucun dossier actif pour ce filtre.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-comar-neutral-border">
                <thead className="bg-comar-navy">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">Souscripteur</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">Service</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">État</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">Doc complet</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">Quittance</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">Conformité</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">Montant</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">Dernière MAJ</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">Âge</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">SLA</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">Priorité</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-comar-neutral-border">
                  {filteredOperations.slice(0, 40).map((row) => (
                    <tr key={row.id} className="hover:bg-comar-navy-50/30">
                      <td className="px-4 py-3 text-sm font-semibold text-comar-navy whitespace-nowrap">{row.souscripteur || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{row.serviceLabel}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{row.etatLabel}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{boolBadge(row.documentComplet)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{boolBadge(row.quittanceSignee)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{boolBadge(row.conformiteValidee)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {row.montant || row.montant === 0 ? formatMontant(row.montant) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(row.lastDate)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full ${row.isSlaBreached ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {row.staleDays} j
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{row.slaThreshold} j</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.is_urgent ? (
                          <span className="px-2 py-1 inline-flex text-xs font-semibold rounded-full bg-comar-red/10 text-comar-red">
                            Prioritaire
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
