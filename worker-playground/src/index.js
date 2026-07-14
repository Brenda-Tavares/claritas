import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();
app.use('/*', cors());

const MODEL_MAP = {
  'llama-3.1-8b': '@cf/meta/llama-3.1-8b-instruct',
  'mistral-7b': '@cf/mistral/mistral-7b-instruct-v0.1',
};

app.post('/api/complete', async (c) => {
  try {
    const { model, messages } = await c.req.json();
    if (!model || !messages) {
      return c.json({ error: 'Campos "model" e "messages" são obrigatórios' }, 400);
    }

    const aiModel = MODEL_MAP[model];
    if (!aiModel) {
      return c.json({ error: `Modelo desconhecido: ${model}` }, 400);
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      try {
        const stream = await c.env.AI.run(aiModel, {
          messages,
          stream: true,
        });

        for await (const chunk of stream) {
          const text = chunk.response;
          if (text) {
            const payload = JSON.stringify({
              candidates: [{ content: { parts: [{ text }] } }]
            });
            await writer.write(encoder.encode(`data: ${payload}\n\n`));
          }
        }
        await writer.write(encoder.encode('data: [DONE]\n\n'));
      } catch (e) {
        await writer.write(encoder.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`));
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
