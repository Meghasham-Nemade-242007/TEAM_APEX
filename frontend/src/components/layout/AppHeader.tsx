import React, { useState, useRef, useEffect } from 'react';
import { Scale, Bell, LogOut, User as UserIcon, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';

export interface AppHeaderProps {
  onToggleSidebar?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ onToggleSidebar }) => {
  const { user, logout, isAuthenticated } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    navigate('/login');
  };

  return (
    <header className="h-16 bg-navy text-white px-4 md:px-6 flex items-center justify-between shadow-md border-b border-navy-dark sticky top-0 z-30 select-none">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-1.5 text-slate-200 hover:text-white hover:bg-navy-dark rounded-md transition-colors"
            aria-label="Toggle navigation"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        <Link to="/" className="flex items-center gap-3 group focus:outline-none">
          <div className="w-10 h-10 rounded-lg bg-blue-primary/20 border border-blue-primary/40 flex items-center justify-center text-blue-light group-hover:bg-blue-primary/30 transition-colors shadow-xs">
            <Scale className="w-5 h-5 text-blue-300" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-base leading-tight tracking-tight text-white group-hover:text-blue-200 transition-colors">
              Legal Document Analysis System
            </span>
            <span className="text-[11px] text-slate-300 font-normal leading-tight hidden sm:inline">
              Court Document Review & Analysis Portal
            </span>
          </div>
        </Link>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="p-2 text-slate-300 hover:text-white hover:bg-navy-dark rounded-full transition-colors relative"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-primary rounded-full"></span>
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-border py-2 text-text-main z-50">
              <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                <span className="font-semibold text-xs text-navy uppercase tracking-wider">Notifications</span>
                <span className="text-[11px] text-text-secondary">All caught up</span>
              </div>
              <div className="p-4 text-center text-xs text-text-secondary flex flex-col items-center gap-2">
                <Check className="w-6 h-6 text-success" />
                <span>AI models and backend services are active. Analysis ready.</span>
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        {isAuthenticated && user ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 pl-2 pr-2.5 py-1.5 rounded-full hover:bg-navy-dark transition-colors border border-navy-dark focus:outline-none"
            >
              <div className="w-8 h-8 rounded-full bg-blue-primary text-white flex items-center justify-center font-semibold text-xs border border-blue-300/30">
                {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-xs font-medium text-white leading-tight">
                  {user.full_name || 'Counsel'}
                </span>
                <span className="text-[10px] text-slate-300 leading-tight truncate max-w-[120px]">
                  {user.email}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-border py-1 text-text-main z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-3 border-b border-border bg-slate-50">
                  <p className="text-xs font-semibold text-navy truncate">{user.full_name}</p>
                  <p className="text-[11px] text-text-secondary truncate mt-0.5">{user.email}</p>
                </div>

                <div className="py-1">
                  <Link
                    to="/settings"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-navy hover:bg-blue-light/50 transition-colors"
                  >
                    <UserIcon className="w-4 h-4 text-text-secondary" />
                    Account Settings
                  </Link>
                </div>

                <div className="border-t border-border pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-error hover:bg-red-50 transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Link
            to="/login"
            className="text-xs font-medium bg-blue-primary text-white px-3.5 py-1.5 rounded-md hover:bg-[#0759af] transition-colors"
          >
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
};
