import { NextRequest } from 'next/server';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import { MODELS, apiKey, stripThinking } from '@/lib/models';
import { VISION_TRANSCRIBE_PROMPT, extractTranscription } from '@/lib/prompts';

export const maxDuration = 75;

export async function POST(req: NextRequest) {
  try {
    const { messages, data } = await req.json();

    let systemPrompt = "You are a helpful Socratic tutor. Guide the student using hints and questions. STRICTLY format ALL math, physics, and chemistry expressions using LaTeX enclosed in $ for inline and $$ for blocks. NEVER use plain-text math like 'int(x)' or 'x^2' without $...$. For example, use $\\\\int$ instead of int, $\\\\frac{1}{2}$ instead of 1/2, and $H_2O$ instead of H2O.";

    // If a canvas image was sent, transcribe it first so the tutor can "see" it
    const canvasBase64 = data?.canvasBase64 || data?.[0]?.canvasBase64;
    if (canvasBase64) {
      const visionAbort = new AbortController();
      let visionTimeout: NodeJS.Timeout | null = null;
      try {
        visionTimeout = setTimeout(() => visionAbort.abort(), 45_000);
        const visionReq = await fetch(`${MODELS.vision.apiBase}/chat/completions`, {
          signal: visionAbort.signal,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey(MODELS.vision)}`
          },
          body: JSON.stringify({
            model: MODELS.vision.model,
            max_tokens: 2000,
            reasoning_budget: 4096,
            temperature: 0.6,
            top_p: 0.95,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: VISION_TRANSCRIBE_PROMPT
                  },
                  {
                    type: 'image_url',
                    image_url: { url: canvasBase64 }
                  }
                ]
              }
            ]
          })
        });

        if (visionReq.ok) {
          const visionRes = await visionReq.json();
          const transcription = extractTranscription(visionRes.choices[0].message.content, stripThinking);
          systemPrompt += `\n\nThe student is currently looking at their whiteboard. Here is a transcription of what is on it right now:\n\n${transcription}`;
        }
      } catch (e) {
        console.error("Failed to transcribe canvas for chat:", e);
      } finally {
        if (visionTimeout) clearTimeout(visionTimeout);
      }
    }

    const groqReq = await fetch(`${MODELS.reasoning.apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey(MODELS.reasoning)}`
      },
      body: JSON.stringify({
        model: MODELS.reasoning.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        stream: true,
      })
    });

    if (!groqReq.ok) {
      throw new Error(`Groq API error: ${await groqReq.text()}`);
    }

    const stream = OpenAIStream(groqReq);
    return new StreamingTextResponse(stream);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('chat error:', error);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
