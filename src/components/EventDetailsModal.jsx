import ReactMarkdown from 'react-markdown';
import Modal from './Modal';
import { fmtDate } from '../lib/db';

// Render markdown safely (react-markdown disallows raw HTML by default).
// Links open in a new tab and the rel attributes neutralise tabnabbing.
const mdComponents = {
  a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" {...props} />,
};

export default function EventDetailsModal({ event, show, onClose }) {
  if (!event) return null;
  return (
    <Modal show={show} onClose={onClose} size="lg" title={event.title}>
      {event.imageUrl && (
        <img src={event.imageUrl} alt="" className="w-100 rounded mb-3" style={{ maxHeight: 280, objectFit: 'cover' }} />
      )}
      <div className="d-flex flex-wrap gap-2 small mb-3">
        <span className="badge bg-secondary">{event.type}</span>
        <span className={`badge badge-${event.status}`}>{event.status}</span>
        <span className="text-secondary">🗓 {fmtDate(event.dateTime)}</span>
        <span className="text-secondary">⏱ {event.hours} hour{event.hours === 1 ? '' : 's'}</span>
        <span className="text-secondary">👥 {event.approvedCount ?? 0}/{event.maxSlots} slots</span>
      </div>
      <div className="markdown-body">
        {event.description
          ? <ReactMarkdown components={mdComponents}>{event.description}</ReactMarkdown>
          : <p className="text-secondary fst-italic">No description provided.</p>}
      </div>
    </Modal>
  );
}
