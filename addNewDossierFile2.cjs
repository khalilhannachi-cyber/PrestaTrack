const fs = require('fs');
let c = fs.readFileSync('src/pages/rc/NewDossier.jsx', 'utf8');

c = c.replace(
  '    setLoading(true)\n    try {\n      // ÉTAPE 1 : Insertion dans la table \'dossiers\'',
  `    setLoading(true)
    try {
      // ETAPE 0 : File upload (if present)
      let piece_justificative_url = null
      if (file) {
        toast('Téléchargement du fichier en cours...')
        const fileExt = file.name.split('.').pop()
        const fileName = \`\${Date.now()}_\${Math.random().toString(36).substring(7)}.\${fileExt}\`
        
        const { error: uploadError } = await supabase.storage
          .from('pieces_justificatives')
          .upload(fileName, file)
          
        if (uploadError) throw new Error(\`Erreur upload fichier: \${uploadError.message}\`)
        
        const { data: urlData } = supabase.storage
          .from('pieces_justificatives')
          .getPublicUrl(fileName)
          
        piece_justificative_url = urlData.publicUrl
      }

      // ÉTAPE 1 : Insertion dans la table 'dossiers'`
);

c = c.replace(
  'created_by: user.id\n        }])',
  'created_by: user.id,\n          piece_justificative_url\n        }])'
);

fs.writeFileSync('src/pages/rc/NewDossier.jsx', c);
