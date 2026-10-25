import React, { useState } from 'react';
import { Wallet, Loader2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { paypalApi, modeLabel, usePayPalStatus } from '../utils/paypalClient';

// Optional PayPal connection. Kova works fully without it.
export const PayPalSettingsCard: React.FC = () => {
  const toast = useToast();
  const { loading, available, connected, mode, error, setConnected, setMode, refresh } = usePayPalStatus();
  const [busy, setBusy] = useState(false);

  const handleConnect = async () => {
    setBusy(true);
    try {
      const res = await paypalApi.connect();
      setConnected(!!res.connected);
      setMode(res.mode);
      toast.success('PayPal connected. Find the check-in in your chat.');
    } catch (e: any) {
      toast.error(e?.message || 'Could not connect PayPal. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await paypalApi.disconnect();
      setConnected(false);
      toast.info('PayPal disconnected. Kova no longer has access.');
    } catch (e: any) {
      toast.error(e?.message || 'Could not disconnect PayPal. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Invite-only demo (KOVA-084): accounts without access never see PayPal, not even while loading.
  if (!available) return null;

  return (
    <section className="glass-card rounded-[24px] p-5 border border-white/10 bg-[#161618] space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#8A8A8E] uppercase tracking-wider">
          <Wallet className="w-4 h-4 text-white/60" />
          <span>PayPal check-in</span>
        </div>
        <span className="text-[10px] text-[#8A8A8E]">Optional</span>
      </div>

      <p className="text-xs text-[#8A8A8E] leading-relaxed">
        Let Kova look at your recent PayPal activity and explain it kindly. Kova can point out
        charges and subscriptions worth a second look, and only acts when you confirm. You can
        disconnect at any time.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-[#8A8A8E]" role="status">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Checking PayPal connection...</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-[#FF6B6B]">{error}</span>
          <button
            type="button"
            onClick={refresh}
            className="px-3 py-1.5 rounded-full border border-white/15 text-xs text-white/80 hover:bg-white/10 transition-all"
          >
            Try again
          </button>
        </div>
      ) : connected ? (
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-white">Connected</span>
            <span className="text-[10px] text-[#8A8A8E]">{modeLabel(mode)}</span>
          </div>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={busy}
            className="px-3.5 py-2 rounded-full bg-black/40 hover:bg-white/10 border border-white/10 text-xs text-white font-medium transition-all disabled:opacity-50"
          >
            {busy ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-[10px] text-[#8A8A8E]">Not connected</span>
          <button
            type="button"
            onClick={handleConnect}
            disabled={busy}
            className="px-3.5 py-2 rounded-full bg-white text-black text-xs font-semibold hover:bg-white/90 active:scale-95 transition-all disabled:opacity-50"
          >
            {busy ? 'Connecting...' : 'Connect PayPal'}
          </button>
        </div>
      )}
    </section>
  );
};
