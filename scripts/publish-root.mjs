/* بعد البناء: ينسخ web/index.html إلى جذر المستودع مع تعديل المسارات،
   لتعمل صفحة index الرئيسية مباشرة على GitHub Pages (الفرع main، المجلد الجذر). */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(root, 'web', 'index.html'), 'utf8')
  .replace(/(src|href)="\.\/(?!web\/)/g, '$1="./web/');
writeFileSync(path.join(root, 'index.html'), html);
console.log('✓ index.html (root) → web/');
