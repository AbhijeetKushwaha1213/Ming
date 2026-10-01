import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { useSubjects } from '@/hooks/useSubjects';

interface AddSubjectDialogProps {
  trigger?: React.ReactNode;
}

export const AddSubjectDialog = ({ trigger }: AddSubjectDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [totalTopics, setTotalTopics] = useState(10);
  const { createSubject, isCreating } = useSubjects();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createSubject(
      { name: name.trim(), total_topics: totalTopics },
      {
        onSuccess: () => {
          setOpen(false);
          setName('');
          setTotalTopics(10);
        }
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Subject
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Subject</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject-name">Subject Name</Label>
            <Input
              id="subject-name"
              placeholder="e.g., Physics, Mathematics"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="total-topics">Total Topics</Label>
            <Input
              id="total-topics"
              type="number"
              min="1"
              max="100"
              value={totalTopics}
              onChange={(e) => setTotalTopics(Number(e.target.value))}
              required
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button 
              type="submit" 
              disabled={isCreating || !name.trim()}
              className="flex-1"
            >
              {isCreating ? 'Adding...' : 'Add Subject'}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};