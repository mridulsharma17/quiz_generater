import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { parseDocument } from './services/parserService.js';
import { generateQuiz } from './services/aiService.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Setup multer for file uploads (in-memory)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.get('/', (req, res) => {
  res.json({
    status: 'Backend Running'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'QuizForge AI Backend is running' });
});

// Endpoint to upload a document and generate a quiz
app.post('/api/generate-quiz', upload.single('document'), async (req, res) => {
  try {
    const file = req.file;
    const { difficulty, numQuestions, topics } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // 1. Parse the document
    const extractedText = await parseDocument(file);
    
    if (!extractedText || extractedText.trim() === '') {
      return res.status(400).json({ error: 'Could not extract text from the document' });
    }

    // 2. Generate the quiz using AI
    const quizData = await generateQuiz(extractedText, {
      difficulty: difficulty || 'Medium',
      numQuestions: parseInt(numQuestions) || 5,
      topics: topics || 'All available topics'
    });

    res.json({
      success: true,
      quiz: quizData
    });

  } catch (error) {
    console.error('Error in /api/generate-quiz:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default app;
