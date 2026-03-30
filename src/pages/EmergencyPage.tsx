/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from "jspdf";
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
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import React, { useState } from "react";

interface Condition {
  id: string;
  title: string;
  subtitle: string;
  history: string;
  type: "heart" | "drop" | "generic";
}

const STORAGE_KEY = "emergency_card_data";

// Helper to generate a unique random PIN
const generateRandomPin = () =>
  Math.floor(1000 + Math.random() * 9000).toString();

export default function App() {
  // --- EMERGENCY LOGIC: DETECT DOCTOR VS USER ---
  const searchParams = new URLSearchParams(window.location.search);
  const patientIdFromUrl = searchParams.get("id");
  const isDoctorView = !!patientIdFromUrl;

  // UI States
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingConditions, setIsEditingConditions] = useState(false);
  const [isEditingAllergies, setIsEditingAllergies] = useState(false);
  const [isEditingMedications, setIsEditingMedications] = useState(false);
  const [isEditingContacts, setIsEditingContacts] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Load initial data from localStorage or use defaults
  const getInitialData = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved data", e);
      }
    }
    return {
      medicalInfo: {
        name: "Ramesh Kumar",
        bloodGroup: "O+",
        age: "55",
        weight: "96",
        patientId: "MV-9921",
        emergencyPin: "1234", // Default PIN
      },
      conditions: [
        {
          id: "1",
          title: "Hypertension",
          subtitle: "Chronic Condition",
          history: "Diagnosed in 2015, managed with daily medication.",
          type: "heart",
        },
        {
          id: "2",
          title: "Type 2 Diabetes",
          subtitle: "Insulin Dependent",
          history: "Diagnosed in 2018, requires regular monitoring.",
          type: "drop",
        },
      ],
      allergies: [
        { id: "1", name: "Penicillin", severity: "SEVERE" },
        { id: "2", name: "Aspirin", severity: "MODERATE" },
      ],
      medications: [
        { id: "1", name: "Metformin", dose: "500mg" },
        { id: "2", name: "Glimepiride", dose: "1mg" },
        { id: "3", name: "Amlodipine", dose: "5mg" },
      ],
      contacts: [{ id: "1", name: "Rajesh (Son)", phone: "9876543210" }],
    };
  };

  const initialData = getInitialData();

  const [medicalInfo, setMedicalInfo] = useState(initialData.medicalInfo);
  const [conditions, setConditions] = useState<Condition[]>(
    initialData.conditions,
  );
  const [allergies, setAllergies] = useState(initialData.allergies);
  const [medications, setMedications] = useState(initialData.medications);
  const [contacts, setContacts] = useState(initialData.contacts);

  const [editForm, setEditForm] = useState(medicalInfo);
  const [editConditionsForm, setEditConditionsForm] = useState<Condition[]>([]);
  const [editAllergiesForm, setEditAllergiesForm] = useState(allergies);
  const [editMedicationsForm, setEditMedicationsForm] = useState(medications);
  const [editContactsForm, setEditContactsForm] = useState(contacts);

  // Security State
  const [isAuthorized, setIsAuthorized] = useState(!isDoctorView);
  const CORRECT_PIN = medicalInfo.emergencyPin;

  // Save to localStorage whenever data changes
  React.useEffect(() => {
    const data = { medicalInfo, conditions, allergies, medications, contacts };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [medicalInfo, conditions, allergies, medications, contacts]);

  // PIN GATE UI
  if (isDoctorView && !isAuthorized) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 font-sans text-[#1E293B]">
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
            Please enter the 4-digit Emergency PIN provided by the patient to
            view these records.
          </p>
          <input
            type="password"
            maxLength={4}
            placeholder="••••"
            className="w-full text-center text-4xl tracking-[1rem] font-black border-2 border-slate-100 rounded-3xl p-5 mb-6 focus:border-[#C54242] focus:ring-4 focus:ring-red-50 focus:outline-none transition-all placeholder:text-slate-200"
            onChange={(e) => {
              if (e.target.value === CORRECT_PIN) setIsAuthorized(true);
            }}
          />
          <div className="flex items-center justify-center gap-2 text-[#C54242] font-bold text-[10px] uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4" /> MediVault Encrypted Session
          </div>
        </motion.div>
      </div>
    );
  }

  const makeCall = (phoneNumber: string) => {
    window.location.href = `tel:${phoneNumber}`;
  };

  const handleSave = () => {
    setMedicalInfo(editForm);
    setIsEditing(false);
  };

  const handleResetData = () => {
    if (confirm("Reset all data?")) {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    }
  };

  const downloadQR = () => {
    const svg = document.querySelector(
      ".qr-container svg",
    ) as SVGGraphicsElement;
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = "MediVault_QR.png";
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const generatePDF = async () => {
    const doc = new jsPDF();
    doc.setFillColor(209, 67, 67);
    doc.rect(0, 0, 210, 40, "F"); // Header Red
    doc.setFillColor(150, 30, 30);
    doc.rect(0, 0, 210, 5, "F"); // Top line
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("EMERGENCY MEDICAL RECORD", 105, 25, { align: "center" });

    // Badge Icon Red cross
    doc.setFillColor(255, 255, 255);
    doc.circle(25, 22, 8, "F");
    doc.setDrawColor(209, 67, 67);
    doc.setLineWidth(1.5);
    doc.line(21, 22, 29, 22);
    doc.line(25, 18, 25, 26);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(18);
    doc.text(medicalInfo.name.toUpperCase(), 20, 55);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`PATIENT ID: ${medicalInfo.patientId}`, 190, 55, {
      align: "right",
    });

    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text(`Blood Group: ${medicalInfo.bloodGroup}`, 20, 65);
    doc.text(`Age: ${medicalInfo.age} Years`, 20, 72);
    doc.text(`Weight: ${medicalInfo.weight}kg`, 20, 79);
    doc.text(`Emergency PIN: ${medicalInfo.emergencyPin}`, 20, 86);

    doc.setFont("helvetica", "bold");
    doc.text("MEDICAL CONDITIONS", 20, 100);
    doc.setFont("helvetica", "normal");
    let y = 110;
    conditions.forEach((c) => {
      doc.text(`• ${c.title}: ${c.subtitle}`, 25, y);
      y += 6;
      if (c.history) {
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        const splitH = doc.splitTextToSize(`History: ${c.history}`, 160);
        doc.text(splitH, 30, y);
        y += splitH.length * 5 + 3;
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
      } else {
        y += 2;
      }
    });

    doc.save(`${medicalInfo.name}_Record.pdf`);
  };

  const updateCondition = (
    id: string,
    field: keyof Condition,
    value: string,
  ) => {
    setEditConditionsForm(
      editConditionsForm.map((c) =>
        c.id === id ? { ...c, [field]: value } : c,
      ),
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans pb-20">
      {/* --- HEADER --- */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm">
        {!isDoctorView ? (
          <button
            onClick={() => window.history.back()}
            className="p-1 hover:bg-slate-50 rounded-full transition-colors"
          >
            <ArrowLeft className="w-7 h-7 text-[#2E75B6]" />
          </button>
        ) : (
          <button
            onClick={() => (window.location.href = "/")}
            className="p-1 hover:bg-slate-50 rounded-full transition-colors"
          >
            <X className="w-7 h-7 text-slate-400" />
          </button>
        )}
        <h1 className="text-lg font-black tracking-tight uppercase">
          {isDoctorView ? "Medical Profile" : "Emergency Card"}
        </h1>
        {!isDoctorView ? (
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-1 hover:bg-slate-50 rounded-full transition-colors"
          >
            <Settings className="w-7 h-7 text-[#2E75B6]" />
          </button>
        ) : (
          <div className="w-9" />
        )}
      </header>

      <main className="max-w-md mx-auto p-5 space-y-6">
        {/* --- CRITICAL INFO CARD --- */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-[#C54242] rounded-[2.5rem] p-8 overflow-hidden shadow-xl shadow-red-100"
        >
          <div className="relative z-10 text-white">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black tracking-widest opacity-80 uppercase">
                  Critical Information
                </p>
                <p className="text-[10px] font-bold opacity-40 mt-0.5 tracking-tighter">
                  ID: {medicalInfo.patientId} • PIN: {medicalInfo.emergencyPin}
                </p>
              </div>
              {!isDoctorView && (
                <button
                  onClick={() => {
                    setEditForm(medicalInfo);
                    setIsEditing(true);
                  }}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
            <h2 className="text-2xl font-black mt-4 mb-6 leading-tight uppercase">
              Emergency Medical Info
            </h2>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] font-bold opacity-60 uppercase">
                  Full Name
                </p>
                <p className="text-lg font-black mt-1 uppercase">
                  {medicalInfo.name}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold opacity-60 uppercase">
                  Blood Group
                </p>
                <div className="inline-block bg-white/20 px-4 py-1 rounded-xl mt-1">
                  <p className="text-lg font-black">{medicalInfo.bloodGroup}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold opacity-60 uppercase">
                  Age
                </p>
                <p className="text-lg font-black mt-1">
                  {medicalInfo.age} Years
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold opacity-60 uppercase">
                  Weight
                </p>
                <p className="text-lg font-black mt-1">
                  {medicalInfo.weight} kg
                </p>
              </div>
            </div>
          </div>
          <BriefcaseMedical className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 rotate-12" />
        </motion.div>

        {/* --- MEDICAL CONDITIONS --- */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[12px] font-black text-[#64748B] tracking-widest uppercase">
              Medical Conditions ⚠️
            </h3>
            {!isDoctorView && (
              <button
                onClick={() => {
                  setEditConditionsForm([...conditions]);
                  setIsEditingConditions(true);
                }}
              >
                <Pencil className="w-4 h-4 text-[#64748B]" />
              </button>
            )}
          </div>
          <div className="space-y-3">
            {conditions.map((c) => (
              <ConditionCard
                key={c.id}
                icon={
                  c.type === "heart" ? (
                    <HeartPulse className="w-6 h-6 text-[#D14343]" />
                  ) : (
                    <Droplets className="w-6 h-6 text-[#D14343]" />
                  )
                }
                title={c.title}
                subtitle={c.subtitle}
                history={c.history}
              />
            ))}
          </div>
        </section>

        {/* --- ALLERGIES --- */}
        <section className="bg-[#FEE2E2] rounded-2xl p-6 border border-red-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[#D14343]" />
              <h3 className="text-[12px] font-black text-[#1E293B] tracking-widest uppercase">
                Severe Allergies
              </h3>
            </div>
            {!isDoctorView && (
              <button
                onClick={() => {
                  setEditAllergiesForm([...allergies]);
                  setIsEditingAllergies(true);
                }}
              >
                <Pencil className="w-4 h-4 text-[#D14343]" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {allergies.map((a) => (
              <span
                key={a.id}
                className="bg-[#C54242] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm"
              >
                {a.name} - {a.severity}
              </span>
            ))}
          </div>
        </section>

        {/* --- QR SCAN --- */}
        {!isDoctorView && (
          <section className="bg-white rounded-[2rem] p-8 flex flex-col items-center border border-slate-100 shadow-sm text-center">
            <h3 className="text-[12px] font-black mb-6 tracking-widest uppercase opacity-60">
              SCAN FOR FULL MEDICAL HISTORY
            </h3>
            <div className="p-6 bg-[#F8FAFC] rounded-3xl border-2 border-dashed border-[#CBD5E1] qr-container">
              <QRCodeSVG
                value={window.location.origin + "?id=" + medicalInfo.patientId}
                size={150}
                level="M"
              />
            </div>
            <button
              onClick={downloadQR}
              className="mt-6 text-[10px] font-black text-[#2E75B6] uppercase tracking-widest hover:underline transition-all"
            >
              Download QR Code
            </button>
            <p className="text-[10px] text-[#94A3B8] mt-6 font-semibold leading-relaxed">
              Authorized medical personnel only.
              <br />
              Secured by Medivault encryption.
            </p>
          </section>
        )}

        {/* --- PDF BUTTON --- */}
        <button
          onClick={generatePDF}
          className="w-full bg-[#1E293B] text-white py-5 rounded-2xl flex items-center justify-center gap-3 font-black text-[12px] uppercase tracking-widest shadow-lg active:scale-95 transition-transform"
        >
          <FileText
            className={`w-6 h-6 ${isDoctorView ? "text-red-500" : "text-white"}`}
          />
          <span>Save Medical Record PDF</span>
        </button>
      </main>

      {/* --- EDIT MODAL (Simplified example) --- */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditing(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="relative w-full max-w-md bg-white rounded-t-[2.5rem] p-8 shadow-2xl"
            >
              <h3 className="text-xl font-black mb-6">Edit Profile</h3>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                className="w-full bg-slate-50 border p-4 rounded-2xl font-bold mb-4 outline-none focus:ring-2 focus:ring-red-500"
              />
              <button
                onClick={handleSave}
                className="w-full bg-[#C54242] text-white font-black py-4 rounded-2xl shadow-lg"
              >
                Save Changes
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const ConditionCard: React.FC<ConditionCardProps> = ({
  icon,
  title,
  subtitle,
  history,
}) => (
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
          <span className="font-black uppercase text-[9px] tracking-tighter mr-1 opacity-50">
            History:
          </span>
          {history}
        </p>
      </div>
    )}
  </div>
);

const MedicationItem: React.FC<{ name: string; dose: string }> = ({
  name,
  dose,
}) => (
  <div className="flex items-center justify-between p-4 border-b border-slate-5 last:border-0">
    <div className="flex items-center gap-3">
      <Pill className="w-5 h-5 text-[#2E75B6]" />
      <span className="font-bold text-[#1E293B]">{name}</span>
    </div>
    <span className="text-sm font-bold text-[#64748B]">{dose}</span>
  </div>
);
