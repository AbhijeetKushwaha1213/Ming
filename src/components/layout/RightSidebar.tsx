import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  X, 
  Plus, 
  Trash2, 
  CheckCircle2,
  Circle,
  Calendar,
  Bell
} from 'lucide-react';
import { Card } from '@/components/ui/card';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Date;
}

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RightSidebar = ({ isOpen, onClose }: RightSidebarProps) => {
  const [todos, setTodos] = useState<Todo[]>(() => {
    const saved = localStorage.getItem('studymate-todos');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Convert createdAt strings back to Date objects
      return parsed.map((todo: any) => ({
        ...todo,
        createdAt: new Date(todo.createdAt)
      }));
    }
    return [];
  });
  const [newTodo, setNewTodo] = useState('');

  // Save todos to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('studymate-todos', JSON.stringify(todos));
  }, [todos]);

  const addTodo = () => {
    if (newTodo.trim()) {
      const todo: Todo = {
        id: Date.now().toString(),
        text: newTodo.trim(),
        completed: false,
        createdAt: new Date(),
      };
      setTodos([todo, ...todos]);
      setNewTodo('');
    }
  };

  const toggleTodo = (id: string) => {
    setTodos(todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addTodo();
    }
  };

  const completedCount = todos.filter(t => t.completed).length;
  const totalCount = todos.length;

  return (
    <div
      className={`fixed top-0 right-0 h-full bg-background border-l border-border shadow-lg transition-all duration-300 ease-in-out z-30 ${
        isOpen ? 'w-full sm:w-80 translate-x-0' : 'w-0 translate-x-full'
      }`}
    >
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-border flex-shrink-0">
          <div className="flex items-center space-x-2">
            <Bell className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">To-Do & Reminders</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Stats */}
        {totalCount > 0 && (
          <div className="px-4 py-3 bg-accent/50 border-b border-border">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium text-foreground">
                {completedCount} / {totalCount} completed
              </span>
            </div>
            <div className="mt-2 h-2 bg-background rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Add Todo Input */}
        <div className="p-4 border-b border-border flex-shrink-0">
          <div className="flex space-x-2">
            <Input
              placeholder="Add a new task..."
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button
              onClick={addTodo}
              size="sm"
              className="px-3"
              disabled={!newTodo.trim()}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Todo List */}
        <div className="flex-1 px-4 py-2 overflow-y-auto">
          {todos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <Calendar className="w-12 h-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No tasks yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add your first task above</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todos.map((todo) => (
                <Card
                  key={todo.id}
                  className={`p-3 transition-all duration-200 hover:shadow-md ${
                    todo.completed ? 'bg-accent/30' : 'bg-card'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <button
                      onClick={() => toggleTodo(todo.id)}
                      className="mt-0.5 flex-shrink-0"
                    >
                      {todo.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm break-words ${
                          todo.completed
                            ? 'line-through text-muted-foreground'
                            : 'text-foreground'
                        }`}
                      >
                        {todo.text}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(todo.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteTodo(todo.id)}
                      className="h-8 w-8 p-0 flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {todos.length > 0 && (
          <div className="p-4 border-t border-border flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTodos(todos.filter(t => !t.completed))}
              className="w-full"
              disabled={completedCount === 0}
            >
              Clear Completed ({completedCount})
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
