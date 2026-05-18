import { useState, useCallback, createContext, useContext, ReactNode } from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={toastContainerStyle}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              ...toastStyle,
              borderLeftColor:
                toast.type === "success"
                  ? "var(--color-success)"
                  : toast.type === "error"
                  ? "var(--color-error)"
                  : "var(--color-navy)",
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

const toastContainerStyle: React.CSSProperties = {
  position: "fixed",
  bottom: "var(--space-6)",
  right: "var(--space-6)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
  zIndex: 1000,
};

const toastStyle: React.CSSProperties = {
  background: "var(--color-surface)",
  padding: "var(--space-3) var(--space-5)",
  borderRadius: "var(--radius-md)",
  borderLeft: "4px solid",
  boxShadow: "var(--shadow-md)",
  fontSize: "var(--font-size-sm)",
  fontWeight: "500",
  animation: "fadeIn 0.2s ease",
};