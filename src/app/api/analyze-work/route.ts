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

    // Step 1: Vision Transcription (30s timeout)
    const visionAbort = new AbortController();
    const visionTimeout = setTimeout(() => visionAbort.abort(), 30_000);

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
      if (!visionReq.ok) throw new Error(`Vision API error: ${await visionReq.text()}`);
      visionRes = await visionReq.json();
    } finally {
      clearTimeout(visionTimeout);
    }
    const canvasDescription = visionRes.choices[0].message.content;

    // Step 2: Socratic Tutor (25s timeout)
    const groqAbort = new AbortController();
    const groqTimeout = setTimeout(() => groqAbort.abort(), 25_000);

    let groqRes: any;
    try {
      const groqReq = await fetch(`${API_BASES.groq}/chat/completions`, {
        method: 'POST',
        signal: groqAbort.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: MODELS.reasoning,
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: `You are a Socratic tutor reviewing student work. The student's whiteboard contains:\n\n${canvasDescription}\n\nYour goal is to validate what they have done and guide them on what's next. Structure your response (3-4 sentences) as follows:\n1. Briefly acknowledge the problem they are solving.\n2. Summarize the work they have done so far.\n3. State clearly whether their current step is correct or if there is an error.\n4. End with a Socratic question asking what to do next (if correct) or how to fix the error (if incorrect).\n\nSTRICT RULES:\n- NEVER give the answer, a worked solution, or list steps to perform.\n- If the canvas appears blank or only shows a problem statement (no student work), just acknowledge the problem and ask how they might start.\n- Format ALL math with KaTeX: $...$ inline, $$...$$ block. Use ^ for exponents, \\frac{}{} for fractions — always inside $...$.\n\nReturn ONLY valid JSON: {"isCorrect": boolean, "suggestion": "string"}. No markdown, no extra text.`
          }],
          response_format: { type: "json_object" }
        })
      });
      if (!groqReq.ok) throw new Error(`Groq API error: ${await groqReq.text()}`);
      groqRes = await groqReq.json();
    } finally {
      clearTimeout(groqTimeout);
    }
    const rawText = groqRes.choices[0].message.content;

    console.log('[analyze-work] raw LLM output:', rawText);

    let parsedResult: { isCorrect: boolean; suggestion: string } | null = null;

    // Helper: extract and clean a parsed { isCorrect, suggestion } object
    const extractResult = (obj: any): typeof parsedResult => {
      if (obj && typeof obj.suggestion === 'string' && typeof obj.isCorrect === 'boolean') {
        let suggestion = obj.suggestion
          .replace(/\r\n|\r|\n/g, ' ')    // collapse real newlines to spaces
          .replace(/\\n/g, ' ')            // collapse literal \n sequences
          .replace(/\s{2,}/g, ' ')         // collapse multiple spaces
          .trim();
        // Guard: if the model double-wrapped by putting JSON inside the suggestion string,
        // try to parse it again and use the inner result
        if (suggestion.trimStart().startsWith('{')) {
          try {
            const inner = JSON.parse(suggestion);
            if (typeof inner.suggestion === 'string') {
              suggestion = inner.suggestion.replace(/\r\n|\r|\n/g, ' ').replace(/\\n/g, ' ').trim();
              return { isCorrect: !!inner.isCorrect, suggestion };
            }
          } catch { /* not nested JSON, use as-is */ }
        }
        return { isCorrect: obj.isCorrect, suggestion };
      }
      return null;
    };

    // Stage 1: direct JSON parse of the raw response
    try {
      const obj = JSON.parse(rawText);
      parsedResult = extractResult(obj);
    } catch { /* continue to next stage */ }

    // Stage 2: strip markdown fences and try again
    if (!parsedResult) {
      try {
        const stripped = rawText.replace(/```json|```/g, '').trim();
        const obj = JSON.parse(stripped);
        parsedResult = extractResult(obj);
      } catch { /* continue */ }
    }

    // Stage 3: extract the first JSON object block from anywhere in the text
    if (!parsedResult) {
      try {
        const match = rawText.match(/\{[\s\S]*\}/);
        if (match) {
          const obj = JSON.parse(match[0]);
          parsedResult = extractResult(obj);
        }
      } catch { /* continue */ }
    }

    // Stage 4: last-resort regex strip — pull the suggestion string out manually
    if (!parsedResult) {
      console.warn('[analyze-work] All JSON parse stages failed, using regex strip');
      const isCorrectMatch = rawText.match(/"isCorrect"\s*:\s*(true|false)/);
      const suggestionMatch = rawText.match(/"suggestion"\s*:\s*"([\s\S]*?)(?<!\\)"/);
      const suggestion = suggestionMatch
        ? suggestionMatch[1].replace(/\\n/g, ' ').replace(/\\"/g, '"').replace(/\s{2,}/g, ' ').trim()
        : rawText.replace(/[{}"\n]/g, ' ').trim();
      parsedResult = {
        isCorrect: isCorrectMatch?.[1] === 'true',
        suggestion,
      };
    }

    return NextResponse.json(parsedResult);
  } catch (error: any) {
    console.error('analyze-work error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
