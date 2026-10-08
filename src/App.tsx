import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  BedDouble,
  Bell,
  Bot,
  CalendarDays,
  Car,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  Compass,
  Dumbbell,
  ExternalLink,
  Eye,
  Filter,
  Fuel,
  Heart,
  MapPin,
  Landmark,
  Menu,
  Play,
  Plus,
  Scissors,
  Search,
  ShoppingBag,
  Sparkles,
  Tag,
  Utensils,
  Wine,
  Wrench,
  X,
} from 'lucide-react';

type HanslaPlace = {
  name: string;
  lat: number;
  lon: number;
  pin_type: 'restaurant' | 'sight' | 'activity';
  category: string;
  region: string;
  address: string | null;
  description: string | null;
};
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/lib/supabase';
import { useAuth, fetchInterests, toggleInterest, fetchSavedEvents, saveEvent, unsaveEvent, trackBehavior, deleteAllUserData } from '@/lib/auth';
import { AuthModal, PersonalizingModal, AccountModal } from '@/components/Modals';

type Topic = 'Alle' | 'Kultur' | 'Natur' | 'Wissen' | 'Wirtschaft';

type Story = {
  eyebrow: string;
  title: string;
  description: string;
  location: string;
  time: string;
  topic: Exclude<Topic, 'Alle'>;
  accent: string;
  image: string;
};

const topics: Topic[] = ['Alle', 'Kultur', 'Natur', 'Wissen', 'Wirtschaft'];

const stories: Story[] = [
  {
    eyebrow: 'Kultur · 06.10.2026',
    title: 'Die neue Klanglandschaft im Festspielhaus',
    description: 'Wie junge Stimmen und alte Räume in Bayreuth eine neue Bühne für die Region bauen.',
    location: 'Bayreuth',
    time: '5 min',
    topic: 'Kultur',
    accent: 'coral',
    image: 'https://images.pexels.com/photos/713149/pexels-photo-713149.jpeg?auto=compress&cs=tinysrgb&w=900',
  },
  {
    eyebrow: 'Natur · 05.10.2026',
    title: 'Wo der Frankenwald wieder wilder wird',
    description: 'Ein Streifzug zu Menschen, die aus Schutzgebieten echte Zukunftsorte machen.',
    location: 'Kronach',
    time: '8 min',
    topic: 'Natur',
    accent: 'blue',
    image: 'https://images.pexels.com/photos/417074/pexels-photo-417074.jpeg?auto=compress&cs=tinysrgb&w=900',
  },
  {
    eyebrow: 'Wissen · 03.10.2026',
    title: 'Ideen, die aus Coburg in die Welt gehen',
    description: 'Drei Labore, ein gemeinsamer Antrieb: Technik menschlicher und regionaler denken.',
    location: 'Coburg',
    time: '6 min',
    topic: 'Wissen',
    accent: 'yellow',
    image: 'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=900',
  },
];

type Region = {
  name: string;
  shortName: string;
  d: string;
  position: { x: number; y: number };
  color: string;
  intro: string;
  highlights: string[];
  signalCount: number;
};

type EventItem = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string;
  region: string;
  category: string;
  description: string;
  importance: number;
  source_url: string | null;
};

type WeatherSnapshot = {
  region: string;
  temperature: number;
  temp_min: number;
  temp_max: number;
  description: string;
  icon: string;
  wind_speed: number;
  humidity: number;
  fetched_at: string;
};

type RegionalPlace = {
  id: string;
  osm_id: number;
  name: string;
  category: string;
  region: string;
  lat: number | null;
  lon: number | null;
  opening_hours: string | null;
  cuisine: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  description: string | null;
};

type PlaceCategory = {
  key: string;
  label: string;
  icon: typeof Landmark;
};

const placeCategories: PlaceCategory[] = [
  { key: 'museum', label: 'Museen', icon: Landmark },
  { key: 'restaurant', label: 'Gaststätten', icon: Utensils },
  { key: 'cafe', label: 'Cafés', icon: Coffee },
  { key: 'supermarket', label: 'Einkaufen', icon: ShoppingBag },
  { key: 'pharmacy', label: 'Apotheken', icon: Plus },
  { key: 'doctor', label: 'Ärzte', icon: Plus },
  { key: 'hairdresser', label: 'Friseure', icon: Scissors },
  { key: 'car_repair', label: 'Werkstätten', icon: Wrench },
  { key: 'fuel', label: 'Tankstellen', icon: Fuel },
  { key: 'bank', label: 'Banken', icon: Landmark },
  { key: 'gym', label: 'Fitness', icon: Dumbbell },
  { key: 'hotel', label: 'Hotels', icon: BedDouble },
];

const categoryIconMap: Record<string, typeof Landmark> = {
  museum: Landmark,
  restaurant: Utensils,
  cafe: Coffee,
  bar: Wine,
  fast_food: Utensils,
  bakery: ShoppingBag,
  supermarket: ShoppingBag,
  pharmacy: Plus,
  bank: Landmark,
  hairdresser: Scissors,
  car_wash: Car,
  car_repair: Wrench,
  fuel: Fuel,
  plumber: Wrench,
  electrician: Wrench,
  beauty: Sparkles,
  florist: Sparkles,
  clothes: ShoppingBag,
  hardware: Wrench,
  dentist: Plus,
  doctor: Plus,
  optician: Eye,
  gym: Dumbbell,
  hotel: BedDouble,
  post_office: Landmark,
  library: Landmark,
  cinema: Play,
  atm: Landmark,
};

const categoryLabelMap: Record<string, string> = {
  museum: 'Museum',
  restaurant: 'Restaurant',
  cafe: 'Café',
  bar: 'Bar',
  fast_food: 'Schnellimbiss',
  bakery: 'Bäckerei',
  supermarket: 'Supermarkt',
  pharmacy: 'Apotheke',
  bank: 'Bank',
  hairdresser: 'Friseur',
  car_wash: 'Autowäsche',
  car_repair: 'Werkstatt',
  fuel: 'Tankstelle',
  plumber: 'Klempner',
  electrician: 'Elektriker',
  beauty: 'Kosmetik',
  florist: 'Blumenladen',
  clothes: 'Bekleidung',
  hardware: 'Baumarkt',
  dentist: 'Zahnarzt',
  doctor: 'Arzt',
  optician: 'Optiker',
  gym: 'Fitnessstudio',
  hotel: 'Hotel',
  post_office: 'Poststelle',
  library: 'Bibliothek',
  cinema: 'Kino',
  atm: 'Geldautomat',
};

const weatherDescriptions: Record<string, string> = {
  'clear-day': 'Klar und sonnig',
  'clear-night': 'Klare Nacht',
  'slightly-cloudy-day': 'Leicht bewölkt',
  'slightly-cloudy-night': 'Leicht bewölkt',
  'cloudy-day': 'Bewölkt',
  'cloudy-night': 'Bewölkt',
  'very-cloudy-day': 'Stark bewölkt',
  'very-cloudy-night': 'Stark bewölkt',
  fog: 'Nebel',
  drizzle: 'Nieselregen',
  rain: 'Regen',
  'heavy-rain': 'Starker Regen',
  showers: 'Schauer',
  snowfall: 'Schneefall',
  'snow-grains': 'Schneegriesel',
  'rain-showers': 'Regenschauer',
  'snow-showers': 'Schneeschauer',
  sleet: 'Graupel',
  hail: 'Hagel',
  thunderstorm: 'Gewitter',
  dry: 'Trocken',
};

