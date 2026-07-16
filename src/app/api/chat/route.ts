import { NextRequest } from 'next/server';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import { MODELS, API_BASES } from '@/lib/models';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { messages, data } = await req.json();

    let systemPrompt = "You are a helpful Socratic tutor. Guide the student using hints and questions. STRICTLY format ALL math, physics, and chemistry expressions using LaTeX enclosed in $ for inline and $$ for blocks. NEVER use plain-text math like 'int(x)' or 'x^2' without $...$. For example, use $\\int$ instead of int, $\\frac{1}{2}$ instead of 1/2, and $H_2O$ instead of H2O.";

    // If a canvas image was sent, transcribe it first so the tutor can "see" it
    const canvasBase64 = data?.canvasBase64 || data?.[0]?.canvasBase64;
    if (canvasBase64) {
      try {
        const visionReq = await fetch(`${API_BASES.nim}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NVIDIA_NIM_API_KEY}`
          },
          body: JSON.stringify({
            model: MODELS.vision,
            max_tokens: 1000,
            messages: [
              {
                role: 'user',
                content: [
                  { 
                    type: 'text', 
                    text: "You are an expert math image transcriber. Describe exactly what is written on this whiteboard canvas: equations, steps, notation, any scratch work. Pay close attention to typed problem statements at the top to infer correct variables (e.g., if the problem uses 'z', make sure not to confuse handwritten 'z' for '2', 'x', or 'y'). Output structured text only — no interpretation." 
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
          systemPrompt += `\n\nThe student is currently looking at their whiteboard. Here is a transcription of what is on it right now:\n\n${visionRes.choices[0].message.content}`;
        }
      } catch (e) {
        console.error("Failed to transcribe canvas for chat:", e);
      }
    }

    const groqReq = await fetch(`${API_BASES.groq}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: MODELS.reasoning,
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
  } catch (error: any) {
    console.error('chat error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
