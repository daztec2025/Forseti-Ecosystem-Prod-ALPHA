/**
 * @fileoverview Forseti API Server - Racing Telemetry and Social Platform
 *
 * This Express.js server provides the backend API for the Forseti racing telemetry
 * platform. It handles user authentication, activity management, telemetry data
 * storage, social features, and leaderboard calculations.
 *
 * @module api/index
 * @requires express - Web application framework
 * @requires cors - Cross-Origin Resource Sharing middleware
 * @requires @prisma/client - Database ORM client
 * @requires bcrypt - Password hashing library
 * @requires jsonwebtoken - JWT authentication
 * @requires express-rate-limit - Rate limiting middleware
 * @requires helmet - Security headers middleware
 * @requires validator - Input validation and sanitization
 *
 * @description
 * API Endpoints are organized into the following categories:
 * - Authentication: Register, login, JWT token management
 * - Profile: User profile CRUD operations
 * - Activities: Racing session management with telemetry
 * - Telemetry: Lap data, session data, and analysis
 * - Comments & Likes: Social engagement features
 * - Social: Follow/unfollow, friends, relationships
 * - Subscriptions: Pro driver subscription management
 * - Notifications: User notification system
 * - Media: Image/video upload for activities
 * - Leaderboard: Driver ranking calculations
 *
 * @version 1.0.0
 * @author Forseti Development Team
 */

const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');
const config = require('./config');
const claudeService = require('./services/claudeService');
const passport = require('passport');
const oauthRoutes = require('./routes/oauth');

const app = express();
const prisma = new PrismaClient();
const PORT = config.server.port;
const JWT_SECRET = config.jwt.secret;

// For file uploads
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Multer setup for multipart handling. Use disk storage to avoid large memory
// usage for big telemetry files. Files will be removed after processing.
const upload = multer({ dest: path.join(os.tmpdir(), 'forseti-uploads') });

// Media uploads storage configuration - persistent storage for activity media
// In production, use /app/apps/api/uploads (Cloud Run) or override with UPLOADS_DIR env var
// Locally use __dirname/uploads
const baseUploadDir = process.env.NODE_ENV === 'production'
  ? (process.env.UPLOADS_DIR || '/app/apps/api/uploads')
  : path.join(__dirname, 'uploads');
const mediaStorageDir = path.join(baseUploadDir, 'media');
// Ensure the media directory exists
if (!fs.existsSync(mediaStorageDir)) {
  fs.mkdirSync(mediaStorageDir, { recursive: true });
}

const mediaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, mediaStorageDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const mediaUpload = multer({
  storage: mediaStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|webm/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeTypes = /image\/(jpeg|jpg|png|gif)|video\/(mp4|quicktime|webm)/;
    const mime = mimeTypes.test(file.mimetype);
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: JPEG, PNG, GIF, MP4, MOV, WebM'));
    }
  }
});

// Setup files storage configuration - for iRacing .sto setup files
const setupStorageDir = path.join(baseUploadDir, 'setups');
// Ensure the setups directory exists
if (!fs.existsSync(setupStorageDir)) {
  fs.mkdirSync(setupStorageDir, { recursive: true });
}

const setupStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, setupStorageDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const setupUpload = multer({
  storage: setupStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for setup files
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Accept common sim racing setup file formats
    const allowedExtensions = ['.sto', '.json', '.ini', '.svm', '.veh', '.garage'];
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed formats: .sto, .json, .ini, .svm, .veh, .garage'));
    }
  }
});

/**
 * Request logging middleware
 *
 * Logs all incoming HTTP requests with timestamp, method, path, and client IP.
 * Useful for debugging and monitoring API usage.
 *
 * @function requestLogger
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
const requestLogger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
};

app.use(requestLogger);

/**
 * Global error handling middleware
 *
 * Catches all unhandled errors and returns appropriate responses.
 * In production, error details are hidden to prevent information leakage.
 * In development, full error stack traces are returned for debugging.
 *
 * @function errorHandler
 * @param {Error} err - The error object
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Don't leak error details in production
  if (config.server.nodeEnv === 'production') {
    res.status(500).json({ error: 'Internal server error' });
  } else {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
};

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
}));
app.use(cors(config.cors));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: 'Too many requests from this IP, please try again later.'
});
// Apply global rate limiter only in production to avoid interfering with
// local developer testing. Keep auth endpoint limiter in production as well.
if (config.server.nodeEnv === 'production') {
  app.use('/api/', limiter);

  // Stricter rate limiting for auth endpoints
  const authLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.authMax,
    message: 'Too many authentication attempts, please try again later.'
  });
  app.use('/api/auth/', authLimiter);
} else {
  console.debug('Rate limiting disabled in development');
}

app.use(express.json({ limit: '10mb' })); // Increased limit for base64 images

// Initialize Passport (for OAuth)
app.use(passport.initialize());

// Mount OAuth routes
app.use('/api/auth/oauth', oauthRoutes);

// Serve uploaded media files statically
app.use('/uploads', express.static(baseUploadDir));

// Root endpoint - API info
app.get('/', (req, res) => {
  res.json({
    name: 'Forseti API',
    version: '1.0.0',
    description: 'Racing Telemetry and Social Platform API',
    health: '/api/health',
    documentation: 'https://forseti.app/docs'
  });
});

/**
 * Adds URL paths to media objects for client access
 *
 * Transforms media database records by adding a URL field that clients
 * can use to fetch the actual media files from the static file server.
 *
 * @function addMediaUrls
 * @param {Array<Object>} mediaArray - Array of media objects from database
 * @param {string} mediaArray[].filename - The stored filename of the media
 * @returns {Array<Object>} Media array with added URL fields
 *
 * @example
 * const media = [{ id: '1', filename: 'abc123.jpg' }];
 * const withUrls = addMediaUrls(media);
 * // Returns: [{ id: '1', filename: 'abc123.jpg', url: '/uploads/media/abc123.jpg' }]
 */
const addMediaUrls = (mediaArray) => {
  if (!Array.isArray(mediaArray)) return [];
  return mediaArray.map(m => ({
    ...m,
    url: `/uploads/media/${m.filename}`
  }));
};

/**
 * Adds media URLs to an activity object
 *
 * Convenience wrapper that applies addMediaUrls to an activity's media array.
 * Returns the complete activity object with media URLs included.
 *
 * @function addActivityMediaUrls
 * @param {Object} activity - Activity object from database
 * @param {Array<Object>} activity.media - Array of media objects
 * @returns {Object} Activity object with media URLs added
 */
const addActivityMediaUrls = (activity) => {
  if (!activity) return activity;
  return {
    ...activity,
    media: addMediaUrls(activity.media)
  };
};

/**
 * Input validation and sanitization middleware
 *
 * Sanitizes all string inputs in request body to prevent XSS attacks.
 * Uses validator.escape() to encode HTML special characters.
 * Base64 data URLs (for image uploads) are preserved without sanitization.
 *
 * @function validateInput
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 *
 * @security Prevents stored XSS by escaping HTML entities in user input
 */
const validateInput = (req, res, next) => {
  // Remove any potential XSS attempts
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    // Skip sanitization for base64 data URLs (images)
    if (str.startsWith('data:image/')) {
      return str;
    }
    return validator.escape(str.trim());
  };

  const sanitizeObject = (obj) => {
    if (obj && typeof obj === 'object') {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = sanitizeString(obj[key]);
        } else if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key]);
        }
      }
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  next();
};

app.use(validateInput);

// Canonicalize any route param named `userId` so handlers can accept either
// a UUID or a username. This centralizes username->id resolution and keeps
// the database as the single source of truth for user identity.
app.param('userId', async (req, res, next, value) => {
  if (!value) return next();

  try {
    // Try to find by id first (fast path)
    const byId = await prisma.user.findUnique({ where: { id: value }, select: { id: true } });
    if (byId) {
      // replace param with canonical id
      req.params.userId = byId.id;
      return next();
    }
  } catch (e) {
    // ignore malformed id formats
  }

  try {
    // Try to find by username
    const byUsername = await prisma.user.findUnique({ where: { username: value }, select: { id: true } });
    if (byUsername) {
      req.params.userId = byUsername.id;
      return next();
    }
  } catch (e) {
    // ignore
  }

  // If not found we leave the param untouched; route handlers should return
  // 404 where appropriate. Proceed to next middleware/handler.
  return next();
});

/**
 * JWT Authentication middleware
 *
 * Verifies the JWT token from the Authorization header and attaches
 * the decoded user payload to the request object. Returns 401 if no
 * token is provided, or 403 if the token is invalid or expired.
 *
 * @function authenticateToken
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 *
 * @property {Object} req.user - Decoded JWT payload (set after verification)
 * @property {string} req.user.id - User's unique identifier
 * @property {string} req.user.email - User's email address
 *
 * @example
 * // Client sends token in Authorization header:
 * // Authorization: Bearer <jwt_token>
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// ===== AUTH ENDPOINTS =====

/**
 * @route POST /api/auth/register
 * @description Register a new user account
 *
 * Creates a new user with hashed password and returns a JWT token.
 * Validates email format, password length, username format, and checks
 * for existing email/username conflicts.
 *
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - User's email address (must be valid format)
 * @param {string} req.body.password - User's password (min 8 characters)
 * @param {string} req.body.name - User's display name (3-50 characters)
 * @param {string} req.body.username - Unique username (3-30 chars, alphanumeric)
 *
 * @returns {Object} 200 - JWT token and user profile data
 * @returns {Object} 400 - Validation error or email/username already exists
 * @returns {Object} 500 - Registration failed
 *
 * @example
 * // Request body:
 * {
 *   "email": "user@example.com",
 *   "password": "securepass123",
 *   "name": "John Doe",
 *   "username": "johndoe"
 * }
 *
 * // Success response:
 * {
 *   "token": "eyJhbG...",
 *   "user": { "id": "...", "email": "...", "username": "...", ... }
 * }
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, username } = req.body;

    // Debug logging
    console.log('[REGISTER] ============ REGISTRATION REQUEST ============');
    console.log('[REGISTER] Email:', email);
    console.log('[REGISTER] Password length:', password ? password.length : 'undefined');
    console.log('[REGISTER] Name:', name);
    console.log('[REGISTER] Username:', username);
    console.log('[REGISTER] Request body keys:', Object.keys(req.body));

    // Input validation
    if (!email || !password || !name || !username) {
      console.log('[REGISTER] ✗ Missing required fields');
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!validator.isEmail(email)) {
      console.log('[REGISTER] ✗ Invalid email format');
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 8) {
      console.log('[REGISTER] ✗ Password too short. Length:', password.length, 'Required: 8');
      console.log('[REGISTER] ✗ Password value (first 3 chars):', password.substring(0, 3) + '***');
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    if (!validator.isAlphanumeric(username) || 
        username.length < config.validation.user.usernameMinLength || 
        username.length > config.validation.user.usernameMaxLength) {
      return res.status(400).json({ 
        error: `Username must be ${config.validation.user.usernameMinLength}-${config.validation.user.usernameMaxLength} characters and alphanumeric only` 
      });
    }

    if (name.length < config.validation.user.nameMinLength || 
        name.length > config.validation.user.nameMaxLength) {
      return res.status(400).json({ 
        error: `Name must be ${config.validation.user.nameMinLength}-${config.validation.user.nameMaxLength} characters long` 
      });
    }

    // Check if email exists
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Check if username exists
    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      console.log('[REGISTER] ✗ Username already taken:', username);
      return res.status(400).json({ error: 'Username already taken' });
    }

    console.log('[REGISTER] ✓ All validations passed. Creating user...');
    const hashedPassword = await bcrypt.hash(password, config.security.bcryptRounds);
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        name,
      },
    });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: config.jwt.expiresIn });

    console.log('[REGISTER] ✓ User created successfully. ID:', user.id, 'Username:', user.username);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        avatar: user.avatar,
        bio: user.bio,
        isPro: user.isPro,
        isFoundingDriver: user.isFoundingDriver,
        engagementLevel: user.engagementLevel,
        engagementPoints: user.engagementPoints,
      },
    });
  } catch (error) {
    console.error('[REGISTER] ✗ Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * @route POST /api/auth/login
 * @description Authenticate user and return JWT token
 *
 * Validates email/password credentials and returns a JWT token.
 * Supports "remember me" functionality for extended token expiration.
 *
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - User's email address
 * @param {string} req.body.password - User's password
 * @param {boolean} [req.body.rememberMe=false] - Extend token expiration
 *
 * @returns {Object} 200 - JWT token and user profile data
 * @returns {Object} 401 - Invalid credentials
 * @returns {Object} 500 - Login failed
 *
 * @example
 * // Request body:
 * { "email": "user@example.com", "password": "pass123", "rememberMe": true }
 *
 * // Success response:
 * {
 *   "token": "eyJhbG...",
 *   "user": { "id": "...", "email": "...", "isPro": false, ... }
 * }
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Use extended expiration if rememberMe is true
    const expiresIn = rememberMe ? config.jwt.expiresInRememberMe : config.jwt.expiresIn;
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        avatar: user.avatar,
        bio: user.bio,
        isPro: user.isPro,
        isFoundingDriver: user.isFoundingDriver,
        engagementLevel: user.engagementLevel,
        engagementPoints: user.engagementPoints,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ===== USER/PROFILE ENDPOINTS =====

/**
 * @route GET /api/profile
 * @description Get authenticated user's profile
 * @access Private (requires JWT)
 *
 * @returns {Object} 200 - User profile data
 * @returns {Object} 404 - User not found
 * @returns {Object} 500 - Failed to fetch profile
 */
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatar: true,
        bio: true,
        isPro: true,
        isFoundingDriver: true,
        engagementLevel: true,
        engagementPoints: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update profile
