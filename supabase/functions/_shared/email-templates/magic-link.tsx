import * as React from 'https://esm.sh/react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'https://esm.sh/@react-email/components@0.0.22?deps=react@18.3.1'

interface MagicLinkEmailProps {
  siteName?: string
  token: string
}

export const MagicLinkEmail = ({
  siteName = 'Forfettino',
  token,
}: MagicLinkEmailProps) => (
  <Html lang="it" dir="ltr">
    <Head />
    <Preview>Il tuo codice di accesso Forfettino</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>Forfettino</Text>
        <Heading style={h1}>Il tuo codice di accesso Forfettino</Heading>
        <Text style={text}>
          Inserisci questo codice per accedere al tuo account:
        </Text>
        <Text style={otpBox}>{token}</Text>
        <Text style={text}>Il codice scade tra 10 minuti.</Text>
        <Text style={footer}>
          Se non hai richiesto questo codice, ignora questa email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

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
const otpBox = {
  fontSize: '32px',
  fontWeight: 'bold' as const,
  letterSpacing: '8px',
  textAlign: 'center' as const,
  padding: '16px',
  background: '#f1f5f9',
  borderRadius: '8px',
  margin: '0 0 24px',
  color: '#131923',
}
const footer = { fontSize: '12px', color: '#94a3b8', margin: '32px 0 0' }
