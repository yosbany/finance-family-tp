import { useEffect, useState } from 'react';
import {
  DEFAULT_EXCHANGE_RATES,
  getExchangeRates,
  saveExchangeRates,
} from '../../services/settings.service';
import { ExchangeRates } from '../../types';
import { convertCurrency, formatCurrency } from '../../utils/calculations';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useModal } from '../../hooks/useModal';

export const SettingsPage = () => {
  const { showSuccess, showError, ModalComponent } = useModal();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [usdToUyu, setUsdToUyu] = useState(String(DEFAULT_EXCHANGE_RATES.usdToUyu));
  const [uiToUyu, setUiToUyu] = useState(String(DEFAULT_EXCHANGE_RATES.uiToUyu));
  const [brlToUyu, setBrlToUyu] = useState(String(DEFAULT_EXCHANGE_RATES.brlToUyu));
  const [updatedAt, setUpdatedAt] = useState<number | undefined>();

  useEffect(() => {
    loadRates();
  }, []);

  const loadRates = async () => {
    try {
      setLoading(true);
      const rates = await getExchangeRates();
      setUsdToUyu(String(rates.usdToUyu));
      setUiToUyu(String(rates.uiToUyu));
      setBrlToUyu(String(rates.brlToUyu));
      setUpdatedAt(rates.updatedAt);
    } catch (error) {
      console.error(error);
      showError('No se pudieron cargar los tipos de cambio');
    } finally {
      setLoading(false);
    }
  };

  const parsePositive = (value: string): number | null => {
    const normalized = value.trim().replace(',', '.');
    const n = Number(normalized);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const usd = parsePositive(usdToUyu);
    const ui = parsePositive(uiToUyu);
    const brl = parsePositive(brlToUyu);
    if (usd === null || ui === null || brl === null) {
      showError('Ingresá valores mayores a 0 (podés usar coma o punto decimal)');
      return;
    }

    try {
      setSaving(true);
      const saved = await saveExchangeRates({ usdToUyu: usd, uiToUyu: ui, brlToUyu: brl });
      setUsdToUyu(String(saved.usdToUyu));
      setUiToUyu(String(saved.uiToUyu));
      setBrlToUyu(String(saved.brlToUyu));
      setUpdatedAt(saved.updatedAt);
      showSuccess('Tipos de cambio guardados');
    } catch (error) {
      console.error(error);
      showError(error instanceof Error ? error.message : 'No se pudieron guardar');
    } finally {
      setSaving(false);
    }
  };

  const previewRates: ExchangeRates = {
    usdToUyu: parsePositive(usdToUyu) ?? DEFAULT_EXCHANGE_RATES.usdToUyu,
    uiToUyu: parsePositive(uiToUyu) ?? DEFAULT_EXCHANGE_RATES.uiToUyu,
    brlToUyu: parsePositive(brlToUyu) ?? DEFAULT_EXCHANGE_RATES.brlToUyu,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="page-title">Configuración</h1>
        <p className="page-subtitle">
          Tipos de cambio globales para pasar todo a pesos en el sistema
        </p>
      </div>

      <form onSubmit={handleSave} className="card space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Tipos de cambio
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Se usan en dashboard, patrimonio, objetivos y al importar Prex (BRL → $U).
            Los saldos de cada cuenta siguen en su moneda original.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label" htmlFor="usdToUyu">
              1 USD = ¿cuántos $U?
            </label>
            <input
              id="usdToUyu"
              type="text"
              inputMode="decimal"
              value={usdToUyu}
              onChange={(e) => setUsdToUyu(e.target.value)}
              className="input-field"
              placeholder="40"
            />
          </div>
          <div>
            <label className="label" htmlFor="uiToUyu">
              1 UI = ¿cuántos $U?
            </label>
            <input
              id="uiToUyu"
              type="text"
              inputMode="decimal"
              value={uiToUyu}
              onChange={(e) => setUiToUyu(e.target.value)}
              className="input-field"
              placeholder="6,2"
            />
          </div>
          <div>
            <label className="label" htmlFor="brlToUyu">
              1 BRL = ¿cuántos $U?
            </label>
            <input
              id="brlToUyu"
              type="text"
              inputMode="decimal"
              value={brlToUyu}
              onChange={(e) => setBrlToUyu(e.target.value)}
              className="input-field"
              placeholder="7,5"
            />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <p className="font-medium text-gray-900 dark:text-white">Vista previa</p>
          <p>US$ 100 → {formatCurrency(convertCurrency(100, 'USD', 'UYU', previewRates), 'UYU')}</p>
          <p>100 UI → {formatCurrency(convertCurrency(100, 'UI', 'UYU', previewRates), 'UYU')}</p>
          <p>R$ 100 → {formatCurrency(convertCurrency(100, 'BRL', 'UYU', previewRates), 'UYU')}</p>
        </div>

        {updatedAt && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Última actualización: {new Date(updatedAt).toLocaleString('es-UY')}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar tipos de cambio'}
          </button>
        </div>
      </form>

      {ModalComponent && <ModalComponent />}
    </div>
  );
};
