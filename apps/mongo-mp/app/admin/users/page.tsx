import { Metadata } from 'next'
import { UserManagement } from '@/components/user-management'

export const metadata: Metadata = {
  title: 'User Management - MongoMP Admin',
  description: 'Manage users of the MongoMP music streaming platform',
}

export default function UsersPage() {
  return (
    <div className="container mx-auto py-10">
      <UserManagement />
    </div>
  )
}
