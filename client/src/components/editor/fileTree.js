export const getFilePath = (file) => file?.path || file?.filename || '';

const basename = (path) => path.split('/').filter(Boolean).pop() || path;

const sortNodes = (nodes) =>
  nodes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

export const buildFileTree = (files = [], emptyFolders = []) => {
  const root = [];
  const folderMap = new Map();

  const ensureFolder = (segments, fullPath) => {
    if (folderMap.has(fullPath)) {
      return folderMap.get(fullPath);
    }

    const node = {
      type: 'folder',
      name: segments[segments.length - 1],
      path: fullPath,
      children: []
    };

    const parentPath = segments.slice(0, -1).join('/');
    if (parentPath) {
      const parent = ensureFolder(segments.slice(0, -1), parentPath);
      parent.children.push(node);
    } else {
      root.push(node);
    }

    folderMap.set(fullPath, node);
    return node;
  };

  emptyFolders.forEach((folder) => {
    const clean = String(folder || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (clean) {
      ensureFolder(clean.split('/'), clean);
    }
  });

  files.forEach((file) => {
    const path = getFilePath(file);
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) {
      return;
    }

    const fileNode = {
      type: 'file',
      name: basename(path),
      path,
      file
    };

    if (segments.length === 1) {
      root.push(fileNode);
      return;
    }

    const parentPath = segments.slice(0, -1).join('/');
    const parent = ensureFolder(segments.slice(0, -1), parentPath);
    parent.children.push(fileNode);
  });

  const sortRecursive = (nodes) => {
    sortNodes(nodes);
    nodes.forEach((node) => {
      if (node.children) {
        sortRecursive(node.children);
      }
    });
  };

  sortRecursive(root);
  return root;
};

export const getParentFolders = (path = '') => {
  const parts = path.split('/').filter(Boolean);
  return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join('/'));
};
