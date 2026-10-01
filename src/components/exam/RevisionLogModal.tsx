import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Calendar, Clock, Plus, CheckCircle2, Circle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RevisionLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RevisionLogModal = ({ open, onOpenChange }: RevisionLogModalProps) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newDate, setNewDate] = useState('');
  const { toast } = useToast();

  const revisionEntries = [
    {
      id: 1,
      topic: 'Thermodynamics Laws',
      subject: 'Physics',
      scheduledDate: '2024-01-15',
      completed: true,
      difficulty: 'medium',
      notes: 'Reviewed all 4 laws, practiced numericals'
    },
    {
      id: 2,
      topic: 'Organic Reaction Mechanisms',
      subject: 'Chemistry',
      scheduledDate: '2024-01-15',
      completed: false,
      difficulty: 'hard',
      notes: ''
    },
    {
      id: 3,
      topic: 'Integration by Parts',
      subject: 'Mathematics',
      scheduledDate: '2024-01-16',
      completed: false,
      difficulty: 'medium',
      notes: ''
    },
    {
      id: 4,
      topic: 'Atomic Structure',
      subject: 'Chemistry',
      scheduledDate: '2024-01-14',
      completed: true,
      difficulty: 'easy',
      notes: 'Quick review completed'
    }
  ];

  const handleAddRevision = () => {
    if (!newTopic || !newSubject || !newDate) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields to add revision entry.",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Revision Added! 📚",
      description: `${newTopic} scheduled for revision on ${newDate}`,
    });
    
    setNewTopic('');
    setNewSubject('');
    setNewDate('');
    setShowAddForm(false);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSubjectColor = (subject: string) => {
    switch (subject.toLowerCase()) {
      case 'physics': return 'bg-blue-100 text-blue-800';
      case 'chemistry': return 'bg-purple-100 text-purple-800';
      case 'mathematics': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const todaysRevisions = revisionEntries.filter(entry => entry.scheduledDate === today);
  const upcomingRevisions = revisionEntries.filter(entry => entry.scheduledDate > today);
  const pastRevisions = revisionEntries.filter(entry => entry.scheduledDate < today);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              <span>Revision Log</span>
            </div>
            <Button 
              onClick={() => setShowAddForm(true)} 
              size="sm" 
              variant="premium"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Revision
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        {showAddForm && (
          <Card className="p-4 mb-4 border-indigo-200">
            <h3 className="font-medium mb-3">Add New Revision Entry</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="topic">Topic</Label>
                <Input
                  id="topic"
                  placeholder="e.g., Electromagnetic Induction"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Select value={newSubject} onValueChange={setNewSubject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Physics">Physics</SelectItem>
                    <SelectItem value="Chemistry">Chemistry</SelectItem>
                    <SelectItem value="Mathematics">Mathematics</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="date">Revision Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex space-x-2 mt-3">
              <Button onClick={handleAddRevision} size="sm">Add</Button>
              <Button onClick={() => setShowAddForm(false)} variant="outline" size="sm">Cancel</Button>
            </div>
          </Card>
        )}

        <div className="space-y-6">
          {/* Today's Revisions */}
          {todaysRevisions.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg mb-3 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-indigo-600" />
                Today's Revisions
              </h3>
              <div className="space-y-3">
                {todaysRevisions.map((entry) => (
                  <Card key={entry.id} className="p-4 border-l-4 border-l-indigo-500">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          {entry.completed ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : (
                            <Circle className="w-5 h-5 text-gray-400" />
                          )}
                          <h4 className="font-medium">{entry.topic}</h4>
                          <Badge className={getSubjectColor(entry.subject)}>
                            {entry.subject}
                          </Badge>
                          <Badge className={getDifficultyColor(entry.difficulty)}>
                            {entry.difficulty}
                          </Badge>
                        </div>
                        {entry.notes && (
                          <p className="text-sm text-gray-600 ml-7">{entry.notes}</p>
                        )}
                      </div>
                      <Button variant="outline" size="sm">
                        {entry.completed ? 'Review' : 'Mark Complete'}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Revisions */}
          {upcomingRevisions.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg mb-3 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-blue-600" />
                Upcoming Revisions
              </h3>
              <div className="space-y-3">
                {upcomingRevisions.map((entry) => (
                  <Card key={entry.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Circle className="w-5 h-5 text-gray-400" />
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium">{entry.topic}</h4>
                            <Badge className={getSubjectColor(entry.subject)}>
                              {entry.subject}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">
                            Scheduled for {new Date(entry.scheduledDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Badge className={getDifficultyColor(entry.difficulty)}>
                        {entry.difficulty}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Past Revisions */}
          {pastRevisions.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg mb-3">Recent Revisions</h3>
              <div className="space-y-3">
                {pastRevisions.map((entry) => (
                  <Card key={entry.id} className="p-4 opacity-75">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium">{entry.topic}</h4>
                            <Badge className={getSubjectColor(entry.subject)}>
                              {entry.subject}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">
                            Completed on {new Date(entry.scheduledDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="premium">
            Export Log
          </Button>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Coming Soon:</strong> Spaced repetition algorithm, automatic scheduling based on forgetting curve, and progress analytics.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};