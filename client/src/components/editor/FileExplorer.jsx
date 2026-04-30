import { FolderPlus, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Button from '../common/Button.jsx';
import FileTreeNode from './FileTreeNode.jsx';
import { buildFileTree, getFilePath, getParentFolders } from './fileTree.js';

const FileExplorer = ({ files, activeFile, onSelect, onCreate, onCreateFolder, onRename, onDelete }) => {
  const [expanded, setExpanded] = useState(new Set());
  const [emptyFolders, setEmptyFolders] = useState([]);

  const tree = useMemo(() => buildFileTree(files, emptyFolders), [files, emptyFolders]);

  useEffect(() => {
    const activePath = getFilePath(activeFile);
    if (!activePath) {
      return;
    }

    setExpanded((current) => {
      const next = new Set(current);
      getParentFolders(activePath).forEach((folder) => next.add(folder));
      return next;
    });
  }, [activeFile?._id, activeFile?.path, activeFile?.filename]);

  const toggleFolder = (path) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleCreateFolder = () => {
    const folder = window.prompt('Folder path');
    const clean = String(folder || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!clean) {
      return;
    }
    setEmptyFolders((current) => (current.includes(clean) ? current : [...current, clean]));
    setExpanded((current) => {
      const next = new Set(current);
      getParentFolders(`${clean}/placeholder`).forEach((item) => next.add(item));
      return next;
    });
    onCreateFolder?.(clean);
  };

  return (
    <aside className="flex h-full min-h-0 flex-col bg-[#0f1413]">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/10 px-3">
        <h2 className="text-xs font-black uppercase tracking-[0.14em] text-neutral-400">Explorer</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleCreateFolder} aria-label="New folder">
            <FolderPlus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onCreate?.()} aria-label="New file">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-2">
        {tree.length ? (
          tree.map((node) => (
            <FileTreeNode
              key={node.path}
              node={node}
              activeFileId={activeFile?._id}
              expanded={expanded}
              onToggle={toggleFolder}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))
        ) : (
          <div className="p-3 text-sm font-semibold text-neutral-500">No files yet.</div>
        )}
      </div>
    </aside>
  );
};

export default FileExplorer;