app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const { name, username, avatar, bio } = req.body;

    // If username is being changed, check if it's available
    if (username) {
      const existingUsername = await prisma.user.findUnique({ where: { username } });
      if (existingUsername && existingUsername.id !== req.user.id) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name }),
        ...(username && { username }),
        ...(avatar !== undefined && { avatar }),
        ...(bio !== undefined && { bio }),
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatar: true,
        bio: true,
        isPro: true,
      },
    });

    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ===== ACTIVITY ENDPOINTS =====

// Get current user's activities
app.get('/api/activities', authenticateToken, async (req, res) => {
  try {
    const { filter } = req.query; // 'my', 'friends', 'all'

    let whereClause = {};

    if (filter === 'my' || !filter) {
      // Default to user's own activities (show all including private)
      whereClause = { userId: req.user.id };
    } else if (filter === 'friends') {
      // Get activities from users the current user is following (exclude private)
      const following = await prisma.follow.findMany({
        where: { followerId: req.user.id },
        select: { followingId: true },
      });
      const followingIds = following.map(f => f.followingId);
      whereClause = {
        userId: { in: followingIds },
        isPrivate: false // Only show public activities from friends
      };
    } else if (filter === 'all') {
      // Get all activities (could be limited to friends + user)
      const following = await prisma.follow.findMany({
        where: { followerId: req.user.id },
        select: { followingId: true },
      });
      const followingIds = following.map(f => f.followingId);
      whereClause = {
        OR: [
          { userId: req.user.id }, // User's own activities (including private)
          {
            userId: { in: followingIds },
            isPrivate: false // Only show public activities from friends
          }
        ]
      };
    }

    const activities = await prisma.activity.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            isPro: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
            likes: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        likes: true,
        media: {
          orderBy: {
            order: 'asc',
          },
        },
        telemetry: {
          select: {
            id: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });
    // Development-time diagnostic: ensure data is serializable to JSON.
    try {
      JSON.stringify(activities);
    } catch (serr) {
      console.error('Activities serialization error:', serr);
      // Try to find which activity causes the serialization issue
      for (const a of activities) {
        try {
          JSON.stringify(a);
        } catch (singleErr) {
          console.error('Problem serializing activity id:', a.id, singleErr);
        }
      }
      // Surface the full error in development to help debugging
      if (config.server.nodeEnv !== 'production') {
        return res.status(500).json({ error: 'Activities serialization error', stack: serr.stack || String(serr) });
      }
      return res.status(500).json({ error: 'Failed to fetch activities' });
    }

    // Log whereClause in dev for reproducibility
    if (config.server.nodeEnv !== 'production') {
      console.debug('Get activities whereClause:', whereClause, 'count:', activities.length, 'filter:', filter);
    }

    // If the client requested the "my" filter (dashboard), return the full
    // activity objects including comments and likes so the dashboard UI has
    // authoritative data immediately (matching /api/activities/user/:userId).
    // For other filters we keep returning a lightweight sanitized DTO to
    // reduce payload size for feeds.
    if (filter === 'my') {
      return res.json(activities.map(addActivityMediaUrls));
    }

    // Sanitize activities before returning to avoid deep nesting or unexpected
    // serialization issues in development. This returns a shallow DTO that the
    // frontend can use for lists and profile pages. Detailed activity data is
    // still available via the GET /api/activities/:activityId endpoint.
    const sanitized = activities.map(a => ({
      userId: a.userId,
      id: a.id,
      user: a.user,
      game: a.game,
      duration: a.duration,
      performance: a.performance,
      date: a.date,
      car: a.car,
      fastestLap: a.fastestLap,
      track: a.track,
      trackTemperature: a.trackTemperature,
      trackCondition: a.trackCondition,
      airTemperature: a.airTemperature,
      setupFilename: a.setupFilename,
      description: a.description,
      isPrivate: a.isPrivate,
      createdAt: a.createdAt,
      commentsCount: Array.isArray(a.comments) ? a.comments.length : 0,
      likesCount: Array.isArray(a.likes) ? a.likes.length : 0,
      comments: a.comments || [],
      likes: a.likes || [],
      media: addMediaUrls(a.media),
      telemetry: a.telemetry ? { id: a.telemetry.id, createdAt: a.telemetry.createdAt } : undefined,
    }));

    res.json(sanitized);
  } catch (error) {
    console.error('Get activities error:', error);
    if (config.server.nodeEnv !== 'production') {
      return res.status(500).json({ error: error.message || 'Failed to fetch activities', stack: error.stack });
    }
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Get user's activities
app.get('/api/activities/user/:userId', authenticateToken, async (req, res) => {
  try {
    // Accept either a UUID id or a username in the route param. Resolve to
    // canonical user.id to keep the database as the single source of truth.
    const param = req.params.userId
    let targetUserId = param

    // Check if full telemetry data is requested (for dashboard metrics calculation)
    const includeTelemetry = req.query.includeTelemetry === 'true'

    // Try to find by id first
    let found = null
    try {
      found = await prisma.user.findUnique({ where: { id: param }, select: { id: true } })
    } catch (e) {
      // ignore malformed id
      found = null
    }

    if (!found) {
      // Try by username
      const byUsername = await prisma.user.findUnique({ where: { username: param }, select: { id: true } })
      if (byUsername) found = byUsername
    }

    if (!found) {
      return res.status(404).json({ error: 'User not found' })
    }

    targetUserId = found.id

    // Build where clause - show private activities only if viewing own profile
    const isOwnProfile = targetUserId === req.user.id;
    const whereClause = isOwnProfile
      ? { userId: targetUserId }
      : { userId: targetUserId, isPrivate: false };

    // Build telemetry include based on request
    const telemetryInclude = includeTelemetry
      ? {
          select: {
            id: true,
            createdAt: true,
            lapData: true,
            sessionData: true,
          },
        }
      : {
          select: {
            id: true,
            createdAt: true,
          },
        };

    const activities = await prisma.activity.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            isPro: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
              },
            },
            likes: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        likes: true,
        media: {
          orderBy: {
            order: 'asc',
          },
        },
        telemetry: telemetryInclude,
      },
      orderBy: {
        date: 'desc',
      },
    });

    // Parse telemetry JSON data if included
    const processedActivities = activities.map(activity => {
      const processed = addActivityMediaUrls(activity);
      if (includeTelemetry && processed.telemetry) {
        try {
          if (processed.telemetry.lapData && typeof processed.telemetry.lapData === 'string') {
            processed.telemetry.lapData = JSON.parse(processed.telemetry.lapData);
          }
          if (processed.telemetry.sessionData && typeof processed.telemetry.sessionData === 'string') {
            processed.telemetry.sessionData = JSON.parse(processed.telemetry.sessionData);
          }
        } catch (e) {
          console.error('Failed to parse telemetry JSON:', e);
        }
      }
      return processed;
    });

    res.json(processedActivities);
  } catch (error) {
    console.error('Get user activities error:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Get user's own activities filtered by car and track (for telemetry comparison)
app.get('/api/activities/my/filter', authenticateToken, async (req, res) => {
  try {
    const { car, track } = req.query;

    // Build where clause - only user's own activities with telemetry
    const whereClause = {
      userId: req.user.id,
      telemetry: { isNot: null }
    };

    // Add optional car/track filters
    if (car) whereClause.car = car;
    if (track) whereClause.track = track;

    const activities = await prisma.activity.findMany({
      where: whereClause,
      select: {
        id: true,
        date: true,
        car: true,
        track: true,
        fastestLap: true,
        description: true,
        telemetry: {
          select: { id: true }
        }
      },
      orderBy: { date: 'desc' }
    });

    res.json(activities);
  } catch (error) {
    console.error('Filter activities error:', error);
    res.status(500).json({ error: 'Failed to filter activities' });
  }
});

// Create activity
app.post('/api/activities', authenticateToken, async (req, res) => {
  try {
    const { game, duration, performance, date, car, fastestLap, track, description, telemetryData, isPrivate, trackCondition: reqTrackCondition, trackTemperature: reqTrackTemperature, airTemperature: reqAirTemperature } = req.body;

    console.log('[TELEMETRY] ============ API: RECEIVED ACTIVITY CREATE REQUEST ============');
    console.log('[TELEMETRY] User ID:', req.user.id);
    console.log('[TELEMETRY] Track:', track);
    console.log('[TELEMETRY] Car:', car);
    console.log('[TELEMETRY] Fastest lap:', fastestLap);
    console.log('[TELEMETRY] Duration:', duration, 'minutes');
    console.log('[TELEMETRY] Has telemetry data:', !!telemetryData);

    if (telemetryData) {
      console.log('[TELEMETRY] Telemetry data structure:');
      console.log('[TELEMETRY]   sessionData:', !!telemetryData.sessionData);
      console.log('[TELEMETRY]   lapData:', telemetryData.lapData ? telemetryData.lapData.length : 0, 'laps');
      console.log('[TELEMETRY]   referenceLap:', !!telemetryData.referenceLap);

      if (telemetryData.lapData) {
        console.log('[TELEMETRY]   Lap details:');
        telemetryData.lapData.forEach((lap, index) => {
          console.log(`[TELEMETRY]     Lap ${lap.lapNumber}: ${lap.lapTimeFormatted || lap.lapTime}s (${lap.telemetryPoints?.length || 0} points)`);
        });
      }
    }

    // Input validation
    if (!game || !duration || !performance || !date) {
      console.log('[TELEMETRY] ✗ Validation failed: Missing required fields');
      return res.status(400).json({ error: 'Required fields: game, duration, performance, date' });
    }

    if (typeof duration !== 'number' || 
        duration < config.validation.activity.durationMin || 
        duration > config.validation.activity.durationMax) {
      return res.status(400).json({ 
        error: `Duration must be between ${config.validation.activity.durationMin} and ${config.validation.activity.durationMax} minutes` 
      });
    }

    if (typeof game !== 'string' || game.length > config.validation.activity.gameMaxLength) {
      return res.status(400).json({ 
        error: `Game name must be a string under ${config.validation.activity.gameMaxLength} characters` 
      });
    }

    if (car && (typeof car !== 'string' || car.length > config.validation.activity.carMaxLength)) {
      return res.status(400).json({ 
        error: `Car name must be a string under ${config.validation.activity.carMaxLength} characters` 
      });
    }

    if (track && (typeof track !== 'string' || track.length > config.validation.activity.trackMaxLength)) {
      return res.status(400).json({ 
        error: `Track name must be a string under ${config.validation.activity.trackMaxLength} characters` 
      });
    }

    if (description && (typeof description !== 'string' || description.length > config.validation.activity.descriptionMaxLength)) {
      return res.status(400).json({ 
        error: `Description must be under ${config.validation.activity.descriptionMaxLength} characters` 
      });
    }

    // Validate date
    const activityDate = new Date(date);
    if (isNaN(activityDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    // Extract track temperature and condition - prefer request body values over telemetry data
    const trackTemperature = reqTrackTemperature !== undefined && reqTrackTemperature !== null
      ? reqTrackTemperature
      : (telemetryData?.sessionData?.trackTemperature || null);
    const airTemperature = reqAirTemperature !== undefined && reqAirTemperature !== null
      ? reqAirTemperature
      : (telemetryData?.sessionData?.airTemperature || null);
    const trackCondition = reqTrackCondition || telemetryData?.sessionData?.trackCondition || null;

    console.log('[TELEMETRY] Track condition:', trackCondition);
    console.log('[TELEMETRY] Track temperature:', trackTemperature);
    console.log('[TELEMETRY] Air temperature:', airTemperature);

    // Create activity and telemetry data in a transaction
    const [activity, user] = await prisma.$transaction(async (tx) => {
      // Create the activity
      const newActivity = await tx.activity.create({
        data: {
          userId: req.user.id,
          game,
          duration,
          performance,
          date: new Date(date),
          car,
          fastestLap,
          track,
          description,
          isPrivate: isPrivate || false,
          trackTemperature,
          airTemperature,
          trackCondition,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
              isPro: true,
            },
          },
          comments: true,
          telemetry: true,
        },
      });

      // Create telemetry data if provided
      if (telemetryData) {
        console.log('[TELEMETRY] Creating TelemetryData record for activity:', newActivity.id);
        const telemetryRecord = await tx.telemetryData.create({
          data: {
            activityId: newActivity.id,
            sessionData: JSON.stringify(telemetryData.sessionData || {}),
            lapData: JSON.stringify(telemetryData.lapData || []),
            referenceLap: telemetryData.referenceLap ? JSON.stringify(telemetryData.referenceLap) : null,
          },
        });
        console.log('[TELEMETRY] ✓ TelemetryData record created, ID:', telemetryRecord.id);
      } else {
        console.log('[TELEMETRY] ⚠ No telemetry data provided - activity will have no telemetry');
      }

      // Award 1 engagement point and update level if needed
      const updatedUser = await tx.user.findUnique({
        where: { id: req.user.id },
        select: { engagementPoints: true, engagementLevel: true }
      });

      const newPoints = (updatedUser.engagementPoints || 0) + 1;
      let newLevel = updatedUser.engagementLevel || 'bronze';

      // Update level based on points
      if (newPoints >= 600) newLevel = 'platinum';
      else if (newPoints >= 300) newLevel = 'gold';
      else if (newPoints >= 100) newLevel = 'silver';
      else newLevel = 'bronze';

      await tx.user.update({
        where: { id: req.user.id },
        data: {
          engagementPoints: newPoints,
          engagementLevel: newLevel
        }
      });

      return [newActivity, updatedUser];
    });

    console.log('[TELEMETRY] ✓ Transaction completed successfully');
    console.log('[TELEMETRY] ✓ Activity created with ID:', activity.id);
    console.log('[TELEMETRY] ✓ Telemetry record:', activity.telemetry ? 'ATTACHED' : 'NOT ATTACHED');

    res.json(activity);
  } catch (error) {
    console.error('[TELEMETRY] ✗ Create activity error:', error);
    console.error('[TELEMETRY] Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to create activity' });
  }
});

// Update activity
app.put('/api/activities/:activityId', authenticateToken, async (req, res) => {
  try {
    const { activityId } = req.params;
    const { game, duration, performance, date, car, fastestLap, track, description, telemetryData, isPrivate, trackTemperature, trackCondition } = req.body;

    // Check if activity belongs to user
    const existing = await prisma.activity.findUnique({
      where: { id: activityId },
    });

    if (!existing || existing.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const activity = await prisma.$transaction(async (tx) => {
      // Update the activity
      const updatedActivity = await tx.activity.update({
        where: { id: activityId },
        data: {
          ...(game && { game }),
          ...(duration && { duration }),
          ...(performance && { performance }),
          ...(date && { date: new Date(date) }),
          ...(car !== undefined && { car }),
          ...(fastestLap !== undefined && { fastestLap }),
          ...(track !== undefined && { track }),
          ...(description !== undefined && { description }),
          ...(isPrivate !== undefined && { isPrivate }),
          ...(trackTemperature !== undefined && { trackTemperature }),
          ...(trackCondition !== undefined && { trackCondition }),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
              isPro: true,
            },
          },
          comments: true,
          telemetry: true,
        },
      });

      // Update telemetry data if provided
      if (telemetryData) {
        await tx.telemetryData.upsert({
          where: { activityId: activityId },
          update: {
            sessionData: JSON.stringify(telemetryData.sessionData || {}),
            lapData: JSON.stringify(telemetryData.lapData || []),
            referenceLap: telemetryData.referenceLap ? JSON.stringify(telemetryData.referenceLap) : null,
            updatedAt: new Date(),
          },
          create: {
            activityId: activityId,
            sessionData: JSON.stringify(telemetryData.sessionData || {}),
            lapData: JSON.stringify(telemetryData.lapData || []),
            referenceLap: telemetryData.referenceLap ? JSON.stringify(telemetryData.referenceLap) : null,
          },
        });
      }

      return updatedActivity;
    });

    res.json(activity);
  } catch (error) {
    console.error('Update activity error:', error);
    res.status(500).json({ error: 'Failed to update activity' });
  }
});

