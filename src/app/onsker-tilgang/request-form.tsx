"use client";

import { useState } from "react";

const adminEmail = "ole.kristiansen@coop.no";

export default function AccessRequestForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cooperative, setCooperative] = useState("");
  const [store, setStore] = useState("");
  const [opened, setOpened] = useState(false);

  function request(event: React.FormEvent) {
    event.preventDefault();
    const subject = encodeURIComponent("Ønsker tilgang til Driftssjekk");
    const body = encodeURIComponent(`Hei, jeg ønsker tilgang til Driftssjekk.\n\nNavn: ${name.trim()}\nE-post: ${email.trim()}\nSamvirkelag: ${cooperative.trim()}\nVarehus: ${store.trim()}\n\nVennligst vurder rolle og tilordning.`);
    window.location.href = `mailto:${adminEmail}?subject=${subject}&body=${body}`;
    setOpened(true);
  }

  return <form className="form-stack" onSubmit={request}>
    <label>Navn<input required minLength={2} maxLength={150} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>
    <label>Jobb-e-post<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
    <label>Samvirkelag<input required maxLength={150} value={cooperative} onChange={(event) => setCooperative(event.target.value)} /></label>
    <label>Varehus<input required maxLength={150} value={store} onChange={(event) => setStore(event.target.value)} /></label>
    <button className="button primary" type="submit">Åpne e-postforespørsel</button>
    {opened && <p role="status" className="feedback">Send e-posten i e-postprogrammet ditt for å fullføre forespørselen.</p>}
  </form>;
}
