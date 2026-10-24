import { defineConfig, mergeConfig, type Plugin } from 'vite';
import rootConfig from '../../../vite.config';

/** Dev-only route supplied from the owned folder; no root files are patched. */
const stressRoute: Plugin = {
  name: 'financial-panel-stress-route',
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      if (request.url?.split('?')[0] !== '/dev/stress-states' || request.method !== 'GET') return next();
      try {
        const html = await server.transformIndexHtml('/dev/stress-states', '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Financial panel stress states</title></head><body><div id="root"></div><script type="module" src="/src/components/panels/dev/stressMain.tsx"></script></body></html>');
        response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html);
      } catch (error) { next(error); }
    });
  }
};
export default mergeConfig(rootConfig, defineConfig({ plugins: [stressRoute] }));
