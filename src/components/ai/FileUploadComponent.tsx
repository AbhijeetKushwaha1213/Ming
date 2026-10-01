
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FileUploadComponentProps {
  onFileContent: (content: string, fileName: string) => void;
}

export const FileUploadComponent = ({ onFileContent }: FileUploadComponentProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    const allowedTypes = ['text/plain', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Unsupported file type",
        description: "Please upload a PDF or text file.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    
    try {
      let content = '';
      
      if (file.type === 'text/plain') {
        content = await file.text();
      } else if (file.type === 'application/pdf') {
        // For PDF files, we'll need to implement PDF parsing
        // For now, let's show a message about PDF support
        toast({
          title: "PDF Upload",
          description: "PDF parsing will be implemented soon. Please use text files for now.",
          variant: "default",
        });
        setIsUploading(false);
        return;
      }

      if (content.length > 50000) {
        toast({
          title: "File too large",
          description: "Please upload files smaller than 50KB.",
          variant: "destructive",
        });
        setIsUploading(false);
        return;
      }

      setUploadedFile(file.name);
      onFileContent(content, file.name);
      
      toast({
        title: "File uploaded successfully",
        description: `${file.name} has been processed.`,
      });
    } catch (error) {
      console.error('File upload error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to process the file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const clearFile = () => {
    setUploadedFile(null);
    onFileContent('', '');
  };

  return (
    <div className="space-y-3">
      <Label htmlFor="file-upload">Upload Notes or Documents</Label>
      
      {!uploadedFile ? (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-400 transition-colors">
          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600 mb-2">
            Upload your notes, documents, or study materials
          </p>
          <p className="text-xs text-gray-500 mb-3">
            Supported formats: PDF, TXT (Max: 50KB)
          </p>
          <Input
            id="file-upload"
            type="file"
            accept=".pdf,.txt"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            disabled={isUploading}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            {isUploading ? 'Processing...' : 'Choose File'}
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-800">{uploadedFile}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearFile}
            className="text-green-600 hover:text-green-800"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
