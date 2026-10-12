/** Human Lab only. These are material palettes for the *same* staged 3D body.
 * Never advertise a color change as a new facial identity or a new skirt mesh. */
export type FemaleLabLook = 'classic' | 'fair-rose' | 'ivory-casual';
type LabPalette = Readonly<{
  id: FemaleLabLook;
  skin: string | null;
  skinAmbient: number;
  shirt: string;
  pants: string;
  shoes: string;
}>;
const PALETTES: Readonly<Record<FemaleLabLook, LabPalette>> = {
  classic: {id:'classic',skin:null,skinAmbient:0,
    shirt:'#b7838b',pants:'#65575f',shoes:'#554448'},
  'fair-rose': {id:'fair-rose',skin:'#fff3ea',skinAmbient:.07,
    shirt:'#e5a9b4',pants:'#87747f',shoes:'#80636b'},
  'ivory-casual': {id:'ivory-casual',skin:'#fff0e4',skinAmbient:.055,
    shirt:'#e7d8c9',pants:'#aba399',shoes:'#80746a'},
};
export function resolveFemaleLabLook(query: string): LabPalette {
  const raw = new URLSearchParams(query).get('look');
  return raw==='fair-rose'||raw==='ivory-casual'?PALETTES[raw]:PALETTES.classic;
}
