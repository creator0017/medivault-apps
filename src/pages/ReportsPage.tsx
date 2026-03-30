import { Calendar, Download, Eye, FileText } from "lucide-react";
import React from "react";

const mockReports = [
  { id: 1, name: "Full Body Checkup", date: "2026-03-15", type: "PDF" },
  { id: 2, name: "Diabetes Screening", date: "2026-01-10", type: "JPG" },
];

export default function ReportsPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-black text-slate-800 mb-8 uppercase tracking-tight">
        Patient Medical Reports
      </h1>

      <div className="grid gap-4">
        {mockReports.map((report) => (
          <div
            key={report.id}
            className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between hover:border-blue-200 transition-all"
          >
            <div className="flex items-center gap-5">
              <div className="bg-blue-50 p-4 rounded-2xl">
                <FileText className="text-blue-600 w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">{report.name}</h3>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                  <Calendar className="w-3 h-3" /> {report.date} • {report.type}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors">
                <Eye className="w-5 h-5" />
              </button>
              <button className="p-3 bg-[#1E293B] text-white rounded-xl hover:bg-slate-800 transition-colors">
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
