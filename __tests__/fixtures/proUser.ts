import type { User } from '../../lib/api';

export const proUser: Partial<User> = {
  id: 42,
  first_name: 'Sophie',
  last_name: 'Martin',
  email: 'sophie@test.fr',
  role: 'pro',
  is_admin: false,
  pro_status: 'active',
  profile_photo: null,
  activity_name: 'Studio Sophie',
  city: 'Paris',
  bio: 'Expert ongulaire',
  avg_rating: 4.8,
  clients_count: 120,
};
