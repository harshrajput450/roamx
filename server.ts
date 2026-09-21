import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createExpressApp } from './server/app';
import { getServerConfig } from './server/config/env';

async function startServer() {
  const config = getServerConfig();
  const app = createExpressApp();
  const PORT = process.env.PORT || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    // API Health Check for Render Production Deployment
    app.get('/', (req, res) => {
      res.status(200).json({ status: 'ok', message: 'RoamX Expeditions API Server Running' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏔️ RoamX Expeditions Server running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});