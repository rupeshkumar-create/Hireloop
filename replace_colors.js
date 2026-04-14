import fs from 'fs';
import path from 'path';

const directories = ['src/components', 'src/pages', 'src/contexts', 'src/hooks', 'src/lib', 'src/types'];

const replacements = {
  'bg-white': 'bg-surface',
  'bg-zinc-50': 'bg-background',
  'bg-zinc-100': 'bg-surface-hover',
  'bg-zinc-900': 'bg-foreground',
  'bg-black': 'bg-foreground',
  'bg-slate-50': 'bg-background',
  'text-zinc-900': 'text-foreground',
  'text-zinc-800': 'text-foreground',
  'text-zinc-700': 'text-foreground-muted',
  'text-zinc-600': 'text-foreground-muted',
  'text-zinc-500': 'text-foreground-muted',
  'text-zinc-400': 'text-foreground-muted',
  'text-white': 'text-surface',
  'border-zinc-100': 'border-border',
  'border-zinc-200': 'border-border',
  'border-zinc-300': 'border-border-strong',
  'border-zinc-400': 'border-border-strong',
  'border-white/40': 'border-border',
  'ring-zinc-900': 'ring-foreground',
  'shadow-sm': 'shadow-sm', // Keeping shadows as is or updating if needed
  'shadow-md': 'shadow-md'
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Use word boundaries for replacements
  for (const [key, value] of Object.entries(replacements)) {
    const regex = new RegExp(`\\b${key}\\b`, 'g');
    content = content.replace(regex, value);
  }

  // Handle some specific patterns like hover:bg-zinc-800
  content = content.replace(/hover:bg-zinc-800/g, 'hover:opacity-90');
  content = content.replace(/hover:bg-zinc-100/g, 'hover:bg-surface-hover');
  content = content.replace(/hover:bg-zinc-50/g, 'hover:bg-surface-hover');
  content = content.replace(/hover:text-zinc-900/g, 'hover:text-foreground');
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

directories.forEach(walkDir);
processFile('src/App.tsx');
processFile('src/main.tsx');

console.log('Done!');
