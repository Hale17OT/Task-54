export enum PaymentMethod {
  CASH = 'cash',
  CHECK = 'check',
  MANUAL_CARD = 'manual_card',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
  CANCELED = 'CANCELED',
}

export enum RefundReasonCode {
  PATIENT_REQUEST = 'PATIENT_REQUEST',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DUPLICATE_PAYMENT = 'DUPLICATE_PAYMENT',
  BILLING_ERROR = 'BILLING_ERROR',
  QUALITY_ISSUE = 'QUALITY_ISSUE',
  MEDICAL_REASON = 'MEDICAL_REASON',
  OTHER = 'OTHER',
}

export interface PaymentDto {
  id: string;
  orderId: string;
  paymentMethod: PaymentMethod;
  amount: number;
  referenceNumber: string | null;
  status: PaymentStatus;
  recordedBy: string;
  paidAt: string | null;
  createdAt: string;
}

export interface RecordPaymentRequest {
  orderId: string;
  paymentMethod: PaymentMethod;
  amount: number;
  referenceNumber?: string;
}

export interface RefundRequest {
  paymentId: string;
  amount: number;
  reasonCode: RefundReasonCode;
  reasonDetail?: string;
  supervisorUsername?: string;
  supervisorPassword?: string;
}

export interface RefundDto {
  id: string;
  paymentId: string;
  amount: number;
  reasonCode: RefundReasonCode;
  reasonDetail: string | null;
  requestedBy: string;
  approvedBy: string;
  approvedAt: string;
  createdAt: string;
}
