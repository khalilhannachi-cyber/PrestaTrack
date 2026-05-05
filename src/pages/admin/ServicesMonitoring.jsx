import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import AdminLayout from '../../components/AdminLayout'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import DossierTimeline from '../../components/DossierTimeline'
import PerformanceAnalytics from './PerformanceAnalytics'

const DEFAULT_SLA_THRESHOLDS = {
  RELATION_CLIENT: 3,
  PRESTATION: 3,
  FINANCE: 3,
}

const SLA_STORAGE_KEY = 'admin_sla_thresholds_v1'

const ACTION_HISTORY_DAYS = 180

const SERVICE_FILTERS = [
  { key: 'ALL', label: 'Tous les services' },
  { key: 'RELATION_CLIENT', label: 'Relation Client' },
  { key: 'PRESTATION', label: 'Prestation' },
  { key: 'FINANCE', label: 'Finance' },
]

const CANCELLATION_HELP_TEXT = 'Pour toute assistance, merci de contacter votre agence COMAR ou notre service support.'
const CANCELLED_STATUS = 'ANNULE'
const CANCELLED_STATUS_FALLBACK = 'CLOTURE'

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

function readStoredSlaThresholds() {
  try {
    if (typeof window === 'undefined') {
      return DEFAULT_SLA_THRESHOLDS
    }

    const stored = window.localStorage.getItem(SLA_STORAGE_KEY)
    if (!stored) {
      return DEFAULT_SLA_THRESHOLDS
    }

    const parsed = JSON.parse(stored)
    return {
      RELATION_CLIENT: clampThreshold(parsed.RELATION_CLIENT ?? DEFAULT_SLA_THRESHOLDS.RELATION_CLIENT),
      PRESTATION: clampThreshold(parsed.PRESTATION ?? DEFAULT_SLA_THRESHOLDS.PRESTATION),
      FINANCE: clampThreshold(parsed.FINANCE ?? DEFAULT_SLA_THRESHOLDS.FINANCE),
    }
  } catch (storageError) {
    console.warn('[ServicesMonitoring] Impossible de charger les SLA locaux:', storageError)
    return DEFAULT_SLA_THRESHOLDS
  }
}

