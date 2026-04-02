export enum RiskEventType {
  PROMO_ABUSE = 'promo_abuse',
  BULK_REGISTRATION = 'bulk_registration',
  REPEATED_REFUND = 'repeated_refund',
  SUSPICIOUS_LOGIN = 'suspicious_login',
}

export enum RiskSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum IncidentStatus {
  OPEN = 'OPEN',
  INVESTIGATING = 'INVESTIGATING',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED',
}

export interface IpRuleDto {
  id: string;
  ipAddress: string;
  cidrMask: number;
  ruleType: 'allow' | 'deny';
  reason: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface RiskEventDto {
  id: string;
  userId: string | null;
  eventType: RiskEventType;
  severity: RiskSeverity;
  details: Record<string, unknown>;
  ipAddress: string | null;
  deviceFingerprint: string | null;
  detectedAt: string;
}

export interface IncidentTicketDto {
  id: string;
  riskEventId: string;
  title: string;
  description: string;
  status: IncidentStatus;
  assignedTo: string | null;
  hitLogs: Record<string, unknown>;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
}

export interface CaptchaChallengeDto {
  id: string;
  imageBase64: string;
  expiresAt: string;
}
