import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Prevent closing during critical operations (default: true) */
  allowClose?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  allowClose = true,
}: ModalProps) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && allowClose) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, allowClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop - click only, keyboard close via ESC key handler above */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: ESC key handler provides keyboard accessibility */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={allowClose ? onClose : undefined}
      />

      {/* Modal Content */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative bg-bg-primary rounded-lg shadow-xl w-full ${sizeClasses[size]} mx-4 animate-in fade-in zoom-in-95 duration-200`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 id="modal-title" className="text-lg font-semibold text-text-primary">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-bg-secondary transition-colors"
            aria-label="Close"
            disabled={!allowClose}
          >
            <X size={20} className="text-text-secondary" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
