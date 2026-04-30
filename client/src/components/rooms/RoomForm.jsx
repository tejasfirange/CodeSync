import { useState } from 'react';
import Button from '../common/Button.jsx';
import Input from '../common/Input.jsx';

const RoomForm = ({ onSubmit, submitting }) => {
  const [form, setForm] = useState({
    name: '',
    description: '',
    isPrivate: false
  });

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(form);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Input label="Name" value={form.name} onChange={(event) => updateField('name', event.target.value)} required minLength={2} maxLength={120} />
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-neutral-800 dark:text-neutral-200">Description</span>
        <textarea
          className="min-h-28 w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-white/10 dark:bg-[#0f1413] dark:text-white dark:focus:border-teal-300 dark:focus:ring-teal-300/20"
          value={form.description}
          onChange={(event) => updateField('description', event.target.value)}
          maxLength={500}
        />
      </label>
      <label className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3 dark:border-white/10 dark:bg-white/[0.04]">
        <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Private room</span>
        <input
          type="checkbox"
          className="h-5 w-5 rounded border-neutral-300 text-teal-700 focus:ring-teal-700"
          checked={form.isPrivate}
          onChange={(event) => updateField('isPrivate', event.target.checked)}
        />
      </label>
      <Button type="submit" disabled={submitting} className="w-full">
        Create room
      </Button>
    </form>
  );
};

export default RoomForm;
