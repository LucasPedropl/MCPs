'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TestCaseEntity,
  TestRunEntity,
  fetchTestCasesService,
  fetchTestRunsService,
  saveTestCaseService,
  deleteTestCaseService,
  runTestCaseService
} from '../services/testsService';

export function useTestCases(serverId: string) {
  const [testCases, setTestCases] = useState<TestCaseEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [testRuns, setTestRuns] = useState<Record<string, TestRunEntity[]>>({});
  const [isRunningCaseId, setIsRunningCaseId] = useState<string | null>(null);

  const fetchCases = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchTestCasesService(serverId);
      setTestCases(data);
    } catch (err) {
      console.error('Erro ao carregar casos de teste:', err);
    } finally {
      setIsLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const loadRuns = async (testCaseId: string) => {
    try {
      const data = await fetchTestRunsService(testCaseId);
      setTestRuns(prev => ({
        ...prev,
        [testCaseId]: data
      }));
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    }
  };

  const handleSaveTestCase = async (tc: Partial<TestCaseEntity>) => {
    try {
      const saved = await saveTestCaseService(serverId, tc);
      setTestCases(prev => {
        const exists = prev.some(item => item.id === saved.id);
        if (exists) {
          return prev.map(item => item.id === saved.id ? saved : item);
        }
        return [saved, ...prev];
      });
      return saved;
    } catch (err) {
      console.error('Erro ao salvar caso de teste:', err);
      throw err;
    }
  };

  const handleDeleteTestCase = async (id: string) => {
    try {
      await deleteTestCaseService(id);
      setTestCases(prev => prev.filter(item => item.id !== id));
      setTestRuns(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    } catch (err) {
      console.error('Erro ao deletar caso de teste:', err);
      throw err;
    }
  };

  const handleRunTestCase = async (id: string, variablesOverride?: Record<string, any>) => {
    setIsRunningCaseId(id);
    try {
      const result = await runTestCaseService(serverId, id, variablesOverride);
      
      // Atualiza o status do testCase na listagem local
      setTestCases(prev => prev.map(item => {
        if (item.id === id) {
          return {
            ...item,
            last_run_status: result.status,
            last_run_at: new Date().toISOString()
          };
        }
        return item;
      }));

      // Adiciona a rodada executada ao histórico local
      if (result.testRun) {
        setTestRuns(prev => ({
          ...prev,
          [id]: [result.testRun, ...(prev[id] || [])]
        }));
      }

      return result;
    } catch (err) {
      console.error('Erro ao executar caso de teste:', err);
      throw err;
    } finally {
      setIsRunningCaseId(null);
    }
  };

  return {
    testCases,
    isLoading,
    testRuns,
    isRunningCaseId,
    fetchCases,
    loadRuns,
    handleSaveTestCase,
    handleDeleteTestCase,
    handleRunTestCase
  };
}