// Get telemetry data for analyst
app.get('/api/activities/:activityId/telemetry', authenticateToken, async (req, res) => {
  try {
    const { activityId } = req.params;

    console.log('[TELEMETRY] ============ API: TELEMETRY FETCH REQUEST ============');
    console.log('[TELEMETRY] Activity ID:', activityId);
    console.log('[TELEMETRY] User ID:', req.user.id);

    // Check if activity exists and user has access
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true, userId: true, track: true, car: true }
    });

    if (!activity) {
      console.log('[TELEMETRY] ✗ Activity not found');
      return res.status(404).json({ error: 'Activity not found' });
    }

    console.log('[TELEMETRY] Activity found - Track:', activity.track, 'Car:', activity.car);
    console.log('[TELEMETRY] Activity owner:', activity.userId);

    // Check if user owns the activity, is following the owner, or is subscribed to a PRO driver owner
    const isOwner = activity.userId === req.user.id;

    let hasAccess = isOwner;

    if (!hasAccess) {
      // Check if following
      const isFollowing = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: req.user.id,
            followingId: activity.userId
          }
        }
      });

      if (isFollowing) {
        hasAccess = true;
      } else {
        // Check if subscribed to PRO driver owner (for public activities)
        const activityOwner = await prisma.user.findUnique({
          where: { id: activity.userId },
          select: { isPro: true }
        });

        if (activityOwner?.isPro) {
          // Check if activity is public and user is subscribed
          const activityWithPrivacy = await prisma.activity.findUnique({
            where: { id: activityId },
            select: { isPrivate: true }
          });

          if (!activityWithPrivacy?.isPrivate) {
            const subscription = await prisma.driverSubscription.findUnique({
              where: {
                subscriberId_driverId: {
                  subscriberId: req.user.id,
                  driverId: activity.userId
                },
                status: 'active'
              }
            });

            if (subscription) {
              hasAccess = true;
              console.log('[TELEMETRY] ✓ Access granted via PRO driver subscription');
            }
          }
        }
      }
    }

    if (!hasAccess) {
      console.log('[TELEMETRY] ✗ Access denied - user does not own activity, is not following owner, and has no active subscription');
      return res.status(403).json({ error: 'Access denied' });
    }

    console.log('[TELEMETRY] ✓ Access granted');

    // Get telemetry data
    const telemetryData = await prisma.telemetryData.findUnique({
      where: { activityId: activityId }
    });

    if (!telemetryData) {
      console.log('[TELEMETRY] ✗ TelemetryData record NOT FOUND for activity:', activityId);
      console.log('[TELEMETRY] This activity has no telemetry attached');
      return res.status(404).json({ error: 'Telemetry data not found' });
    }

    console.log('[TELEMETRY] ✓ TelemetryData record found, ID:', telemetryData.id);

    // Parse JSON data
    const parsedData = {
      id: telemetryData.id,
      activityId: activity.id,
      sessionData: JSON.parse(telemetryData.sessionData),
      lapData: JSON.parse(telemetryData.lapData),
      referenceLap: telemetryData.referenceLap ? JSON.parse(telemetryData.referenceLap) : null,
      createdAt: telemetryData.createdAt,
      updatedAt: telemetryData.updatedAt
    };

    console.log('[TELEMETRY] ✓ Telemetry data parsed successfully');
    console.log('[TELEMETRY] Lap data:', parsedData.lapData.length, 'laps');
    console.log('[TELEMETRY] Lap details:');
    parsedData.lapData.forEach((lap, index) => {
      console.log(`[TELEMETRY]   Lap ${lap.lapNumber}: ${lap.lapTimeFormatted || lap.lapTime}s (${lap.telemetryPoints?.length || 0} points)`);
    });

    res.json(parsedData);
  } catch (error) {
    console.error('[TELEMETRY] ✗ Get telemetry error:', error);
    console.error('[TELEMETRY] Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch telemetry data' });
  }
});