function buildPeriodFromDates(customStartDate, customEndDate) {
  const hasStart = Boolean(customStartDate)
  const hasEnd = Boolean(customEndDate)

  if (!hasStart && !hasEnd) {
    return {
      key: 'ALL',
      start: null,
      end: null,
      isValid: true,
      label: 'Toutes périodes',
    }
  }

  const start = hasStart ? startOfDay(new Date(customStartDate)) : null
  const end = hasEnd ? endOfDay(new Date(customEndDate)) : null

  if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime())) || (start && end && start > end)) {
    return {
      key: 'CUSTOM',
      start: null,
      end: null,
      isValid: false,
      label: 'Intervalle de dates invalide',
    }
  }

  if (start && end) {
    return {
      key: 'CUSTOM',
      start,
      end,
      isValid: true,
      label: `Du ${start.toLocaleDateString('fr-FR')} au ${end.toLocaleDateString('fr-FR')}`,
    }
  }

  if (start) {
    return {
      key: 'CUSTOM',
      start,
      end: null,
      isValid: true,
      label: `Depuis le ${start.toLocaleDateString('fr-FR')}`,
    }
  }

  if (end) {
    return {
      key: 'CUSTOM',
      start: null,
      end,
      isValid: true,
      label: `Jusqu'au ${end.toLocaleDateString('fr-FR')}`,
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

function buildCancellationMessages(reference, reasonText) {
  const baseClient = `Nous vous prions de nous excuser: votre dossier ${reference} a été annulé par l'administration.`
  const baseService = `Annulation administrative du dossier ${reference}.`

  if (reasonText) {
    return {
      clientMessage: `${baseClient} Motif: ${reasonText}. ${CANCELLATION_HELP_TEXT}`,
      serviceMessage: `${baseService} Motif: ${reasonText}.`,
    }
  }

  return {
    clientMessage: `${baseClient} ${CANCELLATION_HELP_TEXT}`,
    serviceMessage: `${baseService}`,
  }
}

function isEtatCheckConstraintError(error) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes('dossiers_etat_check') || message.includes('violates check constraint')
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
  const [activeView, setActiveView] = useState('OPERATIONS') // 'OPERATIONS' or 'ANALYTICS'

  const [dossiers, setDossiers] = useState([])
  const [prestationDetails, setPrestationDetails] = useState([])
  const [financeDetails, setFinanceDetails] = useState([])
  const [actionHistory, setActionHistory] = useState([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)

  const [serviceFilter, setServiceFilter] = useState('ALL')
  const [agencyFilter, setAgencyFilter] = useState('ALL')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [trendMode, setTrendMode] = useState('DAY')

  const [actionBusy, setActionBusy] = useState({})
  const [openedDossierId, setOpenedDossierId] = useState(null)

  const [slaThresholds, setSlaThresholds] = useState(() => readStoredSlaThresholds())
  const [slaDraftThresholds, setSlaDraftThresholds] = useState(() => readStoredSlaThresholds())
  const [isEditingSla, setIsEditingSla] = useState(false)

  // Historique Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [selectedDossierHistory, setSelectedDossierHistory] = useState([])
  const [selectedDossierName, setSelectedDossierName] = useState('')

  useEffect(() => {
    if (!isEditingSla) {
      setSlaDraftThresholds(slaThresholds)
    }
  }, [isEditingSla, slaThresholds])

  useEffect(() => {
    try {
      localStorage.setItem(SLA_STORAGE_KEY, JSON.stringify(slaThresholds))
    } catch (storageError) {
      console.warn('[ServicesMonitoring] Impossible de sauvegarder les SLA locaux:', storageError)
    }
  }, [slaThresholds])

  const hasPendingSlaChanges =
    slaDraftThresholds.RELATION_CLIENT !== slaThresholds.RELATION_CLIENT ||
    slaDraftThresholds.PRESTATION !== slaThresholds.PRESTATION ||
    slaDraftThresholds.FINANCE !== slaThresholds.FINANCE

  const hasActiveFilters =
    agencyFilter !== 'ALL' ||
    serviceFilter !== 'ALL' ||
    Boolean(customStartDate) ||
    Boolean(customEndDate)

  const handleResetFilters = useCallback(() => {
    setAgencyFilter('ALL')
    setServiceFilter('ALL')
    setCustomStartDate('')
    setCustomEndDate('')
  }, [])

  const openHistory = async (row) => {
    setSelectedDossierName(row.souscripteur || row.police_number || row.id)
    setIsHistoryModalOpen(true)
    const { data, error } = await supabase
      .from('historique_actions')
      .select('*')
      .eq('dossier_id', row.id)
      .order('created_at', { ascending: false })
    
    if (!error) setSelectedDossierHistory(data || [])
  }

  const exportToCSV = () => {
    if (filteredOperations.length === 0) {
      toast.error('Aucune donnée à exporter.')
      return
    }
    const headers = ['Souscripteur', 'N° Police', 'Service', 'État', 'Doc Complet', 'Quittance', 'Conformité', 'Montant', 'Dernière MAJ', 'Âge', 'SLA', 'Priorité']
    const rows = filteredOperations.map(r => [
      `"${r.souscripteur || ''}"`,
      `"${r.police_number || ''}"`,
      `"${r.serviceLabel}"`,
      `"${r.etatLabel}"`,
      r.documentComplet ? 'Oui' : 'Non',
      r.quittanceSignee ? 'Oui' : 'Non',
      r.conformiteValidee ? 'Oui' : 'Non',
      r.montant || 0,
      `"${formatDate(r.lastDate)}"`,
      r.staleDays,
      r.slaThreshold,
      r.is_urgent ? 'Oui' : 'Non'
    ])
    
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `export_dossiers_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const fetchDashboardData = useCallback(async ({ silent = false } = {}) => {
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
        setLastUpdatedAt(new Date().toISOString())
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
      setLastUpdatedAt(new Date().toISOString())
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
  }, [])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchDashboardData({ silent: true })
    }, 60 * 1000)

    return () => {
      clearInterval(intervalId)
    }
  }, [fetchDashboardData])

  useEffect(() => {
    let refreshTimer = null

    const scheduleSilentRefresh = () => {
      if (refreshTimer) return

      refreshTimer = setTimeout(() => {
        refreshTimer = null
        fetchDashboardData({ silent: true })
      }, 800)
    }

    const channel = supabase
      .channel('admin-services-monitoring-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dossiers' }, scheduleSilentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dossier_details_prestation' }, scheduleSilentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dossier_details_finance' }, scheduleSilentRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'historique_actions' }, scheduleSilentRefresh)
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[ServicesMonitoring] Realtime indisponible, fallback sur auto-refresh.')
        }
      })

    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer)
        refreshTimer = null
      }
      supabase.removeChannel(channel)
    }
  }, [fetchDashboardData])

  const formattedLastUpdate = useMemo(() => {
    if (!lastUpdatedAt) return 'En attente de synchronisation...'

    try {
      return `Mis a jour le ${new Date(lastUpdatedAt).toLocaleString('fr-FR')}`
    } catch {
      return 'Mis a jour recemment'
    }
  }, [lastUpdatedAt])

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
      const isActive = dossier.etat !== 'CLOTURE' && dossier.etat !== 'ANNULE'

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

  const openedDossier = useMemo(() => {
    if (!openedDossierId) return null
    return allRows.find((row) => row.id === openedDossierId) || null
  }, [allRows, openedDossierId])

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
    return buildPeriodFromDates(customStartDate, customEndDate)
  }, [customStartDate, customEndDate])

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

  const logAdminAction = async (row, action, description, statusTransition = {}) => {
    if (!user?.id) return

    const oldStatus = statusTransition.oldStatus ?? row.etat
    const newStatus = statusTransition.newStatus ?? row.etat

    try {
      await supabase
        .from('historique_actions')
        .insert([
          {
            dossier_id: row.id,
            user_id: user.id,
            action,
            description,
            old_status: oldStatus,
            new_status: newStatus,
          }
        ])
    } catch (logError) {
      console.warn('[ServicesMonitoring] Impossible de logger action admin:', logError)
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

  const handleRemoveUrgent = async (row) => {
    setRowBusy(row.id, 'UNURGENT')

    try {
      const nowIso = new Date().toISOString()

      const { error: updateError } = await supabase
        .from('dossiers')
        .update({ is_urgent: false, updated_at: nowIso })
        .eq('id', row.id)

      if (updateError) throw updateError

      setDossiers((prev) => {
        return prev.map((item) => {
          if (item.id !== row.id) return item
          return { ...item, is_urgent: false, updated_at: nowIso }
        })
      })

      await logAdminAction(
        row,
        'RETIRER_URGENT',
        `Priorité retirée du dossier ${row.police_number || row.id} par un administrateur.`
      )

      toast.success('Priorité retirée du dossier.')
    } catch (err) {
      console.error('[ServicesMonitoring] Erreur retrait priorité:', err)

      if (String(err.message || '').toLowerCase().includes('is_urgent')) {
        toast.error("La colonne is_urgent n'existe pas encore en base. Lance la migration SQL.")
      } else {
        toast.error(`Erreur priorité: ${err.message}`)
      }
    } finally {
      clearRowBusy(row.id)
    }
  }

  const handleCancelDossier = async (row) => {
    const confirmed = window.confirm(`Confirmer l'annulation du dossier ${row.police_number || row.id} ?`)
    if (!confirmed) return

    const reason = window.prompt("Motif d'annulation (optionnel):", '')
    if (reason === null) return

    setRowBusy(row.id, 'ANNULATION')

    try {
      const nowIso = new Date().toISOString()
      const reasonText = reason.trim()
      const reference = row.police_number || row.id
      const { clientMessage, serviceMessage } = buildCancellationMessages(reference, reasonText)

      let persistedStatus = CANCELLED_STATUS
      let usedFallbackStatus = false

      let { error: updateError } = await supabase
        .from('dossiers')
        .update({
          etat: persistedStatus,
          is_urgent: false,
          updated_at: nowIso,
        })
        .eq('id', row.id)

      if (updateError && isEtatCheckConstraintError(updateError)) {
        persistedStatus = CANCELLED_STATUS_FALLBACK
        usedFallbackStatus = true

        const retryResult = await supabase
          .from('dossiers')
          .update({
            etat: persistedStatus,
            is_urgent: false,
            updated_at: nowIso,
          })
          .eq('id', row.id)

        updateError = retryResult.error
      }

      if (updateError) throw updateError

      setDossiers((prev) => {
        return prev.map((item) => {
          if (item.id !== row.id) return item
          return {
            ...item,
            etat: persistedStatus,
            is_urgent: false,
            updated_at: nowIso,
          }
        })
      })

      let notifiedUsersCount = 0
      const serviceRoles = getServiceRoles(row.service)

      if (serviceRoles.length > 0) {
        try {
          const { data: recipients, error: recipientsError } = await supabase
            .from('users')
            .select('id, roles!inner(name)')
            .in('roles.name', serviceRoles)

          if (recipientsError) throw recipientsError

          const recipientIds = Array.from(new Set((recipients || []).map((item) => item.id).filter(Boolean)))

          if (recipientIds.length > 0) {
            const notifications = recipientIds.map((recipientId) => ({
              user_id: recipientId,
              dossier_id: row.id,
              type: 'ANNULATION_DOSSIER',
              message: serviceMessage,
              is_read: false,
              created_at: nowIso,
            }))

            const { error: notifyError } = await supabase
              .from('notifications')
              .insert(notifications)

            if (notifyError) throw notifyError

            notifiedUsersCount = recipientIds.length
          }
        } catch (notifyError) {
          console.warn('[ServicesMonitoring] Notification service non envoyée:', notifyError)
        }
      }

      await logAdminAction(
        row,
        'ANNULATION_DOSSIER',
        clientMessage,
        { oldStatus: row.etat, newStatus: persistedStatus }
      )

      setOpenedDossierId((previousId) => (previousId === row.id ? null : previousId))

      if (notifiedUsersCount > 0) {
        toast.success(`Dossier annulé. Notification envoyée à ${notifiedUsersCount} utilisateur(s).`)
      } else if (usedFallbackStatus) {
        toast.success('Dossier annulé. Statut technique appliqué: Clôturé (contrainte base).')
      } else {
        toast.success('Dossier annulé avec succès.')
      }
    } catch (err) {
      console.error('[ServicesMonitoring] Erreur annulation dossier:', err)
      toast.error(`Erreur annulation: ${err.message}`)
    } finally {
      clearRowBusy(row.id)
    }
  }

  const handleOpenDossier = (row) => {
    setOpenedDossierId(row.id)
  }

  const handleSlaThresholdChange = (service, value) => {
    setSlaDraftThresholds((prev) => ({
      ...prev,
      [service]: clampThreshold(value),
    }))
  }

  const handleStartSlaEdit = () => {
    setSlaDraftThresholds(slaThresholds)
    setIsEditingSla(true)
  }

  const handleCancelSlaEdit = () => {
    setSlaDraftThresholds(slaThresholds)
    setIsEditingSla(false)
  }

  const handleConfirmSlaEdit = () => {
    const nextThresholds = {
      RELATION_CLIENT: clampThreshold(slaDraftThresholds.RELATION_CLIENT),
      PRESTATION: clampThreshold(slaDraftThresholds.PRESTATION),
      FINANCE: clampThreshold(slaDraftThresholds.FINANCE),
    }

    setSlaThresholds(nextThresholds)
    try {
      localStorage.setItem(SLA_STORAGE_KEY, JSON.stringify(nextThresholds))
    } catch (storageError) {
      console.warn('[ServicesMonitoring] Impossible de sauvegarder les SLA locaux:', storageError)
    }

    setIsEditingSla(false)
    toast.success('Seuils SLA mis à jour.')
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
            <h1 className="text-3xl font-bold text-comar-navy">Dashboard Administrateur</h1>
            <div className="mt-2 flex space-x-2 bg-gray-100 p-1 rounded-lg w-max mb-1">
              <button 
                onClick={() => setActiveView('OPERATIONS')} 
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition ${activeView === 'OPERATIONS' ? 'bg-white shadow-sm text-comar-navy' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Supervision Opérationnelle
              </button>
              <button 
                onClick={() => setActiveView('ANALYTICS')} 
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition flex items-center gap-2 ${activeView === 'ANALYTICS' ? 'bg-white shadow-sm text-comar-navy' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <svg className="w-4 h-4 text-comar-red" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                Analytique & IA
              </button>
            </div>
            {activeView === 'OPERATIONS' && (
              <p className="text-gray-600 mt-1">
                Vue consolidée Relation Client, Prestation et Finance ({dashboard.dossiersCount} dossiers dans le périmètre filtré)
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-gray-500 font-medium">
              {refreshing ? 'Mise a jour en cours...' : formattedLastUpdate}
            </span>
            <button
              onClick={() => fetchDashboardData({ silent: true })}
              className="bg-comar-navy text-white px-4 py-2 rounded-lg hover:bg-comar-navy-light transition font-semibold text-sm"
            >
              Actualiser
            </button>
          </div>
        </div>

        {activeView === 'ANALYTICS' ? (
          <div className="mt-4"><PerformanceAnalytics /></div>
        ) : (
        <>
        <div className="bg-white rounded-xl border border-comar-neutral-border p-5 space-y-4">
          <h2 className="text-lg font-bold text-comar-navy">Filtres et Comparaison</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

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

          <div className="flex justify-end">
            <button
              onClick={handleResetFilters}
              disabled={!hasActiveFilters}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-comar-neutral-border text-comar-navy hover:bg-comar-navy-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Réinitialiser les filtres
            </button>
          </div>

          {!selectedPeriod.isValid && (
            <p className="text-xs text-comar-red font-semibold">
              Intervalle de dates invalide: le dashboard bascule automatiquement sur toutes périodes.
            </p>
          )}

          <p className="text-xs text-gray-500">
            Périmètre actif: {effectivePeriod.label} - {selectedAgencyLabel}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-comar-neutral-border p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-lg font-bold text-comar-navy">Paramètres SLA par service</h2>
            <div className="flex items-center gap-2 flex-wrap sm:justify-end">
              <p className="text-xs text-gray-500">Valeurs stockées localement (navigateur admin)</p>

              {!isEditingSla ? (
                <button
                  onClick={handleStartSlaEdit}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-comar-neutral-border text-comar-navy hover:bg-comar-navy-50 transition"
                >
                  Modifier SLA
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCancelSlaEdit}
                    className="px-4 py-2 text-sm font-semibold rounded-lg border border-comar-neutral-border text-gray-600 hover:bg-gray-50 transition"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirmSlaEdit}
                    disabled={!hasPendingSlaChanges}
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-comar-navy text-white hover:bg-comar-navy-light disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Confirmer
                  </button>
                </>
              )}
            </div>
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
                value={isEditingSla ? slaDraftThresholds.RELATION_CLIENT : slaThresholds.RELATION_CLIENT}
                onChange={(event) => handleSlaThresholdChange('RELATION_CLIENT', event.target.value)}
                disabled={!isEditingSla}
                className="w-full px-3 py-2 border border-comar-neutral-border rounded-lg text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
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
                value={isEditingSla ? slaDraftThresholds.PRESTATION : slaThresholds.PRESTATION}
                onChange={(event) => handleSlaThresholdChange('PRESTATION', event.target.value)}
                disabled={!isEditingSla}
                className="w-full px-3 py-2 border border-comar-neutral-border rounded-lg text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
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
                value={isEditingSla ? slaDraftThresholds.FINANCE : slaThresholds.FINANCE}
                onChange={(event) => handleSlaThresholdChange('FINANCE', event.target.value)}
                disabled={!isEditingSla}
                className="w-full px-3 py-2 border border-comar-neutral-border rounded-lg text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
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
            title="Dossiers en retard"
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
            <h2 className="text-lg font-bold text-comar-navy">Dossiers en retard</h2>
            <p className="text-sm text-gray-500">Alertes actionnables pour les dossiers au-delà du SLA service</p>
          </div>

          {filteredBlockedRows.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">
              Aucun dossier en retard sur le périmètre sélectionné.
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => handleOpenDossier(row)}
                              disabled={isBusy}
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-comar-navy text-white hover:bg-comar-navy-light disabled:opacity-40"
                            >
                              Ouvrir dossier
                            </button>

                            {row.is_urgent ? (
                              <button
                                onClick={() => handleRemoveUrgent(row)}
                                disabled={isBusy}
                                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-40"
                              >
                                {busyLabel === 'UNURGENT' ? 'Maj...' : 'Retirer priorité'}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleMarkUrgent(row)}
                                disabled={isBusy}
                                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-comar-red text-white hover:bg-comar-red-light disabled:opacity-40"
                              >
                                {busyLabel === 'URGENT' ? 'Maj...' : 'Prioritaire'}
                              </button>
                            )}

                            <button
                              onClick={() => handleCancelDossier(row)}
                              disabled={isBusy || row.etat === 'ANNULE' || row.etat === 'CLOTURE'}
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-700 text-white hover:bg-amber-800 disabled:opacity-40"
                            >
                              {busyLabel === 'ANNULATION' ? 'Annulation...' : 'Annuler dossier'}
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
              <div className="h-6 w-px bg-gray-300 mx-1"></div>
              <button
                onClick={exportToCSV}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                Exporter CSV
              </button>
            </div>
          </div>

          {filteredOperations.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">
              Aucun dossier actif pour ce service.
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider">Actions</th>
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
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => openHistory(row)}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-gray-600 text-white hover:bg-gray-700 flex items-center gap-1 transition"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Historique
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {openedDossier && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-3xl rounded-xl border border-comar-neutral-border shadow-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-comar-neutral-border flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-comar-navy">Détails du dossier</h3>
                  <p className="text-xs text-gray-500">{openedDossier.police_number || openedDossier.id}</p>
                </div>
                <button
                  onClick={() => setOpenedDossierId(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-comar-neutral-bg text-gray-700 hover:bg-gray-200"
                >
                  Fermer
                </button>
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Souscripteur</p>
                  <p className="text-comar-navy font-semibold">{openedDossier.souscripteur || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Agence</p>
                  <p className="text-comar-navy">{openedDossier.agenceNom}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Service</p>
                  <p className="text-comar-navy">{openedDossier.serviceLabel}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">État</p>
                  <p className="text-comar-navy">{openedDossier.etatLabel}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Dernière mise à jour</p>
                  <p className="text-comar-navy">{formatDate(openedDossier.lastDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Ancienneté</p>
                  <p className="text-comar-navy">{openedDossier.staleDays} jours</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">SLA service</p>
                  <p className="text-comar-navy">{openedDossier.slaThreshold} jours</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Priorité</p>
                  <p className="text-comar-navy">{openedDossier.is_urgent ? 'Prioritaire' : 'Standard'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Document complet</p>
                  <div>{boolBadge(openedDossier.documentComplet)}</div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Quittance signée</p>
                  <div>{boolBadge(openedDossier.quittanceSignee)}</div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Conformité validée</p>
                  <div>{boolBadge(openedDossier.conformiteValidee)}</div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Montant</p>
                  <p className="text-comar-navy">{openedDossier.montant || openedDossier.montant === 0 ? formatMontant(openedDossier.montant) : '-'}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
      )}
      </div>

      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsHistoryModalOpen(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-comar-navy">
              <div>
                <h2 className="text-xl font-bold text-white">Historique du dossier</h2>
                <p className="text-white/70 text-xs mt-1">{selectedDossierName}</p>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="text-white/60 hover:text-white text-2xl">✕</button>
            </div>
            <div className="p-6 overflow-y-auto">
              <DossierTimeline history={selectedDossierHistory} />
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
