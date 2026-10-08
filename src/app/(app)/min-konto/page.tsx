import { getContext } from "@/lib/auth";
import { PageHeading } from "@/components/ui";
import PasswordForm from "@/app/nytt-passord/password-form";

export default async function MyAccountPage() {
  const { name } = await getContext();
  return <>
    <PageHeading eyebrow="Min konto" title="Min konto" description={`Innlogget som ${name}.`} />
    <section className="panel" style={{ maxWidth: 560, marginTop: 0 }}>
      <h2>Endre passord</h2>
      <p className="muted">Velg et nytt passord på minst 8 tegn. Vi anbefaler et unikt passord som ikke bygger på telefonnummeret ditt.</p>
      <PasswordForm />
    </section>
  </>;
}
