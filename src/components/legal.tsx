'use client';
import Link from 'next/link';
import { Fragment } from 'react';
import { Brand } from '@/components/brand';
import { useLocale, LanguageSelector } from '@/components/locale-provider';
import { useMarket } from '@/components/market-profile';
import { legalLinks, signInNotice, type Block, type Inline, type LegalDocument, type LegalDocumentName, type LegalLinkKey } from '@/lib/legal.mjs';

function useLinkLabel() {
  const { t } = useLocale();
  return (key: LegalLinkKey) => {
    switch (key) {
      case 'privacy': return t('Privacy policy');
      case 'terms': return t('Terms of use');
      case 'offer': return t('Public offer');
      case 'delete': return t('Delete account');
      case 'support': return t('Support');
      case 'source': return t('Source code');
      case 'vk': return t('VK community');
      case 'telegram': return 'Telegram';
    }
  };
}

/**
 * The market's legal and channel links (footer): Privacy, Terms, the offer (with
 * Supporter), account deletion, Support, Source and the community. Renders nothing in a market
 * without a legal table (global, cn), so their footers stay as they were.
 */
export function LegalLinks({ className = '' }: { className?: string }) {
  const { t } = useLocale();
  const { legal, features } = useMarket();
  const label = useLinkLabel();
  const links = legalLinks(legal, features);
  if (!links.length) return null;
  return <nav className={('legal-links ' + className).trim()} aria-label={t('Legal information and support')} data-legal-links>
    {links.map(link => link.external
      ? <a key={link.key} href={link.href} data-legal-link={link.key} rel="noreferrer noopener" target={link.href.startsWith('mailto:') ? undefined : '_blank'}>{label(link.key)}{link.href.startsWith('mailto:') ? '' : ' ↗'}</a>
      : <Link key={link.key} href={link.href} data-legal-link={link.key}>{label(link.key)}</Link>)}
  </nav>;
}

/** `{terms}` and `{privacy}` in a translated sentence become links. */
function withLinks(template: string, links: Record<string, React.ReactNode>) {
  return template.split(/(\{terms\}|\{privacy\})/).map((part, index) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1];
    return <Fragment key={index}>{key && links[key] !== undefined ? links[key] : part}</Fragment>;
  });
}

/**
 * The notice next to sign-in (login card, `/connect`): signing in accepts the user
 * agreement and the processing described in the privacy policy, both linked.
 * Renders nothing without both documents (global, cn).
 */
export function SignInLegalNotice() {
  const { t } = useLocale();
  const { legal } = useMarket();
  const notice = signInNotice(legal);
  if (!notice) return null;
  return <p className="legal-notice" data-legal-notice data-legal-version={notice.version ?? undefined}>
    {withLinks(t('By signing in, you accept {terms} and agree to the processing of your personal data under {privacy}.'), {
      terms: <Link href={notice.terms} data-legal-link="terms">{t('the Terms of Use')}</Link>,
      privacy: <Link href={notice.privacy} data-legal-link="privacy">{t('the Privacy Policy')}</Link>,
    })}
  </p>;
}

function InlineText({ parts }: { parts: Inline[] }) {
  return <>{parts.map((part, index) => {
    switch (part.type) {
      case 'text': return <Fragment key={index}>{part.value}</Fragment>;
      case 'code': return <code key={index}>{part.value}</code>;
      case 'strong': return <strong key={index}><InlineText parts={part.children} /></strong>;
      case 'placeholder': return <mark key={index} className="legal-placeholder" data-legal-placeholder>{part.value}</mark>;
      case 'link': return part.href.startsWith('/')
        ? <Link key={index} href={part.href}><InlineText parts={part.children} /></Link>
        : <a key={index} href={part.href} rel="noreferrer noopener"><InlineText parts={part.children} /></a>;
    }
  })}</>;
}

function DocumentBlock({ block }: { block: Block }) {
  switch (block.type) {
    case 'h2': return <h2 id={block.id}><InlineText parts={block.inline} /></h2>;
    case 'h3': return <h3 id={block.id}><InlineText parts={block.inline} /></h3>;
    case 'p': return <p><InlineText parts={block.inline} /></p>;
    case 'note': return <p className="legal-note" role="note"><InlineText parts={block.inline} /></p>;
    case 'ul': return <ul>{block.items.map((item, index) => <li key={index}><InlineText parts={item} /></li>)}</ul>;
    case 'ol': return <ol start={block.start}>{block.items.map((item, index) => <li key={index}><InlineText parts={item} /></li>)}</ol>;
    case 'table': return <div className="legal-table"><table>
      <thead><tr>{block.head.map((cell, index) => <th key={index} scope="col"><InlineText parts={cell} /></th>)}</tr></thead>
      <tbody>{block.rows.map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={column}><InlineText parts={cell} /></td>)}</tr>)}</tbody>
    </table></div>;
  }
}

// The documents are Russian (LR-04): their banner and edition line are part of the
// document and stay Russian whatever the page language; other languages get a note.
const DRAFT_BANNER = 'Проект — требует проверки юристом.';
const DRAFT_DETAIL = 'Это черновик документа, а не действующая редакция: оператор заменит его текстом, согласованным с юристом, до публичного запуска.';

/** A legal document page: `/privacy`, `/terms`, `/offer` (readable without sign-in). */
export function LegalDocumentView({ name, document, siteUrl }: { name: LegalDocumentName; document: LegalDocument; siteUrl: string }) {
  const { t, locale } = useLocale();
  const { meta, blocks } = document;
  const effective = meta.effective ? new Date(meta.effective + 'T00:00:00Z').toLocaleDateString('ru-RU', { timeZone: 'UTC', dateStyle: 'long' }) : null;
  return <div className="legal-page">
    <header className="legal-header">
      <Link href="/" className="legal-brand" aria-label={t('OMOBA player portal')}><Brand section={t('Player portal')} /></Link>
      <div className="grow" />
      <LanguageSelector />
    </header>
    <main className="legal-main">
      <article lang="ru" className="legal-document" data-legal-document={name} data-legal-version={meta.version} data-legal-status={meta.status}>
        {meta.status === 'draft' ? <div className="notice legal-draft" role="note" data-legal-draft><strong>{DRAFT_BANNER}</strong> {DRAFT_DETAIL}</div> : null}
        {locale !== 'ru' ? <p className="notice" lang={locale === 'zh' ? 'zh-CN' : locale}>{t('This document is available in Russian only.')}</p> : null}
        <h1>{meta.title}</h1>
        <p className="legal-meta" data-legal-meta>
          Редакция <strong>{meta.version}</strong> · {effective ? <>действует с {effective}</> : <>не вступила в силу</>}
          {meta.review ? <> · {meta.review}</> : null}
        </p>
        {blocks.map((block, index) => <DocumentBlock key={index} block={block} />)}
      </article>
    </main>
    <footer className="legal-page-footer"><a href={siteUrl}>OMOBA · {t('Website')} ↗</a><LegalLinks /></footer>
  </div>;
}
