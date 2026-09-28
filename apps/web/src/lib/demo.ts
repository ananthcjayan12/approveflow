import type { Asset, Client, Project } from './types';

export const clients: Client[] = [
  { id: 'smilecraft', name: 'SmileCraft Dental', contact: 'Dr. Priya Shah', email: 'priya@smilecraftdental.com', projects: 3, assets: 24, note: 'Dental clinic focused on cosmetic dentistry. Keep posts clear, premium and local.' },
  { id: 'milano', name: 'Milano Trips', contact: 'Rohan Mehta', email: 'rohan@milanotrips.com', projects: 2, assets: 12 },
  { id: 'urbanbrew', name: 'Urban Brew', contact: 'Neha Kapoor', email: 'neha@urbanbrew.co', projects: 4, assets: 18 },
  { id: 'fitlife', name: 'FitLife Gym', contact: 'Arjun Singh', email: 'arjun@fitlife.com', projects: 1, assets: 10 }
];

export const projects: Project[] = [
  { id: 'october', clientId: 'smilecraft', name: 'October Content', due: 'Oct 12, 2026', approved: 8, changes: 2, waiting: 2, status: 'Waiting' },
  { id: 'diwali', clientId: 'milano', name: 'Diwali Campaign', due: 'Oct 18, 2026', approved: 5, changes: 0, waiting: 1, status: 'Waiting' },
  { id: 'summer', clientId: 'urbanbrew', name: 'Summer Collection', due: 'Oct 25, 2026', approved: 6, changes: 2, waiting: 1, status: 'Changes requested' },
  { id: 'brand', clientId: 'fitlife', name: 'Brand Refresh', due: 'Nov 02, 2026', approved: 4, changes: 0, waiting: 6, status: 'Draft' }
];

const img = (seed: string) => `https://images.unsplash.com/${seed}?auto=format&fit=crop&w=1200&q=80`;

export const assets: Asset[] = [
  { id: 'post-1', projectId: 'october', name: 'Instagram Post 1', kind: 'image', status: 'Approved', src: img('photo-1606811971618-4486d14f3f99'), caption: 'Healthy smiles start with simple daily habits.' },
  { id: 'post-2', projectId: 'october', name: 'Instagram Post 2', kind: 'image', status: 'Waiting', src: img('photo-1609840114035-3c981b782dfe'), caption: 'A brighter smile, one confident step at a time.' },
  { id: 'carousel', projectId: 'october', name: 'Myth vs Fact Carousel', kind: 'carousel', status: 'Changes requested', src: img('photo-1606265752439-1f18756aa376'), caption: 'Scaling facts your patients should know.' },
  { id: 'reel', projectId: 'october', name: 'Smile Reel', kind: 'video', status: 'Waiting', src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', caption: 'Reel: Smile transformation teaser.' },
  { id: 'story', projectId: 'october', name: 'Story', kind: 'image', status: 'Approved', src: img('photo-1581585099402-5b7a29c1b1a1'), caption: 'Book your consultation.' },
  { id: 'cover', projectId: 'october', name: 'Reel Cover', kind: 'image', status: 'Approved', src: img('photo-1600158017494-4f4554fa66e5'), caption: 'Confident smiles every day.' }
];