const demoEvents: EventItem[] = [
  { id: 'demo-1', title: 'Bayreuther Herbstmarkt', starts_at: '2026-10-05T10:00:00+02:00', ends_at: '2026-10-05T18:00:00+02:00', location: 'Bayreuth · Marktplatz', region: 'Bayreuth', category: 'Kultur', description: 'Handwerk, Musik und regionale Manufakturen mitten in der Stadt.', importance: 5, source_url: null },
  { id: 'demo-2', title: 'Forum Zukunft Frankenwald', starts_at: '2026-10-08T18:30:00+02:00', ends_at: null, location: 'Kronach · Lucas-Cranach-Campus', region: 'Kronach', category: 'Wissen', description: 'Gespräch über neue Ideen für Wald, Wirtschaft und Zusammenhalt.', importance: 5, source_url: null },
  { id: 'demo-3', title: 'Nacht der offenen Museen', starts_at: '2026-10-10T19:00:00+02:00', ends_at: '2026-10-10T23:30:00+02:00', location: 'Coburg · Innenstadt', region: 'Coburg', category: 'Kultur', description: 'Ein Abend, viele Häuser und überraschende Perspektiven.', importance: 5, source_url: null },
  { id: 'demo-4', title: 'Wald & Wildnis Tag', starts_at: '2026-10-17T11:00:00+02:00', ends_at: null, location: 'Hof · Untreusee', region: 'Hof', category: 'Natur', description: 'Draußen lernen, staunen und den Frankenwald neu erleben.', importance: 4, source_url: null },
  { id: 'demo-5', title: 'Maisel\u2019s Craft Beer Festival', starts_at: '2026-10-24T15:00:00+02:00', ends_at: null, location: 'Bayreuth · Maisel & Friends', region: 'Bayreuth', category: 'Wirtschaft', description: 'Regionale Braukunst trifft auf Musik und gute Gespräche.', importance: 4, source_url: null },
  { id: 'demo-6', title: 'Plassenburg bei Nacht', starts_at: '2026-10-30T20:00:00+02:00', ends_at: null, location: 'Kulmbach · Plassenburg', region: 'Kulmbach', category: 'Kultur', description: 'Licht, Geschichte und ein weiter Blick über die Region.', importance: 4, source_url: null },
];

