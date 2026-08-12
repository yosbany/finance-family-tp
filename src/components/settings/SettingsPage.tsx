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
    if (usd === null || ui === null) {
      showError('Ingresá valores mayores a 0 (podés usar coma o punto decimal)');
      return;
    }

    try {
      setSaving(true);
      const saved = await saveExchangeRates({ usdToUyu: usd, uiToUyu: ui });
      setUsdToUyu(String(saved.usdToUyu));
      setUiToUyu(String(saved.uiToUyu));
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
            Se usan en dashboard, patrimonio neto y objetivos al convertir USD o UI a pesos.
            Los saldos de cada cuenta siguen en su moneda original.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <p className="font-medium text-gray-900 dark:text-white">Vista previa</p>
          <p>US$ 100 → {formatCurrency(convertCurrency(100, 'USD', 'UYU', previewRates), 'UYU')}</p>
          <p>$U 1.000 → {formatCurrency(convertCurrency(1000, 'UYU', 'USD', previewRates), 'USD')}</p>
          <p>100 UI → {formatCurrency(convertCurrency(100, 'UI', 'UYU', previewRates), 'UYU')}</p>
          <p>$U 1.000 → {formatCurrency(convertCurrency(1000, 'UYU', 'UI', previewRates), 'UI')}</p>
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
