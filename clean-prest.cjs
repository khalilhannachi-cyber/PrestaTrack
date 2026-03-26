const fs = require('fs');
let c = fs.readFileSync('src/pages/prestation/PrestationDashboard.jsx', 'utf8');

c = c.replace(/<div className="text-3xl">.*?<\/div>/gu, '');
fs.writeFileSync('src/pages/prestation/PrestationDashboard.jsx', c);
