import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useModal } from '../../hooks/useModal';
import { getAccounts, recalculateAccountBalance } from '../../services/accounts.service';
import { getOwners, Owner } from '../../services/owners.service';
import { getCategories } from '../../services/categories.service';
import { createTransactions, parsedToTransaction } from '../../services/transactions.service';
import { createUploadHistory, checkDuplicateUpload, getUploadHistory, migrateOldUploads, markAccountNoMovements, deleteUploadHistory } from '../../services/uploadHistory.service';
import { calculateFileHash } from '../../parsers/fileHasher';
import { parseCSV } from '../../parsers/csvParser';
import { parseExcel } from '../../parsers/excelParser';
import { parsePDF } from '../../parsers/pdfParser';
import { parseByBank, detectBank, getParserInfo } from '../../parsers/banks';
import { categorizeTransactions } from '../../utils/categorization';
import { getOwnerBadgeClasses, getOwnerCardClasses } from '../../utils/ownerColors';
import { getBankDownloadGuide } from '../../utils/bankDownloadGuides';
import { Account, Category, Transaction, UploadHistory } from '../../types';
import { LoadingSpinner } from '../common/LoadingSpinner';
import BankLogo from '../common/BankLogo';

const BankDownloadHelp = ({ bank }: { bank: string }) => {
  const [open, setOpen] = useState(false);
  const guide = getBankDownloadGuide(bank);
  if (!guide) return null;

  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
          Cómo descargar el extracto de {bank}
        </span>
        <span className="text-blue-700 dark:text-blue-300 text-xs">
          Formatos: {guide.formats.join(', ')} · {open ? 'Ocultar' : 'Ver pasos'}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-blue-200 dark:border-blue-800 pt-3">
          <ol className="list-decimal list-inside space-y-1.5 text-sm text-blue-900 dark:text-blue-100">
            {guide.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
          {guide.visualHint && (
            <div className="flex items-center gap-3 rounded-md bg-white/70 dark:bg-blue-950/40 px-3 py-2 border border-blue-200 dark:border-blue-800">
              <img
                src={guide.visualHint.src}
                alt={guide.visualHint.alt}
                className="w-10 h-10 object-contain shrink-0 rounded"
              />
              <p className="text-xs text-blue-800 dark:text-blue-200">
                {guide.visualHint.caption}
              </p>
            </div>
          )}
          {guide.tips && guide.tips.length > 0 && (
            <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
              <p className="font-medium">Tips</p>
              <ul className="list-disc list-inside space-y-1">
                {guide.tips.map((tip, index) => (
                  <li key={index}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const UploadStatements = () => {
  const { user } = useAuth();
  const { showSuccess, showError, showConfirm, ModalComponent } = useModal();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
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
  const [owners, setOwners] = useState<Owner[]>([]);
  const [uploadHistory, setUploadHistory] = useState<UploadHistory[]>([]);
  const [trackingSearch, setTrackingSearch] = useState('');
  const [trackingStatusFilter, setTrackingStatusFilter] = useState<'all' | 'uploaded' | 'missing'>('all');
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

  const prefillUploadWizard = (account: Account, month: number, year: number) => {
    setSelectedBank(account.bank);
    setSelectedAccountType(account.type);
    setSelectedAccount(account.id);
    setStatementMonth(month);
    setStatementYear(year);
    setCurrentStep(4);
    setFile(null);
    setResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const accountId = searchParams.get('accountId');
    const monthParam = searchParams.get('month');
    const yearParam = searchParams.get('year');

    if (!accountId || accounts.length === 0) return;

    const account = accounts.find(a => a.id === accountId);
    if (!account) return;

    prefillUploadWizard(
      account,
      monthParam ? parseInt(monthParam, 10) : statementMonth,
      yearParam ? parseInt(yearParam, 10) : statementYear
    );
    setSearchParams({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, searchParams]);

  const loadData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      
      // Migrar registros antiguos automáticamente
      const migratedCount = await migrateOldUploads();
      if (migratedCount > 0) {
        console.log(`✅ Migrados ${migratedCount} registros antiguos a Junio 2026`);
      }
      
      const [accountsData, historyData, ownersData] = await Promise.all([
        getAccounts(),
        getUploadHistory(),
        getOwners()
      ]);
      setAccounts(accountsData);
      setUploadHistory(historyData);
      setOwners(ownersData);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      setAccounts([]);
      setUploadHistory([]);
      setOwners([]);
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
        const isDuplicate = await checkDuplicateUpload(fileHash);
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
      const uploadId = await createUploadHistory({
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
      const categories = await getCategories();
      const categorizedTransactions = categorizeTransactions(transactions, categories) as Omit<Transaction, 'id' | 'createdAt'>[];

      // 9. Guardar en la base de datos
      await createTransactions(categorizedTransactions);

      // 10. Actualizar saldo de la cuenta con las nuevas transacciones
      await recalculateAccountBalance(selectedAccount);

      // 11. Calcular estadísticas
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

  const handleUploadedClick = (upload: UploadHistory) => {
    if (upload.status === 'no_movements') return;
    navigate(`/transactions?uploadId=${upload.id}`);
  };

  const handleMissingDoubleClick = (account: Account, month: number, year: number) => {
    navigate(`/transactions/upload?accountId=${account.id}&month=${month}&year=${year}`);
  };

  const handleMarkNoMovements = (account: Account, month: number, year: number) => {
    if (!user) return;

    showConfirm({
      title: 'Sin movimientos',
      message: `¿Confirmar que ${account.name} (${monthNames[month - 1]} ${year}) no tuvo movimientos? Se marcará como completado.`,
      confirmText: 'Confirmar',
      onConfirm: async () => {
        try {
          await markAccountNoMovements(account.id, month, year, user.uid);
          await loadData();
          showSuccess('Marcado como sin movimientos');
        } catch (err) {
          console.error(err);
          showError(err instanceof Error ? err.message : 'Error al marcar sin movimientos');
        }
      },
    });
  };

  const handleUndoNoMovements = (upload: UploadHistory) => {
    if (!user || upload.status !== 'no_movements') return;

    showConfirm({
      title: 'Deshacer marca',
      message: '¿Quitar la marca de "sin movimientos" para este período?',
      confirmText: 'Quitar marca',
      onConfirm: async () => {
        try {
          await deleteUploadHistory(upload.id);
          await loadData();
          showSuccess('Marca eliminada');
        } catch (err) {
          console.error(err);
          showError('Error al quitar la marca');
        }
      },
    });
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const trackingPeriods = useMemo(() => {
    const periodKeys = new Set<string>();
    const now = new Date();

    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      periodKeys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    uploadHistory.forEach(upload => {
      periodKeys.add(`${upload.statementYear}-${String(upload.statementMonth).padStart(2, '0')}`);
    });

    return Array.from(periodKeys)
      .sort()
      .reverse()
      .map(key => {
        const [year, month] = key.split('-');
        return { key, year: parseInt(year, 10), month: parseInt(month, 10) };
      });
  }, [uploadHistory]);

  const uploadByAccountPeriod = useMemo(() => {
    const map = new Map<string, UploadHistory>();
    uploadHistory.forEach(upload => {
      map.set(`${upload.statementYear}-${upload.statementMonth}-${upload.accountId}`, upload);
    });
    return map;
  }, [uploadHistory]);

  const trackingStats = useMemo(() => {
    let uploaded = 0;
    let missing = 0;
    const term = trackingSearch.toLowerCase().trim();

    trackingPeriods.forEach(({ year, month }) => {
      accounts.forEach(account => {
        if (term) {
          const matches =
            account.name.toLowerCase().includes(term) ||
            account.bank.toLowerCase().includes(term) ||
            account.owner.toLowerCase().includes(term);
          if (!matches) return;
        }
        const isUploaded = uploadByAccountPeriod.has(`${year}-${month}-${account.id}`);
        if (isUploaded) uploaded++;
        else missing++;
      });
    });
    return { uploaded, missing };
  }, [trackingPeriods, accounts, uploadByAccountPeriod, trackingSearch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const matchesTrackingSearch = (account: Account) => {
    if (!trackingSearch.trim()) return true;
    const term = trackingSearch.toLowerCase();
    return (
      account.name.toLowerCase().includes(term) ||
      account.bank.toLowerCase().includes(term) ||
      account.owner.toLowerCase().includes(term)
    );
  };

  type TrackingEntry = {
    account: Account;
    covered: boolean;
    upload?: UploadHistory;
    noMovements: boolean;
    hasExtract: boolean;
  };

  const getPeriodEntries = (year: number, month: number): TrackingEntry[] => {
    return accounts
      .map(account => {
        const upload = uploadByAccountPeriod.get(`${year}-${month}-${account.id}`);
        const noMovements = upload?.status === 'no_movements';
        const hasExtract = upload?.status === 'processed';
        return {
          account,
          covered: !!upload,
          upload,
          noMovements,
          hasExtract,
        };
      })
      .filter(entry => matchesTrackingSearch(entry.account))
      .filter(entry => {
        if (trackingStatusFilter === 'uploaded') return entry.covered;
        if (trackingStatusFilter === 'missing') return !entry.covered;
        return true;
      });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="page-title-lg">
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
              <BankDownloadHelp bank={selectedBank} />
              <div className={`grid grid-cols-1 ${availableAccountTypes.length > 1 ? 'md:grid-cols-2' : ''} gap-4`}>
                {availableAccountTypes.includes('debit') && (
                  <button
                    onClick={() => {
                      setSelectedAccountType('debit');
                      setCurrentStep(3);
                    }}
                    className="group p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 transition-all hover:shadow-lg hover:shadow-green-500/20"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform">
                        💳
                      </div>
                      <div className="text-left flex-1">
                        <div className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                          Cuenta de Débito
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Caja de ahorro, cuenta corriente
                        </div>
                      </div>
                      <svg className="w-6 h-6 text-gray-400 group-hover:text-green-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                )}
                {availableAccountTypes.includes('credit') && (
                  <button
                    onClick={() => {
                      setSelectedAccountType('credit');
                      setCurrentStep(3);
                    }}
                    className="group p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 transition-all hover:shadow-lg hover:shadow-green-500/20"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform">
                        💰
                      </div>
                      <div className="text-left flex-1">
                        <div className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                          Tarjeta de Crédito
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Visa, Mastercard, etc.
                        </div>
                      </div>
                      <svg className="w-6 h-6 text-gray-400 group-hover:text-green-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                )}
                {availableAccountTypes.includes('investment') && (
                  <button
                    onClick={() => {
                      setSelectedAccountType('investment');
                      setCurrentStep(3);
                    }}
                    className="group p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 transition-all hover:shadow-lg hover:shadow-green-500/20"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform">
                        📈
                      </div>
                      <div className="text-left flex-1">
                        <div className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                          Inversiones
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Acciones, bonos, fondos
                        </div>
                      </div>
                      <svg className="w-6 h-6 text-gray-400 group-hover:text-green-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
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
                          ? 'border-primary bg-primary/10 dark:bg-primary/20 ring-2 ring-primary/40'
                          : getOwnerCardClasses(account.owner, owners)
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {account.name}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getOwnerBadgeClasses(account.owner, owners)}`}>
                              {account.owner}
                            </span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {account.currency}
                            </span>
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

              {selectedBank && <BankDownloadHelp bank={selectedBank} />}

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
                          → <Link to="/transactions" className="underline">Ver transacciones pendientes</Link>
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

      {/* Panel de Seguimiento de Extractos */}
      {accounts.length > 0 && (
        <div className="card">
          <h3 className="font-bold text-gray-900 dark:text-white mb-2">
            📊 Seguimiento de Extractos Subidos
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Revisa qué extractos has subido por mes/año para cada banco y cuenta
          </p>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <input
                type="text"
                value={trackingSearch}
                onChange={(e) => setTrackingSearch(e.target.value)}
                placeholder="Buscar por banco, cuenta o titular..."
                className="input-field pl-10"
              />
              <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
            </div>
            <select
              value={trackingStatusFilter}
              onChange={(e) => setTrackingStatusFilter(e.target.value as 'all' | 'uploaded' | 'missing')}
              className="input-field sm:w-48"
            >
              <option value="all">Todos</option>
              <option value="uploaded">✓ Completados</option>
              <option value="missing">☐ Faltantes</option>
            </select>
          </div>

          {/* Resumen */}
          <div className="flex flex-wrap gap-4 mb-4 text-sm">
            <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
              <span className="font-bold">✓</span> {trackingStats.uploaded} completos
            </span>
            <span className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
              <span className="font-bold">☐</span> {trackingStats.missing} faltantes
            </span>
            {trackingStatusFilter !== 'missing' && trackingStats.missing > 0 && (
              <button
                type="button"
                onClick={() => setTrackingStatusFilter('missing')}
                className="text-primary hover:underline"
              >
                Ver solo faltantes
              </button>
            )}
          </div>

          <div className="space-y-4">
            {trackingPeriods.map(({ key, year, month }) => {
              const entries = getPeriodEntries(year, month);
              if (entries.length === 0) return null;

              return (
                <div key={key} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      📅 {monthNames[month - 1]} {year}
                    </h4>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {entries.filter(e => e.covered).length}/{entries.length} completos
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {entries.map(({ account, covered, upload, noMovements, hasExtract }) => (
                      <div
                        key={`${key}-${account.id}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => hasExtract && upload && handleUploadedClick(upload)}
                        onDoubleClick={(e) => {
                          if (noMovements && upload) {
                            e.preventDefault();
                            handleUndoNoMovements(upload);
                            return;
                          }
                          if (!covered) handleMissingDoubleClick(account, month, year);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && hasExtract && upload) handleUploadedClick(upload);
                          if (e.key === 'Enter' && !covered) handleMissingDoubleClick(account, month, year);
                        }}
                        className={`p-3 rounded-lg border transition-all ${
                          noMovements
                            ? `${getOwnerCardClasses(account.owner, owners)} cursor-pointer hover:ring-2 hover:ring-blue-400/60`
                            : hasExtract
                              ? `${getOwnerCardClasses(account.owner, owners)} cursor-pointer hover:ring-2 hover:ring-green-400/60 hover:shadow-sm`
                              : 'bg-orange-50 dark:bg-orange-900/10 border-dashed border-orange-300 dark:border-orange-700'
                        }`}
                        title={
                          hasExtract
                            ? 'Clic para ver transacciones de este extracto'
                            : noMovements
                              ? 'Doble clic para quitar marca de sin movimientos'
                              : 'Doble clic para cargar extracto'
                        }
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">
                                {account.type === 'debit' ? '💳' : account.type === 'credit' ? '💰' : '📈'}
                              </span>
                              <span className="font-medium text-sm text-gray-900 dark:text-white">
                                {account.bank}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                              {account.name}
                            </p>
                            <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${getOwnerBadgeClasses(account.owner, owners)}`}>
                              {account.owner}
                            </span>
                            {hasExtract && upload ? (
                              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                {upload.transactionsCount} transacciones
                              </p>
                            ) : noMovements ? (
                              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                                Sin movimientos
                              </p>
                            ) : (
                              <>
                                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 font-medium">
                                  Falta subir
                                </p>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkNoMovements(account, month, year);
                                  }}
                                  className="text-xs text-primary hover:underline mt-1 block"
                                >
                                  Marcar sin movimientos
                                </button>
                              </>
                            )}
                          </div>
                          <span
                            className={`text-xl flex-shrink-0 ${
                              hasExtract ? 'text-green-500' : noMovements ? 'text-blue-500' : 'text-orange-400'
                            }`}
                            title={
                              hasExtract ? 'Extracto subido' : noMovements ? 'Sin movimientos' : 'Extracto pendiente'
                            }
                          >
                            {covered ? '✓' : '☐'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {trackingPeriods.every(({ year, month }) => getPeriodEntries(year, month).length === 0) && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-6">
              No hay resultados para los filtros aplicados
            </p>
          )}

          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              💡 <strong>Tip:</strong> Clic en extractos subidos (✓ verde) para ver transacciones. Doble clic en faltantes (☐) para cargar. Si no hubo movimientos, usa &quot;Marcar sin movimientos&quot; (✓ azul).
            </p>
          </div>
        </div>
      )}
      <ModalComponent />
    </div>
  );
};

// Made with Bob
