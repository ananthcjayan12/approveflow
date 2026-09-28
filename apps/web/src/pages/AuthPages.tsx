import { ArrowRight, Mail, ShieldCheck } from 'lucide-react';
import { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';

function AuthFrame({ children, note }: { children: React.ReactNode; note: string }) {
  return <div className="auth-page"><div className="auth-brand-panel"><Brand/><div className="auth-quote"><div className="eyebrow warm">CREATIVE WORK FLOWS FASTER TOGETHER</div><h2>{note}</h2><p>No spreadsheets. No screenshot chains. No “did you approve this?” messages.</p></div></div><div className="auth-card-wrap">{children}</div></div>;
}

export function Signup() {
  const nav = useNavigate();
  const submit = (e: FormEvent) => { e.preventDefault(); nav('/verify'); };
  return <AuthFrame note="Less chasing. More creating."><form className="auth-card" onSubmit={submit}><Brand compact/><h1>Create your account</h1><p>Start organizing client approvals in minutes.</p><button type="button" className="oauth">Continue with Google</button><div className="divider"><span>or</span></div><label>Full name<input required defaultValue="Ananth Jayan" /></label><label>Work email<input required type="email" defaultValue="hello@pixelagency.com" /></label><label>Password<input required type="password" defaultValue="password123" /></label><button className="button button-primary full">Create account</button><small>Already have an account? <Link to="/login">Log in</Link></small></form></AuthFrame>;
}

export function Login() {
  const nav = useNavigate();
  return <AuthFrame note="Everything your client needs. Nothing they don't."><form className="auth-card" onSubmit={(e) => {e.preventDefault(); nav('/app/dashboard');}}><Brand compact/><h1>Welcome back</h1><p>Sign in to your agency workspace.</p><label>Email<input type="email" defaultValue="hello@pixelagency.com"/></label><label>Password<input type="password" defaultValue="password123"/></label><div className="form-row between"><label className="check"><input type="checkbox" defaultChecked/> Remember me</label><a href="#">Forgot password?</a></div><button className="button button-primary full">Log in</button><small>New here? <Link to="/signup">Create an account</Link></small></form></AuthFrame>;
}

export function Verify() {
  return <div className="center-page dark"><div className="verify-card"><div className="verify-icon"><Mail size={34}/><span><ShieldCheck size={18}/></span></div><div className="eyebrow warm">ONE MORE STEP</div><h1>Check your email</h1><p>We sent a verification link to <b>hello@pixelagency.com</b>.</p><Link className="button button-primary full" to="/onboarding">I verified my email <ArrowRight size={16}/></Link><small>Didn't receive it? <a href="#">Resend</a></small></div></div>;
}
