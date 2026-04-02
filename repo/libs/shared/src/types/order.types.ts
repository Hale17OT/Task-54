export enum OrderStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
  CANCELED = 'CANCELED',
}

export interface OrderLineDto {
  id: string;
  serviceId: string;
  serviceName: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  lineTotal: number;
  discountReason: string | null;
}

export interface OrderDto {
  id: string;
  orderNumber: string;
  enrollmentId: string;
  patientId: string;
  status: OrderStatus;
  subtotal: number;
  discountTotal: number;
  finalTotal: number;
  lines: OrderLineDto[];
  createdAt: string;
  updatedAt: string;
  autoCancelAt: string;
}
