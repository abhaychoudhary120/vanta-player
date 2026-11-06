import { Check, CircleAlert, Info, X } from "lucide-react";
import { usePlayerStore } from "../store/usePlayerStore";

const ICONS = {
  default: Info,
  success: Check,
  error: CircleAlert,
  info: Info,
};

export function ToastStack() {
  const toasts = usePlayerStore((state) => state.toasts);
  const dismissToast = usePlayerStore((state) => state.dismissToast);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.tone];
        return (
          <div
            key={toast.id}
            className={`toast toast--${toast.tone}`}
            role={toast.tone === "error" ? "alert" : "status"}
          >
            <span className="toast-icon">
              <Icon size={16} />
            </span>
            <span className="toast-message">{toast.message}</span>
            <button
              type="button"
              className="toast-dismiss"
              aria-label="Dismiss notification"
              onClick={() => dismissToast(toast.id)}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
