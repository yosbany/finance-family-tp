import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getAccounts } from '../../services/accounts.service';
import { getCategories } from '../../services/categories.service';
import { createTransactions, parsedToTransaction } from '../../services/transactions.service';
import { createUploadHistory, checkDuplicateUpload, getUploadHistory, migrateOldUploads } from '../../services/uploadHistory.service';
import { calculateFileHash } from '../../parsers/fileHasher';
import { parseCSV } from '../../parsers/csvParser';
import { parseExcel } from '../../parsers/excelParser';
import { parsePDF } from '../../parsers/pdfParser';
import { parseByBank, detectBank, getParserInfo } from '../../parsers/banks';
import { categorizeTransactions } from '../../utils/categorization';
import { Account, Category, Transaction } from '../../types';
import { LoadingSpinner } from '../common/LoadingSpinner';
import BankLogo from '../common/BankLogo';

export const UploadStatements = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Wizard steps
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [selectedAccountType, setSelectedAccountType] = useState<'debit' | 'credit' | 'investment' | ''>('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  
  // Statement period
  const currentDate = new Date();
  const [statementMonth, setStatementMonth] = useState<number>(currentDate.getMonth() + 1);
  const [statementYear, setStatementYear] = useState<number>(currentDate.getFullYear());
  
  // Other states
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [uploadHistory, setUploadHistory] = useState<any[]>([]);
  const [useSmartParser, setUseSmartParser] = useState(true);
  const [detectedBank, setDetectedBank] = useState<string | null>(null);
  const [forceUpload, setForceUpload] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    details?: {
      total: number;
      categorized: number;
      pending: number;
    };
    warnings?: string[];
  } | null>(null);

  // Available banks
  const banks = ['BROU', 'Itaú', 'Santander', 'OCA', 'Prex', 'BHU', 'IBM'];
  
  // Configuración de tipos de cuenta disponibles por banco
  const bankAccountTypes: Record<string, Array<'debit' | 'credit' | 'investment'>> = {
    'BROU': ['debit'],
    'Itaú': ['debit', 'credit'],
    'Santander': ['debit', 'credit'],
    'OCA': ['credit'],
    'Prex': ['debit'],
    'BHU': ['debit'],
    'IBM': ['investment']
  };
  
  // Obtener tipos de cuenta disponibles para el banco seleccionado
  const availableAccountTypes = selectedBank ? bankAccountTypes[selectedBank] || [] : [];
  
  // Filtered accounts based on selections
  const filteredAccounts = accounts.filter(acc => {
    if (selectedBank && acc.bank !== selectedBank) return false;
    if (selectedAccountType && acc.type !== selectedAccountType) return false;
    return true;
  });

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      
      // Migrar registros antiguos automáticamente
      const migratedCount = await migrateOldUploads(user.uid);
      if (migratedCount > 0) {
        console.log(`✅ Migrados ${migratedCount} registros antiguos a Junio 2026`);
      }
      
      const [accountsData, historyData] = await Promise.all([
        getAccounts(user.uid),
        getUploadHistory(user.uid)
      ]);
      setAccounts(accountsData);
      setUploadHistory(historyData);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      setAccounts([]);
      setUploadHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validar tipo de archivo
      const validTypes = [
        'application/pdf',
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      
      if (!validTypes.includes(selectedFile.type) &&
          !selectedFile.name.endsWith('.csv') &&
          !selectedFile.name.endsWith('.xlsx') &&
          !selectedFile.name.endsWith('.xls') &&
          !selectedFile.name.endsWith('.pdf')) {
        setResult({
          success: false,
          message: 'Tipo de archivo no soportado. Por favor, sube un archivo PDF, CSV o Excel.'
        });
        return;
      }
      
      setFile(selectedFile);
      setResult(null);

      // Intentar detectar el banco automáticamente
      if (useSmartParser && selectedFile.name.endsWith('.csv')) {
        try {
          const content = await selectedFile.text();
          const detected = detectBank(content);
          setDetectedBank(detected);
        } catch (error) {
          console.error('Error al detectar banco:', error);
          setDetectedBank(null);
        }
      } else {
        setDetectedBank(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!user || !file || !selectedAccount) {
      setResult({
        success: false,
        message: 'Por favor, selecciona una cuenta y un archivo.'
      });
      return;
    }

    try {
      setProcessing(true);
      setResult(null);

      // 1. Calcular hash del archivo
      const fileHash = await calculateFileHash(file);

      // 2. Verificar si ya fue cargado (a menos que se fuerce la recarga)
      if (!forceUpload) {
        const isDuplicate = await checkDuplicateUpload(user.uid, fileHash);
        if (isDuplicate) {
          setResult({
            success: false,
            message: '⚠️ Este archivo ya fue cargado anteriormente. Si quieres volver a cargarlo, activa la opción "Forzar recarga" abajo.'
          });
          return;
        }
      }

      // 3. Obtener información de la cuenta seleccionada
      const account = accounts.find(a => a.id === selectedAccount);
      if (!account) {
        throw new Error('Cuenta no encontrada');
      }

      // 4. Parsear el archivo según su tipo
      let parsedTransactions;
      const fileName = file.name.toLowerCase();
      
      // Determinar el banco: usar el detectado o el de la cuenta seleccionada
      const bankToUse = detectedBank || account.bank;
      
      // Intentar usar parser específico del banco si está habilitado
      if (useSmartParser && bankToUse) {
        try {
          parsedTransactions = await parseByBank(
            file,
            bankToUse,
            account.type,
            account.currency
          );
          console.log(`✅ Usando parser específico para ${bankToUse} (${account.type})`);
        } catch (error) {
          console.warn(`⚠️ Error con parser de ${bankToUse}, usando parser genérico:`, error);
          // Fallback a parsers genéricos
          if (fileName.endsWith('.csv')) {
            parsedTransactions = await parseCSV(file);
          } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            parsedTransactions = await parseExcel(file);
          } else if (fileName.endsWith('.pdf')) {
            parsedTransactions = await parsePDF(file);
          } else {
            throw new Error('Formato de archivo no soportado');
          }
        }
      } else {
        // Usar parsers genéricos
        if (fileName.endsWith('.csv')) {
          parsedTransactions = await parseCSV(file);
        } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
          parsedTransactions = await parseExcel(file);
        } else if (fileName.endsWith('.pdf')) {
          parsedTransactions = await parsePDF(file);
        } else {
          throw new Error('Formato de archivo no soportado');
        }
      }

      if (parsedTransactions.length === 0) {
        setResult({
          success: false,
          message: 'No se encontraron transacciones en el archivo.'
        });
        return;
      }

      // 5. Validar fechas de transacciones (solo para bancos que requieren período)
      const warnings: string[] = [];
      const requiresPeriod = selectedBank !== 'BHU' && selectedBank !== 'IBM';
      
      if (requiresPeriod) {
        let transactionsOutOfRange = 0;
        
        parsedTransactions.forEach(pt => {
          const txDate = new Date(pt.date);
          const txMonth = txDate.getMonth() + 1;
          const txYear = txDate.getFullYear();
          
          if (txMonth !== statementMonth || txYear !== statementYear) {
            transactionsOutOfRange++;
          }
        });
        
        if (transactionsOutOfRange > 0) {
          warnings.push(
            `⚠️ ${transactionsOutOfRange} transacción(es) tienen fechas fuera del período seleccionado (${statementMonth}/${statementYear}). Verifica que sea el extracto correcto.`
          );
        }
      }

      // 6. Crear registro de carga
      // Para BHU e IBM, usar el mes/año actual ya que no se requiere período específico
      const uploadId = await createUploadHistory(user.uid, {
        fileName: file.name,
        fileHash,
        uploadedBy: user.uid,
        uploadDate: Date.now(),
        accountId: selectedAccount,
        transactionsCount: parsedTransactions.length,
        status: 'processed',
        statementMonth: requiresPeriod ? statementMonth : currentDate.getMonth() + 1,
        statementYear: requiresPeriod ? statementYear : currentDate.getFullYear()
      });

      // 7. Convertir a transacciones
      const transactions = parsedTransactions.map(pt =>
        parsedToTransaction(pt, selectedAccount, uploadId)
      );

      // 8. Categorizar automáticamente
      const categories = await getCategories(user.uid);
      const categorizedTransactions = categorizeTransactions(transactions, categories) as Omit<Transaction, 'id' | 'createdAt'>[];

      // 9. Guardar en la base de datos
      await createTransactions(user.uid, categorizedTransactions);

      // 10. Calcular estadísticas
      const categorized = categorizedTransactions.filter(t => t.status === 'classified').length;
      const pending = categorizedTransactions.filter(t => t.status === 'pending').length;

      setResult({
        success: true,
        message: `¡Archivo procesado exitosamente!`,
        details: {
          total: parsedTransactions.length,
          categorized,
          pending
        },
        warnings: warnings.length > 0 ? warnings : undefined
      });

      // Recargar historial
      await loadData();

      // Limpiar formulario
      setFile(null);
      setSelectedAccount('');
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Redirigir a la página de transacciones después de 2 segundos
      // (siempre redirige, incluso si hay warnings)
      setTimeout(() => {
        navigate('/transactions');
      }, 2000);

    } catch (error: any) {
      console.error('Error al procesar archivo:', error);
      setResult({
        success: false,
        message: error.message || 'Error al procesar el archivo. Por favor, intenta de nuevo.'
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Cargar Extracto Bancario
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Sigue los pasos para cargar tu estado de cuenta
        </p>
      </div>

      {/* Progress Steps */}
      <div className="card">
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  currentStep >= step
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                  {step}
                </div>
                <span className={`text-xs mt-2 ${
                  currentStep >= step
                    ? 'text-primary font-medium'
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {step === 1 && 'Banco'}
                  {step === 2 && 'Tipo'}
                  {step === 3 && 'Cuenta'}
                  {step === 4 && 'Archivo'}
                </span>
              </div>
              {step < 4 && (
                <div className={`h-1 flex-1 mx-2 ${
                  currentStep > step
                    ? 'bg-primary'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`} />
              )}
            </div>
          ))}
        </div>

        <div className="space-y-6">
          {/* Step 1: Select Bank */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Paso 1: Selecciona la Institución Financiera
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {banks.map((bank) => (
                  <button
                    key={bank}
                    onClick={() => {
                      setSelectedBank(bank);
                      setCurrentStep(2);
                    }}
                    className={`p-6 rounded-lg border-2 transition-all hover:scale-105 ${
                      selectedBank === bank
                        ? 'border-primary bg-primary/10 dark:bg-primary/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <BankLogo bank={bank} size="lg" />
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {bank}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Select Account Type */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Paso 2: Selecciona el Tipo de Cuenta
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Banco seleccionado: <span className="font-semibold">{selectedBank}</span>
              </p>
              <div className={`grid grid-cols-1 ${availableAccountTypes.length > 1 ? 'md:grid-cols-2' : ''} gap-4`}>
                {availableAccountTypes.includes('debit') && (
                  <button
                    onClick={() => {
                      setSelectedAccountType('debit');
                      setCurrentStep(3);
                    }}
                    className="p-8 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary/50 transition-all hover:scale-105"
                  >
                    <div className="text-center">
                      <div className="text-5xl mb-3">💳</div>
                      <div className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        Cuenta de Débito
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Caja de ahorro, cuenta corriente
                      </div>
                    </div>
                  </button>
                )}
                {availableAccountTypes.includes('credit') && (
                  <button
                    onClick={() => {
                      setSelectedAccountType('credit');
                      setCurrentStep(3);
                    }}
                    className="p-8 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary/50 transition-all hover:scale-105"
                  >
                    <div className="text-center">
                      <div className="text-5xl mb-3">💰</div>
                      <div className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        Tarjeta de Crédito
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Visa, Mastercard, etc.
                      </div>
                    </div>
                  </button>
                )}
                {availableAccountTypes.includes('investment') && (
                  <button
                    onClick={() => {
                      setSelectedAccountType('investment');
                      setCurrentStep(3);
                    }}
                    className="p-8 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary/50 transition-all hover:scale-105"
                  >
                    <div className="text-center">
                      <div className="text-5xl mb-3">📈</div>
                      <div className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        Inversiones
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Acciones, bonos, fondos
                      </div>
                    </div>
                  </button>
                )}
              </div>
              <button
                onClick={() => setCurrentStep(1)}
                className="text-primary hover:underline text-sm"
              >
                ← Volver a seleccionar banco
              </button>
            </div>
          )}

          {/* Step 3: Select Specific Account */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Paso 3: Selecciona la Cuenta Específica
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {selectedBank} - {selectedAccountType === 'debit' ? 'Débito' : 'Crédito'}
              </p>
              {filteredAccounts.length > 0 ? (
                <div className="space-y-3">
                  {filteredAccounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => {
                        setSelectedAccount(account.id);
                        setCurrentStep(4);
                      }}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all hover:scale-[1.02] ${
                        selectedAccount === account.id
                          ? 'border-primary bg-primary/10 dark:bg-primary/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {account.name}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {account.owner} • {account.currency}
                          </div>
                        </div>
                        <div className="text-2xl">
                          {account.type === 'debit' ? '💳' : '💰'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No hay cuentas disponibles para esta combinación
                </div>
              )}
              <button
                onClick={() => setCurrentStep(2)}
                className="text-primary hover:underline text-sm"
              >
                ← Volver a seleccionar tipo de cuenta
              </button>
            </div>
          )}

          {/* Step 4: Upload File */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Paso 4: Carga el Archivo
              </h2>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>Cuenta seleccionada:</strong> {accounts.find(a => a.id === selectedAccount)?.name}
                </div>
              </div>

              {/* Selector de Mes/Año del Extracto - Solo para bancos que lo requieren */}
              {selectedBank !== 'BHU' && selectedBank !== 'IBM' && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <label className="label text-yellow-900 dark:text-yellow-200 mb-3">
                    📅 Período del Extracto (Mes/Año)
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-yellow-800 dark:text-yellow-300 mb-1 block">
                        Mes
                      </label>
                      <select
                        value={statementMonth}
                        onChange={(e) => setStatementMonth(Number(e.target.value))}
                        className="input-field"
                        disabled={processing}
                      >
                        <option value={1}>Enero</option>
                        <option value={2}>Febrero</option>
                        <option value={3}>Marzo</option>
                        <option value={4}>Abril</option>
                        <option value={5}>Mayo</option>
                        <option value={6}>Junio</option>
                        <option value={7}>Julio</option>
                        <option value={8}>Agosto</option>
                        <option value={9}>Septiembre</option>
                        <option value={10}>Octubre</option>
                        <option value={11}>Noviembre</option>
                        <option value={12}>Diciembre</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-yellow-800 dark:text-yellow-300 mb-1 block">
                        Año
                      </label>
                      <select
                        value={statementYear}
                        onChange={(e) => setStatementYear(Number(e.target.value))}
                        className="input-field"
                        disabled={processing}
                      >
                        {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i).map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-2">
                    ⚠️ Importante: Selecciona el mes y año correcto del extracto. Se validarán las fechas de las transacciones.
                  </p>
                </div>
                )}
                
                <div>
                <label className="label">
                  Selecciona el archivo del extracto
                </label>
                <input
                  id="file-input"
                  type="file"
                  accept=".pdf,.csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="input-field"
                  disabled={processing}
                />
                <p className="text-sm text-gray-500 mt-2">
                  Formatos soportados: PDF, CSV, Excel (.xlsx, .xls)
                </p>
              </div>

              {file && (
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800 dark:text-green-300">
                    <span className="text-xl">📄</span>
                    <div>
                      <div className="font-semibold">{file.name}</div>
                      <div className="text-sm">{(file.size / 1024).toFixed(2)} KB</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Opción de forzar recarga */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="force-upload"
                  checked={forceUpload}
                  onChange={(e) => setForceUpload(e.target.checked)}
                  className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary"
                  disabled={processing}
                />
                <label htmlFor="force-upload" className="text-sm text-gray-700 dark:text-gray-300">
                  Forzar recarga (permite cargar archivos duplicados)
                </label>
              </div>
              
              <button
                onClick={() => setCurrentStep(3)}
                className="text-primary hover:underline text-sm"
              >
                ← Volver a seleccionar cuenta
              </button>
            </div>
          )}

          {/* Botón de procesar - Solo en paso 4 */}
          {currentStep === 4 && file && (
            <>
              {/* Botón de carga */}
              <button
                onClick={handleUpload}
                disabled={!file || !selectedAccount || processing}
                className="btn-primary w-full text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoadingSpinner size="sm" />
                    Procesando archivo...
                  </span>
                ) : (
                  '📤 Cargar y Procesar Extracto'
                )}
              </button>

              {/* Resultado */}
              {result && (
                <div className={`p-4 rounded-lg ${
                  result.success
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                }`}>
                  <p className={`font-medium ${
                    result.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
                  }`}>
                    {result.message}
                  </p>
                  {result.warnings && result.warnings.length > 0 && (
                    <div className="mt-3 space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                      {result.warnings.map((warning, idx) => (
                        <p key={idx}>{warning}</p>
                      ))}
                    </div>
                  )}
                  {result.details && (
                    <div className="mt-3 space-y-1 text-sm text-green-700 dark:text-green-300">
                      <p>✅ Total de transacciones: {result.details.total}</p>
                      <p>🏷️ Categorizadas automáticamente: {result.details.categorized}</p>
                      <p>⏳ Pendientes de clasificar: {result.details.pending}</p>
                      {result.details.pending > 0 && (
                        <p className="mt-2 text-blue-600 dark:text-blue-400">
                          → <a href="/transactions" className="underline">Ver transacciones pendientes</a>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Información adicional */}
      <div className="card bg-gray-50 dark:bg-gray-800">
        <h3 className="font-bold text-gray-900 dark:text-white mb-3">
          ℹ️ Información Importante
        </h3>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li>• Los archivos NO se almacenan, solo se procesan en memoria</li>
          <li>• Se calcula un hash SHA-256 para detectar archivos duplicados</li>
          <li>• Las transacciones se categorizan automáticamente cuando es posible</li>
          <li>• Puedes clasificar manualmente las transacciones pendientes después</li>
          <li>• Se guarda un registro de cada carga con fecha, hora y usuario</li>
          <li>• El parser inteligente reconoce formatos de BROU, Itaú, Santander, OCA, Prex y BHU</li>
          <li>• Después de procesar, serás redirigido automáticamente a la página de transacciones</li>
        </ul>
      </div>

      {/* Panel de Seguimiento de Extractos Subidos */}
      {uploadHistory.length > 0 && (
        <div className="card">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4">
            📊 Seguimiento de Extractos Subidos
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Revisa qué extractos has subido por mes/año para cada banco y cuenta
          </p>
          
          {/* Agrupar por mes/año */}
          {(() => {
            const groupedByPeriod: Record<string, any[]> = {};
            uploadHistory.forEach(upload => {
              const key = `${upload.statementYear}-${String(upload.statementMonth).padStart(2, '0')}`;
              if (!groupedByPeriod[key]) {
                groupedByPeriod[key] = [];
              }
              groupedByPeriod[key].push(upload);
            });

            const sortedPeriods = Object.keys(groupedByPeriod).sort().reverse();

            return (
              <div className="space-y-4">
                {sortedPeriods.map(period => {
                  const [year, month] = period.split('-');
                  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                                     'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                  const uploads = groupedByPeriod[period];

                  return (
                    <div key={period} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                        📅 {monthNames[parseInt(month) - 1]} {year}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {uploads.map(upload => {
                          const account = accounts.find(a => a.id === upload.accountId);
                          return (
                            <div
                              key={upload.id}
                              className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-lg">
                                      {account?.type === 'debit' ? '💳' : '💰'}
                                    </span>
                                    <span className="font-medium text-sm text-gray-900 dark:text-white">
                                      {account?.bank}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                    {account?.name}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                    {upload.transactionsCount} transacciones
                                  </p>
                                </div>
                                <span className="text-green-500 text-xl">✓</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              💡 <strong>Tip:</strong> Usa este panel para identificar qué extractos faltan por subir cada mes
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// Made with Bob
