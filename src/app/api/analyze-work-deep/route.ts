import { NextResponse, NextRequest } from 'next/server';
import { MODELS, API_BASES } from '@/lib/models';

// Tell Vercel this function may run up to 60 seconds (Pro plan required for >10s)
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { canvasBase64 } = await req.json();
    
    if (!canvasBase64) {
      return NextResponse.json({ error: 'Missing canvas image' }, { status: 400 });
    }

    // Step 1: Vision Transcription (15s timeout)
    const visionAbort = new AbortController();
    const visionTimeout = setTimeout(() => visionAbort.abort(), 15_000);

    let visionRes: any;
    try {
      const visionReq = await fetch(`${API_BASES.nim}/chat/completions`, {
        method: 'POST',
        signal: visionAbort.signal,
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
                  text: 'You are an image transcriber. Describe exactly what is written on this whiteboard canvas: equations, steps, notation, any scratch work. Output structured text only — no interpretation.' 
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
      if (!visionReq.ok) throw new Error(`Vision API error: ${await visionReq.text()}`);
      visionRes = await visionReq.json();
    } finally {
      clearTimeout(visionTimeout);
    }
    
    const canvasDescription = visionRes.choices[0].message.content;
    console.log('[analyze-work-deep] canvas description:', canvasDescription.slice(0, 200));

    // Step 2: Deep Socratic Analysis via Groq (45s timeout)
    // Using JSON output so isCorrect is reliable rather than a fragile heuristic
    const deepAbort = new AbortController();
    const deepTimeout = setTimeout(() => deepAbort.abort(), 45_000);

    let deepRes: any;
    const t0 = Date.now();
    try {
      const deepReq = await fetch(`${API_BASES.groq}/chat/completions`, {
        method: 'POST',
        signal: deepAbort.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: MODELS.reasoning,
          max_tokens: 600,
          response_format: { type: 'json_object' },
          messages: [{
            role: 'user',
            content: `You are a Socratic tutor giving a DEEPER analysis than a quick check. The student's whiteboard contains:\n\n${canvasDescription}\n\nYour response must be more substantial than a simple question — it should:\n1. Identify the key mathematical concept or technique relevant to this problem or work (name it explicitly, e.g. "surface parameterization", "u-substitution", "cross product").\n2. Briefly explain WHY that concept applies here (1 sentence).\n3. End with a focused Socratic question that points to the next concrete step.\n\nSTRICT RULES:\n- If the canvas appears blank or only shows a problem statement (no student work), identify the problem TYPE and the main concept needed to solve it, then ask: "Do you know how to [apply that concept]?" or "What does [concept] tell you about this setup?" — don't just ask "what's your first step?".\n- NEVER give the answer, a worked solution, or step-by-step method.\n- Write 3-4 sentences maximum. No bullet lists.\n- If their work has errors, name WHAT is wrong conceptually (e.g. "the limits of integration don't account for the constraint") without showing how to fix it.\n- If their work is correct so far, confirm what they've done right and name the next concept they'll need.\n- Format ALL math with KaTeX: $...$ inline, $$...$$ block. Use ^ for exponents, \\frac{}{} for fractions — always inside $...$.\n\nReturn ONLY valid JSON: {"isCorrect": boolean, "suggestion": "string"}. No markdown, no extra text.`
          }]
        })
      });
      if (!deepReq.ok) throw new Error(`Deep Analysis API error: ${await deepReq.text()}`);
      deepRes = await deepReq.json();
    } finally {
      clearTimeout(deepTimeout);
    }

    console.log(`[analyze-work-deep] Groq responded in ${Date.now() - t0}ms`);
    const rawText: string = deepRes.choices[0].message.content;
    console.log('[analyze-work-deep] raw output:', rawText);

    // Reuse same robust parsing logic as the quick-check route
    let parsedResult: { isCorrect: boolean; suggestion: string } | null = null;
    const extractResult = (obj: any): typeof parsedResult => {
      if (obj && typeof obj.suggestion === 'string' && typeof obj.isCorrect === 'boolean') {
        const suggestion = obj.suggestion
          .replace(/\r\n|\r|\n/g, ' ')
          .replace(/\\n/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim();
        return { isCorrect: obj.isCorrect, suggestion };
      }
      return null;
    };
    try { parsedResult = extractResult(JSON.parse(rawText)); } catch { /* continue */ }
    if (!parsedResult) {
      try {
        const match = rawText.match(/\{[\s\S]*\}/);
        if (match) parsedResult = extractResult(JSON.parse(match[0]));
      } catch { /* continue */ }
    }
    if (!parsedResult) {
      parsedResult = { isCorrect: false, suggestion: rawText.replace(/<think>[\s\S]*?<\/think>/g, '').trim() };
    }

    return NextResponse.json(parsedResult);
  } catch (error: any) {
    const isTimeout = error.name === 'AbortError';
    console.error('analyze-work-deep error:', isTimeout ? 'TIMEOUT' : error.message);
    return NextResponse.json(
      { error: isTimeout ? 'Analysis timed out. Please try again.' : error.message },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
