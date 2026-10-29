import app from "../../backend/src/app.js";

/**
 * Vercel Serverless Function Catch-All for /api/dealers/*
 * Enables 100% serverless dealer staff management & CRM synchronization on restor.in.
 */
export default async function handler(req, res) {
  return new Promise((resolve) => {
    app(req, res, (result) => {
      resolve(result);
    });
  });
}
