import { ArrowRight, Building2, Check, CloudUpload, FolderPlus, Send, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';

const steps = [
  { title: 'Set up your workspace', subtitle: 'This is what clients will see on review pages.', icon: Building2 },
  { title: 'Create your first client', subtitle: 'You can always add more later.', icon: UserPlus },
  { title: 'Create your first project', subtitle: 'A project groups related content.', icon: FolderPlus },
  { title: 'Upload your first creative', subtitle: 'Images, carousels, PDFs or video.', icon: CloudUpload },
  { title: 'Send your first approval request', subtitle: 'One secure review link. No client login.', icon: Send }
];

export default function Onboarding() {
  const [step, setStep] = useState(0); const nav = useNavigate();
  const current = steps[step]; const Icon = current.icon;
  const next = () => step === steps.length - 1 ? nav('/app/dashboard') : setStep(step + 1);
  return <div className="onboarding-page"><header><Brand/><button className="text-button" onClick={() => nav('/app/dashboard')}>Skip setup</button></header><div className="onboarding-shell"><aside><div className="eyebrow warm">GET TO YOUR FIRST APPROVAL FAST</div><h1>You're {step + 1} step{step ? 's' : ''} closer.</h1><ol>{steps.map((s, i) => <li className={i === step ? 'active' : i < step ? 'done' : ''} key={s.title}><span>{i < step ? <Check size={15}/> : i + 1}</span>{s.title}</li>)}</ol></aside><section className="onboarding-card"><div className="onboarding-icon"><Icon/></div><div className="step-count">STEP {step + 1} OF {steps.length}</div><h2>{current.title}</h2><p>{current.subtitle}</p>{step === 0 && <><label>Agency / Freelancer name<input defaultValue="Pixel Agency"/></label><label>Brand color<div className="color-row"><button className="swatch selected"/><button className="swatch orange"/><button className="swatch dark"/></div></label></>}{step === 1 && <><label>Company name<input defaultValue="SmileCraft Dental"/></label><label>Contact name<input defaultValue="Dr. Priya Shah"/></label><label>Email address<input defaultValue="priya@smilecraftdental.com"/></label></>}{step === 2 && <><label>Project name<input defaultValue="October Content"/></label><label>Client<select defaultValue="smilecraft"><option value="smilecraft">SmileCraft Dental</option></select></label></>}{step === 3 && <div className="drop-zone"><CloudUpload size={30}/><b>Drop files here</b><span>or click to browse</span><small>PNG, JPG, WEBP, PDF, MP4, MOV</small></div>}{step === 4 && <><label>Reviewer email<input defaultValue="priya@smilecraftdental.com"/></label><label>Message<textarea defaultValue="Hi Priya, October content is ready. Please review and mark any changes directly on the creative."/></label><label className="check"><input type="checkbox" defaultChecked/> Send automatic reminders</label></>}<button className="button button-primary full" onClick={next}>{step === steps.length - 1 ? 'Send approval request' : 'Continue'} <ArrowRight size={16}/></button></section></div></div>;
}