// Get reference laps for comparison (filtered by car and track)
app.get('/api/activities/:activityId/reference-laps', authenticateToken, async (req, res) => {
  try {
    const { activityId } = req.params;

    // Get the current activity to extract car and track
    const currentActivity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true, userId: true, track: true, car: true }
    });

    if (!currentActivity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // Check if user owns the activity
    if (currentActivity.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { track, car } = currentActivity;

    // Find all user's activities with the same car and track that have telemetry
    const matchingActivities = await prisma.activity.findMany({
      where: {
        userId: req.user.id,
        track: track,
        car: car,
        NOT: {
          id: activityId // Exclude current activity
        },
        telemetry: {
          isNot: null // Only include activities with telemetry data
        }
      },
      include: {
        telemetry: {
          select: {
            id: true,
            sessionData: true,
            lapData: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    // Parse telemetry data and extract lap information
    const referenceLaps = [];

    for (const activity of matchingActivities) {
      if (!activity.telemetry || !activity.telemetry.lapData) continue;

      try {
        const lapData = JSON.parse(activity.telemetry.lapData);
        const sessionData = activity.telemetry.sessionData ? JSON.parse(activity.telemetry.sessionData) : {};

        // Extract all valid laps from this activity
        if (Array.isArray(lapData)) {
          for (const lap of lapData) {
            // Only include laps with valid lap times and telemetry points
            if (lap.lapNumber > 0 && lap.lapTime > 0 && lap.telemetryPoints && lap.telemetryPoints.length > 0) {
              referenceLaps.push({
                activityId: activity.id,
                activityDate: activity.date,
                lapNumber: lap.lapNumber,
                lapTime: lap.lapTime,
                lapTimeFormatted: lap.lapTimeFormatted,
                telemetryDataId: activity.telemetry.id,
                trackName: sessionData.trackName || track,
                carName: sessionData.carName || car,
                telemetryPoints: lap.telemetryPoints
              });
            }
          }
        }
      } catch (parseError) {
        console.error('Failed to parse telemetry for activity:', activity.id, parseError);
      }
    }

    // Sort by fastest lap time (ascending)
    referenceLaps.sort((a, b) => a.lapTime - b.lapTime);

    // Get Pro driver laps from subscribed drivers
    const proDriverLaps = [];

    // Get user's active subscriptions
    const subscriptions = await prisma.driverSubscription.findMany({
      where: {
        subscriberId: req.user.id,
        status: 'active'
      },
      select: { driverId: true }
    });

    if (subscriptions.length > 0) {
      const subscribedDriverIds = subscriptions.map(s => s.driverId);

      // Find public activities from subscribed Pro drivers with same car/track
      const proActivities = await prisma.activity.findMany({
        where: {
          userId: { in: subscribedDriverIds },
          track: track,
          car: car,
          isPrivate: false, // Only public activities
          telemetry: {
            isNot: null
          }
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true
            }
          },
          telemetry: {
            select: {
              id: true,
              sessionData: true,
              lapData: true,
              createdAt: true
            }
          }
        },
        orderBy: {
          date: 'desc'
        }
      });

      // Parse Pro driver telemetry
      for (const activity of proActivities) {
        if (!activity.telemetry || !activity.telemetry.lapData) continue;

        try {
          const lapData = JSON.parse(activity.telemetry.lapData);
          const sessionData = activity.telemetry.sessionData ? JSON.parse(activity.telemetry.sessionData) : {};

          if (Array.isArray(lapData)) {
            for (const lap of lapData) {
              if (lap.lapNumber > 0 && lap.lapTime > 0 && lap.telemetryPoints && lap.telemetryPoints.length > 0) {
                proDriverLaps.push({
                  activityId: activity.id,
                  activityTitle: activity.title,
                  activityDate: activity.date,
                  lapNumber: lap.lapNumber,
                  lapTime: lap.lapTime,
                  lapTimeFormatted: lap.lapTimeFormatted,
                  telemetryDataId: activity.telemetry.id,
                  trackName: sessionData.trackName || track,
                  carName: sessionData.carName || car,
                  telemetryPoints: lap.telemetryPoints,
                  driver: activity.user,
                  isProDriverLap: true
                });
              }
            }
          }
        } catch (parseError) {
          console.error('Failed to parse Pro driver telemetry for activity:', activity.id, parseError);
        }
      }

      // Sort Pro driver laps by fastest lap time
      proDriverLaps.sort((a, b) => a.lapTime - b.lapTime);
    }

    res.json({
      userLaps: referenceLaps,
      proDriverLaps: proDriverLaps
    });
  } catch (error) {
    console.error('Get reference laps error:', error);
    res.status(500).json({ error: 'Failed to fetch reference laps' });
  }
});

/**
 * Synthesize lap data from TelemetryPoint rows for an activity
 *
 * This function processes raw telemetry points (e.g., from CSV uploads) and
 * groups them into laps based on lap number indicators or timing resets.
 * It computes lap times, formats them, and persists the structured lapData
 * into the TelemetryData table for subsequent analysis.
 *
 * @async
 * @function synthesizeLapData
 * @param {string} activityId - The activity ID to synthesize lap data for
 *
 * @returns {Object} Result object
 * @returns {number} returns.laps - Number of laps synthesized
 * @returns {Array<Object>} returns.lapData - Array of lap data objects
 *
 * @description
 * Processing steps:
 * 1. Fetches all TelemetryPoint rows for the activity
 * 2. Parses JSON data from each point to extract lap info
 * 3. Groups points by lap number (explicit or inferred)
 * 4. Computes lap time from timestamps or explicit lapTime fields
 * 5. Formats lap time as MM:SS.mmm
 * 6. Creates/updates TelemetryData record with synthesized data
 *
 * @example
 * const result = await synthesizeLapData('activity-uuid-here');
 * // Returns: { laps: 5, lapData: [...] }
 */
async function synthesizeLapData(activityId) {
  // Fetch telemetry points for this activity ordered by pointIndex/time
  const points = await prisma.telemetryPoint.findMany({ where: { activityId }, orderBy: [{ pointIndex: 'asc' }, { timeMs: 'asc' }] });
  if (!points || points.length === 0) return { laps: 0, lapData: [] };

  // Parse stored point.data JSON and attach relevant numeric fields
  const parsedPoints = points.map(p => {
    let parsed = {};
    try { parsed = JSON.parse(p.data); } catch (e) { parsed = {}; }
    return {
      pointIndex: p.pointIndex,
      timeMs: p.timeMs,
      lap: parsed.lap ? parseInt(parsed.lap, 10) : (parsed.lapNumber ? parseInt(parsed.lapNumber, 10) : null),
      lapTime: parsed.lapTime || parsed.lapCurrentLapTime || parsed.lapLastLapTime || null,
      telemetry: parsed,
    };
  });

  // Group points into laps. Prefer explicit lap numbers when present.
  const lapsMap = new Map();
  let inferredLap = 1;
  for (const p of parsedPoints) {
    const lapKey = (p.lap !== null && !isNaN(p.lap)) ? p.lap : inferredLap;
    if (!lapsMap.has(lapKey)) lapsMap.set(lapKey, []);
    lapsMap.get(lapKey).push(p);
    // If lap wasn't explicit, try to detect lap boundary by lapTime resetting
    if (p.lap === null && p.lapTime && p.lapTime < 1 && lapsMap.get(lapKey).length > 10) {
      // Start a new inferred lap for subsequent points
      inferredLap += 1;
    }
  }

  // Build lapData array
  const lapData = [];
  for (const [lapNumber, pts] of lapsMap.entries()) {
    if (!Array.isArray(pts) || pts.length === 0) continue;

    // Compute lapTime: prefer explicit lapTime from last point or compute from first/last timestamps
    let lapTime = null;
    const lastPoint = pts[pts.length - 1];
    const firstPoint = pts[0];
    if (lastPoint && lastPoint.lapTime) lapTime = Number(lastPoint.lapTime);
    else if (firstPoint && lastPoint && firstPoint.timeMs && lastPoint.timeMs) {
      lapTime = (lastPoint.timeMs - firstPoint.timeMs) / 1000.0; // convert ms -> seconds
    }

    const lapTimeFormatted = (lapTime !== null && lapTime > 0) ? (() => {
      const mins = Math.floor(lapTime / 60);
      const secs = Math.floor(lapTime % 60);
      const ms = Math.floor((lapTime % 1) * 1000);
      return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    })() : '--:--.---';

    // Extract raw telemetryPoints array suitable for Analyst (keep limited fields)
    const telemetryPoints = pts.map(pp => ({
      timestamp: pp.timeMs || null,
      sessionTime: pp.telemetry.sessionTime || null,
      speed: pp.telemetry.speed ? Number(pp.telemetry.speed) : null,
      throttle: pp.telemetry.throttle ? Number(pp.telemetry.throttle) : null,
      brake: pp.telemetry.brake ? Number(pp.telemetry.brake) : null,
      steering: pp.telemetry.steering ? Number(pp.telemetry.steering) : null,
      lap: pp.lap,
      lapTime: pp.lapTime,
    }));

    lapData.push({
      lapNumber: Number(lapNumber),
      lapTime,
      lapTimeFormatted,
      telemetryPoints,
    });
  }

  // Sort lapData by lapNumber
  lapData.sort((a, b) => a.lapNumber - b.lapNumber);

  // Update or create telemetryData record with synthesized lapData and sessionData summary
  const sessionDurationMinutes = lapData.reduce((acc, l) => acc + (l.lapTime || 0), 0) / 60.0;
  const sessionDataSummary = {
    synthesizedFromPoints: true,
    totalLaps: lapData.length,
    sessionDuration: Math.round(sessionDurationMinutes),
  };

  const existing = await prisma.telemetryData.findUnique({ where: { activityId } });
  if (existing) {
    await prisma.telemetryData.update({ where: { activityId }, data: { lapData: JSON.stringify(lapData), sessionData: JSON.stringify(sessionDataSummary), updatedAt: new Date() } });
  } else {
    await prisma.telemetryData.create({ data: { activityId, lapData: JSON.stringify(lapData), sessionData: JSON.stringify(sessionDataSummary) } });
  }

  return { laps: lapData.length, lapData };
}

// Endpoint to synthesize lap data on-demand (keeps backward compatibility)
app.post('/api/activities/:activityId/telemetry/laps', authenticateToken, async (req, res) => {
  try {
    const { activityId } = req.params;
    const activity = await prisma.activity.findUnique({ where: { id: activityId }, select: { id: true, userId: true } });
    if (!activity) return res.status(404).json({ error: 'Activity not found' });

    const hasAccess = activity.userId === req.user.id ||
      await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: req.user.id, followingId: activity.userId } } });

    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    const result = await synthesizeLapData(activityId);
    res.json({ laps: result.laps, activityId });
  } catch (error) {
    console.error('Synthesize laps error:', error);
    res.status(500).json({ error: 'Failed to synthesize lap data' });
  }
});

// Upload telemetry CSV for an activity and ingest into TelemetryPoint rows.
// Accepts multipart/form-data with fields: activityId (string) and telemetryFile.
app.post('/api/telemetry/upload', authenticateToken, upload.single('telemetryFile'), async (req, res) => {
  try {
    const file = req.file;
    const { activityId } = req.body;

    if (!file) return res.status(400).json({ error: 'telemetryFile is required' });
    if (!activityId) return res.status(400).json({ error: 'activityId is required' });

    // Ensure activity exists and user has permission (owner or follower)
    const activity = await prisma.activity.findUnique({ where: { id: activityId }, select: { id: true, userId: true } });
    if (!activity) {
      // Remove uploaded file
      fs.unlink(file.path, () => {});
      return res.status(404).json({ error: 'Activity not found' });
    }

    const hasAccess = activity.userId === req.user.id ||
      await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: req.user.id, followingId: activity.userId } }
      });

    if (!hasAccess) {
      fs.unlink(file.path, () => {});
      return res.status(403).json({ error: 'Access denied' });
    }

    // Stream and parse CSV, then batch insert
    const batchSize = 500;
    const rows = [];
    let inserted = 0;
    let index = 0;

    await new Promise((resolve, reject) => {
      fs.createReadStream(file.path)
        .pipe(csv())
        .on('data', (data) => {
          // data is an object of columnName -> string
          // We'll store the JSON string and optional time/pointIndex if present
          const timeMs = data.timeMs ? parseInt(data.timeMs, 10) : (data.time ? parseInt(data.time, 10) : null);
          const pointIndex = data.pointIndex ? parseInt(data.pointIndex, 10) : index;
          rows.push({ activityId, pointIndex, timeMs, data: JSON.stringify(data) });
          index += 1;

          if (rows.length >= batchSize) {
            // Pause stream by pausing the reader; but csv-parser doesn't expose pause easily,
            // so we simply perform a sync insert and clear rows array.
            const toInsert = rows.splice(0, rows.length);
            prisma.telemetryPoint.createMany({ data: toInsert }).then((r) => {
              inserted += r.count || toInsert.length;
            }).catch(err => {
              console.error('Batch insert error:', err);
              // swallow to allow cleanup; reject to abort
              reject(err);
            });
          }
        })
        .on('end', async () => {
          try {
            if (rows.length > 0) {
              const r = await prisma.telemetryPoint.createMany({ data: rows });
              inserted += r.count || rows.length;
            }
            resolve();
          } catch (err) {
            reject(err);
          }
        })
        .on('error', (err) => {
          reject(err);
        });
    });

    // Cleanup uploaded file
    fs.unlink(file.path, () => {});

    // After ingesting points, synthesize lapData from the inserted TelemetryPoint rows
    try {
      const synthResult = await synthesizeLapData(activityId);
      // Return counts plus synthesized lap count
      res.json({ inserted, activityId, synthesizedLaps: synthResult.laps });
    } catch (synthErr) {
      console.warn('Failed to synthesize lap data after upload:', synthErr);
      // If synthesis fails, at least ensure there's a minimal TelemetryData record
      const existingTelemetry = await prisma.telemetryData.findUnique({ where: { activityId } });
      if (!existingTelemetry) {
        await prisma.telemetryData.create({
          data: {
            activityId,
            sessionData: JSON.stringify({ uploadedCsv: true, rows: inserted }),
            lapData: JSON.stringify([]),
          }
        });
      } else {
        await prisma.telemetryData.update({ where: { activityId }, data: { updatedAt: new Date() } });
      }
      res.json({ inserted, activityId, synthesizedLaps: 0 });
    }
  } catch (error) {
    console.error('Upload telemetry error:', error);
    res.status(500).json({ error: 'Failed to upload telemetry' });
  }
});

