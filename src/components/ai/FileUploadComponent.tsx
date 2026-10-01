import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, X, Video, Presentation, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ingestSource } from '@/api/ragAPI';

interface FileUploadComponentProps {
  onFileContent: (content: string, fileName: string) => void;
  topic?: string;
  userId?: string;
}

export const FileUploadComponent = ({ onFileContent, topic = 'General', userId = 'default_user' }: FileUploadComponentProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [chunksCount, setChunksCount] = useState<number | null>(null);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedExtensions = ['.pdf', '.pptx', '.ppt', '.txt', '.mp4', '.mp3', '.wav', '.m4a'];
    const fileName = file.name.toLowerCase();
    const isAllowed = allowedExtensions.some(ext => fileName.endsWith(ext));

    if (!isAllowed) {
      toast({
        title: "Unsupported file type",
        description: "Please upload a PDF, PPT/PPTX slide deck, audio/video lecture, or text file.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Direct text shortcut if plain text and small
      if (file.type === 'text/plain' && file.size < 25000) {
        const textContent = await file.text();
        setUploadedFile(file.name);
        onFileContent(textContent, file.name);
        toast({
          title: "File loaded",
          description: `${file.name} ready for study generation.`,
        });
        setIsUploading(false);
        return;
      }

      // Ingest via Multimodal RAG Engine (PDF page-by-page, PPTX slide-by-slide, Video timestamps)
      const res = await ingestSource({
        file,
        topic,
        userId,
        title: file.name,
      });

      if (!res.success && res.chunkCount === 0) {
        throw new Error("Could not extract chunks from document");
      }

      setUploadedFile(file.name);
      setChunksCount(res.chunkCount);

      // Concatenate top preview snippets to pass back as context
      const aggregatedText = res.previewChunks.map(c => c.snippet).join('\n\n');
      onFileContent(aggregatedText, file.name);

      toast({
        title: "Document Ingested into Knowledge Base",
        description: `${file.name} indexed successfully into ChromaDB (${res.chunkCount} grounded chunks created).`,
      });
    } catch (error) {
      console.error('File upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to process the file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const clearFile = () => {
    setUploadedFile(null);
    setChunksCount(null);
    onFileContent('', '');
  };

  const getFileIcon = (name: string) => {
    if (name.endsWith('.pdf')) return <FileText className="w-5 h-5 text-indigo-600" />;
    if (name.match(/\.pptx?$/i)) return <Presentation className="w-5 h-5 text-amber-600" />;
    if (name.match(/\.(mp4|webm|mp3|wav|m4a)$/i)) return <Video className="w-5 h-5 text-purple-600" />;
    return <FileText className="w-5 h-5 text-green-600" />;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="file-upload">Upload Lecture Material (Multimodal)</Label>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px] py-0">PDF</Badge>
          <Badge variant="outline" className="text-[10px] py-0">PPTX</Badge>
          <Badge variant="outline" className="text-[10px] py-0">Video/Audio</Badge>
        </div>
      </div>
      
      {!uploadedFile ? (
        <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors bg-card/50">
          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2 animate-pulse" />
          <p className="text-sm font-medium text-foreground mb-1">
            Drag & drop or browse lecture sources
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Supports Textbooks (PDF), Slide Decks (PPTX), Audio/Video Lectures & Notes
          </p>
          <Input
            id="file-upload"
            type="file"
            accept=".pdf,.pptx,.ppt,.txt,.mp4,.mp3,.wav,.m4a"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            disabled={isUploading}
            onClick={() => document.getElementById('file-upload')?.click()}
            className="gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Extracting & Indexing in Chroma...
              </>
            ) : (
              'Choose Source File'
            )}
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3.5 bg-primary/5 border border-primary/20 rounded-xl">
          <div className="flex items-center space-x-2.5">
            {getFileIcon(uploadedFile)}
            <div>
              <span className="text-sm font-medium text-foreground block">{uploadedFile}</span>
              {chunksCount !== null && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-emerald-500" />
                  {chunksCount} vector chunks preserved with source coordinates
                </span>
              )}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearFile}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
