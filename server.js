import express from 'express';
import path from 'path';
import multer from 'multer';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
const app = express();

import {
  extractResumeTextFromFile,
  cleanResumeText,
} from './backend/interview/extractResumeText.js';
import { parseResumeToStructured } from './backend/interview/resumeParser.js';
import {
  generateInitialQuestions,
} from './backend/interview/questionEngine.js';
import { evaluateInterviewAnswer } from './backend/interview/answerEvaluator.js';
import { generateInterviewFinalSummary } from './backend/interview/finalSummary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const PORT = process.env.PORT || 3000;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    groqConfigured: Boolean(process.env.GROQ_API_KEY),
  });
});

app.post('/api/resume/parse', upload.single('resume'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Resume file is required' });
    }

    const extractedText = await extractResumeTextFromFile(file);
    const cleanText = cleanResumeText(extractedText);

    if (!cleanText || cleanText.length < 40) {
      return res.status(422).json({ error: 'Unable to extract sufficient text from resume' });
    }

    const resumeProfile = await parseResumeToStructured(cleanText);

    return res.json({
      resumeProfile,
      meta: {
        fileName: file.originalname,
        charactersExtracted: cleanText.length,
      },
    });
  } catch (error) {
    console.error('Resume parsing failed:', error);
    return res.status(500).json({
      error: 'Failed to parse resume',
      detail: error.message,
    });
  }
});

app.post('/api/interview/session', async (req, res) => {
  try {
    const { resumeProfile, interviewType = 'technical' } = req.body || {};

    if (!resumeProfile || !resumeProfile.rawText) {
      return res.status(400).json({ error: 'resumeProfile is required' });
    }

    const questions = await generateInitialQuestions({
      resume: resumeProfile,
      interviewType,
    });

    return res.json({ questions });
  } catch (error) {
    console.error('Interview session generation failed:', error);
    return res.status(500).json({
      error: 'Failed to generate interview session',
      detail: error.message,
    });
  }
});

async function handleInterviewEvaluation(req, res) {
  try {
    const {
      resumeProfile,
      interviewType = 'technical',
      currentQuestion,
      answer,
      history = [],
    } = req.body || {};

    if (!resumeProfile || !currentQuestion || !answer) {
      return res.status(400).json({ error: 'resumeProfile, currentQuestion, and answer are required' });
    }

    const evaluation = await evaluateInterviewAnswer({
      resume: resumeProfile,
      question: currentQuestion,
      answer,
      history,
      interviewType,
    });

    return res.json(evaluation);
  } catch (error) {
    console.error('Interview answer evaluation failed:', error);
    return res.status(500).json({
      error: 'Failed to evaluate answer',
      detail: error.message,
    });
  }
}

app.post('/api/interview/evaluate', handleInterviewEvaluation);

// Backward-compatible alias
app.post('/api/interview/answer', handleInterviewEvaluation);

app.post('/api/interview/summary', async (req, res) => {
  try {
    const { resumeProfile, evaluations = [], transcript = [] } = req.body || {};

    if (!resumeProfile) {
      return res.status(400).json({ error: 'resumeProfile is required' });
    }

    console.log('📋 Summary Request Received:');
    console.log(`   - Number of evaluations: ${evaluations.length}`);
    console.log(`   - Evaluation scores: ${evaluations.map(e => e.overallScore).join(', ')}`);

    const summary = await generateInterviewFinalSummary({
      resume: resumeProfile,
      evaluations,
      transcript,
    });

    console.log(`   - Final score returned: ${summary.overallScore}/10`);

    return res.json(summary);
  } catch (error) {
    console.error('Final summary generation failed:', error);
    return res.status(500).json({
      error: 'Failed to generate final summary',
      detail: error.message,
    });
  }
});

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Handle all routes by serving index.html (SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
