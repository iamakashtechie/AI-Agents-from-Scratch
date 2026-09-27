/**
 * @file index.js
 * @description A minimal AI Agent built from scratch using the ReAct (Reason + Act) pattern.
 *
 * The agent follows a strict state machine loop:
 *   START → PLAN → ACTION → OBSERVATION → (repeat) → OUTPUT
 *
 * The LLM is instructed via a system prompt to always respond in JSON,
 * cycling through plan → action → observation until it has enough
 * information to produce a final output.
 *
 * Supported LLM backends (toggle via comments in the client config):
 *   - Google Gemini  (via Gemini's OpenAI-compatible endpoint)
 *   - OpenRouter     (access to many models, including free ones)
 */

import OpenAI from 'openai';
import 'dotenv/config';
import readlineSync from 'readline-sync';

// ---------------------------------------------------------------------------
// LLM Client Setup
// ---------------------------------------------------------------------------
// The OpenAI SDK is used here because both Gemini and OpenRouter expose
// an OpenAI-compatible REST API, so we can switch backends by just swapping
// the apiKey and baseURL — no other code changes needed.

const client = new OpenAI({
  // --- Option A: Google Gemini (default) ---
  // Free tier available. Get your key: https://aistudio.google.com/apikey
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',

  // --- Option B: OpenRouter (uncomment to use) ---
  // Supports many models, including free ones.
  // Get your key: https://openrouter.ai/keys
  // apiKey: process.env.OPENROUTER_API_KEY,
  // baseURL: 'https://openrouter.ai/api/v1',
});

// ---------------------------------------------------------------------------
// Tool Definitions
// ---------------------------------------------------------------------------
// Each tool is a plain JavaScript function. The agent can call these by name
// when it decides an action is needed. In a real project you'd call a live
// weather API here instead of returning hardcoded values.

/**
 * Returns the current temperature for a given city.
 * @param {string} city - The name of the city (case-insensitive).
 * @returns {string} Temperature string, e.g. "10°C".
 */
function getWeatherDetails(city = '') {
  const weatherData = {
    kolkata:   '10°C',
    mumbai:    '14°C',
    bangalore: '20°C',
    lucknow:   '30°C',
    banaras:   '19°C',
  };
  return weatherData[city.toLowerCase()] ?? 'Weather data not available for this city.';
}

// Tool registry — maps the function name (string) the LLM will use in its
// JSON action to the actual JS function to call.
const tools = {
  getWeatherDetails,
};

// ---------------------------------------------------------------------------
// System Prompt — ReAct Pattern
// ---------------------------------------------------------------------------
// This prompt instructs the LLM to think step-by-step in a structured JSON
// format before giving a final answer. This is the core of the ReAct pattern.

const SYSTEM_PROMPT = `
You are an AI Assistant that operates in the following states:
START, PLAN, ACTION, OBSERVATION, and OUTPUT.

Wait for the user prompt, then PLAN using the available tools.
After planning, take the ACTION with the appropriate tool and wait for an OBSERVATION.
Once you have all observations needed, return the final OUTPUT.

Rules:
- Always respond with a single valid JSON object — nothing else.
- Strictly follow the JSON format shown in the examples below.
- Never skip the PLAN → ACTION → OBSERVATION cycle before giving OUTPUT.

Available Tools:
- function getWeatherDetails(city: string): string
  Returns the weather (temperature) for the given city name.

Example interaction:
START
{ "type": "user", "user": "What is the sum of weather of Kolkata and Mumbai?" }
{ "type": "plan", "plan": "I will call getWeatherDetails for Kolkata." }
{ "type": "action", "function": "getWeatherDetails", "input": "Kolkata" }
{ "type": "observation", "observation": "10°C" }
{ "type": "plan", "plan": "I will call getWeatherDetails for Mumbai." }
{ "type": "action", "function": "getWeatherDetails", "input": "Mumbai" }
{ "type": "observation", "observation": "14°C" }
{ "type": "output", "output": "The sum of the weather in Kolkata and Mumbai is 24°C." }
`;

// ---------------------------------------------------------------------------
// Agent Loop
// ---------------------------------------------------------------------------
// The outer loop reads user input. The inner loop drives the LLM through the
// PLAN → ACTION → OBSERVATION cycle until the LLM emits an "output" message.

// Conversation history is maintained across turns so the agent has context.
const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

while (true) {
  // Read user query from the terminal
  const query = readlineSync.question('>> ');

  // Wrap the raw query in the structured format the agent expects
  messages.push({
    role: 'user',
    content: JSON.stringify({ type: 'user', content: query }),
  });

  // Inner agentic loop — keeps calling the LLM until we get a final output
  while (true) {
    const chat = await client.chat.completions.create({
      model: 'gemini-2.5-flash-lite',   // Change this to your preferred model
      messages,
      response_format: { type: 'json_object' }, // Force JSON output
    });

    const result = chat.choices[0].message.content;

    // Add the assistant's response to history so the next turn has context
    messages.push({ role: 'assistant', content: result });

    // Debug: show the raw LLM JSON response
    console.log('\n------------ AI Response ------------');
    console.log(result);
    console.log('-------------------------------------\n');

    const call = JSON.parse(result);

    if (call.type === 'output') {
      // ✅ Final answer — print and break out of the inner loop
      console.log(`🤖: ${call.output}\n`);
      break;

    } else if (call.type === 'plan') {
      // The LLM has formed a plan — nudge it to execute the planned action
      messages.push({
        role: 'user',
        content: JSON.stringify({
          type: 'system',
          content: 'Continue with the planned action.',
        }),
      });

    } else if (call.type === 'action') {
      // The LLM wants to call a tool — execute it and feed back the result
      const fn = tools[call.function];
      const observation = fn(call.input);

      messages.push({
        role: 'user',
        content: JSON.stringify({ type: 'observation', observation }),
      });
    }
  }
}