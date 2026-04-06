import { logInfo } from "../utils/logger.js";

type PrintReceiptRequest = {
  sale_id?: string;
  terminal_id?: string;
  cash_register_id?: string;
  movement_type?: string;
  amount_cents?: number;
  description?: string;
  requested_by?: string;
};

const printQueue: PrintReceiptRequest[] = [];

export class PrintService {
  enqueueReceiptPrint(request: PrintReceiptRequest): { queued: boolean; queue_size: number } {
    printQueue.push(request);

    logInfo("Solicitacao de impressao enfileirada", { tag: "PrintService", request });

    return {
      queued: true,
      queue_size: printQueue.length,
    };
  }
}
