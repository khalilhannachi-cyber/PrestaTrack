const fs = require('fs');

function walk(dir) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      walk(file);
    } else if (file.endsWith('.jsx')) {
      let c = fs.readFileSync(file, 'utf8');
      
      // Fix specific toast syntax
      c = c.replace(/toast\(\s*'❌(.*?)'\s*\)/g, 'toast.error(\'$1\')');
      c = c.replace(/toast\(\s*'✅(.*?)'\s*\)/g, 'toast.success(\'$1\')');
      c = c.replace(/toast\(\s*'⚠️(.*?)'\s*\)/g, 'toast(\'$1\')');
      c = c.replace(/toast\(\s*"❌(.*?)"\s*\)/g, 'toast.error("$1")');
      c = c.replace(/toast\(\s*"✅(.*?)"\s*\)/g, 'toast.success("$1")');
      c = c.replace(/toast\(\s*"⚠️(.*?)"\s*\)/g, 'toast("$1")');

      // Strip remaining emojis globally
      const emojiRegex = /[\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
      c = c.replace(emojiRegex, '');
      
      // Some text like ' [Dashboard]' might become ' [Dashboard]' if the emoji was stripped.
      // E.g., `console.log(' [Dashboard]')`
      
      fs.writeFileSync(file, c);
    }
  });
}

walk('src/pages');
