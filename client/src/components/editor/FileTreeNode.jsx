import { ChevronRight, FileCode2, Folder, FolderOpen, Pencil, Trash2 } from 'lucide-react';
import clsx from '../../utils/clsx.js';

const FileTreeNode = ({ node, depth = 0, activeFileId, expanded, onToggle, onSelect, onRename, onDelete }) => {
  const isFolder = node.type === 'folder';
  const isOpen = expanded.has(node.path);
  const isActive = node.file?._id === activeFileId;

  return (
    <div>
      <div
        className={clsx(
          'file-tree-row group flex h-7 items-center gap-1 rounded px-1 text-sm transition',
          isFolder ? 'file-tree-folder' : 'file-tree-file',
          isActive ? 'active' : ''
        )}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
        title={node.path}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          onClick={() => (isFolder ? onToggle(node.path) : onSelect(node.file._id))}
        >
          {isFolder ? (
            <>
              <ChevronRight className={clsx('h-3.5 w-3.5 shrink-0 transition', isOpen ? 'rotate-90' : '')} aria-hidden="true" />
              {isOpen ? <FolderOpen className="h-4 w-4 shrink-0 text-teal-200" /> : <Folder className="h-4 w-4 shrink-0 text-teal-200" />}
            </>
          ) : (
            <>
              <span className="h-3.5 w-3.5 shrink-0" />
              <FileCode2 className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
            </>
          )}
          <span className="truncate font-semibold">{node.name}</span>
        </button>

        {!isFolder && (onRename || onDelete) ? (
          <div className="flex shrink-0 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
            {onRename ? <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-white/10 hover:text-white"
              onClick={() => onRename(node.file)}
              aria-label={`Rename ${node.path}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button> : null}
            {onDelete ? <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-rose-500/15 hover:text-rose-200"
              onClick={() => onDelete(node.file)}
              aria-label={`Delete ${node.path}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button> : null}
          </div>
        ) : null}
      </div>

      {isFolder && isOpen
        ? node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              activeFileId={activeFileId}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))
        : null}
    </div>
  );
};

export default FileTreeNode;
