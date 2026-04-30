import { env } from './env.js';

const isPrivateNetworkOrigin = (origin) => {
  try {
    const { hostname, protocol } = new URL(origin);

    if (!['http:', 'https:'].includes(protocol)) {
      return false;
    }

    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname.endsWith('.local') ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      /^169\.254\./.test(hostname)
    );
  } catch (error) {
    return false;
  }
};

export const corsOptions = {
  origin(origin, callback) {
    const isConfiguredOrigin = env.clientUrls.includes(origin);
    const isAllowedDevOrigin = !env.isProduction && isPrivateNetworkOrigin(origin);

    if (!origin || isConfiguredOrigin || isAllowedDevOrigin) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
