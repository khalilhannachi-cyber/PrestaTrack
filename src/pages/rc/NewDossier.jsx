import { toast } from 'react-hot-toast'
// React hooks pour la gestion d'état et effets
import { useState, useEffect } from 'react'
// Navigation programmatique
import { useNavigate } from 'react-router-dom'
// Client Supabase pour les requêtes DB
import { supabase } from '../../lib/supabaseClient'
// Hook pour accéder au contexte d'authentification
import { useAuth } from '../../contexts/AuthContext'
// Layout spécifique aux pages Relation Client
import RCLayout from '../../components/RCLayout'

const POLICE_NUMBER_REGEX = /^\d{8}-\d$/

/**
 * Page de création d'un nouveau dossier – Conformité Cahier des Charges
 *
 * Champs : Souscripteur* | Date réception bureau d'ordre (défaut aujourd'hui, modifiable) |
 *          Date envoi RC (auto aujourd'hui, lecture seule) | Téléphone | Agence* |
 *          N° Police* | Motif instance* | Demande initiale (select : R TOTAL / R Partiel / R ECHU / Transfert Contrat / AUTRE)
 *
 * Boutons : « Enregistrer » (sauvegarde, niveau = RELATION_CLIENT)
 *           « Envoyer » (sauvegarde + envoi Prestation, niveau = PRESTATION)
 */
