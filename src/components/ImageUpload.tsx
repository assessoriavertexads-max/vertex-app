import { useRef, useState } from 'react';
import { Upload, X, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface Props {
  bucket: string;
  value?: string;
  onChange: (url: string | undefined) => void;
  className?: string;
  previewClassName?: string;
  label?: string;
}

export function ImageUpload({ bucket, value, onChange, className = '', previewClassName = 'h-32', label = 'Clique ou arraste uma imagem' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const ext  = file.name.split('.').pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (e: unknown) {
      toast.error('Erro ao enviar imagem: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setUploading(false);
    }
  };

  const handleFile = (files: FileList | null) => {
    if (!files?.length) return;
    upload(files[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files);
  };

  if (value) {
    return (
      <div className={`relative inline-block ${className}`}>
        <img
          src={value}
          alt="upload preview"
          className={`${previewClassName} w-auto rounded-lg border border-border object-contain bg-muted/20`}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.3'; }}
        />
        <div className="absolute top-1 right-1 flex gap-1">
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-6 w-6 rounded-full shadow"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            title="Trocar imagem"
          >
            <RefreshCw className={`h-3 w-3 ${uploading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="h-6 w-6 rounded-full shadow"
            onClick={() => onChange(undefined)}
            title="Remover imagem"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => handleFile(e.target.files)} />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 cursor-pointer hover:border-primary/60 hover:bg-muted/40 transition-colors p-6 text-center ${className}`}
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {uploading
        ? <RefreshCw className="h-6 w-6 text-muted-foreground animate-spin" />
        : <Upload className="h-6 w-6 text-muted-foreground" />
      }
      <p className="text-xs text-muted-foreground">{uploading ? 'Enviando...' : label}</p>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => handleFile(e.target.files)} />
    </div>
  );
}
