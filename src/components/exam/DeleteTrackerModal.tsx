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
      case 'exam': return 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-300 dark:border-red-500/30';
      case 'subject': return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-500/30';
      case 'test': return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30';
      case 'paused': return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30';
      case 'completed': return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-500/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            <span className="text-foreground">Delete Study Trackers</span>
          </DialogTitle>
        </DialogHeader>

        <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-4 mb-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div>
              <h3 className="font-medium text-rose-800 dark:text-rose-300">Warning</h3>
              <p className="text-sm text-rose-700 dark:text-rose-200 mt-1">
                Deleting trackers will permanently remove all associated data, progress, and history. This action cannot be undone.
              </p>
            </div>
          </div>
        </div>
        
        <div className="space-y-3 py-4">
          <h3 className="font-medium text-foreground">Select trackers to delete:</h3>
          
          {trackers.map((tracker) => (
            <Card 
              key={tracker.id} 
              className={`p-4 cursor-pointer transition-colors ${
                selectedTrackers.includes(tracker.id) 
                  ? 'border-rose-500 bg-rose-500/10' 
                  : 'hover:bg-muted/50 border-border'
              }`}
              onClick={() => handleToggleTracker(tracker.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="font-semibold text-foreground">{tracker.name}</h4>
                    <Badge className={getTypeColor(tracker.type)}>
                      {tracker.type}
                    </Badge>
                    <Badge className={getStatusColor(tracker.status)}>
                      {tracker.status}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
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
                    className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500"
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
            className="flex-1 bg-rose-600 hover:bg-rose-700 text-white"
            disabled={selectedTrackers.length === 0}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete {selectedTrackers.length > 0 ? `(${selectedTrackers.length})` : ''}
          </Button>
        </div>

        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Coming Soon:</strong> Backup and restore functionality, plus the ability to archive trackers instead of deleting them.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};