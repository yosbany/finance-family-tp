import { useState, useCallback } from 'react';
import { Modal } from '../components/common/Modal';

type ModalType = 'info' | 'warning' | 'success' | 'error' | 'confirm';

interface ModalState {
  isOpen: boolean;
  title: string;
  message: string;
  type: ModalType;
  confirmText: string;
  cancelText: string;
  onConfirm?: () => void;
}

const initialState: ModalState = {
  isOpen: false,
  title: '',
  message: '',
  type: 'info',
  confirmText: 'Aceptar',
  cancelText: 'Cancelar',
};

export const useModal = () => {
  const [modal, setModal] = useState<ModalState>(initialState);

  const closeModal = useCallback(() => {
    setModal(prev => ({ ...prev, isOpen: false }));
  }, []);

  const showModal = useCallback((options: Partial<ModalState> & Pick<ModalState, 'title' | 'message'>) => {
    setModal({
      ...initialState,
      ...options,
      isOpen: true,
    });
  }, []);

  const showSuccess = useCallback((message: string, title = 'Éxito') => {
    showModal({ title, message, type: 'success' });
  }, [showModal]);

  const showError = useCallback((message: string, title = 'Error') => {
    showModal({ title, message, type: 'error' });
  }, [showModal]);

  const showInfo = useCallback((message: string, title = 'Información') => {
    showModal({ title, message, type: 'info' });
  }, [showModal]);

  const showWarning = useCallback((message: string, title = 'Atención') => {
    showModal({ title, message, type: 'warning' });
  }, [showModal]);

  const showConfirm = useCallback((options: {
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
  }) => {
    showModal({
      title: options.title,
      message: options.message,
      type: 'confirm',
      confirmText: options.confirmText ?? 'Confirmar',
      cancelText: options.cancelText ?? 'Cancelar',
      onConfirm: options.onConfirm,
    });
  }, [showModal]);

  const ModalComponent = () => (
    <Modal
      isOpen={modal.isOpen}
      onClose={closeModal}
      onConfirm={modal.onConfirm}
      title={modal.title}
      message={modal.message}
      type={modal.type}
      confirmText={modal.confirmText}
      cancelText={modal.cancelText}
    />
  );

  return {
    showSuccess,
    showError,
    showInfo,
    showWarning,
    showConfirm,
    closeModal,
    ModalComponent,
  };
};
