/**
 * OAuth Routes for Discord and Google authentication
 */

const express = require('express');
const passport = require('passport');
const { Strategy: DiscordStrategy } = require('passport-discord-auth');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const config = require('../config');

const router = express.Router();
const prisma = new PrismaClient();

// Initialize Passport strategies
const initializePassport = () => {
  // Discord Strategy
  if (config.oauth.discord.clientId && config.oauth.discord.clientSecret) {
    passport.use('discord', new DiscordStrategy({
      clientId: config.oauth.discord.clientId,
      clientSecret: config.oauth.discord.clientSecret,
      callbackUrl: `${config.oauth.apiUrl}${config.oauth.discord.callbackUrl}`,
      scope: ['identify', 'email'],
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        done(null, {
          provider: 'discord',
          providerAccountId: profile.id,
          email: profile.email,
          name: profile.global_name || profile.username,
          avatar: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : null,
          accessToken,
          refreshToken,
        });
      } catch (error) {
        done(error, null);
      }
    }));
    console.log('OAuth: Discord strategy initialized');
  } else {
    console.warn('OAuth: Discord strategy NOT configured (missing DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET)');
  }

  // Google Strategy
  if (config.oauth.google.clientId && config.oauth.google.clientSecret) {
    passport.use('google', new GoogleStrategy({
      clientID: config.oauth.google.clientId,
      clientSecret: config.oauth.google.clientSecret,
      callbackURL: `${config.oauth.apiUrl}${config.oauth.google.callbackUrl}`,
      scope: ['profile', 'email'],
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
        done(null, {
          provider: 'google',
          providerAccountId: profile.id,
          email: email,
          name: profile.displayName,
          avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
          accessToken,
          refreshToken,
        });
      } catch (error) {
        done(error, null);
      }
    }));
    console.log('OAuth: Google strategy initialized');
  } else {
    console.warn('OAuth: Google strategy NOT configured (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET)');
  }
};

// Initialize strategies
initializePassport();

// Helper function to generate unique username
const generateUniqueUsername = async (baseName, email) => {
  const sanitized = (baseName || email.split('@')[0])
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 15);

  let username = sanitized;
  let counter = 1;

  while (true) {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (!existing) break;
    username = `${sanitized}${counter}`;
    counter++;
    if (counter > 1000) {
      username = `${sanitized}${Date.now()}`;
      break;
    }
  }

  return username;
};

// Helper function to generate JWT token
const generateToken = (user, rememberMe = false) => {
  return jwt.sign(
    { id: user.id, email: user.email },
    config.jwt.secret,
    { expiresIn: rememberMe ? config.jwt.expiresInRememberMe : config.jwt.expiresIn }
  );
};

// Helper function to handle OAuth callback logic
const handleOAuthCallback = async (oauthProfile, redirectUri) => {
  const { provider, providerAccountId, email, name, avatar, accessToken, refreshToken } = oauthProfile;

  // Check if OAuth account already exists
  const existingOAuthAccount = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId,
      },
    },
    include: { user: true },
  });

  if (existingOAuthAccount) {
    // User already linked this OAuth account - log them in
    const token = generateToken(existingOAuthAccount.user);
    return {
      success: true,
      token,
      user: existingOAuthAccount.user,
    };
  }

  // Check if email matches an existing user
  if (email) {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Email exists - need to prompt for account linking
      return {
        success: false,
        action: 'link_prompt',
        email,
        provider,
        providerAccountId,
        name,
        avatar,
        accessToken,
        refreshToken,
      };
    }
  }

  // New user - require them to complete their profile (choose username)
  return {
    success: false,
    action: 'complete_profile',
    email,
    provider,
    providerAccountId,
    name,
    avatar,
    accessToken,
    refreshToken,
  };
};

