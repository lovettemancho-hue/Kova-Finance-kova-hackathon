import React, { useState } from 'react';
import { Expense, ExpenseCategory, UserProfile } from '../types';
import { X, FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, Trash2, ArrowLeft, Sparkles } from 'lucide-react';
import { PremiumUpgradeCard } from './PremiumUpgradeCard';
import { useAuth } from '../context/AuthContext';
import { useExpenses } from '../context/ExpenseContext';
import { useModal } from '../context/ModalContext';
import { getCurrencySymbol, formatCurrency } from '../utils/currency';
import { readStatement, insightLine } from '../lib/statementImport';
import { generateUniqueId } from '../utils/id';
import { fetchWithAuth } from '../utils/apiClient';
import { useEscapeKey } from '../utils/useEscapeKey';

interface CsvImportModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onImportExpenses?: (newExpenses: Expense[], info?: ImportInfo) => void;
  userProfile?: UserProfile | null;
  onUpgrade?: () => void;
}

/** What the import found, for Kova's message after it (KOVA-081). */
export interface ImportInfo {
  source: 'paypal' | 'bank' | 'ai';
  insight: string;
}

export interface ParsedCsvRow {
  id: string;
  rawDate: string;
  label: string;
  amount: number | string | null;
  category: string;
  type: 'outcome' | 'income';
  timestamp: string;
  hasError: boolean;
  errorMsg?: string;
  included: boolean;
  currency?: string;
  duplicate?: boolean;
}

