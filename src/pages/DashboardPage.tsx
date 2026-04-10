import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  Bot,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  MessageSquare,
  Pill,
  Send,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { sendChatMessage } from '../lib/groq';
import type {
  Allergy,
  ChatMessage,
  Condition,
  Contact,
  HealthMetric,
  MedicalInfo,
  Medication,
  Report,
} from '../types';

/* ─── SVG Line Chart ─────────────────────────────────────────────── */
interface LineChartProps {
  metrics: HealthMetric[];
  type: HealthMetric['type'];
  color: string;
  label: string;
  unit: string;
  normalRange?: [number, number];
}

function LineChart({ metrics, type, color, label, unit, normalRange }: LineChartProps) {
  const data = metrics.filter((m) => m.type === type).slice(-6);
  if (data.length < 2) {
    return (
      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-xs text-slate-400">Not enough data yet</p>
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const min = Math.min(...values) - 8;
  const max = Math.max(...values) + 8;
  const range = max - min || 1;

  const W = 260;
  const H = 80;
  const padX = 8;
  const padY = 8;
  const chartW = W - padX * 2;
  const chartH = H - padY * 2;

  const pts = data.map((d, i) => ({
    x: padX + (i / (data.length - 1)) * chartW,
    y: padY + chartH - ((d.value - min) / range) * chartH,
    v: d.value,
    date: d.date.slice(5),
  }));

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L${pts[pts.length - 1].x},${H - padY} L${padX},${H - padY} Z`;

  const latest = values[values.length - 1];
  const prev = values[values.length - 2];
  const diff = latest - prev;
  const isGoodDown = type === 'bp_sys' || type === 'glucose';
  const improving = isGoodDown ? diff < 0 : diff > 0;
  const TrendIcon = diff < 0 ? TrendingDown : TrendingUp;
  const trendColor = improving ? 'text-green-500' : diff === 0 ? 'text-slate-400' : 'text-red-400';

  const inRange =
    normalRange ? latest >= normalRange[0] && latest <= normalRange[1] : true;

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <p className="text-2xl font-black text-slate-800">{latest}</p>
            <p className="text-xs text-slate-400">{unit}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className={`flex items-center gap-0.5 ${trendColor}`}>
            <TrendIcon className="w-4 h-4" />
            <span className="text-xs font-black">
              {Math.abs(diff).toFixed(0)}
            </span>
          </div>
          {normalRange && (
            <span
              className={`text-[8px] font-black px-2 py-0.5 rounded-full ${
                inRange ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
              }`}
            >
              {inRange ? 'Normal' : 'High'}
            </span>
          )}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16">
        <defs>
          <linearGradient id={`g-${type}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#g-${type})`} />
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === pts.length - 1 ? 4 : 3}
            fill={i === pts.length - 1 ? color : 'white'}
            stroke={color}
            strokeWidth="2"
          />
        ))}
      </svg>
      <div className="flex justify-between mt-1">
        {pts.map((p, i) => (
          <span key={i} className="text-[8px] text-slate-400 font-bold">
            {p.date}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Dashboard Page ─────────────────────────────────────────────── */
interface DashboardPageProps {
  medicalInfo: MedicalInfo;
  conditions: Condition[];
  allergies: Allergy[];
  medications: Medication[];
  contacts: Contact[];
  reports: Report[];
  healthMetrics: HealthMetric[];
  chatHistory: ChatMessage[];
  onAddChatMessage: (msg: ChatMessage) => void;
  onClearChat: () => void;
}

function buildContext(props: DashboardPageProps): string {
  const parts: string[] = [];
  if (props.medicalInfo.name) parts.push(`Patient: ${props.medicalInfo.name}`);
  if (props.medicalInfo.age) parts.push(`Age: ${props.medicalInfo.age}`);
  if (props.medicalInfo.bloodGroup) parts.push(`Blood group: ${props.medicalInfo.bloodGroup}`);
  if (props.conditions.length)
    parts.push(`Conditions: ${props.conditions.map((c) => c.title).join(', ')}`);
  if (props.allergies.length)
    parts.push(`Allergies: ${props.allergies.map((a) => `${a.name}(${a.severity})`).join(', ')}`);
  if (props.medications.length)
    parts.push(`Medications: ${props.medications.map((m) => `${m.name} ${m.dose}`).join(', ')}`);
  return parts.join('. ');
}

const QUICK_PROMPTS = [
  'What do my conditions mean?',
  'Explain my medications',
  'Tips to lower blood pressure',
  'What is a normal blood glucose?',
];

export default function DashboardPage(props: DashboardPageProps) {
  const {
    medicalInfo,
    conditions,
    allergies,
    medications,
    reports,
    healthMetrics,
    chatHistory,
    onAddChatMessage,
    onClearChat,
  } = props;

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showChat) {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [chatHistory, showChat]);

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now() + '',
      role: 'user',
      text: msg,
      timestamp: Date.now(),
    };
    onAddChatMessage(userMsg);
    setInput('');
    setIsLoading(true);
    if (!showChat) setShowChat(true);

    try {
      const reply = await sendChatMessage(chatHistory, msg, buildContext(props));
      onAddChatMessage({
        id: (Date.now() + 1) + '',
        role: 'model',
        text: reply,
        timestamp: Date.now(),
      });
    } catch {
      onAddChatMessage({
        id: (Date.now() + 1) + '',
        role: 'model',
        text: 'Connection error. Please check your API key in .env.local and try again.',
        timestamp: Date.now(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const firstName = medicalInfo.name?.split(' ')[0] ?? 'User';

  const stats = [
    { icon: <ClipboardList className="w-5 h-5" />, label: 'Conditions', count: conditions.length, color: 'bg-red-50 text-red-500' },
    { icon: <Pill className="w-5 h-5" />, label: 'Medications', count: medications.length, color: 'bg-blue-50 text-blue-500' },
    { icon: <AlertCircle className="w-5 h-5" />, label: 'Allergies', count: allergies.length, color: 'bg-orange-50 text-orange-500' },
    { icon: <FileText className="w-5 h-5" />, label: 'Reports', count: reports.length, color: 'bg-green-50 text-green-600' },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm px-6 py-4">
        <p className="text-[10px] font-black text-[#64748B] uppercase tracking-widest">{greeting}</p>
        <h1 className="text-xl font-black text-[#1E293B]">
          {firstName} <span className="text-lg">👋</span>
        </h1>
      </header>

      <main className="max-w-md mx-auto p-5 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3"
            >
              <div className={`p-2.5 rounded-xl ${s.color}`}>{s.icon}</div>
              <div>
                <p className="text-2xl font-black text-[#1E293B]">{s.count}</p>
                <p className="text-[9px] font-black text-[#64748B] uppercase tracking-widest">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Health Trends */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-[#64748B]" />
            <h2 className="text-[11px] font-black text-[#64748B] uppercase tracking-widest">Health Trends</h2>
          </div>
          <div className="space-y-3">
            <LineChart
              metrics={healthMetrics}
              type="bp_sys"
              color="#C54242"
              label="Blood Pressure (Systolic)"
              unit="mmHg"
              normalRange={[90, 120]}
            />
            <LineChart
              metrics={healthMetrics}
              type="glucose"
              color="#2E75B6"
              label="Blood Glucose"
              unit="mg/dL"
              normalRange={[70, 140]}
            />
          </div>
        </section>

        {/* AI Chat */}
        <section className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowChat((v) => !v)}
            className="w-full flex items-center justify-between p-5"
          >
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-[#C54242] to-[#2E75B6] p-2.5 rounded-xl">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-black text-[#1E293B]">MediBot AI Chat</p>
                <p className="text-[10px] text-[#64748B]">Ask health questions • Groq powered</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {chatHistory.length > 0 && (
                <span className="bg-[#C54242] text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full">
                  {Math.min(chatHistory.length, 99)}
                </span>
              )}
              {showChat ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </div>
          </button>

          <AnimatePresence>
            {showChat && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-slate-100"
              >
                {/* Messages */}
                <div className="h-72 overflow-y-auto p-4 space-y-3 bg-slate-50/40">
                  {chatHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                      <div className="bg-gradient-to-br from-[#C54242] to-[#2E75B6] p-4 rounded-2xl">
                        <Bot className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-600">Hi! I'm MediBot</p>
                        <p className="text-xs text-slate-400 mt-1">Ask me about your health records</p>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {QUICK_PROMPTS.map((q) => (
                          <button
                            key={q}
                            onClick={() => handleSend(q)}
                            className="text-[9px] font-bold bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-slate-600 hover:border-red-300 hover:text-[#C54242] transition-colors"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    chatHistory.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.role === 'model' && (
                          <div className="bg-gradient-to-br from-[#C54242] to-[#2E75B6] p-1.5 rounded-xl h-fit flex-shrink-0 mt-0.5">
                            <Bot className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] px-3 py-2.5 rounded-2xl text-xs leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-[#C54242] text-white rounded-tr-sm'
                              : 'bg-white border border-slate-100 text-slate-700 rounded-tl-sm shadow-sm'
                          }`}
                        >
                          {msg.text}
                        </div>
                        {msg.role === 'user' && (
                          <div className="bg-slate-100 p-1.5 rounded-xl h-fit flex-shrink-0 mt-0.5">
                            <User className="w-3 h-3 text-slate-500" />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  {isLoading && (
                    <div className="flex gap-2 items-center">
                      <div className="bg-gradient-to-br from-[#C54242] to-[#2E75B6] p-1.5 rounded-xl">
                        <Bot className="w-3 h-3 text-white" />
                      </div>
                      <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm">
                        <div className="flex gap-1.5">
                          <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" />
                          <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.15s]" />
                          <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.3s]" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input bar */}
                <div className="p-3 border-t border-slate-100 bg-white flex gap-2 items-center">
                  {chatHistory.length > 0 && (
                    <button
                      onClick={onClearChat}
                      className="p-2 text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"
                      title="Clear chat"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder="Ask about your health…"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-red-100 focus:border-red-200 transition-all"
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isLoading}
                    className="bg-[#C54242] text-white p-2.5 rounded-xl disabled:opacity-40 hover:bg-[#B03535] transition-colors flex-shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Quick tip */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-r from-blue-50 to-red-50 rounded-2xl p-4 border border-blue-100"
        >
          <p className="text-[10px] font-black text-[#2E75B6] uppercase tracking-widest mb-1">💡 Quick Tip</p>
          <p className="text-xs text-slate-600 leading-relaxed">
            Upload your medical reports in the <strong>Reports</strong> tab — AI will read
            them and auto-populate your Emergency Card instantly.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
