import esbuild from 'esbuild';
import { argv } from 'process';

const watch = argv.includes('--watch');

const ctx = await esbuild.context({
  entryPoints: ['src/index.js'],
  bundle: true,
  format: 'iife',
  outfile: 'dist/comment-tool.js',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  target: ['chrome90', 'firefox88', 'safari14'],
});

if (watch) {
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log('Built dist/comment-tool.js');
}
