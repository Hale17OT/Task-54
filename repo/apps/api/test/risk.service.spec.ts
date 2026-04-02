import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { RiskService } from '../src/core/application/use-cases/risk.service';
import { IpRuleEntity } from '../src/infrastructure/persistence/entities/ip-rule.entity';
import { RiskEventEntity } from '../src/infrastructure/persistence/entities/risk-event.entity';
import { IncidentTicketEntity } from '../src/infrastructure/persistence/entities/incident-ticket.entity';
import { IncidentStatus } from '@checc/shared/types/risk.types';

describe('RiskService', () => {
  let service: RiskService;
  let ipRuleRepo: Record<string, jest.Mock>;
  let riskEventRepo: Record<string, jest.Mock>;
  let incidentRepo: Record<string, jest.Mock>;

  const adminId = 'admin-uuid-1';
  const ruleId = 'rule-uuid-1';
  const incidentId = 'incident-uuid-1';

  beforeEach(async () => {
    ipRuleRepo = {
      create: jest.fn().mockImplementation((data) => ({
        ...data,
        id: ruleId,
        createdAt: new Date(),
      })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      find: jest.fn().mockResolvedValue([]),
      remove: jest.fn(),
    };

    riskEventRepo = {
      create: jest.fn().mockImplementation((data) => ({
        ...data,
        id: 'event-uuid-1',
        detectedAt: new Date(),
      })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      count: jest.fn().mockResolvedValue(0),
    };

    incidentRepo = {
      create: jest.fn().mockImplementation((data) => ({
        ...data,
        id: incidentId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskService,
        { provide: getRepositoryToken(IpRuleEntity), useValue: ipRuleRepo },
        { provide: getRepositoryToken(RiskEventEntity), useValue: riskEventRepo },
        { provide: getRepositoryToken(IncidentTicketEntity), useValue: incidentRepo },
      ],
    }).compile();

    service = module.get<RiskService>(RiskService);
  });

  describe('createIpRule', () => {
    it('should create an IP rule', async () => {
      const input = {
        ipAddress: '192.168.1.100',
        ruleType: 'deny',
        reason: 'Suspicious activity',
      };

      const result = await service.createIpRule(input, adminId);

      expect(result).toBeDefined();
      expect(ipRuleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '192.168.1.100',
          ruleType: 'deny',
          createdBy: adminId,
        }),
      );
      expect(ipRuleRepo.save).toHaveBeenCalled();
    });
  });

  describe('checkIp', () => {
    it('should block IP with deny rule', async () => {
      ipRuleRepo.find.mockResolvedValue([
        {
          id: ruleId,
          ipAddress: '192.168.1.100',
          cidrMask: 32,
          ruleType: 'deny',
          expiresAt: null,
          createdAt: new Date(),
        },
      ]);

      const result = await service.checkIp('192.168.1.100');

      expect(result.allowed).toBe(false);
    });

    it('should allow IP with allow rule overriding deny', async () => {
      ipRuleRepo.find.mockResolvedValue([
        {
          id: 'deny-rule',
          ipAddress: '192.168.1.100',
          cidrMask: 32,
          ruleType: 'deny',
          expiresAt: null,
          createdAt: new Date(),
        },
        {
          id: 'allow-rule',
          ipAddress: '192.168.1.100',
          cidrMask: 32,
          ruleType: 'allow',
          expiresAt: null,
          createdAt: new Date(),
        },
      ]);

      const result = await service.checkIp('192.168.1.100');

      expect(result.allowed).toBe(true);
    });
  });

  describe('listRiskEvents', () => {
    it('should return paginated risk events', async () => {
      const mockEvents = [
        { id: 'event-1', eventType: 'promo_abuse', severity: 'high', detectedAt: new Date() },
      ];
      riskEventRepo.findAndCount.mockResolvedValue([mockEvents, 1]);

      const result = await service.listRiskEvents(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('updateIncident', () => {
    it('should update incident status', async () => {
      incidentRepo.findOne.mockResolvedValue({
        id: incidentId,
        status: IncidentStatus.OPEN,
        assignedTo: null,
        resolvedAt: null,
        resolutionNotes: null,
      });

      const result = await service.updateIncident(incidentId, {
        status: 'INVESTIGATING',
        assignedTo: adminId,
      });

      expect(incidentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'INVESTIGATING',
          assignedTo: adminId,
        }),
      );
    });

    it('should throw if incident not found', async () => {
      incidentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateIncident('nonexistent', { status: 'RESOLVED' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
