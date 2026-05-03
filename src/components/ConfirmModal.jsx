import React from 'react';

/**
 * Composant de Modal de Confirmation Réutilisable
 * Remplace la popup native window.confirm()
 */
export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirmer", cancelText = "Annuler", type = "warning" }) {
  if (!isOpen) return null;

  const isDanger = type === "danger";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Overlay sombre */}
      <div 
        className="fixed inset-0 bg-black/50 transition-opacity" 
        onClick={onCancel}
      ></div>

      {/* Contenu de la modal */}
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isDanger ? 'bg-red-100' : 'bg-amber-100'}`}>
            {isDanger ? (
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            ) : (
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {title || "Confirmation"}
            </h3>
            <p className="text-sm text-gray-600 whitespace-pre-line">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm ${
              isDanger 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-comar-navy hover:bg-comar-navy-light'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
