import fs from 'fs';
import path from 'path';

const directories = ['src'];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  content = content.replace(/bg-zinc-200/g, 'bg-border');
  content = content.replace(/bg-zinc-300/g, 'bg-border-strong');
  content = content.replace(/bg-zinc-800/g, 'bg-surface-hover');
  content = content.replace(/bg-zinc-700/g, 'bg-surface-hover');
  
  content = content.replace(/text-zinc-300/g, 'text-foreground-muted');
  content = content.replace(/text-zinc-200/g, 'text-border-strong');
  
  content = content.replace(/border-zinc-800/g, 'border-border-strong');
  content = content.replace(/border-zinc-900/g, 'border-border-strong');
  content = content.replace(/border-white/g, 'border-border');

  content = content.replace(/ring-black\/5/g, 'ring-ring');

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

console.log('Done 2!');
