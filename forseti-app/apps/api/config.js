// Configuration management for Forseti API
require('dotenv').config();

const config = {
  // Database
  database: {
    url: process.env.DATABASE_URL || 'file:./dev.db',
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'forseti-dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    expiresInRememberMe: process.env.JWT_EXPIRES_IN_REMEMBER_ME || '30d',
  },

  // Server Configuration
  server: {
    port: process.env.PORT || 4000,
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  // CORS Configuration
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? process.env.ALLOWED_ORIGINS?.split(',') || [
          'https://forseti-web.icyfield-da5f7469.uksouth.azurecontainerapps.io',
          'https://forseti.app',
          'https://www.forseti.app'
        ]
      : true,
    credentials: true,
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 5,
  },

  // Security
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 10,
  },

  // OAuth Configuration
  oauth: {
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      callbackUrl: process.env.DISCORD_CALLBACK_URL || '/api/auth/oauth/discord/callback',
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl: process.env.GOOGLE_CALLBACK_URL || '/api/auth/oauth/google/callback',
    },
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    apiUrl: process.env.API_URL || 'http://localhost:4000',
  },

  // Validation
  validation: {
    user: {
      usernameMinLength: 3,
      usernameMaxLength: 20,
      nameMinLength: 2,
      nameMaxLength: 50,
      passwordMinLength: 8,
      bioMaxLength: 500,
    },
    activity: {
      gameMaxLength: 100,
      carMaxLength: 100,
      trackMaxLength: 100,
      descriptionMaxLength: 1000,
      durationMin: 1,
      durationMax: 1440, // 24 hours
    },
  },
};

// Validation function
const validateConfig = () => {
  const errors = [];
  const warnings = [];

  // JWT Secret validation
  if (config.jwt.secret === 'forseti-dev-secret-change-in-production' && config.server.nodeEnv === 'production') {
    errors.push('JWT_SECRET must be changed in production');
  }

  if (config.jwt.secret.length < 32 && config.server.nodeEnv === 'production') {
    errors.push('JWT_SECRET must be at least 32 characters in production');
  }

  // CORS validation
  if (config.server.nodeEnv === 'production' && config.cors.origin === true) {
    errors.push('CORS origin must be specified in production (set ALLOWED_ORIGINS env var)');
  }

  // Database URL validation for production
  if (config.server.nodeEnv === 'production') {
    if (!config.database.url.startsWith('postgresql://')) {
      errors.push('DATABASE_URL must be a PostgreSQL connection string in production');
    }

    if (config.database.url.includes('postgresql://') && !config.database.url.includes('sslmode=require')) {
      warnings.push('DATABASE_URL should include sslmode=require for secure connections to Azure PostgreSQL');
    }
  }

  // Log warnings
  if (warnings.length > 0) {
    console.warn('Configuration warnings:', warnings);
  }

  // Log errors and exit in production
  if (errors.length > 0) {
    console.error('Configuration errors:', errors);
    if (config.server.nodeEnv === 'production') {
      process.exit(1);
    }
  }

  // Log successful config in production
  if (config.server.nodeEnv === 'production' && errors.length === 0) {
    console.log('Configuration validated successfully for production');
    console.log(`- Database: PostgreSQL (SSL: ${config.database.url.includes('sslmode=require') ? 'enabled' : 'disabled'})`);
    console.log(`- CORS origins: ${Array.isArray(config.cors.origin) ? config.cors.origin.join(', ') : config.cors.origin}`);
    console.log(`- Rate limiting: ${config.rateLimit.max} requests per ${config.rateLimit.windowMs / 60000} minutes`);
  }
};

// Run validation
validateConfig();

module.exports = config;
