# Technical Guide — how Claritas was built

> The reasoning behind each decision, and the development history.
> English.

This document stands on its own. The README explains what the project is; this one explains why it ended up this way, including the paths that were tried and abandoned.

---

## 1. The problem

Two crafts that share a syntax and almost never share a method: Markdown, the universal notation for technical documentation, and prompt engineering, the structured way to talk to a language model. Both are widely taught as a bag of tricks, which makes them easy to imitate and hard to reason about.

Underneath that sat a more uncomfortable problem. Most "AI portals" of this kind blur three different things — a static text block appended to a system prompt, a genuine retrieval pipeline, and a set of hard-written rules pretending to be intelligence. Once those are confused, a tool that claims to be documenting prompt engineering ends up overstating its own nature. A portal that teaches a craft has an obligation to describe its own boundaries precisely, because that is the lesson itself.

## 2. What was thought through

### Isolation has to be architectural

The first version of the Playground let a user pick any model and kept a conversation per card, but the model choice was a client-side string. That is a suggestion, not a boundary. A user — or anything that can speak HTTP — could ask the function for a model it was never meant to reach, and the per-card "isolation" would be a property of the UI rather than of the system.

The fix was to move ownership to the server. The browser now sends a model *id*; the function validates it against `ALLOWED_MODELS` and rejects anything else with a 400. Only then does the call go upstream. Isolation stopped being a promise made by a widget and became a property of the deployment.

A consequence worth stating plainly: the function is **stateless**. It holds no conversation, no history and no session. It re-validates every single request on its own. The lock on the model selector during a dialogue is therefore a client contract — the UI disables the control and the user cannot break the thread by switching models mid-conversation — and not a server guarantee. A crafted request could still change the model between turns. Saying otherwise would be exactly the kind of overstatement this project set out to avoid.

### The allowlist is a security control, not a preference

Once the server owned the model choice, the second question was what happens when a model fails. The original fallback walked the entire allowlist: fifteen candidates for a single failing request, which is a plausible amplification of both quota and spend from one unlucky click.

It now builds exactly three candidates — the requested model plus at most two reserves. The trade-off is explicit: a three-model outage surfaces an error instead of silently degrading through the whole list. Given that the project is free-tier and explicitly about not lying to the user, a visible failure is the better outcome.

### Honesty as a design constraint

"Claritas is not RAG" is stated in the README, in this guide, and in the source itself, where the fixed knowledge block is labelled `não-RAG`. The label looks redundant next to a comment that says the same thing. It stays because the next person to read that constant will not have read either document, and an unlabelled string of several hundred words concatenated into a system prompt reads exactly like retrieved context.

The same reasoning drove the decision to make the output filter visible. Detecting that a model echoed the application's own system instructions back to the user is not a theoretical concern: it is the most direct way internal instructions leak, and the fix — truncate and mask before the bytes reach the browser — is worth documenting precisely because it is unusual.

### Documentation that cannot be verified rots

The allowlist was duplicated across several files for most of the project's life. Each copy was correct on the day it was written, and the copies drifted. The same happened to the i18n key count, the declared version, and the rate limits — all of which appeared in prose that nobody re-read.

The resolution is that numbers are no longer typed into documentation by hand. A check reads the model ids, the rate limits, the token caps, the i18n key count and the declared version directly from the source files and fails whenever a document disagrees with the code. A regression suite corrupts a copy of each document on purpose, to prove the check still catches it. The counts table in the README is therefore not a promise; it is a report.

## 3. The solution

A static portal — two files, no build step — backed by one serverless function that owns the provider call.

The absence of a toolchain is not asceticism. It removes the build step, the dependency tree and the supply-chain surface at once, and it keeps the whole client auditable without installing anything. The cost was real: 100 KB of JavaScript inlined in the HTML is harder to navigate than a module tree, and it also meant `script-src` had to carry `'unsafe-inline'` to let any of it run.

That is the trade this section describes. A `Content-Security-Policy` that permits inline script does not meaningfully constrain where that script comes from, so the policy was not protecting the thing it appeared to protect. The script moved to `site/app.js` and the 28 `onclick` handlers became `data-*` attributes read by a single delegated listener, which is what allowed `script-src` to drop to `'self'`.

