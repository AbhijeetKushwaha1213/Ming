import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Trash2, Calendar, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DeleteTrackerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DeleteTrackerModal = ({ open, onOpenChange }: DeleteTrackerModalProps) => {
  const [selectedTrackers, setSelectedTrackers] = useState<number[]>([]);
  const { toast } = useToast();

  const trackers = [
    {
      id: 1,
      name: 'JEE Main 2026 Preparation',
      type: 'exam',
      startDate: '2026-06-01',
      endDate: '2027-04-15',
      progress: 87,
      status: 'active'
    },
    {
      id: 2,
      name: 'Physics Chapter Tracker',
      type: 'subject',
      startDate: '2026-09-01',
      endDate: '2026-12-15',
      progress: 65,
      status: 'active'
    },
    {
      id: 3,
      name: 'Mock Test Series',
      type: 'test',
      startDate: '2026-10-01',
      endDate: '2026-12-31',
      progress: 45,
      status: 'paused'
    }
  ];

  const handleToggleTracker = (trackerId: number) => {
    setSelectedTrackers(prev => 
      prev.includes(trackerId) 
        ? prev.filter(id => id !== trackerId)
        : [...prev, trackerId]
    );
  };

  const handleDelete = () => {
    if (selectedTrackers.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one tracker to delete.",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Trackers Deleted",
      description: `${selectedTrackers.length} tracker(s) have been permanently deleted.`,
    });
    
    setSelectedTrackers([]);
    onOpenChange(false);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'exam': return 'bg-red-100 text-red-800';
      case 'subject': return 'bg-blue-100 text-blue-800';
      case 'test': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Trash2 className="w-5 h-5 text-red-600" />
            <span>Delete Study Trackers</span>
          </DialogTitle>
        </DialogHeader>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-800">Warning</h3>
              <p className="text-sm text-red-700 mt-1">
                Deleting trackers will permanently remove all associated data, progress, and history. This action cannot be undone.
              </p>
            </div>
          </div>
        </div>
        
        <div className="space-y-3 py-4">
          <h3 className="font-medium text-gray-900">Select trackers to delete:</h3>
          
          {trackers.map((tracker) => (
            <Card 
              key={tracker.id} 
              className={`p-4 cursor-pointer transition-colors ${
                selectedTrackers.includes(tracker.id) 
                  ? 'border-red-500 bg-red-50' 
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => handleToggleTracker(tracker.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="font-semibold">{tracker.name}</h4>
                    <Badge className={getTypeColor(tracker.type)}>
                      {tracker.type}
                    </Badge>
                    <Badge className={getStatusColor(tracker.status)}>
                      {tracker.status}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {new Date(tracker.startDate).toLocaleDateString()} - {new Date(tracker.endDate).toLocaleDateString()}
                    </span>
                    <span className="flex items-center">
                      <Target className="w-4 h-4 mr-1" />
                      {tracker.progress}% Complete
                    </span>
                  </div>
                </div>
                
                <div className="ml-4">
                  <input
                    type="checkbox"
                    checked={selectedTrackers.includes(tracker.id)}
                    onChange={() => handleToggleTracker(tracker.id)}
                    className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button 
            onClick={handleDelete} 
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            disabled={selectedTrackers.length === 0}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete {selectedTrackers.length > 0 ? `(${selectedTrackers.length})` : ''}
          </Button>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Coming Soon:</strong> Backup and restore functionality, plus the ability to archive trackers instead of deleting them.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};