import { LayoutDashboard, HeartPulse, FileText } from 'lucide-react';
import type { AppPage } from '../types';

interface NavigationProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  reportsBadge?: number;
}

export default function Navigation({ currentPage, onNavigate, reportsBadge }: NavigationProps) {
  const tabs: { id: AppPage; label: string; icon: React.ReactNode }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      id: 'emergency',
      label: 'Emergency',
      icon: <HeartPulse className="w-5 h-5" />,
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: <FileText className="w-5 h-5" />,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-slate-100 shadow-2xl safe-area-inset-bottom">
      <div className="max-w-md mx-auto flex">
        {tabs.map((tab) => {
          const isActive = currentPage === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={`relative flex-1 flex flex-col items-center py-3 gap-0.5 transition-all ${
                isActive ? 'text-[#C54242]' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.icon}
              <span
                className={`text-[9px] font-black uppercase tracking-widest ${
                  isActive ? 'opacity-100' : 'opacity-50'
                }`}
              >
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute top-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-[#C54242]" />
              )}
              {tab.id === 'reports' && reportsBadge && reportsBadge > 0 && !isActive ? (
                <span className="absolute top-1.5 right-6 min-w-[14px] h-[14px] bg-[#C54242] text-white text-[8px] font-black flex items-center justify-center rounded-full px-0.5">
                  {reportsBadge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