// Get activity by ID
app.get('/api/activities/:activityId', authenticateToken, async (req, res) => {
  try {
    const { activityId } = req.params;

    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            isPro: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
              },
            },
            likes: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        likes: true,
        media: {
          orderBy: {
            order: 'asc',
          },
        },
        telemetry: {
          select: {
            id: true,
            createdAt: true,
          },
        },
      },
    });

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // Check access permissions
    const isOwner = activity.userId === req.user.id;

    if (!isOwner) {
      // For non-owners, check if activity is public and user has access
      if (activity.isPrivate) {
        return res.status(403).json({ error: 'Access denied - activity is private' });
      }

      // Check if user is following the owner OR subscribed to a PRO driver owner
      const isFollowing = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: req.user.id,
            followingId: activity.userId
          }
        }
      });

      const isSubscribed = activity.user.isPro ? await prisma.driverSubscription.findUnique({
        where: {
          subscriberId_driverId: {
            subscriberId: req.user.id,
            driverId: activity.userId
          },
          status: 'active'
        }
      }) : null;

      if (!isFollowing && !isSubscribed) {
        return res.status(403).json({ error: 'Access denied - must follow or subscribe to view this activity' });
      }
    }

    res.json(addActivityMediaUrls(activity));
  } catch (error) {
    console.error('Get activity by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// ===== ANALYST NOTES ENDPOINTS =====

// Get notes for an activity
app.get('/api/activities/:activityId/notes', authenticateToken, async (req, res) => {
  try {
    const { activityId } = req.params;

    // Verify activity exists and user owns it
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true, userId: true }
    });

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // Only allow owner to view notes
    if (activity.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const notes = await prisma.analystNote.findMany({
      where: { activityId, userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json(notes);
  } catch (error) {
    console.error('Get analyst notes error:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Create a note for an activity
app.post('/api/activities/:activityId/notes', authenticateToken, async (req, res) => {
  try {
    const { activityId } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Note content is required' });
    }

    // Verify activity exists and user owns it
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true, userId: true }
    });

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // Only allow owner to add notes
    if (activity.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const note = await prisma.analystNote.create({
      data: {
        activityId,
        userId: req.user.id,
        content: content.trim()
      }
    });

    res.json(note);
  } catch (error) {
    console.error('Create analyst note error:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// Update a note
app.put('/api/notes/:noteId', authenticateToken, async (req, res) => {
  try {
    const { noteId } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Note content is required' });
    }

    // Verify note exists and user owns it
    const existing = await prisma.analystNote.findUnique({
      where: { id: noteId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Note not found' });
    }

    if (existing.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const note = await prisma.analystNote.update({
      where: { id: noteId },
      data: { content: content.trim() }
    });

    res.json(note);
  } catch (error) {
    console.error('Update analyst note error:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// Delete a note
app.delete('/api/notes/:noteId', authenticateToken, async (req, res) => {
  try {
    const { noteId } = req.params;

    // Verify note exists and user owns it
    const existing = await prisma.analystNote.findUnique({
      where: { id: noteId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Note not found' });
    }

    if (existing.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.analystNote.delete({
      where: { id: noteId }
    });

    res.json({ message: 'Note deleted' });
  } catch (error) {
    console.error('Delete analyst note error:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// Get Pro driver notes for an activity (from subscribed drivers with same car/track)
app.get('/api/activities/:activityId/pro-notes', authenticateToken, async (req, res) => {
  try {
    const { activityId } = req.params;

    // Get the current activity to extract car and track
    const currentActivity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true, userId: true, track: true, car: true }
    });

    if (!currentActivity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // Check if user owns the activity
    if (currentActivity.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { track, car } = currentActivity;

    // Get user's active subscriptions
    const subscriptions = await prisma.driverSubscription.findMany({
      where: {
        subscriberId: req.user.id,
        status: 'active'
      },
      select: { driverId: true }
    });

    if (subscriptions.length === 0) {
      return res.json([]);
    }

    const subscribedDriverIds = subscriptions.map(s => s.driverId);

    // Find public activities from subscribed Pro drivers with same car/track
    const proActivities = await prisma.activity.findMany({
      where: {
        userId: { in: subscribedDriverIds },
        track: track,
        car: car,
        isPrivate: false
      },
      select: { id: true }
    });

    if (proActivities.length === 0) {
      return res.json([]);
    }

    const proActivityIds = proActivities.map(a => a.id);

    // Get notes from these activities
    const proNotes = await prisma.analystNote.findMany({
      where: {
        activityId: { in: proActivityIds }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true
          }
        },
        activity: {
          select: {
            id: true,
            date: true,
            track: true,
            car: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(proNotes);
  } catch (error) {
    console.error('Get Pro driver notes error:', error);
    res.status(500).json({ error: 'Failed to fetch Pro driver notes' });
  }
});

// Delete activity
app.delete('/api/activities/:activityId', authenticateToken, async (req, res) => {
  try {
    const { activityId } = req.params;

    // Check if activity belongs to user
    const existing = await prisma.activity.findUnique({
      where: { id: activityId },
    });

    if (!existing || existing.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete activity and remove engagement point in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete the activity
      await tx.activity.delete({
        where: { id: activityId },
      });

      // Remove 1 engagement point and update level if needed
      const user = await tx.user.findUnique({
        where: { id: req.user.id },
        select: { engagementPoints: true, engagementLevel: true }
      });

      const newPoints = Math.max((user.engagementPoints || 0) - 1, 0);
      let newLevel = user.engagementLevel || 'bronze';

      // Update level based on points
      if (newPoints >= 600) newLevel = 'platinum';
      else if (newPoints >= 300) newLevel = 'gold';
      else if (newPoints >= 100) newLevel = 'silver';
      else newLevel = 'bronze';

      await tx.user.update({
        where: { id: req.user.id },
        data: {
          engagementPoints: newPoints,
          engagementLevel: newLevel
        }
      });
    });

    res.json({ message: 'Activity deleted' });
  } catch (error) {
    console.error('Delete activity error:', error);
    res.status(500).json({ error: 'Failed to delete activity' });
  }
});

// ===== COMMENT ENDPOINTS =====

// Add comment to activity
app.post('/api/activities/:activityId/comments', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    let mentionedUsers = req.body.mentionedUsers || req.body.mentionedUsernames || [];
    const { activityId } = req.params;

    // Normalize mentionedUsers: could be array of ids or usernames. Resolve any
    // non-id looking strings as usernames to their canonical ids.
    if (!Array.isArray(mentionedUsers)) mentionedUsers = [];

    const resolvedMentionIds = [];
    for (const m of mentionedUsers) {
      if (!m) continue;
      // Heuristic: UUIDs contain dashes; usernames are usually alphanumeric
      if (typeof m === 'string' && m.includes('-')) {
        // Assume it's an id
        resolvedMentionIds.push(m);
        continue;
      }
      try {
        const u = await prisma.user.findUnique({ where: { username: m }, select: { id: true } });
        if (u && u.id) resolvedMentionIds.push(u.id);
      } catch (e) {
        // ignore
      }
    }

    const comment = await prisma.comment.create({
      data: {
        activityId,
        userId: req.user.id,
        text,
        mentionedUsers: resolvedMentionIds.length > 0 ? JSON.stringify(resolvedMentionIds) : null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
        likes: true,
      },
    });

    // Get activity owner and commenter info for notification
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { userId: true },
    });

    const commenter = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { name: true, avatar: true },
    });

    // Create notification for activity owner (if not commenting on own activity)
    if (activity && activity.userId !== req.user.id) {
      await prisma.notification.create({
        data: {
          userId: activity.userId,
          type: 'comment',
          message: 'commented on your activity',
          fromUserId: req.user.id,
          fromUserName: commenter.name,
          activityId,
        },
      });
    }

    // Create notifications for mentioned users using the resolved mention IDs
    // (the client may have sent usernames or ids; resolvedMentionIds contains
    // canonical UUIDs). Filter out the commenter themself and any invalid
    // entries before creating notifications.
    if (Array.isArray(resolvedMentionIds) && resolvedMentionIds.length > 0) {
      const mentionNotifications = resolvedMentionIds
        .filter(id => id && id !== req.user.id)
        .map(id => ({
          userId: id,
          type: 'mention',
          message: 'mentioned you in a comment',
          fromUserId: req.user.id,
          fromUserName: commenter.name,
          activityId,
        }));

      if (mentionNotifications.length > 0) {
        await prisma.notification.createMany({
          data: mentionNotifications,
        });
      }
    }

    res.json(comment);
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// ===== LIKE ENDPOINTS =====

// Like/unlike activity
app.post('/api/activities/:activityId/like', authenticateToken, async (req, res) => {
  try {
    const { activityId } = req.params;

    // Check if already liked
    const existingLike = await prisma.like.findFirst({
      where: {
        userId: req.user.id,
        activityId,
      },
    });

    if (existingLike) {
      // Unlike
      await prisma.like.delete({
        where: { id: existingLike.id },
      });
      return res.json({ liked: false });
    } else {
      // Like
      await prisma.like.create({
        data: {
          userId: req.user.id,
          activityId,
        },
      });

      // Get activity owner and liker info for notification
      const activity = await prisma.activity.findUnique({
        where: { id: activityId },
        select: { userId: true },
      });

      const liker = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { name: true, avatar: true },
      });

      // Create notification for activity owner (if not liking own activity)
      if (activity && activity.userId !== req.user.id) {
        await prisma.notification.create({
          data: {
            userId: activity.userId,
            type: 'like',
            message: 'liked your activity',
            fromUserId: req.user.id,
            fromUserName: liker.name,
            activityId,
          },
        });
      }

      return res.json({ liked: true });
    }
  } catch (error) {
    console.error('Like activity error:', error);
    res.status(500).json({ error: 'Failed to like activity' });
  }
});

// Like/unlike comment
app.post('/api/comments/:commentId/like', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;

    // Check if already liked
    const existingLike = await prisma.like.findFirst({
      where: {
        userId: req.user.id,
        commentId,
      },
    });

    if (existingLike) {
      // Unlike
      await prisma.like.delete({
        where: { id: existingLike.id },
      });
      return res.json({ liked: false });
    } else {
      // Like
      await prisma.like.create({
        data: {
          userId: req.user.id,
          commentId,
        },
      });
      return res.json({ liked: true });
    }
  } catch (error) {
    console.error('Like comment error:', error);
    res.status(500).json({ error: 'Failed to like comment' });
  }
});

// ===== SOCIAL ENDPOINTS =====

// Follow user
app.post('/api/social/follow/:userId', authenticateToken, async (req, res) => {
  try {
    let { userId } = req.params;

    // Resolve username -> id if necessary
    let found = null
    try {
      found = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } })
    } catch (e) {
      found = null
    }
    if (!found) {
      const byUsername = await prisma.user.findUnique({ where: { username: userId }, select: { id: true, name: true } })
      if (byUsername) found = byUsername
    }

    if (!found) return res.status(404).json({ error: 'User not found' })

    userId = found.id

    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const follow = await prisma.follow.create({
      data: {
        followerId: req.user.id,
        followingId: userId,
      },
    });

    // Check if mutual follow (friends)
    const mutualFollow = await prisma.follow.findFirst({
      where: {
        followerId: userId,
        followingId: req.user.id,
      },
    });

    if (mutualFollow) {
      // Create friend notification for both users
      const followingUser = await prisma.user.findUnique({ where: { id: userId } });
      const followerUser = await prisma.user.findUnique({ where: { id: req.user.id } });

      await prisma.notification.createMany({
        data: [
          {
            userId: userId,
            type: 'friend_accepted',
            message: `You and ${followerUser.name} are now friends!`,
            fromUserId: req.user.id,
            fromUserName: followerUser.name,
          },
          {
            userId: req.user.id,
            type: 'friend_accepted',
            message: `You and ${followingUser.name} are now friends!`,
            fromUserId: userId,
            fromUserName: followingUser.name,
          },
        ],
      });
    }

    res.json({ ...follow, isMutual: !!mutualFollow });
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

// Unfollow user
app.delete('/api/social/follow/:userId', authenticateToken, async (req, res) => {
  try {
    let { userId } = req.params

    // Resolve param to id if needed
    let found = null
    try {
      found = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    } catch (e) { found = null }
    if (!found) {
      const byUsername = await prisma.user.findUnique({ where: { username: userId }, select: { id: true } })
      if (byUsername) found = byUsername
    }
    if (!found) return res.status(404).json({ error: 'User not found' })

    userId = found.id

    await prisma.follow.deleteMany({
      where: {
        followerId: req.user.id,
        followingId: userId,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Unfollow error:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// Get user's social data
app.get('/api/social', authenticateToken, async (req, res) => {
  try {
    const [following, followers] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: req.user.id },
        include: {
          following: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      }),
      prisma.follow.findMany({
        where: { followingId: req.user.id },
        include: {
          follower: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      }),
    ]);

    res.json({
      following: following.map(f => f.following),
      followers: followers.map(f => f.follower),
    });
  } catch (error) {
    console.error('Get social data error:', error);
    res.status(500).json({ error: 'Failed to fetch social data' });
  }
});

// Get mutual friends (users who follow each other) for mentions
app.get('/api/social/friends', authenticateToken, async (req, res) => {
  try {
    const { query } = req.query;

    // Get all users the current user follows
    const following = await prisma.follow.findMany({
      where: { followerId: req.user.id },
      select: { followingId: true },
    });

    const followingIds = following.map(f => f.followingId);

    // Get mutual follows (friends) - users who also follow back
    const friends = await prisma.follow.findMany({
      where: {
        followerId: { in: followingIds },
        followingId: req.user.id,
      },
      include: {
        follower: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    let friendsList = friends.map(f => f.follower);

    // Filter by query if provided
    if (query && query.trim().length > 0) {
      const lowerQuery = query.toLowerCase();
      friendsList = friendsList.filter(friend =>
        friend.name.toLowerCase().includes(lowerQuery) ||
        friend.username.toLowerCase().includes(lowerQuery)
      );
    }

    res.json(friendsList);
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// Get followers list for a user
app.get('/api/social/followers/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Get all users who follow this user
    const followers = await prisma.follow.findMany({
      where: { followingId: userId },
      include: {
        follower: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            engagementLevel: true,
            isPro: true,
          },
        },
      },
    });

    const followersList = followers.map(f => f.follower);
    res.json(followersList);
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

// Get following list for a user
app.get('/api/social/following/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Get all users this user follows
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      include: {
        following: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            engagementLevel: true,
            isPro: true,
          },
        },
      },
    });

    const followingList = following.map(f => f.following);
    res.json(followingList);
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ error: 'Failed to fetch following' });
  }
});

// ===== SUBSCRIPTION ENDPOINTS =====

// Subscribe to a Pro driver
app.post('/api/subscriptions', authenticateToken, async (req, res) => {
  try {
    const { driverId } = req.body;

    if (!driverId) {
      return res.status(400).json({ error: 'driverId is required' });
    }

    // Check if driver exists and is a Pro driver
    const driver = await prisma.user.findUnique({
      where: { id: driverId },
      select: { id: true, name: true, isPro: true }
    });

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    if (!driver.isPro) {
      return res.status(400).json({ error: 'Can only subscribe to Pro drivers' });
    }

    if (driverId === req.user.id) {
      return res.status(400).json({ error: 'Cannot subscribe to yourself' });
    }

    // Check if already subscribed
    const existing = await prisma.driverSubscription.findUnique({
      where: {
        subscriberId_driverId: {
          subscriberId: req.user.id,
          driverId: driverId
        }
      }
    });

    if (existing) {
      // Reactivate if cancelled
      if (existing.status !== 'active') {
        const updated = await prisma.driverSubscription.update({
          where: { id: existing.id },
          data: { status: 'active', updatedAt: new Date() }
        });
        return res.json(updated);
      }
      return res.status(400).json({ error: 'Already subscribed to this driver' });
    }

    // Create subscription (demo mode - instant success)
    const subscription = await prisma.driverSubscription.create({
      data: {
        subscriberId: req.user.id,
        driverId: driverId,
        status: 'active'
      },
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true
          }
        }
      }
    });

    res.json(subscription);
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// Unsubscribe from a Pro driver
app.delete('/api/subscriptions/:driverId', authenticateToken, async (req, res) => {
  try {
    const { driverId } = req.params;

    const subscription = await prisma.driverSubscription.findUnique({
      where: {
        subscriberId_driverId: {
          subscriberId: req.user.id,
          driverId: driverId
        }
      }
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Update status to cancelled (keep record for history)
    await prisma.driverSubscription.update({
      where: { id: subscription.id },
      data: { status: 'cancelled', updatedAt: new Date() }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// Get user's active subscriptions
app.get('/api/subscriptions', authenticateToken, async (req, res) => {
  try {
    const subscriptions = await prisma.driverSubscription.findMany({
      where: {
        subscriberId: req.user.id,
        status: 'active'
      },
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            isPro: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(subscriptions);
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// Check subscription status for a specific driver
app.get('/api/subscriptions/:driverId/status', authenticateToken, async (req, res) => {
  try {
    const { driverId } = req.params;

    const subscription = await prisma.driverSubscription.findUnique({
      where: {
        subscriberId_driverId: {
          subscriberId: req.user.id,
          driverId: driverId
        }
      }
    });

    res.json({
      isSubscribed: subscription && subscription.status === 'active',
      subscription: subscription || null
    });
  } catch (error) {
    console.error('Check subscription status error:', error);
    res.status(500).json({ error: 'Failed to check subscription status' });
  }
});

// Get public activities from subscribed PRO drivers (with optional car/track filtering)
app.get('/api/subscriptions/activities', authenticateToken, async (req, res) => {
  try {
    const { car, track } = req.query;

    // Get user's active subscriptions
    const subscriptions = await prisma.driverSubscription.findMany({
      where: {
        subscriberId: req.user.id,
        status: 'active'
      },
      select: { driverId: true }
    });

    if (subscriptions.length === 0) {
      return res.json([]);
    }

    const subscribedDriverIds = subscriptions.map(s => s.driverId);

    // Build where clause for activities
    const whereClause = {
      userId: { in: subscribedDriverIds },
      isPrivate: false,
      telemetry: { isNot: null }
    };

    // Add optional car/track filtering
    if (car) {
      whereClause.car = car;
    }
    if (track) {
      whereClause.track = track;
    }

    // Find public activities from subscribed PRO drivers
    const activities = await prisma.activity.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            isPro: true
          }
        },
        telemetry: {
          select: {
            id: true,
            lapData: true,
            sessionData: true,
            createdAt: true
          }
        }
      },
      orderBy: { date: 'desc' },
      take: 50 // Limit to most recent 50 activities
    });

    // Parse telemetry to extract best lap time for each activity
    const activitiesWithBestLap = activities.map(activity => {
      let bestLapTime = null;
      let bestLapTimeFormatted = null;

      if (activity.telemetry?.lapData) {
        try {
          const lapData = JSON.parse(activity.telemetry.lapData);
          if (Array.isArray(lapData) && lapData.length > 0) {
            // Find the fastest valid lap
            const validLaps = lapData.filter(lap => lap.lapNumber > 0 && lap.lapTime > 0);
            if (validLaps.length > 0) {
              const fastestLap = validLaps.reduce((min, lap) =>
                lap.lapTime < min.lapTime ? lap : min
              );
              bestLapTime = fastestLap.lapTime;
              bestLapTimeFormatted = fastestLap.lapTimeFormatted;
            }
          }
        } catch (e) {
          console.error('Failed to parse lap data for activity:', activity.id);
        }
      }

      return {
        id: activity.id,
        title: activity.title,
        date: activity.date,
        car: activity.car,
        track: activity.track,
        description: activity.description,
        user: activity.user,
        hasTelemetry: !!activity.telemetry,
        bestLapTime,
        bestLapTimeFormatted
      };
    });

    res.json(activitiesWithBestLap);
  } catch (error) {
    console.error('Get subscribed PRO driver activities error:', error);
    res.status(500).json({ error: 'Failed to fetch PRO driver activities' });
  }
});

// ===== NOTIFICATION ENDPOINTS =====

// Get notifications
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: { read: true },
    });

    res.json(notification);
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// ===== SEARCH ENDPOINT =====

// Search users (must come before /api/users/:userId)
app.get('/api/users/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json([]);
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { username: { contains: q } },
          { email: { contains: q } },
        ],
        NOT: {
          id: req.user.id, // Exclude current user
        },
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        avatar: true,
      },
      take: 10,
    });

    res.json(users);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get user by ID
app.get('/api/users/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    // First try to find by UUID id. If not found, fall back to username lookup
    // so frontend routes can pass either an id or a username.
    const selectFields = {
      id: true,
      name: true,
      username: true,
      email: true,
      avatar: true,
      bio: true,
      isPro: true,
      isFoundingDriver: true,
      engagementLevel: true,
      engagementPoints: true,
    };

    let user = await prisma.user.findUnique({ where: { id: userId }, select: selectFields });

    if (!user) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug(`User not found by id (${userId}), trying username lookup`);
      }

      // Try username (usernames are unique in the schema). Use findUnique by
      // username to avoid ambiguous matches.
      try {
        user = await prisma.user.findUnique({ where: { username: userId }, select: selectFields });
      } catch (e) {
        // In case the value looks like an ID but is malformed for the username
        // unique constraint lookup, swallow and proceed to 404 below.
        if (process.env.NODE_ENV !== 'production') console.debug('Username lookup failed:', e && e.message);
      }
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Get relationship status with user
app.get('/api/users/:userId/relationship', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if current user follows this user
    const isFollowing = await prisma.follow.findFirst({
      where: {
        followerId: req.user.id,
        followingId: userId,
      },
    });

    // Check if this user follows current user (mutual)
    const followsBack = await prisma.follow.findFirst({
      where: {
        followerId: userId,
        followingId: req.user.id,
      },
    });

    // Get follower and following counts
    const [followersCount, followingCount] = await Promise.all([
      prisma.follow.count({ where: { followingId: userId } }),
      prisma.follow.count({ where: { followerId: userId } }),
    ]);

    res.json({
      isFollowing: !!isFollowing,
      isMutual: !!(isFollowing && followsBack),
      followersCount,
      followingCount,
    });
  } catch (error) {
    console.error('Get relationship error:', error);
    res.status(500).json({ error: 'Failed to fetch relationship' });
  }
});

// Get user stats
app.get('/api/users/:userId/stats', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Pull telemetry via the TelemetryData relation (new table) rather than
    // the old `telemetryData` column which may no longer exist on Activity.
    const activities = await prisma.activity.findMany({
      where: { userId },
      select: {
        duration: true,
        performance: true,
        telemetry: {
          select: {
            sessionData: true,
            lapData: true,
            referenceLap: true,
          },
        },
      },
    });

    const totalSessions = activities.length;
    const totalMinutes = activities.reduce((sum, a) => sum + (Number(a.duration) || 0), 0);
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10; // 1 decimal

    const perfValues = activities
      .map(a => {
        const n = parseFloat(String(a.performance).replace(/[^0-9.\-]/g, ''));
        return isNaN(n) ? null : n;
      })
      .filter(v => v !== null);

    const avgPerformance = perfValues.length
      ? Math.round(perfValues.reduce((s, v) => s + (v || 0), 0) / perfValues.length)
      : 0;

    // Simple consistency heuristic: mirror avgPerformance if no lap data exists
    let consistency = avgPerformance;

    // Optionally improve consistency if telemetry data exists (best-effort)
    try {
      const lapStdSamples = [];
      for (const a of activities) {
        // Defensive: telemetry may be missing, or JSON may be malformed.
        if (!a.telemetry || (!a.telemetry.sessionData && !a.telemetry.lapData)) continue;

        let parsed = null;
        try {
          // Prefer sessionData where available, fall back to lapData
          const raw = a.telemetry.sessionData || a.telemetry.lapData || null;
          parsed = raw ? JSON.parse(raw) : null;
        } catch (err) {
          // Ignore malformed telemetry for the purpose of stats
          parsed = null;
        }

        const laps = Array.isArray(parsed?.laps)
          ? parsed.laps
          : Array.isArray(parsed?.lapData)
          ? parsed.lapData
          : [];

        const lapTimes = laps
          .map(l => Number(l?.lapTime || l?.time || l?.ms || l?.seconds))
          .filter(t => typeof t === 'number' && !isNaN(t) && t > 0);
        if (lapTimes.length >= 3) {
          const mean = lapTimes.reduce((s, t) => s + t, 0) / lapTimes.length;
          const variance = lapTimes.reduce((s, t) => s + Math.pow(t - mean, 2), 0) / lapTimes.length;
          const std = Math.sqrt(variance);
          // Normalize: lower std -> higher consistency; map to 0-100 with a soft cap
          const normalized = Math.max(0, Math.min(100, Math.round(100 - (std / mean) * 400)));
          lapStdSamples.push(normalized);
        }
      }
      if (lapStdSamples.length > 0) {
        consistency = Math.round(lapStdSamples.reduce((s, v) => s + v, 0) / lapStdSamples.length);
      }
    } catch (_) {
      // fallback to existing consistency
    }

    res.json({ totalSessions, totalHours, avgPerformance, consistency });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

// Upload media for an activity
// Accepts multipart/form-data with files (max 5) and optional duration[] for videos
app.post('/api/activities/:activityId/media', authenticateToken, mediaUpload.array('media', 5), async (req, res) => {
  try {
    const { activityId } = req.params;
    const files = req.files;
    const durations = req.body.durations ? JSON.parse(req.body.durations) : [];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Verify activity exists and user owns it
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true, userId: true }
    });

    if (!activity) {
      // Clean up uploaded files
      files.forEach(f => fs.unlink(f.path, () => {}));
      return res.status(404).json({ error: 'Activity not found' });
    }

    if (activity.userId !== req.user.id) {
      // Clean up uploaded files
      files.forEach(f => fs.unlink(f.path, () => {}));
      return res.status(403).json({ error: 'Not authorized to add media to this activity' });
    }

    // Check existing media count
    const existingCount = await prisma.activityMedia.count({
      where: { activityId }
    });

    if (existingCount + files.length > 5) {
      // Clean up uploaded files
      files.forEach(f => fs.unlink(f.path, () => {}));
      return res.status(400).json({ error: `Maximum 5 media files allowed. You have ${existingCount} already.` });
    }

    // Create media records
    const mediaRecords = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVideo = file.mimetype.startsWith('video/');
      const duration = isVideo ? (durations[i] || null) : null;

      // Validate video duration (max 30 seconds)
      if (isVideo && duration && duration > 30) {
        // Clean up all uploaded files
        files.forEach(f => fs.unlink(f.path, () => {}));
        return res.status(400).json({ error: 'Videos must be 30 seconds or less' });
      }

      const mediaRecord = await prisma.activityMedia.create({
        data: {
          activityId,
          type: isVideo ? 'video' : 'image',
          filename: file.filename,
          mimeType: file.mimetype,
          size: file.size,
          duration,
          order: existingCount + i
        }
      });

      mediaRecords.push({
        ...mediaRecord,
        url: `/uploads/media/${file.filename}`
      });
    }

    res.status(201).json(mediaRecords);
  } catch (error) {
    console.error('Media upload error:', error);
    // Clean up uploaded files on error
    if (req.files) {
      req.files.forEach(f => fs.unlink(f.path, () => {}));
    }
    res.status(500).json({ error: 'Failed to upload media' });
  }
});

// Delete media from an activity
app.delete('/api/activities/:activityId/media/:mediaId', authenticateToken, async (req, res) => {
  try {
    const { activityId, mediaId } = req.params;

    // Find the media record
    const media = await prisma.activityMedia.findUnique({
      where: { id: mediaId },
      include: {
        activity: {
          select: { userId: true }
        }
      }
    });

    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }

    if (media.activityId !== activityId) {
      return res.status(400).json({ error: 'Media does not belong to this activity' });
    }

    if (media.activity.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this media' });
    }

    // Delete the file from disk
    const filePath = path.join(mediaStorageDir, media.filename);
    fs.unlink(filePath, (err) => {
      if (err) console.error('Failed to delete media file:', err);
    });

    // Delete the database record
    await prisma.activityMedia.delete({
      where: { id: mediaId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete media error:', error);
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

// Upload setup file for an activity
app.post('/api/activities/:activityId/setup', authenticateToken, setupUpload.single('setup'), async (req, res) => {
  try {
    const { activityId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No setup file uploaded' });
    }

    // Verify activity exists and user owns it
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true, userId: true, setupPath: true }
    });

    if (!activity) {
      fs.unlink(file.path, () => {});
      return res.status(404).json({ error: 'Activity not found' });
    }

    if (activity.userId !== req.user.id) {
      fs.unlink(file.path, () => {});
      return res.status(403).json({ error: 'Not authorized to add setup to this activity' });
    }

    // Delete old setup file if exists
    if (activity.setupPath) {
      const oldPath = path.join(setupStorageDir, activity.setupPath);
      fs.unlink(oldPath, () => {});
    }

    // Update activity with setup file info
    const updatedActivity = await prisma.activity.update({
      where: { id: activityId },
      data: {
        setupFilename: file.originalname,
        setupPath: file.filename
      }
    });

    res.status(201).json({
      setupFilename: updatedActivity.setupFilename,
      setupPath: updatedActivity.setupPath
    });
  } catch (error) {
    console.error('Setup upload error:', error);
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    res.status(500).json({ error: 'Failed to upload setup file' });
  }
});

// Download setup file for an activity
// Allowed if: user owns activity OR (activity owner is pro AND user is subscribed)
app.get('/api/activities/:activityId/setup', authenticateToken, async (req, res) => {
  try {
    const { activityId } = req.params;

    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        user: {
          select: { id: true, isPro: true }
        }
      }
    });

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    if (!activity.setupPath) {
      return res.status(404).json({ error: 'No setup file for this activity' });
    }

    // Check authorization
    const isOwner = activity.userId === req.user.id;
    let isSubscribed = false;

    if (!isOwner && activity.user.isPro) {
      // Check if user is subscribed to this pro driver
      const subscription = await prisma.driverSubscription.findFirst({
        where: {
          subscriberId: req.user.id,
          driverId: activity.userId,
          status: 'active'
        }
      });
      isSubscribed = !!subscription;
    }

    if (!isOwner && !isSubscribed) {
      return res.status(403).json({ error: 'Not authorized to download this setup. Subscribe to this driver to access their setups.' });
    }

    const filePath = path.join(setupStorageDir, activity.setupPath);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Setup file not found on disk' });
    }

    res.download(filePath, activity.setupFilename);
  } catch (error) {
    console.error('Setup download error:', error);
    res.status(500).json({ error: 'Failed to download setup file' });
  }
});

// Delete setup file from an activity
app.delete('/api/activities/:activityId/setup', authenticateToken, async (req, res) => {
  try {
    const { activityId } = req.params;

    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true, userId: true, setupPath: true }
    });

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    if (activity.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this setup' });
    }

    if (!activity.setupPath) {
      return res.status(404).json({ error: 'No setup file to delete' });
    }

    // Delete file from disk
    const filePath = path.join(setupStorageDir, activity.setupPath);
    fs.unlink(filePath, (err) => {
      if (err) console.error('Failed to delete setup file:', err);
    });

    // Update activity to remove setup info
    await prisma.activity.update({
      where: { id: activityId },
      data: {
        setupFilename: null,
        setupPath: null
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete setup error:', error);
    res.status(500).json({ error: 'Failed to delete setup file' });
  }
});

// Leaderboard - get top 10 drivers by combined score
app.get('/api/leaderboard', authenticateToken, async (req, res) => {
  try {
    // Get all users with their public activities
    const users = await prisma.user.findMany({
      include: {
        activities: {
          where: { isPrivate: false },
          select: {
            duration: true,
            performance: true,
          },
        },
      },
    });

    // Calculate stats for each user
    const userStats = users.map(user => {
      const activities = user.activities || [];
      const activityCount = activities.length;
      const totalMinutes = activities.reduce((sum, a) => sum + (a.duration || 0), 0);
      const totalHours = Math.round(totalMinutes / 60 * 10) / 10; // Round to 1 decimal

      // Calculate average performance
      let avgPerformance = 0;
      if (activityCount > 0) {
        const totalPerf = activities.reduce((sum, a) => {
          const perf = parseInt((a.performance || '0').replace('%', ''));
          return sum + (isNaN(perf) ? 0 : perf);
        }, 0);
        avgPerformance = Math.round(totalPerf / activityCount);
      }

      return {
        id: user.id,
        name: user.name,
        username: user.username,
        avatar: user.avatar,
        isPro: user.isPro,
        engagementLevel: user.engagementLevel,
        stats: {
          activities: activityCount,
          hours: totalHours,
          avgPerformance,
        },
      };
    });

    // Include all users (not just those with activities)
    if (userStats.length === 0) {
      return res.json([]);
    }

    // Find max values for normalization (only from users with activities)
    const usersWithActivities = userStats.filter(u => u.stats.activities > 0);
    const maxActivities = usersWithActivities.length > 0
      ? Math.max(...usersWithActivities.map(u => u.stats.activities))
      : 1;
    const maxHours = usersWithActivities.length > 0
      ? Math.max(...usersWithActivities.map(u => u.stats.hours))
      : 1;

    // Calculate combined score for each user
    const usersWithScores = userStats.map(user => {
      // Normalize to 0-100 scale
      const normalizedActivities = maxActivities > 0 ? (user.stats.activities / maxActivities) * 100 : 0;
      const normalizedHours = maxHours > 0 ? (user.stats.hours / maxHours) * 100 : 0;

      // Combined score with weights: 30% activities, 30% hours, 40% performance
      const combinedScore = Math.round(
        normalizedActivities * 0.3 +
        normalizedHours * 0.3 +
        user.stats.avgPerformance * 0.4
      );

      return {
        ...user,
        stats: {
          ...user.stats,
          combinedScore,
        },
      };
    });

    // Sort by combined score descending, then by name for users with same score
    const top10 = usersWithScores
      .sort((a, b) => {
        if (b.stats.combinedScore !== a.stats.combinedScore) {
          return b.stats.combinedScore - a.stats.combinedScore;
        }
        // Secondary sort by name for users with same score
        return a.name.localeCompare(b.name);
      })
      .slice(0, 10);

    res.json(top10);
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ============================================================================
// DRILLS API
// ============================================================================

// Get target time for a drill (best historical 5-lap time for track/car)
app.get('/api/drills/target-time', authenticateToken, async (req, res) => {
  try {
    const { trackId, carId, laps = 5 } = req.query;
    const numLaps = parseInt(laps);

    if (!trackId || !carId) {
      return res.status(400).json({ error: 'trackId and carId are required' });
    }

    // Find activities with telemetry for this track/car combo
    const activities = await prisma.activity.findMany({
      where: {
        userId: req.user.id,
        track: trackId,
        car: carId,
        telemetry: { isNot: null }
      },
      include: {
        telemetry: true
      }
    });

    if (activities.length === 0) {
      return res.status(404).json({
        error: 'No historical data found for this track/car combination',
        hasHistory: false
      });
    }

    // Find best consecutive N-lap total time across all sessions
    let bestTotalTime = Infinity;
    let bestLapTimes = [];

    for (const activity of activities) {
      if (!activity.telemetry?.lapData) continue;

      try {
        const lapData = JSON.parse(activity.telemetry.lapData);
        const laps = lapData.laps || [];

        // Filter out invalid laps (sighting laps, incomplete, etc.)
        const validLaps = laps.filter(lap =>
          lap.lapTime &&
          lap.lapTime > 0 &&
          !lap.isSightingLap
        );

        // Find best consecutive N laps
        for (let i = 0; i <= validLaps.length - numLaps; i++) {
          const consecutiveLaps = validLaps.slice(i, i + numLaps);
          const totalTime = consecutiveLaps.reduce((sum, lap) => sum + lap.lapTime, 0);

          if (totalTime < bestTotalTime) {
            bestTotalTime = totalTime;
            bestLapTimes = consecutiveLaps.map(l => l.lapTime);
          }
        }
      } catch (e) {
        console.error('Error parsing lap data:', e);
      }
    }

    if (bestTotalTime === Infinity) {
      return res.status(404).json({
        error: `No complete ${numLaps}-lap runs found for this track/car`,
        hasHistory: false
      });
    }

    res.json({
      targetTime: bestTotalTime,
      laps: numLaps,
      lapTimes: bestLapTimes,
      hasHistory: true
    });
  } catch (error) {
    console.error('Get target time error:', error);
    res.status(500).json({ error: 'Failed to get target time' });
  }
});

// Start a new drill (can be pending without track/car)
app.post('/api/drills/start', authenticateToken, async (req, res) => {
  try {
    const { type, trackId, carId } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'type is required' });
    }

    // Check for existing active or pending drill
    const existingDrill = await prisma.drill.findFirst({
      where: {
        userId: req.user.id,
        status: { in: ['active', 'pending'] }
      }
    });

    if (existingDrill) {
      return res.status(400).json({
        error: 'You already have an active or pending drill. Complete or abandon it first.',
        activeDrill: existingDrill
      });
    }

    // Determine drill parameters based on type
    let targetLaps = 5;
    let baseXP = 50;

    switch (type) {
      case 'consistency_run':
        targetLaps = 5;
        baseXP = 50;
        break;
      case 'pb_quali':
        targetLaps = 3;
        baseXP = 75;
        break;
      case 'target_lap':
        targetLaps = 1;
        baseXP = 25;
        break;
      default:
        return res.status(400).json({ error: 'Invalid drill type' });
    }

    // If track/car provided, calculate target time and create active drill
    if (trackId && carId) {
      const activities = await prisma.activity.findMany({
        where: {
          userId: req.user.id,
          track: trackId,
          car: carId,
          telemetry: { isNot: null }
        },
        include: {
          telemetry: true
        }
      });

      let targetTime = 0;

      for (const activity of activities) {
        if (!activity.telemetry?.lapData) continue;

        try {
          const lapData = JSON.parse(activity.telemetry.lapData);
          const laps = lapData.laps || [];
          const validLaps = laps.filter(lap =>
            lap.lapTime && lap.lapTime > 0 && !lap.isSightingLap
          );

          for (let i = 0; i <= validLaps.length - targetLaps; i++) {
            const consecutiveLaps = validLaps.slice(i, i + targetLaps);
            const totalTime = consecutiveLaps.reduce((sum, lap) => sum + lap.lapTime, 0);

            if (targetTime === 0 || totalTime < targetTime) {
              targetTime = totalTime;
            }
          }
        } catch (e) {
          console.error('Error parsing lap data:', e);
        }
      }

      // Create active drill with track/car
      const drill = await prisma.drill.create({
        data: {
          userId: req.user.id,
          type,
          trackId,
          carId,
          targetTime: targetTime || null,
          targetLaps,
          xpReward: baseXP,
          status: 'active'
        }
      });

      return res.json(drill);
    }

    // Create pending drill without track/car (will be activated when iRacing connects)
    const drill = await prisma.drill.create({
      data: {
        userId: req.user.id,
        type,
        targetLaps,
        xpReward: baseXP,
        status: 'pending'
      }
    });

    res.json(drill);
  } catch (error) {
    console.error('Start drill error:', error);
    res.status(500).json({ error: 'Failed to start drill' });
  }
});

// Activate a pending drill (called when iRacing connects with track/car info)
app.patch('/api/drills/:id/activate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { trackId, carId } = req.body;

    if (!trackId || !carId) {
      return res.status(400).json({ error: 'trackId and carId are required' });
    }

    const drill = await prisma.drill.findFirst({
      where: {
        id,
        userId: req.user.id,
        status: 'pending'
      }
    });

    if (!drill) {
      return res.status(404).json({ error: 'Pending drill not found' });
    }

    // Calculate target time from history
    const activities = await prisma.activity.findMany({
      where: {
        userId: req.user.id,
        track: trackId,
        car: carId,
        telemetry: { isNot: null }
      },
      include: {
        telemetry: true
      }
    });

    let targetTime = 0;

    for (const activity of activities) {
      if (!activity.telemetry?.lapData) continue;

      try {
        const lapData = JSON.parse(activity.telemetry.lapData);
        const laps = lapData.laps || [];
        const validLaps = laps.filter(lap =>
          lap.lapTime && lap.lapTime > 0 && !lap.isSightingLap
        );

        for (let i = 0; i <= validLaps.length - drill.targetLaps; i++) {
          const consecutiveLaps = validLaps.slice(i, i + drill.targetLaps);
          const totalTime = consecutiveLaps.reduce((sum, lap) => sum + lap.lapTime, 0);

          if (targetTime === 0 || totalTime < targetTime) {
            targetTime = totalTime;
          }
        }
      } catch (e) {
        console.error('Error parsing lap data:', e);
      }
    }

    // Activate the drill
    const updatedDrill = await prisma.drill.update({
      where: { id },
      data: {
        trackId,
        carId,
        targetTime: targetTime || null,
        status: 'active'
      }
    });

    res.json(updatedDrill);
  } catch (error) {
    console.error('Activate drill error:', error);
    res.status(500).json({ error: 'Failed to activate drill' });
  }
});

// Get active or pending drill
app.get('/api/drills/active', authenticateToken, async (req, res) => {
  try {
    const drill = await prisma.drill.findFirst({
      where: {
        userId: req.user.id,
        status: { in: ['active', 'pending'] }
      }
    });

    res.json(drill);
  } catch (error) {
    console.error('Get active drill error:', error);
    res.status(500).json({ error: 'Failed to get active drill' });
  }
});

// Update drill progress (called by Electron during session)
app.patch('/api/drills/:id/progress', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { lapsCompleted } = req.body;

    const drill = await prisma.drill.findFirst({
      where: {
        id,
        userId: req.user.id,
        status: 'active'
      }
    });

    if (!drill) {
      return res.status(404).json({ error: 'Active drill not found' });
    }

    const updatedDrill = await prisma.drill.update({
      where: { id },
      data: { lapsCompleted }
    });

    res.json(updatedDrill);
  } catch (error) {
    console.error('Update drill progress error:', error);
    res.status(500).json({ error: 'Failed to update drill progress' });
  }
});

// Complete drill and award XP
app.post('/api/drills/:id/complete', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { actualTime, lapsCompleted } = req.body;

    const drill = await prisma.drill.findFirst({
      where: {
        id,
        userId: req.user.id,
        status: 'active'
      }
    });

    if (!drill) {
      return res.status(404).json({ error: 'Active drill not found' });
    }

    // Calculate delta (negative = beat target)
    const delta = actualTime - drill.targetTime;

    // Calculate XP based on performance
    let xpEarned = 10; // Participation XP

    if (delta <= 0) {
      // Beat the target
      xpEarned = drill.xpReward;

      const percentImprovement = Math.abs(delta) / drill.targetTime * 100;

      if (percentImprovement > 3) {
        xpEarned += 100; // Big bonus for >3% improvement
      } else if (percentImprovement > 1) {
        xpEarned += 50; // Medium bonus for 1-3% improvement
      } else {
        xpEarned += 25; // Small bonus for <1% improvement
      }
    }

    // Update drill with results
    const completedDrill = await prisma.drill.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        actualTime,
        delta,
        lapsCompleted,
        xpEarned
      }
    });

    // Award XP to user
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    const newPoints = (user.engagementPoints || 0) + xpEarned;
    let newLevel = user.engagementLevel || 'bronze';

    if (newPoints >= 600) newLevel = 'platinum';
    else if (newPoints >= 300) newLevel = 'gold';
    else if (newPoints >= 100) newLevel = 'silver';
    else newLevel = 'bronze';

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        engagementPoints: newPoints,
        engagementLevel: newLevel
      }
    });

    res.json({
      drill: completedDrill,
      xpEarned,
      newPoints,
      newLevel,
      beatTarget: delta <= 0
    });
  } catch (error) {
    console.error('Complete drill error:', error);
    res.status(500).json({ error: 'Failed to complete drill' });
  }
});

