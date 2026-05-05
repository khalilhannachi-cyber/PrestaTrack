import { useState, useEffect, useMemo } from 'react'

import { supabase } from '../../lib/supabaseClient'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, Legend, ComposedChart, Line
} from 'recharts'
import { AlertTriangle, TrendingUp, Clock, FileText, CheckCircle, Activity, Zap } from 'lucide-react'

export default function PerformanceAnalytics() {
  const [dossiers, setDossiers] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Periode
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    fetchData()
  }, [startDate, endDate])

  const fetchData = async () => {
    try {
      setLoading(true)
      let queryDossiers = supabase.from('dossiers').select('id, etat, niveau, created_at, updated_at')
      if (startDate) queryDossiers = queryDossiers.gte('created_at', startDate)
      if (endDate) queryDossiers = queryDossiers.lte('created_at', endDate + 'T23:59:59')
      
      const { data: dossiersData } = await queryDossiers

      let queryLogs = supabase.from('historique_actions').select('id, action, created_at, dossier_id, users ( email )').order('created_at', { ascending: false })
      if (startDate) queryLogs = queryLogs.gte('created_at', startDate)
      if (endDate) queryLogs = queryLogs.lte('created_at', endDate + 'T23:59:59')
      
      const { data: logsData } = await queryLogs

      setDossiers(dossiersData || [])
      setAuditLogs(logsData || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  // CORE ANALYTICS COMPUTATION
  const { serviceStats, globalSLA, prescriptiveActions, volumeTimeline, bottleneckData } = useMemo(() => {
    const stats = {
      RELATION_CLIENT: { name: 'Relation Client', backlog: 0, processed: 0, daysTotal: 0, rejets: 0, color: '#003366', icon: FileText },
      PRESTATION: { name: 'Prestation', backlog: 0, processed: 0, daysTotal: 0, rejets: 0, color: '#e60000', icon: Activity },
      FINANCE: { name: 'Finance', backlog: 0, processed: 0, daysTotal: 0, rejets: 0, color: '#64748b', icon: Clock }
    }

    let slaMet = 0
    let totalProcessed = 0
    const timeline = {}

    dossiers.forEach(d => {
      const svc = d.niveau || 'RELATION_CLIENT'
      if (!stats[svc]) return

      // Timeline logic
      const date = new Date(d.created_at).toLocaleDateString('fr-FR')
      if (!timeline[date]) timeline[date] = { date, Entrants: 0, Cloturés: 0 }
      timeline[date].Entrants++

      // Status logic
      if (d.etat !== 'CLOTURE' && d.etat !== 'ANNULE') {
        stats[svc].backlog++
      } else if (d.etat === 'CLOTURE') {
        timeline[new Date(d.updated_at).toLocaleDateString('fr-FR')] = timeline[new Date(d.updated_at).toLocaleDateString('fr-FR')] || { date: new Date(d.updated_at).toLocaleDateString('fr-FR'), Entrants: 0, Cloturés: 0 }
        timeline[new Date(d.updated_at).toLocaleDateString('fr-FR')].Cloturés++

        stats[svc].processed++
        totalProcessed++
        const days = (new Date(d.updated_at) - new Date(d.created_at)) / (1000 * 60 * 60 * 24)
        stats[svc].daysTotal += days
        if (days <= 5) slaMet++ // SLA objective: 5 days max
      }
    })

    auditLogs.forEach(log => {
      if (log.action.toUpperCase().includes('REJET')) {
        const d = dossiers.find(x => x.id === log.dossier_id)
        if (d && stats[d.niveau]) {
          stats[d.niveau].rejets++
        }
      }
    })

    const actions = []
    
    // --- 1. Alertes de Goulot et Délai ---
    if (stats.PRESTATION.backlog >= 1 || stats.FINANCE.backlog >= 1) {
      actions.push({
        type: 'critical',
        target: 'PRESTATION / FINANCE',
        action: 'Réaffectation immédiate requise',
        detail: `Le goulot d'étranglement est critique (${stats.PRESTATION.backlog} dossiers en retard en Prestation, ${stats.FINANCE.backlog} en Finance). Il est recommandé de transférer temporairement des gestionnaires de la RC pour résorber le flux.`
      })
    }

    const finAvg = stats.FINANCE.processed ? (stats.FINANCE.daysTotal / stats.FINANCE.processed) : 0
    if (finAvg > 0) {
      actions.push({
        type: 'warning',
        target: 'FINANCE',
        action: 'Optimisation du circuit de signature',
        detail: `Le temps moyen de paiement atteint ${finAvg.toFixed(1)} jours. Une relance automatique des valideurs financiers doit être activée pour éviter des pénalités de retard.`
      })
    }

    if (stats.RELATION_CLIENT.rejets >= 0 && stats.RELATION_CLIENT.processed > 0) {
      actions.push({
        type: 'danger',
        target: 'QUALITÉ',
        action: 'Refonte du Guide de Contrôle',
        detail: `Attention au taux de rejet actuel. Une mise à jour du guide de contrôle de la Relation Client s'impose d'urgence.`
      })
    }

    const timelineArr = Object.values(timeline).sort((a, b) => new Date(a.date.split('/').reverse().join('-')) - new Date(b.date.split('/').reverse().join('-')))

    // --- 2. Analyse de Tendance (Prédiction de Dégradation SLA) ---
    if (timelineArr.length >= 1) {
      const recent = timelineArr.slice(-3)
      const isOverloaded = recent.some(d => d.Entrants >= d.Cloturés)
      if (isOverloaded) {
        actions.push({
          type: 'critical',
          target: 'CAPACITÉ',
          action: 'Alerte Surcharge Structurelle',
          detail: `Le flux entrant dépasse ou égale la capacité de clôture récemment. Le SLA global va chuter. Recommandation: Autoriser des heures supplémentaires ce weekend.`
        })
      }
    }

    // --- 3. Détection de Sous-performance / Risque Réseau (Agences) ---
    const agencyRejects = {}
    auditLogs.forEach(log => {
      if (log.action.toUpperCase().includes('REJET')) {
        const d = dossiers.find(x => x.id === log.dossier_id)
        if (d && d.agence_id) {
           agencyRejects[d.agence_id] = (agencyRejects[d.agence_id] || 0) + 1
        }
      }
    })
    const worstAgency = Object.entries(agencyRejects).sort((a,b) => b[1] - a[1])[0]
    if (worstAgency && worstAgency[1] >= 1) {
      actions.push({
        type: 'danger',
        target: 'RÉSEAU',
        action: 'Recyclage Procédural',
        detail: `L'agence (ID: ${worstAgency[0].substring(0,8)}) génère une volumétrie de rejets (${worstAgency[1]}). Recommandation: Organiser un audit flash ou une formation ciblée.`
      })
    }

    // --- 4. Identification des Talents (RH) ---
    const userStats = {}
    auditLogs.forEach(log => {
      const u = log.users?.email || 'Système'
      if (u !== 'Système') userStats[u] = (userStats[u] || 0) + 1
    })
    const activeUsers = Object.entries(userStats).sort((a,b) => b[1] - a[1])
    if (activeUsers.length >= 1 && activeUsers[0][1] >= 1) {
      const topAgent = activeUsers[0]
      actions.push({
        type: 'success',
        target: 'RESSOURCES',
        action: 'Reconnaissance Performance',
        detail: `L'agent ${topAgent[0].split('@')[0]} est particulièrement actif (${topAgent[1]} actions). Recommandation: Envisager une prime de performance pour éviter l'épuisement (burnout).`
      })
    }

    if (actions.length === 0) {
      actions.push({
        type: 'success',
        target: 'GLOBAL',
        action: 'Flux stabilisés',
        detail: `La vélocité des trois services est optimale. Les SLA sont respectés et aucun goulot d'étranglement n'est détecté sur la période.`
      })
    }

    const bData = Object.keys(stats).map(key => ({
      name: stats[key].name,
      'Temps Moyen (Jours)': stats[key].processed > 0 ? parseFloat((stats[key].daysTotal / stats[key].processed).toFixed(1)) : 0,
      'Dossiers en Attente': stats[key].backlog
    }))

    
    // Prédictions simples sur 5 jours (basé sur la moyenne mobile)
    if (timelineArr.length >= 3) {
      const last3 = timelineArr.slice(-3)
      const avgEntrants = last3.reduce((acc, val) => acc + val.Entrants, 0) / 3
      const avgClotures = last3.reduce((acc, val) => acc + val.Cloturés, 0) / 3
      
      const lastDateStr = timelineArr[timelineArr.length-1].date
      const lastDate = new Date(lastDateStr.split('/').reverse().join('-'))
      
      for(let i=1; i<=5; i++) {
         const nextDate = new Date(lastDate)
         nextDate.setDate(nextDate.getDate() + i)
         timelineArr.push({
            date: nextDate.toLocaleDateString('fr-FR').slice(0,5) + ' (Prév)',
            EntrantsPrevision: Math.round(avgEntrants),
            CloturésPrevision: Math.round(avgClotures)
         })
      }
    }

    return { 
      serviceStats: stats, 
      globalSLA: totalProcessed ? Math.round((slaMet / totalProcessed) * 100) : 100,
      prescriptiveActions: actions,
      volumeTimeline: timelineArr,
      bottleneckData: bData
    }
  }, [dossiers, auditLogs])

  const handleExportCSV = () => {
    const headers = ['Service', 'Dossiers en Attente', 'Dossiers Traités', 'Temps Moyen (Jours)', 'Rejets']
    const rows = Object.values(serviceStats).map(s => 
      `"${s.name}","${s.backlog}","${s.processed}","${s.processed > 0 ? (s.daysTotal / s.processed).toFixed(1) : 0}","${s.rejets}"`
    )
    const csvContent = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `rapport_performance_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.csv`
    link.click()
  }

  if (loading) return (
    <div className="h-96 flex items-center justify-center">
      <div className="animate-spin h-10 w-10 border-4 border-comar-navy border-t-transparent rounded-full"></div>
    </div>
  )

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #pdf-analytics-content, #pdf-analytics-content * { visibility: visible; }
          #pdf-analytics-content { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div id="pdf-analytics-content" className="max-w-7xl mx-auto space-y-8">
        
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm no-print">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-comar-navy">Centre de Performance Opérationnelle</h1>
            <p className="text-gray-500 mt-1">Supervision de l'efficacité des services et recommandations d'actions</p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-xl border border-gray-100">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer text-comar-navy" />
              <span className="text-gray-400">→</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer text-comar-navy" />
              <button onClick={fetchData} className="p-2 bg-white rounded-lg shadow-sm hover:shadow text-comar-navy transition">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleExportCSV} className="px-4 py-2 bg-white text-comar-navy border border-comar-navy rounded-xl text-xs font-bold shadow-sm hover:bg-slate-50 transition">Exporter Stats (CSV)</button>
              <button onClick={() => window.print()} className="px-4 py-2 bg-comar-navy text-white rounded-xl text-xs font-bold shadow-sm hover:bg-blue-900 transition flex items-center gap-2">
                <FileText className="w-4 h-4" /> Imprimer / PDF
              </button>
            </div>
          </div>
        </div>

        {/* Action Center (Prescriptive Engine) */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
            <Zap className="text-comar-red w-6 h-6" /> Recommandations Opérationnelles (Live AI)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {prescriptiveActions.map((action, i) => (
              <div key={i} className={`p-6 rounded-3xl border transition-all hover:shadow-lg ${
                action.type === 'critical' ? 'bg-gradient-to-br from-red-50 to-white border-red-200' :
                action.type === 'danger' ? 'bg-gradient-to-br from-red-50 to-white border-red-200' :
                action.type === 'warning' ? 'bg-gradient-to-br from-slate-100 to-white border-slate-300' :
                'bg-gradient-to-br from-blue-50 to-white border-blue-200'
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                     action.type === 'critical' ? 'bg-comar-red text-white' :
                     action.type === 'danger' ? 'bg-comar-red text-white' :
                     action.type === 'warning' ? 'bg-slate-600 text-white' :
                     'bg-comar-navy text-white'
                  }`}>{action.target}</span>
                </div>
                <h3 className={`text-lg font-bold mb-2 ${
                  action.type === 'critical' ? 'text-comar-red' :
                  action.type === 'danger' ? 'text-comar-red' :
                  action.type === 'warning' ? 'text-slate-800' :
                  'text-comar-navy'
                }`}>{action.action}</h3>
                <p className={`text-sm leading-relaxed ${
                  action.type === 'critical' ? 'text-red-900' :
                  action.type === 'danger' ? 'text-red-900' :
                  action.type === 'warning' ? 'text-slate-700' :
                  'text-blue-900'
                }`}>{action.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Global SLA KPI */}
        <div className="bg-comar-navy rounded-3xl p-8 text-white relative overflow-hidden shadow-xl">
           <div className="absolute top-0 right-0 p-12 opacity-5">
              <Activity className="w-64 h-64" />
           </div>
           <div className="relative z-10 flex flex-col md:flex-row justify-between items-center">
              <div>
                 <p className="text-blue-200 font-medium uppercase tracking-widest text-sm mb-2">Respect du SLA Global (Objectif 5 Jours)</p>
                 <div className="flex items-baseline gap-4">
                    <h2 className="text-6xl font-black">{globalSLA}%</h2>
                    <span className="text-blue-200 text-lg">des dossiers livrés à temps</span>
                 </div>
              </div>
              <div className="mt-6 md:mt-0 bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 text-center">
                 <p className="text-3xl font-bold">{dossiers.filter(d => d.etat !== 'CLOTURE' && d.etat !== 'ANNULE').length}</p>
                 <p className="text-xs text-blue-200 uppercase tracking-widest mt-1">Dossiers en Attente Actifs</p>
              </div>
           </div>
        </div>

        {/* Services Performance Matrix */}
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800 mb-6">
            <Activity className="text-comar-navy w-6 h-6" /> Matrice de Performance par Service
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(serviceStats).map(([key, stat]) => {
              const avg = stat.processed > 0 ? (stat.daysTotal / stat.processed).toFixed(1) : 0
              const isBottleneck = stat.backlog > 10 || avg > 5
              
              return (
                <div key={key} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 relative group transition duration-300 hover:shadow-xl hover:border-blue-100">
                  <div className={`absolute top-0 left-0 w-full h-1.5 rounded-t-3xl`} style={{backgroundColor: stat.color}}></div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-gray-50" style={{color: stat.color}}>
                        <stat.icon className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-gray-900 text-lg">{stat.name}</h3>
                    </div>
                    {isBottleneck && <span className="bg-red-50 text-red-600 text-xs font-bold px-2 py-1 rounded-full animate-pulse">Attention</span>}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-2xl p-4">
                      <p className="text-xs text-gray-400 font-bold uppercase mb-1">Backlog Actuel</p>
                      <p className={`text-2xl font-black ${stat.backlog > 10 ? 'text-red-600' : 'text-gray-900'}`}>{stat.backlog}</p>
                    </div>
                    <div className="bg-gray-50 rounded-2xl p-4">
                      <p className="text-xs text-gray-400 font-bold uppercase mb-1">Délai Moyen</p>
                      <p className={`text-2xl font-black ${avg > 5 ? 'text-red-600' : 'text-gray-900'}`}>{avg} <span className="text-sm text-gray-400 font-medium">J</span></p>
                    </div>
                    <div className="col-span-2 bg-gray-50 rounded-2xl p-4 flex justify-between items-center">
                      <div>
                        <p className="text-xs text-gray-400 font-bold uppercase mb-1">Dossiers Clôturés</p>
                        <p className="text-lg font-black text-gray-900">{stat.processed}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400 font-bold uppercase mb-1">Taux de Rejet</p>
                        <p className="text-lg font-black text-comar-red">{stat.processed > 0 ? Math.round((stat.rejets/stat.processed)*100) : 0}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Visual Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <TrendingUp className="text-comar-navy w-5 h-5" /> Flux de Production (Entrants vs Clôturés)
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={volumeTimeline}>
                  <defs>
                    <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e60000" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#e60000" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#003366" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#003366" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                  <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'}} />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Area type="monotone" dataKey="Entrants" stroke="#e60000" strokeWidth={3} fillOpacity={1} fill="url(#colorIn)" />
                  <Area type="monotone" dataKey="Cloturés" stroke="#003366" strokeWidth={3} fillOpacity={1} fill="url(#colorOut)" />
                  <Line type="monotone" dataKey="EntrantsPrevision" stroke="#e60000" strokeDasharray="5 5" strokeWidth={2} dot={false} name="Prévision Entrants" />
                  <Line type="monotone" dataKey="CloturésPrevision" stroke="#003366" strokeDasharray="5 5" strokeWidth={2} dot={false} name="Prévision Clôturés" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-400 mt-4 text-center">Les lignes pointillées représentent les prévisions IA sur 5 jours basées sur les flux récents.</p>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <AlertTriangle className="text-comar-red w-5 h-5" /> Détection des Goulots d'Étranglement
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={bottleneckData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 'bold'}} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'}} />
                  <Legend verticalAlign="top" height={36} />
                  <Bar yAxisId="left" dataKey="Dossiers en Attente" barSize={40} fill="#f1f5f9" radius={[6, 6, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="Temps Moyen (Jours)" stroke="#e60000" strokeWidth={4} dot={{r: 6, fill: '#e60000', strokeWidth: 2, stroke: '#fff'}} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-400 mt-4 text-center">Compare la file d'attente brute avec le temps de traitement moyen pour cibler les blocages.</p>
          </div>
        </div>

      </div>
    </>
  )
}
