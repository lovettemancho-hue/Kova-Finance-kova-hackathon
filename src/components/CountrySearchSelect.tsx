import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X, Globe } from 'lucide-react';
import { SUPPORTED_COUNTRIES, CountryCurrencyOption, getCountryOption } from '../utils/currency';

interface CountrySearchSelectProps {
  value?: string; // Country name or code
  onChange: (country: CountryCurrencyOption) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
}

export const CountrySearchSelect: React.FC<CountrySearchSelectProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
  label,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find currently selected country
  const selectedOption = useMemo(() => {
    return getCountryOption(value) || SUPPORTED_COUNTRIES.find(c => c.countryCode === 'US') || SUPPORTED_COUNTRIES[0];
  }, [value]);

  // Filter countries by query (name, code, currency code, currency name)
  const filteredCountries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return SUPPORTED_COUNTRIES;
    return SUPPORTED_COUNTRIES.filter(
      (c) =>
        c.countryName.toLowerCase().includes(q) ||
        c.countryCode.toLowerCase().includes(q) ||
        c.currencyCode.toLowerCase().includes(q) ||
        c.currencyName.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (country: CountryCurrencyOption) => {
    onChange(country);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="text-[11px] font-semibold text-[#8A8A8E] uppercase tracking-wider block mb-1.5">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full bg-[#121214] border border-white/10 hover:border-white/25 rounded-2xl py-3 px-4 text-white text-sm flex items-center justify-between gap-2 transition-all cursor-pointer select-none focus:outline-none focus:border-white/40 disabled:opacity-50 disabled:cursor-not-allowed ${
          isOpen ? 'border-white/40 ring-2 ring-white/10' : ''
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xl shrink-0" role="img" aria-label={selectedOption.countryName}>
            {selectedOption.flag}
          </span>
          <span className="font-semibold text-white truncate text-left">
            {selectedOption.countryName}
          </span>
          <span className="text-[11px] font-mono text-[#8A8A8E] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full shrink-0">
            {selectedOption.currencyCode} ({selectedOption.symbol})
          </span>
        </div>

        <ChevronDown className={`w-4 h-4 text-[#8A8A8E] shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-white' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-2 bg-[#18181B] border border-white/15 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-80">
          {/* Search Box Header */}
          <div className="p-2.5 border-b border-white/10 bg-[#121214]/90 sticky top-0 z-10">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-[#8A8A8E] absolute left-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search country or currency (e.g. Fiji, JPY, Estonia)..."
                className="w-full bg-black/50 border border-white/10 rounded-xl py-2 pl-9 pr-8 text-xs text-white placeholder-[#8A8A8E] focus:outline-none focus:border-white/30"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 text-[#8A8A8E] hover:text-white p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between text-[10px] text-[#8A8A8E] px-1 pt-1.5 font-medium">
              <span>{filteredCountries.length} countries available</span>
              <span>All ISO 3166 & 4217</span>
            </div>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto flex-1 divide-y divide-white/5 no-scrollbar py-1">
            {filteredCountries.length > 0 ? (
              filteredCountries.map((country) => {
                const isSelected = selectedOption.countryCode === country.countryCode;
                return (
                  <button
                    key={`${country.countryCode}-${country.countryName}`}
                    type="button"
                    onClick={() => handleSelect(country)}
                    className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-white/10 text-white font-bold'
                        : 'text-white/90 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-lg shrink-0">{country.flag}</span>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-white">
                          {country.countryName}
                        </div>
                        <div className="text-[10px] text-[#8A8A8E] truncate">
                          {country.currencyName}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-[11px] text-white/80 bg-black/40 border border-white/10 px-1.5 py-0.5 rounded">
                        {country.currencyCode} · {country.symbol}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 stroke-[2.5]" />}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-8 px-4 text-center text-xs text-[#8A8A8E]">
                <Globe className="w-6 h-6 mx-auto mb-2 opacity-40 text-white" />
                <p className="font-medium text-white/70">No country found for "{searchQuery}"</p>
                <p className="text-[11px] mt-1 text-[#8A8A8E]">Try searching by country name or 3-letter currency code.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