// Helper function to link OAuth account to an existing user (from settings)
const handleLinkToExistingUser = async (oauthProfile, userId) => {
  const { provider, providerAccountId, email, accessToken, refreshToken } = oauthProfile;

  try {
    // Check if this OAuth account is already linked to another user
    const existingOAuthAccount = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
    });

    if (existingOAuthAccount) {
      if (existingOAuthAccount.userId === userId) {
        return { success: false, error: 'This account is already linked to your profile' };
      }
      return { success: false, error: 'This account is already linked to another user' };
    }

    // Check if user already has this provider linked
    const existingProviderLink = await prisma.oAuthAccount.findFirst({
      where: {
        userId,
        provider,
      },
    });

    if (existingProviderLink) {
      return { success: false, error: `You already have a ${provider} account linked` };
    }

    // Link the OAuth account to the user
    await prisma.oAuthAccount.create({
      data: {
        userId,
        provider,
        providerAccountId,
        email,
        accessToken,
        refreshToken,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Link to existing user error:', error);
    return { success: false, error: 'Failed to link account' };
  }
};

// Store OAuth data temporarily for account linking flow
const pendingLinkData = new Map();

// ============================================
// Discord OAuth Routes
// ============================================

// Initiate Discord OAuth
router.get('/discord', (req, res, next) => {
  // Check if Discord strategy is configured
  if (!config.oauth.discord.clientId || !config.oauth.discord.clientSecret) {
    return res.status(503).json({
      error: 'Discord OAuth is not configured',
      message: 'Please set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET environment variables'
    });
  }

  const redirectUri = req.query.redirect_uri || `${config.oauth.frontendUrl}/auth/callback`;

  // Store redirect URI in session-like state
  const state = Buffer.from(JSON.stringify({ redirectUri })).toString('base64');

  passport.authenticate('discord', {
    state,
    session: false,
  })(req, res, next);
});

// Discord OAuth Callback
router.get('/discord/callback', (req, res, next) => {
  passport.authenticate('discord', { session: false }, async (err, oauthProfile) => {
    let redirectUri = `${config.oauth.frontendUrl}/auth/callback`;
    let linkToUserId = null;
    let action = null;

    try {
      // Parse state to get redirect URI and potential link action
      if (req.query.state) {
        const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
        redirectUri = state.redirectUri || redirectUri;
        linkToUserId = state.linkToUserId;
        action = state.action;
      }
    } catch (e) {
      // Use default redirect URI
    }

    if (err || !oauthProfile) {
      return res.redirect(`${redirectUri}?error=oauth_failed&message=${encodeURIComponent(err?.message || 'Authentication failed')}`);
    }

    try {
      // Handle linking to existing logged-in user
      if (action === 'link_existing_account' && linkToUserId) {
        const linkResult = await handleLinkToExistingUser(oauthProfile, linkToUserId);
        if (linkResult.success) {
          return res.redirect(`${redirectUri}?linked=${oauthProfile.provider}&success=true`);
        } else {
          return res.redirect(`${redirectUri}?error=link_failed&message=${encodeURIComponent(linkResult.error)}`);
        }
      }

      const result = await handleOAuthCallback(oauthProfile, redirectUri);

      if (result.success) {
        return res.redirect(`${redirectUri}?token=${result.token}${result.isNewUser ? '&new_user=true' : ''}`);
      } else if (result.action === 'link_prompt') {
        // Store pending link data with a temporary token
        const linkToken = Buffer.from(`${result.provider}:${result.providerAccountId}:${Date.now()}`).toString('base64');
        pendingLinkData.set(linkToken, {
          ...result,
          expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
        });

        return res.redirect(`${redirectUri}?action=link_prompt&email=${encodeURIComponent(result.email)}&provider=${result.provider}&link_token=${linkToken}`);
      } else if (result.action === 'complete_profile') {
        // New user needs to complete their profile (choose username)
        const profileToken = Buffer.from(`${result.provider}:${result.providerAccountId}:${Date.now()}`).toString('base64');
        pendingLinkData.set(profileToken, {
          ...result,
          expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
        });

        const params = new URLSearchParams({
          action: 'complete_profile',
          profile_token: profileToken,
          email: result.email || '',
          name: result.name || '',
          avatar: result.avatar || '',
          provider: result.provider,
        });

        return res.redirect(`${redirectUri}?${params.toString()}`);
      }
    } catch (error) {
      console.error('OAuth callback error:', error);
      return res.redirect(`${redirectUri}?error=server_error&message=${encodeURIComponent('An error occurred during authentication')}`);
    }
  })(req, res, next);
});

// ============================================
// Google OAuth Routes
// ============================================

// Initiate Google OAuth
router.get('/google', (req, res, next) => {
  // Check if Google strategy is configured
  if (!config.oauth.google.clientId || !config.oauth.google.clientSecret) {
    return res.status(503).json({
      error: 'Google OAuth is not configured',
      message: 'Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables'
    });
  }

  const redirectUri = req.query.redirect_uri || `${config.oauth.frontendUrl}/auth/callback`;

  // Store redirect URI in session-like state
  const state = Buffer.from(JSON.stringify({ redirectUri })).toString('base64');

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state,
    session: false,
  })(req, res, next);
});

