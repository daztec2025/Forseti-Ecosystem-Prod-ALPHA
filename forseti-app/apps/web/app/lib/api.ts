/**
 * @fileoverview Forseti API Client
 *
 * A typed API client for communicating with the Forseti backend server.
 * Handles authentication, request/response formatting, and error handling.
 *
 * @module lib/api
 *
 * @example
 * import { api } from '../lib/api'
 *
 * // Login and get user profile
 * const user = await api.login('user@example.com', 'password')
 *
 * // Get activities
 * const activities = await api.getActivities('my')
 *
 * // Create an activity with telemetry
 * const newActivity = await api.createActivity({
 *   game: 'iRacing',
 *   duration: 30,
 *   performance: '85%',
 *   date: new Date().toISOString(),
 *   car: 'Mazda MX-5',
 *   track: 'Silverstone',
 *   telemetryData: { ... }
 * })
 */

import {
  User,
  Activity,
  ActivityMedia,
  Comment,
  Like,
  Notification,
  TelemetryData,
  Follow,
  LoginRequest,
  RegisterRequest,
  CreateActivityRequest,
  UpdateActivityRequest,
  UpdateProfileRequest,
  AddCommentRequest,
  AuthResponse,
  ApiError,
  DriverSubscription,
  ReferenceLapsResponse,
  ProDriverNote,
  ProDriverActivity,
  LeaderboardEntry,
  Drill,
  DrillType,
  DrillTargetTimeResponse,
  DrillCompleteResponse,
} from '../types/api';

/** Base URL for API requests, defaults to localhost:4000 for development */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Forseti API Client Class
 *
 * Provides typed methods for all API endpoints including authentication,
 * activities, social features, telemetry, and more. Handles JWT token
 * storage and automatic inclusion in request headers.
 *
 * @class ApiClient
 *
 * @example
 * // The api client is exported as a singleton
 * import { api } from '../lib/api'
 *
 * // All methods return promises
 * try {
 *   const user = await api.getProfile()
 *   console.log('Logged in as:', user.name)
 * } catch (error) {
 *   console.error('Not authenticated')
 * }
 */
