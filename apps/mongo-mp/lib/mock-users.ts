export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'user' | 'admin';
  createdAt: string;
  lastLogin: string;
}

export const mockUsers: User[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    avatar: '/placeholder.svg?height=100&width=100',
    role: 'user',
    createdAt: '2023-01-15T10:00:00Z',
    lastLogin: '2023-06-20T14:30:00Z',
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    avatar: '/placeholder.svg?height=100&width=100',
    role: 'admin',
    createdAt: '2023-02-20T09:00:00Z',
    lastLogin: '2023-06-21T11:45:00Z',
  },
  {
    id: '3',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    avatar: '/placeholder.svg?height=100&width=100',
    role: 'user',
    createdAt: '2023-03-10T11:30:00Z',
    lastLogin: '2023-06-19T16:20:00Z',
  },
];