const regions: Region[] = [
  { name: 'Bamberg', shortName: 'Bamberg', d: 'M159.0,248.7L160.1,254.4L156.2,255.3L162.0,260.9L171.7,265.4L178.9,262.1L183.4,264.9L187.7,264.4L191.9,267.8L193.8,272.0L200.2,268.0L207.6,269.4L214.7,266.3L222.6,265.2L231.9,262.1L236.9,263.5L247.7,259.3L252.0,260.9L249.6,264.4L240.8,267.3L238.0,270.4L251.0,274.3L258.7,272.2L260.1,275.4L267.8,279.9L269.0,283.0L259.5,284.9L258.7,287.9L252.6,290.7L257.4,293.5L257.4,299.1L254.5,302.9L249.3,305.0L253.5,309.0L253.5,312.5L265.3,315.8L262.0,318.1L261.8,326.3L256.5,325.4L246.2,327.3L244.3,323.3L236.1,323.5L231.7,325.6L224.7,326.6L223.9,335.3L213.7,338.5L208.5,338.5L199.8,341.6L190.2,341.1L183.6,345.8L173.9,343.2L171.7,346.5L168.9,344.2L172.0,341.6L159.8,344.9L157.1,349.8L150.4,349.5L142.1,352.1L140.5,354.9L134.9,355.6L128.6,348.1L115.9,344.2L108.2,343.0L101.8,344.6L96.1,349.1L104.4,357.1L99.0,357.1L94.7,360.3L89.7,360.8L85.0,354.7L78.9,355.4L58.8,350.2L59.3,346.1L54.9,345.6L53.8,339.2L48.0,335.9L40.5,340.9L33.1,339.4L38.0,335.3L31.4,334.3L27.8,330.3L30.8,325.8L25.0,323.3L27.5,320.7L30.8,313.2L41.6,315.3L44.7,313.9L55.9,313.9L60.4,315.8L65.9,314.6L69.2,318.4L77.0,319.6L82.0,317.7L82.8,314.8L94.1,310.9L104.0,305.7L101.5,301.9L107.1,300.3L108.4,297.1L114.2,295.2L116.2,292.4L110.7,289.0L119.8,288.1L118.7,279.0L122.8,276.6L126.2,263.7L131.1,262.6L135.3,265.4L140.7,264.7L144.6,261.4L144.4,254.9L151.3,254.6L151.5,249.2L159.0,248.7Z M180.9,321.9L177.8,315.5L179.2,308.8L175.9,302.4L168.7,298.7L159.6,300.5L156.2,302.9L145.7,301.9L147.4,305.0L141.3,307.4L145.5,314.1L148.5,313.9L158.5,320.3L171.4,324.2L172.0,321.7L178.9,320.0L180.9,321.9Z', position: { x: 154.8, y: 307.0 }, color: '#5b8fcf', intro: 'Lebendige Welterbestadt mit Sinn für gutes Zusammenleben.', highlights: ['Altstadt & Regnitz', 'Sandkerwa', 'Flussbad Hain'], signalCount: 14 },
  { name: 'Bayreuth', shortName: 'Bayreuth', d: 'M431.1,245.7L437.1,247.3L433.6,252.7L434.6,255.1L443.8,256.5L445.2,260.5L454.8,264.2L457.0,271.5L464.2,277.1L465.6,283.0L464.2,286.0L453.1,288.3L438.0,288.6L438.2,296.4L443.8,298.2L446.8,308.8L447.1,317.2L452.3,320.0L451.0,322.8L434.9,324.2L430.5,326.1L415.8,324.9L410.6,328.7L404.6,331.0L404.2,334.8L392.1,336.2L387.4,334.8L383.3,342.8L383.6,348.8L373.3,350.4L373.7,355.2L362.3,362.6L360.9,365.5L361.2,375.1L363.4,376.7L362.3,383.1L358.2,385.0L348.2,382.1L335.5,384.3L332.2,388.4L323.3,388.9L323.6,391.5L313.1,389.4L312.3,384.5L304.5,376.9L303.0,373.2L307.0,370.4L307.3,366.6L300.7,365.7L303.2,354.7L308.4,351.4L308.2,343.7L301.0,343.0L299.9,340.9L304.5,336.6L301.8,334.6L293.7,333.6L288.3,336.9L283.9,335.7L273.1,323.7L275.0,318.9L272.3,314.6L265.3,315.8L253.5,312.5L253.5,309.0L249.3,305.0L254.5,302.9L257.4,299.1L257.4,293.5L252.6,290.7L258.7,287.9L259.5,284.9L269.0,283.0L267.8,279.9L270.9,276.6L279.4,280.4L278.3,284.4L283.6,287.6L289.1,287.6L303.4,295.4L310.1,294.3L312.3,289.3L320.3,288.8L318.6,284.2L319.8,279.9L326.7,279.5L328.3,283.0L334.4,281.6L337.2,278.1L345.7,278.5L355.7,276.9L362.5,273.6L367.5,274.3L375.0,271.5L375.0,267.5L388.8,264.0L385.7,259.3L386.6,254.9L399.2,250.4L397.3,248.5L397.7,239.1L413.1,239.4L419.7,240.8L427.2,238.7L431.1,245.7Z M382.8,299.6L390.5,296.1L387.8,290.5L388.6,284.9L380.3,286.7L367.9,284.2L362.5,284.4L354.0,288.6L343.2,290.0L352.3,295.9L354.8,299.6L360.6,303.6L360.4,308.3L365.0,310.2L376.4,308.3L382.2,305.3L379.9,302.4L382.8,299.6Z', position: { x: 352.6, y: 309.7 }, color: '#3b7bc9', intro: 'Die Bühne der Region: weltberühmt, neugierig und in Bewegung.', highlights: ['Markgräfliches Opernhaus', 'Festspielhaus', 'Maisel & Friends'], signalCount: 24 },
  { name: 'Coburg', shortName: 'Coburg', d: 'M177.2,160.4L181.7,163.7L180.5,165.8L189.4,172.1L191.5,166.7L203.5,168.4L204.8,172.8L218.1,170.9L220.6,166.7L228.4,166.3L235.0,170.7L241.6,178.7L234.2,182.2L233.8,186.4L237.5,190.9L249.1,192.3L250.7,195.1L254.3,199.5L247.7,201.9L251.8,204.0L248.3,208.9L247.9,213.6L253.2,215.9L247.7,221.1L235.0,218.8L224.5,213.3L220.6,214.8L212.0,214.1L204.1,211.0L193.3,211.9L190.0,215.0L195.0,217.8L196.0,223.4L179.5,225.3L178.0,230.0L170.6,231.4L170.3,233.8L178.0,239.8L174.2,242.7L169.7,240.8L159.8,243.9L159.0,248.7L151.5,249.2L151.5,242.0L157.3,233.8L151.0,230.7L144.1,232.4L132.0,233.3L126.4,231.7L125.6,224.8L127.8,223.6L127.5,218.3L119.5,212.6L119.8,209.4L112.1,207.5L113.1,200.9L118.4,203.8L124.2,204.2L133.6,201.2L140.2,205.2L148.0,202.8L149.0,200.9L147.4,193.9L143.2,194.4L134.7,192.5L134.7,189.2L125.8,188.0L115.9,181.8L107.9,180.1L107.9,176.6L111.7,174.9L107.6,171.6L107.9,167.2L115.0,167.4L118.1,169.1L125.6,164.8L127.5,162.0L134.7,162.7L142.7,158.5L152.1,160.1L159.8,158.5L167.0,160.8L173.4,158.5L177.2,160.4Z M201.2,201.2L211.4,196.9L207.0,193.9L197.3,196.5L195.4,194.4L189.2,193.5L191.9,190.2L183.0,188.7L181.7,187.1L171.2,187.8L165.4,190.6L160.1,191.3L169.7,198.6L161.2,201.4L167.8,204.5L181.1,203.1L185.0,205.6L186.9,210.1L193.3,206.6L191.9,204.7L201.2,201.2Z', position: { x: 172.0, y: 198.5 }, color: '#4a87d1', intro: 'Kulturgeschichte und junge Macher in einem eigenen Rhythmus.', highlights: ['Veste Coburg', 'Designforum', 'Schloss Ehrenburg'], signalCount: 18 },
  { name: 'Forchheim', shortName: 'Forchheim', d: 'M304.5,376.9L296.2,379.8L296.2,381.4L288.9,387.5L282.7,389.1L278.1,396.0L273.6,395.0L270.0,398.8L261.8,394.8L256.5,398.8L250.1,400.4L230.5,400.6L225.3,397.2L219.5,396.4L211.8,385.7L206.2,388.9L201.8,386.3L208.5,384.5L207.6,378.4L203.5,375.5L199.0,375.5L196.5,371.6L189.6,372.5L173.4,366.6L178.0,361.3L175.9,358.0L169.7,355.6L173.9,350.4L171.7,346.5L173.9,343.2L183.6,345.8L190.2,341.1L199.8,341.6L208.5,338.5L213.7,338.5L223.9,335.3L224.7,326.6L231.7,325.6L236.1,323.5L244.3,323.3L246.2,327.3L256.5,325.4L261.8,326.3L262.0,318.1L265.3,315.8L272.3,314.6L275.0,318.9L273.1,323.7L283.9,335.7L288.3,336.9L293.7,333.6L301.8,334.6L304.5,336.6L299.9,340.9L301.0,343.0L308.2,343.7L308.4,351.4L303.2,354.7L300.7,365.7L307.3,366.6L307.0,370.4L303.0,373.2L304.5,376.9Z', position: { x: 247.0, y: 358.2 }, color: '#6f9ed9', intro: 'Zwischen Fränkischer Schweiz und Gemütlichkeit am Fluss.', highlights: ['Kaiserpfalz', 'Fränkische Schweiz', 'Annafest'], signalCount: 11 },
  { name: 'Hof', shortName: 'Hof', d: 'M525.0,181.0L532.7,184.5L531.3,188.7L536.8,193.2L525.0,197.6L527.5,205.2L540.8,207.8L542.9,210.5L533.5,212.9L517.8,210.3L509.5,213.8L508.2,218.3L504.3,221.3L493.5,225.1L489.6,219.7L483.8,215.7L474.4,217.1L476.9,219.7L475.9,224.3L464.7,229.8L449.0,240.8L444.8,241.5L438.2,245.3L431.1,245.7L427.2,238.7L419.7,240.8L413.1,239.4L397.7,239.1L390.2,242.0L386.9,238.0L388.6,234.9L396.3,232.8L399.8,227.9L390.2,228.1L392.1,223.6L396.5,222.9L395.7,215.5L390.7,215.5L391.5,208.0L387.8,207.1L380.8,208.5L377.8,206.4L375.6,196.0L368.7,200.2L356.5,196.9L355.1,193.9L363.7,189.7L361.7,184.7L352.6,177.7L355.9,174.7L355.9,170.2L360.0,167.4L367.0,167.7L368.3,160.6L374.1,161.3L375.3,156.7L381.6,160.4L388.6,158.7L402.9,157.6L406.5,155.3L412.3,156.4L415.8,153.6L422.2,151.7L432.2,150.8L439.9,156.2L440.2,159.0L449.6,156.0L454.8,156.0L458.7,152.2L466.4,151.2L470.3,148.9L484.1,156.4L489.6,160.6L488.3,165.5L492.4,170.5L498.2,172.5L504.3,177.5L512.2,178.2L521.1,176.6L525.0,181.0Z M481.9,183.6L486.0,181.5L485.2,177.7L480.0,172.8L474.2,173.2L470.3,170.7L456.4,174.4L457.9,178.7L445.2,182.0L437.4,181.8L436.9,183.8L453.5,190.9L455.4,193.9L461.4,195.8L468.4,195.6L475.3,191.1L476.1,185.7L481.9,183.6Z', position: { x: 439.1, y: 195.0 }, color: '#75a3db', intro: 'Textil, Design und Natur treffen hier aufeinander.', highlights: ['Deutsch-Deutsches Museum', 'Untreusee', 'Hofer Filmtage'], signalCount: 9 },
  { name: 'Kronach', shortName: 'Kronach', d: 'M338.5,146.8L340.5,152.2L337.7,156.0L349.9,157.6L350.4,162.0L362.9,160.8L365.4,156.7L372.5,155.5L375.3,156.7L374.1,161.3L368.3,160.6L367.0,167.7L360.0,167.4L355.9,170.2L355.9,174.7L352.6,177.7L361.7,184.7L363.7,189.7L355.1,193.9L356.5,196.9L348.2,200.0L339.9,201.6L336.8,206.6L323.9,211.9L318.6,216.2L324.4,221.6L312.6,223.6L307.0,218.8L303.4,220.6L301.8,226.9L296.6,228.6L284.1,227.4L278.3,228.4L270.6,225.3L268.6,221.3L262.3,221.6L262.8,215.7L253.2,215.9L247.9,213.6L248.3,208.9L251.8,204.0L247.7,201.9L254.3,199.5L250.7,195.1L253.2,189.0L261.2,193.2L269.2,196.0L271.9,193.9L270.0,187.1L275.0,184.3L270.9,179.6L273.9,170.7L279.2,168.4L277.3,162.7L271.5,156.4L274.8,150.5L273.1,143.8L267.8,135.7L268.1,132.7L273.6,132.5L279.7,130.7L290.2,129.5L291.6,123.1L297.2,120.1L304.9,119.4L310.7,121.5L321.7,121.5L326.4,126.4L320.6,128.3L319.8,140.0L320.9,143.8L329.4,147.0L338.5,146.8Z', position: { x: 307.4, y: 176.4 }, color: '#4281cd', intro: 'Eine Festungsstadt mit starken Ideen für morgen.', highlights: ['Festung Rosenberg', 'Lucas-Cranach-Stadt', 'Frankenwald'], signalCount: 16 },
  { name: 'Kulmbach', shortName: 'Kulmbach', d: 'M397.7,239.1L397.3,248.5L399.2,250.4L386.6,254.9L385.7,259.3L388.8,264.0L375.0,267.5L375.0,271.5L367.5,274.3L362.5,273.6L355.7,276.9L345.7,278.5L337.2,278.1L334.4,281.6L328.3,283.0L326.7,279.5L319.8,279.9L318.6,284.2L320.3,288.8L312.3,289.3L310.1,294.3L303.4,295.4L289.1,287.6L283.6,287.6L278.3,284.4L279.4,280.4L270.9,276.6L269.5,272.2L278.9,269.6L285.2,264.9L284.1,251.6L289.3,250.4L286.0,244.6L293.0,241.7L297.2,236.8L296.6,228.6L301.8,226.9L303.4,220.6L307.0,218.8L312.6,223.6L324.4,221.6L318.6,216.2L323.9,211.9L336.8,206.6L339.9,201.6L348.2,200.0L356.5,196.9L368.7,200.2L375.6,196.0L377.8,206.4L380.8,208.5L387.8,207.1L391.5,208.0L390.7,215.5L395.7,215.5L396.5,222.9L392.1,223.6L390.2,228.1L399.8,227.9L396.3,232.8L388.6,234.9L386.9,238.0L390.2,242.0L397.7,239.1Z', position: { x: 342.3, y: 246.6 }, color: '#3f80c7', intro: 'Zwischen Genuss, Handwerk und dem Tor zum Fichtelgebirge.', highlights: ['Plassenburg', 'Brauerei-Kultur', 'Mönchshof'], signalCount: 12 },
  { name: 'Lichtenfels', shortName: 'Lichtenfels', d: 'M253.2,215.9L262.8,215.7L262.3,221.6L268.6,221.3L270.6,225.3L278.3,228.4L284.1,227.4L296.6,228.6L297.2,236.8L293.0,241.7L286.0,244.6L289.3,250.4L284.1,251.6L285.2,264.9L278.9,269.6L269.5,272.2L270.9,276.6L267.8,279.9L260.1,275.4L258.7,272.2L251.0,274.3L238.0,270.4L240.8,267.3L249.6,264.4L252.0,260.9L247.7,259.3L236.9,263.5L231.9,262.1L222.6,265.2L214.7,266.3L207.6,269.4L200.2,268.0L193.8,272.0L191.9,267.8L187.7,264.4L183.4,264.9L178.9,262.1L171.7,265.4L162.0,260.9L156.2,255.3L160.1,254.4L159.0,248.7L159.8,243.9L169.7,240.8L174.2,242.7L178.0,239.8L170.3,233.8L170.6,231.4L178.0,230.0L179.5,225.3L196.0,223.4L195.0,217.8L190.0,215.0L193.3,211.9L204.1,211.0L212.0,214.1L220.6,214.8L224.5,213.3L235.0,218.8L247.7,221.1L253.2,215.9Z', position: { x: 226.3, y: 245.8 }, color: '#5b93d6', intro: 'Die Korbweberstadt am Obermain — Tradition trifft Zukunft.', highlights: ['Korbmacher-Museum', 'Obermaintherme', 'Stadtschloss'], signalCount: 8 },
  { name: 'Wunsiedel', shortName: 'Wunsiedel', d: 'M542.9,210.5L547.6,212.6L551.5,218.1L555.3,220.0L559.8,226.0L553.2,235.1L555.3,244.1L563.6,246.0L575.0,253.2L573.3,259.1L569.4,264.2L560.9,266.6L554.3,266.8L554.8,274.3L552.8,276.6L538.7,278.8L523.0,283.7L518.0,281.4L515.5,278.1L509.5,282.8L487.7,281.8L482.7,283.5L468.6,285.5L465.6,283.0L464.2,277.1L457.0,271.5L454.8,264.2L445.2,260.5L443.8,256.5L434.6,255.1L433.6,252.7L437.1,247.3L431.1,245.7L438.2,245.3L444.8,241.5L449.0,240.8L464.7,229.8L475.9,224.3L476.9,219.7L474.4,217.1L483.8,215.7L489.6,219.7L493.5,225.1L504.3,221.3L508.2,218.3L509.5,213.8L517.8,210.3L533.5,212.9L542.9,210.5Z', position: { x: 503.8, y: 247.1 }, color: '#69a0d8', intro: 'Fichtelgebirge, Granit und Kultur im nördlichsten Winkel.', highlights: ['Fichtelgebirge', 'Luisenburg-Festspiele', 'Epprechtstein'], signalCount: 10 },
];

