'use client';
import Link from 'next/link';
import { Fragment } from 'react';
import { Brand } from '@/components/brand';
import { LegalLinks } from '@/components/legal';
import { useLocale, LanguageSelector } from '@/components/locale-provider';

/** `{email}` and `{privacy}` in a translated sentence become their elements. */
function fill(template: string, parts: Record<string, React.ReactNode>) {
  return template.split(/(\{email\}|\{privacy\})/).map((part, index) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    return <Fragment key={index}>{key && parts[key] !== undefined ? parts[key] : part}</Fragment>;
  });
}

/**
 * `/delete`: how to have an account deleted (O-15), public and without sign-in, laid out
 * like the legal documents. It describes the operator's manual e-mail procedure (the
 * privacy policy's requests section) until deletion ships in the game and the portal
 * (LR-42, LR-69). The address comes from the market's legal table (`deletionPage`); while
 * the owner has not provided it (LR-21) a highlighted placeholder stands in its place.
 */
export function DeletionView({ page, siteUrl }: { page: { email: string | null; privacy: string | null }; siteUrl: string }) {
  const { t } = useLocale();
  const email = page.email
    ? <a href={'mailto:' + page.email} data-deletion-contact="email">{page.email}</a>
    : <mark className="legal-placeholder" data-deletion-contact="placeholder">{t('the support e-mail (published before launch)')}</mark>;
  return <div className="legal-page">
    <header className="legal-header">
      <Link href="/" className="legal-brand" aria-label={t('OMOBA player portal')}><Brand section={t('Player portal')} /></Link>
      <div className="grow" />
      <LanguageSelector />
    </header>
    <main className="legal-main">
      <article className="legal-document" data-deletion-page>
        <h1>{t('Delete your OMOBA account')}</h1>
        <p>{t('You can ask us to delete your OMOBA account and the personal data linked to it. You do not need to sign in to read this page or to send the request.')}</p>
        <p className="legal-note" role="note">{t('Until deletion is available in the game and on this site, the operator deletes accounts by hand on request.')}</p>
        <h2>{t('How to request deletion')}</h2>
        <ol data-deletion-steps>
          <li>{fill(t('Write to {email} with the subject “Personal data”.'), { email })}</li>
          <li>{t('Give your nickname with its tag (for example Nickname#1234) and say that you want the account deleted.')}</li>
          <li>{t('We check that the request comes from the account owner, for example by asking you to confirm a sign-in in the game or on this site.')}</li>
        </ol>
        <h2>{t('What happens next')}</h2>
        <ul>
          <li data-deletion-key-refused>{t('As soon as the request is confirmed, the account’s device keys are refused: the game can no longer sign in to the account.')}</li>
          <li data-deletion-deadline>{t('Erasure is completed within 30 days: sign-in sessions and linked accounts are revoked; friends, settings, recovery codes, class builds and feedback texts are deleted; your nickname is replaced with “Deleted player” in the profile and in match history.')}</li>
          <li>{t('Match results stay in anonymised form so that other players’ ratings do not change.')}</li>
        </ul>
        {page.privacy ? <p>{fill(t('The procedure and how long each kind of data is kept are set out in {privacy}.'), {
          privacy: <Link href={page.privacy} data-legal-link="privacy">{t('the Privacy Policy')}</Link>,
        })}</p> : null}
      </article>
    </main>
    <footer className="legal-page-footer"><a href={siteUrl}>OMOBA · {t('Website')} ↗</a><LegalLinks /></footer>
  </div>;
}
