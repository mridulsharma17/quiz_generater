import multer from 'multer';
import { parseDocument } from './parserService.js';
import { GoogleGenAI } from '@google/genai';

// Disable default body parser to allow multer to handle the multipart form
export const config = {
  api: {
    bodyParser: false,
  },
};

const storage = multer.memoryStorage();
const upload = multer({ storage: storage }).single('document');

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(req, res) {
  // CORS Headers for Vercel Serverless
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Run Multer Middleware to parse the multipart/form-data
    await runMiddleware(req, res, upload);

    const file = req.file;
    const { difficulty, numQuestions, topics, textContent } = req.body;

    if (!file && (!textContent || textContent.trim() === '')) {
      return res.status(400).json({ error: 'Please upload a document or enter some text' });
    }

    // 2. Parse the document (PDF, DOCX, TXT) or use direct text content
    let extractedText = '';
    if (file) {
      extractedText = await parseDocument(file);
    } else {
      extractedText = textContent;
    }

    if (!extractedText || extractedText.trim() === '') {
      return res.status(400).json({ error: 'Could not extract or retrieve text content' });
    }

    // 3. Setup Gemini API
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `
You are an expert AI quiz generator. Based on the following extracted text from a document, generate a multiple-choice quiz.
Difficulty Level: ${difficulty || 'Medium'}
Number of Questions: ${parseInt(numQuestions) || 5}
Topics to focus on (if any): ${topics || 'All available topics'}

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
${extractedText.substring(0, 15000)} // Limiting text to prevent context overflow if too large
"""

Provide ONLY the JSON output, without markdown blocks or any other text.
    `;

    // 4. Generate the quiz using Gemini 1.5 Flash (as requested)
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const outputText = response.text;

    let quizData;
    try {
      quizData = JSON.parse(outputText);
    } catch (parseError) {
      const cleaned = outputText.replace(/```json/g, '').replace(/```/g, '').trim();
      quizData = JSON.parse(cleaned);
    }

    // 5. Send Response
    res.status(200).json({
      success: true,
      quiz: quizData
    });

  } catch (error) {
    console.error('Error in /api/generate-quiz:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
