
import { Card, CardContent } from "@/components/ui/card";

export default function TipsCard() {
  return (
    <Card>
      <CardContent className="p-4 text-sm">
        <h4 className="font-semibold mb-1">Tips & Suggestions</h4>
        <ul className="list-disc pl-4 space-y-1">
          <li>Break large tasks into smaller steps.</li>
          <li>Keep pushing code regularly.</li>
          <li>Stay consistent — 1 hour daily.</li>
          <li>Use quick navigation to stay focused.</li>
        </ul>
      </CardContent>
    </Card>
  );
}
