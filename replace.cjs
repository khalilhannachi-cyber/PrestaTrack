const fs=require('fs');
const files=[
  'src/pages/Finance/FinanceDashboard.jsx',
  'src/pages/admin/NewUser.jsx',
  'src/pages/admin/UsersList.jsx',
  'src/pages/prestation/PrestationDashboard.jsx',
  'src/pages/rc/DossierDetail.jsx',
  'src/pages/rc/DossiersList.jsx',
  'src/pages/rc/NewDossier.jsx',
  'src/pages/rc/DossiersEnLigneList.jsx'
];
files.forEach(f=>{
  try {
    let c=fs.readFileSync(f,'utf8');
    if(c.includes('alert(')){
      // Backtick alerts
      c=c.replace(/alert\(\s*`\s*\u2705\s*([^`]+)`\s*\)/g, 'toast.success(`$1`)');
      c=c.replace(/alert\(\s*`\s*\u274C\s*([^`]+)`\s*\)/g, 'toast.error(`$1`)');
      c=c.replace(/alert\(\s*`\s*\u26A0\uFE0F?\s*([^`]+)`\s*\)/g, 'toast.error(`$1`)');
      
      // Single/double quote alerts
      c=c.replace(/alert\(\s*['"]\s*\u2705\s*([^'"]+)['"]\s*\)/g, 'toast.success("$1")');
      c=c.replace(/alert\(\s*['"]\s*\u274C\s*([^'"]+)['"]\s*\)/g, 'toast.error("$1")');
      c=c.replace(/alert\(\s*['"]\s*\u26A0\uFE0F?\s*([^'"]+)['"]\s*\)/g, 'toast.error("$1")');

      c=c.replace(/alert\((.*?)\)/g, 'toast($1)');
      if(!c.includes('react-hot-toast')){
        c = "import { toast } from 'react-hot-toast'\n" + c;
      }
      fs.writeFileSync(f,c);
      console.log('Processed', f);
    }
  } catch(e){
    console.error(e);
  }
});
