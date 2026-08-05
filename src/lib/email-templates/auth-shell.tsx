import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as s from './brand'

interface ShellProps {
  preview: string
  heading: string
  children: React.ReactNode
  note?: string
}

export const AuthShell = ({ preview, heading, children, note }: ShellProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.header}>
          <Heading as="h1" style={s.headerTitle}>
            Aminu Kano College of Education
          </Heading>
          <Text style={s.headerSub}>College Management Portal</Text>
        </Section>
        <Section style={s.card}>
          <Heading as="h2" style={s.h1}>
            {heading}
          </Heading>
          {children}
          {note ? (
            <>
              <Hr style={s.hr} />
              <Text style={s.fine}>{note}</Text>
            </>
          ) : null}
        </Section>
        <Text style={s.footer}>Aminu Kano College of Education — Kano, Nigeria</Text>
      </Container>
    </Body>
  </Html>
)

export default AuthShell
