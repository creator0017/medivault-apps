import type {
  MedicalInfo,
  Condition,
  Allergy,
  Medication,
  Contact,
  Report,
  ChatMessage,
  HealthMetric,
} from '../types';

const DB_KEY = 'medivault_db_v3';

export interface Database {
  medicalInfo: MedicalInfo;
  conditions: Condition[];
  allergies: Allergy[];
  medications: Medication[];
  contacts: Contact[];
  reports: Report[];
  chatHistory: ChatMessage[];
  healthMetrics: HealthMetric[];
  lastUpdated: number;
}

const DEFAULT_METRICS: HealthMetric[] = [
  { id: 'm1', label: 'BP Systolic', value: 132, unit: 'mmHg', date: '2026-02-10', type: 'bp_sys' },
  { id: 'm2', label: 'BP Systolic', value: 128, unit: 'mmHg', date: '2026-02-24', type: 'bp_sys' },
  { id: 'm3', label: 'BP Systolic', value: 126, unit: 'mmHg', date: '2026-03-10', type: 'bp_sys' },
  { id: 'm4', label: 'BP Systolic', value: 122, unit: 'mmHg', date: '2026-03-24', type: 'bp_sys' },
  { id: 'm5', label: 'BP Systolic', value: 119, unit: 'mmHg', date: '2026-04-07', type: 'bp_sys' },
  { id: 'm6', label: 'Glucose', value: 152, unit: 'mg/dL', date: '2026-02-10', type: 'glucose' },
  { id: 'm7', label: 'Glucose', value: 144, unit: 'mg/dL', date: '2026-02-24', type: 'glucose' },
  { id: 'm8', label: 'Glucose', value: 138, unit: 'mg/dL', date: '2026-03-10', type: 'glucose' },
  { id: 'm9', label: 'Glucose', value: 131, unit: 'mg/dL', date: '2026-03-24', type: 'glucose' },
  { id: 'm10', label: 'Glucose', value: 125, unit: 'mg/dL', date: '2026-04-07', type: 'glucose' },
];

const DEFAULT_DB: Database = {
  medicalInfo: {
    name: 'Ramesh Kumar',
    bloodGroup: 'O+',
    age: '55',
    weight: '96',
    patientId: 'MV-' + Math.floor(1000 + Math.random() * 9000),
    emergencyPin: Math.floor(1000 + Math.random() * 9000).toString(),
    gender: 'Male',
  },
  conditions: [
    { id: 'c1', title: 'Hypertension', subtitle: 'Chronic Condition', history: 'Diagnosed in 2015, managed with daily medication.', type: 'heart' },
    { id: 'c2', title: 'Type 2 Diabetes', subtitle: 'Insulin Dependent', history: 'Diagnosed in 2018, requires regular monitoring.', type: 'drop' },
  ],
  allergies: [
    { id: 'a1', name: 'Penicillin', severity: 'SEVERE' },
    { id: 'a2', name: 'Aspirin', severity: 'MODERATE' },
  ],
  medications: [
    { id: 'med1', name: 'Metformin', dose: '500mg', frequency: 'Twice daily' },
    { id: 'med2', name: 'Glimepiride', dose: '1mg', frequency: 'Once daily' },
    { id: 'med3', name: 'Amlodipine', dose: '5mg', frequency: 'Once daily' },
  ],
  contacts: [
    { id: 'con1', name: 'Rajesh Kumar (Son)', phone: '9876543210' },
  ],
  reports: [],
  chatHistory: [],
  healthMetrics: DEFAULT_METRICS,
  lastUpdated: Date.now(),
};

export function loadDB(): Database {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Database>;
      return {
        ...DEFAULT_DB,
        ...parsed,
        medicalInfo: { ...DEFAULT_DB.medicalInfo, ...(parsed.medicalInfo || {}) },
        healthMetrics:
          parsed.healthMetrics && parsed.healthMetrics.length > 0
            ? parsed.healthMetrics
            : DEFAULT_METRICS,
      };
    }
  } catch (e) {
    console.error('MediVault: Failed to load DB', e);
  }
  return { ...DEFAULT_DB, medicalInfo: { ...DEFAULT_DB.medicalInfo } };
}

export function saveDB(db: Database): void {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify({ ...db, lastUpdated: Date.now() }));
  } catch (e) {
    console.error('MediVault: Failed to save DB', e);
  }
}

export function resetDB(): void {
  localStorage.removeItem(DB_KEY);
}
