type SaleLike = {
  price_sold: number;
  cost_price?: number | null;
  payment_method?: string | null;
};

export const MERCADOPAGO_BASE_FEE_RATE = 0.0259;
export const CHILE_IVA_RATE = 0.19;
// Mercado Pago muestra 2,59%, pero el cargo real viene con IVA:
// $20.990 * 2,59% * 1,19 = $646.
export const MERCADOPAGO_FEE_RATE = MERCADOPAGO_BASE_FEE_RATE * (1 + CHILE_IVA_RATE);

export const isMercadoPagoSale = (paymentMethod?: string | null) =>
  String(paymentMethod || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .includes("mercadopago");

export const mercadoPagoFee = (amount: number) =>
  Math.floor(Math.max(0, Number(amount) || 0) * MERCADOPAGO_FEE_RATE);

export const salePaymentFee = (sale: SaleLike) =>
  isMercadoPagoSale(sale.payment_method) ? mercadoPagoFee(sale.price_sold) : 0;

export const saleNetRevenue = (sale: SaleLike) =>
  Math.max(0, sale.price_sold - salePaymentFee(sale));

export const saleNetProfit = (sale: SaleLike) =>
  saleNetRevenue(sale) - (sale.cost_price ?? 0);
