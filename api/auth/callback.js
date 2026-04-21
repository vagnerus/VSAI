/**
 * Vercel Serverless: OAuth Callback Handler
 * Handles the redirect from Supabase OAuth
 */
export default function handler(req, res) {
  // Supabase OAuth callback is handled client-side
  // This just redirects to the app where the Supabase JS client picks up the session
  const redirectUrl = req.query.next || '/app';
  res.redirect(302, redirectUrl);
}
