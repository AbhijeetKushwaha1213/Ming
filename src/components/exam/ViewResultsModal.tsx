import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart3, TrendingUp, Calendar, Clock } from 'lucide-react';

interface ViewResultsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ViewResultsModal = ({ open, onOpenChange }: ViewResultsModalProps) => {
  const mockResults = [
    {
      id: 1,
      name: 'JEE Main Practice Test 1',
      date: '2024-01-10',
      score: 85,
      totalMarks: 100,
      subjects: {
        physics: 28,
        chemistry: 32,
        mathematics: 25
      },
      rank: 1250,
      duration: '3h 0m'
    },
    {
      id: 2,
      name: 'Physics Full Test',
      date: '2024-01-08',
      score: 78,
      totalMarks: 100,
      subjects: {
        physics: 78
      },
      rank: 2100,
      duration: '1h 30m'
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <span>Test Results & Performance</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {mockResults.map((result) => (
            <Card key={result.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{result.name}</h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                    <span className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {new Date(result.date).toLocaleDateString()}
                    </span>
                    <span className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {result.duration}
                    </span>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Rank #{result.rank}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Overall Score</span>
                    <span className="text-lg font-bold text-indigo-600">
                      {result.score}/{result.totalMarks}
                    </span>
                  </div>
                  <Progress value={(result.score / result.totalMarks) * 100} className="h-3" />
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Subject Breakdown</h4>
                  {Object.entries(result.subjects).map(([subject, score]) => (
                    <div key={subject} className="flex justify-between text-sm">
                      <span className="capitalize">{subject}</span>
                      <span className="font-medium">{score}/100</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex space-x-2">
                <Button variant="outline" size="sm" className="flex-1">
                  View Detailed Report
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  Retake Test
                </Button>
              </div>
            </Card>
          ))}

          <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <div className="flex items-center space-x-3">
              <TrendingUp className="w-8 h-8 text-blue-600" />
              <div>
                <h3 className="font-semibold text-gray-900">Performance Insights</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Your math scores are consistently improving! Focus on organic chemistry for better overall performance.
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="premium">
            Download All Reports
          </Button>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Coming Soon:</strong> Advanced analytics, comparison with peers, and AI-powered recommendations.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};