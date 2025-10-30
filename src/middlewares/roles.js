export function requireRole(role) {
  return (req, res, next) => {
    const u = req.user || {};
    if (!u.role) return res.status(403).json({ ok: false, message: 'Sin rol' });
    if (u.role !== role) return res.status(403).json({ ok: false, message: 'No autorizado' });
    return next();
  };
}
