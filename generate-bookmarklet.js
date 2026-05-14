import { readFileSync, writeFileSync } from 'fs';

const bundle = readFileSync('dist/comment-tool.js', 'utf8');
const bookmarklet = 'javascript:' + encodeURIComponent(bundle);

let html = readFileSync('index.html', 'utf8');
html = html.replace(/href="javascript:[^"]*"/, `href="${bookmarklet}"`);
writeFileSync('index.html', html);
console.log('Bookmarklet injected into index.html (' + bookmarklet.length + ' chars)');
