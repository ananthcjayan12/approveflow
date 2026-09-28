import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { BillingSettings } from './SettingsPages';
export default function Pricing(){return <div className="standalone-pricing"><header><Brand/><Link to="/"><ArrowLeft size={16}/> Back home</Link></header><BillingSettings/></div>}
