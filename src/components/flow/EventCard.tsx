import type { GameEvent } from '@/types/domain';

export function EventCard({ event, onChoose }: { event: GameEvent; onChoose: (optionId: string) => void }) {
  const tag = event.type === 'A' ? 'WHAT HAPPENED' : event.source === 'fallback' ? 'OFFLINE OPPORTUNITY' : 'NEW OPPORTUNITY';
  return (
    <section className="event-card pixel-panel" aria-labelledby={`event-${event.id}`}>
      <span className="event-tag">{tag}</span>
      <h2 id={`event-${event.id}`}>{event.title}</h2>
      <p>{event.body}</p>
      {event.learningNote && <p><em>{event.learningNote}</em></p>}
      <div className="event-actions">
        {event.options.map((option) => (
          <button className="pixel-button" key={option.id} onClick={() => onChoose(option.id)} title={option.description}>{option.label}</button>
        ))}
      </div>
      <small>Illustrative educational scenario. Terms and outcomes are simplified.</small>
    </section>
  );
}
