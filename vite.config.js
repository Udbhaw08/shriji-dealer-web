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
            const [products, categories] = await Promise.all([
              fetchZohoProducts({ refresh }),
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
            const urlParts = req.url.split('?')[0].split('/');
            const id = urlParts[urlParts.length - 1];
            const product = await fetchZohoProductById(id);
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
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), zohoApiPlugin()],
})

