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
        <label className="block text-sm font-medium text-gray-700 mb-1">
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
        className={`w-full px-4 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 transition disabled:opacity-50 disabled:cursor-not-allowed ${
          error
            ? 'border-red-500 focus:ring-red-500 focus:border-red-500' // Style d'erreur
            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500' // Style normal
        }`}
      />
      
      {/* Affichage du message d'erreur si présent */}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
