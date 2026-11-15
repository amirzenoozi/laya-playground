# Using the playground

What each tab does and how to use it.

## Decide

1. Paste the **text to judge**.
2. Add questions, from scratch or with a **Start from** template (Sentiment, Yes / No check, Urgency, Topic). Each question has a type:

   | Type | You give | Laya answers |
   |---|---|---|
   | Yes / No | the question; optionally what yes and no mean | the probability of yes |
   | Choice | 2 to 20 options | the probability of each option |
   | Score | 2 to 10 levels, lowest first | the probability of each level and the expected level |

   Type an option and press **Enter** to add it; `label: description` adds a hint that helps Laya choose (for example `delivery: shipping, parcels, couriers`). Pasting a list adds one option per line, and Backspace in an empty box removes the last one.
3. Press **Ask** (or ⌘ Enter). The answers appear one by one, each with every option's probability and Laya's confidence. **Stop** cancels; **JSON** shows the request, ready to copy into a script.

Laya answers zero-shot: good option descriptions matter more than the wording of the question, and its confidence is a rough guide rather than a calibrated probability.

## Chat

Pick a model, type a message and press **Enter** (Shift Enter for a new line). Under **System prompt and options** you can set a system prompt, the temperature (0 to 2) and a maximum number of tokens; empty fields use the model's defaults. **Stop** keeps what was written so far, **Regenerate** replaces the last reply, **Copy** copies a reply and **New chat** starts over.

The messages go to the model exactly as you send them: the app adds no system prompt of its own and filters nothing.

## Everywhere

- The theme switch at the top right picks System, Light or Dark; System follows the OS as it changes.
- Each tab remembers its last state in your browser (the questions, the conversation, the settings), so a reload loses nothing. Clearing the site's data clears them.
- Switching tabs never interrupts a running answer or reply.

---

See also: [Architecture](architecture.md) · [API](api.md) · [Back to the README](../README.md)
