import { NextResponse, NextRequest } from 'next/server';
import { MODELS, API_BASES } from '@/lib/models';

// Tell Vercel this function may run up to 30 seconds (Pro plan required for >10s)
export const maxDuration = 30;

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

    // Step 2: Socratic Tutor (20s timeout)
    const groqAbort = new AbortController();
    const groqTimeout = setTimeout(() => groqAbort.abort(), 20_000);

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
            content: `You are a Socratic tutor giving quick feedback on student work. The student's whiteboard contains:\n\n${canvasDescription}\n\nRespond with ONE single Socratic question or short observation (max 2 sentences). End your response with a question mark.\n\nSTRICT RULES:\n- NEVER list steps, methods, or actions for the student to perform.\n- NEVER use the words "then", "next", "finally", "first", or "step" — these signal you are prescribing a method.\n- If blank/only a problem statement: ask what they notice about the setup.\n- If work looks correct: confirm briefly and ask what comes next.\n- If there is an error: ask about the specific part that is wrong (don't explain the error).\n- Format math with $...$ inline, $$...$$ block. Use ^ for exponents, always inside $...$.\n\nReturn ONLY valid JSON: {"isCorrect": boolean, "suggestion": "string"}. No markdown, no extra text.`
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
