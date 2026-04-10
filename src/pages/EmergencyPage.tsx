import { jsPDF } from 'jspdf';
import {
  AlertCircle,
  ArrowLeft,
  BriefcaseMedical,
  Droplets,
  FileText,
  HeartPulse,
  Lock,
  Pencil,
  Pill,
  Phone,
  Plus,
  Settings,
  ShieldCheck,
  Stethoscope,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import React, { useState } from 'react';
import type {
  Allergy,
  Condition,
  Contact,
  MedicalInfo,
  Medication,
} from '../types';

interface EmergencyPageProps {
  medicalInfo: MedicalInfo;
  conditions: Condition[];
  allergies: Allergy[];
  medications: Medication[];
  contacts: Contact[];
  onUpdateMedicalInfo: (info: Partial<MedicalInfo>) => void;
  onSetConditions: (c: Condition[]) => void;
  onSetAllergies: (a: Allergy[]) => void;
  onSetMedications: (m: Medication[]) => void;
  onSetContacts: (c: Contact[]) => void;
  onResetAll: () => void;
}

/* ─── Small reusable card ─────────────────────────────────────── */
const ConditionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  history: string;
}> = ({ icon, title, subtitle, history }) => (
  <div className="bg-white rounded-2xl p-4 flex flex-col gap-3 border-l-4 border-[#C54242] shadow-sm border-y border-r border-slate-100 transition-all hover:scale-[1.01]">
    <div className="flex items-center gap-4">
      <div className="bg-[#FEE2E2] p-2.5 rounded-xl">{icon}</div>
      <div>
        <p className="text-base font-bold text-[#1E293B]">{title}</p>
        <p className="text-xs text-[#64748B]">{subtitle}</p>
      </div>
    </div>
    {history && (
      <div className="pl-14">
        <p className="text-[11px] text-slate-500 leading-relaxed italic">
          <span className="font-black uppercase text-[9px] tracking-tighter mr-1 opacity-50">History:</span>
          {history}
        </p>
      </div>
    )}
  </div>
);

const uid = () => Date.now() + Math.random() + '';

