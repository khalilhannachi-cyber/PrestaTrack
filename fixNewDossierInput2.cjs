const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/pages/rc/NewDossier.jsx');
let content = fs.readFileSync(file, 'utf8');

const validationReplace = `        return
      }

      if (file && !['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) {
        toast.error("Format de fichier non autorisé. Seuls PDF, PNG et JPG sont acceptés.");
        return;
      }
      if (file && file.size > 5 * 1024 * 1024) {
        toast.error("Le fichier dépasse 5Mo.");
        return;
      }

      setLoading(true)`;

// CRLF safe replacement
content = content.replace(/        return\r?\n      }\r?\n\r?\n      setLoading\(true\)/, validationReplace);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed validation');