// Abandon active or pending drill
app.post('/api/drills/:id/abandon', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const drill = await prisma.drill.findFirst({
      where: {
        id,
        userId: req.user.id,
        status: { in: ['active', 'pending'] }
      }
    });

    if (!drill) {
      return res.status(404).json({ error: 'Drill not found or already completed' });
    }

    const abandonedDrill = await prisma.drill.update({
      where: { id },
      data: { status: 'abandoned' }
    });

    res.json(abandonedDrill);
  } catch (error) {
    console.error('Abandon drill error:', error);
    res.status(500).json({ error: 'Failed to abandon drill' });
  }
});

// Get drill history
app.get('/api/drills/history', authenticateToken, async (req, res) => {
  try {
    const drills = await prisma.drill.findMany({
      where: {
        userId: req.user.id,
        status: { in: ['completed', 'abandoned'] }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json(drills);
  } catch (error) {
    console.error('Get drill history error:', error);
    res.status(500).json({ error: 'Failed to get drill history' });
  }
});

// ===== AI COACHING ENDPOINTS =====

/**
 * @route POST /api/ai/insights
 * @description Generate AI coaching insights from telemetry improvement areas
 * @access Private - requires authentication
 */
app.post('/api/ai/insights', authenticateToken, async (req, res) => {
  try {
    const { trackName, improvementAreas } = req.body;

    if (!trackName || !Array.isArray(improvementAreas)) {
      return res.status(400).json({ error: 'Track name and improvement areas are required' });
    }

    const insights = await claudeService.generateBatchInsights(improvementAreas, trackName);

    res.json({ insights });
  } catch (error) {
    console.error('AI insights generation error:', error);
    res.status(500).json({ error: 'Failed to generate AI insights' });
  }
});

/**
 * @route POST /api/ai/chat
 * @description Chat with the AI Race Engineer
 * @access Private - requires authentication
 */
app.post('/api/ai/chat', authenticateToken, async (req, res) => {
  try {
    const { message, conversationHistory, sessionContext } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const response = await claudeService.chatWithRaceEngineer(
      message,
      conversationHistory || [],
      sessionContext || {}
    );

    res.json({ response });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

/**
 * @route GET /api/ai/status
 * @description Check if AI service is available
 * @access Public
 */
app.get('/api/ai/status', (req, res) => {
  res.json({
    available: claudeService.isAvailable(),
    model: claudeService.isAvailable() ? 'claude-3-5-haiku' : null
  });
});

// Health check with database connectivity verification
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection with a simple query
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      message: 'Forseti API is running',
      database: 'connected',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check database error:', error.message);
    res.status(503).json({
      status: 'degraded',
      message: 'Forseti API is running but database is unavailable',
      database: 'disconnected',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server - bind to 0.0.0.0 for Azure App Service compatibility
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  const dbType = process.env.DATABASE_URL?.startsWith('postgresql') ? 'PostgreSQL' : 'SQLite';
  console.log(`Forseti API running on ${HOST}:${PORT}`);
  console.log(`Database: ${dbType}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});
