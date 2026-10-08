import PasswordForm from "./password-form";
export default function NewPasswordPage() {
  return <main className="setup-page"><div className="setup-card">
    <h1>Velg ditt eget passord</h1>
    <p className="muted">Bruk minst 8 tegn. Etter en tilbakestilling må du velge et nytt passord før du fortsetter.</p>
    <PasswordForm redirectAfterSave />
  </div></main>;
}
