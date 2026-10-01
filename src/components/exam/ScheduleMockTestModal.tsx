import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ScheduleMockTestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ScheduleMockTestModal = ({ open, onOpenChange }: ScheduleMockTestModalProps) => {
  const [testName, setTestName] = useState('');
  const [subject, setSubject] = useState('');
  const [date, setDate] = useState('');
  const [duration, setDuration] = useState('');
  const { toast } = useToast();

  const handleSchedule = () => {
    if (!testName || !subject || !date || !duration) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields to schedule the mock test.",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Mock Test Scheduled! 📅",
      description: `${testName} scheduled for ${date}`,
    });
    
    // Reset form
    setTestName('');
    setSubject('');
    setDate('');
    setDuration('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <span>Schedule Mock Test</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="testName">Test Name</Label>
            <Input
              id="testName"
              placeholder="e.g., JEE Main Practice Test 1"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger>
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="physics">Physics</SelectItem>
                <SelectItem value="chemistry">Chemistry</SelectItem>
                <SelectItem value="mathematics">Mathematics</SelectItem>
                <SelectItem value="mixed">Mixed (All Subjects)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Test Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="90">1.5 hours</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
                <SelectItem value="180">3 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSchedule} variant="premium" className="flex-1">
            <Clock className="w-4 h-4 mr-2" />
            Schedule Test
          </Button>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Coming Soon:</strong> Full mock test integration with performance analytics and detailed reports.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};