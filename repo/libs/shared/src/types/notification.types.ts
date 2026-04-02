export enum NotificationType {
  DUE_DATE = 'due_date',
  OVERDUE_BALANCE = 'overdue_balance',
  PICKUP_READY = 'pickup_ready',
  COMPLIANCE_BREACH = 'compliance_breach',
  RISK_ALERT = 'risk_alert',
  GENERAL = 'general',
}

export interface NotificationDto {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  referenceType: string | null;
  referenceId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface CreateNotificationRequest {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  referenceType?: string;
  referenceId?: string;
}
