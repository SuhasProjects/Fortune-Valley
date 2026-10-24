import type { GameEvent } from '@/types/domain';
import { Board, Button, Icon, Tag, Tooltip } from '../../ui';
import { usd } from './format';
import '../panels/windows.css';

export function EventCard({ event, onChoose }: { event: GameEvent; onChoose: (optionId: string) => void }) {
  const tag = event.type === 'A' ? 'WHAT HAPPENED' : event.source === 'fallback' ? 'OFFLINE OPPORTUNITY' : 'NEW OPPORTUNITY';
  return <Board as="section" className="event-card ft-notice" aria-labelledby={`event-${event.id}`}>
    <span className="ft-notice__pin" aria-hidden="true"/>
    <Tag tone={event.type === 'A' ? 'red' : event.source === 'fallback' ? 'dark' : 'gold'}>{tag}</Tag>
    <h2 id={`event-${event.id}`}>{event.title}</h2><p>{event.body}</p>
    {event.learningNote && <p className="ft-notice__learning"><Icon name="book" compact/><em>{event.learningNote}</em></p>}
    {event.type === 'A' && event.shock && <dl className="ft-receipt" aria-label="Event cost receipt">
      <div><dt>Gross cost</dt><dd>{usd(event.shock.grossCost)}</dd></div>
      <div><dt>Insurer paid</dt><dd>{usd(event.shock.insurerPaid)}</dd></div>
      <div><dt>Out of pocket</dt><dd>{usd(event.shock.outOfPocket)}</dd></div>
    </dl>}
    <div className="event-actions">{event.options.map(option => <div key={option.id}>
      <Tooltip content={option.description}><Button variant="primary" onClick={() => onChoose(option.id)} title={option.description} aria-describedby={`event-${event.id}-${option.id}-description`}>{option.label}</Button></Tooltip>
      <small id={`event-${event.id}-${option.id}-description`}>{option.description}</small>
    </div>)}</div>
    <small>Illustrative educational scenario. Terms and outcomes are simplified.</small>
  </Board>;
}
