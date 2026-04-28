const fs = require('fs');
const path = require('path');

const dir = './src/components';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

const mappings = {
  'bg-slate-950': 'bg-slate-50 dark:bg-slate-950',
  'bg-slate-900': 'bg-slate-100 dark:bg-slate-900',
  'bg-slate-800': 'bg-slate-200 dark:bg-slate-800',
  'bg-black/40': 'bg-white/60 dark:bg-black/40',
  'text-white': 'text-slate-900 dark:text-white',
  'text-slate-400': 'text-slate-500 dark:text-slate-400',
  'text-slate-300': 'text-slate-600 dark:text-slate-300',
  'bg-white/5': 'bg-black/5 dark:bg-white/5',
  'bg-white/10': 'bg-black/10 dark:bg-white/10',
  'border-white/5': 'border-black/5 dark:border-white/5',
  'border-white/10': 'border-black/10 dark:border-white/10',
  'border-white/20': 'border-black/20 dark:border-white/20',
  'border-white/40': 'border-black/40 dark:border-white/40',
  'from-slate-950': 'from-slate-50 dark:from-slate-950',
  'via-slate-900': 'via-slate-100 dark:via-slate-900',
  'to-blue-950': 'to-blue-50 dark:to-blue-950',
};

files.forEach(file => {
  let content = fs.readFileSync(path.join(dir, file), 'utf8');
  for (const [dark, lightDark] of Object.entries(mappings)) {
    const regex = new RegExp(`(?<!dark:)(?<!light:)\\b${dark.replace(/\//g, '\\/')}\\b`, 'g');
    content = content.replace(regex, lightDark);
  }
  fs.writeFileSync(path.join(dir, file), content);
});
console.log('Theme classes updated!');
