
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, Trash2, ExternalLink, Play, Square } from "lucide-react";

interface Resource {
  id: number;
  title: string;
  url: string;
  type: string;
}

interface NewResource {
  title: string;
  url: string;
  type: string;
}

interface ProjectTabsProps {
  resources: Resource[];
  newResource: NewResource;
  terminalOutput: string[];
  terminalInput: string;
  onResourceAdd: () => void;
  onResourceRemove: (id: number) => void;
  onNewResourceChange: (resource: NewResource) => void;
  onTerminalInputChange: (input: string) => void;
  onTerminalExecute: () => void;
  onTerminalClear: () => void;
}

export default function ProjectTabs({
  resources,
  newResource,
  terminalOutput,
  terminalInput,
  onResourceAdd,
  onResourceRemove,
  onNewResourceChange,
  onTerminalInputChange,
  onTerminalExecute,
  onTerminalClear
}: ProjectTabsProps) {
  const openVSCode = () => {
    window.open("vscode://file/your-project-path", "_blank");
  };

  const openLeetCode = () => {
    window.open("https://leetcode.com/problems/two-sum/", "_blank");
  };

  return (
    <Tabs defaultValue="vs-code">
      <TabsList>
        <TabsTrigger value="vs-code">VS Code</TabsTrigger>
        <TabsTrigger value="leetcode">LeetCode</TabsTrigger>
        <TabsTrigger value="resources">Resources</TabsTrigger>
        <TabsTrigger value="terminal">Terminal</TabsTrigger>
      </TabsList>

      <TabsContent value="vs-code">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Code Editor</h3>
              <Button onClick={openVSCode} size="sm" variant="outline">
                <ExternalLink className="w-4 h-4 mr-1" />
                Open in VS Code
              </Button>
            </div>
            <Textarea placeholder="Write or paste your code here..." rows={10} className="font-mono" />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="leetcode">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Practice Problems</h3>
              <Button onClick={openLeetCode} size="sm" variant="outline">
                <ExternalLink className="w-4 h-4 mr-1" />
                Open LeetCode
              </Button>
            </div>
            <div className="space-y-2">
              <div className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer" onClick={openLeetCode}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Two Sum</h4>
                    <p className="text-sm text-muted-foreground">Array, Hash Table - Easy</p>
                  </div>
                  <div className="w-6 h-6 bg-orange-500 rounded text-white text-xs flex items-center justify-center font-bold">LC</div>
                </div>
              </div>
              <div className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Valid Parentheses</h4>
                    <p className="text-sm text-muted-foreground">String, Stack - Easy</p>
                  </div>
                  <div className="w-6 h-6 bg-orange-500 rounded text-white text-xs flex items-center justify-center font-bold">LC</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="resources">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-2">
              <Input 
                placeholder="Resource title" 
                value={newResource.title}
                onChange={(e) => onNewResourceChange({...newResource, title: e.target.value})}
              />
              <Input 
                placeholder="Resource URL" 
                value={newResource.url}
                onChange={(e) => onNewResourceChange({...newResource, url: e.target.value})}
              />
              <select 
                value={newResource.type}
                onChange={(e) => onNewResourceChange({...newResource, type: e.target.value})}
                className="w-full p-2 border rounded"
              >
                <option value="documentation">Documentation</option>
                <option value="tutorial">Tutorial</option>
                <option value="article">Article</option>
                <option value="video">Video</option>
                <option value="pdf">PDF</option>
              </select>
              <Button onClick={onResourceAdd} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Resource
              </Button>
            </div>
            
            <div className="space-y-2">
              {resources.map(resource => (
                <div key={resource.id} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <div>
                      <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline">
                        {resource.title}
                      </a>
                      <p className="text-xs text-muted-foreground">{resource.type}</p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => onResourceRemove(resource.id)} 
                    variant="ghost" 
                    size="sm"
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="terminal">
        <Card>
          <CardContent className="p-4">
            <div className="bg-black text-green-400 font-mono p-4 rounded-lg h-64 overflow-y-auto">
              {terminalOutput.map((line, index) => (
                <p key={index} className="text-sm">{line}</p>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input 
                placeholder="Enter command..."
                value={terminalInput}
                onChange={(e) => onTerminalInputChange(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && onTerminalExecute()}
                className="font-mono"
              />
              <Button onClick={onTerminalExecute} size="sm">
                <Play className="w-4 h-4" />
              </Button>
              <Button onClick={onTerminalClear} variant="outline" size="sm">
                <Square className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
