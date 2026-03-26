const fs = require('fs');
let c = fs.readFileSync('src/pages/rc/NewDossier.jsx', 'utf8');

c = c.replace(
  /setLoading\(true\)\r?\n\s*try\s*\{\r?\n\s*\/\/\s*ÉTAPE 1/g,
  `setLoading(true)
    try {
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
          
        if (urlData) {
          piece_justificative_url = urlData.publicUrl
        }
      }

      // ÉTAPE 1`
);

c = c.replace(
  /created_by:\s*user\.id\r?\n\s*\}\]\)/,
  'created_by: user.id,\n          piece_justificative_url\n        }])'
);

fs.writeFileSync('src/pages/rc/NewDossier.jsx', c);
