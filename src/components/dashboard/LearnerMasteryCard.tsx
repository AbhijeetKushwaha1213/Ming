import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Brain,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Sparkles,
  History,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { getLearnerMastery, getLearnerEvents, LearnerMasteryRecord, LearnerEventRecord, MasteryStatus } from '@/api/learnerAPI';
import { useAuth } from '@/components/auth/AuthProvider';
import { navigateToTab } from '@/utils/navigation';

export const LearnerMasteryCard: React.FC<{ onNavigateToAssessment?: () => void }> = ({ onNavigateToAssessment }) => {
  const { user } = useAuth();
  const [masteryList, setMasteryList] = useState<LearnerMasteryRecord[]>([]);
  const [recentEvents, setRecentEvents] = useState<LearnerEventRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEventLog, setShowEventLog] = useState(false);

  const userId = user?.user_id || user?.id || 'default_user';

  const loadMastery = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [masteryRes, eventsRes] = await Promise.all([
        getLearnerMastery(userId),
        getLearnerEvents(userId, 5),
      ]);
      if (masteryRes.success && Array.isArray(masteryRes.mastery)) {
        setMasteryList(masteryRes.mastery);
      }
      if (eventsRes.success && Array.isArray(eventsRes.events)) {
        setRecentEvents(eventsRes.events);
      }
    } catch {
      // Cold start or offline fallback
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadMastery();
  }, [loadMastery]);

  useEffect(() => {
    const handleRefresh = () => {
      loadMastery();
    };
    window.addEventListener('studymate-bkt-refresh', handleRefresh);
    return () => window.removeEventListener('studymate-bkt-refresh', handleRefresh);
  }, [loadMastery]);

  // Aggregate stats
  const assessedList = masteryList.filter((m) => m.attempts > 0);
  const totalTopics = masteryList.length;

  const countByStatus: Record<MasteryStatus, number> = {
    unassessed: masteryList.filter((m) => m.status === 'unassessed' || m.attempts === 0).length,
    developing: masteryList.filter((m) => m.status === 'developing' && m.attempts > 0).length,
    proficient: masteryList.filter((m) => m.status === 'proficient').length,
    mastered: masteryList.filter((m) => m.status === 'mastered').length,
  };

  const avgMastery =
    assessedList.length > 0
      ? Math.round(
          (assessedList.reduce((acc, m) => acc + m.masteryProbability, 0) / assessedList.length) * 100
        )
      : 0;

  const getStatusBadge = (status: MasteryStatus, attempts: number) => {
    if (attempts === 0 || status === 'unassessed') {
      return (
        <Badge variant="outline" className="border-gray-300 text-gray-600 bg-gray-50 flex items-center gap-1">
          <HelpCircle className="w-3 h-3 text-gray-500" />
          Unassessed
        </Badge>
      );
    }
    switch (status) {
      case 'developing':
        return (
          <Badge className="bg-amber-500/10 text-amber-700 border-amber-300 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-amber-600" />
            Developing
          </Badge>
        );
      case 'proficient':
        return (
          <Badge className="bg-blue-500/10 text-blue-700 border-blue-300 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            Proficient
          </Badge>
        );
      case 'mastered':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-300 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            Mastered
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="p-6 space-y-5 border-border shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold text-foreground">Knowledge Mastery Model (BKT)</h3>
            <Badge variant="outline" className="text-xs text-indigo-700 bg-indigo-50 border-indigo-200">
              Bayesian Tracing
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Personalized mastery calculated dynamically from evidence across course assessments.
          </p>
        </div>

        {/* Overall Score Badge */}
        <div className="text-right flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto">
          <span className="text-2xl font-extrabold text-foreground">
            {assessedList.length > 0 ? `${avgMastery}%` : 'Unassessed'}
          </span>
          <span className="text-xs text-muted-foreground">
            {assessedList.length > 0 ? 'Cumulative Mastery' : 'No Activity Yet'}
          </span>
        </div>
      </div>

      {/* Cold Start State (No evidence yet) */}
      {!isLoading && assessedList.length === 0 && (
        <div className="py-6 text-center space-y-3 bg-muted/30 rounded-xl p-4 border border-dashed border-border">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mx-auto text-indigo-600">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">No Knowledge Baseline Recorded</h4>
            <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
              Your mastery is currently unassessed. Complete an adaptive course assessment to calibrate your BKT knowledge state without fabricated progress.
            </p>
          </div>
          <Button
            size="sm"
            variant="premium"
            onClick={() => {
              if (onNavigateToAssessment) {
                onNavigateToAssessment();
              } else {
                navigateToTab('flashcards', 'assessment', { topic: 'Diagnostic Assessment' });
              }
            }}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Take Diagnostic Assessment
          </Button>
        </div>
      )}

      {/* Assessed State */}
      {assessedList.length > 0 && (
        <>
          {/* Status Breakdown Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-200 text-center">
              <span className="text-xs font-semibold text-emerald-800">Mastered (≥85%)</span>
              <p className="text-lg font-bold text-emerald-700">{countByStatus.mastered}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-200 text-center">
              <span className="text-xs font-semibold text-blue-800">Proficient (60-84%)</span>
              <p className="text-lg font-bold text-blue-700">{countByStatus.proficient}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-200 text-center">
              <span className="text-xs font-semibold text-amber-800">Developing (&lt;60%)</span>
              <p className="text-lg font-bold text-amber-700">{countByStatus.developing}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-gray-100 border border-gray-200 text-center">
              <span className="text-xs font-semibold text-gray-700">Unassessed</span>
              <p className="text-lg font-bold text-gray-800">{countByStatus.unassessed}</p>
            </div>
          </div>

          {/* Per-Topic Breakdown */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Topic Mastery Breakdown</h4>
            <div className="space-y-3">
              {masteryList.map((m) => {
                const pct = Math.round(m.masteryProbability * 100);
                return (
                  <div key={m.id} className="p-3 rounded-lg border border-border bg-card/60 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{m.topic}</span>
                        {m.subtopic && <span className="text-xs text-muted-foreground">/ {m.subtopic}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(m.status, m.attempts)}
                        <span className="font-bold text-xs text-foreground">
                          {m.attempts > 0 ? `${pct}%` : '0%'}
                        </span>
                      </div>
                    </div>
                    <Progress value={pct} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{m.attempts} assessment attempts ({m.correctCount} correct)</span>
                      <span>Confidence: {Math.round(m.confidence * 100)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Auditable Event History Collapsible */}
      {recentEvents.length > 0 && (
        <div className="pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => setShowEventLog(!showEventLog)}
            className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground hover:text-foreground py-1"
          >
            <span className="flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-indigo-500" />
              Recent BKT Audit Events ({recentEvents.length})
            </span>
            {showEventLog ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showEventLog && (
            <div className="mt-2 space-y-1.5 animate-fade-in">
              {recentEvents.map((evt) => (
                <div key={evt.id} className="text-xs p-2 rounded-md bg-muted/40 border border-border flex items-center justify-between">
                  <div>
                    <span className="font-medium text-foreground">{evt.topic}</span>
                    <span className="text-muted-foreground ml-2">[{evt.eventType}]</span>
                    <p className="text-[11px] text-muted-foreground">{evt.evidenceDetails}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-indigo-600">
                      {Math.round(evt.priorMastery * 100)}% → {Math.round(evt.posteriorMastery * 100)}%
                    </span>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
