# I Can Manage simulated text conversation

## Run the browser demo

Use Node.js 22 or newer. In the project folder create a private local file named .env containing OPENAI_API_KEY= followed by your API key. Run:

    node --env-file=.env server.js

Open http://localhost:3000, enable the simulated texting feature and type a fictional question. Try “What should I bring for my hospital stay?” or “What do I need to clean the inner part of my trach?” Read the short message and reply NEXT to continue, or ask a different question. The trach cleaning flow asks about a reusable inner cannula, shows the supplies, waits for READY, and then pairs the cleaning steps with photos. Visits, reminders, and results are simulated.

## Where messages come from

The project includes material from all 40 decks in the 10 numbered folders. The API selects a source passage. The server sends prepared chunks of source text and relevant image crops, keeping the page identifiers internal. Test with fictional questions. The API key stays on the server. Set OPENAI_MODEL to override gpt-4.1-mini.

For the scripted trach flow and appointment request, run node server.js without a key. For a hosted demo, use the same Node entry point, configure PORT and keep the OpenAI key in server-side settings.
