import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Column,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

export const PORTAL_URL = 'https://www.akcoekano.com/auth'

interface Props {
  full_name?: string | null
  email?: string
  temp_password?: string | null
  role_text?: string | null
  department_name?: string | null
}

const navy = '#0f2542'
const gold = '#b8892b'

const StaffLoginDetails = ({
  full_name,
  email,
  temp_password,
  role_text,
  department_name,
}: Props) => {
  const name = (full_name ?? '').trim() || 'Colleague'
  const roleText = (role_text ?? '').trim() || 'staff'
  const dept = department_name ? ` for the ${department_name} department` : ''

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your AKCOE Staff Portal login details</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading as="h1" style={headerTitle}>
              Aminu Kano College of Education
            </Heading>
            <Text style={headerSub}>Staff Portal Access</Text>
          </Section>

          <Section style={card}>
            <Text style={para}>Dear {name},</Text>
            <Text style={para}>
              Your account on the College Management Portal is ready. You have been assigned the{' '}
              <strong>{roleText}</strong> role{dept}.
            </Text>

            <Section style={detailBox}>
              <Row>
                <Column style={label}>Portal</Column>
                <Column style={value}>
                  <Link href={PORTAL_URL} style={link}>
                    {PORTAL_URL}
                  </Link>
                </Column>
              </Row>
              <Row>
                <Column style={label}>Username</Column>
                <Column style={value}>{email ?? '—'}</Column>
              </Row>
              {temp_password ? (
                <Row>
                  <Column style={label}>Temporary password</Column>
                  <Column style={mono}>{temp_password}</Column>
                </Row>
              ) : null}
            </Section>

            <Text style={para}>
              Sign in with the details above. On your first login you will be prompted to set your
              own permanent password. If you are not ready to do that yet, you may choose “Skip for
              now” and set it later from your profile.
            </Text>

            <Button href={PORTAL_URL} style={button}>
              Sign in to the portal
            </Button>

            <Hr style={hr} />
            <Text style={fine}>
              These credentials are personal to you. Please do not share this email or your password
              with anyone.
            </Text>
          </Section>

          <Text style={footer}>Aminu Kano College of Education — Kano, Nigeria</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: StaffLoginDetails,
  subject: 'Your AKCOE Staff Portal login details',
  displayName: 'Staff portal login details',
  previewData: {
    full_name: 'Musbahu Mukhtar',
    email: 'staff@example.com',
    temp_password: 'Mukhtar@2026',
    role_text: 'hod and lecturer',
    department_name: 'Hausa',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif', color: '#0f172a' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px' }
const header = { backgroundColor: navy, borderTop: `4px solid ${gold}`, padding: '20px 24px' }
const headerTitle = { color: '#ffffff', fontSize: '18px', fontWeight: 700, margin: '0' }
const headerSub = { color: '#dbe2ea', fontSize: '13px', margin: '4px 0 0' }
const card = { border: '1px solid #e2e8f0', borderTop: '0', padding: '24px' }
const para = { margin: '0 0 16px', lineHeight: '1.6', fontSize: '15px' }
const detailBox = { backgroundColor: '#f8fafc', padding: '12px 16px', margin: '0 0 16px' }
const label = { color: '#475569', fontSize: '13px', padding: '6px 0', width: '40%' }
const value = { color: navy, fontSize: '14px', fontWeight: 700, padding: '6px 0' }
const mono = { ...value, fontFamily: 'monospace' }
const link = { color: navy, fontWeight: 700, textDecoration: 'underline' }
const button = {
  backgroundColor: navy,
  color: '#ffffff',
  padding: '12px 20px',
  borderRadius: '6px',
  fontWeight: 700,
  fontSize: '14px',
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#e2e8f0', margin: '20px 0 12px' }
const fine = { margin: '0', fontSize: '13px', color: '#64748b', lineHeight: '1.6' }
const footer = { fontSize: '12px', color: '#94a3b8', textAlign: 'center' as const, margin: '16px 0 0' }
