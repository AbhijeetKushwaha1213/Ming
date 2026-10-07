import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  GitFork,
  X,
  Sparkles,
  BookOpen,
  ArrowRight,
  Headphones,
  Wand2,
  ShieldCheck,
  CheckCircle2,
  Lock,
  AlertCircle,
  Eye,
  Layers,
  Compass,
} from 'lucide-react';
import { DAGGraphData, DAGNode } from '@/types/dag';
import { AudioBriefViewer } from './AudioBriefViewer';
import { navigateToTab } from '@/utils/navigation';
import { detectPrerequisiteGaps, computeRecommendedLearningPath } from '@/utils/dagEngine';

interface DAGViewerProps {
  dagData: DAGGraphData;
  title: string;
  topic?: string;
  difficulty?: string;
  onClose: () => void;
}

export const DAGViewer: React.FC<DAGViewerProps> = ({
  dagData,
  title,
  topic,
  difficulty,
  onClose,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    dagData.nodes[0]?.id || null
  );
  const [activeAudioBrief, setActiveAudioBrief] = useState<any>(null);

  const nodeMap = useMemo(() => {
    const map = new Map<string, DAGNode>();
    dagData.nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [dagData]);

  const selectedNode = useMemo(() => {
    return dagData.nodes.find(n => n.id === selectedNodeId) || dagData.nodes[0];
  }, [dagData, selectedNodeId]);

  const gapAnalysis = useMemo(() => {
    if (!selectedNode) return { hasGap: false, incompletePrerequisites: [] };
    return detectPrerequisiteGaps(selectedNode.id, dagData.nodes);
  }, [selectedNode, dagData]);

  const recommendedSteps = useMemo(() => {
    return computeRecommendedLearningPath(dagData.nodes);
  }, [dagData]);

  // Layout bounds
  const columnWidth = 250;
  const rowHeight = 135;
  const paddingX = 35;
  const paddingY = 35;

  const nodePositions = useMemo(() => {
    const pos = new Map<string, { x: number; y: number }>();
    dagData.nodes.forEach(n => {
      const x = paddingX + n.level * columnWidth;
      const y = paddingY + n.row * rowHeight;
      pos.set(n.id, { x, y });
    });
    return pos;
  }, [dagData]);

  const maxLevel = Math.max(...dagData.nodes.map(n => n.level), 0);
  const maxRow = Math.max(...dagData.nodes.map(n => n.row), 0);
  const canvasWidth = Math.max(860, paddingX * 2 + (maxLevel + 1) * columnWidth);
  const canvasHeight = Math.max(420, paddingY * 2 + (maxRow + 1) * rowHeight);

  // Edges
  const edges = useMemo(() => {
    const list: Array<{ path: string; isMet: boolean; isGap: boolean }> = [];
    dagData.nodes.forEach(node => {
      const toPos = nodePositions.get(node.id);
      if (!toPos) return;

      node.prerequisites.forEach(pid => {
        const fromPos = nodePositions.get(pid);
        if (!fromPos) return;

        const pNode = nodeMap.get(pid);
        const startX = fromPos.x + 205;
        const startY = fromPos.y + 42;
        const endX = toPos.x;
        const endY = toPos.y + 42;

        const c1X = startX + (endX - startX) * 0.5;
        const c1Y = startY;
        const c2X = startX + (endX - startX) * 0.5;
        const c2Y = endY;

        const path = `M ${startX} ${startY} C ${c1X} ${c1Y}, ${c2X} ${c2Y}, ${endX} ${endY}`;
        const pStatus = pNode?.status || 'proficient';
        const isMet = pStatus === 'mastered' || pStatus === 'proficient';
        const isGap = pStatus === 'weak' || pStatus === 'locked';

        list.push({ path, isMet, isGap });
      });
    });
    return list;
  }, [dagData, nodePositions, nodeMap]);

  return (
    <div className="space-y-5 animate-in fade-in-0 duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <GitFork className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-serif font-bold text-foreground flex items-center gap-2">
              {title}
              <Badge variant="outline" className="text-xs bg-secondary text-secondary-foreground border-border">
                Vault DAG
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground">
              {topic} • {dagData.nodes.length} Concepts • Learning Goal: {dagData.learningGoal || 'Mastery'}
            </p>
          </div>
        </div>

        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Main Canvas & Inspector */}
      <Card className="rounded-2xl border border-border overflow-hidden bg-card">
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[480px]">
          {/* SVG Canvas */}
          <div className="lg:col-span-8 p-4 overflow-x-auto overflow-y-auto bg-muted/10 relative border-b lg:border-b-0 lg:border-r border-border">
            <div className="relative select-none" style={{ width: canvasWidth, height: canvasHeight }}>
              <svg className="absolute inset-0 pointer-events-none" width={canvasWidth} height={canvasHeight}>
                <defs>
                  <marker id="viewer-arrow-met" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" className="fill-emerald-600 dark:fill-emerald-400" />
                  </marker>
                  <marker id="viewer-arrow-gap" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" className="fill-amber-600 dark:fill-amber-400" />
                  </marker>
                  <marker id="viewer-arrow-unmet" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" className="fill-slate-400 dark:fill-slate-500" />
                  </marker>
                </defs>

                {edges.map((e, idx) => (
                  <path
                    key={idx}
                    d={e.path}
                    fill="none"
                    className={
                      e.isMet
                        ? 'stroke-emerald-600 dark:stroke-emerald-400'
                        : e.isGap
                        ? 'stroke-amber-600 dark:stroke-amber-400'
                        : 'stroke-slate-400 dark:stroke-slate-500'
                    }
                    strokeWidth={e.isMet ? '2.5' : '1.75'}
                    strokeDasharray={e.isMet ? 'none' : '4 3'}
                    markerEnd={e.isMet ? 'url(#viewer-arrow-met)' : e.isGap ? 'url(#viewer-arrow-gap)' : 'url(#viewer-arrow-unmet)'}
                  />
                ))}
              </svg>

              {dagData.nodes.map(node => {
                const pos = nodePositions.get(node.id);
                if (!pos) return null;
                const isSelected = selectedNodeId === node.id;

                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNodeId(node.id)}
                    style={{
                      position: 'absolute',
                      left: `${pos.x}px`,
                      top: `${pos.y}px`,
                      width: '205px',
                      height: '88px',
                    }}
                    className={`p-3 rounded-xl bg-card border cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected ? 'ring-2 ring-primary border-primary shadow-sm bg-accent/20' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-xs font-bold text-foreground line-clamp-2 leading-tight">
                        {node.title}
                      </span>
                      {node.status === 'locked' ? (
                        <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2
                          className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                            node.status === 'mastered' ? 'text-primary' : 'text-sky-600'
                          }`}
                        />
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px]">
                      <span className="text-muted-foreground truncate max-w-[95px]">{node.subtopic}</span>
                      <Badge variant="secondary" className="text-[9px] py-0 px-1">
                        {node.difficulty}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Inspector */}
          <div className="lg:col-span-4 p-5 bg-card flex flex-col justify-between space-y-4">
            {selectedNode && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                      {selectedNode.subtopic}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {selectedNode.difficulty}
                    </Badge>
                  </div>
                  <h4 className="text-lg font-serif font-bold text-foreground">{selectedNode.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    {selectedNode.description}
                  </p>
                </div>

                {/* Gap Notice */}
                {gapAnalysis.hasGap && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs">
                    <span className="font-bold block">⚠️ Prerequisite Gap</span>
                    <p className="text-[11px] mt-0.5">{gapAnalysis.guidance}</p>
                  </div>
                )}

                {/* Source Info */}
                <div className="p-3 rounded-xl bg-muted/20 border border-border text-xs space-y-1">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-primary" /> Source Reference:
                  </span>
                  <p className="font-medium text-foreground">{selectedNode.sourceOrigin?.coordinate}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{selectedNode.sourceOrigin?.documentTitle}</p>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <Button
                    onClick={() => {
                      navigateToTab('ai', undefined, {
                        topic: selectedNode.topic,
                        initialMessage: `Explain concept: "${selectedNode.title}" from ${selectedNode.topic}.`,
                      });
                    }}
                    className="w-full text-xs h-8 gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Ask AI Tutor</span>
                  </Button>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => navigateToTab('flashcards', 'generate', { topic: selectedNode.title })}
                      className="text-xs h-8 gap-1"
                    >
                      <Wand2 className="w-3.5 h-3.5 text-primary" />
                      <span>AI Materials</span>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => navigateToTab('flashcards', 'assessment', { topic: selectedNode.title })}
                      className="text-xs h-8 gap-1"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Quiz</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Recommended Learning Path */}
      <Card className="p-4 border-border bg-card">
        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 mb-3">
          <Compass className="w-3.5 h-3.5 text-primary" /> Recommended Learning Sequence:
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {recommendedSteps.map(step => (
            <div
              key={step.nodeId}
              onClick={() => setSelectedNodeId(step.nodeId)}
              className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                selectedNodeId === step.nodeId ? 'ring-2 ring-primary border-primary' : 'border-border hover:bg-muted/40'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <span>#{step.stepNumber}</span>
                <Badge variant="outline" className="text-[9px] py-0 px-1">
                  {step.status}
                </Badge>
              </div>
              <p className="font-semibold text-foreground truncate">{step.title}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