`'unsafe-hashes'` would have kept the inline attributes and avoided touching them. It was rejected: the directive is not implemented uniformly across browsers, and where it is ignored an `onclick` is simply dropped, leaving the link inert with no error anywhere. A page that silently does nothing is a worse failure than a page that is two files.

On the server side, the function is deliberately narrow: validate the model, enforce the persona, inject the system prompt, discard anything the client tried to smuggle in as a `system` message, apply the language directive, cap the body, count against the rate limit, and proxy.

## 4. Architecture

```
Browser (site/index.html)
  │  model id, persona, lang, user messages
  │  never: API key, model choice, system prompt
  ▼
Pages Function (site/functions/api/chat.js)
  ├─ validate model against ALLOWED_MODELS      → 400 if unknown
  ├─ resolve persona, discard client `system`   → server owns instructions
  ├─ attach language directive                   → client cannot override
  ├─ anti-echo fingerprint of system messages   → truncate/mask the answer
  ├─ rate limit, body cap, token cap             → bound the cost
  └─ proxy to OpenRouter, ≤ 3 candidates on failure
  ▼
OpenRouter (chat/completions)
```

### Constants that bound the system

| Constant | Value | Why it exists |
|---|---|---|
| `RATE_LIMIT_MAX_MIN` | 30 req/min per IP | A single client cannot exhaust the free tier |
| `RATE_LIMIT_MAX_DAY` | 300 req/day per IP | Stops a slow drain that a per-minute limit misses |
| `RATE_LIMIT_AUTO_BLOCK` | 120 within a minute | A 24h block for behaviour that looks automated |
| `MAX_BODY_BYTES` | 256 KB | A prompt has no reason to be larger |
| `MAX_OUTPUT_TOKENS` | 2048 | Spend is bounded per call, not per session |
| fallback candidates | 3 | One failure cannot fan out into a burst of paid calls |

## 5. Security

### Why the CSP is split in two

The first version carried the whole policy in a `<meta http-equiv>` tag. It looked correct and reported clean, which is the worst combination available. `frame-ancestors`, `X-Frame-Options` and `X-Content-Type-Options` are all **ignored** when delivered in a meta tag — they are not weakened, they simply do not apply. The policy was giving the appearance of framing protection while providing none.

The policy is now delivered in two layers: the meta tag keeps the directives that are valid there, and `site/_headers` carries the rest as real HTTP response headers on Cloudflare Pages. A header that is silently ignored is worse than an absent one, because it removes the incentive to check.

### The deliberate absences

- No `'unsafe-eval'`, and no `innerHTML` for user data — dynamic output uses `textContent` and `appendChild`
- No CDN, no third-party scripts; Google Fonts is the one external request, and the CSP allows exactly that host
- No API key in any file; the credential is an environment variable read server-side
- External links carry `rel="noopener noreferrer"`
- A kill switch drops the proxy to 503 from the deploy dashboard without a redeploy of code

The full OWASP LLM Top 10 mapping is in [`SECURITY.md`](SECURITY.md).

## 6. Why this is not RAG

There are no embeddings, no vector database, no document indexing and no retrieval step at runtime. Every behaviour comes from hand-written system prompts, sent through `chat/completions`.

The distinction is worth keeping sharp. A retrieval pipeline grounds a model in content it did not previously contain, and it fails differently when it breaks: it can surface the wrong document. Fixed text in a system prompt is closer to a very long, human-authored instruction, and it fails differently too: it can be contradicted by the user's own framing. Calling the second thing the first is not a simplification, it is a different claim about where the knowledge came from.

## 7. What this is called

Two labels are used, and both are descriptive rather than flattering.

**Two-stage LLM workflow.** The system runs two prompts in sequence, and neither of them answers the user. The first rewrites the request; the second writes a prompt for a third system to run later. What the user receives, in both stages, is text meant to be used somewhere else.

**Metaprompting.** That second stage is metaprompting in the plain sense of the word: a prompt whose object is another prompt. The Prompt Architect receives a request and returns a prompt, not an answer — which is why its own system prompt forbids it from performing the task it was asked to describe.

