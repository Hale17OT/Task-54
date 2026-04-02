import { useEffect, useState } from 'react';
import { riskApi } from '@/api/risk.api';
import type { RiskEventDto, IncidentTicketDto, IpRuleDto } from '@checc/shared/types/risk.types';

export function useRiskDashboard() {
  const [events, setEvents] = useState<RiskEventDto[]>([]);
  const [incidents, setIncidents] = useState<IncidentTicketDto[]>([]);
  const [ipRules, setIpRules] = useState<IpRuleDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);

  // IP rule form state
  const [showIpForm, setShowIpForm] = useState(false);
  const [newIp, setNewIp] = useState('');
  const [newRuleType, setNewRuleType] = useState<'allow' | 'deny'>('deny');
  const [newReason, setNewReason] = useState('');

  useEffect(() => {
    Promise.all([
      riskApi.listRiskEvents(1, 10),
      riskApi.listIncidents(1, 10),
      riskApi.listIpRules(1, 50),
    ]).then(([eventsRes, incidentsRes, ipRulesRes]) => {
      setEvents(eventsRes.data);
      setIncidents(incidentsRes.data);
      setIpRules(ipRulesRes.data);
      setIsLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load risk data');
      setIsLoading(false);
    });
  }, []);

  const createIpRule = async () => {
    try {
      const res = await riskApi.createIpRule({ ipAddress: newIp, ruleType: newRuleType, reason: newReason || undefined });
      setIpRules((prev) => [...prev, res.data]);
      setShowIpForm(false);
      setNewIp(''); setNewReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create IP rule');
    }
  };

  const deleteIpRule = async (id: string) => {
    try {
      await riskApi.deleteIpRule(id);
      setIpRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete IP rule');
    }
  };

  const updateIncident = async (id: string, status: string) => {
    try {
      const res = await riskApi.updateIncident(id, { status });
      setIncidents((prev) => prev.map((i) => (i.id === id ? res.data : i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update incident');
    }
  };

  return {
    events, incidents, ipRules, isLoading, error,
    expandedIncident, setExpandedIncident,
    showIpForm, setShowIpForm, newIp, setNewIp, newRuleType, setNewRuleType, newReason, setNewReason,
    createIpRule, deleteIpRule, updateIncident,
  };
}