export default function NewDossier() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [agences, setAgences] = useState([])
  const [loadingAgences, setLoadingAgences] = useState(true)
  const [file, setFile] = useState(null)

  const today = new Date().toISOString().split('T')[0]

  const [formData, setFormData] = useState({
    souscripteur: '',
    police_number: '',
    agence_id: '',
    telephone: '+216 ',
    demande_initiale: '',
    motif_instance: '',
    date_reception: today // Date réception bureau d'ordre – défaut aujourd'hui, modifiable
  })

  useEffect(() => {
    fetchAgences()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchAgences = async () => {
    try {
      const { data, error } = await supabase
        .from('agences')
        .select('id, nom, code')
        .order('nom', { ascending: true })
      if (error) throw error
      setAgences(data || [])
    } catch (error) {
      console.error(' Erreur lors du chargement des agences:', error)
      toast('Impossible de charger les agences. Réessayez.')
    } finally {
      setLoadingAgences(false)
    }
  }

  /**
   * Crée le dossier avec le niveau spécifié
   * @param {'RELATION_CLIENT'|'PRESTATION'} niveau
   */
  const handleSave = async (niveau) => {
    // Validation manuelle des champs requis
    if (!formData.souscripteur || !formData.police_number || !formData.agence_id || !formData.motif_instance) {
      toast.error("Veuillez remplir tous les champs obligatoires (*).")
      return
    }

    const normalizedPoliceNumber = formData.police_number.trim()
    if (!POLICE_NUMBER_REGEX.test(normalizedPoliceNumber)) {
      toast.error("Format numéro de police invalide. Format attendu: 12345678-9.")
      return
    }

    if (file && !['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) {
      toast.error("Format de fichier non autorisé. Seuls PDF, PNG et JPG sont acceptés.");
      return;
    }
    if (file && file.size > 5 * 1024 * 1024) {
      toast.error("Le fichier dépasse 5Mo.");
      return;
    }

    setLoading(true)
    try {
      let piece_justificative_url = null
      if (file) {
        toast('Téléchargement du fichier en cours...')
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('pieces_justificatives')
          .upload(fileName, file)
          
        if (uploadError) throw new Error(`Erreur upload fichier: ${uploadError.message}`)
        
        const { data: urlData } = supabase.storage
          .from('pieces_justificatives')
          .getPublicUrl(fileName)
          
        if (urlData) {
          piece_justificative_url = urlData.publicUrl
        }
      }

      // ÉTAPE 1 : Insertion dans la table 'dossiers'
      const { data: dossierData, error: dossierError } = await supabase
        .from('dossiers')
        .insert([{
          souscripteur: formData.souscripteur,
          police_number: normalizedPoliceNumber,
          agence_id: formData.agence_id || null,
          niveau,
          etat: 'EN_COURS',
          created_by: user.id,
          piece_justificative_url
        }])
        .select()

      if (dossierError) throw new Error(`Erreur création dossier: ${dossierError.message}`)
      if (!dossierData || dossierData.length === 0) throw new Error('Aucune donnée retournée')

      const dossierId = dossierData[0].id

      // ÉTAPE 2 : Insertion dans 'dossier_details_rc'
      const { error: detailsError } = await supabase
        .from('dossier_details_rc')
        .insert([{
          dossier_id: dossierId,
          telephone: formData.telephone,
          demande_initiale: formData.demande_initiale,
          motif_instance: formData.motif_instance,
          date_reception: formData.date_reception
        }])

      if (detailsError) {
        await supabase.from('dossiers').delete().eq('id', dossierId)
        throw new Error(`Erreur ajout détails: ${detailsError.message}`)
      }

      // ÉTAPE 3 : Historique
      const actionLabel = niveau === 'PRESTATION' ? 'Création et envoi au service Prestation' : 'Création du dossier'
      await supabase.from('historique_actions').insert([{
        dossier_id: dossierId,
        user_id: user.id,
        action: actionLabel,
        description: `Dossier créé pour ${formData.souscripteur}`,
        old_status: null,
        new_status: niveau
      }])

      const msg = niveau === 'PRESTATION'
        ? ' Dossier créé et envoyé au service Prestation !'
        : ' Dossier enregistré avec succès !'
      toast(msg)
      navigate('/rc/dossiers')
    } catch (error) {
      console.error(' [NewDossier]', error)
      toast.error(`${error.message || 'Erreur lors de la création du dossier'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  return (
    <RCLayout>
      <div className="p-6 max-w-3xl mx-auto">
        {/* En-tête */}
        <div className="mb-6">
          <button onClick={() => navigate('/rc/dossiers')} className="text-comar-navy/60 hover:text-comar-navy mb-4 flex items-center gap-1.5 text-sm font-medium transition-colors cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            Retour à la liste
          </button>
          <h1 className="text-2xl font-bold text-comar-navy">Nouveau Dossier</h1>
          <p className="text-sm text-gray-500 mt-1">Remplissez les informations du dossier</p>
        </div>

        {/* Formulaire */}
        <div className="bg-white rounded-xl border border-comar-neutral-border p-8 space-y-6">

          {/* Section : Informations du souscripteur */}
          <div className="border-b border-comar-neutral-border pb-6">
            <h2 className="text-base font-semibold text-comar-navy mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-comar-navy/50" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
              Informations du Souscripteur
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Souscripteur */}
              <div>
                <label htmlFor="souscripteur" className="block text-sm font-medium text-comar-navy mb-1.5">
                  Nom du Souscripteur <span className="text-comar-red">*</span>
                </label>
                <input type="text" id="souscripteur" name="souscripteur" value={formData.souscripteur} onChange={handleChange} required
                  className="w-full px-4 py-2.5 border border-comar-neutral-border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy transition-all"
                  placeholder="Ex: Jean Dupont" />
              </div>

              {/* N° Police */}
              <div>
                <label htmlFor="police_number" className="block text-sm font-medium text-comar-navy mb-1.5">
                  Numéro de Police <span className="text-comar-red">*</span>
                </label>
                <input type="text" id="police_number" name="police_number" value={formData.police_number} onChange={handleChange} required maxLength={10} pattern="\\d{8}-\\d" title="Format attendu: 12345678-9"
                  className="w-full px-4 py-2.5 border border-comar-neutral-border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy transition-all"
                  placeholder="Ex: 12345678-9" />
                <p className="mt-1 text-xs text-gray-400">Format requis: 8 chiffres, tiret, 1 chiffre</p>
              </div>

              {/* Téléphone */}
              <div>
                <label htmlFor="telephone" className="block text-sm font-medium text-comar-navy mb-1.5">
                  Téléphone
                </label>
                <input type="tel" id="telephone" name="telephone" value={formData.telephone} onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-comar-neutral-border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy transition-all"
                  placeholder="Ex: +216 20 123 456" />
              </div>

              {/* Agence (obligatoire) */}
              <div>
                <label htmlFor="agence_id" className="block text-sm font-medium text-comar-navy mb-1.5">
                  Agence <span className="text-comar-red">*</span>
                </label>
                {loadingAgences ? (
                  <div className="w-full px-4 py-2.5 border border-comar-neutral-border rounded-xl bg-comar-neutral-bg text-gray-400 text-sm">Chargement des agences...</div>
                ) : (
                  <select id="agence_id" name="agence_id" value={formData.agence_id} onChange={handleChange} required
                    className="w-full px-4 py-2.5 border border-comar-neutral-border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy transition-all">
                    <option value="">-- Sélectionner une agence --</option>
                    {agences.map((a) => (
                      <option key={a.id} value={a.id}>{a.code ? `${a.code} - ` : ''}{a.nom}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Section : Dates */}
          <div className="border-b border-comar-neutral-border pb-6">
            <h2 className="text-base font-semibold text-comar-navy mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-comar-navy/50" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
              Dates
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="date_reception" className="block text-sm font-medium text-comar-navy mb-1.5">
                  Date de réception bureau d'ordre
                </label>
                <input type="date" id="date_reception" name="date_reception" value={formData.date_reception} onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-comar-neutral-border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-comar-navy mb-1.5">
                  Date envoi RC
                </label>
                <input type="date" value={today} readOnly disabled
                  className="w-full px-4 py-2.5 border border-comar-neutral-border rounded-xl bg-comar-neutral-bg text-gray-400 cursor-not-allowed" />
                <p className="mt-1 text-xs text-gray-400">Renseignée automatiquement (aujourd'hui)</p>
              </div>
            </div>
          </div>

          {/* Section : Détails de la demande */}
          <div className="border-b border-comar-neutral-border pb-6">
            <h2 className="text-base font-semibold text-comar-navy mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-comar-navy/50" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
              Détails de la Demande
            </h2>

            <div className="mb-6">
              <label htmlFor="demande_initiale" className="block text-sm font-medium text-comar-navy mb-1.5">
                Demande Initiale
              </label>
              <select id="demande_initiale" name="demande_initiale" value={formData.demande_initiale} onChange={handleChange}
                className="w-full px-4 py-2.5 border border-comar-neutral-border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy transition-all">
                <option value="">-- Sélectionner --</option>
                <option value="Rachat Total">Rachat Total</option>
                <option value="Rachat Partiel">Rachat Partiel</option>
                <option value="Rachat Échu">Rachat Échu</option>
                <option value="Transfert Contrat">Transfert Contrat</option>
                <option value="Autre">Autre</option>
              </select>
            </div>

            <div>
              <label htmlFor="piece_justificative" className="block text-sm font-medium text-comar-navy mb-1.5">
                Pièce Justificative <span className="text-xs text-gray-500 font-normal">(Max 5Mo, PDF/PNG/JPG)</span>
              </label>
              <input 
                type="file" 
                id="piece_justificative" 
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const selectedFile = e.target.files[0];
                  if (selectedFile) {
                    if (selectedFile.size > 5 * 1024 * 1024) {
                      alert("Le fichier dépasse 5Mo !");
                      e.target.value = null;
                      setFile(null);
                    } else if (!['application/pdf', 'image/png', 'image/jpeg'].includes(selectedFile.type)) {
                      alert("Format de fichier non autorisé. Seuls PDF, PNG et JPG sont acceptés.");
                      e.target.value = null;
                      setFile(null);
                    } else {
                      setFile(selectedFile);
                    }
                  } else {
                    setFile(null);
                  }
                }} 
                className="w-full px-4 py-2.5 border border-comar-neutral-border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy transition-all file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-comar-teal-50 file:text-comar-teal hover:file:bg-comar-teal-100" 
              />
            </div>

            <div>
              <label htmlFor="motif_instance" className="block text-sm font-medium text-comar-navy mb-1.5">
                Motif d'Instance <span className="text-comar-red">*</span>
              </label>
              <textarea id="motif_instance" name="motif_instance" value={formData.motif_instance} onChange={handleChange} required rows={3}
                className="w-full px-4 py-2.5 border border-comar-neutral-border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy transition-all"
                placeholder="Motif de l'instance (obligatoire)..." />
              <p className="mt-1 text-xs text-gray-400">Ce champ est obligatoire et décrit la raison de la création du dossier</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-6 border-t border-comar-neutral-border">
            <button type="button" disabled={loading} onClick={() => handleSave('RELATION_CLIENT')}
              className="flex-1 min-w-[160px] bg-comar-neutral-bg text-comar-navy px-5 py-2.5 rounded-xl font-semibold hover:bg-comar-neutral-border disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 text-sm cursor-pointer">
              {loading ? (
                <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg> Enregistrement...</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg> Enregistrer</>
              )}
            </button>

            <button type="button" disabled={loading} onClick={() => handleSave('PRESTATION')}
              className="flex-1 min-w-[160px] bg-comar-navy text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-comar-navy-light disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 text-sm shadow-sm hover:shadow-md cursor-pointer">
              {loading ? (
                <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg> Envoi en cours...</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg> Envoyer</>
              )}
            </button>

            <button type="button" onClick={() => navigate('/rc/dossiers')} disabled={loading}
              className="px-5 py-2.5 bg-white text-gray-500 border border-comar-neutral-border rounded-xl font-semibold hover:bg-comar-neutral-bg disabled:opacity-50 transition-all duration-200 text-sm cursor-pointer">
              Annuler
            </button>
          </div>
        </div>
      </div>
    </RCLayout>
  )
}
