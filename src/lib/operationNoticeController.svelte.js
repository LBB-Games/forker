/**
 * Owns transient operation notice state and timeout cleanup.
 */
export function createOperationNoticeController() {
  let operationNotice = $state(null);
  let operationNoticeTimeout = null;

  function clearOperationNotice() {
    if (operationNoticeTimeout) {
      clearTimeout(operationNoticeTimeout);
      operationNoticeTimeout = null;
    }
    operationNotice = null;
  }

  function showOperationNotice(message, tone = 'success') {
    if (!message) return;
    if (operationNoticeTimeout) clearTimeout(operationNoticeTimeout);
    operationNotice = { id: Date.now(), message, tone };
    operationNoticeTimeout = setTimeout(() => {
      operationNotice = null;
      operationNoticeTimeout = null;
    }, tone === 'error' ? 5200 : 2800);
  }

  return {
    get operationNotice() { return operationNotice; },
    clearOperationNotice,
    showOperationNotice,
  };
}
