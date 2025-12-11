/**
 * @fileoverview Claude AI Service for Racing Telemetry Analysis
 *
 * This service uses Claude API to generate intelligent coaching insights
 * based on telemetry comparisons between user laps and reference laps.
 *
 * @module services/claudeService
 */

const Anthropic = require('@anthropic-ai/sdk');

/**
 * Claude AI Service
 *
 * Provides methods for generating AI-powered coaching insights using
 * the Anthropic Claude API.
 */
class ClaudeService {
  constructor() {
    // Initialize Anthropic client with API key from environment
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      console.warn('[CLAUDE] Warning: ANTHROPIC_API_KEY not set. AI insights will be disabled.');
      this.client = null;
    } else {
      this.client = new Anthropic({
        apiKey: apiKey,
      });
    }

    // Use Claude 3.5 Haiku for cost-effective, fast insights
    this.model = 'claude-3-5-haiku-20241022';
  }

  /**
   * Check if Claude service is available
   * @returns {boolean} True if API key is configured
   */
  isAvailable() {
    return this.client !== null;
  }

  /**
   * Generate a coaching insight for a specific improvement area
   *
   * @param {Object} params - Parameters for insight generation
   * @param {string} params.trackName - Name of the track
   * @param {number} params.cornerNumber - Corner/turn number
   * @param {string} params.type - Type of improvement ('braking' or 'acceleration')
   * @param {Object} params.userTelemetry - User's telemetry data
   * @param {Object} params.referenceTelemetry - Reference lap telemetry data
   * @param {number} params.timeLost - Time lost in seconds
   * @param {number} params.distanceMeters - Distance covered in this area (meters)
   * @returns {Promise<string>} Generated coaching insight
   */
  async generateCoachingInsight({
    trackName,
    cornerNumber,
    type,
    userTelemetry,
    referenceTelemetry,
    timeLost,
    distanceMeters
  }) {
    if (!this.isAvailable()) {
      // Fallback to generic insights if API is not configured
      return this._getFallbackInsight(type, timeLost);
    }

    try {
      const prompt = this._buildInsightPrompt({
        trackName,
        cornerNumber,
        type,
        userTelemetry,
        referenceTelemetry,
        timeLost,
        distanceMeters
      });

      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 150,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      // Extract text from Claude's response
      const insight = message.content[0].text.trim();

      console.log(`[CLAUDE] Generated insight for ${trackName} Corner ${cornerNumber}: "${insight}"`);

      return insight;

    } catch (error) {
      console.error('[CLAUDE] Error generating insight:', error.message);
      // Fallback to generic insight on error
      return this._getFallbackInsight(type, timeLost);
    }
  }

  /**
   * Generate multiple coaching insights in batch
   *
   * @param {Array<Object>} improvementAreas - Array of improvement area parameters
   * @param {string} trackName - Name of the track
   * @returns {Promise<Array<Object>>} Array of improvement areas with AI-generated descriptions
   */
  async generateBatchInsights(improvementAreas, trackName) {
    if (!this.isAvailable()) {
      console.log('[CLAUDE] API not available, using fallback insights');
      return improvementAreas.map(area => ({
        ...area,
        description: this._getFallbackInsight(area.type, area.timeLost || 0)
      }));
    }

    // Process insights sequentially to avoid rate limits
    // For production, could batch or use parallel with rate limiting
    const results = [];

    for (let i = 0; i < improvementAreas.length; i++) {
      const area = improvementAreas[i];

      try {
        const description = await this.generateCoachingInsight({
          trackName,
          cornerNumber: i + 1,
          type: area.type,
          userTelemetry: area.userTelemetry || {},
          referenceTelemetry: area.referenceTelemetry || {},
          timeLost: area.timeLost || area.gainPotential || 0,
          distanceMeters: area.distanceMeters || 0
        });

        results.push({
          ...area,
          description
        });
      } catch (error) {
        console.error(`[CLAUDE] Error generating insight ${i + 1}:`, error.message);
        results.push({
          ...area,
          description: this._getFallbackInsight(area.type, area.timeLost || 0)
        });
      }
    }

    return results;
  }

  /**
   * Build the prompt for Claude API
   * @private
   */
  _buildInsightPrompt({
    trackName,
    cornerNumber,
    type,
    userTelemetry,
    referenceTelemetry,
    timeLost,
    distanceMeters
  }) {
    const typeDescription = type === 'braking' ? 'braking zone' : 'acceleration zone';

    return `You are a professional racing driver coach analyzing telemetry data. Provide a concise, actionable coaching tip.

Track: ${trackName}
Area: Corner ${cornerNumber} (${typeDescription})
Distance: ${Math.round(distanceMeters)}m
Time Lost: ${timeLost.toFixed(3)}s

User Performance:
- Entry Speed: ${userTelemetry.entrySpeed?.toFixed(1) || 'N/A'} km/h
- Apex Speed: ${userTelemetry.apexSpeed?.toFixed(1) || 'N/A'} km/h
- Exit Speed: ${userTelemetry.exitSpeed?.toFixed(1) || 'N/A'} km/h
- Brake Application: ${userTelemetry.brakeAvg?.toFixed(1) || 'N/A'}%
- Throttle Application: ${userTelemetry.throttleAvg?.toFixed(1) || 'N/A'}%

Reference (Pro Driver):
- Entry Speed: ${referenceTelemetry.entrySpeed?.toFixed(1) || 'N/A'} km/h
- Apex Speed: ${referenceTelemetry.apexSpeed?.toFixed(1) || 'N/A'} km/h
- Exit Speed: ${referenceTelemetry.exitSpeed?.toFixed(1) || 'N/A'} km/h
- Brake Application: ${referenceTelemetry.brakeAvg?.toFixed(1) || 'N/A'}%
- Throttle Application: ${referenceTelemetry.throttleAvg?.toFixed(1) || 'N/A'}%

Provide a concise coaching tip (max 2 sentences) that:
1. Identifies the specific issue (what the driver is doing wrong)
2. Gives actionable advice (what to do differently)

Be specific and avoid generic advice. Focus on the data differences above.`;
  }

  /**
   * Chat with the Race Engineer AI
   *
   * @param {string} userMessage - The user's question
   * @param {Array<Object>} conversationHistory - Previous messages
   * @param {Object} sessionContext - Current session context
   * @returns {Promise<string>} AI response
   */
  async chatWithRaceEngineer(userMessage, conversationHistory, sessionContext) {
    if (!this.isAvailable()) {
      return "I'm currently unavailable. Please check that the Claude API key is configured.";
    }

    try {
      // Build context-aware system prompt
      const systemPrompt = this._buildRaceEngineerSystemPrompt(sessionContext);

      // Format conversation for Claude
      const messages = [
        ...conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        {
          role: 'user',
          content: userMessage
        }
      ];

      const response = await this.client.messages.create({
        model: 'claude-3-5-haiku-20241022', // Use Haiku for fast, cost-effective conversation
        max_tokens: 1024,
        temperature: 0.8,
        system: systemPrompt,
        messages: messages
      });

      const answer = response.content[0].text.trim();

      console.log(`[RACE ENGINEER] Responded to: "${userMessage.substring(0, 50)}..."`);

      return answer;

    } catch (error) {
      console.error('[RACE ENGINEER] Error:', error.message);
      return "Sorry, I encountered an error. Please try asking again.";
    }
  }

  /**
   * Build system prompt for Race Engineer with session context
   * @private
   */
  _buildRaceEngineerSystemPrompt(context) {
    let prompt = `You are the Forseti Race Engineer, an expert AI racing coach and data analyst. You help drivers improve their performance by analyzing telemetry data and providing expert advice.

**Current Session Context:**`;

    if (context.track) {
      prompt += `\n- Track: ${context.track}`;
    }
    if (context.car) {
      prompt += `\n- Car: ${context.car}`;
    }
    if (context.fastestLap) {
      prompt += `\n- Driver's Fastest Lap: ${context.fastestLap}`;
    }
    if (context.selectedLap) {
      prompt += `\n- Currently Viewing: Lap ${context.selectedLap}`;
    }
    if (context.referenceLap) {
      if (context.isProDriverReference && context.proDriverName) {
        prompt += `\n- Reference Lap: ${context.proDriverName}'s Lap ${context.referenceLap} (Pro Driver)`;
      } else {
        prompt += `\n- Reference Lap: Driver's own Lap ${context.referenceLap}`;
      }
    }
    if (context.lapCount) {
      prompt += `\n- Total Laps in Session: ${context.lapCount}`;
    }
    if (context.improvementAreas !== undefined) {
      prompt += `\n- Apex AI Insights Found: ${context.improvementAreas} improvement opportunities`;
    }

    prompt += `

**Your Role:**
- Analyze the driver's performance based on the session context
- Provide specific, actionable coaching advice
- Answer questions about lap times, telemetry, racing lines, and technique
- Be encouraging but honest about areas for improvement
- Use racing terminology appropriately
- Reference specific lap numbers, times, and data when available
- If asked about specific corners or sectors, provide detailed technical advice

**Communication Style:**
- Professional but friendly
- Concise and to the point
- Use racing terminology naturally
- Focus on what the driver can control and improve
- Provide specific numbers and references when available

**Example Questions You Might Receive:**
- "Why am I losing time in sector 2?"
- "How does my braking compare to the pro driver?"
- "What should I focus on to improve my lap time?"
- "Is my racing line good through turn 3?"

Remember: You have access to the session context above. Use it to provide relevant, context-aware answers.`;

    return prompt;
  }

  /**
   * Get fallback insight when Claude API is unavailable
   * @private
   */
  _getFallbackInsight(type, timeLost) {
    if (type === 'braking') {
      if (timeLost > 0.1) {
        return "Work on your trail braking - ease off the brake smoother through the corner.";
      } else {
        return "Braking too late here. Try going in earlier to carry more speed through.";
      }
    } else {
      // acceleration
      if (timeLost > 0.1) {
        return "Focus on your exit - squeeze the throttle progressively as you unwind the wheel.";
      } else {
        return "You can be more aggressive on the throttle here - get on the power earlier.";
      }
    }
  }
}

// Export singleton instance
module.exports = new ClaudeService();
