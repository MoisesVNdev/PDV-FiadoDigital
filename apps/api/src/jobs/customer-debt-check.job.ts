import { CustomerRepository } from "../repositories/customer.repository.js";

const customerRepository = new CustomerRepository();

/**
 * Job de verificação periódica de clientes com atraso no pagamento do fiado.
 * Inativa automaticamente clientes com dívida vencida.
 *
 * Este job é executado uma vez por dia (configurável).
 * Clientes são inativados quando:
 * - Possuem dívida positiva (current_debt_cents > 0)
 * - Têm um dia de pagamento configurado (payment_due_day)
 * - O dia corrente é posterior ao dia de vencimento
 * - Estão ativos (is_active: true)
 */
export async function startCustomerDebtCheckJob(): Promise<void> {
  // Executar a verificação imediatamente ao iniciar
  await runCustomerDebtCheck();

  // Agendar para executar a cada 24 horas
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  setInterval(async () => {
    try {
      await runCustomerDebtCheck();
    } catch (error) {
      console.error("Erro ao executar customer-debt-check job:", error);
    }
  }, TWENTY_FOUR_HOURS);

  console.log("[Job] Customer debt check iniciado com interpretação diária");
}

async function runCustomerDebtCheck(): Promise<void> {
  try {
    const result = await customerRepository.checkAndDeactivateOverdueCustomers();
    if (result.count > 0) {
      console.log(`[Job] ${result.count} clientes foram inativados por atraso no pagamento`);
    }
  } catch (error) {
    console.error("Erro ao verificar clientes em atraso:", error);
    throw error;
  }
}
