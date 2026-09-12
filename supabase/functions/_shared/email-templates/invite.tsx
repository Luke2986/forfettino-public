import * as React from 'https://esm.sh/react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'https://esm.sh/@react-email/components@0.0.22?deps=react@18.3.1'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="it" dir="ltr">
    <Head />
    <Preview>Sei stato invitato su Forfettino</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>Forfettino</Text>
        <Heading style={h1}>Sei stato invitato!</Heading>
        <Text style={text}>
          Sei stato invitato a unirti a{' '}
          <Link href={siteUrl} style={link}>
            <strong>Forfettino</strong>
          </Link>
          , il gestionale per il Regime Forfettario. Clicca il pulsante qui sotto per accettare l'invito e creare il tuo account.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Accetta Invito
        </Button>
        <Text style={footer}>
          Se non ti aspettavi questo invito, puoi ignorare questa email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, system-ui, sans-serif' }
const container = { padding: '32px 28px' }
const brand = {
  fontSize: '20px',
  fontWeight: 'bold' as const,
  color: '#0F766E',
  margin: '0 0 24px',
  letterSpacing: '-0.5px',
}
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#131923',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#5C6170',
  lineHeight: '1.6',
  margin: '0 0 24px',
}
const link = { color: '#0F766E', textDecoration: 'underline' }
const button = {
  backgroundColor: '#0F766E',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600' as const,
  borderRadius: '12px',
  padding: '12px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#94a3b8', margin: '32px 0 0' }
