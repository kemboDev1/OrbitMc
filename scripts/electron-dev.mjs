import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const electronExecutable = require('electron');
const vite = await createServer();

await vite.listen();

try {
  const app = spawn(electronExecutable, [projectRoot], {
    cwd: projectRoot,
    env: { ...process.env, VITE_DEV_SERVER: '1' },
    stdio: 'inherit',
  });

  process.exitCode = await new Promise((resolve, reject) => {
    app.once('error', reject);
    app.once('close', (code) => resolve(code ?? 1));
  });
} finally {
  await vite.close();
}
