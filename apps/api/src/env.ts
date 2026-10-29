import 'dotenv/config';

const str = (k: string, fallback = '') => process.env[k]?.trim() || fallback;

export const env = {
  nodeEnv: str('NODE_ENV', 'development'),
  isProd: str('NODE_ENV') === 'production',
  port: Number(str('PORT', '4000')),
  webUrl: str('WEB_URL', 'http://localhost:5173'),
  corsOrigins: str('CORS_ORIGINS', str('WEB_URL', 'http://localhost:5173')).split(',').map((s) => s.trim()),
  jwtSecret: str('JWT_SECRET', 'dev-insecure-secret'),
  cookieSameSite: str('COOKIE_SAMESITE', 'lax') as 'lax' | 'strict' | 'none',
  blobToken: str('BLOB_READ_WRITE_TOKEN'),
  cronSecret: str('CRON_SECRET'),
  s3: {
    bucket: str('S3_BUCKET'),
    region: str('S3_REGION', 'auto'),
    endpoint: str('S3_ENDPOINT'),
    accessKeyId: str('S3_ACCESS_KEY_ID'),
    secretAccessKey: str('S3_SECRET_ACCESS_KEY'),
    publicUrl: str('S3_PUBLIC_URL'),
  },
};

if (env.isProd && env.jwtSecret === 'dev-insecure-secret') {
  throw new Error('JWT_SECRET must be set in production');
}
