import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();
app.use('/*', cors());

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function toGeminiMessages(messages) {
  let system = '';
  const contents = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      system = msg.content;
    } else {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      contents.push({ role, parts: [{ text: msg.content }] });
    }
  }

  return { system, contents };
}

app.post('/api/complete', async (c) => {
  try {
    const { model, messages } = await c.req.json();
    if (!model || !messages) {
      return c.json({ error: 'Campos "model" e "messages" são obrigatórios' }, 400);
    }

    const apiKey = c.env.GEMINI_API_KEY;
    if (!apiKey) {
      return c.json({ error: 'GEMINI_API_KEY não configurada' }, 500);
    }

    const { system, contents } = toGeminiMessages(messages);
    const url = `${GEMINI_BASE}/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const body = { contents };
    if (system) {
      body.system_instruction = { parts: [{ text: system }] };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      return c.json({ error: `Gemini: ${err}` }, res.status);
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let currentText = '';

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            await writer.write(encoder.encode('data: [DONE]\n\n'));
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (!data || data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (text && text !== currentText) {
                  currentText = text;
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`));
                }
              } catch {}
            }
          }
        }
      } catch (e) {
        if (e.name !== 'AbortError') {
          await writer.write(encoder.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`));
        }
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

app.get('/api/health', (c) => c.json({ status: 'ok' }));

export default app;
