import { ref, get, set } from 'firebase/database';
import { database } from './firebase';
import { familyPath } from './familyPaths';
import { ExchangeRates } from '../types';

export const DEFAULT_EXCHANGE_RATES: ExchangeRates = {
  usdToUyu: 40,
  uiToUyu: 6.2,
};

export const getExchangeRates = async (): Promise<ExchangeRates> => {
  try {
    const ratesRef = ref(database, familyPath('settings', 'exchangeRates'));
    const snapshot = await get(ratesRef);

    if (!snapshot.exists()) {
      return { ...DEFAULT_EXCHANGE_RATES };
    }

    const data = snapshot.val() as Partial<ExchangeRates>;
    return {
      usdToUyu: Number.isFinite(data.usdToUyu) && data.usdToUyu! > 0
        ? Number(data.usdToUyu)
        : DEFAULT_EXCHANGE_RATES.usdToUyu,
      uiToUyu: Number.isFinite(data.uiToUyu) && data.uiToUyu! > 0
        ? Number(data.uiToUyu)
        : DEFAULT_EXCHANGE_RATES.uiToUyu,
      updatedAt: data.updatedAt,
    };
  } catch (error) {
    console.error('Error al obtener tipos de cambio:', error);
    return { ...DEFAULT_EXCHANGE_RATES };
  }
};

export const saveExchangeRates = async (
  rates: Pick<ExchangeRates, 'usdToUyu' | 'uiToUyu'>
): Promise<ExchangeRates> => {
  if (!Number.isFinite(rates.usdToUyu) || rates.usdToUyu <= 0) {
    throw new Error('El tipo de cambio USD → UYU debe ser un número mayor a 0');
  }
  if (!Number.isFinite(rates.uiToUyu) || rates.uiToUyu <= 0) {
    throw new Error('El tipo de cambio UI → UYU debe ser un número mayor a 0');
  }

  const payload: ExchangeRates = {
    usdToUyu: Math.round(rates.usdToUyu * 10000) / 10000,
    uiToUyu: Math.round(rates.uiToUyu * 10000) / 10000,
    updatedAt: Date.now(),
  };

  const ratesRef = ref(database, familyPath('settings', 'exchangeRates'));
  await set(ratesRef, payload);
  return payload;
};
