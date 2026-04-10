import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronRight,
  FileText,
  Loader,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { analyzeReport } from '../lib/reportAnalysis';
import type { ExtractedMedicalData, Report } from '../types';

interface ReportsPageProps {
  reports: Report[];
  onAddReport: (report: Report) => void;
  onUpdateReport: (id: string, updates: Partial<Report>) => void;
  onApplyData: (data: ExtractedMedicalData) => void;
}

export default function ReportsPage({
  reports,
  onAddReport,
  onUpdateReport,
  onApplyData,
}: ReportsPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [applying, setApplying] = useState(false);
  const [appliedSuccess, setAppliedSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);

    for (const file of files) {
      const id = Date.now() + Math.random() + '';
      const report: Report = {
        id,
        name: file.name.replace(/\.[^.]+$/, ''),
        date: new Date().toISOString().slice(0, 10),
        fileType: file.type.includes('pdf') ? 'PDF' : 'IMG',
        size: file.size > 1024 * 1024
          ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
          : (file.size / 1024).toFixed(0) + ' KB',
        status: 'analyzing',
      };
      onAddReport(report);

      try {
        const extracted = await analyzeReport(file);
        onUpdateReport(id, { status: 'done', extractedData: extracted });
      } catch (err) {
        console.error('Analysis failed:', err);
        onUpdateReport(id, { status: 'error' });
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleApply = async (report: Report) => {
    if (!report.extractedData) return;
    setApplying(true);
    onApplyData(report.extractedData);
    await new Promise((r) => setTimeout(r, 700));
    setApplying(false);
    setSelectedReport(null);
    setAppliedSuccess(true);
    setTimeout(() => setAppliedSuccess(false), 3500);
  };

  const statusBadge = (report: Report) => {
    if (report.status === 'analyzing')
      return (
        <span className="flex items-center gap-1 text-[9px] font-black text-blue-500 bg-blue-50 px-2 py-1 rounded-lg uppercase">
          <Loader className="w-3 h-3 animate-spin" /> Analyzing
        </span>
      );
    if (report.status === 'error')
      return (
        <span className="flex items-center gap-1 text-[9px] font-black text-red-400 bg-red-50 px-2 py-1 rounded-lg uppercase">
          <AlertCircle className="w-3 h-3" /> Error
        </span>
      );
    return (
      <span className="flex items-center gap-1 text-[9px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg uppercase">
        <CheckCircle className="w-3 h-3" /> Done
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm px-6 py-4">
        <p className="text-[10px] font-black text-[#64748B] uppercase tracking-widest">AI-Powered</p>
        <h1 className="text-xl font-black text-[#1E293B]">Medical Reports</h1>
      </header>

      <main className="max-w-md mx-auto p-5 space-y-5">
        {/* Upload zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className="border-2 border-dashed border-[#CBD5E1] bg-white rounded-[2rem] p-8 flex flex-col items-center gap-4 cursor-pointer hover:border-[#C54242] hover:bg-red-50/30 transition-all group"
        >
          <div className="bg-red-50 p-4 rounded-2xl group-hover:bg-red-100 transition-colors">
            {uploading ? (
              <Loader className="w-8 h-8 text-[#C54242] animate-spin" />
            ) : (
              <Upload className="w-8 h-8 text-[#C54242]" />
            )}
          </div>
          <div className="text-center">
            <p className="font-black text-[#1E293B]">
              {uploading ? 'Analyzing with AI…' : 'Upload Medical Reports'}
            </p>
            <p className="text-xs text-[#64748B] mt-1">PDF, JPG, PNG supported • AI extracts all data</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black text-[#C54242] uppercase tracking-widest">
            <Sparkles className="w-3 h-3" /> Powered by AI
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
        </motion.div>

        {/* Success banner */}
        <AnimatePresence>
          {appliedSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3"
            >
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-xs font-bold text-green-700">
                Data applied! Your Emergency Card has been updated.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reports list */}
        {reports.length > 0 ? (
          <section>
            <h2 className="text-[11px] font-black text-[#64748B] uppercase tracking-widest mb-3">
              Uploaded Reports ({reports.length})
            </h2>
            <div className="space-y-3">
              {reports.map((report) => (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                >
                  <div className="p-4 flex items-center gap-3">
                    <div
                      className={`p-3 rounded-xl flex-shrink-0 ${
                        report.status === 'done'
                          ? 'bg-green-50'
                          : report.status === 'analyzing'
                          ? 'bg-blue-50'
                          : 'bg-red-50'
                      }`}
                    >
                      <FileText
                        className={`w-5 h-5 ${
                          report.status === 'done'
                            ? 'text-green-500'
                            : report.status === 'analyzing'
                            ? 'text-blue-400'
                            : 'text-red-400'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#1E293B] text-sm truncate">{report.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span className="text-[10px] text-slate-400">{report.date}</span>
                        <span className="text-[10px] text-slate-300">•</span>
                        <span className="text-[10px] text-slate-400">{report.fileType}</span>
                        <span className="text-[10px] text-slate-300">•</span>
                        <span className="text-[10px] text-slate-400">{report.size}</span>
                      </div>
                    </div>
                    {statusBadge(report)}
                  </div>

                  {/* Extracted data preview */}
                  {report.status === 'done' && report.extractedData && (
                    <div className="px-4 pb-4">
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-[9px] font-black text-[#64748B] uppercase tracking-widest mb-2">
                          AI Extracted Data:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {report.extractedData.name && (
                            <span className="bg-blue-50 text-blue-600 text-[9px] font-bold px-2 py-0.5 rounded-lg">
                              👤 {report.extractedData.name}
                            </span>
                          )}
                          {report.extractedData.bloodGroup && (
                            <span className="bg-red-50 text-red-600 text-[9px] font-bold px-2 py-0.5 rounded-lg">
                              🩸 {report.extractedData.bloodGroup}
                            </span>
                          )}
                          {report.extractedData.age && (
                            <span className="bg-purple-50 text-purple-600 text-[9px] font-bold px-2 py-0.5 rounded-lg">
                              Age: {report.extractedData.age}
                            </span>
                          )}
                          {report.extractedData.conditions?.length ? (
                            <span className="bg-orange-50 text-orange-600 text-[9px] font-bold px-2 py-0.5 rounded-lg">
                              🫀 {report.extractedData.conditions.length} condition{report.extractedData.conditions.length > 1 ? 's' : ''}
                            </span>
                          ) : null}
                          {report.extractedData.medications?.length ? (
                            <span className="bg-green-50 text-green-600 text-[9px] font-bold px-2 py-0.5 rounded-lg">
                              💊 {report.extractedData.medications.length} medication{report.extractedData.medications.length > 1 ? 's' : ''}
                            </span>
                          ) : null}
                          {report.extractedData.allergies?.length ? (
                            <span className="bg-yellow-50 text-yellow-700 text-[9px] font-bold px-2 py-0.5 rounded-lg">
                              ⚠️ {report.extractedData.allergies.length} allerg{report.extractedData.allergies.length > 1 ? 'ies' : 'y'}
                            </span>
                          ) : null}
                        </div>
                        <button
                          onClick={() => setSelectedReport(report)}
                          className="mt-3 w-full bg-[#C54242] text-white text-[10px] font-black py-2.5 rounded-xl flex items-center justify-center gap-1 uppercase tracking-widest"
                        >
                          Apply to Emergency Card <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {report.status === 'error' && (
                    <div className="px-4 pb-4">
                      <p className="text-[10px] text-red-400 font-bold bg-red-50 rounded-xl px-3 py-2">
                        Analysis failed. Please check your API configuration and try again.
                      </p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </section>
        ) : (
          <div className="text-center py-16 text-slate-400">
            <FileText className="w-14 h-14 mx-auto mb-4 opacity-20" />
            <p className="text-sm font-bold">No reports yet</p>
            <p className="text-xs mt-1">Upload your first medical report above</p>
          </div>
        )}
      </main>

      {/* ── Apply Confirm Modal ── */}
      <AnimatePresence>
        {selectedReport && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedReport(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="relative w-full max-w-md bg-white rounded-t-[2.5rem] p-8 shadow-2xl"
            >
              <button
                onClick={() => setSelectedReport(null)}
                className="absolute top-4 right-4 p-2 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3 mb-5">
                <div className="bg-red-50 p-3 rounded-2xl">
                  <Sparkles className="w-6 h-6 text-[#C54242]" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#1E293B]">Apply to Emergency Card?</h3>
                  <p className="text-xs text-[#64748B]">New data will be merged, not replaced</p>
                </div>
              </div>

              {selectedReport.extractedData && (
                <div className="bg-slate-50 rounded-2xl p-4 mb-5 space-y-1.5 text-xs">
                  {selectedReport.extractedData.name && (
                    <p>
                      <span className="font-black text-slate-500">Name: </span>
                      {selectedReport.extractedData.name}
                    </p>
                  )}
                  {selectedReport.extractedData.bloodGroup && (
                    <p>
                      <span className="font-black text-slate-500">Blood Group: </span>
                      {selectedReport.extractedData.bloodGroup}
                    </p>
                  )}
                  {selectedReport.extractedData.age && (
                    <p>
                      <span className="font-black text-slate-500">Age: </span>
                      {selectedReport.extractedData.age}
                    </p>
                  )}
                  {selectedReport.extractedData.conditions?.length ? (
                    <p>
                      <span className="font-black text-slate-500">Conditions: </span>
                      {selectedReport.extractedData.conditions.map((c) => c.title).join(', ')}
                    </p>
                  ) : null}
                  {selectedReport.extractedData.medications?.length ? (
                    <p>
                      <span className="font-black text-slate-500">Medications: </span>
                      {selectedReport.extractedData.medications.map((m) => m.name).join(', ')}
                    </p>
                  ) : null}
                  {selectedReport.extractedData.allergies?.length ? (
                    <p>
                      <span className="font-black text-slate-500">Allergies: </span>
                      {selectedReport.extractedData.allergies.map((a) => a.name).join(', ')}
                    </p>
                  ) : null}
                </div>
              )}

              <button
                onClick={() => handleApply(selectedReport)}
                disabled={applying}
                className="w-full bg-[#C54242] text-white font-black py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {applying ? (
                  <Loader className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
                {applying ? 'Applying…' : 'Apply to Emergency Card'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
