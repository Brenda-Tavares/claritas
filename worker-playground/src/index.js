import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();
app.use('/*', cors());

const MODEL_MAP = {
  'llama-3.1-8b': '@cf/meta/llama-3.1-8b-instruct-fp8',
  'llama-3.2-3b': '@cf/meta/llama-3.2-3b-instruct',
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

        const aiResult = await c.env.AI.run(aiModel, {
          messages,
          stream: true,
        });

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        const transform = new TransformStream({
          transform(chunk, controller) {
            try {
              const sse = decoder.decode(chunk, { stream: true });
              const lines = sse.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim();
                  if (!data) continue;
                  const parsed = JSON.parse(data);
                  const text = parsed.response || '';
                  if (text) {
                    const out = JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] });
                    controller.enqueue(encoder.encode(`data: ${out}\n\n`));
                  }
                }
              }
            } catch {}
          },
          flush(controller) {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          },
        });

        const body = aiResult instanceof ReadableStream
          ? aiResult.pipeThrough(transform)
          : new ReadableStream({
              async start(controller) {
                try {
                  for await (const chunk of aiResult) {
                    const text = chunk.response || '';
                    if (text) {
                      const out = JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] });
                      controller.enqueue(encoder.encode(`data: ${out}\n\n`));
                    }
                  }
                } catch (e) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`));
                } finally {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  controller.close();
                }
              },
            });

        return new Response(body, {
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
