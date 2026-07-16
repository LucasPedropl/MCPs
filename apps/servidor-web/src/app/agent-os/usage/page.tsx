'use client';

import React from 'react';
import { useUsageStats } from '@/features/agent-os/hooks/useUsageStats';
import { UsageDashboard } from '@/features/agent-os/components/UsageDashboard';

export default function AgentOsUsagePage() {
  const {
    days,
    setDays,
    host,
    setHost,
    data,
    error,
    isLoading,
    reload,
  } = useUsageStats();

  return (
    <UsageDashboard
      days={days}
      host={host}
      data={data}
      error={error}
      isLoading={isLoading}
      onDaysChange={setDays}
      onHostChange={setHost}
      onReload={reload}
    />
  );
}
