import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { onSaveError } from '../lib/userService';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  type?: ToastType;
  duration?: number;
}

export interface ToastContextType {
  toasts: ToastItem[];
  showToast: (message: string, type?: ToastType, duration?: number) => string;
  removeToast: (id: string) => void;
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
  warning: (message: string, duration?: number) => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 3500): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastItem = { id, message, type, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast]
  );

  const success = useCallback(
    (message: string, duration?: number) => showToast(message, 'success', duration),
    [showToast]
  );

  const error = useCallback(
    (message: string, duration?: number) => showToast(message, 'error', duration),
    [showToast]
  );

  const info = useCallback(
    (message: string, duration?: number) => showToast(message, 'info', duration),
    [showToast]
  );

  const warning = useCallback(
    (message: string, duration?: number) => showToast(message, 'warning', duration),
    [showToast]
  );

  // Failed Firestore saves show one error toast (item 3), at most every 8s so a bad connection
  // doesn't stack them up.
  const lastSaveErrorAt = useRef(0);
  useEffect(
    () =>
      onSaveError((what) => {
        const now = Date.now();
        if (now - lastSaveErrorAt.current < 8000) return;
        lastSaveErrorAt.current = now;
        showToast(`Couldn't save ${what}. Check your connection and try again.`, 'error', 5000);
      }),
    [showToast]
  );

  const getToastIcon = (type?: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-sky-400 shrink-0" />;
    }
  };

  const getToastBorder = (type?: ToastType) => {
    switch (type) {
      case 'success':
        return 'border-emerald-500/30 shadow-emerald-950/20';
      case 'error':
        return 'border-rose-500/30 shadow-rose-950/20';
      case 'warning':
        return 'border-amber-500/30 shadow-amber-950/20';
      case 'info':
      default:
        return 'border-white/15 shadow-black/40';
    }
  };

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        removeToast,
        success,
        error,
        info,
        warning,
      }}
    >
      {children}

      {/* Global Toast Container */}
      <div
        id="global-toast-container"
        className="fixed bottom-6 inset-x-0 mx-auto max-w-sm sm:max-w-md px-4 flex flex-col items-center gap-2 z-50 pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            id={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-neutral-900/95 backdrop-blur-xl border ${getToastBorder(
              toast.type
            )} text-white shadow-2xl text-xs sm:text-sm font-medium w-full transition-all duration-200 animate-in fade-in slide-in-from-bottom-4`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {getToastIcon(toast.type)}
              <span className="truncate text-white/90">{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="text-white/40 hover:text-white shrink-0 p-1 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Close notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
