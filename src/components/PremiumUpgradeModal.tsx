import React from 'react';
import { X } from 'lucide-react';
import { PremiumUpgradeCard } from './PremiumUpgradeCard';
import { useModal } from '../context/ModalContext';
import { useAuth } from '../context/AuthContext';
import { useEscapeKey } from '../utils/useEscapeKey';

interface PremiumUpgradeModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onUpgrade?: () => void;
  isUpgrading?: boolean;
}

export const PremiumUpgradeModal: React.FC<PremiumUpgradeModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  onUpgrade: propOnUpgrade,
  isUpgrading = false,
}) => {
  const { isModalOpen, closeModal, getPayload } = useModal();
  const { updatePlan } = useAuth();
  const isOpen = propIsOpen !== undefined ? propIsOpen : isModalOpen('premium-upgrade');
  const onClose = propOnClose || closeModal;

  const payload = getPayload<{ onUpgrade?: () => void }>();
  const onUpgrade = propOnUpgrade || payload?.onUpgrade || (() => updatePlan('premium'));

  useEscapeKey(onClose, isOpen);

  if (!isOpen) return null;

  return (
    <div className="kova-modal fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="max-w-lg w-full relative">
        <button
          onClick={onClose}
          type="button"
          className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white flex items-center justify-center border border-white/20 shadow-xl transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <PremiumUpgradeCard
          onUpgrade={() => {
            if (onUpgrade) onUpgrade();
          }}
          isUpgrading={isUpgrading}
        />
      </div>
    </div>
  );
};
