import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Work Diary AI — server-side AI assistant.
// Routes Core InvokeLLM through the service role (platform rule for Core integrations).
// Exposes three bounded actions: rewrite a single entry, surface insights/patterns,
// and generate a Mon–Sat weekly report. Each returns structured JSON.

function summarizeEntry(e: any): string {
  return [
    `Date: ${e.date || '-'}  Time: ${e.time || '-'}`,
    `Department: ${e.department || '-'}`,
    `Tasks: ${e.tasks || '-'}`,
    `Items received: ${e.itemsReceived || '-'}`,
    `Items issued: ${e.itemsIssued || '-'}`,
    `Problems: ${e.problems || '-'}`,
    `Solutions: ${e.solutions || '-'}`,
    `Observations: ${e.observations || '-'}`
  ].join('\n');
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const action = body?.action;

    if (action === 'rewrite') {
      const entry = body.entry;
      if (!entry) return Response.json({ error: 'Missing entry' }, { status: 400 });
      const prompt =
        'You are a professional work-diary editor. Rewrite the following work-diary entry ' +
        'in clear, professional, well-structured language. Preserve every fact, value, and ' +
        'meaning — do not invent details. Return a single professional narrative summary.\n\n' +
        summarizeEntry(entry);
      const schema = {
        type: 'object',
        properties: { rewritten: { type: 'string' } },
        required: ['rewritten']
      };
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: schema
      });
      return Response.json({ rewritten: result.rewritten });
    }

    if (action === 'insights') {
      const entries = Array.isArray(body.entries) ? body.entries : [];
      if (entries.length === 0)
        return Response.json({ error: 'No entries to analyze' }, { status: 400 });
      const prompt =
        'You are a work productivity analyst. Based on these work-diary entries, ' +
        'identify recurring issues, detect patterns, assess productivity, and give ' +
        'concise, actionable recommendations. Be specific and grounded in the data.\n\n' +
        `Entries (${entries.length}):\n` +
        entries.map((e: any, i: number) => `#${i + 1}\n${summarizeEntry(e)}`).join('\n\n');
      const schema = {
        type: 'object',
        properties: {
          recurring_issues: { type: 'array', items: { type: 'string' } },
          patterns: { type: 'array', items: { type: 'string' } },
          productivity_notes: { type: 'array', items: { type: 'string' } },
          recommendations: { type: 'array', items: { type: 'string' } }
        },
        required: ['recurring_issues', 'patterns', 'productivity_notes', 'recommendations']
      };
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: schema
      });
      return Response.json(result);
    }

    if (action === 'weekly_report') {
      const entries = Array.isArray(body.entries) ? body.entries : [];
      const weekStart = body.weekStart;
      const weekEnd = body.weekEnd;
      if (entries.length === 0)
        return Response.json({ error: 'No entries for this week' }, { status: 400 });
      const prompt =
        'You are a professional weekly-report writer for a personal work diary. ' +
        'Generate a comprehensive weekly report covering ' + weekStart + ' to ' + weekEnd + ' ' +
        '(Monday through Saturday). Summarize all completed work, highlight achievements, ' +
        'list challenges, explain how they were resolved, identify recurring problems, ' +
        'measure productivity, and suggest improvements for the following week. ' +
        'For each day that has an entry, also provide a short professional rewritten summary. ' +
        'Be clear, specific, and grounded only in the provided data.\n\n' +
        `Entries (${entries.length}):\n` +
        entries.map((e: any, i: number) => `#${i + 1}\n${summarizeEntry(e)}`).join('\n\n');
      const schema = {
        type: 'object',
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          achievements: { type: 'array', items: { type: 'string' } },
          challenges: { type: 'array', items: { type: 'string' } },
          resolutions: { type: 'array', items: { type: 'string' } },
          recurring_problems: { type: 'array', items: { type: 'string' } },
          productivity: { type: 'string' },
          recommendations: { type: 'array', items: { type: 'string' } },
          daily_summaries: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string' },
                department: { type: 'string' },
                professional_summary: { type: 'string' }
              },
              required: ['date', 'professional_summary']
            }
          }
        },
        required: ['title', 'summary', 'achievements', 'challenges', 'resolutions', 'recurring_problems', 'productivity', 'recommendations', 'daily_summaries']
      };
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: schema
      });
      return Response.json(result);
    }

    if (action === 'chat') {
      const entries = Array.isArray(body.entries) ? body.entries : [];
      const question = typeof body.question === 'string' ? body.question : '';
      const history = Array.isArray(body.history) ? body.history : []; // [{role:'user'|'assistant', content:string}]
      if (!question.trim())
        return Response.json({ error: 'Missing question' }, { status: 400 });

      const historyText = history
        .slice(-6) // keep the prompt bounded — last few turns of context is enough
        .map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');

      const prompt =
        'You are a personal assistant that answers questions strictly using the user\'s own ' +
        'saved work-diary entries below. Search through all of them to find what is relevant ' +
        'to the question. Answer specifically and directly. If the entries do not contain the ' +
        'information needed to answer, say clearly that it is not in the diary — never invent ' +
        'or assume anything that is not written in the entries.\n\n' +
        (historyText ? `Recent conversation:\n${historyText}\n\n` : '') +
        `All diary entries (${entries.length}):\n` +
        entries.map((e: any, i: number) => `#${i + 1}\n${summarizeEntry(e)}`).join('\n\n') +
        `\n\nQuestion: ${question}`;

      const schema = {
        type: 'object',
        properties: { answer: { type: 'string' } },
        required: ['answer']
      };
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: schema
      });
      return Response.json({ answer: result.answer });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: (error as Error).message || 'AI assistant failed' },
      { status: 500 }
    );
  }
}