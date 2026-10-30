// ===== Imports =====
import { useEffect } from "react";
import { X } from "lucide-react";

// ===== The Modal component =====
// A pop-up window over the page, used for forms and details.
// Closes with the X button, the Escape key, or a click on the dark background.
export default function Modal({ title, onClose, children, wide = false }) {
  // Listen for the Escape key while the modal is open.
  useEffect(() => {
    function handleKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey); // clean up when closed
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      {/* stopPropagation: clicks inside the window must not close it */}
      <div className={wide ? "modal wide" : "modal"} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
