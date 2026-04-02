import { z } from 'zod';
import { PaymentMethod, RefundReasonCode } from '../types/payment.types';

export const recordPaymentSchema = z.object({
  orderId: z.string().uuid(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  amount: z.number().positive('Amount must be positive'),
  referenceNumber: z.string().max(100).optional(),
});

export const refundSchema = z.object({
  paymentId: z.string().uuid(),
  amount: z.number().positive('Amount must be positive'),
  reasonCode: z.nativeEnum(RefundReasonCode),
  reasonDetail: z.string().max(1000).optional(),
  supervisorUsername: z.string().optional(),
  supervisorPassword: z.string().optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type RefundInput = z.infer<typeof refundSchema>;
