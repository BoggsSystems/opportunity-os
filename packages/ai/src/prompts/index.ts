// AI prompt templates and management

export const PROMPTS = {
  SUMMARIZE_OPPORTUNITY: `
Summarize the following opportunity information in a concise format:

Title: {title}
Description: {description}
Company: {company}
Stage: {stage}

Focus on key value propositions and next steps.
`,

  GENERATE_OUTREACH: `
Generate a personalized outreach email for:

Person: {personName}
Company: {companyName}
Role: {role}
Context: {context}

Keep it professional, concise, and focused on value.
`,

  ANALYZE_RESUME: `
Analyze this resume and extract:
1. Key skills and technologies
2. Experience level
3. Education background
4. Notable achievements
5. Potential fit for {targetRole}

Resume text: {resumeText}
`,
} as const;
