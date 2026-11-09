// UTC windows and explicit effects; the match receipt's server completion time decides eligibility.
export const EVENTS = [{
  id:'precision-weekend-1',name:'Precision Weekend',
  startsAt:Date.parse('2026-11-13T00:00:00Z'),endsAt:Date.parse('2026-11-16T00:00:00Z'),
  eliminationXpMultiplier:2
}];
export const activeEvents = at => Number.isFinite(at)
  ? EVENTS.filter(event=>at>=event.startsAt&&at<event.endsAt) : [];
export function eliminationXpMultiplier(at) {
  return activeEvents(at).reduce((best,event)=>Math.max(best,event.eliminationXpMultiplier||1),1);
}

export const eventStatus = (event,at) => at < event.startsAt ? 'UPCOMING' : at < event.endsAt ? 'LIVE' : 'ENDED';
