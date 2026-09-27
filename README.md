# 🤖 AI Agent from Scratch

A **minimal AI Agent** built from scratch in Node.js using the **ReAct (Reason + Act)** pattern.  
The agent thinks step-by-step — planning, calling tools, observing results — before giving a final answer.

Works with **Google Gemini** (free tier) or **OpenRouter** (access to many models, including free ones).

---

## 📖 Table of Contents

- [What is a ReAct Agent?](#what-is-a-react-agent)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Running the Agent](#running-the-agent)
- [Switching LLM Backends](#switching-llm-backends)
- [Example Session](#example-session)
- [How to Add More Tools](#how-to-add-more-tools)
- [Key Concepts](#key-concepts)
- [Dependencies](#dependencies)
- [License](#license)

---

## What is a ReAct Agent?

**ReAct** = **Re**asoning + **Act**ing.

Instead of answering immediately, the agent follows a strict loop:

```
User Query
    │
    ▼
 [PLAN]  ──► Think about what tool to use
    │
    ▼
 [ACTION] ──► Call the tool with the right input
    │
    ▼
 [OBSERVATION] ──► Receive the tool's result
    │
    ▼
 [PLAN again?] ──► Need more info? Loop back.
    │
    ▼
 [OUTPUT] ──► Enough info? Give the final answer.
```

This approach makes the agent **reliable and explainable** — you can see every reasoning step in the terminal output.

---

## How It Works

The system prompt tells the LLM to always respond with a **single JSON object** in one of these shapes:

| Type | Example JSON |
|---|---|
| `plan` | `{ "type": "plan", "plan": "I will call getWeatherDetails for Kolkata." }` |
| `action` | `{ "type": "action", "function": "getWeatherDetails", "input": "Kolkata" }` |
| `observation` | `{ "type": "observation", "observation": "10°C" }` *(injected by our code)* |
| `output` | `{ "type": "output", "output": "The weather in Kolkata is 10°C." }` |

The agent loop in `index.js`:
1. Sends the user's message to the LLM.
2. Parses the JSON response.
3. If it's a `plan` → nudges the LLM to act.
4. If it's an `action` → calls the matching JS function and feeds the result back as an `observation`.
5. If it's an `output` → prints the final answer and waits for the next user query.

---

## Project Structure

```
01 From Scratch/
├── index.js          # The entire agent — client setup, tools, prompt, and loop
├── package.json      # Project metadata and dependencies
├── .env              # Your real API keys (NEVER commit this!)
├── .env.example      # Safe template — copy this to .env and fill in your keys
├── .gitignore        # Ignores node_modules/ and .env
└── 01.output.txt     # Sample terminal output from a real session
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A free API key from **Google AI Studio** or **OpenRouter** (see [Configuration](#configuration))

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/ai-agent-from-scratch.git
cd ai-agent-from-scratch

# 2. Install dependencies
npm install
```

### Configuration

```bash
# Copy the example file
cp .env.example .env
```

Open `.env` and fill in your key:

```env
# For Google Gemini (default)
GEMINI_API_KEY=your_gemini_api_key_here

# For OpenRouter (optional)
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

**Where to get keys:**
- **Gemini** → [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — free tier included ✅
- **OpenRouter** → [openrouter.ai/keys](https://openrouter.ai/keys) — free models available ✅

### Running the Agent

```bash
npm start
```

You'll see a `>>` prompt. Type your question and hit Enter:

```
>> What is the weather in Kolkata?
```

---

## Switching LLM Backends

Open `index.js` and find the **LLM Client Setup** section near the top.

**To use Gemini (default):**
```js
const client = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
});
```

**To use OpenRouter:**
```js
const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});
```

Also update the `model` name in the `client.chat.completions.create()` call to match your chosen provider.

---

## Example Session

```
>> What is the weather in Kolkata?

------------ AI Response ------------
{ "type": "plan", "plan": "I will call getWeatherDetails for Kolkata." }
-------------------------------------

------------ AI Response ------------
{ "type": "action", "function": "getWeatherDetails", "input": "Kolkata" }
-------------------------------------

------------ AI Response ------------
{ "type": "output", "output": "The weather in Kolkata is 10°C." }
-------------------------------------

🤖: The weather in Kolkata is 10°C.

>> What is the sum of weather of Kolkata and Mumbai?

------------ AI Response ------------
{ "type": "plan", "plan": "I will call getWeatherDetails for Kolkata." }
-------------------------------------

... (agent fetches both cities step-by-step)

🤖: The sum of the weather in Kolkata and Mumbai is 24°C.
```

> **See [`01.output.txt`](./01.output.txt)** for a complete real session log.

---

## How to Add More Tools

1. **Write your function** in `index.js`:
    ```js
    function getStockPrice(ticker = '') {
      // call a real API here, or return mock data
      if (ticker.toUpperCase() === 'AAPL') return '$195.00';
      return 'Stock data not available.';
    }
    ```

2. **Register it** in the tool registry:
    ```js
    const tools = {
      getWeatherDetails,
      getStockPrice,   // ← add here
    };
    ```

3. **Tell the LLM** about the new tool in the `SYSTEM_PROMPT`:
    ```
    Available Tools:
    - function getWeatherDetails(city: string): string
      Returns the weather for the given city.
    - function getStockPrice(ticker: string): string   ← add here
      Returns the current stock price for the given ticker symbol.
    ```

That's it — the agent will now use the new tool when relevant!

---

## Key Concepts

| Concept | Description |
|---|---|
| **ReAct Pattern** | Reason before acting; use tool results to inform the next step |
| **System Prompt** | Instructs the LLM to output structured JSON and follow the state machine |
| **JSON Mode** | `response_format: { type: 'json_object' }` forces the LLM to always return valid JSON |
| **Tool Registry** | A plain JS object mapping function name strings → actual functions |
| **Message History** | The full conversation is sent every turn so the LLM has complete context |
| **OpenAI SDK** | Used as a universal HTTP client — works with Gemini & OpenRouter via compatible APIs |

---

## Dependencies

| Package | Purpose |
|---|---|
| [`openai`](https://www.npmjs.com/package/openai) | HTTP client for LLM APIs (Gemini & OpenRouter compatible) |
| [`dotenv`](https://www.npmjs.com/package/dotenv) | Loads `.env` variables into `process.env` |
| [`readline-sync`](https://www.npmjs.com/package/readline-sync) | Synchronous terminal input (the `>>` prompt) |

---

## License

MIT — do whatever you want with it. 🚀
