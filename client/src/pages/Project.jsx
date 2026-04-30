import { ArrowLeft, FileCode2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { listFilesByProjectRequest } from '../api/file.api.js';
import { getProjectRequest } from '../api/project.api.js';
import Spinner from '../components/common/Spinner.jsx';
import GitHubRepoManager from '../components/github/GitHubRepoManager.jsx';

const Project = () => {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadProject = async () => {
      setLoading(true);
      setError('');

      try {
        const [{ project: nextProject }, { files: nextFiles }] = await Promise.all([getProjectRequest(projectId), listFilesByProjectRequest(projectId)]);

        if (mounted) {
          setProject(nextProject);
          setFiles(nextFiles);
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadProject();

    return () => {
      mounted = false;
    };
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Spinner label="Loading project" />
      </div>
    );
  }

  if (error) {
    return <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-100">{error}</p>;
  }

  const handleGitHubPullFiles = (pulledFiles) => {
    if (!Array.isArray(pulledFiles) || pulledFiles.length === 0) {
      return;
    }

    setFiles((currentFiles) => {
      const byId = new Map(currentFiles.map((file) => [file._id, file]));
      pulledFiles.forEach((file) => byId.set(file._id, { ...byId.get(file._id), ...file }));
      return Array.from(byId.values()).sort((a, b) => a.filename.localeCompare(b.filename));
    });
  };

  return (
    <div className="space-y-5">
      <Link
        to={`/rooms/${project.room?._id || project.room}`}
        className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-white/10"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Room
      </Link>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-neutral-950 dark:text-white">{project.title}</h1>
            <p className="mt-1 text-sm font-medium text-neutral-500 dark:text-neutral-400">{project.description || project.room?.name}</p>
          </div>
          <GitHubRepoManager project={project} files={files} onPullFiles={handleGitHubPullFiles} />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {files.map((file) => (
          <article key={file._id} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-300/15 dark:text-teal-200">
                <FileCode2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-black text-neutral-950 dark:text-white">{file.filename}</h2>
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{file.language}</p>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
};

export default Project;
