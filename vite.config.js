import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import {
  findDealerByPhone,
  createDealerContact,
  getDealerById,
  fetchZohoProducts,
  fetchZohoProductById,
  fetchZohoCategories,
} from './api/zoho.js'

function zohoApiPlugin() {
  return {
    name: 'zoho-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Products catalogue route
        if (req.url === '/api/products' || req.url.startsWith('/api/products?')) {
          try {
            const urlObj = new URL(req.url, 'http://localhost');
            const refresh = urlObj.searchParams.get('refresh') === 'true';
            const pricebookId = urlObj.searchParams.get('pricebook_id') || '3334672000000547177';
            const [products, categories] = await Promise.all([
              fetchZohoProducts({ refresh, pricebookId }),
              fetchZohoCategories(),
            ]);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ ok: true, count: products.length, products, categories }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: err.message }));
          }
        }

        // Single product route: /api/products/:id
        if (req.url.startsWith('/api/products/') && req.method === 'GET') {
          try {
            const urlObj = new URL(req.url, 'http://localhost');
            const urlParts = urlObj.pathname.split('/');
            const id = urlParts[urlParts.length - 1];
            const pricebookId = urlObj.searchParams.get('pricebook_id') || '3334672000000547177';
            const product = await fetchZohoProductById(id, { pricebookId });
            if (!product) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ error: 'Product not found in Zoho' }));
            }
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ ok: true, product }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: err.message }));
          }
        }

        if (req.url.startsWith('/api/dealer/info') && req.method === 'GET') {
          try {
            const urlObj = new URL(req.url, 'http://localhost');
            const id = urlObj.searchParams.get('id');
            if (!id) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ error: 'Missing dealer id parameter' }));
            }
            const dealer = await getDealerById(id);
            if (!dealer) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ error: 'Dealer not found in Zoho' }));
            }
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ ok: true, dealer }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: err.message }));
          }
        }

        if (req.url === '/api/dealer/login' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', async () => {
            try {
              const { phone } = JSON.parse(body || '{}');
              if (!phone) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ error: 'Phone number or email is required' }));
              }
              const dealer = await findDealerByPhone(phone);
              if (!dealer) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ error: 'No dealer account found with this phone number. Please submit an application below.' }));
              }
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ ok: true, dealer }));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        if (req.url === '/api/dealer/apply' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', async () => {
            try {
              const payload = JSON.parse(body || '{}');
              if (!payload.shop || !payload.person || !payload.phone) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ error: 'Shop name, contact person, and phone are required.' }));
              }
              const created = await createDealerContact(payload);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ ok: true, dealer: created }));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        next();
      });
    },
    async transformIndexHtml(html, ctx) {
      const url = ctx?.originalUrl || ctx?.url || '';
      if (url.startsWith('/products/')) {
        try {
          const urlObj = new URL(url, 'http://localhost');
          const pathSegments = urlObj.pathname.split('/').filter(Boolean);
          const identifier = pathSegments[pathSegments.length - 1];
          const pid = urlObj.searchParams.get('pid');
          const lookup = pid || identifier;
          if (lookup) {
            const product = await fetchZohoProductById(lookup);
            if (product) {
              const dealerName = urlObj.searchParams.get('name') || '';
              const dealerCity = urlObj.searchParams.get('city') || '';
              const dealerState = urlObj.searchParams.get('state') || '';
              const dealerLoc = [dealerCity, dealerState].filter(Boolean).join(', ');
              const title = `${product.name} · Sunshine Appliances`;
              const priceStr = product.mrp > 0 ? `₹${Number(product.mrp).toLocaleString('en-IN')}` : 'Price on Request';
              const desc = dealerName
                ? `Retail MRP: ${priceStr} (Incl. of all taxes) · Available with ${dealerName}${dealerLoc ? ` (${dealerLoc})` : ''}`
                : `Retail MRP: ${priceStr} (Incl. of all taxes) · Sunshine ReSTOR`;
              const imgUrl = product.img || '/img/hero-stove.webp';

              let transformed = html;
              transformed = transformed.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);
              transformed = transformed.replace(
                /<meta\s+name=["']description["'].*?>/i,
                `<meta name="description" content="${desc}" />`
              );
              transformed = transformed.replace(
                /<meta\s+property=["']og:title["'].*?>/i,
                `<meta property="og:title" content="${title}" />`
              );
              transformed = transformed.replace(
                /<meta\s+property=["']og:description["'].*?>/i,
                `<meta property="og:description" content="${desc}" />`
              );
              transformed = transformed.replace(
                /<meta\s+property=["']og:image["'].*?>/i,
                `<meta property="og:image" content="${imgUrl}" />\n    <meta property="og:image:secure_url" content="${imgUrl}" />\n    <meta property="og:image:type" content="image/jpeg" />\n    <meta property="og:image:width" content="600" />\n    <meta property="og:image:height" content="600" />`
              );
              transformed = transformed.replace(
                /<meta\s+name=["']twitter:title["'].*?>/i,
                `<meta name="twitter:title" content="${title}" />`
              );
              transformed = transformed.replace(
                /<meta\s+name=["']twitter:description["'].*?>/i,
                `<meta name="twitter:description" content="${desc}" />`
              );
              transformed = transformed.replace(
                /<meta\s+name=["']twitter:image["'].*?>/i,
                `<meta name="twitter:image" content="${imgUrl}" />`
              );
              return transformed;
            }
          }
        } catch (err) {
          console.error('Error injecting product OG tags in Vite:', err);
        }
      }
      return html;
    },
  };
}

let liveSyncTimer = null;
let isLiveSyncing = false;

function liveAutoSyncPlugin() {
  return {
    name: 'live-auto-sync-plugin',
    apply: 'serve', // Only active during 'npm run dev', never during 'build'
    handleHotUpdate({ file }) {
      const normalized = (file || '').replace(/\\/g, '/');
      if (
        normalized.includes('/dist/') ||
        normalized.includes('/node_modules/') ||
        normalized.includes('/.git/') ||
        normalized.includes('/android/') ||
        normalized.includes('/ios/') ||
        normalized.includes('/graphify-out/') ||
        normalized.endsWith('CODEBASE.md')
      ) {
        return;
      }

      if (liveSyncTimer) clearTimeout(liveSyncTimer);
      liveSyncTimer = setTimeout(async () => {
        if (isLiveSyncing) return;
        isLiveSyncing = true;
        try {
          const { exec } = await import('node:child_process');
          exec('node scripts/generate-codebase-doc.mjs && npx vite build && npx cap copy', { cwd: process.cwd() }, (err) => {
            isLiveSyncing = false;
            if (!err) {
              console.log('⚡ [Live Auto-Sync] Android, iOS & CODEBASE.md refreshed in background.');
            }
          });
        } catch {
          isLiveSyncing = false;
        }
      }, 3000);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), zohoApiPlugin(), liveAutoSyncPlugin()],
  server: {
    host: true,
  },
})

