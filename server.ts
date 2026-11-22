import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { initDatabase } from './src/server/db.ts';
import { buildCompleteProjectZip, buildWordPressBundleZip } from './src/server/packager.ts';
import { createApiRouter } from './src/server/routes.ts';

async function startServer(): Promise<void> {
  initDatabase();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/v1', createApiRouter());

  app.get('/downloads/:packageName', (req, res) => {
    const pkg = req.params.packageName;
    if (pkg === 'klyverion-wp-suite-phase1.zip') {
      const zip = buildWordPressBundleZip();
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="klyverion-wp-suite-phase1.zip"');
      res.send(zip);
      return;
    }
    if (pkg === 'klyverion-business-suite-complete.zip') {
      const zip = buildCompleteProjectZip();
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="klyverion-business-suite-complete.zip"');
      res.send(zip);
      return;
    }
    res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Pacote não encontrado.' } });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build not found');
      }
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Klyverion Business Suite server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Klyverion Business Suite server:', err);
  process.exit(1);
});
