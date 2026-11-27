import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'shakti-finance-dev-secret-change-in-production';

export function signToken(user) {
  return jwt.sign(
    {
      id: user.id || user._id,
      mobile: user.mobile,
      name: user.name,
      is_demo: Boolean(user.is_demo),
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }
}
