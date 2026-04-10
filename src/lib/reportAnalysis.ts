import type { ExtractedMedicalData } from '../types';

// Vision feature is currently disabled. To enable lab report analysis,
// implement a vision API (e.g., Google Cloud Vision, Azure Computer Vision,
// or a local OCR library like Tesseract.js).

export async function analyzeReport(file: File): Promise<ExtractedMedicalData> {
  // Return mock data for demonstration
  console.log('Vision analysis disabled - returning mock data');
  
  const mockData: ExtractedMedicalData = {
    name: 'Demo Patient',
    age: '45',
    bloodGroup: 'O+',
    weight: '75',
    gender: 'Male',
    conditions: [
      { title: 'Type 2 Diabetes', subtitle: 'HbA1c: 7.2%', history: 'Diagnosed 2023' },
      { title: 'High Cholesterol', subtitle: 'Total: 240 mg/dL', history: 'Borderline high' },
    ],
    allergies: [
      { name: 'Penicillin', severity: 'SEVERE' },
    ],
    medications: [
      { name: 'Metformin', dose: '500mg', frequency: 'Twice daily' },
      { name: 'Atorvastatin', dose: '20mg', frequency: 'Once daily' },
    ],
    contacts: [
      { name: 'Dr. Sharma (General Physician)', phone: '+91 9876543210' },
    ],
  };

  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return mockData;
}

// Note: Chat functionality has been moved to groq.ts
// Use import { sendChatMessage } from '../lib/groq' instead