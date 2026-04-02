import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { contentApi } from '@/api/content.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ContentType } from '@checc/shared/types/content.types';
import type { ArticleDto, SensitiveWordHit } from '@checc/shared/types/content.types';
import { Save, Loader2, Upload, X, AlertTriangle, CheckCircle } from 'lucide-react';

export function ArticleCreatePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [contentType, setContentType] = useState<ContentType>(ContentType.ARTICLE);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sensitiveWarnings, setSensitiveWarnings] = useState<SensitiveWordHit[]>([]);
  const [createdArticleId, setCreatedArticleId] = useState<string | null>(null);

  const handleAddMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setMediaFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleRemoveMedia = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await contentApi.create({ title, body, contentType });
      const article = res.data as ArticleDto;

      // Upload media files after article creation — failures are non-fatal
      const uploadErrors: string[] = [];
      for (const file of mediaFiles) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          await contentApi.uploadMedia(article.id, formData);
        } catch {
          uploadErrors.push(file.name);
        }
      }
      if (uploadErrors.length > 0) {
        setError(`Article created, but ${uploadErrors.length} media upload(s) failed: ${uploadErrors.join(', ')}`);
      }

      // Show sensitive word warnings if any, otherwise navigate away
      if (article.sensitiveWordHits && article.sensitiveWordHits.length > 0) {
        setSensitiveWarnings(article.sensitiveWordHits);
        setCreatedArticleId(article.id);
      } else {
        navigate('/content');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Article</h1>
        <p className="text-muted-foreground">Create a new content piece</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">Article Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Article title" />
          </div>
          <div>
            <Label htmlFor="contentType">Content Type</Label>
            <select
              id="contentType"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={contentType}
              onChange={(e) => setContentType(e.target.value as ContentType)}
            >
              {Object.values(ContentType).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="body">Body</Label>
            <textarea
              id="body"
              className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your content..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Media Assets</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,audio/*,video/*"
            multiple
            className="hidden"
            onChange={handleAddMedia}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Add Media
          </Button>

          {mediaFiles.length > 0 && (
            <div className="space-y-2">
              {mediaFiles.map((file, i) => (
                <div key={i} className="flex items-center justify-between rounded border p-2 text-sm">
                  <span className="truncate">{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveMedia(i)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {mediaFiles.length === 0 && (
            <p className="text-sm text-muted-foreground">No media files added. You can attach images, audio, or video.</p>
          )}
        </CardContent>
      </Card>

      {/* Sensitive word warnings shown after creation */}
      {sensitiveWarnings.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-5 w-5" />
              Sensitive Content Detected
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-yellow-700">The following sensitive words were detected in your article. Please review before submitting for review.</p>
            {sensitiveWarnings.map((hit, i) => (
              <div key={i} className="text-sm flex items-center gap-2">
                <Badge variant={hit.severity === 'HIGH' ? 'destructive' : 'warning'}>{hit.severity}</Badge>
                <span className="font-mono">{hit.word}</span>
                <span className="text-muted-foreground">— {hit.context}</span>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => navigate(`/content`)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Acknowledge & Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!createdArticleId && (
        <Button onClick={handleSave} disabled={isSaving || !title || !body}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Create Article
        </Button>
      )}
    </div>
  );
}
