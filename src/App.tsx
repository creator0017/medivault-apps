import { useState } from 'react';
import Navigation from './components/Navigation';
import { useMedicalData } from './hooks/useMedicalData';
import DashboardPage from './pages/DashboardPage';
import EmergencyPage from './pages/EmergencyPage';
import ReportsPage from './pages/ReportsPage';
import type { AppPage } from './types';

export default function App() {
  const [page, setPage] = useState<AppPage>('dashboard');
  const db = useMedicalData();

  // Doctor-view detection (when scanned via QR code ?id=...)
  const isDoctorView = !!new URLSearchParams(window.location.search).get('id');

  // If scanned via QR, show only the emergency card
  if (isDoctorView) {
    return (
      <EmergencyPage
        medicalInfo={db.medicalInfo}
        conditions={db.conditions}
        allergies={db.allergies}
        medications={db.medications}
        contacts={db.contacts}
        onUpdateMedicalInfo={db.updateMedicalInfo}
        onSetConditions={db.setConditions}
        onSetAllergies={db.setAllergies}
        onSetMedications={db.setMedications}
        onSetContacts={db.setContacts}
        onResetAll={db.resetAll}
      />
    );
  }

  const pendingReports = db.reports.filter((r) => r.status === 'analyzing').length;

  return (
    <div className="font-sans">
      {/* Page Content */}
      {page === 'dashboard' && (
        <DashboardPage
          medicalInfo={db.medicalInfo}
          conditions={db.conditions}
          allergies={db.allergies}
          medications={db.medications}
          contacts={db.contacts}
          reports={db.reports}
          healthMetrics={db.healthMetrics}
          chatHistory={db.chatHistory}
          onAddChatMessage={db.addChatMessage}
          onClearChat={db.clearChatHistory}
        />
      )}

      {page === 'emergency' && (
        <EmergencyPage
          medicalInfo={db.medicalInfo}
          conditions={db.conditions}
          allergies={db.allergies}
          medications={db.medications}
          contacts={db.contacts}
          onUpdateMedicalInfo={db.updateMedicalInfo}
          onSetConditions={db.setConditions}
          onSetAllergies={db.setAllergies}
          onSetMedications={db.setMedications}
          onSetContacts={db.setContacts}
          onResetAll={db.resetAll}
        />
      )}

      {page === 'reports' && (
        <ReportsPage
          reports={db.reports}
          onAddReport={db.addReport}
          onUpdateReport={db.updateReport}
          onApplyData={db.applyExtractedData}
        />
      )}

      {/* Bottom Navigation */}
      <Navigation
        currentPage={page}
        onNavigate={setPage}
        reportsBadge={pendingReports}
      />
    </div>
  );
}
