/**
 * Composant Input réutilisable pour les formulaires
 * Gère le label, les erreurs, et les états disabled
 * 
 * @param {Object} props - Propriétés du composant
 * @param {string} props.label - Label affiché au-dessus du champ
 * @param {string} props.type - Type de l'input HTML (text, email, password, etc.)
 * @param {string} props.placeholder - Texte d'indication dans le champ
 * @param {string} props.value - Valeur contrôlée du champ
 * @param {Function} props.onChange - Fonction appelée lors du changement de valeur
 * @param {string} props.name - Nom du champ (utile pour les formulaires)
 * @param {string} props.error - Message d'erreur à afficher (si présent, stylise en rouge)
 * @param {boolean} props.disabled - Désactive le champ si true
 * 
 * @returns {React.ReactNode} Un champ de saisie stylisé avec label et gestion d'erreurs
 */
export default function Input({ label, type = 'text', placeholder, value, onChange, name, error, disabled = false }) {
  return (
    <div className="w-full">
      {/* Affichage du label si fourni */}
      {label && (
        <label className="block text-sm font-medium text-comar-navy mb-1.5">
          {label}
        </label>
      )}
      
      {/* Champ de saisie avec gestion des erreurs et états */}
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`w-full px-4 py-2.5 border rounded-xl shadow-sm focus:outline-none focus:ring-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-400 ${
          error
            ? 'border-comar-red focus:ring-comar-red/30 focus:border-comar-red'
            : 'border-comar-neutral-border focus:ring-comar-navy/20 focus:border-comar-navy'
        }`}
      />
      
      {/* Affichage du message d'erreur si présent */}
      {error && <p className="mt-1.5 text-sm text-comar-red flex items-center gap-1"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>{error}</p>}
    </div>
  )
}
