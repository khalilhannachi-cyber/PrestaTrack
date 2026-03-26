const fs = require('fs');
let c = fs.readFileSync('src/pages/rc/NewDossier.jsx', 'utf8');

c = c.replace(
  'const [loadingAgences, setLoadingAgences] = useState(true)',
  'const [loadingAgences, setLoadingAgences] = useState(true)\n  const [file, setFile] = useState(null)'
);

c = c.replace(
  /const handleSave = async \(niveau\) => {([\s\S]*?)setLoading\(true\)\n    try {/,
  `const handleSave = async (niveau) => {$1setLoading(true)
    try {
      let piece_justificative_url = null
      if (file) {
        toast('Téléchargement du fichier en cours...')
        const fileExt = file.name.split('.').pop()
        const fileName = \`\${Date.now()}_\${Math.random().toString(36).substring(7)}.\${fileExt}\`
        
        // On upload dans le bucket "pieces_justificatives" (à adapter au besoin)
        const { error: uploadError } = await supabase.storage
          .from('pieces_justificatives')
          .upload(fileName, file)
          
        if (uploadError) throw new Error(\`Erreur upload fichier: \${uploadError.message}\`)
        
        const { data: urlData } = supabase.storage
          .from('pieces_justificatives')
          .getPublicUrl(fileName)
          
        piece_justificative_url = urlData.publicUrl
      }`
);

c = c.replace(
  /created_by: user\.id\n\s*\}\]\)/,
  'created_by: user.id,\n          piece_justificative_url\n        }])'
);

// Add file input UI
const fileInputUI = `
          {/* Pièce Justificative */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-comar-navy mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
              Pièce Justificative <span className="text-gray-400 font-normal">(Optionnel)</span>
            </label>
            <input 
              type="file" 
              onChange={(e) => setFile(e.target.files[0])}
              className="w-full px-4 py-3 bg-gray-50 border border-comar-neutral-border rounded-xl focus:outline-none focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy transition-all file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-comar-navy-50 file:text-comar-navy hover:file:bg-comar-navy-100" 
            />
          </div>
`;

// Insert the file input UI before the Motifs d'instance (we find a good spot inside the grid)
c = c.replace(
  /(<div className="md:col-span-2">\s*<label className="block text-sm font-medium text-comar-navy mb-2">)/,
  fileInputUI + '\n          $1'
);

fs.writeFileSync('src/pages/rc/NewDossier.jsx', c);
