import React, { useState, useEffect, useRef } from 'react';
import { Target, X, Check, Trash2 } from 'lucide-react';
import { SavingsGoal, UserProfile } from '../types';
import { PremiumUpgradeCard } from './PremiumUpgradeCard';
import { useAuth } from '../context/AuthContext';
import { useGoals } from '../context/GoalContext';
import { useModal } from '../context/ModalContext';
import { getCurrencySymbol, convertCurrency } from '../utils/currency';
import { generateUniqueId } from '../utils/id';
import { useEscapeKey } from '../utils/useEscapeKey';

interface EditGoalModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  goal?: SavingsGoal | null;
  onSaveGoal?: (updatedGoal: SavingsGoal, isNew?: boolean) => void;
  onArchiveGoal?: () => void;
  userProfile?: UserProfile | null;
  activeGoalsCount?: number;
  onUpgradePlan?: () => void;
  initialMode?: 'edit' | 'create' | 'upgrade';
}

export const EditGoalModal: React.FC<EditGoalModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  goal: propGoal,
  onSaveGoal: propOnSaveGoal,
  onArchiveGoal: propOnArchiveGoal,
  userProfile: propUserProfile,
  onUpgradePlan: propOnUpgradePlan,
  initialMode: propInitialMode,
}) => {
  const { userProfile: authUserProfile, updatePlan, currency: authCurrency } = useAuth();
  const goalCtx = useGoals();
  const { isModalOpen, closeModal, getPayload } = useModal();

  const userProfile = propUserProfile !== undefined ? propUserProfile : authUserProfile;
  const currency = userProfile?.currency || authCurrency || 'USD';
  const currencySymbol = getCurrencySymbol(currency);

  const modalPayload = getPayload<{ goal?: SavingsGoal; mode?: 'edit' | 'create' | 'upgrade' }>();
  const isGoalModalOpen = isModalOpen('edit-goal') || isModalOpen('create-goal') || goalCtx.isEditGoalOpen;

  const isOpen = propIsOpen !== undefined ? propIsOpen : isGoalModalOpen;
  const onClose = propOnClose || (() => {
    closeModal();
    goalCtx.handleCloseEditGoal();
  });

  const payloadGoal = modalPayload?.goal;
  const payloadMode = modalPayload?.mode || (isModalOpen('create-goal') ? 'create' : undefined);

  const goal = propGoal !== undefined ? propGoal : (payloadGoal || goalCtx.editingGoal || goalCtx.savingsGoal);
  const onSaveGoal = propOnSaveGoal || goalCtx.handleSaveGoal;
  const onArchiveGoal = propOnArchiveGoal || goalCtx.handleArchiveGoal;
  const initialMode = propInitialMode !== undefined ? propInitialMode : (payloadMode || goalCtx.editGoalModalMode);

  const onUpgradePlan = propOnUpgradePlan || (() => updatePlan('premium'));

  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');

  const titleInputRef = useRef<HTMLInputElement>(null);
  const targetInputRef = useRef<HTMLInputElement>(null);

  const isCreatingNew = initialMode === 'create';
  const isUpgradeMode = initialMode === 'upgrade';

  useEffect(() => {
    if (isOpen) {
      if (initialMode === 'create') {
        setTitle('');
        setTargetAmount('');
        setCurrentAmount('0');
        setTimeout(() => titleInputRef.current?.focus(), 50);
      } else if (goal) {
        setTitle(goal.title || '');
        const sourceCurrency = goal.nativeCurrency || 'USD';
        const convertedTarget = convertCurrency(goal.targetAmount || 0, sourceCurrency, currency);
        const convertedCurrent = convertCurrency(goal.currentAmount || 0, sourceCurrency, currency);
        setTargetAmount(convertedTarget ? (Number.isInteger(convertedTarget) ? convertedTarget.toString() : convertedTarget.toFixed(2)) : '');
        setCurrentAmount(convertedCurrent ? (Number.isInteger(convertedCurrent) ? convertedCurrent.toString() : convertedCurrent.toFixed(2)) : '0');

        // Pre-focus target amount field if target is unset, else focus title if title is empty
        setTimeout(() => {
          if (!goal.targetAmount || goal.targetAmount <= 0) {
            targetInputRef.current?.focus();
          } else if (!goal.title) {
            titleInputRef.current?.focus();
          }
        }, 50);
      }
    }
  }, [goal, isOpen, initialMode, currency]);

  useEscapeKey(onClose, isOpen);

  if (!isOpen) return null;

  // Mode 1: Upgrade Mode (Free user tapped top + Add Goal)
  if (isUpgradeMode) {
    return (
      <div className="kova-modal fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="max-w-md w-full relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-[#8A8A8E] hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <PremiumUpgradeCard
            onUpgrade={() => {
              if (onUpgradePlan) onUpgradePlan();
              onClose();
            }}
          />
        </div>
      </div>
    );
  }

  // Mode 2 & 3: Edit Goal or Create Goal Form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetNum = parseFloat(targetAmount) || 0;
    const currentNum = parseFloat(currentAmount) || 0;

    if (!title.trim() || targetNum <= 0) return;

    const isAchieved = currentNum >= targetNum && targetNum > 0;

    const savedGoal: SavingsGoal = {
      id: isCreatingNew ? generateUniqueId('goal') : goal?.id || generateUniqueId('goal'),
      title: title.trim(),
      targetAmount: targetNum,
      currentAmount: Math.max(0, currentNum),
      status: isAchieved ? 'achieved' : 'active',
      isArchived: false,
      nativeCurrency: currency || 'USD',
      contributions: goal?.contributions,
    };

    onSaveGoal(savedGoal, isCreatingNew);
    onClose();
  };

  return (
    <div className="kova-modal kova-sheet fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="glass-card rounded-[28px] p-6 border border-white/20 bg-[#161618] max-w-sm w-full space-y-5 shadow-2xl relative sm:max-h-[90vh] sm:overflow-y-auto no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white border border-white/10">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                {isCreatingNew ? 'Create New Goal' : 'Edit Savings Goal'}
              </h3>
              <p className="text-[10px] text-[#8A8A8E]">
                {isCreatingNew
                  ? 'Track an additional savings target'
                  : 'Adjust your target, balance, or start fresh'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-[#8A8A8E] hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Goal Title */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-[#8A8A8E] uppercase tracking-wider block">
              Goal Name
            </label>
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Trip to Tokyo, Emergency Reserve"
              className="w-full bg-black/50 border border-white/15 rounded-2xl px-4 py-3 text-xs text-white placeholder-[#8A8A8E] focus:outline-none focus:border-white transition-all"
              required
            />
          </div>

          {/* Target Amount */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-[#8A8A8E] uppercase tracking-wider block">
              Target Amount ({currencySymbol})
            </label>
            <input
              ref={targetInputRef}
              type="number"
              step="any"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="e.g., 1500"
              className="w-full bg-black/50 border border-white/15 rounded-2xl px-4 py-3 text-xs text-white placeholder-[#8A8A8E] focus:outline-none focus:border-white transition-all font-mono"
              required
            />
          </div>

          {/* Current Saved Amount */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-[#8A8A8E] uppercase tracking-wider block">
              Current Saved Balance ({currencySymbol})
            </label>
            <input
              type="number"
              step="any"
              value={currentAmount}
              onChange={(e) => setCurrentAmount(e.target.value)}
              placeholder="e.g., 250"
              className="w-full bg-black/50 border border-white/15 rounded-2xl px-4 py-3 text-xs text-white placeholder-[#8A8A8E] focus:outline-none focus:border-white transition-all font-mono"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              className="w-full py-3 rounded-full bg-white text-black font-semibold text-xs hover:bg-white/90 transition-all flex items-center justify-center gap-1.5 shadow-lg active:scale-95 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{isCreatingNew ? 'Create Goal' : 'Save Changes'}</span>
            </button>

            {!isCreatingNew && (
              <button
                type="button"
                onClick={() => {
                  onArchiveGoal();
                  onClose();
                }}
                className="w-full py-2.5 rounded-full bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF6B6B] border border-[#FF3B30]/20 font-medium text-xs transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Archive Goal & Start Fresh</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

