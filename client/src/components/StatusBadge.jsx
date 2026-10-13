const STATUS_LABELS = {
  planning: 'Planning',
  'in-progress': 'In Progress',
  done: 'Done',
};

export default function StatusBadge({ status }) {
  return <span className={`status-badge status-${status}`}>{STATUS_LABELS[status] || status}</span>;
}
