
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play } from "lucide-react";

interface MiniTerminalProps {
  terminalOutput: string[];
  terminalInput: string;
  onTerminalInputChange: (input: string) => void;
  onTerminalExecute: () => void;
}

export default function MiniTerminal({
  terminalOutput,
  terminalInput,
  onTerminalInputChange,
  onTerminalExecute
}: MiniTerminalProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="font-medium mb-2">Quick Terminal</h3>
        <div className="bg-black text-green-400 font-mono p-2 rounded text-xs h-32 overflow-y-auto">
          {terminalOutput.slice(-5).map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
        <div className="flex gap-1 mt-2">
          <Input 
            placeholder="cmd..."
            value={terminalInput}
            onChange={(e) => onTerminalInputChange(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && onTerminalExecute()}
            className="font-mono text-xs"
          />
          <Button onClick={onTerminalExecute} size="sm" className="px-2">
            <Play className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
