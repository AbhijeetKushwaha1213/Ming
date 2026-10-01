
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function QuickActions() {
  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardContent className="p-4">
        <h3 className="font-medium text-white mb-3">Quick Actions</h3>
        <div className="space-y-2">
          <Button variant="outline" className="w-full border-gray-600 text-gray-300 hover:bg-gray-700">
            View Progress
          </Button>
          <Button variant="outline" className="w-full border-gray-600 text-gray-300 hover:bg-gray-700">
            Submit Update
          </Button>
          <Button className="w-full bg-red-600 hover:bg-red-700">
            Mark Complete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
