import { useState, useRef } from 'react';
import { useModal } from '../../hooks/useModal';

interface ExtractedData {
  amount: number;
  merchant: string;
  date: string;
  category: string;
  items: string[];
  confidence: number;
}

export const ReceiptOCR = ({
  onExtract,
}: {
  onExtract?: (data: ExtractedData) => void;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const { showInfo, showError, ModalComponent } = useModal();

  const handleFileSelect = async (file: File) => {
    // Crear preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Simular OCR extraction
    setExtracting(true);
    try {
      // En producción, esto usaría Google Vision API o similar
      // Por ahora, simulamos con patrones básicos

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Simulación de datos extraídos
      const simulated: ExtractedData = {
        amount: Math.round(Math.random() * 1000 * 100) / 100,
        merchant: 'Tienda Simulada',
        date: new Date().toISOString().split('T')[0],
        category: 'Otros',
        items: ['Artículo 1', 'Artículo 2', 'Artículo 3'],
        confidence: 0.85,
      };

      setExtracted(simulated);
      showInfo('✅ Recibo procesado correctamente');

      if (onExtract) {
        onExtract(simulated);
      }
    } catch (error) {
      console.error('Error extracting receipt:', error);
      showError('Error al procesar el recibo');
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        📸 Cargar Recibo
      </h3>

      {!preview ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="text-4xl mb-2">📷</div>
          <p className="text-gray-600 dark:text-gray-400">
            Haz clic para cargar una foto del recibo
          </p>
          <p className="text-xs text-gray-400 mt-2">
            JPG, PNG, PDF (máx 5MB)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleFileSelect(file);
              }
            }}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Preview */}
          <div className="relative w-full max-h-64 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
            <img
              src={preview}
              alt="Receipt preview"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Extracted Data */}
          {extracting ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : extracted ? (
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg space-y-3">
              <div>
                <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                  Establecimiento
                </label>
                <p className="text-gray-900 dark:text-white">{extracted.merchant}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                    Monto
                  </label>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    ${extracted.amount.toFixed(2)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                    Fecha
                  </label>
                  <p className="text-gray-900 dark:text-white">{extracted.date}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                  Categoría
                </label>
                <select
                  value={extracted.category}
                  onChange={(e) =>
                    setExtracted({ ...extracted, category: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
                >
                  <option>Alimentación</option>
                  <option>Transporte</option>
                  <option>Entretenimiento</option>
                  <option>Servicios</option>
                  <option>Otros</option>
                </select>
              </div>

              {extracted.items.length > 0 && (
                <div>
                  <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                    Artículos detectados
                  </label>
                  <ul className="mt-2 space-y-1">
                    {extracted.items.map((item, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-gray-700 dark:text-gray-300"
                      >
                        • {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-2">
                <p className="text-xs text-gray-500">
                  Confianza: {(extracted.confidence * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          ) : null}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setPreview(null);
                setExtracted(null);
              }}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cargar otro
            </button>
            {extracted && (
              <button
                onClick={() => {
                  showInfo('✅ Recibo agregado a transacciones');
                  setPreview(null);
                  setExtracted(null);
                }}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Guardar
              </button>
            )}
          </div>
        </div>
      )}

      <ModalComponent />
    </div>
  );
};