const CATEGORIES = [
  'Shopping',
  'Grocery',
  'Coffee',
  'Dining out',
  'Subscriptions',
  'Travel',
  'Housing',
  'Car repair',
  'Gym',
  'Laundry',
  'Income',
  'Other',
];

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  onImportExpenses,
  userProfile: propUserProfile,
  onUpgrade: propOnUpgrade,
}) => {
  const { isModalOpen, closeModal } = useModal();
  const isOpen = propIsOpen !== undefined ? propIsOpen : isModalOpen('csv-import');
  const onClose = propOnClose || closeModal;

  const { userProfile: authUserProfile, updatePlan, currency: authCurrency, plan, planLimits, usage, noteUsage } = useAuth();
  const { bulkAddExpenses, expenses } = useExpenses();
  const userProfile = propUserProfile !== undefined ? propUserProfile : authUserProfile;
  const currency = userProfile?.currency || authCurrency || 'USD';
  const currencySymbol = getCurrencySymbol(currency);
  const onUpgrade = propOnUpgrade || (() => updatePlan('premium'));

  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedCsvRow[]>([]);
  const [importInfo, setImportInfo] = useState<(ImportInfo & { warnings: string[]; onPhone: boolean }) | null>(null);

  useEscapeKey(onClose, isOpen);

  if (!isOpen) return null;

  // Gate from the server's numbers (KOVA-078): Free has 1 import a month, Premium 5.
  const importLimit = planLimits[plan === 'premium' ? 'premium' : 'free'].quotas.csvImport;
  const importUsage = usage?.csvImport;
  const importUsageCurrent = importUsage && !(Date.now() >= Date.parse(importUsage.resetsAt));
  const importsLeft = importUsageCurrent ? Math.max(0, importLimit - importUsage!.used) : importLimit;
  const showUpgrade = plan !== 'premium' && (importLimit === 0 || importsLeft === 0) && step === 'upload';

  if (showUpgrade) {
    return (
      <div className="kova-modal fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
        <div className="max-w-md w-full relative">
          <button
            onClick={onClose}
            type="button"
            className="absolute -top-3 -right-3 z-20 w-9 h-9 rounded-full bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white flex items-center justify-center border border-white/20 shadow-xl transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="space-y-3">
            <div className="glass-card rounded-2xl p-3 bg-amber-500/10 border border-amber-500/20 text-center text-xs text-amber-300 font-medium flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
              <span>
                {importLimit === 0
                  ? 'Statement import is part of Kova Premium.'
                  : `You've used this month's free statement import. Premium imports up to ${planLimits.premium.quotas.csvImport} a month.`}
              </span>
            </div>
            <PremiumUpgradeCard
              onUpgrade={() => {
                if (onUpgrade) onUpgrade();
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  const sampleCsvWithMessyRow = `Date, Description, Amount
2026-03-01, Trader Joe's Market, 45.00
2026-03-03, Equinox Gym Membership, 125.00
2026-03-04, Uber Trip to Airport, 38.50
2026-03-05, Blue Bottle Coffee, 14.50
03/06/2026, Subscription Service, 
2026-03-07, General Vendor #1042, 82.30`;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvText((event.target?.result as string) || '');
      };
      reader.readAsText(file);
    }
  };

  // Reads the statement on the phone first (KOVA-081). Only merchant names Kova couldn't sort go to
  // the server. Files the phone can't read fall back to the old server parse (small files only).
  const readOnPhone = async (): Promise<boolean> => {
    const result = readStatement(csvText, { defaultCurrency: currency, existing: expenses });
    if (!result.ok) return false;

    const unknown = Array.from(new Set(result.rows.filter((r) => r.type === 'outcome' && r.category === 'Other').map((r) => r.label))).slice(0, 120);
    const res = await fetchWithAuth('/api/import/categorize', {
      method: 'POST',
      body: JSON.stringify({ merchants: unknown }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setParseError(data?.error || "Couldn't finish the import right now. Please try again.");
      return true; // handled (e.g. the monthly limit), don't fall back
    }
    if (data.usage) noteUsage('csvImport', data.usage);
    const aiCategories: Record<string, string> = data.categories || {};

    setParsedRows(
      result.rows.map((r) => ({
        id: r.id,
        rawDate: r.date.slice(0, 10),
        label: r.label,
        amount: r.amount,
        category: r.category === 'Other' && aiCategories[r.label] ? aiCategories[r.label] : r.category,
        type: r.type,
        timestamp: r.date,
        hasError: false,
        errorMsg: '',
        included: !r.duplicate,
        currency: r.currency,
        duplicate: r.duplicate,
      }))
    );
    const money = (n: number, c: string) => formatCurrency(n, c, c);
    setImportInfo({ source: result.source, insight: insightLine(result.analysis, money, result.unfamiliar), warnings: result.warnings, onPhone: true });
    setStep('review');
    return true;
  };

  const handleParse = async () => {
    if (!csvText.trim()) return;
    setIsLoading(true);
    setParseError(null);
    setImportInfo(null);

    try {
      if (await readOnPhone()) return;
      if (csvText.length > 90_000) {
        setParseError("Kova couldn't read this file's layout. Try exporting it as CSV with Date, Description and Amount columns, or a shorter date range.");
        return;
      }
      const res = await fetchWithAuth('/api/parse-csv', {
        method: 'POST',
        body: JSON.stringify({ csvContent: csvText }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Premium-only (403), monthly limit (429) or too large (413): say so instead of doing nothing.
        setParseError(
          data?.error ||
            (res.status === 413
              ? 'That file is too large to import in one go. Try a shorter date range.'
              : "Couldn't read that file right now. Please try again.")
        );
        return;
      }
      if (data.usage) noteUsage('csvImport', data.usage);
      if (data.expenses && Array.isArray(data.expenses)) {
        const rows: ParsedCsvRow[] = data.expenses.map((e: any, index: number) => ({
          id: e.id || generateUniqueId('row'),
          rawDate: e.rawDate || e.timestamp || '',
          label: e.label || 'Imported Transaction',
          amount: e.amount !== undefined && e.amount !== null && !isNaN(e.amount) ? parseFloat(e.amount) : '',
          category: e.category || 'Other',
          type: e.type === 'income' ? 'income' : 'outcome',
          timestamp: e.timestamp || '',
          hasError: Boolean(e.hasError || e.amount === null || e.amount === '' || isNaN(parseFloat(e.amount))),
          errorMsg: e.errorMsg || (e.amount === null || e.amount === '' ? 'Missing amount' : ''),
          included: e.included !== undefined ? Boolean(e.included) : !Boolean(e.hasError || e.amount === null || e.amount === ''),
        }));

        setParsedRows(rows);
        setImportInfo({ source: 'ai', insight: '', warnings: [], onPhone: false });
        setStep('review');
      }
    } catch (err) {
      console.error('Failed to parse CSV', err);
      setParseError("Couldn't reach Kova. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowChange = (id: string, field: keyof ParsedCsvRow, value: any) => {
    setParsedRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };

        // Re-evaluate error state if amount or date changes
        if (field === 'amount' || field === 'label' || field === 'rawDate') {
          const numVal = parseFloat(String(updated.amount));
          const hasAmount = !isNaN(numVal) && numVal > 0;
          const hasDesc = Boolean(updated.label && updated.label.trim().length > 0);

          if (hasAmount && hasDesc) {
            updated.hasError = false;
            updated.errorMsg = '';
            updated.included = true;
          } else {
            updated.hasError = true;
            if (!hasAmount) updated.errorMsg = 'Missing or invalid amount';
            else if (!hasDesc) updated.errorMsg = 'Missing description';
          }
        }
        return updated;
      })
    );
  };

  const handleRemoveRow = (id: string) => {
    setParsedRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleToggleAll = (include: boolean) => {
    setParsedRows((prev) =>
      prev.map((r) => ({
        ...r,
        included: include ? !r.hasError : false,
      }))
    );
  };

  const handleConfirmAndAdd = () => {
    const includedRows = parsedRows.filter((r) => r.included);
    if (includedRows.length === 0) return;

    const finalExpenses: Expense[] = includedRows.map((r, index) => {
      let finalIsoTimestamp = r.timestamp;

      // Try parsing date string if timestamp is missing or not ISO
      if (!finalIsoTimestamp || isNaN(new Date(finalIsoTimestamp).getTime())) {
        if (r.rawDate) {
          const parsed = new Date(r.rawDate);
          if (!isNaN(parsed.getTime())) {
            finalIsoTimestamp = parsed.toISOString();
          } else {
            finalIsoTimestamp = new Date().toISOString();
          }
        } else {
          finalIsoTimestamp = new Date().toISOString();
        }
      }

      const parsedNum = parseFloat(String(r.amount)) || 0;

      return {
        id: generateUniqueId('imp'),
        label: r.label.trim() || 'Imported Expense',
        category: (r.category || 'Other') as ExpenseCategory,
        amount: Math.abs(parsedNum),
        type: r.type,
        timestamp: finalIsoTimestamp,
        // The statement's currency (e.g. XAF), so totals convert correctly. Was missing before KOVA-081.
        nativeCurrency: r.currency || currency,
      };
    });

    if (onImportExpenses) {
      onImportExpenses(finalExpenses, importInfo ? { source: importInfo.source, insight: importInfo.insight } : undefined);
    } else {
      bulkAddExpenses(finalExpenses);
    }
    handleResetAndClose();
  };

  const handleResetAndClose = () => {
    setStep('upload');
    setCsvText('');
    setFileName(null);
    setParsedRows([]);
    setParseError(null);
    setImportInfo(null);
    onClose();
  };

  const includedCount = parsedRows.filter((r) => r.included).length;
  const malformedCount = parsedRows.filter((r) => r.hasError).length;

  return (
    <div className="kova-modal kova-sheet fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="glass-card rounded-[28px] p-5 sm:p-6 max-w-xl w-full border border-white/15 bg-[#18181A]/95 shadow-2xl relative my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#2C2C2E]">
          <div className="flex items-center gap-2.5">
            {step === 'review' && (
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <FileSpreadsheet className="w-5 h-5 text-amber-300" />
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {step === 'upload' ? 'Import a statement' : 'Review transactions'}
              </h3>
              <p className="text-[11px] text-[#8A8A8E]">
                {step === 'upload'
                  ? 'PayPal, bank or mobile-wallet CSV'
                  : `${parsedRows.length} transactions found · ${malformedCount > 0 ? `${malformedCount} flagged for review` : 'All rows valid'}`}
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-[#8A8A8E] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP 1: UPLOAD SCREEN */}
        {step === 'upload' && (
          <div className="space-y-4 pt-4">
            <p className="text-xs text-[#8A8A8E] leading-relaxed">
              Upload a CSV from PayPal, your bank or a mobile wallet. Kova reads it on your phone: dates, names and amounts in any common format. Only names it can't sort are sent to suggest a category.
            </p>
            {plan !== 'premium' && importsLeft > 0 && (
              <p className="text-[11px] text-amber-200/80">
                Free plan: {importsLeft} statement import left this month. Logging by hand or in chat is always free.
              </p>
            )}

            {/* File Upload Drag & Drop Zone */}
            <div className="border border-dashed border-white/20 rounded-2xl p-5 text-center hover:bg-white/5 transition-all cursor-pointer relative bg-[#121214]/60">
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Upload className="w-6 h-6 text-amber-300/90 mx-auto mb-1.5" />
              <span className="text-xs font-semibold text-white block">
                {fileName ? fileName : 'Click to select .CSV file'}
              </span>
              <span className="text-[10px] text-[#8A8A8E] block mt-0.5">
                or drag and drop your bank export here
              </span>
            </div>

            {/* Textarea Paste Option */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[11px] font-medium text-[#8A8A8E] uppercase tracking-wider">
                  Or Paste Statement Lines
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setCsvText(sampleCsvWithMessyRow);
                    setFileName('sample_statement.csv');
                  }}
                  className="text-[11px] text-amber-300 hover:text-amber-200 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Insert Sample CSV</span>
                </button>
              </div>
              <textarea
                rows={5}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="Date, Description, Amount..."
                className="w-full bg-[#121214] border border-white/10 rounded-2xl p-3 text-xs text-white placeholder-[#8A8A8E] font-mono focus:outline-none focus:border-white/30"
              />
            </div>

            {parseError && (
              <p role="alert" className="text-xs text-amber-200/90 bg-amber-400/10 border border-amber-400/20 rounded-2xl px-3 py-2 leading-relaxed">
                {parseError}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2C2C2E]">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="px-4 py-2 rounded-full text-xs font-medium text-[#8A8A8E] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleParse}
                disabled={!csvText.trim() || isLoading}
                className="bg-white text-black font-semibold text-xs px-6 py-2.5 rounded-full hover:scale-105 transition-all shadow-lg disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {isLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Reading...</span>
                  </>
                ) : (
                  <span>Read & review</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: REVIEW SCREEN */}
        {step === 'review' && (
          <div className="space-y-4 pt-3">
            {importInfo && (importInfo.insight || importInfo.warnings.length > 0 || importInfo.onPhone) && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-1.5">
                {importInfo.insight && (
                  <p className="text-xs text-white leading-relaxed">
                    <Sparkles className="w-3.5 h-3.5 inline -mt-0.5 mr-1 text-amber-300" />
                    Kova noticed {importInfo.insight}.
                  </p>
                )}
                {importInfo.warnings.map((w) => (
                  <p key={w} className="text-[11px] text-amber-200/90 leading-relaxed">{w}</p>
                ))}
                {importInfo.onPhone && (
                  <p className="text-[10px] text-[#8A8A8E]">
                    Read on your {importInfo.source === 'paypal' ? 'phone as a PayPal statement' : 'phone'}. Rows already in your log are unticked.
                  </p>
                )}
              </div>
            )}
            {/* Top Toolbar */}
            <div className="flex items-center justify-between text-xs bg-white/5 p-2.5 rounded-2xl border border-white/10">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">
                  {includedCount} of {parsedRows.length} selected
                </span>
                {malformedCount > 0 && (
                  <span className="text-[10px] text-amber-300 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-300" />
                    {malformedCount} flagged
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleAll(true)}
                  className="text-[11px] text-amber-300 hover:underline font-medium cursor-pointer"
                >
                  Select Valid
                </button>
                <span className="text-white/20">|</span>
                <button
                  type="button"
                  onClick={() => handleToggleAll(false)}
                  className="text-[11px] text-[#8A8A8E] hover:text-white hover:underline cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* List of Parsed Rows */}
            <div className="max-h-[360px] overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
              {parsedRows.map((row, idx) => (
                <div
                  key={row.id}
                  className={`p-3 rounded-2xl border transition-all ${
                    row.hasError
                      ? 'border-amber-400/40 bg-amber-500/10'
                      : row.included
                      ? 'border-white/15 bg-[#121214]'
                      : 'border-white/5 bg-[#121214]/40 opacity-60'
                  }`}
                >
                  {/* Row Top Bar: Checkbox, Index, Error badge, Delete */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={row.included}
                        onChange={(e) => handleRowChange(row.id, 'included', e.target.checked)}
                        className="w-4 h-4 rounded border-white/20 bg-black/40 text-amber-400 focus:ring-0 cursor-pointer shrink-0"
                      />
                      <span className="text-[10px] font-mono text-[#8A8A8E]">#{idx + 1}</span>

                      {row.duplicate && !row.hasError && (
                        <span className="text-[10px] text-[#8A8A8E] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full shrink-0">
                          Already in your log
                        </span>
                      )}
                      {row.hasError && (
                        <span className="text-[10px] text-amber-300 bg-amber-400/20 border border-amber-400/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0 font-medium">
                          <AlertTriangle className="w-3 h-3 text-amber-300" />
                          <span>{row.errorMsg || 'Action needed'}</span>
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveRow(row.id)}
                      className="text-[#8A8A8E] hover:text-red-400 p-1 rounded-lg transition-colors cursor-pointer"
                      title="Remove row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Inputs Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {/* Description */}
                    <div>
                      <label className="text-[10px] text-[#8A8A8E] block mb-0.5">Description</label>
                      <input
                        type="text"
                        value={row.label}
                        onChange={(e) => handleRowChange(row.id, 'label', e.target.value)}
                        placeholder="Merchant name..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400/50"
                      />
                    </div>

                    {/* Amount */}
                    <div>
                      <label className="text-[10px] text-[#8A8A8E] block mb-0.5">Amount ({currencySymbol})</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1.5 text-xs text-[#8A8A8E]">{currencySymbol}</span>
                        <input
                          type="number"
                          step="0.01"
                          value={row.amount}
                          onChange={(e) => handleRowChange(row.id, 'amount', e.target.value)}
                          placeholder="0.00"
                          className={`w-full bg-black/40 border rounded-xl pl-6 pr-2.5 py-1.5 text-white focus:outline-none ${
                            row.hasError && (!row.amount || parseFloat(String(row.amount)) === 0)
                              ? 'border-amber-400/80 bg-amber-400/10'
                              : 'border-white/10 focus:border-amber-400/50'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Date */}
                    <div>
                      <label className="text-[10px] text-[#8A8A8E] block mb-0.5">Date</label>
                      <input
                        type="text"
                        value={row.rawDate}
                        onChange={(e) => handleRowChange(row.id, 'rawDate', e.target.value)}
                        placeholder="YYYY-MM-DD"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400/50 font-mono text-[11px]"
                      />
                    </div>

                    {/* Category & Type */}
                    <div className="flex gap-1.5 items-end">
                      <div className="flex-1 min-w-0">
                        <label className="text-[10px] text-[#8A8A8E] block mb-0.5">Category</label>
                        <select
                          value={row.category}
                          onChange={(e) => handleRowChange(row.id, 'category', e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-2 py-1.5 text-white focus:outline-none focus:border-amber-400/50 text-xs"
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat} className="bg-[#1C1C1E] text-white">
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            handleRowChange(row.id, 'type', row.type === 'income' ? 'outcome' : 'income')
                          }
                          className={`px-2.5 py-1.5 rounded-xl text-[10px] font-semibold transition-colors ${
                            row.type === 'income'
                              ? 'bg-[#30D158]/20 text-[#30D158] border border-[#30D158]/30'
                              : 'bg-white/10 text-white border border-white/10'
                          }`}
                        >
                          {row.type === 'income' ? 'Income' : 'Expense'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Confirm Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-[#2C2C2E]">
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="text-xs text-[#8A8A8E] hover:text-white transition-colors cursor-pointer"
              >
                ← Back to Upload
              </button>

              <button
                type="button"
                onClick={handleConfirmAndAdd}
                disabled={includedCount === 0}
                className="bg-white text-black font-semibold text-xs px-6 py-2.5 rounded-full hover:scale-105 transition-all shadow-lg disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4 text-black" />
                <span>Confirm & Add {includedCount} {includedCount === 1 ? 'Expense' : 'Expenses'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
