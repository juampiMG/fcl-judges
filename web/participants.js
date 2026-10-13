import { TEAMS } from './teams.js';
import { PAIRS } from './pairs.js';
export const PARTICIPANTS = [...TEAMS.map(t=>({...t,modality:'teams',composition:null})),...PAIRS]
  .map(t=>({...t,id:[t.modality,t.composition||'',t.level,t.number].join(':')}));
const normalize = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
export function searchParticipants(query) {
 const q=normalize(query); if(!q)return [];
 return PARTICIPANTS.filter(t=>t.number.includes(q)||normalize(t.name).includes(q))
  .sort((a,b)=>Number(b.number===q)-Number(a.number===q)||Number(a.number)-Number(b.number)||a.id.localeCompare(b.id));
}
export function participantSelection(participant,previous) {
 return {...previous,modality:participant.modality,composition:participant.composition||'mixto',level:participant.level,
  wodId:participant.modality==='parejas'&&previous.wodId==='final'?'1':previous.wodId};
}