class ApiClient {
  /**
   * Retrieve stored JWT token from localStorage
   * @private
   * @returns {string | null} JWT token or null if not authenticated
   */
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('forseti_token');
  }

  /**
   * Make an HTTP request to the API
   *
   * Handles authentication headers, error parsing, and response formatting.
   * All public API methods use this internally.
   *
   * @private
   * @param {string} endpoint - API endpoint path (e.g., '/api/profile')
   * @param {RequestInit} options - Fetch options (method, body, etc.)
   * @returns {Promise<any>} Parsed JSON response
   * @throws {Error} Network errors or API errors with status code attached
   */
  private async request(endpoint: string, options: RequestInit = {}) {
    const token = this.getToken();
    // Debug info to help diagnose network/auth issues in dev
    try {
      if (typeof window !== 'undefined') {
        // Use console.debug so normal users don't see this unless devtools are open
        console.debug('ApiClient.request', { url: `${API_URL}${endpoint}`, hasToken: !!token });
      }
    } catch (e) {
      // ignore logging failures
    }
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as any)['Authorization'] = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (err: any) {
      // Network-level failure (DNS, refused connection, CORS preflight failure in some browsers, etc.)
      console.error('Network request failed:', err);
      throw new Error('Network error: ' + (err && err.message ? err.message : String(err)));
    }

    if (!response.ok) {
      const parsed = await response.json().catch(() => (null));
      const message = parsed && parsed.error ? parsed.error : `Request failed with status ${response.status}`;
      const err = new Error(message);
      // attach status for programmatic checks
      (err as any).status = response.status;
      throw err;
    }

    return response.json();
  }

  // Generic GET request for endpoints without dedicated methods
  async get(endpoint: string): Promise<any> {
    return this.request(endpoint);
  }

  // Auth
  async login(email: string, password: string, rememberMe: boolean = false): Promise<User> {
    const data: AuthResponse = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, rememberMe }),
    });
    localStorage.setItem('forseti_token', data.token);
    return data.user;
  }

  async register(email: string, password: string, name: string, username: string): Promise<User> {
    const data: AuthResponse = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, username }),
    });
    localStorage.setItem('forseti_token', data.token);
    return data.user;
  }

  // Profile
  async getProfile(): Promise<User> {
    return this.request('/api/profile');
  }

  async updateProfile(data: UpdateProfileRequest): Promise<User> {
    return this.request('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Activities
  async getActivities(filter?: 'my' | 'friends' | 'all'): Promise<Activity[]> {
    const params = filter ? `?filter=${filter}` : '';
    return this.request(`/api/activities${params}`);
  }

  async getUserActivities(userId: string): Promise<Activity[]> {
    return this.request(`/api/activities/user/${userId}`);
  }

  /**
   * Get user activities with telemetry data included for score calculation
   * This fetches activities and their telemetry in a single request
   */
  async getUserActivitiesWithTelemetry(userId: string): Promise<Activity[]> {
    return this.request(`/api/activities/user/${userId}?includeTelemetry=true`);
  }

  async createActivity(data: CreateActivityRequest): Promise<Activity> {
    return this.request('/api/activities', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateActivity(activityId: string, data: UpdateActivityRequest): Promise<Activity> {
    return this.request(`/api/activities/${activityId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteActivity(activityId: string): Promise<void> {
    return this.request(`/api/activities/${activityId}`, {
      method: 'DELETE',
    });
  }

  async getActivityById(activityId: string): Promise<Activity> {
    return this.request(`/api/activities/${activityId}`);
  }

  async getTelemetryData(activityId: string): Promise<TelemetryData> {
    return this.request(`/api/activities/${activityId}/telemetry`);
  }

  async getReferenceLaps(activityId: string): Promise<ReferenceLapsResponse> {
    return this.request(`/api/activities/${activityId}/reference-laps`);
  }

  async getProDriverNotes(activityId: string): Promise<ProDriverNote[]> {
    return this.request(`/api/activities/${activityId}/pro-notes`);
  }

  // Upload telemetry CSV file for ingestion by the API. Returns { inserted, activityId } on success.
  async uploadTelemetry(activityId: string, file: File): Promise<{ inserted: number; activityId: string }> {
    const token = this.getToken();
    const form = new FormData();
    form.append('activityId', activityId);
    form.append('telemetryFile', file, file.name || 'telemetry.csv');

    const headers: HeadersInit = {};
    if (token) (headers as any)['Authorization'] = `Bearer ${token}`;

    const resp = await fetch(`${API_URL}/api/telemetry/upload`, {
      method: 'POST',
      headers,
      body: form,
    });

    if (!resp.ok) {
      const parsed = await resp.json().catch(() => null);
      throw new Error(parsed && parsed.error ? parsed.error : `Upload failed: ${resp.status}`);
    }

    return resp.json();
  }

  // Upload media files for an activity. Returns the created ActivityMedia records.
  async uploadActivityMedia(activityId: string, files: File[], durations?: number[]): Promise<ActivityMedia[]> {
    const token = this.getToken();
    const form = new FormData();

    files.forEach((file) => {
      form.append('media', file, file.name);
    });

    if (durations && durations.length > 0) {
      form.append('durations', JSON.stringify(durations));
    }

    const headers: HeadersInit = {};
    if (token) (headers as any)['Authorization'] = `Bearer ${token}`;

    const resp = await fetch(`${API_URL}/api/activities/${activityId}/media`, {
      method: 'POST',
      headers,
      body: form,
    });

    if (!resp.ok) {
      const parsed = await resp.json().catch(() => null);
      throw new Error(parsed && parsed.error ? parsed.error : `Upload failed: ${resp.status}`);
    }

    return resp.json();
  }

  // Delete a media file from an activity
  async deleteActivityMedia(activityId: string, mediaId: string): Promise<{ success: boolean }> {
    return this.request(`/api/activities/${activityId}/media/${mediaId}`, {
      method: 'DELETE',
    });
  }

  // Upload a car setup file for an activity
  async uploadActivitySetup(activityId: string, file: File): Promise<{ setupFilename: string; setupPath: string }> {
    const token = this.getToken();
    const form = new FormData();
    form.append('setup', file, file.name);

    const headers: HeadersInit = {};
    if (token) (headers as any)['Authorization'] = `Bearer ${token}`;

    const resp = await fetch(`${API_URL}/api/activities/${activityId}/setup`, {
      method: 'POST',
      headers,
      body: form,
    });

    if (!resp.ok) {
      const parsed = await resp.json().catch(() => null);
      throw new Error(parsed && parsed.error ? parsed.error : `Upload failed: ${resp.status}`);
    }

    return resp.json();
  }

  // Delete a setup file from an activity
  async deleteActivitySetup(activityId: string): Promise<{ success: boolean }> {
    return this.request(`/api/activities/${activityId}/setup`, {
      method: 'DELETE',
    });
  }

  async addComment(activityId: string, text: string, mentionedUsers?: string[]): Promise<Comment> {
    return this.request(`/api/activities/${activityId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text, mentionedUsers }),
    });
  }

  // Likes
  async likeActivity(activityId: string): Promise<{ liked: boolean }> {
    return this.request(`/api/activities/${activityId}/like`, {
      method: 'POST',
    });
  }

  async likeComment(commentId: string): Promise<{ liked: boolean }> {
    return this.request(`/api/comments/${commentId}/like`, {
      method: 'POST',
    });
  }

  // Social
  async followUser(userId: string): Promise<void> {
    return this.request(`/api/social/follow/${userId}`, {
      method: 'POST',
    });
  }

  async unfollowUser(userId: string): Promise<void> {
    return this.request(`/api/social/follow/${userId}`, {
      method: 'DELETE',
    });
  }

  async getSocialData(): Promise<{ following: any[]; followers: any[] }> {
    return this.request('/api/social');
  }

  async getFriends(query?: string): Promise<User[]> {
    const params = query ? `?query=${encodeURIComponent(query)}` : '';
    return this.request(`/api/social/friends${params}`);
  }

  // Notifications
  async getNotifications(): Promise<Notification[]> {
    return this.request('/api/notifications');
  }

  async markNotificationRead(id: string): Promise<void> {
    return this.request(`/api/notifications/${id}/read`, {
      method: 'PUT',
    });
  }

  // Search
  async searchUsers(query: string): Promise<User[]> {
    return this.request(`/api/users/search?q=${encodeURIComponent(query)}`);
  }

  // Get user by ID
  async getUser(userId: string): Promise<User> {
    return this.request(`/api/users/${userId}`);
  }

  // Get relationship status with a user (includes follower/following counts)
  async getRelationship(userId: string): Promise<{
    isFollowing: boolean;
    isMutual: boolean;
    followersCount: number;
    followingCount: number;
  }> {
    return this.request(`/api/users/${userId}/relationship`);
  }

  // Get followers list for a user
  async getFollowers(userId: string): Promise<User[]> {
    return this.request(`/api/social/followers/${userId}`);
  }

  // Get following list for a user
  async getFollowing(userId: string): Promise<User[]> {
    return this.request(`/api/social/following/${userId}`);
  }

  // Analyst Notes
  async getAnalystNotes(activityId: string): Promise<any[]> {
    return this.request(`/api/activities/${activityId}/notes`);
  }

  async createAnalystNote(activityId: string, content: string): Promise<any> {
    return this.request(`/api/activities/${activityId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async updateAnalystNote(noteId: string, content: string): Promise<any> {
    return this.request(`/api/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  async deleteAnalystNote(noteId: string): Promise<void> {
    return this.request(`/api/notes/${noteId}`, {
      method: 'DELETE',
    });
  }

  // Subscriptions
  async subscribe(driverId: string): Promise<DriverSubscription> {
    return this.request('/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ driverId }),
    });
  }

  async unsubscribe(driverId: string): Promise<{ success: boolean }> {
    return this.request(`/api/subscriptions/${driverId}`, {
      method: 'DELETE',
    });
  }

  async getSubscriptions(): Promise<DriverSubscription[]> {
    return this.request('/api/subscriptions');
  }

  async checkSubscription(driverId: string): Promise<{ isSubscribed: boolean; subscription: DriverSubscription | null }> {
    return this.request(`/api/subscriptions/${driverId}/status`);
  }

  async getSubscribedProActivities(car?: string, track?: string): Promise<ProDriverActivity[]> {
    const params = new URLSearchParams();
    if (car) params.append('car', car);
    if (track) params.append('track', track);
    const queryString = params.toString();
    return this.request(`/api/subscriptions/activities${queryString ? `?${queryString}` : ''}`);
  }

  async getMyActivitiesFiltered(car?: string, track?: string): Promise<Activity[]> {
    const params = new URLSearchParams();
    if (car) params.append('car', car);
    if (track) params.append('track', track);
    const queryString = params.toString();
    return this.request(`/api/activities/my/filter${queryString ? `?${queryString}` : ''}`);
  }

  // Leaderboard
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    return this.request('/api/leaderboard');
  }

  // Drills
  async getDrillTargetTime(trackId: string, carId: string, laps: number = 5): Promise<DrillTargetTimeResponse> {
    return this.request(`/api/drills/target-time?trackId=${encodeURIComponent(trackId)}&carId=${encodeURIComponent(carId)}&laps=${laps}`);
  }

  async startDrill(type: DrillType, trackId?: string, carId?: string): Promise<Drill> {
    return this.request('/api/drills/start', {
      method: 'POST',
      body: JSON.stringify({ type, trackId, carId }),
    });
  }

  async activateDrill(drillId: string, trackId: string, carId: string): Promise<Drill> {
    return this.request(`/api/drills/${drillId}/activate`, {
      method: 'PATCH',
      body: JSON.stringify({ trackId, carId }),
    });
  }

  async getActiveDrill(): Promise<Drill | null> {
    return this.request('/api/drills/active');
  }

  async updateDrillProgress(drillId: string, lapsCompleted: number): Promise<Drill> {
    return this.request(`/api/drills/${drillId}/progress`, {
      method: 'PATCH',
      body: JSON.stringify({ lapsCompleted }),
    });
  }

  async completeDrill(drillId: string, actualTime: number, lapsCompleted: number): Promise<DrillCompleteResponse> {
    return this.request(`/api/drills/${drillId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ actualTime, lapsCompleted }),
    });
  }

  async abandonDrill(drillId: string): Promise<Drill> {
    return this.request(`/api/drills/${drillId}/abandon`, {
      method: 'POST',
    });
  }

  async getDrillHistory(): Promise<Drill[]> {
    return this.request('/api/drills/history');
  }

  // ===== AI COACHING METHODS =====

  /**
   * Get AI-generated insights from telemetry improvement areas
   */
  async getAiInsights(trackName: string, improvementAreas: any[]): Promise<{ insights: any[] }> {
    return this.request('/api/ai/insights', {
      method: 'POST',
      body: JSON.stringify({ trackName, improvementAreas }),
    });
  }

  /**
   * Chat with the AI Race Engineer
   */
  async chatWithRaceEngineer(
    message: string,
    conversationHistory: { role: 'user' | 'assistant'; content: string }[],
    sessionContext: {
      track?: string;
      car?: string;
      fastestLap?: string;
      selectedLap?: number;
      referenceLap?: number;
      isProDriverReference?: boolean;
      proDriverName?: string;
      lapCount?: number;
      improvementAreas?: number;
    }
  ): Promise<{ response: string }> {
    return this.request('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, conversationHistory, sessionContext }),
    });
  }

  /**
   * Check if AI service is available
   */
  async getAiStatus(): Promise<{ available: boolean; model: string | null }> {
    return this.request('/api/ai/status');
  }
}

/**
 * Singleton API client instance
 *
 * Use this exported instance for all API calls. The client handles
 * authentication tokens automatically.
 *
 * @example
 * import { api } from '../lib/api'
 * const user = await api.getProfile()
 */
export const api = new ApiClient();
