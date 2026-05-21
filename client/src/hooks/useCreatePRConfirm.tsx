import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreatePRConfirmModal } from '../components/CreatePRConfirmModal';

/**
 * Mở modal xác nhận trước khi điều hướng tới form tạo PR.
 */
export function useCreatePRConfirm() {
  const navigate = useNavigate();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const requestCreatePR = useCallback((path: string) => {
    setPendingPath(path);
  }, []);

  const handleClose = useCallback(() => setPendingPath(null), []);

  const handleConfirm = useCallback(() => {
    if (pendingPath) {
      navigate(pendingPath);
    }
    setPendingPath(null);
  }, [navigate, pendingPath]);

  const createPRConfirmModal = (
    <CreatePRConfirmModal open={pendingPath != null} onClose={handleClose} onConfirm={handleConfirm} />
  );

  return { requestCreatePR, createPRConfirmModal };
}