// Google OAuth Callback
router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { session: false }, async (err, oauthProfile) => {
    let redirectUri = `${config.oauth.frontendUrl}/auth/callback`;
    let linkToUserId = null;
    let action = null;

    try {
      // Parse state to get redirect URI and potential link action
      if (req.query.state) {
        const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
        redirectUri = state.redirectUri || redirectUri;
        linkToUserId = state.linkToUserId;
        action = state.action;
      }
    } catch (e) {
      // Use default redirect URI
    }

    if (err || !oauthProfile) {
      return res.redirect(`${redirectUri}?error=oauth_failed&message=${encodeURIComponent(err?.message || 'Authentication failed')}`);
    }

    try {
      // Handle linking to existing logged-in user
      if (action === 'link_existing_account' && linkToUserId) {
        const linkResult = await handleLinkToExistingUser(oauthProfile, linkToUserId);
        if (linkResult.success) {
          return res.redirect(`${redirectUri}?linked=${oauthProfile.provider}&success=true`);
        } else {
          return res.redirect(`${redirectUri}?error=link_failed&message=${encodeURIComponent(linkResult.error)}`);
        }
      }

      const result = await handleOAuthCallback(oauthProfile, redirectUri);

      if (result.success) {
        return res.redirect(`${redirectUri}?token=${result.token}${result.isNewUser ? '&new_user=true' : ''}`);
      } else if (result.action === 'link_prompt') {
        // Store pending link data with a temporary token
        const linkToken = Buffer.from(`${result.provider}:${result.providerAccountId}:${Date.now()}`).toString('base64');
        pendingLinkData.set(linkToken, {
          ...result,
          expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
        });

        return res.redirect(`${redirectUri}?action=link_prompt&email=${encodeURIComponent(result.email)}&provider=${result.provider}&link_token=${linkToken}`);
      } else if (result.action === 'complete_profile') {
        // New user needs to complete their profile (choose username)
        const profileToken = Buffer.from(`${result.provider}:${result.providerAccountId}:${Date.now()}`).toString('base64');
        pendingLinkData.set(profileToken, {
          ...result,
          expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
        });

        const params = new URLSearchParams({
          action: 'complete_profile',
          profile_token: profileToken,
          email: result.email || '',
          name: result.name || '',
          avatar: result.avatar || '',
          provider: result.provider,
        });

        return res.redirect(`${redirectUri}?${params.toString()}`);
      }
    } catch (error) {
      console.error('OAuth callback error:', error);
      return res.redirect(`${redirectUri}?error=server_error&message=${encodeURIComponent('An error occurred during authentication')}`);
    }
  })(req, res, next);
});

// ============================================
// Account Linking Routes
// ============================================

