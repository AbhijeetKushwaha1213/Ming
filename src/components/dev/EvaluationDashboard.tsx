import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Play,
  Download,
  FileCode,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  RefreshCw,
  Sparkles,
  Layers,
  ArrowRight,
  BookOpen,
  Target,
  ArrowLeft,
} from 'lucide-react';
import {
  getLatestEvaluation,
  runEvaluationSuite,
  getEvaluationCsvDownloadUrl,
  type EvaluationReport,
} from '@/api/evaluationAPI';
import { Link } from 'react-router-dom';

export const EvaluationDashboard: React.FC = () => {
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const fetchLatest = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await getLatestEvaluation();
      if (res.success && res.report) {
        setReport(res.report);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load evaluation metrics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLatest();
  }, []);

  const handleRunSuite = async () => {
    setIsRunning(true);
    setErrorMsg(null);
    try {
      const res = await runEvaluationSuite();
      if (res.success && res.report) {
        setReport(res.report);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Evaluation run failed');
    } finally {
      setIsRunning(false);
    }
  };

  const pct = (val?: number) => (val !== undefined && val !== null ? `${(val * 100).toFixed(1)}%` : 'N/A');

  return (
    <div className="min-h-screen bg-background text-foreground p-6 sm:p-10 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground inline-flex items-center text-xs">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Dashboard
            </Link>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-300 text-xs uppercase tracking-wider font-bold">
              Developer Only
            </Badge>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mt-2 flex items-center gap-3">
            <Activity className="w-8 h-8 text-primary" />
            Evaluation / Benchmarking
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Empirical validation of RAG quality, source grounding, BKT student simulation, and question novelty.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(getEvaluationCsvDownloadUrl(), '_blank')}
            disabled={!report}
          >
            <Download className="w-4 h-4 mr-1.5" />
            Download CSV
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleRunSuite}
            disabled={isRunning}
            className="bg-primary text-primary-foreground font-semibold"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                Running Evaluation...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1.5 fill-current" />
                Run Benchmark Suite
              </>
            )}
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 8 Required KPI Metric Cards */}
      {isLoading ? (
        <div className="py-20 text-center text-muted-foreground">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
          Loading benchmark metrics...
        </div>
      ) : !report ? (
        <Card className="p-10 text-center space-y-4">
          <HelpCircle className="w-12 h-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-bold">No Benchmark Data Available</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Click "Run Benchmark Suite" above to execute the automated evaluation over your knowledge base and student models.
          </p>
          <Button onClick={handleRunSuite} disabled={isRunning}>
            Run Benchmark Suite
          </Button>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Metadata pill */}
          <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground bg-muted/30 px-4 py-2 rounded-lg border border-border">
            <span>Last Evaluated: <strong>{new Date(report.evaluationTimestamp).toLocaleString()}</strong></span>
            <span>Dataset Items: <strong>{report.datasetSize}</strong></span>
            <span>Simulated Students: <strong>{report.personalizationMetrics.simulatedStudentsCount}</strong></span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" /> Isolated Test Environment
            </span>
          </div>

          {/* 8 Primary Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* 1. Faithfulness */}
            <Card className="p-4 space-y-2 border-border/80 hover:shadow-xs transition-shadow">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Faithfulness</span>
                <Badge variant="outline" className="text-[10px]">RAGAS</Badge>
              </div>
              <div className="text-2xl font-black text-foreground">
                {pct(report.ragMetrics.faithfulness)}
              </div>
              <Progress value={report.ragMetrics.faithfulness * 100} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground">Answers factually inferred from context</p>
            </Card>

            {/* 2. Answer Relevancy */}
            <Card className="p-4 space-y-2 border-border/80 hover:shadow-xs transition-shadow">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Answer Relevancy</span>
                <Badge variant="outline" className="text-[10px]">RAGAS</Badge>
              </div>
              <div className="text-2xl font-black text-foreground">
                {pct(report.ragMetrics.answerRelevancy)}
              </div>
              <Progress value={report.ragMetrics.answerRelevancy * 100} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground">Coverage of question concept & facts</p>
            </Card>

            {/* 3. Context Precision */}
            <Card className="p-4 space-y-2 border-border/80 hover:shadow-xs transition-shadow">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Context Precision</span>
                <Badge variant="outline" className="text-[10px]">RAGAS</Badge>
              </div>
              <div className="text-2xl font-black text-foreground">
                {pct(report.ragMetrics.contextPrecision)}
              </div>
              <Progress value={report.ragMetrics.contextPrecision * 100} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground">Relevant chunks ranked at the top</p>
            </Card>

            {/* 4. Context Recall */}
            <Card className="p-4 space-y-2 border-border/80 hover:shadow-xs transition-shadow">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Context Recall</span>
                <Badge variant="outline" className="text-[10px]">RAGAS</Badge>
              </div>
              <div className="text-2xl font-black text-foreground">
                {pct(report.ragMetrics.contextRecall)}
              </div>
              <Progress value={report.ragMetrics.contextRecall * 100} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground">Expected ground-truth concepts retrieved</p>
            </Card>

            {/* 5. Grounding Accuracy */}
            <Card className="p-4 space-y-2 border-border/80 hover:shadow-xs transition-shadow">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Grounding Accuracy</span>
                <Badge variant="outline" className="text-[10px]">Source</Badge>
              </div>
              <div className="text-2xl font-black text-foreground">
                {pct(report.groundingMetrics.groundingAccuracy)}
              </div>
              <Progress value={report.groundingMetrics.groundingAccuracy * 100} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground">Retrieved chunk matches expected source</p>
            </Card>

            {/* 6. Refusal Accuracy */}
            <Card className="p-4 space-y-2 border-border/80 hover:shadow-xs transition-shadow">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Refusal Accuracy</span>
                <Badge variant="outline" className="text-[10px]">Guardrail</Badge>
              </div>
              <div className="text-2xl font-black text-foreground">
                {pct(report.groundingMetrics.refusalAccuracy)}
              </div>
              <Progress value={report.groundingMetrics.refusalAccuracy * 100} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground">Out-of-material queries refused cleanly</p>
            </Card>

            {/* 7. Question Novelty */}
            <Card className="p-4 space-y-2 border-border/80 hover:shadow-xs transition-shadow">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Question Novelty</span>
                <Badge variant="outline" className="text-[10px]">Assessment</Badge>
              </div>
              <div className="text-2xl font-black text-foreground">
                {pct(report.noveltyMetrics.uniqueQuestionPercentage)}
              </div>
              <Progress value={report.noveltyMetrics.uniqueQuestionPercentage * 100} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground">Unique questions without duplication</p>
            </Card>

            {/* 8. Average Mastery Improvement */}
            <Card className="p-4 space-y-2 border-border/80 hover:shadow-xs transition-shadow bg-primary/5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Mastery Delta</span>
                <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">BKT Simulation</Badge>
              </div>
              <div className="text-2xl font-black text-primary">
                +{pct(report.personalizationMetrics.averageMasteryImprovement)}
              </div>
              <Progress value={Math.min(100, report.personalizationMetrics.averageMasteryImprovement * 100)} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground">Average gain across simulated students</p>
            </Card>
          </div>

          {/* Detailed Breakdown Tabs */}
          <Tabs defaultValue="comparison" className="w-full space-y-6">
            <TabsList className="grid grid-cols-5 max-w-2xl">
              <TabsTrigger value="comparison">Phase 6 vs 7</TabsTrigger>
              <TabsTrigger value="simulation">Cohort ({report.personalizationMetrics.simulatedStudentsCount})</TabsTrigger>
              <TabsTrigger value="questions">RAG ({report.perQuestionResults.length})</TabsTrigger>
              <TabsTrigger value="novelty">Deduplication</TabsTrigger>
              <TabsTrigger value="raw">Raw JSON</TabsTrigger>
            </TabsList>

            {/* Tab 0: Phase 6 vs Phase 7 Comparison */}
            <TabsContent value="comparison" className="space-y-4">
              <Card className="p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                  <div>
                    <h3 className="text-base font-bold flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      Empirical Phase 6 vs Phase 7 Comparison
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Addressing Phase 6 weaknesses: Context Precision (37.5%) & Exact Duplicate Rate (80.0%) with candidate reranking, threshold filtering, and persistent fingerprinting.
                    </p>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-300 text-xs">
                    Empirically Evaluated
                  </Badge>
                </div>

                {report.phaseComparison && report.phaseComparison.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                        <tr>
                          <th className="px-4 py-3">Evaluation Metric</th>
                          <th className="px-4 py-3">Phase 6 Baseline</th>
                          <th className="px-4 py-3">Phase 7 Actual</th>
                          <th className="px-4 py-3">Delta</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Target Benchmark</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {report.phaseComparison.map((row, idx) => {
                          const isKeyFocus = row.metric === 'Context Precision' || row.metric === 'Exact Duplicate Rate';
                          return (
                            <tr key={idx} className={`hover:bg-muted/30 transition-colors ${isKeyFocus ? 'bg-primary/5 font-medium' : ''}`}>
                              <td className="px-4 py-3 flex items-center gap-2">
                                {isKeyFocus && <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/30">KEY FOCUS</Badge>}
                                <span>{row.metric}</span>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {pct(row.phase6Value)}
                              </td>
                              <td className="px-4 py-3 font-bold text-foreground">
                                {pct(row.phase7Value)}
                              </td>
                              <td className={`px-4 py-3 font-semibold ${row.improved ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
                                {row.delta >= 0 ? `+${(row.delta * 100).toFixed(1)}%` : `${(row.delta * 100).toFixed(1)}%`}
                              </td>
                              <td className="px-4 py-3">
                                {row.improved ? (
                                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-300 text-[10px]">
                                    PASSED ✓
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px]">
                                    ATTN ⚠️
                                  </Badge>
                                )}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground font-mono">
                                {row.targetBenchmark}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-xs">
                    Comparison metrics will be calculated on the next benchmark run.
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* Tab 1: Student Simulation */}
            <TabsContent value="simulation" className="space-y-4">
              <Card className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <h3 className="text-base font-bold flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      Simulated Student Personalization & Mastery Gains
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Each profile runs through multi-session study loops with deterministic priority recommendations and BKT updates.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {report.personalizationMetrics.students.length} Profiles Evaluated
                  </Badge>
                </div>

                {report.personalizationMetrics.cohortArchetypeDistribution && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pb-2">
                    {Object.entries(report.personalizationMetrics.cohortArchetypeDistribution).map(([arch, cnt]) => (
                      <div key={arch} className="p-2.5 rounded-lg border border-border/80 bg-muted/20 text-center">
                        <div className="text-[10px] text-muted-foreground capitalize">{arch.replace(/_/g, ' ')}</div>
                        <div className="text-base font-black text-foreground">{cnt}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {report.personalizationMetrics.students.map((student, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-border bg-card space-y-3">
                      <div className="flex items-start justify-between">
                        <span className="font-bold text-sm text-foreground">{student.profileName}</span>
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-300 text-xs">
                          +{pct(student.masteryImprovement)}
                        </Badge>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Mastery Progression</span>
                          <span>{pct(student.masteryBefore)} → {pct(student.masteryAfter)}</span>
                        </div>
                        <Progress value={student.masteryAfter * 100} className="h-2" />
                      </div>

                      <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border/50">
                        <div className="flex justify-between">
                          <span>Recommended Topics:</span>
                          <span className="font-semibold text-foreground">{student.recommendedTopics.join(', ')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Activities Completed:</span>
                          <span className="font-semibold text-foreground">{student.completedTasksCount} tasks</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>

            {/* Tab 2: RAG Questions Breakdown */}
            <TabsContent value="questions" className="space-y-4">
              <Card className="p-6 space-y-4">
                <h3 className="text-base font-bold flex items-center gap-2 border-b border-border pb-3">
                  <BookOpen className="w-5 h-5 text-primary" />
                  Per-Question Evaluation Results ({report.perQuestionResults.length} items)
                </h3>

                <div className="space-y-3">
                  {report.perQuestionResults.map((item, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-border bg-card/60 space-y-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary">{item.itemId}</span>
                          <Badge variant="outline" className="text-[10px] uppercase">{item.questionType}</Badge>
                          {item.offMaterial && (
                            <Badge className="bg-rose-500/10 text-rose-600 border-rose-300 text-[10px]">
                              Off-Material (Refusal Expected)
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <span>Faithfulness: <strong>{pct(item.faithfulness)}</strong></span>
                          <span>Relevancy: <strong>{pct(item.answerRelevancy)}</strong></span>
                          <span className={item.groundingMatched ? 'text-emerald-600 font-semibold' : 'text-amber-600'}>
                            {item.groundingMatched ? '✓ Grounded' : '⚠️ Unmatched'}
                          </span>
                        </div>
                      </div>

                      <p className="font-medium text-foreground text-sm">{item.question}</p>
                      <p className="text-muted-foreground italic text-xs bg-muted/40 p-2.5 rounded-lg border border-border/40">
                        "{item.generatedAnswerPreview}..."
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>

            {/* Tab 3: Novelty */}
            <TabsContent value="novelty" className="space-y-4">
              <Card className="p-6 space-y-4">
                <h3 className="text-base font-bold flex items-center gap-2 border-b border-border pb-3">
                  <Target className="w-5 h-5 text-primary" />
                  Assessment Question Novelty & Repetition Metrics
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-border bg-card text-center space-y-1">
                    <span className="text-xs text-muted-foreground">Unique Question Ratio</span>
                    <div className="text-3xl font-black text-emerald-600">
                      {pct(report.noveltyMetrics.uniqueQuestionPercentage)}
                    </div>
                    <p className="text-[11px] text-muted-foreground">Goal: &ge; 90% unique stems</p>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-card text-center space-y-1">
                    <span className="text-xs text-muted-foreground">Exact Duplicate Rate</span>
                    <div className="text-3xl font-black text-foreground">
                      {pct(report.noveltyMetrics.exactDuplicateRate)}
                    </div>
                    <p className="text-[11px] text-muted-foreground">Target: &le; 5% exact duplicates</p>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-card text-center space-y-1">
                    <span className="text-xs text-muted-foreground">Semantic Duplicate Rate</span>
                    <div className="text-3xl font-black text-foreground">
                      {pct(report.noveltyMetrics.semanticDuplicateRate)}
                    </div>
                    <p className="text-[11px] text-muted-foreground">High-similarity paraphrase rate</p>
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* Tab 4: Raw JSON */}
            <TabsContent value="raw" className="space-y-4">
              <Card className="p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-primary" />
                    Machine-Readable Evaluation JSON
                  </h3>
                  <Button size="sm" variant="outline" onClick={() => setShowRawJson(!showRawJson)}>
                    {showRawJson ? 'Hide JSON' : 'Show Full JSON'}
                  </Button>
                </div>

                {showRawJson && (
                  <pre className="p-4 rounded-xl bg-muted/60 border border-border text-xs font-mono overflow-x-auto max-h-[500px]">
                    {JSON.stringify(report, null, 2)}
                  </pre>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};
