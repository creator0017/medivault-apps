import type { ChatMessage } from '../types';
import Groq from 'groq-sdk';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.warn('GROQ_API_KEY is not set in environment variables. Groq AI will not work.');
}

const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

export async function sendChatMessage(
  history: ChatMessage[],
  userMessage: string,
  medicalContext?: string
): Promise<string> {
  if (!groq) {
    throw new Error('Groq API key not configured. Set GROQ_API_KEY in your environment variables.');
  }

  const systemPrompt = `You are MediBot, a compassionate and knowledgeable AI health assistant integrated into MediVault, a personal medical records app.${
    medicalContext
      ? `\n\nPatient medical context: ${medicalContext}`
      : ''
  }

Your role:
- Help patients understand their medical conditions, test results, and medications
- Answer general health and wellness questions clearly
- Explain medical terminology in simple language
- Always recommend consulting a qualified doctor for diagnosis or treatment decisions
- Be warm, empathetic, and concise (2-3 paragraphs max per response)
- Never provide specific dosage recommendations or diagnose conditions`;

  // Convert history to Groq message format
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.slice(-12).map(msg => ({
      role: (msg.role === 'user' ? 'user' : 'assistant') as const,
      content: msg.text,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 1024,
    });

    return chatCompletion.choices[0]?.message?.content || "I couldn't process your request. Please try again.";
  } catch (error) {
    console.error('Groq API error:', error);
    throw new Error(`Groq API error: ${error instanceof Error ? error.message : String(error)}`);
  }
}