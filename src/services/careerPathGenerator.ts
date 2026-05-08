import { callOpenAI, ANTI_SLOP_PROMPT } from './aiService';

export interface CareerPathSuggestion {
  id: string;
  title: string;
  rationale: string;
  queryHints: string[];
}

export async function generateCareerPathSuggestions(
  resumeText: string,
  antiSlopEnabled: boolean = true
): Promise<CareerPathSuggestion[]> {
  const prompt = `You are an expert career counselor specializing in remote work opportunities.
Based on the following resume, suggest EXACTLY 3 highly relevant career paths (job titles) that:
1. This person is genuinely well-suited for, based on a deep analysis of their seniority, technical skills, industry background, and specific accomplishments.
2. Are commonly available as fully remote positions.

CRITICAL: Return ONLY a flat JSON array of objects. Do not wrap the array in a root object like {"suggestions": [...]}.

Return structure:
[
  {
    "id": "unique-kebab-case-id",
    "title": "Senior Frontend Engineer",
    "rationale": "Brief reason why this fits based on the resume.",
    "queryHints": ["keyword1", "keyword2"]
  }
]

${antiSlopEnabled ? ANTI_SLOP_PROMPT : ''}

Resume Text (first 3000 chars):
${resumeText.substring(0, 3000)}

Respond ONLY with the JSON array.`;

  try {
    const response = await callOpenAI([{ role: 'user', content: prompt }], { type: 'json_object' });
    if (response.choices?.[0]?.message?.content) {
      const content = response.choices[0].message.content;
      console.log('Career Path Suggestion Raw Response:', content);
      
      const parsed = JSON.parse(content);
      
      if (Array.isArray(parsed)) {
        return parsed;
      }
      
      // Handle cases where the AI wraps the array in an object
      const suggestions = parsed.careerPaths || parsed.suggestions || parsed.paths || parsed.data || Object.values(parsed).find(v => Array.isArray(v));
      
      if (Array.isArray(suggestions)) {
        return suggestions;
      }
      
      console.warn('AI returned a JSON object for career paths but no recognized array field was found.', parsed);
    } else {
      console.warn('AI returned an empty response for career path suggestions.');
    }
  } catch (err) {
    console.error('Error generating career path suggestions', err);
  }
  return [];
}
