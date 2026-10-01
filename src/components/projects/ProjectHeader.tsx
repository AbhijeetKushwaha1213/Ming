
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Timer, Code, ExternalLink } from "lucide-react";

interface ProjectHeaderProps {
  projectName: string;
  projectType: string;
  deadline: string;
  timer: number;
  isRunning: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}

export default function ProjectHeader({
  projectName,
  projectType,
  deadline,
  timer,
  isRunning,
  onStart,
  onPause,
  onReset
}: ProjectHeaderProps) {
  const openVSCode = () => {
    window.open("vscode://file/your-project-path", "_blank");
  };

  const openLeetCode = () => {
    window.open("https://leetcode.com/problems/two-sum/", "_blank");
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-2xl font-semibold mb-2">{projectName}</h2>
        <p className="text-muted-foreground">{projectType} · Due in {deadline}</p>
        <div className="flex items-center gap-4 mt-4">
          <Timer className="text-purple-600" />
          <span className="text-xl font-bold">{Math.floor(timer / 60)}:{("0" + (timer % 60)).slice(-2)}</span>
          <Button onClick={onStart} disabled={isRunning} className="ml-4">Start</Button>
          <Button onClick={onPause} disabled={!isRunning} variant="secondary">Pause</Button>
          <Button onClick={onReset} variant="ghost">Reset</Button>
        </div>
        
        <div className="flex gap-2 mt-4">
          <Button onClick={openVSCode} variant="outline" size="sm" className="flex items-center gap-2">
            <Code className="w-4 h-4" />
            Open VS Code
            <ExternalLink className="w-3 h-3" />
          </Button>
          <Button onClick={openLeetCode} variant="outline" size="sm" className="flex items-center gap-2 bg-orange-50 hover:bg-orange-100">
            <div className="w-4 h-4 bg-orange-500 rounded text-white text-xs flex items-center justify-center font-bold">LC</div>
            Practice Problem
            <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
