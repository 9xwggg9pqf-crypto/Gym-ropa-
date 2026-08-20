"use client";

import { useState, type FormEvent } from "react";
import { siteConfig } from "@/data/site";

/**
 * Captura solo el email. No hay backend todavía: al enviar, muestra un
 * mensaje de confirmación en pantalla. Conecta esto a tu proveedor de
 * email (Mailchimp, Klaviyo, etc.) cuando esté listo.
 */
export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) return;
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <p className="font-display text-lg tracking-wide text-red uppercase">
        {siteConfig.newsletter.successMessage}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
      <input
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder={siteConfig.newsletter.placeholder}
        aria-label="Correo electrónico"
        className="w-full border border-white/20 bg-surface px-5 py-3.5 text-foreground placeholder:text-muted focus:border-red focus:outline-none"
      />
      <button
        type="submit"
        className="shrink-0 bg-red px-6 py-3.5 font-display tracking-wider text-white uppercase transition-colors duration-300 hover:bg-red-light"
      >
        {siteConfig.newsletter.buttonLabel}
      </button>
    </form>
  );
}