Two labels that would be inaccurate here are deliberately left out. **Meta-framework** would claim a general architecture with its own abstractions, lifecycle and extension model; this project has two prompts, a proxy and a playground, and calling that a framework would inflate the description. **Chain-to-agent** would claim that stages escalate into autonomous agents that act on their own; here each stage is a single `chat/completions` call with a fixed prompt and no loop of its own. A label is worth keeping only while it survives the question "show me the code that does this". When it does not, it is marketing.

The same rule is applied to the numbers. There is no fixed reduction claimed for the Simulator, no benchmark, and no guarantee that the model obeys its prompt — `saude` being told not to invent medical information is an instruction, not a guarantee. Section 9 lists what this project will not assert.

### Two meanings of "persona" that had to be separated

A real report: asked for a skill or a persona for an agent, the Prompt Architect behaved as if the request were forbidden. It was not forbidden — writing prompts that assign a role to an external AI is the whole point of the stage. Two different objects were sharing one word.

| Sense of the word | What it is | Verdict |
|---|---|---|
| the portal's own personas (general assistant, senior engineer, designer) and their system prompts | this project's IP | never revealed, not even paraphrased or "reconstructed" |
| a persona, skill or agent the user is defining **for an external AI** | the deliverable | exactly what the stage exists to produce |

The prompt now opens with that distinction instead of relying on the reader to infer it, and the composition guide no longer calls an invented capability a "magical persona" — describing a role and granting a capability the target lacks are different acts, and conflating them made a legitimate request look like an escalation. The Playground carries a short note on screen, shown only while RACE is selected, telling the user to name the agent: "create a code-review skill for the backend CI agent" resolves the ambiguity that "create a skill" leaves open. The restriction that actually matters is unchanged — the stage still never reveals its own configuration, and `npm run check:leak` still fails if any real prompt text appears in the public tree.

## 8. Interdisciplinary view

The project sits at the intersection of technical writing and prompt design, and the intersection is not decorative. The same concerns govern both: who is the audience, what is the assumed prior knowledge, what does the reader need to be able to do afterwards, and what happens when the instructions are followed badly.

A documentation page that omits the failure modes is a page that transfers the author's assumptions without disclosing them. A system prompt that omits the failure modes produces output that fails the same way. Treating "the reader might get it wrong" as a first-class design question is what turns both from content into craft.

## 9. Honest limits

- **Not a benchmark.** Free models are chosen for zero-cost availability, not performance leadership.
- **No reasoning measurement.** No ground truth and no scoring; the Playground compares answers to a given prompt.
- **Not an oracle.** The controls reduce injection, leakage and format hallucination; they do not eliminate error.
- **Continuity is a client contract.** The function is stateless and cannot enforce that a conversation stays on one model.
- **The demo has no automated end-to-end tests.** The function's boundaries are asserted by a static check over the source, not by a browser test.
- **In-memory rate limiting is ephemeral.** It is lost on a cold start, so a deployment without the KV binding is rate-limited only until the isolate recycles.

## 10. File map

| Path | Role |
|---|---|
| `site/index.html` | The entire portal: markup, styles, behaviour and the inline i18n dictionary |
| `site/functions/api/chat.js` | The function: allowlist, personas, directives, rate limit, filters, proxy |
| `site/_headers` | Real HTTP security headers |
| `site/assets/` | Icons and logos, light and dark variants |
| `README.md` | English overview |
| `README_PT.md` | Portuguese overview |
| `README_ZH.md` | Chinese overview |
| `SECURITY.md` | Security model and OWASP LLM Top 10 mapping |
| `GUIA_TECNICO.md` | This document |
| `LICENSE` | Terms: a custom license, written out in full |
| `package.json` | Version of record, and the check and test scripts |
| `scripts/check-readme-parity.mjs` | Checks the numbers in these READMEs against the code above |
| `scripts/test-readme-check.mjs` | Proves the check still catches a corrupted document |
| `.github/workflows/readme-parity.yml` | Runs the check on every push |

## 11. Commands

