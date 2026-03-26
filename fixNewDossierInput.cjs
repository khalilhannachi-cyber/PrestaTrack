const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/pages/rc/NewDossier.jsx');
let content = fs.readFileSync(file, 'utf8');

const inputHtml = `              <div>
                <label htmlFor="piece_justificative" className="block text-sm font-medium text-comar-navy mb-1.5">
                  Pièce Justificative (Max 5Mo, PDF/PNG/JPG)
                </label>
                <input 
                  type="file" 
                  id="piece_justificative" 
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    const selectedFile = e.target.files[0];
                    if (selectedFile) {
                      if (selectedFile.size > 5 * 1024 * 1024) {
                        alert("Le fichier dépasse 5Mo !");
                        e.target.value = null;
                        setFile(null);
                      } else if (!['application/pdf', 'image/png', 'image/jpeg'].includes(selectedFile.type)) {
                        alert("Format de fichier non autorisé. Seuls PDF, PNG et JPG sont acceptés.");
                        e.target.value = null;
                        setFile(null);
                      } else {
                        setFile(selectedFile);
                      }
                    } else {
                      setFile(null);
                    }
                  }} 
                  className="w-full px-4 py-2.5 border border-comar-neutral-border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-comar-navy/20 focus:border-comar-navy transition-all file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-comar-teal-50 file:text-comar-teal hover:file:bg-comar-teal-100" 
                />
              </div>

              <div>
                <label htmlFor="motif_instance"`;

content = content.replace(/              <div>[\r\n\s]*<label htmlFor="motif_instance"/, inputHtml);

const validationReplace = `      if (file && !['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) {
        toast.error("Format de fichier non autorisé. Seuls PDF, PNG et JPG sont acceptés.");
        return;
      }
      if (file && file.size > 5 * 1024 * 1024) {
        toast.error("Le fichier dépasse 5Mo.");
        return;
      }

      setLoading(true)`;

content = content.replace(/      setLoading\(true\)/, validationReplace);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed input and validation');
