export default function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.split('/').pop();

  // If path is callback or redirected from supabase
  if (path === 'callback' || req.query.code) {
    const redirectUrl = req.query.next || '/app';
    return res.redirect(302, redirectUrl);
  }

  // Default auth response
  res.status(200).json({ status: 'Auth service active' });
}
