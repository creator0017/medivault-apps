export interface MedicalInfo {
  name: string;
  bloodGroup: string;
  age: string;
  weight: string;
  patientId: string;
  emergencyPin: string;
  gender?: string;
}

export interface Condition {
  id: string;
  title: string;
  subtitle: string;
  history: string;
  type: 'heart' | 'drop' | 'generic';
}

export interface Allergy {
  id: string;
  name: string;
  severity: 'SEVERE' | 'MODERATE' | 'MILD';
}

export interface Medication {
  id: string;
  name: string;
  dose: string;
  frequency?: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
}

export interface Report {
  id: string;
  name: string;
  date: string;
  fileType: string;
  size: string;
  status: 'analyzing' | 'done' | 'error';
  extractedData?: ExtractedMedicalData;
}

export interface ExtractedMedicalData {
  name?: string;
  age?: string;
  bloodGroup?: string;
  weight?: string;
  gender?: string;
  conditions?: Array<{ title: string; subtitle: string; history: string; type?: string }>;
  allergies?: Array<{ name: string; severity: string }>;
  medications?: Array<{ name: string; dose: string; frequency?: string }>;
  contacts?: Array<{ name: string; phone: string }>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface HealthMetric {
  id: string;
  label: string;
  value: number;
  unit: string;
  date: string;
  type: 'bp_sys' | 'bp_dia' | 'glucose' | 'weight' | 'heart_rate';
}

export type AppPage = 'dashboard' | 'emergency' | 'reports';