// Link OAuth account to existing user (requires password verification)
router.post('/link', async (req, res) => {
  const { linkToken, password } = req.body;

  if (!linkToken || !password) {
    return res.status(400).json({ error: 'Link token and password are required' });
  }

  const pendingData = pendingLinkData.get(linkToken);

  if (!pendingData || pendingData.expiresAt < Date.now()) {
    pendingLinkData.delete(linkToken);
    return res.status(400).json({ error: 'Link token expired or invalid. Please try again.' });
  }

  try {
    const bcrypt = require('bcrypt');

    // Find the existing user
    const user = await prisma.user.findUnique({
      where: { email: pendingData.email },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify password
    if (!user.password) {
      return res.status(400).json({ error: 'This account was created with OAuth. Please sign in with your linked provider.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Link the OAuth account
    await prisma.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: pendingData.provider,
        providerAccountId: pendingData.providerAccountId,
        email: pendingData.email,
        accessToken: pendingData.accessToken,
        refreshToken: pendingData.refreshToken,
      },
    });

    // Clean up pending data
    pendingLinkData.delete(linkToken);

    // Generate token and return
    const token = generateToken(user);

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
        membershipTier: user.membershipTier,
        engagementLevel: user.engagementLevel,
        engagementPoints: user.engagementPoints,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Account linking error:', error);
    res.status(500).json({ error: 'Failed to link account' });
  }
});

// Create new account instead of linking (when email conflict exists)
router.post('/create-new', async (req, res) => {
  const { linkToken } = req.body;

  if (!linkToken) {
    return res.status(400).json({ error: 'Link token is required' });
  }

  const pendingData = pendingLinkData.get(linkToken);

  if (!pendingData || pendingData.expiresAt < Date.now()) {
    pendingLinkData.delete(linkToken);
    return res.status(400).json({ error: 'Link token expired or invalid. Please try again.' });
  }

  try {
    // Create a new user with a modified email (since original email is taken)
    const username = await generateUniqueUsername(pendingData.name, pendingData.email);
    const uniqueEmail = `${pendingData.provider}_${pendingData.providerAccountId}@oauth.forseti.app`;

    const newUser = await prisma.user.create({
      data: {
        email: uniqueEmail,
        username,
        name: pendingData.name || username,
        avatar: pendingData.avatar,
        password: null,
        oauthAccounts: {
          create: {
            provider: pendingData.provider,
            providerAccountId: pendingData.providerAccountId,
            email: pendingData.email, // Store original OAuth email for reference
            accessToken: pendingData.accessToken,
            refreshToken: pendingData.refreshToken,
          },
        },
      },
    });

    // Clean up pending data
    pendingLinkData.delete(linkToken);

    const token = generateToken(newUser);

    res.json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        name: newUser.name,
        avatar: newUser.avatar,
        bio: newUser.bio,
        isPro: newUser.isPro,
        isFoundingDriver: newUser.isFoundingDriver,
        membershipTier: newUser.membershipTier,
        engagementLevel: newUser.engagementLevel,
        engagementPoints: newUser.engagementPoints,
        createdAt: newUser.createdAt,
      },
      isNewUser: true,
    });
  } catch (error) {
    console.error('Create new account error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// ============================================
// Profile Completion Routes (for new OAuth users)
// ============================================

// Check if username is available
router.get('/check-username', async (req, res) => {
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  // Validate username format
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usernameRegex.test(username)) {
    return res.json({
      available: false,
      error: 'Username must be 3-20 characters and contain only letters, numbers, and underscores'
    });
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { username: username.toLowerCase() }
    });

    res.json({ available: !existing });
  } catch (error) {
    console.error('Check username error:', error);
    res.status(500).json({ error: 'Failed to check username' });
  }
});

// Complete OAuth profile (create account with chosen username)
router.post('/complete-profile', async (req, res) => {
  const { profileToken, username } = req.body;

  if (!profileToken || !username) {
    return res.status(400).json({ error: 'Profile token and username are required' });
  }

  // Validate username format
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usernameRegex.test(username)) {
    return res.status(400).json({
      error: 'Username must be 3-20 characters and contain only letters, numbers, and underscores'
    });
  }

  const pendingData = pendingLinkData.get(profileToken);

  if (!pendingData || pendingData.expiresAt < Date.now()) {
    pendingLinkData.delete(profileToken);
    return res.status(400).json({ error: 'Profile token expired or invalid. Please try again.' });
  }

  try {
    // Check if username is already taken
    const existingUsername = await prisma.user.findUnique({
      where: { username: username.toLowerCase() }
    });

    if (existingUsername) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    // Create the new user with OAuth account
    const newUser = await prisma.user.create({
      data: {
        email: pendingData.email || `${pendingData.provider}_${pendingData.providerAccountId}@oauth.forseti.app`,
        username: username.toLowerCase(),
        name: pendingData.name || username,
        avatar: pendingData.avatar,
        password: null, // OAuth users don't need passwords
        oauthAccounts: {
          create: {
            provider: pendingData.provider,
            providerAccountId: pendingData.providerAccountId,
            email: pendingData.email,
            accessToken: pendingData.accessToken,
            refreshToken: pendingData.refreshToken,
          },
        },
      },
    });

    // Clean up pending data
    pendingLinkData.delete(profileToken);

    // Generate token and return
    const token = generateToken(newUser);

    res.json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        name: newUser.name,
        avatar: newUser.avatar,
        bio: newUser.bio,
        isPro: newUser.isPro,
        isFoundingDriver: newUser.isFoundingDriver,
        membershipTier: newUser.membershipTier,
        engagementLevel: newUser.engagementLevel,
        engagementPoints: newUser.engagementPoints,
        createdAt: newUser.createdAt,
      },
      isNewUser: true,
    });
  } catch (error) {
    console.error('Complete profile error:', error);
    res.status(500).json({ error: 'Failed to complete profile' });
  }
});

