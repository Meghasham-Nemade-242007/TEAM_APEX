import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FilePlus,
  FolderOpen,
  Settings,
  HelpCircle,
  FileText,
  User,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import clsx from 'clsx';

export interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const { user } = useAuth();

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'New Analysis', path: '/new-analysis', icon: FilePlus },
    { label: 'Document History', path: '/history', icon: FolderOpen },
    { label: 'Settings', path: '/settings', icon: Settings },
    { label: 'Help & About', path: '/help', icon: HelpCircle },
  ];

  const content = (
    <aside className="w-60 bg-navy-dark text-slate-300 flex flex-col h-full border-r border-navy justify-between select-none shadow-lg">
      <div className="flex flex-col py-4">
        {/* Navigation Section */}
        <div className="px-4 mb-3">
          <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Navigation
          </span>
        </div>

        <nav className="flex flex-col space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-all group',
                    isActive
                      ? 'bg-blue-light text-blue-primary font-semibold shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-navy/60'
                  )
                }
                end={item.path === '/'}
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={clsx(
                        'w-4 h-4 transition-colors',
                        isActive ? 'text-blue-primary' : 'text-slate-400 group-hover:text-slate-200'
                      )}
                    />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Legal System Information Badge */}
        <div className="mt-8 mx-3 p-3 bg-navy/60 rounded-lg border border-slate-700/60">
          <div className="flex items-center gap-2 text-blue-300 text-xs font-medium mb-1">
            <FileText className="w-3.5 h-3.5" />
            <span>AI Legal Engine</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Statutory analysis, cited precedents & verifiable source passages.
          </p>
        </div>
      </div>

      {/* Bottom User Profile Section */}
      <div className="p-3 border-t border-navy/80 bg-navy/40">
        <div className="flex items-center gap-3 p-2 rounded-md hover:bg-navy/50 transition-colors">
          <div className="w-8 h-8 rounded-full bg-blue-primary/40 border border-blue-400/30 flex items-center justify-center text-blue-200 shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium text-white truncate">
              {user?.full_name || 'Legal Analyst'}
            </span>
            <span className="text-[10px] text-slate-400 truncate">
              {user?.email || 'analyst@portal.gov'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block w-60 shrink-0 h-[calc(100vh-64px)] sticky top-16 z-20">
        {content}
      </div>

      {/* Mobile drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div
            className="fixed inset-0 bg-navy-dark/70 backdrop-blur-xs transition-opacity"
            onClick={onClose}
          />
          <div className="relative z-50 w-60 h-full">{content}</div>
        </div>
      )}
    </>
  );
};
