import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ChartOfAccount } from '@/types/finance';

interface COATreeViewProps {
  tree: ChartOfAccount[];
  onEdit: (account: ChartOfAccount) => void;
  onDeactivate: (account: ChartOfAccount) => void;
}

function levelIndent(level: number) {
  if (level <= 1) return 'pl-0';
  if (level === 2) return 'pl-6';
  return 'pl-12';
}

export function COATreeView({ tree, onEdit, onDeactivate }: COATreeViewProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    for (const root of tree) initial[root.id] = true;
    setExpanded((prev) => ({ ...initial, ...prev }));
  }, [tree]);

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderNode = (node: ChartOfAccount) => {
    const hasChildren = !!node.children?.length;
    const isOpen = !!expanded[node.id];

    return (
      <div key={node.id}>
        <div className={`flex items-center gap-2 border-b py-2 ${levelIndent(node.level)}`}>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {hasChildren ? (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggle(node.id)}>
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            ) : (
              <div className="h-7 w-7" />
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{node.account_code}</span>
                <span className="truncate font-medium">{node.account_name}</span>
                {!node.is_active && <Badge variant="secondary">Inactive</Badge>}
                {node.is_postable && <Badge variant="outline">Postable</Badge>}
                {node.system_tag && <Badge variant="outline">{node.system_tag}</Badge>}
              </div>
              {node.description && <p className="truncate text-xs text-muted-foreground">{node.description}</p>}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(node)}>
              <Pencil className="h-4 w-4" />
            </Button>
            {node.is_active && node.level === 3 && (
              <Button type="button" variant="ghost" size="icon" onClick={() => onDeactivate(node)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>

        {hasChildren && isOpen && (
          <div>
            {node.children?.map((child) => renderNode(child))}
          </div>
        )}
      </div>
    );
  };

  if (!tree.length) {
    return <div className="py-10 text-center text-sm text-muted-foreground">No accounts found.</div>;
  }

  return <div className="rounded-md border">{tree.map((node) => renderNode(node))}</div>;
}