// ============================================
// Authentication Middleware for OAuth routes
// ============================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  jwt.verify(token, config.jwt.secret, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
};

// ============================================
// Linked Accounts Management Routes
// ============================================

// Get linked OAuth accounts for the authenticated user
router.get('/linked-accounts', authenticateToken, async (req, res) => {
  try {
    const accounts = await prisma.oAuthAccount.findMany({
      where: { userId: req.user.id },
      select: {
        id: true,
        provider: true,
        email: true,
        createdAt: true,
      },
    });

    res.json({ accounts });
  } catch (error) {
    console.error('Get linked accounts error:', error);
    res.status(500).json({ error: 'Failed to get linked accounts' });
  }
});

// Unlink an OAuth account
router.delete('/unlink/:provider', authenticateToken, async (req, res) => {
  const { provider } = req.params;

  if (!['google', 'discord'].includes(provider)) {
    return res.status(400).json({ error: 'Invalid provider' });
  }

  try {
    // Get the user to check if they have a password or other linked accounts
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        oauthAccounts: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has this provider linked
    const accountToUnlink = user.oauthAccounts.find(a => a.provider === provider);
    if (!accountToUnlink) {
      return res.status(404).json({ error: `${provider} account is not linked` });
    }

    // Ensure user has another way to sign in
    const hasPassword = !!user.password;
    const otherOAuthAccounts = user.oauthAccounts.filter(a => a.provider !== provider);

    if (!hasPassword && otherOAuthAccounts.length === 0) {
      return res.status(400).json({
        error: 'Cannot unlink account',
        message: 'You must have a password or another linked account before unlinking this one'
      });
    }

    // Delete the OAuth account
    await prisma.oAuthAccount.delete({
      where: { id: accountToUnlink.id },
    });

    res.json({ success: true, message: `${provider} account unlinked successfully` });
  } catch (error) {
    console.error('Unlink account error:', error);
    res.status(500).json({ error: 'Failed to unlink account' });
  }
});

// Initiate OAuth linking for an already logged-in user
// This stores the user ID in state so we can link to their account after OAuth
// Note: We accept token as query param since this is a redirect-based flow
router.get('/link-account/:provider', (req, res) => {
  const { provider } = req.params;
  const { redirect_uri, token } = req.query;
  const redirectUri = redirect_uri || `${config.oauth.frontendUrl}/profile/edit`;

  if (!['google', 'discord'].includes(provider)) {
    return res.status(400).json({ error: 'Invalid provider' });
  }

  // Verify the token to get user ID
  if (!token) {
    return res.redirect(`${redirectUri}?error=auth_required&message=${encodeURIComponent('Authentication required')}`);
  }

  let userId;
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    userId = decoded.id;
  } catch (err) {
    return res.redirect(`${redirectUri}?error=invalid_token&message=${encodeURIComponent('Invalid or expired session')}`);
  }

  // Check if provider is configured
  if (provider === 'discord' && (!config.oauth.discord.clientId || !config.oauth.discord.clientSecret)) {
    return res.redirect(`${redirectUri}?error=not_configured&message=${encodeURIComponent('Discord OAuth is not configured')}`);
  }
  if (provider === 'google' && (!config.oauth.google.clientId || !config.oauth.google.clientSecret)) {
    return res.redirect(`${redirectUri}?error=not_configured&message=${encodeURIComponent('Google OAuth is not configured')}`);
  }

  // Store user ID and redirect URI in state
  const state = Buffer.from(JSON.stringify({
    redirectUri,
    linkToUserId: userId,
    action: 'link_existing_account'
  })).toString('base64');

  if (provider === 'discord') {
    passport.authenticate('discord', { state, session: false })(req, res);
  } else {
    passport.authenticate('google', { scope: ['profile', 'email'], state, session: false })(req, res);
  }
});

// Clean up expired pending link data periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingLinkData.entries()) {
    if (value.expiresAt < now) {
      pendingLinkData.delete(key);
    }
  }
}, 60 * 1000); // Every minute

module.exports = router;
