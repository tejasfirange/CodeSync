import crypto from 'crypto';
import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const isProductionEnv = process.env.NODE_ENV === 'production';
const developmentJwtSecret = process.env.JWT_SECRET || (isProductionEnv ? undefined : crypto.randomBytes(48).toString('hex'));
const developmentGithubTokenSecret = process.env.GITHUB_TOKEN_ENCRYPTION_SECRET || (isProductionEnv ? undefined : developmentJwtSecret);

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(5000),
  MONGODB_URI: Joi.string()
    .custom((value, helpers) => {
      if (/^mongodb(\+srv)?:\/\//.test(value)) {
        return value;
      }

      return helpers.message('MONGODB_URI must start with mongodb:// or mongodb+srv://');
    })
    .default('mongodb://127.0.0.1:27017/codesync'),
  CLIENT_URL: Joi.string().default('http://localhost:5173'),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  COOKIE_NAME: Joi.string().default('token'),
  COOKIE_SAME_SITE: Joi.string().valid('strict', 'lax', 'none').default('lax'),
  RATE_LIMIT_WINDOW_MS: Joi.number().integer().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: Joi.number().integer().positive().default(300),
  GITHUB_CLIENT_ID: Joi.string().allow('').default(''),
  GITHUB_CLIENT_SECRET: Joi.string().allow('').default(''),
  GITHUB_REDIRECT_URI: Joi.string().uri().default('http://localhost:5000/api/github/oauth/callback'),
  GITHUB_TOKEN_ENCRYPTION_SECRET: Joi.string().min(32).required(),
  GEMINI_API_KEY: Joi.string().trim().allow('').default(''),
  GEMINI_BASE_URL: Joi.string().uri().default('https://generativelanguage.googleapis.com/v1beta'),
  GEMINI_MODEL: Joi.string().trim().min(1).max(120).default('gemini-3.1-flash-lite')
}).unknown(true);

const { value, error } = envSchema.validate({
  ...process.env,
  JWT_SECRET: developmentJwtSecret,
  GITHUB_TOKEN_ENCRYPTION_SECRET: developmentGithubTokenSecret
});

if (error) {
  throw new Error(`Environment validation failed: ${error.message}`);
}

export const env = {
  nodeEnv: value.NODE_ENV,
  isProduction: value.NODE_ENV === 'production',
  port: value.PORT,
  mongoUri: value.MONGODB_URI,
  clientUrls: value.CLIENT_URL.split(',').map((origin) => origin.trim()).filter(Boolean),
  jwtSecret: value.JWT_SECRET,
  jwtExpiresIn: value.JWT_EXPIRES_IN,
  cookieName: value.COOKIE_NAME,
  cookieSameSite: value.COOKIE_SAME_SITE,
  rateLimitWindowMs: value.RATE_LIMIT_WINDOW_MS,
  rateLimitMax: value.RATE_LIMIT_MAX,
  githubClientId: value.GITHUB_CLIENT_ID,
  githubClientSecret: value.GITHUB_CLIENT_SECRET,
  githubRedirectUri: value.GITHUB_REDIRECT_URI,
  githubTokenEncryptionSecret: value.GITHUB_TOKEN_ENCRYPTION_SECRET,
  geminiApiKey: value.GEMINI_API_KEY,
  geminiBaseUrl: value.GEMINI_BASE_URL,
  geminiModel: value.GEMINI_MODEL
};