```bash
# local function
npx wrangler pages dev site

# CSP-accurate static preview
npx serve site -l 8080

# the numbers in the READMEs against the code, plus proof the check works
npm test

# real provider call, needs OPENROUTER_API_KEY in the environment
curl -X POST http://localhost:8788/api/chat \
  -H 'content-type: application/json' \
  -d '{"model":"google/gemma-4-31b-it:free","persona":"default","lang":"en",
       "messages":[{"role":"user","content":"Explain Markdown"}],"stream":false}'
```

## 12. Development history

What the project went through, in the order it happened, including the corrections.

**Foundations.** The portal began as a single HTML file served as a static site. The AI features arrived through Cloudflare Workers, which were later migrated to Pages Functions so the site and its backend could ship from one repository with one deploy.

**Provider churn.** The first provider was the platform's own model endpoint. That was abandoned: it was restricted to a specific client and unusable as a public backend. The project moved to OpenRouter, which also meant the model list became an external dependency that had to be monitored — a dynamic problem the project would spend several versions solving.

**A growing allowlist.** The allowlist started at four free models, grew to fifteen, and was then pruned back to the eleven listed above. The growth was not a feature; it was the absence of a decision, and telling a dead id from a good one took a catalogue check. Each dead id was a 500 for the user who picked it, discovered only in production. The fix is a live catalogue check in CI that surfaces deprecations before a user does, and a rule that an id leaving the provider's catalogue has to leave the allowlist in the same change.

**Prompts moved server-side, and then out of the repository.** The persona prompts were originally inline in the client, which meant anyone could read them with the developer tools — including the anti-injection rules, which is exactly the information an attacker wants. They moved to `functions/api/prompts.js`; the client now sends only a persona key, and any `system` message arriving from the client is discarded rather than honoured. Moving them server-side stops the *client* from injecting them. It does not make the text secret: in a public repository the source is readable by definition. So the real prompts of the published project were removed from this repository too, and what ships here are `EXAMPLE_*` prompts written to explain the architecture, deliberately divergent from the originals. Real confidentiality requires a private repository — and, for a prompt that must not be inferred at all, not shipping it in code.

**Anti-echo filtering.** Fingerprints are derived at runtime from the system prompt the server just injected — not from a hand-written list, so editing a prompt cannot silently stop protecting it. A response that reproduces those instructions is truncated and masked before it reaches the browser. The streaming case needed a 512-character delay buffer so a leak arriving mid-stream is still caught.

**Personas were reclassified.** An early version forced every answer into Markdown, on the theory that structure is discipline. It was wrong: it made a conversational assistant sound like a document generator. The rule was inverted — dialogue personas answer in conversation, and only the Prompt Architect produces a Markdown artifact meant for another system. Formatting became a property of the task rather than a global style.

**The Playground went through three shapes.** Multi-turn conversation per card with group and per-card continuation; a lock on model and persona during an active dialogue; and then a configuration screen that replaced inline controls with selectable cards, mirrored states, skill badges and an accessible dialog. The last one exists because the previous layout forced the user to read a wall of warnings before choosing anything.

**Security claims were prose, and prose rots.** The OWASP table and the READMEs disagreed with the code about where the prompts lived: one document described an educational demo with the prompts shipped in the client, the other described server-side injection, and neither matched the code. Documentation that asserts a control does not fail when the control is deleted. Each row is now bound to the code that implements it, and a stale identifier in the docs — a constant or function that no longer exists — is itself a test failure.

**The cost calculator was corrected.** It was documented as a live source of market pricing. It is not: the prices are a hand-maintained snapshot from 2026-07, kept in a single constant in the function and served to the client through one endpoint so there is a single copy. The document now says "snapshot, verify before financial decisions" — which is the honest description of a hand-kept table.

**Dead model removed, count corrected.** A model id that had left the catalogue was still listed in three places, including this project's documentation, which claimed twelve free models. The removal propagated to every copy, and the verification described in section 2 now prevents the count from drifting again.

**A security header that did nothing.** `frame-ancestors` and `X-Frame-Options` in a meta tag were removed once it became clear they were inert there, and the real headers were added in `site/_headers`. See section 5.
