import React from 'react';

/**
 * Composant DossierTimeline
 * Affiche l'historique des actions sur un dossier sous forme de ligne de temps
 * 
 * @param {Array} history - Liste des actions récupérées depuis la table historique_actions
 */
function DossierTimeline({ history }) {
  if (!history || history.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-8 text-center border border-dashed border-gray-300">
        <p className="text-gray-500 text-sm italic">Aucun historique disponible pour ce dossier.</p>
      </div>
    );
  }

  const getActionColor = (action) => {
    const act = action.toLowerCase();
    if (act.includes('création')) return 'bg-emerald-500';
    if (act.includes('transmission')) return 'bg-blue-600';
    if (act.includes('modification')) return 'bg-amber-500';
    if (act.includes('validation')) return 'bg-emerald-600';
    if (act.includes('rejet')) return 'bg-red-600';
    if (act.includes('clôture')) return 'bg-gray-700';
    return 'bg-comar-navy';
  };

  return (
    <div className="flow-root">
      <ul role="list" className="-mb-8">
        {history.map((event, eventIdx) => (
          <li key={event.id}>
            <div className="relative pb-8">
              {eventIdx !== history.length - 1 ? (
                <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
              ) : null}
              <div className="relative flex space-x-3">
                <div>
                  <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${getActionColor(event.action)}`}>
                    <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z" fillRule="evenodd" clipRule="evenodd" />
                    </svg>
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      {event.action}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 italic">
                      {event.description}
                    </p>
                  </div>
                  <div className="whitespace-nowrap text-right text-xs text-gray-500">
                    <time dateTime={event.created_at}>
                      {new Date(event.created_at).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </time>
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default DossierTimeline;
