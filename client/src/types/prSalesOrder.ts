/** Khớp `serializePRSalesOrder` từ server */
export type PRSalesOrderInfo = {
  linkedToSO: boolean;
  salesPOId: string | null;
  salesPONumber: string | null;
  customerPONumber: string | null;
  projectName: string | null;
  projectCode: string | null;
  customerName: string | null;
  label: string | null;
};
