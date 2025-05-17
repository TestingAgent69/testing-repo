import Vapi from "@vapi-ai/web";

export const vapi = new Vapi(import.meta.env.VITE_VAPI_API_KEY);
const assistantId = import.meta.env.VITE_ASSISTANT_ID;

/**
 * Start the assistant, injecting a fixed system prompt plus any user messages.
 *
 * @param {object} assistantOverrides – any overrides (e.g. metadata: today, timezone)
 * @param {Array} userMessages – array of { role: 'user', content: string }
 * @returns {Promise<object>} – the assistant start payload (including call ID)
 */
export const startAssistant = async (assistantOverrides = {}, userMessages = []) => {
  try {
    // Build your “never-mention-today’s-time” system prompt
    const systemPrompt = {
      role: "system",
      content: `
You are a scheduling assistant.
• Do NOT mention the current date or time.
• Always respond in this exact template:
  “Alright! ${assistantOverrides.dayOfWeek}, what would be {insert date}, would you like to book a call on {insert date}?”
• When the user gives a date (e.g. “Sunday” or “June 5th at 3pm”), fill both {insert date} slots with that exact date.
      `.trim()
    };

    // Prepend systemPrompt to whatever userMessages were passed
    const messages = [systemPrompt, ...userMessages];

    // Pass messages plus your metadata overrides into VAPI
    return await vapi.start(assistantId, {
      messages,
      ...assistantOverrides
    });
  } catch (error) {
    console.error("Failed to start assistant:", error);
    throw error;
  }
};

export const stopAssistant = () => {
  try {
    vapi.stop();
  } catch (error) {
    console.error("Failed to stop assistant:", error);
  }
};
