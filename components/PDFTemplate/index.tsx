import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from '@react-pdf/renderer'
import path from 'path'

Font.register({
  family: 'Heebo',
  fonts: [
    { src: path.join(process.cwd(), 'public/fonts/Heebo-Regular.ttf'), fontWeight: 400 },
    { src: path.join(process.cwd(), 'public/fonts/Heebo-Bold.ttf'), fontWeight: 700 },
  ],
})

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Heebo',
    backgroundColor: '#ffffff',
    padding: 40,
    fontSize: 10,
  },
  // Header
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '2px solid #1d4ed8',
    paddingBottom: 12,
    marginBottom: 20,
  },
  agencyName: {
    fontSize: 16,
    fontWeight: 700,
    color: '#1d4ed8',
  },
  logo: {
    width: 75,
    height: 75,
    objectFit: 'contain',
  },
  // Title
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: '#111827',
    textAlign: 'right',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'right',
    marginBottom: 20,
  },
  // Sections
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#1d4ed8',
    textAlign: 'right',
    borderBottom: '1px solid #dbeafe',
    paddingBottom: 4,
    marginBottom: 8,
  },
  // Text
  text: {
    fontSize: 10,
    color: '#374151',
    textAlign: 'right',
    lineHeight: 1.5,
  },
  boldText: {
    fontSize: 10,
    fontWeight: 700,
    color: '#111827',
    textAlign: 'right',
  },
  // List item
  listItem: {
    flexDirection: 'row-reverse',
    gap: 6,
    marginBottom: 4,
    textAlign: 'right',
  },
  bullet: {
    fontSize: 10,
    color: '#1d4ed8',
  },
  // Products table
  tableRow: {
    flexDirection: 'row-reverse',
    borderBottom: '1px solid #f3f4f6',
    paddingVertical: 4,
  },
  tableCell: {
    flex: 1,
    fontSize: 9,
    color: '#374151',
    textAlign: 'right',
  },
  tableHeader: {
    flex: 1,
    fontSize: 9,
    fontWeight: 700,
    color: '#111827',
    textAlign: 'right',
  },
  // Action items
  actionItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderRadius: 4,
    padding: 6,
    marginBottom: 4,
  },
  badge: {
    fontSize: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    color: '#ffffff',
  },
  // Tax box
  taxBox: {
    backgroundColor: '#fffbeb',
    borderRight: '3px solid #f59e0b',
    padding: 8,
    marginBottom: 4,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: '1px solid #e5e7eb',
    paddingTop: 8,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: '#9ca3af',
  },
})

type SummaryContent = {
  client: { name: string; phone: string | null; meeting_date: string }
  topics_discussed: string[]
  financial_profile: {
    pension: string | null
    free_capital: string | null
    existing_products: Array<{
      type: string; company: string | null
      monthly: number | null; total: number | null; coverage: number | null
    }>
  }
  recommendations: string[]
  tax_notes: string[]
  action_items: Array<{ task: string; due_date: string; owner: 'agent' | 'client' }>
}

interface Props {
  content: SummaryContent
  agencyName: string
  agentName: string
  logoUrl?: string | null
}

export function SummaryPDF({ content, agencyName, agentName, logoUrl }: Props) {
  const { client, topics_discussed, financial_profile, recommendations, tax_notes, action_items } = content

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.agencyName}>{agencyName}</Text>
            <Text style={{ fontSize: 9, color: '#6b7280', textAlign: 'right' }}>סיכום פגישה פיננסית</Text>
          </View>
          {logoUrl && <Image style={styles.logo} src={logoUrl} />}
        </View>

        {/* Title */}
        <Text style={styles.title}>סיכום פגישה — {client.name}</Text>
        <Text style={styles.subtitle}>
          תאריך: {client.meeting_date}
          {client.phone ? `  |  טלפון: ${client.phone}` : ''}
          {'  |  סוכן: '}{agentName}
        </Text>

        {/* Topics */}
        {topics_discussed.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>נושאים שנדונו</Text>
            <Text style={styles.text}>{topics_discussed.join(' • ')}</Text>
          </View>
        )}

        {/* Financial products */}
        {financial_profile.existing_products.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>מוצרים פיננסיים קיימים</Text>
            {/* Table header */}
            <View style={styles.tableRow}>
              <Text style={styles.tableHeader}>סוג מוצר</Text>
              <Text style={styles.tableHeader}>חברה</Text>
              <Text style={styles.tableHeader}>הפקדה חודשית</Text>
              <Text style={styles.tableHeader}>סה״כ חיסכון</Text>
            </View>
            {financial_profile.existing_products.map((p, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.tableCell}>{p.type}</Text>
                <Text style={styles.tableCell}>{p.company ?? '—'}</Text>
                <Text style={styles.tableCell}>{p.monthly != null ? `${p.monthly.toLocaleString()} ₪` : '—'}</Text>
                <Text style={styles.tableCell}>{p.total != null ? `${p.total.toLocaleString()} ₪` : p.coverage != null ? `כיסוי ${p.coverage.toLocaleString()} ₪` : '—'}</Text>
              </View>
            ))}
            {financial_profile.pension && (
              <Text style={{ ...styles.text, marginTop: 6 }}>פנסיה: {financial_profile.pension}</Text>
            )}
            {financial_profile.free_capital && (
              <Text style={styles.text}>כסף פנוי: {financial_profile.free_capital}</Text>
            )}
          </View>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>המלצות הסוכן</Text>
            {recommendations.map((r, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={styles.bullet}>◀</Text>
                <Text style={{ ...styles.text, flex: 1 }}>{r}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Tax notes */}
        {tax_notes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>הערות מס</Text>
            {tax_notes.map((t, i) => (
              <View key={i} style={styles.taxBox}>
                <Text style={styles.text}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Action items */}
        {action_items.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>משימות וצעדי המשך</Text>
            {action_items.map((a, i) => (
              <View key={i} style={styles.actionItem}>
                <Text style={{ ...styles.text, flex: 1 }}>{a.task}</Text>
                <View style={{ flexDirection: 'row-reverse', gap: 8, alignItems: 'center' }}>
                  <Text style={{ ...styles.badge, backgroundColor: a.owner === 'agent' ? '#1d4ed8' : '#16a34a' }}>
                    {a.owner === 'agent' ? 'סוכן' : 'לקוח'}
                  </Text>
                  <Text style={styles.footerText}>{a.due_date}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{agencyName} | מסמך זה הופק אוטומטית</Text>
          <Text style={styles.footerText}>
            {new Date().toLocaleDateString('he-IL')}
          </Text>
        </View>

      </Page>
    </Document>
  )
}