type IpLocation = {
  city?: string;
  region?: string;
};

function App() {
  const { user, profile, signInWithGoogle, signOut } = useAuth();
  const [activeTopic, setActiveTopic] = useState<Topic>('Alle');
  const [search, setSearch] = useState('');
  const [savedStories, setSavedStories] = useState<string[]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiPlaces, setAiPlaces] = useState<HanslaPlace[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<Region>(regions[1]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date(2026, 9, 1));
  const [calendarEvents, setCalendarEvents] = useState<EventItem[]>(demoEvents);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [detectedCity, setDetectedCity] = useState('Oberfranken');
  const [locationStatus, setLocationStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lon: number } | null>(() => {
    try {
      const saved = localStorage.getItem('gps_coords');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [gpsPopupOpen, setGpsPopupOpen] = useState(false);
  const [gpsRequesting, setGpsRequesting] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [personalizingOpen, setPersonalizingOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [userInterests, setUserInterests] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('local_interests') || '[]'); } catch { return []; }
  });
  const [savedEventIds, setSavedEventIds] = useState<string[]>([]);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [places, setPlaces] = useState<RegionalPlace[]>([]);
  const [placesTab, setPlacesTab] = useState<string>('museum');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const lastTrackedRegion = useRef<string>('');

  useEffect(() => {
    const detectLocation = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) throw new Error('Location lookup failed');
        const location = await response.json() as IpLocation;
        const city = location.city?.trim();
        if (!city) throw new Error('No city returned');
        setDetectedCity(city);
        setLocationStatus('ready');
        const matchingRegion = regions.find((region) => city.toLowerCase() === region.name.toLowerCase() || city.toLowerCase().includes(region.name.toLowerCase()) || region.name.toLowerCase().includes(city.toLowerCase()));
        if (matchingRegion) setSelectedRegion(matchingRegion);
      } catch {
        setLocationStatus('fallback');
      }
    };

    void detectLocation();
  }, []);

  useEffect(() => {
    if (gpsCoords) return;
    const dismissed = localStorage.getItem('gps_dismissed');
    if (dismissed) return;
    const timer = setTimeout(() => setGpsPopupOpen(true), 1500);
    return () => clearTimeout(timer);
  }, [gpsCoords]);

  const requestGps = () => {
    if (!navigator.geolocation) { setGpsPopupOpen(false); return; }
    setGpsRequesting(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lon: position.coords.longitude };
        setGpsCoords(coords);
        localStorage.setItem('gps_coords', JSON.stringify(coords));
        setGpsPopupOpen(false);
        setGpsRequesting(false);
        setLocationStatus('ready');
        const matchingRegion = regions.find((region) => {
          const dist = Math.sqrt(Math.pow(region.position.x - coords.lon * 10, 2) + Math.pow(region.position.y - coords.lat * 10, 2));
          return dist < 100;
        });
        if (matchingRegion) setSelectedRegion(matchingRegion);
      },
      () => {
        setGpsRequesting(false);
        setGpsPopupOpen(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  };

  const skipGps = () => {
    setGpsPopupOpen(false);
    localStorage.setItem('gps_dismissed', 'true');
  };

  useEffect(() => {
    const loadEvents = async () => {
      setEventsLoading(true);
      const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
      const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
      const { data, error } = await supabase
        .from('regional_events')
        .select('id, title, starts_at, ends_at, location, region, category, description, importance, source_url')
        .gte('starts_at', monthStart.toISOString())
        .lt('starts_at', monthEnd.toISOString())
        .order('importance', { ascending: false })
        .order('starts_at', { ascending: true });

      if (!error && data?.length) setCalendarEvents(data as EventItem[]);
      else setCalendarEvents(demoEvents.filter((event) => new Date(event.starts_at).getMonth() === calendarMonth.getMonth() && new Date(event.starts_at).getFullYear() === calendarMonth.getFullYear()));
      setEventsLoading(false);
    };

    void loadEvents();
  }, [calendarMonth]);

  useEffect(() => {
    const loadWeather = async () => {
      const { data } = await supabase
        .from('weather_snapshots')
        .select('region, temperature, temp_min, temp_max, description, icon, wind_speed, humidity, fetched_at')
        .eq('region', selectedRegion.name)
        .maybeSingle();
      if (data) setWeather(data as WeatherSnapshot);
      else setWeather(null);
    };
    void loadWeather();
  }, [selectedRegion.name]);

  useEffect(() => {
    const loadPlaces = async () => {
      const { data } = await supabase
        .from('regional_places')
        .select('id, osm_id, name, category, region, lat, lon, opening_hours, cuisine, website, phone, address, description')
        .eq('region', selectedRegion.name)
        .order('name', { ascending: true });
      if (data) setPlaces(data as RegionalPlace[]);
      else setPlaces([]);
    };
    void loadPlaces();
  }, [selectedRegion.name]);

  const selectedRegionEvents = useMemo(() => calendarEvents.filter((event) => event.region.toLowerCase() === selectedRegion.name.toLowerCase()).sort((first, second) => new Date(first.starts_at).getTime() - new Date(second.starts_at).getTime()), [calendarEvents, selectedRegion.name]);
  const todayRegionEvents = selectedRegionEvents.filter((event) => isSameDay(new Date(event.starts_at), new Date()));
  const thisWeekRegionEvents = selectedRegionEvents.filter((event) => isInCurrentWeek(new Date(event.starts_at)));

  const filteredStories = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return stories.filter((story) => {
      const matchesTopic = activeTopic === 'Alle' || story.topic === activeTopic;
      const matchesSearch = !normalizedSearch || `${story.title} ${story.description} ${story.location}`.toLowerCase().includes(normalizedSearch);
      return matchesTopic && matchesSearch;
    });
  }, [activeTopic, search]);

  const filteredPlaces = useMemo(() => places.filter((p) => p.category === placesTab), [places, placesTab]);

  const toggleSaved = (title: string) => {
    setSavedStories((current) => current.includes(title) ? current.filter((item) => item !== title) : [...current, title]);
    if (user) void trackBehavior(user.id, 'story_save', title);
  };

  const handleRegionSelect = useCallback((region: Region) => {
    setSelectedRegion(region);
    if (user && region.name !== lastTrackedRegion.current) {
      lastTrackedRegion.current = region.name;
      void trackBehavior(user.id, 'region_click', region.name);
    }
  }, [user]);

  const handleTopicChange = useCallback((topic: Topic) => {
    setActiveTopic(topic);
    if (user && topic !== 'Alle') void trackBehavior(user.id, 'topic_filter', topic);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setSavedEventIds([]);
      return;
    }
    void fetchInterests(user.id).then(async (items) => {
      const dbTags = items.map((i) => i.tag);
      const localTags = JSON.parse(localStorage.getItem('local_interests') || '[]') as string[];
      const newTags = localTags.filter((t) => !dbTags.includes(t));
      for (const tag of newTags) {
        await toggleInterest(user.id, tag, false);
      }
      if (newTags.length > 0) {
        const refreshed = await fetchInterests(user.id);
        setUserInterests(refreshed.map((i) => i.tag));
      } else {
        setUserInterests(dbTags);
      }
      localStorage.removeItem('local_interests');
    });
    void fetchSavedEvents(user.id).then((items) => setSavedEventIds(items.filter((i) => i.event_id).map((i) => i.event_id!)));
  }, [user]);

  const handleToggleInterest = async (tag: string) => {
    const isSelected = userInterests.includes(tag);
    if (user) {
      const ok = await toggleInterest(user.id, tag, isSelected);
      if (ok) {
        setUserInterests((current) => isSelected ? current.filter((t) => t !== tag) : [...current, tag]);
      }
    } else {
      const updated = isSelected ? userInterests.filter((t) => t !== tag) : [...userInterests, tag];
      setUserInterests(updated);
      localStorage.setItem('local_interests', JSON.stringify(updated));
    }
  };

  const handleSaveEvent = async (eventId: string) => {
    if (!user) { setAuthModalOpen(true); return; }
    const isSaved = savedEventIds.includes(eventId);
    if (isSaved) {
      const ok = await unsaveEvent(user.id, eventId);
      if (ok) setSavedEventIds((current) => current.filter((id) => id !== eventId));
    } else {
      const ok = await saveEvent(user.id, eventId);
      if (ok) setSavedEventIds((current) => [...current, eventId]);
    }
  };

  const handleDeleteData = async () => {
    const result = await deleteAllUserData();
    if (result.success) {
      await signOut();
      setAccountModalOpen(false);
      setUserInterests([]);
      setSavedEventIds([]);
      setSavedStories([]);
    }
  };

  const [aiLoading, setAiLoading] = useState(false);

  const askAi = async () => {
    if (!aiMessage.trim()) return;
    if (user) void trackBehavior(user.id, 'ai_question', aiMessage.trim());
    const question = aiMessage.trim();
    setAiLoading(true);
    setAiAnswer('');
    setAiPlaces([]);
    setAiMessage('');
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ message: question, region: selectedRegion.name, interests: userInterests, userLat: gpsCoords?.lat, userLon: gpsCoords?.lon }),
      });
      const data = await res.json();
      setAiAnswer(data.answer || 'Keine Antwort erhalten. Versuche es noch einmal.');
      setAiPlaces(Array.isArray(data.places) ? data.places : []);
    } catch {
      setAiAnswer('Hansla konnte gerade nicht antworten. Versuche es gleich noch einmal.');
      setAiPlaces([]);
    }
    setAiLoading(false);
  };

  const weatherDesc = weather ? (weatherDescriptions[weather.icon] || weather.description) : 'Lade Wetter …';
  const recommendations = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const isWet = Boolean(weather && /rain|shower|drizzle|thunderstorm|snow|sleet|hail/i.test(weather.icon));
    const isCold = Boolean(weather && weather.temperature < 8);
    const isWindy = Boolean(weather && weather.wind_speed > 28);
    const isNight = hour < 7 || hour >= 21;
    const isIndoor = isNight || isWet || isCold || isWindy;
    const nearbyMuseum = places.find((place) => place.region === selectedRegion.name && place.category === 'museum');
    const nearbyRestaurant = places.find((place) => place.region === selectedRegion.name && place.category === 'restaurant');
    const nextEvent = selectedRegionEvents.find((event) => new Date(event.starts_at) > now);
    const localInterest = userInterests.find((tag) => ['Natur', 'Kultur', 'Wissen', 'Wirtschaft'].includes(tag));

    const suggestions = [];

    if (isIndoor) {
      suggestions.push(nearbyMuseum
        ? { title: nearbyMuseum.name, text: nearbyMuseum.description || `Ein Ort in ${selectedRegion.name}.`, reason: selectedRegion.name, icon: 'place', target: 'orte' }
        : { title: `Drinnen entdecken in ${selectedRegion.name}`, text: `Museen und regionale Geschichten sind ${isNight ? 'jetzt' : 'heute'} die bessere Wahl.`, reason: selectedRegion.name, icon: 'place', target: 'orte' });
    } else {
      suggestions.push({ title: selectedRegion.highlights[0], text: `Ein konkreter Tipp für heute in ${selectedRegion.name}.`, reason: selectedRegion.name, icon: 'place', target: 'karte' });
    }

    if (nextEvent) {
      suggestions.push({ title: nextEvent.title, text: `${formatEventTime(nextEvent.starts_at)} · ${nextEvent.location}`, reason: 'Nächster Termin in deiner Region', icon: 'clock', target: 'karte' });
    } else if (!isIndoor && nearbyRestaurant) {
      suggestions.push({ title: nearbyRestaurant.name, text: nearbyRestaurant.description || `Eine passende Pause in ${selectedRegion.name}.`, reason: localInterest ? `${localInterest} · jetzt passend` : 'Jetzt passend', icon: 'place', target: 'orte' });
    }

    return suggestions.slice(0, 2);
  }, [places, selectedRegion, selectedRegionEvents, userInterests, weather]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#e8e9eb] text-[#152238]">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="sticky top-0 z-30 border-b border-slate-900/10 bg-[#e8e9eb]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-8 sm:py-5 lg:px-12">
          <a className="site-brand" href="#karte" aria-label="Oberfranken Startseite">
            <img src="/image.png" alt="Wappen von Oberfranken" className="site-logo" />
            <span className="site-wordmark">OBERFRANKEN</span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-500 lg:flex">
            <a className="nav-link active" href="#entdecken">Entdecken</a>
            <a className="nav-link" href="#signale">Regionale Signale</a>
            <a className="nav-link" href="#ueber-uns">Über die Plattform</a>
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <button className="calendar-button hidden sm:flex" onClick={() => setCalendarOpen(true)}><CalendarDays size={17} /><span>Kalender</span></button>
            <button className="icon-button hidden sm:flex" aria-label="Benachrichtigungen"><Bell size={18} /></button>
            {user ? (
              <button className="profile-button hidden sm:flex" onClick={() => setAccountModalOpen(true)}>
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="Profil" className="profile-avatar" /> : <span className="profile-dot">{(profile?.display_name || '?')[0]?.toUpperCase()}</span>}
                <span>{profile?.display_name?.split(' ')[0] || 'Konto'}</span>
              </button>
            ) : (
              <button className="login-button hidden sm:flex" onClick={() => setAuthModalOpen(true)}><span className="login-dot" /><span>Anmelden</span></button>
            )}
            <button className="icon-button sm:hidden" onClick={() => setCalendarOpen(true)} aria-label="Kalender"><CalendarDays size={18} /></button>
            <button className="icon-button lg:hidden" onClick={() => setMobileMenuOpen(true)} aria-label="Menü"><Menu size={20} /></button>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="mobile-menu-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-menu" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-menu-header">
              <img src="/image.png" alt="Wappen von Oberfranken" className="mobile-menu-logo" />
              <button className="modal-close" onClick={() => setMobileMenuOpen(false)} aria-label="Menü schließen"><X size={18} /></button>
            </div>
            <nav className="mobile-menu-nav">
              <a className="mobile-menu-link" href="#entdecken" onClick={() => setMobileMenuOpen(false)}>Entdecken</a>
              <a className="mobile-menu-link" href="#signale" onClick={() => setMobileMenuOpen(false)}>Regionale Signale</a>
              <a className="mobile-menu-link" href="#ueber-uns" onClick={() => setMobileMenuOpen(false)}>Über die Plattform</a>
            </nav>
            <div className="mobile-menu-divider" />
            <div className="mobile-menu-actions">
              <button className="mobile-menu-action" onClick={() => { setMobileMenuOpen(false); user ? setAccountModalOpen(true) : setAuthModalOpen(true); }}><span className="login-dot" /> {user ? 'Mein Konto' : 'Anmelden'}</button>
            </div>
          </div>
        </div>
      )}

      <main className="relative z-10 mx-auto max-w-[1440px] px-5 pb-16 sm:px-8 lg:px-12">
        <section className="recommendations-section" aria-labelledby="recommendations-title">
          <div className="recommendations-heading">
            <div>
              <p className="section-kicker red">Für dich ausgewählt</p>
              <h2 id="recommendations-title" className="recommendations-title">Dein nächster <span>guter Ort.</span></h2>
              <p className="recommendations-subtitle">Kuratiert für {detectedCity === 'Oberfranken' ? selectedRegion.name : detectedCity} · {new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(new Date())}</p>
            </div>

          </div>
          <div className="recommendations-grid">
            {recommendations.map((recommendation) => (
              <button className="recommendation-card" key={recommendation.title} onClick={() => document.getElementById(recommendation.target)?.scrollIntoView({ behavior: 'smooth' })}>
                <span className="recommendation-icon">{recommendation.icon === 'clock' ? <Clock size={17} /> : recommendation.icon === 'place' ? <MapPin size={17} /> : <Sparkles size={17} />}</span>
                <span className="recommendation-content"><strong>{recommendation.title}</strong><span>{recommendation.text}</span><em>{recommendation.reason}</em></span>
                <ArrowUpRight className="recommendation-arrow" size={17} />
              </button>
            ))}
          </div>
        </section>

        <section id="karte" className="hero-map-section pb-10 pt-6 lg:pt-10">
          <div className="reveal-up mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
            <div>
              <h1 className="font-display text-3xl font-medium leading-[0.98] tracking-[-0.055em] text-[#152238] sm:text-5xl lg:text-[56px]">Viele Orte. <span className="text-[#3272c8]">Eine gemeinsame</span> <em className="font-serif not-italic text-[#ec4b45]">Bühne.</em></h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">Was Oberfranken bewegt, verbindet und besonders macht. Wähle eine Region auf der Karte.</p>
            </div>
            <button className="hero-personalizing-button w-fit" onClick={() => setPersonalizingOpen(true)}>
              <Tag size={16} />
              <span>Interessen{userInterests.length > 0 ? ` (${userInterests.length})` : ''}</span>
            </button>
          </div>
          <div className="hero-map-shell">
            <div className="hero-map-card">
              <div className="map-grid" />
              <svg className="hero-region-svg" viewBox="0 0 600 520" role="img" aria-label="Interaktive Karte von Oberfranken">
                {regions.map((region) => <g key={region.name} className={`region-shape ${selectedRegion.name === region.name ? 'selected' : ''}`} onClick={() => handleRegionSelect(region)} onMouseEnter={() => handleRegionSelect(region)} tabIndex={0} role="button" aria-label={`${region.name} anzeigen`} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') handleRegionSelect(region); }}>
                  <path d={region.d} fill={selectedRegion.name === region.name ? '#ec4b45' : region.color} fillOpacity={selectedRegion.name === region.name ? 0.9 : 0.7} stroke="#dce7f5" strokeWidth={1.5} paintOrder="stroke" />
                  <text x={region.position.x} y={region.position.y} textAnchor="middle">{region.shortName}</text>
                  <circle cx={region.position.x} cy={region.position.y + 13} r="3" />
                </g>)}
              </svg>

              <div className="map-overlay overlay-tl">
                <p className="overlay-kicker">Region 0{regions.findIndex((r) => r.name === selectedRegion.name) + 1}<i>/09</i></p>
                <h2 className="overlay-name">{selectedRegion.name}</h2>
                <p className="overlay-intro">{selectedRegion.intro}</p>
                <div className="overlay-stat"><strong>{selectedRegion.signalCount}</strong><span>Signale</span></div>
              </div>

              <div className="map-overlay overlay-tr">
                <p className="overlay-kicker">Wetter</p>
                {weather ? (
                  <>
                    <div className="weather-temp"><strong>{weather.temperature}°</strong><span>°C</span></div>
                    <p className="weather-desc">{weatherDesc}</p>
                    <div className="weather-range"><span>T {weather.temp_min}°</span><span>H {weather.temp_max}°</span></div>
                    <div className="weather-extra"><span>{weather.wind_speed} km/h · {weather.humidity}%</span></div>
                  </>
                ) : (
                  <>
                    <div className="weather-temp"><strong>—</strong><span>°C</span></div>
                    <p className="weather-desc">Wird geladen …</p>
                  </>
                )}
              </div>

              <div className="map-overlay overlay-bl">
                <p className="overlay-label">Das passt dazu</p>
                <div className="overlay-tags">{selectedRegion.highlights.map((highlight) => <span key={highlight}>{highlight}</span>)}</div>
                <button className="overlay-cta" onClick={() => { setAiMessage(`Was sollte ich in ${selectedRegion.name} entdecken?`); setAiOpen(true); }}>Hansla fragen <Sparkles size={12} /></button>
              </div>

              <div className="map-overlay overlay-br">
                <p className="overlay-label">Termine · <span className="overlay-badge">{todayRegionEvents.length ? `${todayRegionEvents.length} heute` : `${thisWeekRegionEvents.length} diese Woche`}</span></p>
                {selectedRegionEvents.length ? selectedRegionEvents.slice(0, 3).map((event) => <div className="overlay-event" key={event.id}><div><b>{event.title}</b><span>{isSameDay(new Date(event.starts_at), new Date()) ? 'Heute' : formatEventTime(event.starts_at)} · {event.location.split(' · ')[0]}</span></div><span className={`overlay-event-dot ${isSameDay(new Date(event.starts_at), new Date()) ? 'today-dot' : ''}`} /><button className={`event-save-btn ${savedEventIds.includes(event.id) ? 'saved' : ''}`} onClick={() => handleSaveEvent(event.id)} aria-label="Termin speichern"><Heart size={12} fill={savedEventIds.includes(event.id) ? 'currentColor' : 'none'} /></button></div>) : <p className="overlay-empty">Keine Termine eingetragen.</p>}
              </div>

              <div className="map-legend"><span><i className="legend-dot blue" />Landkreis</span><span><i className="legend-dot red" />Ausgewählt</span></div>
            </div>
          </div>
          <div className="hero-ai-search">
            <div className="hero-ai-greeting"><span className="hero-ai-icon"><Sparkles size={18} /></span><span>Ich bin Hansla, dein persönlicher Guide für Oberfranken. Frag mich alles — Orte, Events, Tipps …</span></div>
            <form className="hero-ai-form" onSubmit={(event) => { event.preventDefault(); if (aiMessage.trim()) askAi(); }}>
              <input value={aiMessage} onChange={(event) => setAiMessage(event.target.value)} placeholder="Z. B. Wo kann ich fränkisch essen? Was kann ich dieses Wochenende tun?" aria-label="Hansla Frage stellen" />
              <button type="submit" className="hero-ai-submit" aria-label="Frage senden"><ArrowUpRight size={22} /></button>
            </form>
            {aiAnswer && <div className="hero-ai-answer"><Bot size={18} /><p>{aiAnswer}</p></div>}
            {aiLoading && <div className="hero-ai-answer"><Bot size={18} /><p>Hansla denkt nach …</p></div>}
            {aiPlaces.length > 0 && <HanslaMap places={aiPlaces} />}
            <div className="hero-ai-chips"><span className="hero-ai-chip" onClick={() => { setAiMessage('Wo kann ich fränkisch essen?'); }}>Fränkisch essen</span><span className="hero-ai-chip" onClick={() => { setAiMessage('Was kann ich dieses Wochenende tun?'); }}>Wochenendtipps</span><span className="hero-ai-chip" onClick={() => { setAiMessage(`Was sollte ich in ${selectedRegion.name} entdecken?`); }}>{selectedRegion.name} entdecken</span></div>
          </div>
        </section>

        <section id="entdecken" className="border-t border-slate-900/10 pt-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div><p className="section-kicker">Dein Feed</p><h2 className="section-title">Was gerade <span>Wellen schlägt.</span></h2></div>
            <div className="relative w-full md:w-[270px]"><Search className="absolute left-3.5 top-3.5 text-slate-400" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} className="search-input" placeholder="Thema, Ort oder Idee suchen" aria-label="Feed durchsuchen" /></div>
          </div>
          <div className="mt-7 flex items-center gap-2 overflow-x-auto pb-2"><Filter size={16} className="mr-2 shrink-0 text-slate-400" />{topics.map((topic) => <button key={topic} className={`topic-pill ${activeTopic === topic ? 'selected' : ''}`} onClick={() => handleTopicChange(topic)}>{topic}</button>)}</div>
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            {filteredStories.map((story, index) => <StoryCard key={story.title} story={story} index={index} saved={savedStories.includes(story.title)} onSave={() => toggleSaved(story.title)} />)}
            {filteredStories.length === 0 && <div className="empty-state lg:col-span-3"><Compass size={27} /><p>Keine Geschichte gefunden.</p><button onClick={() => { setActiveTopic('Alle'); setSearch(''); }}>Filter zurücksetzen</button></div>}
          </div>
        </section>

        <section id="orte" className="mt-20 border-t border-slate-900/10 pt-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="section-kicker">{selectedRegion.name} entdecken</p>
              <h2 className="section-title">Orte & <span>Betriebe.</span></h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">Museen, Restaurants, Dienstleister und mehr — direkt aus OpenStreetMap.</p>
            </div>
          </div>
          <div className="places-tabs-scroll mt-5">
            {placeCategories.map((cat) => {
              const count = places.filter((p) => p.category === cat.key).length;
              if (count === 0) return null;
              const Icon = cat.icon;
              return (
                <button key={cat.key} className={`places-tab ${placesTab === cat.key ? 'active' : ''}`} onClick={() => setPlacesTab(cat.key)}>
                  <Icon size={16} /> {cat.label} <span className="places-tab-count">{count}</span>
                </button>
              );
            })}
          </div>
          {filteredPlaces.length > 0 ? (
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPlaces.map((place) => {
                const Icon = categoryIconMap[place.category] || Landmark;
                return (
                  <article key={place.id} className="place-card">
                    <div className="place-card-header">
                      <span className={`place-category-badge ${place.category}`}>
                        <Icon size={14} />
                      </span>
                      <h3 className="place-name">{place.name}</h3>
                    </div>
                    {place.cuisine && <p className="place-cuisine">{place.cuisine}</p>}
                    {place.description && <p className="place-desc">{place.description}</p>}
                    <div className="place-details">
                      {place.opening_hours && (
                        <div className="place-detail-row"><Clock size={13} /><span>{place.opening_hours}</span></div>
                      )}
                      {place.address && (
                        <div className="place-detail-row"><MapPin size={13} /><span>{place.address}, {place.region}</span></div>
                      )}
                      {place.phone && (
                        <div className="place-detail-row"><span className="place-phone-icon">Tel</span><span>{place.phone}</span></div>
                      )}
                      {place.website && (
                        <div className="place-detail-row"><ExternalLink size={13} /><a href={place.website} target="_blank" rel="noopener noreferrer" className="place-link">Website</a></div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state mt-7"><Compass size={27} /><p>Noch keine Orte für {selectedRegion.name} erfasst.</p></div>
          )}
        </section>

        <section id="signale" className="mt-20 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="blue-panel relative overflow-hidden p-7 sm:p-10"><div className="blue-panel-orbit orbit-one" /><div className="blue-panel-orbit orbit-two" /><div className="relative z-10"><div className="flex items-center justify-between"><p className="section-kicker light">Die Region im Blick</p><Compass className="text-white/70" size={25} /></div><h2 className="mt-5 max-w-lg font-display text-4xl font-medium leading-tight tracking-[-0.04em] text-white sm:text-5xl">Ein Netzwerk, das <span className="text-[#a9c9ff]">sichtbar</span> macht.</h2><p className="mt-5 max-w-md text-sm leading-6 text-blue-100/75">Oberfranken ist voller guter Ideen. Wir bündeln sie, damit aus vielen einzelnen Signalen eine gemeinsame Richtung entsteht.</p><div className="mt-10 flex items-center gap-8"><div><strong className="font-display text-4xl font-medium text-white">112</strong><p className="mt-1 text-xs uppercase tracking-wider text-blue-100/60">aktive Akteure</p></div><div className="h-12 w-px bg-white/15" /><div><strong className="font-display text-4xl font-medium text-white">34</strong><p className="mt-1 text-xs uppercase tracking-wider text-blue-100/60">neue Signale</p></div></div></div></div>
          <div className="ai-panel p-7 sm:p-10"><div className="flex items-center justify-between"><div className="ai-label"><span className="ai-spark"><Sparkles size={14} /></span> Hansla — dein Guide</div><Bot size={23} className="text-[#ec4b45]" /></div><h2 className="mt-6 font-display text-3xl font-medium leading-tight tracking-[-0.04em] text-[#152238]">Was möchtest du<br /><span className="text-[#ec4b45]">erleben?</span></h2><p className="mt-4 text-sm leading-6 text-slate-500">Frag Hansla — deinen persönlichen Assistenten für Oberfranken. Er kennt Orte, Events und gibt dir passende Tipps.</p><div className="location-context"><MapPin size={14} /><span>{gpsCoords ? 'Standort aktiv — kuratiert für' : locationStatus === 'loading' ? 'Dein Standort wird erkannt …' : 'Automatisch kuratiert für'} <strong>{detectedCity}</strong></span><span className={`location-status ${gpsCoords ? 'ready' : locationStatus}`} /></div><button className="ai-ask-button mt-8" onClick={() => setAiOpen(true)}>Hansla fragen <ArrowUpRight size={16} /></button><div className="mt-6 flex flex-wrap gap-2"><span className="suggestion-chip" onClick={() => { setAiMessage('Was ist dieses Wochenende los?'); setAiOpen(true); }}>Wochenendideen</span><span className="suggestion-chip" onClick={() => { setAiMessage('Orte für Familien'); setAiOpen(true); }}>Familienorte</span></div></div>
        </section>

        <section id="ueber-uns" className="mt-20 flex flex-col justify-between gap-6 border-t border-slate-900/10 pt-7 sm:flex-row sm:items-center"><div><p className="section-kicker">Für Oberfranken</p><p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">Eine digitale Bühne für regionale Inhalte — kuratiert von Menschen, erweitert durch Technologie.</p></div><button className="secondary-button w-fit">Partner werden <Plus size={16} /></button></section>
      </main>

      {aiOpen && <div className="modal-backdrop" onClick={() => setAiOpen(false)}><div className="ai-modal hansla-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setAiOpen(false)} aria-label="Dialog schließen"><X size={18} /></button><div className="ai-modal-icon"><Sparkles size={22} /></div><p className="section-kicker red">Hansla</p><h2 className="mt-3 font-display text-3xl font-medium tracking-[-0.04em]">Dein Guide für<br /><span className="text-[#ec4b45]">Oberfranken.</span></h2><p className="mt-3 text-sm leading-6 text-slate-500">Frag mich alles — wo du essen kannst, was du am Wochenende tun kannst, welche Sehenswürdigkeiten sich lohnen.</p><div className="mt-7 flex gap-2"><input autoFocus value={aiMessage} onChange={(event) => setAiMessage(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && askAi()} className="ai-input" placeholder="z. B. Wo kann ich fränkisch essen?" /><button className="ai-send" onClick={askAi} aria-label="Frage senden"><ArrowUpRight size={18} /></button></div>{aiAnswer && <div className="ai-answer"><Bot size={18} /><p>{aiAnswer}</p></div>}{aiLoading && <div className="ai-answer"><Bot size={18} /><p>Hansla denkt nach …</p></div>}{aiPlaces.length > 0 && <HanslaMap places={aiPlaces} />}<p className="mt-4 text-[11px] text-slate-400">Hansla verbindet öffentliche regionale Daten. Antworten können unvollständig sein.</p></div></div>}
      {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} onGoogleSignIn={signInWithGoogle} />}
      {personalizingOpen && <PersonalizingModal interests={userInterests} onToggle={handleToggleInterest} onClose={() => setPersonalizingOpen(false)} isLoggedIn={!!user} />}
      {accountModalOpen && user && profile && <AccountModal profile={profile} interestsCount={userInterests.length} savedCount={savedEventIds.length} onClose={() => setAccountModalOpen(false)} onSignOut={() => { void signOut(); setAccountModalOpen(false); }} onDeleteData={handleDeleteData} />}
      {calendarOpen && <CalendarModal month={calendarMonth} events={calendarEvents} loading={eventsLoading} onClose={() => setCalendarOpen(false)} onChangeMonth={setCalendarMonth} />}

      {gpsPopupOpen && (
        <div className="modal-backdrop" onClick={skipGps}>
          <div className="gps-popup" onClick={(e) => e.stopPropagation()}>
            <div className="gps-popup-icon"><MapPin size={26} /></div>
            <h2 className="gps-popup-title">Standort aktivieren</h2>
            <p className="gps-popup-text">Erlaube den Zugriff auf deinen Standort, damit Hansla dir Orte und Tipps in deiner Nähe zeigen kann. Deine Koordinaten bleiben auf deinem Gerät.</p>
            <div className="gps-popup-actions">
              <button className="gps-popup-skip" onClick={skipGps} disabled={gpsRequesting}>Später</button>
              <button className="gps-popup-allow" onClick={requestGps} disabled={gpsRequesting}>{gpsRequesting ? 'Wird gesucht …' : 'Standort erlauben'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarModal({ month, events, loading, onClose, onChangeMonth }: { month: Date; events: EventItem[]; loading: boolean; onClose: () => void; onChangeMonth: (month: Date) => void }) {
  const days = getCalendarDays(month);
  const monthLabel = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(month);
  const weekdayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  return <div className="calendar-backdrop" onClick={onClose}><section className="calendar-modal" onClick={(event) => event.stopPropagation()} aria-label="Oberfranken Kalender"><div className="calendar-header"><div><p className="section-kicker red">Oberfranken Kalender</p><h2>Die größten <span>Termine.</span></h2><p className="calendar-subtitle">Wichtige Veranstaltungen aus der Region — Tag für Tag.</p></div><button className="modal-close" onClick={onClose} aria-label="Kalender schließen"><X size={18} /></button></div><div className="calendar-toolbar"><button className="calendar-nav" onClick={() => onChangeMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Vorheriger Monat"><ChevronLeft size={18} /></button><strong>{monthLabel}</strong><button className="calendar-nav" onClick={() => onChangeMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Nächster Monat"><ChevronRight size={18} /></button><span className="calendar-source">{loading ? 'Lade regionale Termine …' : 'Live aus der Region'}</span></div><div className="calendar-grid">{weekdayLabels.map((label) => <div className="weekday" key={label}>{label}</div>)}{days.map((day) => { const dayEvents = events.filter((event) => isSameDay(new Date(event.starts_at), day)).sort((a, b) => b.importance - a.importance).slice(0, 2); const isCurrentMonth = day.getMonth() === month.getMonth(); return <div className={`calendar-day ${isCurrentMonth ? '' : 'muted-day'} ${isSameDay(day, new Date()) ? 'today' : ''}`} key={day.toISOString()}><span className="day-number">{day.getDate()}</span><div className="day-events">{dayEvents.map((event) => <button className={`calendar-event event-${event.category.toLowerCase()}`} key={event.id} title={event.description}><b>{event.title}</b><span><Clock size={10} />{formatEventTime(event.starts_at)} · {event.location.split(' · ')[0]}</span></button>)}{events.filter((event) => isSameDay(new Date(event.starts_at), day)).length > 2 && <span className="more-events">+ weitere</span>}</div></div>; })}</div><div className="calendar-footer"><span><i className="calendar-dot red" />Top-Termin des Tages</span><span><i className="calendar-dot blue" />Weitere regionale Termine</span><span className="calendar-api-note">Datenquelle: <code>regional_events</code></span></div></section></div>;
}

function getCalendarDays(month: Date): Date[] {
  const firstDayOffset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - firstDayOffset + 1));
}

function isSameDay(first: Date, second: Date): boolean {
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
}

function isInCurrentWeek(value: Date): boolean {
  const now = new Date();
  const mondayOffset = (now.getDay() + 6) % 7;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
  return value >= weekStart && value < weekEnd;
}

function formatEventTime(value: string): string {
  return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function StoryCard({ story, index, saved, onSave }: { story: Story; index: number; saved: boolean; onSave: () => void }) {
  return <article className={`story-card ${index === 0 ? 'featured' : ''}`}><div className="story-image" style={{ backgroundImage: `url(${story.image})` }}><span className={`story-topic ${story.accent}`}>{story.topic}</span><button className={`save-button ${saved ? 'saved' : ''}`} onClick={onSave} aria-label="Geschichte speichern"><Heart size={17} fill={saved ? 'currentColor' : 'none'} /></button><div className="story-gradient" /><span className="story-location"><MapPin size={13} />{story.location}</span></div><div className="p-5 sm:p-6"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{story.eyebrow}</p><h3 className="mt-3 font-display text-2xl font-medium leading-tight tracking-[-0.035em] text-[#152238]">{story.title}</h3><p className="mt-3 text-sm leading-6 text-slate-500">{story.description}</p><div className="mt-6 flex items-center justify-between"><span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400"><Play size={12} fill="currentColor" /> {story.time} lesen</span><button className="read-button">Entdecken <ExternalLink size={14} /></button></div></div></article>;
}

const pinColors: Record<string, string> = { restaurant: '#ec4b45', sight: '#3272c8', activity: '#55a676' };

function HanslaMap({ places }: { places: HanslaPlace[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || places.length === 0) return;

    const parsedPlaces = places.map(p => ({ ...p, lat: Number(p.lat), lon: Number(p.lon) })).filter(p => !isNaN(p.lat) && !isNaN(p.lon));
    if (parsedPlaces.length === 0) return;

    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

    const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView([parsedPlaces[0].lat, parsedPlaces[0].lon], 12);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    const bounds: [number, number][] = [];
    for (const place of parsedPlaces) {
      const color = pinColors[place.pin_type] || '#ec4b45';
      const icon = L.divIcon({
        className: 'hansla-pin',
        html: `<div class="hansla-pin-marker" style="--pin-color:${color}"><span class="hansla-pin-dot"></span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28],
      });
      const marker = L.marker([place.lat, place.lon], { icon }).addTo(map);
      const typeLabel = categoryLabelMap[place.category] || place.category;
      marker.bindPopup(`<div class="hansla-popup"><strong>${place.name}</strong><span>${typeLabel}</span>${place.address ? `<em>${place.address}</em>` : ''}${place.description ? `<p>${place.description}</p>` : ''}</div>`);
      bounds.push([place.lat, place.lon]);
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds as any, { padding: [40, 40] });
    }

    const fixSize = () => { if (mapRef.current) mapRef.current.invalidateSize(); };
    requestAnimationFrame(() => requestAnimationFrame(fixSize));
    fixSize();
    const t1 = setTimeout(fixSize, 100);
    const t2 = setTimeout(fixSize, 350);
    const t3 = setTimeout(fixSize, 700);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [places]);

  return (
    <div className="hansla-map-wrapper">
      <div className="hansla-map-header">
        <span className="hansla-map-label"><MapPin size={14} /> {places.length} {places.length === 1 ? 'Ort' : 'Orte'} auf der Karte</span>
        <div className="hansla-map-legend">
          <span><i style={{ background: '#ec4b45' }} />Gaststätten</span>
          <span><i style={{ background: '#3272c8' }} />Sehenswürdigkeiten</span>
          <span><i style={{ background: '#55a676' }} />Aktivitäten</span>
        </div>
      </div>
      <div ref={containerRef} className="hansla-map-container" />
    </div>
  );
}

export default App;
