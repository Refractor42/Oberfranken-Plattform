import { useState } from 'react';
import { LogIn, Sparkles, X } from 'lucide-react';

type Props = {
  onClose: () => void;
  onGoogleSignIn: () => void;
};

const AVAILABLE_INTERESTS = [
  'Kultur', 'Natur', 'Wissen', 'Wirtschaft', 'Brauereien', 'Wandern',
  'Architektur', 'Musik', 'Festivals', 'Familie', 'Geschichte',
  'Design', 'Fotografie', 'Kulinarik', 'Radfahren', 'Museen',
];

export function PersonalizingModal({ interests, onToggle, onClose, isLoggedIn }: { interests: string[]; onToggle: (tag: string) => void; onClose: () => void; isLoggedIn: boolean }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="personalizing-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Schließen"><X size={18} /></button>
        <div className="personalizing-icon"><Sparkles size={22} /></div>
        <p className="section-kicker red">Personalizing Mode</p>
        <h2 className="mt-3 font-display text-3xl font-medium tracking-[-0.04em]">Was <span className="text-[#ec4b45]">interessiert</span> dich?</h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">Wähle deine Themen. Wir nutzen das, um dir passendere Inhalte und KI-Antworten zu zeigen. Du kannst deine Auswahl jederzeit ändern oder löschen.</p>
        {!isLoggedIn && <p className="personalizing-guest-note">Deine Auswahl wird lokal in deinem Browser gespeichert. Melde dich an, um sie dauerhaft mit deinem Konto zu verknüpfen.</p>}
        <div className="personalizing-tags">
          {AVAILABLE_INTERESTS.map((tag) => (
            <button
              key={tag}
              className={`personalizing-tag ${interests.includes(tag) ? 'selected' : ''}`}
              onClick={() => onToggle(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
        <div className="personalizing-footer">
          <span className="personalizing-count">{interests.length} ausgewählt</span>
          <button className="primary-button" onClick={onClose}>Fertig</button>
        </div>
      </div>
    </div>
  );
}

export function AuthModal({ onClose, onGoogleSignIn }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Schließen"><X size={18} /></button>
        <div className="auth-modal-icon"><LogIn size={22} /></div>
        <p className="section-kicker red">Anmelden</p>
        <h2 className="mt-3 font-display text-3xl font-medium tracking-[-0.04em]">Deine <span className="text-[#ec4b45]">persönliche</span> Plattform.</h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">Melde dich an, um Termine zu speichern, deine Interessen zu verwalten und personalisierte Inhalte zu erhalten.</p>
        <button className="google-button" onClick={onGoogleSignIn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" fill="#EA4335"/>
          </svg>
          Mit Google anmelden
        </button>
        <p className="auth-note">Wir erhalten nur deinen Namen, deine E-Mail-Adresse und dein Profilbild. Google teilt keine weiteren Daten. Mit der Anmeldung stimmst du der Verarbeitung deiner Daten gemäß DSGVO zu.</p>
      </div>
    </div>
  );
}

export function AccountModal({ profile, interestsCount, savedCount, onClose, onSignOut, onDeleteData }: { profile: { display_name: string | null; avatar_url: string | null }; interestsCount: number; savedCount: number; onClose: () => void; onSignOut: () => void; onDeleteData: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await onDeleteData();
    setDeleting(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="account-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Schließen"><X size={18} /></button>
        <p className="section-kicker red">Konto</p>
        <h2 className="mt-3 font-display text-3xl font-medium tracking-[-0.04em]">Konto-<span className="text-[#ec4b45]">Einstellungen</span></h2>

        <div className="account-profile">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="Profilbild" className="account-avatar" />
          ) : (
            <div className="account-avatar-placeholder">{(profile.display_name || '?')[0]?.toUpperCase()}</div>
          )}
          <div>
            <p className="account-name">{profile.display_name || 'Unbekannt'}</p>
            <p className="account-subtitle">Angemeldet mit Google</p>
          </div>
        </div>

        <div className="account-stats">
          <div className="account-stat"><strong>{interestsCount}</strong><span>Interessen</span></div>
          <div className="account-stat"><strong>{savedCount}</strong><span>Gespeicherte Termine</span></div>
        </div>

        <div className="account-section">
          <h3>Datenschutz (DSGVO)</h3>
          <p>Du hast das Recht auf Auskunft, Berichtigung und Löschung deiner Daten. Alle deine Daten werden ausschließlich auf europäischen Servern (Supabase, EU) verarbeitet.</p>
          {!confirmDelete ? (
            <button className="danger-button" onClick={() => setConfirmDelete(true)}>Alle Daten löschen</button>
          ) : (
            <div className="danger-confirm">
              <p className="danger-warning">Möchtest du wirklich alle deine Daten unwiderruflich löschen? Diese Aktion kann nicht rückgängig gemacht werden.</p>
              <div className="danger-actions">
                <button className="secondary-button" onClick={() => setConfirmDelete(false)} disabled={deleting}>Abbrechen</button>
                <button className="danger-button confirm" onClick={handleDelete} disabled={deleting}>{deleting ? 'Wird gelöscht …' : 'Ja, alles löschen'}</button>
              </div>
            </div>
          )}
        </div>

        <button className="account-signout" onClick={onSignOut}>Abmelden</button>
      </div>
    </div>
  );
}
