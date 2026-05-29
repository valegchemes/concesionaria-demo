const { PrismaClient } = require('@prisma/client')
const { listUnreadEmails, getCompanyGmailClient } = require('../lib/email/gmail')
const prisma = new PrismaClient()

async function main() {
  const companyId = 'cmo7j2ida0000z03bbc86buz6'
  console.log('Testing Gmail connection & listing emails for:', companyId)
  
  const client = await getCompanyGmailClient(companyId)
  if (!client) {
    console.log('❌ Gmail client not found!')
    return
  }
  
  const { gmail } = client
  
  // 1. Let's try the strict query
  console.log('--- 1. Strict Query (is:unread in:inbox category:primary) ---')
  const resStrict = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread in:inbox category:primary',
    maxResults: 5
  })
  console.log('Strict Query Messages:', resStrict.data.messages || [])
  
  // 2. Let's try simple unread in inbox query
  console.log('--- 2. Unread Query (is:unread in:inbox) ---')
  const resUnread = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread in:inbox',
    maxResults: 5
  })
  console.log('Unread Query Messages:', resUnread.data.messages || [])

  // 3. Let's list ANY recent message in inbox (to verify emails exist)
  console.log('--- 3. Recent Inbox Messages (in:inbox) ---')
  const resInbox = await gmail.users.messages.list({
    userId: 'me',
    q: 'in:inbox',
    maxResults: 5
  })
  
  const inboxMessages = resInbox.data.messages || []
  console.log('Recent Messages:', inboxMessages)
  
  for (const msg of inboxMessages) {
    const details = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id,
      format: 'minimal'
    })
    console.log(`Msg ID: ${msg.id} | Labels:`, details.data.labelIds)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
