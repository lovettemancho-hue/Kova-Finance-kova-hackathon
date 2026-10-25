import React, { useState } from 'react';
import { Expense, ExpenseCategory } from '../types';
import { X, Plus, DollarSign } from 'lucide-react';
import { useExpenses } from '../context/ExpenseContext';
import { useModal } from '../context/ModalContext';
import { useAuth } from '../context/AuthContext';
import { getCurrencySymbol } from '../utils/currency';
import { useEscapeKey } from '../utils/useEscapeKey';

interface AddExpenseModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onAddExpense?: (expense: Omit<Expense, 'id'>) => void;
}

const CATEGORIES: ExpenseCategory[] = [
  'Shopping',
  'Car repair',
  'Grocery',
  'Gym',
  'Laundry',
  'Dining out',
  'Coffee',
  'Subscriptions',
  'Travel',
  'Housing',
  'Income',
  'Other',
];

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  onAddExpense,
}) => {
  const { isModalOpen, closeModal } = useModal();
  const isOpen = propIsOpen !== undefined ? propIsOpen : isModalOpen('add-expense');
  const onClose = propOnClose || closeModal;

  const { currency } = useAuth();
  const currencySymbol = getCurrencySymbol(currency);

  const { addExpense } = useExpenses();
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Grocery');
  const [type, setType] = useState<'outcome' | 'income'>('outcome');
  const [note, setNote] = useState('');

  useEscapeKey(onClose, isOpen);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!label.trim() || isNaN(parsedAmount) || parsedAmount <= 0) return;

    const payload = {
      label: label.trim(),
      amount: parsedAmount,
      category: type === 'income' ? 'Income' : category,
      type,
      timestamp: new Date().toISOString(),
      note: note.trim() || undefined,
      nativeCurrency: currency || 'USD',
    };

    if (onAddExpense) {
      onAddExpense(payload);
    } else {
      addExpense(payload);
    }

    setLabel('');
    setAmount('');
    setNote('');
    onClose();
  };

  return (
    <div className="kova-modal kova-sheet fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-card rounded-[28px] p-6 max-w-md w-full border border-white/15 bg-[#18181A]/95 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#2C2C2E]">
          <h3 className="text-base font-bold text-white tracking-tight">Log an Entry</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-[#8A8A8E] hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {/* Income vs Outcome Switch */}
          <div className="flex justify-center">
            <div className="bg-[#121214] p-1 rounded-full border border-white/10 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setType('outcome')}
                className={`px-5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  type === 'outcome' ? 'bg-white text-black shadow-md' : 'text-[#8A8A8E]'
                }`}
              >
                Outcome (Expense)
              </button>
              <button
                type="button"
                onClick={() => setType('income')}
                className={`px-5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  type === 'income' ? 'bg-white text-black shadow-md' : 'text-[#8A8A8E]'
                }`}
              >
                Income
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="text-[11px] font-medium text-[#8A8A8E] uppercase tracking-wider block mb-1">
              Amount ({currencySymbol})
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 text-base font-bold">
                {currencySymbol}
              </span>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#121214] border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-white text-lg font-bold placeholder-[#8A8A8E] focus:outline-none focus:border-white/30"
              />
            </div>
          </div>

          {/* Label / Description Input */}
          <div>
            <label className="text-[11px] font-medium text-[#8A8A8E] uppercase tracking-wider block mb-1">
              Description
            </label>
            <input
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Artisanal Coffee, Winter coat, Market..."
              className="w-full bg-[#121214] border border-white/10 rounded-2xl py-2.5 px-4 text-sm text-white placeholder-[#8A8A8E] focus:outline-none focus:border-white/30"
            />
          </div>

          {/* Category Dropdown (if outcome) */}
          {type === 'outcome' && (
            <div>
              <label className="text-[11px] font-medium text-[#8A8A8E] uppercase tracking-wider block mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full bg-[#121214] border border-white/10 rounded-2xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-white/30"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-[#18181A] text-white">
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Optional Note */}
          <div>
            <label className="text-[11px] font-medium text-[#8A8A8E] uppercase tracking-wider block mb-1">
              Optional Note for Kova
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Weekly routine purchase"
              className="w-full bg-[#121214] border border-white/10 rounded-2xl py-2 px-4 text-xs text-white placeholder-[#8A8A8E] focus:outline-none focus:border-white/30"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-medium text-[#8A8A8E] hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-white text-black font-semibold text-xs px-6 py-2.5 rounded-full hover:scale-105 transition-all shadow-lg flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Save Entry</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
