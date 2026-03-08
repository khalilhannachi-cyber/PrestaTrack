/**
 * Composant Button réutilisable avec support de variantes et état de chargement
 * 
 * @param {Object} props - Propriétés du composant
 * @param {React.ReactNode} props.children - Contenu du bouton (texte, icônes, etc.)
 * @param {Function} props.onClick - Fonction appelée lors du clic
 * @param {string} props.type - Type HTML du bouton (button, submit, reset)
 * @param {string} props.variant - Style du bouton (primary, secondary, outline)
 * @param {boolean} props.disabled - Désactive le bouton si true
 * @param {boolean} props.loading - Affiche un spinner de chargement si true
 * 
 * @returns {React.ReactNode} Un bouton stylisé
 */
export default function Button({ children, onClick, type = 'button', variant = 'primary', disabled = false, loading = false }) {
  // Classes CSS de base communes à tous les boutons
  const base = 'w-full px-4 py-2.5 rounded-xl font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm shadow-sm hover:shadow-md active:scale-[0.98]'

  // Styles spécifiques pour chaque variante de bouton
  const variants = {
    primary: 'bg-comar-navy text-white hover:bg-comar-navy-light',
    secondary: 'bg-comar-neutral-bg text-comar-navy hover:bg-comar-neutral-border',
    outline: 'border border-comar-navy text-comar-navy hover:bg-comar-navy-50',
    danger: 'bg-comar-red text-white hover:bg-comar-red-light',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading} // Désactiver pendant le chargement
      className={`${base} ${variants[variant]}`}
    >
      {/* Icône de chargement (spinner) */}
      {loading && (
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {/* Affiche "Chargement..." pendant le loading, sinon affiche le contenu */}
      {loading ? 'Chargement...' : children}
    </button>
  )
}
