import { GoogleGenAI } from '@google/genai';

export const generateQuiz = async (text, options) => {
  const { difficulty, numQuestions, topics } = options;
  
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables');
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const prompt = `
You are an expert AI quiz generator. Based on the following extracted text from a document, generate a multiple-choice quiz.
Difficulty Level: ${difficulty}
Number of Questions: ${numQuestions}
Topics to focus on (if any): ${topics}

Ensure each question has 4 options, only 1 correct answer, and a brief explanation of why it is correct.
The output MUST be in valid JSON format exactly like this schema:
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Exact text of the correct option",
    "explanation": "Why this is correct"
  }
]

Extracted Text:
"""
${text.substring(0, 15000)} // Limiting text to prevent context overflow if too large
"""

Provide ONLY the JSON output, without markdown blocks or any other text.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const outputText = response.text;
    
    // Attempt to parse JSON
    try {
      return JSON.parse(outputText);
    } catch (parseError) {
      // In case it returns with markdown block despite instructions
      const cleaned = outputText.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    }
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw new Error('Failed to generate quiz: ' + error.message);
  }
};
