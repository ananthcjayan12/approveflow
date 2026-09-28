export type Status = 'Waiting' | 'Approved' | 'Changes requested' | 'Draft' | 'Overdue';

export type Client = {
  id: string;
  name: string;
  contact: string;
  email: string;
  projects: number;
  assets: number;
  note?: string;
};

export type Project = {
  id: string;
  clientId: string;
  name: string;
  due: string;
  approved: number;
  changes: number;
  waiting: number;
  status: Status;
};

export type Asset = {
  id: string;
  projectId: string;
  name: string;
  kind: 'image' | 'video' | 'carousel' | 'pdf';
  status: Status;
  src: string;
  caption?: string;
};

export type Annotation = {
  id: string;
  x: number;
  y: number;
  text: string;
  author: string;
};
