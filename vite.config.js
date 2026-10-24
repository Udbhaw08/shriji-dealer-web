import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import {
  createDealerContact,
  getDealerById,
  fetchZohoProducts,
  fetchZohoProductById,
  fetchZohoCategories,
  syncRecentProductTags,
} from './api/zoho.js'
import downloadHandler from './api/download.js'
import { escapeHtml, sanitizeUrl } from './api/htmlEscape.js'

async function loadContentService() {
  try {
    return await import('./backend/src/services/content.js');
  } catch (err) {
    console.warn('[vite] Backend content service not loaded:', err.message);
    return null;
  }
}

function zohoApiPlugin() {
  return {
    name: 'zoho-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Download handler: /api/download
        if (req.url.startsWith('/api/download')) {
          try {
            const urlObj = new URL(req.url, 'http://localhost');
            const query = Object.fromEntries(urlObj.searchParams.entries());
            const fakeReq = { query };
            const fakeRes = {
              statusCode: 200,
              headers: {},
              setHeader(name, val) {
                this.headers[name] = val;
                res.setHeader(name, val);
              },
              status(code) {
                this.statusCode = code;
                res.statusCode = code;
                return this;
              },
              send(buf) {
                res.statusCode = this.statusCode;
                return res.end(buf);
              },
              json(obj) {
                res.statusCode = this.statusCode;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify(obj));
              },
            };
            return await downloadHandler(fakeReq, fakeRes);
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: err.message }));
          }
        }
        // Hero Banners route: /api/banners (Supabase direct)
        if (req.url === '/api/banners' || req.url.startsWith('/api/banners?')) {
          try {
            const contentService = await loadContentService();
            const banners = contentService ? await contentService.getSupabaseBanners() : [];
            const settings = contentService ? await contentService.getHeroSliderSettings() : null;
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ ok: true, count: banners.length, banners, settings }));
          } catch (err) {
            console.error('[vite] Supabase banner error:', err.message);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ ok: false, error: err.message, banners: [] }));
          }
        }

        // Schemes route: /api/schemes (Supabase direct)
        if (req.url === '/api/schemes' || req.url.startsWith('/api/schemes?')) {
          try {
            const contentService = await loadContentService();
            const schemes = contentService ? await contentService.getSupabaseSchemes() : { active: [], upcoming: [], past: [] };
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ ok: true, schemes }));
          } catch (err) {
            console.error('[vite] Supabase scheme error:', err.message);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ ok: false, error: err.message, schemes: { active: [], upcoming: [], past: [] } }));
          }
        }

        // Branding / Logos route: /api/branding (Supabase)
        if (req.url === '/api/branding' || req.url.startsWith('/api/branding?')) {
          try {
            const contentService = await loadContentService();
            const branding = contentService ? await contentService.getSupabaseBranding() : null;
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ ok: true, branding }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: err.message }));
          }
        }

        // File Upload route: /api/upload (Device drag & drop and local uploads)
        if (req.url === '/api/upload' || req.url.startsWith('/api/upload?') || req.url.startsWith('/api/upload/')) {
          try {
            const uploadHandler = (await import('./api/upload.js')).default;
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', async () => {
              try {
                const fakeReq = {
                  method: req.method,
                  url: req.url,
                  headers: req.headers,
                  body: body ? JSON.parse(body) : {},
                };
                const fakeRes = {
                  statusCode: 200,
                  setHeader(name, val) { res.setHeader(name, val); },
                  status(code) {
                    this.statusCode = code;
                    res.statusCode = code;
                    return this;
                  },
                  json(obj) {
                    res.statusCode = this.statusCode;
                    res.setHeader('Content-Type', 'application/json');
                    return res.end(JSON.stringify(obj));
                  },
                };
                await uploadHandler(fakeReq, fakeRes);
              } catch (parseErr) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ ok: false, error: parseErr.message }));
              }
            });
            return;
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ ok: false, error: err.message }));
          }
        }

        // Uploaded Assets Serving: /uploads/... or /api/uploads
        if (req.url.startsWith('/uploads/') || req.url.startsWith('/api/uploads')) {
          try {
            const uploadsHandler = (await import('./api/upload.js')).default;
            const urlObj = new URL(req.url, 'http://localhost');
            let targetPath = urlObj.searchParams.get('path') || urlObj.searchParams.get('file');
            if (!targetPath && req.url.startsWith('/uploads/')) {
              targetPath = urlObj.pathname.replace(/^\/uploads\//, '');
            }
            const fakeReq = {
              method: req.method,
              url: req.url,
              headers: req.headers,
              query: { path: targetPath, ...Object.fromEntries(urlObj.searchParams.entries()) },
            };
            const fakeRes = {
              statusCode: 200,
              setHeader(name, val) { res.setHeader(name, val); },
              status(code) {
                this.statusCode = code;
                res.statusCode = code;
                return this;
              },
              end(data) {
                res.statusCode = this.statusCode;
                return res.end(data);
              },
              json(obj) {
                res.statusCode = this.statusCode;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify(obj));
              },
            };
            return await uploadsHandler(fakeReq, fakeRes);
          } catch (err) {
            console.error('[vite] Uploaded asset serve error:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: err.message }));
          }
        }

        // Admin Auth route: /api/admin/login and /api/admin/session
        if (req.url === '/api/admin/login' || req.url.startsWith('/api/admin/login?') ||
            req.url === '/api/admin/session' || req.url.startsWith('/api/admin/session?')) {
          try {
            const adminLoginHandler = (await import('./api/admin/login.js')).default;
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', async () => {
              try {
                const fakeReq = {
                  method: req.method,
                  url: req.url,
                  headers: req.headers,
                  body: body ? JSON.parse(body) : {},
                };
                const fakeRes = {
                  statusCode: 200,
                  setHeader(name, val) { res.setHeader(name, val); },
                  status(code) {
                    this.statusCode = code;
                    res.statusCode = code;
                    return this;
                  },
                  json(obj) {
                    res.statusCode = this.statusCode;
                    res.setHeader('Content-Type', 'application/json');
                    return res.end(JSON.stringify(obj));
                  },
                };
                await adminLoginHandler(fakeReq, fakeRes);
              } catch (parseErr) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ ok: false, error: parseErr.message }));
              }
            });
            return;
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ ok: false, error: err.message }));
          }
        }

        // Content CMS CRUD route: /api/content (Supabase Content Manager)
        if (req.url === '/api/content' || req.url.startsWith('/api/content?') || req.url.startsWith('/api/content/')) {
          try {
            const contentHandler = (await import('./api/content.js')).default;
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', async () => {
              try {
                const fakeReq = {
                  method: req.method,
                  url: req.url,
                  headers: req.headers,
                  body: body ? JSON.parse(body) : {},
                };
                const fakeRes = {
                  statusCode: 200,
                  setHeader(name, val) { res.setHeader(name, val); },
                  status(code) {
                    this.statusCode = code;
                    res.statusCode = code;
                    return this;
                  },
                  json(obj) {
                    res.statusCode = this.statusCode;
                    res.setHeader('Content-Type', 'application/json');
                    return res.end(JSON.stringify(obj));
                  },
                };
                await contentHandler(fakeReq, fakeRes);
              } catch (parseErr) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ ok: false, error: parseErr.message }));
              }
            });
            return;
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ ok: false, error: err.message }));
          }
        }

        // Products tag sync route
        if (req.url === '/api/products/sync-tags' || req.url.startsWith('/api/products/sync-tags?')) {
          try {
            const cache = await syncRecentProductTags({ force: true, limit: 50 });
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ ok: true, count: Object.keys(cache).length, tags: cache }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ ok: false, error: err.message }));
          }
        }

        // Products catalogue route
        if (req.url === '/api/products' || req.url.startsWith('/api/products?')) {
          try {
            const { getDealerPricingEligibility, maskCatalogPricing } = await import('./api/dealerPricingAuth.js');
            const urlObj = new URL(req.url, 'http://localhost');
            const refresh = urlObj.searchParams.get('refresh') === 'true';

            const { eligible, pricebookId } = await getDealerPricingEligibility(req);
            const targetPb = eligible && pricebookId ? pricebookId : '3334672000000547177';

            if (refresh) {
              await syncRecentProductTags({ force: true, limit: 40 });
            }
            const [rawProducts, categories] = await Promise.all([
              fetchZohoProducts({ refresh, pricebookId: targetPb }),
              fetchZohoCategories({ refresh }),
            ]);
            const products = maskCatalogPricing(rawProducts, eligible);
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
            const { getDealerPricingEligibility, maskProductPricing } = await import('./api/dealerPricingAuth.js');
            const urlObj = new URL(req.url, 'http://localhost');
            const urlParts = urlObj.pathname.split('/');
            const id = urlParts[urlParts.length - 1];

            const { eligible, pricebookId } = await getDealerPricingEligibility(req);
            const targetPb = eligible && pricebookId ? pricebookId : '3334672000000547177';

            const product = await fetchZohoProductById(id, { pricebookId: targetPb });
            if (!product) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ error: 'Product not found in Zoho' }));
            }
            const safeProduct = maskProductPricing(product, eligible);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ ok: true, product: safeProduct }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: err.message }));
          }
        }

        if (req.url.startsWith('/api/dealer/info') && req.method === 'GET') {
          try {
            const dealerInfoHandler = (await import('./api/dealer/info.js')).default;
            const urlObj = new URL(req.url, 'http://localhost');
            const fakeReq = {
              method: 'GET',
              url: req.url,
              headers: req.headers,
              query: Object.fromEntries(urlObj.searchParams.entries()),
            };
            const fakeRes = {
              statusCode: 200,
              setHeader(name, val) { res.setHeader(name, val); },
              status(code) { this.statusCode = code; res.statusCode = code; return this; },
              json(obj) {
                res.statusCode = this.statusCode;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify(obj));
              },
            };
            return await dealerInfoHandler(fakeReq, fakeRes);
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: err.message }));
          }
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
              const rawTitle = `${product.name || 'Sunshine Appliance'} · Sunshine Appliances`;
              const priceStr = product.mrp > 0 ? `₹${Number(product.mrp).toLocaleString('en-IN')}` : 'Price on Request';
              const rawDesc = dealerName
                ? `Retail MRP: ${priceStr} (Incl. of all taxes) · Available with ${dealerName}${dealerLoc ? ` (${dealerLoc})` : ''}`
                : `Retail MRP: ${priceStr} (Incl. of all taxes) · Sunshine ReSTOR`;
              const safeImgUrl = sanitizeUrl(product.img) || '/img/hero-stove.webp';

              const title = escapeHtml(rawTitle);
              const desc = escapeHtml(rawDesc);
              const imgUrl = escapeHtml(safeImgUrl);

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

