import React, { useState } from 'react';
import { Check, ChevronDown, Lock, Palette } from 'lucide-react';
import { THEMES, chooseTheme, themeOption, useTheme, type ThemeOption } from '../lib/theme';
import { updateUserAppearance } from '../lib/userService';
import { auth } from '../lib/firebase';

interface AppearanceSettingsProps {
  isPremium: boolean;
  /** A free user tapped a Premium theme: open the Premium card. */
  onLocked: (theme: ThemeOption) => void;
  onChanged?: (theme: ThemeOption) => void;
}

/**
 * Settings → Appearance. A list of themes, each previewed in its own colours (the preview element
 * carries data-theme, so it renders with that theme's palette from index.css). Not a toggle.
 * Collapsed by default: one line with the current theme, opened on tap.
 */
export const AppearanceSettings: React.FC<AppearanceSettingsProps> = ({ isPremium, onLocked, onChanged }) => {
  const { chosen, effective } = useTheme();
  const [open, setOpen] = useState(false);

  const pick = (theme: ThemeOption) => {
    if (theme.premium && !isPremium) {
      onLocked(theme);
      return;
    }
    if (theme.id === effective) return;
    chooseTheme(theme.id);
    const uid = auth.currentUser?.uid;
    if (uid) void updateUserAppearance(uid, theme.id);
    onChanged?.(theme);
  };

  const groups: Array<{ label: string; items: ThemeOption[] }> = [
    { label: 'Included', items: THEMES.filter((t) => !t.premium) },
    { label: 'Premium themes', items: THEMES.filter((t) => t.premium) },
  ];

  return (
    <section
      className="glass-card rounded-[24px] p-5 border border-white/10 bg-kova-surface space-y-4"
      aria-labelledby="appearance-heading"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="appearance-themes"
        className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
      >
        <div id="appearance-heading" className="flex items-center gap-2 text-xs font-semibold text-kova-muted uppercase tracking-wider">
          <Palette className="w-4 h-4 text-white/60" />
          <span>Appearance</span>
        </div>
        <span className="flex items-center gap-2 text-[11px] text-kova-muted">
          <span className="text-white/80">{themeOption(effective).name}</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
      <div id="appearance-themes" className="space-y-4">
      <p className="text-xs text-kova-muted">Choose how Kova looks on this device and anywhere you sign in. Saved to your account.</p>

      {chosen !== effective && (
        <p className="text-[11px] text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-xl px-3 py-2">
          Your Premium theme comes back as soon as Premium is active again.
        </p>
      )}

      {groups.map((group) => (
        <div key={group.label} className="space-y-2">
          <div className="text-[11px] font-semibold text-kova-muted">{group.label}</div>
          <div role="radiogroup" aria-label={group.label} className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {group.items.map((theme) => {
              const selected = theme.id === effective;
              const locked = theme.premium && !isPremium;
              return (
                <button
                  key={theme.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${theme.name}${locked ? ', Premium' : ''}`}
                  onClick={() => pick(theme)}
                  className={`group rounded-2xl p-1 text-left transition-all cursor-pointer border ${
                    selected ? 'border-white ring-1 ring-white/40' : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  {/* Preview, drawn in the theme's own palette */}
                  <div data-theme={theme.id} className="kova-theme-preview rounded-xl p-2.5 space-y-2 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="w-2 h-2 rounded-full bg-kova-green" />
                        <span className="w-2 h-2 rounded-full bg-white/30" />
                      </div>
                      {selected ? (
                        <span className="w-4 h-4 rounded-full bg-white text-black flex items-center justify-center">
                          <Check className="w-2.5 h-2.5" />
                        </span>
                      ) : locked ? (
                        <Lock className="w-3 h-3 text-amber-400" />
                      ) : null}
                    </div>
                    <div className="rounded-lg bg-kova-surface border border-white/10 p-2 space-y-1">
                      <div className="h-1.5 w-3/4 rounded-full bg-white/80" />
                      <div className="h-1.5 w-1/2 rounded-full bg-kova-muted/70" />
                    </div>
                    <div className="flex justify-end">
                      <div className="h-3 w-10 rounded-full bg-white" />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-white leading-tight">{theme.name}</div>
                      <div className="text-[9.5px] text-kova-muted leading-snug">{theme.description}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      </div>
      )}
    </section>
  );
};
