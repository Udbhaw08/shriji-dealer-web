import app from "../../backend/src/app.js";

/**
 * Vercel Serverless Function Catch-All for /api/auth/*
 * Enables 100% serverless dealer & staff authentication on restor.in
 * with direct Supabase connectivity, completely decoupled from Render uptime.
 */
export default async function handler(req, res) {
  return new Promise((resolve) => {
    // Pass to Express application
    app(req, res, (result) => {
      resolve(result);
    });
  });
}
