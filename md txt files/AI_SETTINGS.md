# AI Settings (Claude Sonnet 4.5)

This project does not have a built-in AI integration, but we added a small feature flag and configuration to enable a centralized default LLM if/when you integrate one.

## How it works

- The `config.js` module now exports `getAIConfig()` which will return:
  - `defaultModel`: string (e.g., `claude-sonnet-4.5`)
  - `enableForAllClients`: boolean (true by default)

- The Node.js server logs the AI config during startup and provides a simple debug endpoint:
  - GET `/api/ai-config`

## How to change the default model

Set the following environment variables in your `.env` file or deployment environment:

```
AI_DEFAULT_MODEL=claude-sonnet-4.5
AI_ENABLE_FOR_ALL_CLIENTS=true
```

Then restart the server. The `/api/ai-config` endpoint should show the new values.

## Notes

- This change only adds configuration for an LLM; it doesn't integrate with any external AI or provide inference endpoints.
- If you want full integration, you can extend `server.js` or `functions/index.js` to reference `getAIConfig()` and call your AI provider.
- Be mindful of costs, rate limits, and privacy when enabling LLM access for clients. Ensure you have appropriate API keys and server-side protections in place.

## Example usage in server code

```js
const { getAIConfig } = require('./config');
const aiConfig = getAIConfig();
if (aiConfig.enableForAllClients) {
  // Use aiConfig.defaultModel when calling your AI provider
}
```
