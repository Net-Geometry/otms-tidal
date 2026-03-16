import { useState } from 'react';
import { Bot, Eye, EyeOff, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AI_MODELS, DEFAULT_MODEL } from '@/lib/bankStatementExtractor';

const API_KEY_STORAGE_KEY = 'otms_ai_api_key';
const MODEL_STORAGE_KEY = 'otms_ai_model';

export function AISettingsSection() {
  const { toast } = useToast();
  const [key, setKey] = useState(() => localStorage.getItem(API_KEY_STORAGE_KEY) || '');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState(() => localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_MODEL);
  const hasKey = !!localStorage.getItem(API_KEY_STORAGE_KEY);

  const handleSave = () => {
    const trimmed = key.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('sk-or-')) {
      toast({ title: 'Invalid key', description: 'OpenRouter API keys start with sk-or-', variant: 'destructive' });
      return;
    }
    localStorage.setItem(API_KEY_STORAGE_KEY, trimmed);
    toast({ title: 'Saved', description: 'API key saved to browser storage' });
  };

  const handleRemove = () => {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    setKey('');
    toast({ title: 'Removed', description: 'API key removed from browser storage' });
  };

  const handleModelChange = (value: string) => {
    setModel(value);
    localStorage.setItem(MODEL_STORAGE_KEY, value);
    toast({ title: 'Model updated', description: `Using ${AI_MODELS.find((m) => m.value === value)?.label}` });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI Settings
        </CardTitle>
        <CardDescription>
          Configure your OpenRouter API key and model for AI-powered features like bank statement extraction.
          The key is stored only in your browser's local storage.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ai-api-key">OpenRouter API Key</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="ai-api-key"
                type={showKey ? 'text' : 'password'}
                placeholder="sk-or-..."
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <Button onClick={handleSave} disabled={!key.trim()}>
              Save
            </Button>
            {hasKey && (
              <Button variant="destructive" size="icon" onClick={handleRemove}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Get your key at openrouter.ai. Stored locally in this browser only.
          </p>
        </div>

        <div className="space-y-2">
          <Label>AI Model</Label>
          <Select value={model} onValueChange={handleModelChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_MODELS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
