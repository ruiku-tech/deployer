import service from './base';
export function fetchNotes(type) { return service.get(`/notes?type=${encodeURIComponent(type)}`); }
export function saveNote(type, name, note) { return service.post('/note', { type, name, note }); }
