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

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="it" dir="ltr">
    <Head />
    <Preview>Il tuo codice di verifica Forfettino</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>Forfettino</Text>
        <Heading style={h1}>Il tuo codice di verifica</Heading>
        <Text style={text}>Inserisci questo codice per confermare la tua identità:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Il codice scadrà a breve. Se non hai richiesto questo codice, puoi ignorare questa email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

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
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: '#0F766E',
  textAlign: 'center' as const,
  letterSpacing: '6px',
  padding: '16px',
  backgroundColor: '#f1f5f9',
  borderRadius: '12px',
  margin: '0 0 28px',
}
const footer = { fontSize: '12px', color: '#94a3b8', margin: '32px 0 0' }
