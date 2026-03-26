const fs = require('fs');

let c = fs.readFileSync('src/pages/prestation/PrestationDashboard.jsx', 'utf8');

c = c.replace(/<p className="text-sm text-gray-500 font-medium">(.*?)<\/p>\s*<p className="text-2xl font-bold([^"]*)">([\s\S]*?)<\/p>\s*<\/div>\s*<div className="text-3xl">(\s|â³)*<\/div>/g, function(match, title, valClass, valContent) {
  let iconWrapper = '';
  if (title.toLowerCase().includes('total')) {
    iconWrapper = '<div className="w-10 h-10 rounded-xl bg-comar-navy-50 flex items-center justify-center"><svg className="w-5 h-5 text-comar-navy" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg></div>';
  } else if (title.toLowerCase().includes('en cours')) {
    iconWrapper = '<div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center"><svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg></div>';
  } else if (title.toLowerCase().includes('complets')) {
    iconWrapper = '<div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 019 9v.375M10.125 2.25A3.375 3.375 0 0113.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 013.375 3.375M9 15l2.25 2.25L15 12" /></svg></div>';
  } else if (title.toLowerCase().includes('instance')) {
    iconWrapper = '<div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center"><svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>';
  } else if (title.toLowerCase().includes('quittances')) {
    iconWrapper = '<div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center"><svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75" /></svg></div>';
  }

  return `<p className="text-xs text-gray-500 font-medium uppercase tracking-wider">${title}</p>
                    <p className="text-2xl font-bold${valClass} mt-1">${valContent}</p>
                  </div>
                  ${iconWrapper}`;
});

fs.writeFileSync('src/pages/prestation/PrestationDashboard.jsx', c);
