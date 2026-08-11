import bhuDownloadIcon from '../assets/bank-guides/bhu-download-icon.png';

export interface BankDownloadGuide {
  bank: string;
  formats: string[];
  steps: string[];
  tips?: string[];
  /** Optional image shown under the steps (e.g. bank UI icon). */
  visualHint?: {
    src: string;
    alt: string;
    caption: string;
  };
}

export const bankDownloadGuides: Record<string, BankDownloadGuide> = {
  BROU:
  {
    bank: 'BROU',
    formats: ['CSV', 'PDF'],
    steps: [
      'Entrá a e-BROU (banca online) e iniciá sesión.',
      'Andá a Cuentas y elegí la cuenta (pesos o dólares).',
      'Abrí Movimientos o Extracto / Consulta de movimientos.',
      'Elegí el período del mes que querés cargar.',
      'Descargá en CSV (recomendado) o PDF.',
      'Subí ese archivo acá eligiendo BROU → Débito.',
    ],
    tips: [
      'Si el CSV falla, probá el PDF del mismo período.',
      'No edites el archivo antes de subirlo.',
    ],
  },
  'Itaú': {
    bank: 'Itaú',
    formats: ['Excel', 'CSV'],
    steps: [
      'Entrá a Itaú App o Banca Online e iniciá sesión.',
      'Seleccioná la cuenta o tarjeta Visa.',
      'Andá a Movimientos / Extracto.',
      'Filtrá por el mes del extracto.',
      'Usá Descargar / Exportar en Excel (.xlsx) o CSV.',
      'Subí el archivo acá eligiendo Itaú y el tipo (Débito o Crédito).',
    ],
    tips: [
      'Para Visa, elegí tipo Crédito en el asistente.',
      'El Excel de Itaú suele venir con varias filas de encabezado: la app las detecta sola.',
    ],
  },
  Santander: {
    bank: 'Santander',
    formats: ['Excel', 'CSV'],
    steps: [
      'Entrá a SuperNet / App Santander Uruguay e iniciá sesión.',
      'Para cuenta: Cuentas → elegí la cuenta → Movimientos.',
      'Para tarjeta: Tarjetas → elegí Visa → Movimientos / Estado de cuenta.',
      'Seleccioná el período (mes) a exportar.',
      'Descargá en Excel (.xlsx) o CSV.',
      'Subí el archivo acá: Santander → Débito o Crédito según corresponda.',
    ],
    tips: [
      'En cuenta, el Excel suele tener columnas Fecha, Descripción, Débito, Crédito, Saldo.',
      'En tarjeta, buscá columnas Fecha, Detalle, Importe $ / Importe U$S.',
      'No abras y “guardá como” en otro formato si no hace falta: puede romper columnas.',
    ],
  },
  OCA: {
    bank: 'OCA',
    formats: ['PDF', 'Excel', 'CSV'],
    steps: [
      'Entrá a OCA Online / App e iniciá sesión.',
      'Andá a Tarjetas y elegí Visa o Mastercard.',
      'Abrí Estado de cuenta o Movimientos del mes.',
      'Descargá el extracto en PDF (lo más habitual) o Excel/CSV si está disponible.',
      'Subí el archivo acá eligiendo OCA → Crédito.',
    ],
    tips: [
      'Si el PDF es escaneado (imagen), puede no parsearse: preferí PDF con texto o Excel.',
    ],
  },
  Prex: {
    bank: 'Prex',
    formats: ['Excel', 'CSV'],
    steps: [
      'Entrá a la App Prex o web e iniciá sesión.',
      'Elegí la tarjeta/cuenta en pesos o dólares.',
      'Andá a Movimientos.',
      'Exportá o descargá el historial del período (Excel/CSV).',
      'Subí el archivo acá: Prex → Débito.',
    ],
    tips: [
      'Cargá por separado pesos y dólares si vienen en archivos distintos.',
    ],
  },
  BHU: {
    bank: 'BHU',
    formats: ['PDF'],
    steps: [
      'Entrá a https://bhu.com.uy/',
      'Hacé clic en “Consulta de cuentas de ahorro”.',
      'Hacé clic en “Acceso a la consulta de cuentas de ahorro”.',
      'Iniciá sesión con tu usuario gub.uy (ID Uruguay).',
      'Andá a la sección “Estado de Cuenta”.',
      'Descargá el PDF con el ícono de descarga (flecha hacia abajo sobre una bandeja).',
      'Subí ese PDF acá: BHU → Débito.',
    ],
    tips: [
      'Usá solo el PDF del estado de cuenta (texto), no una captura o escaneo.',
      'Algunos extractos BHU usan UI (Unidades Indexadas); la app intenta interpretarlos.',
    ],
    visualHint: {
      src: bhuDownloadIcon,
      alt: 'Ícono de descarga del BHU',
      caption: 'Ícono para descargar el PDF en Estado de Cuenta',
    },
  },
  IBM: {
    bank: 'IBM',
    formats: ['Excel'],
    steps: [
      'Entrá al portal del plan de acciones IBM (ESPP / broker del plan).',
      'Abrí Portfolio / Holdings o Transaction History / Details.',
      'Exportá el detalle de cartera a Excel.',
      'Subí el archivo acá: IBM → Inversión.',
    ],
    tips: [
      'Usá el reporte de detalles de cartera (compras y valores), no un resumen PDF escaneado.',
    ],
  },
};

export const getBankDownloadGuide = (bank: string): BankDownloadGuide | null =>
  bankDownloadGuides[bank] || null;
