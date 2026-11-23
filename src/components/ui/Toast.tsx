import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { FiCheckCircle, FiInfo, FiX, FiXCircle } from "react-icons/fi";
import styles from "./ui.module.css";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toast: (type: ToastType, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext({} as ToastContextType);

const ICONS: Record<ToastType, ReactNode> = {
  success: <FiCheckCircle size={18} />,
  error: <FiXCircle size={18} />,
  info: <FiInfo size={18} />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, message: string) => {
      const id = nextId.current++;
      setItems((current) => [...current, { id, type, message }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  const api: ToastContextType = {
    toast,
    success: useCallback((m: string) => toast("success", m), [toast]),
    error: useCallback((m: string) => toast("error", m), [toast]),
    info: useCallback((m: string) => toast("info", m), [toast]),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div className={styles.toastRegion} aria-live="polite">
        {items.map((item) => (
          <div
            key={item.id}
            className={`${styles.toast} ${styles[`toast${item.type.charAt(0).toUpperCase()}${item.type.slice(1)}`]}`}
          >
            <span>{ICONS[item.type]}</span>
            <span className={styles.toastMessage}>{item.message}</span>
            <button
              type="button"
              className={styles.toastClose}
              onClick={() => dismiss(item.id)}
              aria-label="Fechar"
            >
              <FiX />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
