import { useState, useCallback, useEffect } from 'react';
import { loadDB, saveDB, type Database } from '../lib/storage';
import type {
  MedicalInfo,
  Condition,
  Allergy,
  Medication,
  Contact,
  Report,
  ChatMessage,
  ExtractedMedicalData,
} from '../types';

export function useMedicalData() {
  const [db, setDb] = useState<Database>(loadDB);

  useEffect(() => {
    saveDB(db);
  }, [db]);

  const updateMedicalInfo = useCallback((info: Partial<MedicalInfo>) => {
    setDb((prev) => ({ ...prev, medicalInfo: { ...prev.medicalInfo, ...info } }));
  }, []);

  const setConditions = useCallback((conditions: Condition[]) => {
    setDb((prev) => ({ ...prev, conditions }));
  }, []);

  const setAllergies = useCallback((allergies: Allergy[]) => {
    setDb((prev) => ({ ...prev, allergies }));
  }, []);

  const setMedications = useCallback((medications: Medication[]) => {
    setDb((prev) => ({ ...prev, medications }));
  }, []);

  const setContacts = useCallback((contacts: Contact[]) => {
    setDb((prev) => ({ ...prev, contacts }));
  }, []);

  const addReport = useCallback((report: Report) => {
    setDb((prev) => ({ ...prev, reports: [report, ...prev.reports] }));
  }, []);

  const updateReport = useCallback((id: string, updates: Partial<Report>) => {
    setDb((prev) => ({
      ...prev,
      reports: prev.reports.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    }));
  }, []);

  const applyExtractedData = useCallback((data: ExtractedMedicalData) => {
    setDb((prev) => {
      const updates: Partial<Database> = {};

      // Patch medicalInfo with extracted fields
      if (data.name || data.age || data.bloodGroup || data.weight || data.gender) {
        updates.medicalInfo = {
          ...prev.medicalInfo,
          ...(data.name ? { name: data.name } : {}),
          ...(data.age ? { age: data.age } : {}),
          ...(data.bloodGroup ? { bloodGroup: data.bloodGroup } : {}),
          ...(data.weight ? { weight: data.weight } : {}),
          ...(data.gender ? { gender: data.gender } : {}),
        };
      }

      // Merge conditions — skip duplicates by title
      if (data.conditions?.length) {
        const incoming: Condition[] = data.conditions.map((c) => ({
          id: Date.now() + Math.random() + '',
          title: c.title,
          subtitle: c.subtitle || 'Medical Condition',
          history: c.history || '',
          type: (['heart', 'drop', 'generic'].includes(c.type ?? '') ? c.type : 'generic') as Condition['type'],
        }));
        updates.conditions = [
          ...prev.conditions,
          ...incoming.filter(
            (nc) => !prev.conditions.some((ec) => ec.title.toLowerCase() === nc.title.toLowerCase())
          ),
        ];
      }

      // Merge allergies — skip duplicates by name
      if (data.allergies?.length) {
        const severityMap: Record<string, Allergy['severity']> = {
          SEVERE: 'SEVERE',
          MODERATE: 'MODERATE',
          MILD: 'MILD',
        };
        const incoming: Allergy[] = data.allergies.map((a) => ({
          id: Date.now() + Math.random() + '',
          name: a.name,
          severity: severityMap[a.severity?.toUpperCase()] ?? 'MODERATE',
        }));
        updates.allergies = [
          ...prev.allergies,
          ...incoming.filter(
            (na) => !prev.allergies.some((ea) => ea.name.toLowerCase() === na.name.toLowerCase())
          ),
        ];
      }

      // Merge medications — skip duplicates by name
      if (data.medications?.length) {
        const incoming: Medication[] = data.medications.map((m) => ({
          id: Date.now() + Math.random() + '',
          name: m.name,
          dose: m.dose,
          frequency: m.frequency,
        }));
        updates.medications = [
          ...prev.medications,
          ...incoming.filter(
            (nm) => !prev.medications.some((em) => em.name.toLowerCase() === nm.name.toLowerCase())
          ),
        ];
      }

      // Merge contacts — skip duplicates by phone
      if (data.contacts?.length) {
        const incoming: Contact[] = data.contacts.map((c) => ({
          id: Date.now() + Math.random() + '',
          name: c.name,
          phone: c.phone,
        }));
        updates.contacts = [
          ...prev.contacts,
          ...incoming.filter((nc) => !prev.contacts.some((ec) => ec.phone === nc.phone)),
        ];
      }

      return { ...prev, ...updates };
    });
  }, []);

  const addChatMessage = useCallback((message: ChatMessage) => {
    setDb((prev) => ({ ...prev, chatHistory: [...prev.chatHistory, message] }));
  }, []);

  const clearChatHistory = useCallback(() => {
    setDb((prev) => ({ ...prev, chatHistory: [] }));
  }, []);

  const resetAll = useCallback(() => {
    if (confirm('Reset all MediVault data? This cannot be undone.')) {
      localStorage.clear();
      window.location.reload();
    }
  }, []);

  return {
    ...db,
    updateMedicalInfo,
    setConditions,
    setAllergies,
    setMedications,
    setContacts,
    addReport,
    updateReport,
    applyExtractedData,
    addChatMessage,
    clearChatHistory,
    resetAll,
  };
}