/* ─── Main Component ──────────────────────────────────────────── */
export default function EmergencyPage({
  medicalInfo,
  conditions,
  allergies,
  medications,
  contacts,
  onUpdateMedicalInfo,
  onSetConditions,
  onSetAllergies,
  onSetMedications,
  onSetContacts,
  onResetAll,
}: EmergencyPageProps) {
  const searchParams = new URLSearchParams(window.location.search);
  const isDoctorView = !!searchParams.get('id');

  // Modal states
  const [modal, setModal] = useState<
    'none' | 'profile' | 'conditions' | 'allergies' | 'medications' | 'contacts' | 'settings'
  >('none');

  // Edit form copies
  const [editProfile, setEditProfile] = useState(medicalInfo);
  const [editConditions, setEditConditions] = useState<Condition[]>([]);
  const [editAllergies, setEditAllergies] = useState<Allergy[]>([]);
  const [editMedications, setEditMedications] = useState<Medication[]>([]);
  const [editContacts, setEditContacts] = useState<Contact[]>([]);

  // Doctor PIN gate
  const [isAuthorized, setIsAuthorized] = useState(!isDoctorView);

  function openModal(which: typeof modal) {
    setEditProfile({ ...medicalInfo });
    setEditConditions(conditions.map((c) => ({ ...c })));
    setEditAllergies(allergies.map((a) => ({ ...a })));
    setEditMedications(medications.map((m) => ({ ...m })));
    setEditContacts(contacts.map((c) => ({ ...c })));
    setModal(which);
  }

  /* ─── PDF Generation ────────────────────────────────────────── */
  const generatePDF = () => {
    const doc = new jsPDF();

    // Header
    doc.setFillColor(197, 66, 66);
    doc.rect(0, 0, 210, 42, 'F');
    doc.setFillColor(160, 30, 30);
    doc.rect(0, 0, 210, 5, 'F');

    // Cross icon
    doc.setFillColor(255, 255, 255);
    doc.circle(25, 23, 9, 'F');
    doc.setDrawColor(197, 66, 66);
    doc.setLineWidth(2);
    doc.line(20, 23, 30, 23);
    doc.line(25, 18, 25, 28);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('EMERGENCY MEDICAL RECORD', 105, 28, { align: 'center' });

    // Patient info block
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(17);
    doc.text(medicalInfo.name.toUpperCase(), 20, 56);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`PATIENT ID: ${medicalInfo.patientId}`, 190, 56, { align: 'right' });

    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    const col1 = [
      `Blood Group: ${medicalInfo.bloodGroup}`,
      `Age: ${medicalInfo.age} yrs`,
      `Weight: ${medicalInfo.weight} kg`,
    ];
    col1.forEach((t, i) => doc.text(t, 20, 66 + i * 7));
    if (medicalInfo.gender) doc.text(`Gender: ${medicalInfo.gender}`, 110, 66);
    

    let y = 92;

    const section = (title: string) => {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, y - 5, 180, 8, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(197, 66, 66);
      doc.text(title, 20, y);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'normal');
      y += 8;
    };

    // Conditions
    if (conditions.length) {
      section('MEDICAL CONDITIONS');
      conditions.forEach((c) => {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`• ${c.title}`, 22, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        if (c.subtitle) doc.text(c.subtitle, 35, y + 4);
        y += c.subtitle ? 10 : 6;
        if (c.history) {
          const lines = doc.splitTextToSize(`History: ${c.history}`, 155);
          doc.text(lines, 30, y);
          y += lines.length * 4.5 + 2;
          doc.setTextColor(30, 41, 59);
        }
      });
      y += 3;
    }

    // Allergies
    if (allergies.length) {
      section('ALLERGIES ⚠');
      allergies.forEach((a) => {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(197, 66, 66);
        doc.text(`• ${a.name}`, 22, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(`[${a.severity}]`, 80, y);
        doc.setTextColor(30, 41, 59);
        y += 7;
      });
      y += 3;
    }

    // Medications
    if (medications.length) {
      section('CURRENT MEDICATIONS');
      medications.forEach((m) => {
        doc.setFontSize(11);
        doc.text(`• ${m.name}`, 22, y);
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(`${m.dose}${m.frequency ? '  •  ' + m.frequency : ''}`, 70, y);
        doc.setTextColor(30, 41, 59);
        y += 7;
      });
      y += 3;
    }

    // Contacts
    if (contacts.length) {
      section('EMERGENCY CONTACTS');
      contacts.forEach((c) => {
        doc.setFontSize(11);
        doc.text(`• ${c.name}`, 22, y);
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(c.phone, 120, y);
        doc.setTextColor(30, 41, 59);
        y += 7;
      });
      y += 3;
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Generated by MediVault • ${new Date().toLocaleDateString()}  •  Confidential Medical Document`,
      105,
      285,
      { align: 'center' }
    );

    doc.save(`${medicalInfo.name.replace(/\s+/g, '_')}_MediVault.pdf`);
  };

  /* ─── QR Download ────────────────────────────────────────────── */
  const downloadQR = () => {
    const svg = document.querySelector('.qr-container svg') as SVGGraphicsElement;
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const link = document.createElement('a');
      link.download = 'MediVault_QR.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  /* ─── Doctor PIN Gate ─────────────────────────────────────────── */
  if (isDoctorView && !isAuthorized) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-sm w-full text-center border border-slate-100"
        >
          <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="text-[#C54242] w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black mb-2">Restricted Access</h2>
          <p className="text-sm text-slate-500 mb-8 leading-relaxed">
            Enter the 4-digit Emergency PIN to view these records.
          </p>
          <input
            type="password"
            maxLength={4}
            placeholder="••••"
            className="w-full text-center text-4xl tracking-[1rem] font-black border-2 border-slate-100 rounded-3xl p-5 mb-6 focus:border-[#C54242] focus:ring-4 focus:ring-red-50 focus:outline-none transition-all placeholder:text-slate-200"
            onChange={(e) => {
              if (e.target.value === medicalInfo.emergencyPin) setIsAuthorized(true);
            }}
          />
          <div className="flex items-center justify-center gap-2 text-[#C54242] font-bold text-[10px] uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4" /> MediVault Encrypted Session
          </div>
        </motion.div>
      </div>
    );
  }

  /* ─── Main UI ─────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm">
        {!isDoctorView ? (
          <button
            onClick={() => window.history.back()}
            className="p-1 hover:bg-slate-50 rounded-full transition-colors"
          >
            <ArrowLeft className="w-7 h-7 text-[#2E75B6]" />
          </button>
        ) : (
          <div className="w-9" />
        )}
        <h1 className="text-lg font-black tracking-tight uppercase">
          {isDoctorView ? 'Medical Profile' : 'Emergency Card'}
        </h1>
        {!isDoctorView ? (
          <button
            onClick={() => openModal('settings')}
            className="p-1 hover:bg-slate-50 rounded-full transition-colors"
          >
            <Settings className="w-7 h-7 text-[#2E75B6]" />
          </button>
        ) : (
          <div className="w-9" />
        )}
      </header>

      <main className="max-w-md mx-auto p-5 space-y-6">
        {/* ── Critical Info Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-[#C54242] rounded-[2.5rem] p-8 overflow-hidden shadow-xl shadow-red-100"
        >
          <div className="relative z-10 text-white">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black tracking-widest opacity-80 uppercase">Critical Information</p>
                <p className="text-[10px] font-bold opacity-40 mt-0.5 tracking-tighter">
                  ID: {medicalInfo.patientId} • PIN: {medicalInfo.emergencyPin}
                </p>
              </div>
              {!isDoctorView && (
                <button
                  onClick={() => openModal('profile')}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
            <h2 className="text-2xl font-black mt-4 mb-6 leading-tight uppercase">Emergency Medical Info</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] font-bold opacity-60 uppercase">Full Name</p>
                <p className="text-lg font-black mt-1 uppercase">{medicalInfo.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold opacity-60 uppercase">Blood Group</p>
                <div className="inline-block bg-white/20 px-4 py-1 rounded-xl mt-1">
                  <p className="text-lg font-black">{medicalInfo.bloodGroup || '—'}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold opacity-60 uppercase">Age</p>
                <p className="text-lg font-black mt-1">{medicalInfo.age ? medicalInfo.age + ' Years' : '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold opacity-60 uppercase">Weight</p>
                <p className="text-lg font-black mt-1">{medicalInfo.weight ? medicalInfo.weight + ' kg' : '—'}</p>
              </div>
              {medicalInfo.gender && (
                <div>
                  <p className="text-[10px] font-bold opacity-60 uppercase">Gender</p>
                  <p className="text-lg font-black mt-1">{medicalInfo.gender}</p>
                </div>
              )}
            </div>
          </div>
          <BriefcaseMedical className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 rotate-12" />
        </motion.div>

        {/* ── Medical Conditions ── */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[12px] font-black text-[#64748B] tracking-widest uppercase">
              Medical Conditions ⚠️
            </h3>
            {!isDoctorView && (
              <button onClick={() => openModal('conditions')}>
                <Pencil className="w-4 h-4 text-[#64748B]" />
              </button>
            )}
          </div>
          {conditions.length > 0 ? (
            <div className="space-y-3">
              {conditions.map((c) => (
                <ConditionCard
                  key={c.id}
                  icon={
                    c.type === 'heart' ? (
                      <HeartPulse className="w-6 h-6 text-[#D14343]" />
                    ) : c.type === 'drop' ? (
                      <Droplets className="w-6 h-6 text-[#D14343]" />
                    ) : (
                      <Stethoscope className="w-6 h-6 text-[#D14343]" />
                    )
                  }
                  title={c.title}
                  subtitle={c.subtitle}
                  history={c.history}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">No conditions added yet</p>
          )}
        </section>

        {/* ── Allergies ── */}
        <section className="bg-[#FEE2E2] rounded-2xl p-6 border border-red-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[#D14343]" />
              <h3 className="text-[12px] font-black text-[#1E293B] tracking-widest uppercase">Allergies</h3>
            </div>
            {!isDoctorView && (
              <button onClick={() => openModal('allergies')}>
                <Pencil className="w-4 h-4 text-[#D14343]" />
              </button>
            )}
          </div>
          {allergies.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {allergies.map((a) => (
                <span
                  key={a.id}
                  className={`text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm ${
                    a.severity === 'SEVERE'
                      ? 'bg-[#C54242]'
                      : a.severity === 'MODERATE'
                      ? 'bg-orange-400'
                      : 'bg-yellow-500'
                  }`}
                >
                  {a.name} — {a.severity}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-red-300 text-center py-2">No allergies recorded</p>
          )}
        </section>

        {/* ── Medications ── */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 pb-3">
            <div className="flex items-center gap-2">
              <Pill className="w-5 h-5 text-[#2E75B6]" />
              <h3 className="text-[12px] font-black text-[#1E293B] tracking-widest uppercase">Medications</h3>
            </div>
            {!isDoctorView && (
              <button onClick={() => openModal('medications')}>
                <Pencil className="w-4 h-4 text-[#64748B]" />
              </button>
            )}
          </div>
          {medications.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {medications.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Pill className="w-4 h-4 text-[#2E75B6]" />
                    <div>
                      <p className="font-bold text-[#1E293B] text-sm">{m.name}</p>
                      {m.frequency && <p className="text-[10px] text-[#64748B]">{m.frequency}</p>}
                    </div>
                  </div>
                  <span className="text-sm font-bold text-[#64748B] bg-slate-50 px-3 py-1 rounded-xl">
                    {m.dose}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-6">No medications added yet</p>
          )}
        </section>

        {/* ── Emergency Contacts ── */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 pb-3">
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-[#16A34A]" />
              <h3 className="text-[12px] font-black text-[#1E293B] tracking-widest uppercase">Emergency Contacts</h3>
            </div>
            {!isDoctorView && (
              <button onClick={() => openModal('contacts')}>
                <Pencil className="w-4 h-4 text-[#64748B]" />
              </button>
            )}
          </div>
          {contacts.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {contacts.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-50 p-2 rounded-xl">
                      <User className="w-4 h-4 text-[#16A34A]" />
                    </div>
                    <p className="font-bold text-[#1E293B] text-sm">{c.name}</p>
                  </div>
                  <a
                    href={`tel:${c.phone}`}
                    className="flex items-center gap-1 bg-green-50 text-green-700 text-xs font-bold px-3 py-1.5 rounded-xl"
                  >
                    <Phone className="w-3 h-3" /> {c.phone}
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-6">No contacts added yet</p>
          )}
        </section>

        {/* ── QR Code ── */}
        {!isDoctorView && (
          <section className="bg-white rounded-[2rem] p-8 flex flex-col items-center border border-slate-100 shadow-sm text-center">
            <h3 className="text-[12px] font-black mb-6 tracking-widest uppercase opacity-60">
              Scan for Full Medical History
            </h3>
            <div className="p-6 bg-[#F8FAFC] rounded-3xl border-2 border-dashed border-[#CBD5E1] qr-container">
              <QRCodeSVG
                value={window.location.origin + '?id=' + medicalInfo.patientId}
                size={150}
                level="M"
              />
            </div>
            <button
              onClick={downloadQR}
              className="mt-6 text-[10px] font-black text-[#2E75B6] uppercase tracking-widest hover:underline"
            >
              Download QR Code
            </button>
            <p className="text-[10px] text-[#94A3B8] mt-4 font-semibold leading-relaxed">
              Authorized medical personnel only.
              <br />
              Secured by MediVault encryption.
            </p>
          </section>
        )}

        {/* ── PDF Button ── */}
        <button
          onClick={generatePDF}
          className="w-full bg-[#1E293B] text-white py-5 rounded-2xl flex items-center justify-center gap-3 font-black text-[12px] uppercase tracking-widest shadow-lg active:scale-95 transition-transform"
        >
          <FileText className={`w-6 h-6 ${isDoctorView ? 'text-red-400' : 'text-white'}`} />
          <span>Download Medical Record PDF</span>
        </button>
      </main>

      {/* ════════════════ MODALS ════════════════ */}
      <AnimatePresence>
        {modal !== 'none' && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center p-4">
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModal('none')}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* ── Edit Profile ── */}
            {modal === 'profile' && (
              <motion.div
                key="profile-modal"
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="relative w-full max-w-md bg-white rounded-t-[2.5rem] p-8 shadow-2xl max-h-[85vh] overflow-y-auto"
              >
                <button onClick={() => setModal('none')} className="absolute top-4 right-4 p-2 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
                <h3 className="text-xl font-black mb-6">Edit Profile</h3>
                {(
                  [
                    { label: 'Full Name', key: 'name', type: 'text' },
                    { label: 'Blood Group (e.g. O+)', key: 'bloodGroup', type: 'text' },
                    { label: 'Age', key: 'age', type: 'number' },
                    { label: 'Weight (kg)', key: 'weight', type: 'number' },
                    { label: 'Gender', key: 'gender', type: 'text' },
                    { label: 'Emergency PIN (4 digits)', key: 'emergencyPin', type: 'password', maxLen: 4 },
                  ] as Array<{ label: string; key: keyof MedicalInfo; type: string; maxLen?: number }>
                ).map((f) => (
                  <div key={f.key} className="mb-4">
                    <label className="text-[10px] font-black text-[#64748B] uppercase tracking-widest block mb-1">
                      {f.label}
                    </label>
                    <input
                      type={f.type}
                      maxLength={f.maxLen}
                      value={(editProfile[f.key] as string) || ''}
                      onChange={(e) => setEditProfile({ ...editProfile, [f.key]: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 transition-all"
                    />
                  </div>
                ))}
                <button
                  onClick={() => { onUpdateMedicalInfo(editProfile); setModal('none'); }}
                  className="w-full bg-[#C54242] text-white font-black py-4 rounded-2xl shadow-lg mt-2"
                >
                  Save Changes
                </button>
              </motion.div>
            )}

            {/* ── Edit Conditions ── */}
            {modal === 'conditions' && (
              <motion.div
                key="cond-modal"
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="relative w-full max-w-md bg-white rounded-t-[2.5rem] p-8 shadow-2xl max-h-[85vh] overflow-y-auto"
              >
                <button onClick={() => setModal('none')} className="absolute top-4 right-4 p-2 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
                <h3 className="text-xl font-black mb-6">Edit Conditions</h3>
                <div className="space-y-4 mb-4">
                  {editConditions.map((c, i) => (
                    <div key={c.id} className="bg-slate-50 rounded-2xl p-4 relative">
                      <button
                        onClick={() => setEditConditions(editConditions.filter((_, j) => j !== i))}
                        className="absolute top-3 right-3 text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <input
                        placeholder="Condition name"
                        value={c.title}
                        onChange={(e) =>
                          setEditConditions(editConditions.map((x, j) => j === i ? { ...x, title: e.target.value } : x))
                        }
                        className="w-full bg-white border border-slate-200 p-3 rounded-xl font-bold text-sm outline-none mb-2 focus:ring-2 focus:ring-red-100"
                      />
                      <input
                        placeholder="Subtitle (e.g. Chronic Condition)"
                        value={c.subtitle}
                        onChange={(e) =>
                          setEditConditions(editConditions.map((x, j) => j === i ? { ...x, subtitle: e.target.value } : x))
                        }
                        className="w-full bg-white border border-slate-200 p-3 rounded-xl text-sm outline-none mb-2 focus:ring-2 focus:ring-red-100"
                      />
                      <textarea
                        placeholder="History (diagnosis details...)"
                        value={c.history}
                        rows={2}
                        onChange={(e) =>
                          setEditConditions(editConditions.map((x, j) => j === i ? { ...x, history: e.target.value } : x))
                        }
                        className="w-full bg-white border border-slate-200 p-3 rounded-xl text-sm outline-none mb-2 focus:ring-2 focus:ring-red-100 resize-none"
                      />
                      <select
                        value={c.type}
                        onChange={(e) =>
                          setEditConditions(editConditions.map((x, j) => j === i ? { ...x, type: e.target.value as Condition['type'] } : x))
                        }
                        className="w-full bg-white border border-slate-200 p-3 rounded-xl text-sm outline-none"
                      >
                        <option value="heart">Heart / Cardiovascular</option>
                        <option value="drop">Diabetes / Blood</option>
                        <option value="generic">Other</option>
                      </select>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() =>
                    setEditConditions([...editConditions, { id: uid(), title: '', subtitle: '', history: '', type: 'generic' }])
                  }
                  className="w-full border-2 border-dashed border-slate-200 py-3 rounded-2xl text-sm font-bold text-slate-400 flex items-center justify-center gap-2 mb-4 hover:border-red-300 hover:text-[#C54242] transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Condition
                </button>
                <button
                  onClick={() => { onSetConditions(editConditions.filter((c) => c.title.trim())); setModal('none'); }}
                  className="w-full bg-[#C54242] text-white font-black py-4 rounded-2xl shadow-lg"
                >
                  Save Conditions
                </button>
              </motion.div>
            )}

            {/* ── Edit Allergies ── */}
            {modal === 'allergies' && (
              <motion.div
                key="allergy-modal"
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="relative w-full max-w-md bg-white rounded-t-[2.5rem] p-8 shadow-2xl max-h-[85vh] overflow-y-auto"
              >
                <button onClick={() => setModal('none')} className="absolute top-4 right-4 p-2 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
                <h3 className="text-xl font-black mb-6">Edit Allergies</h3>
                <div className="space-y-3 mb-4">
                  {editAllergies.map((a, i) => (
                    <div key={a.id} className="flex gap-2 items-center">
                      <input
                        placeholder="Allergen name"
                        value={a.name}
                        onChange={(e) =>
                          setEditAllergies(editAllergies.map((x, j) => j === i ? { ...x, name: e.target.value } : x))
                        }
                        className="flex-1 bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-red-100"
                      />
                      <select
                        value={a.severity}
                        onChange={(e) =>
                          setEditAllergies(editAllergies.map((x, j) => j === i ? { ...x, severity: e.target.value as Allergy['severity'] } : x))
                        }
                        className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none"
                      >
                        <option value="SEVERE">SEVERE</option>
                        <option value="MODERATE">MODERATE</option>
                        <option value="MILD">MILD</option>
                      </select>
                      <button
                        onClick={() => setEditAllergies(editAllergies.filter((_, j) => j !== i))}
                        className="text-red-400 p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() =>
                    setEditAllergies([...editAllergies, { id: uid(), name: '', severity: 'MODERATE' }])
                  }
                  className="w-full border-2 border-dashed border-slate-200 py-3 rounded-2xl text-sm font-bold text-slate-400 flex items-center justify-center gap-2 mb-4 hover:border-red-300 hover:text-[#C54242] transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Allergy
                </button>
                <button
                  onClick={() => { onSetAllergies(editAllergies.filter((a) => a.name.trim())); setModal('none'); }}
                  className="w-full bg-[#C54242] text-white font-black py-4 rounded-2xl shadow-lg"
                >
                  Save Allergies
                </button>
              </motion.div>
            )}

            {/* ── Edit Medications ── */}
            {modal === 'medications' && (
              <motion.div
                key="med-modal"
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="relative w-full max-w-md bg-white rounded-t-[2.5rem] p-8 shadow-2xl max-h-[85vh] overflow-y-auto"
              >
                <button onClick={() => setModal('none')} className="absolute top-4 right-4 p-2 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
                <h3 className="text-xl font-black mb-6">Edit Medications</h3>
                <div className="space-y-3 mb-4">
                  {editMedications.map((m, i) => (
                    <div key={m.id} className="bg-slate-50 rounded-2xl p-4 relative">
                      <button
                        onClick={() => setEditMedications(editMedications.filter((_, j) => j !== i))}
                        className="absolute top-3 right-3 text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <input
                        placeholder="Medicine name"
                        value={m.name}
                        onChange={(e) =>
                          setEditMedications(editMedications.map((x, j) => j === i ? { ...x, name: e.target.value } : x))
                        }
                        className="w-full bg-white border border-slate-200 p-3 rounded-xl font-bold text-sm outline-none mb-2 focus:ring-2 focus:ring-blue-100"
                      />
                      <div className="flex gap-2">
                        <input
                          placeholder="Dose (e.g. 500mg)"
                          value={m.dose}
                          onChange={(e) =>
                            setEditMedications(editMedications.map((x, j) => j === i ? { ...x, dose: e.target.value } : x))
                          }
                          className="flex-1 bg-white border border-slate-200 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100"
                        />
                        <input
                          placeholder="Frequency"
                          value={m.frequency || ''}
                          onChange={(e) =>
                            setEditMedications(editMedications.map((x, j) => j === i ? { ...x, frequency: e.target.value } : x))
                          }
                          className="flex-1 bg-white border border-slate-200 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() =>
                    setEditMedications([...editMedications, { id: uid(), name: '', dose: '', frequency: '' }])
                  }
                  className="w-full border-2 border-dashed border-slate-200 py-3 rounded-2xl text-sm font-bold text-slate-400 flex items-center justify-center gap-2 mb-4 hover:border-blue-300 hover:text-[#2E75B6] transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Medication
                </button>
                <button
                  onClick={() => { onSetMedications(editMedications.filter((m) => m.name.trim())); setModal('none'); }}
                  className="w-full bg-[#2E75B6] text-white font-black py-4 rounded-2xl shadow-lg"
                >
                  Save Medications
                </button>
              </motion.div>
            )}

            {/* ── Edit Contacts ── */}
            {modal === 'contacts' && (
              <motion.div
                key="contact-modal"
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="relative w-full max-w-md bg-white rounded-t-[2.5rem] p-8 shadow-2xl max-h-[85vh] overflow-y-auto"
              >
                <button onClick={() => setModal('none')} className="absolute top-4 right-4 p-2 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
                <h3 className="text-xl font-black mb-6">Edit Contacts</h3>
                <div className="space-y-3 mb-4">
                  {editContacts.map((c, i) => (
                    <div key={c.id} className="flex gap-2 items-center">
                      <input
                        placeholder="Name & relation (e.g. Rajesh (Son))"
                        value={c.name}
                        onChange={(e) =>
                          setEditContacts(editContacts.map((x, j) => j === i ? { ...x, name: e.target.value } : x))
                        }
                        className="flex-1 bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-green-100"
                      />
                      <input
                        placeholder="Phone"
                        value={c.phone}
                        onChange={(e) =>
                          setEditContacts(editContacts.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))
                        }
                        className="w-32 bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-100"
                      />
                      <button
                        onClick={() => setEditContacts(editContacts.filter((_, j) => j !== i))}
                        className="text-red-400 p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setEditContacts([...editContacts, { id: uid(), name: '', phone: '' }])}
                  className="w-full border-2 border-dashed border-slate-200 py-3 rounded-2xl text-sm font-bold text-slate-400 flex items-center justify-center gap-2 mb-4 hover:border-green-300 hover:text-green-600 transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Contact
                </button>
                <button
                  onClick={() => { onSetContacts(editContacts.filter((c) => c.name.trim() && c.phone.trim())); setModal('none'); }}
                  className="w-full bg-[#16A34A] text-white font-black py-4 rounded-2xl shadow-lg"
                >
                  Save Contacts
                </button>
              </motion.div>
            )}

            {/* ── Settings ── */}
            {modal === 'settings' && (
              <motion.div
                key="settings-modal"
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="relative w-full max-w-md bg-white rounded-t-[2.5rem] p-8 shadow-2xl"
              >
                <button onClick={() => setModal('none')} className="absolute top-4 right-4 p-2 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
                <h3 className="text-xl font-black mb-6">Settings</h3>
                <div className="space-y-3">
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-1">Patient ID</p>
                    <p className="font-black text-[#1E293B]">{medicalInfo.patientId}</p>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-1">Emergency PIN</p>
                    <p className="font-black text-[#1E293B] tracking-widest">{medicalInfo.emergencyPin}</p>
                  </div>
                </div>
                <button
                  onClick={onResetAll}
                  className="w-full mt-6 border-2 border-red-200 text-[#C54242] font-black py-4 rounded-2xl hover:bg-red-50 transition-colors"
                >
                  Reset All Data
                </button>
              </motion.div>
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
