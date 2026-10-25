import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { SavingsGoal } from '../types';

export type ModalType =
  | 'add-expense'
  | 'csv-import'
  | 'voice-note'
  | 'edit-goal'
  | 'create-goal'
  | 'premium-upgrade'
  | 'delete-account'
  | 'archive-goal'
  | (string & {});

export interface ModalContextType {
  activeModal: ModalType | null;
  modalPayload: any;
  openModal: (modal: ModalType, payload?: any) => void;
  closeModal: () => void;
  isModalOpen: (modal?: ModalType) => boolean;
  getPayload: <T = any>() => T | null;

  // Convenient semantic openers
  openAddExpense: (payload?: any) => void;
  openCsvImport: (payload?: any) => void;
  openVoiceNote: (payload?: any) => void;
  openEditGoal: (goal?: SavingsGoal | null, mode?: 'edit' | 'create' | 'upgrade') => void;
  openCreateGoal: () => void;
  openPremiumUpgrade: (payload?: any) => void;
  openDeleteAccount: (payload?: any) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);
  const [modalPayload, setModalPayload] = useState<any>(null);

  const openModal = useCallback((modal: ModalType, payload?: any) => {
    setActiveModal(modal);
    setModalPayload(payload ?? null);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setModalPayload(null);
  }, []);

  const isModalOpen = useCallback(
    (modal?: ModalType) => {
      if (!modal) return activeModal !== null;
      return activeModal === modal;
    },
    [activeModal]
  );

  const getPayload = useCallback(<T = any,>(): T | null => {
    return modalPayload as T | null;
  }, [modalPayload]);

  const openAddExpense = useCallback(
    (payload?: any) => openModal('add-expense', payload),
    [openModal]
  );

  const openCsvImport = useCallback(
    (payload?: any) => openModal('csv-import', payload),
    [openModal]
  );

  const openVoiceNote = useCallback(
    (payload?: any) => openModal('voice-note', payload),
    [openModal]
  );

  const openEditGoal = useCallback(
    (goal?: SavingsGoal | null, mode: 'edit' | 'create' | 'upgrade' = 'edit') => {
      openModal('edit-goal', { goal, mode });
    },
    [openModal]
  );

  const openCreateGoal = useCallback(() => {
    openModal('edit-goal', { mode: 'create' });
  }, [openModal]);

  const openPremiumUpgrade = useCallback(
    (payload?: any) => openModal('premium-upgrade', payload),
    [openModal]
  );

  const openDeleteAccount = useCallback(
    (payload?: any) => openModal('delete-account', payload),
    [openModal]
  );

  const value: ModalContextType = {
    activeModal,
    modalPayload,
    openModal,
    closeModal,
    isModalOpen,
    getPayload,
    openAddExpense,
    openCsvImport,
    openVoiceNote,
    openEditGoal,
    openCreateGoal,
    openPremiumUpgrade,
    openDeleteAccount,
  };

  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
};

export const useModal = (): ModalContextType => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};
