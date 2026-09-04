const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export interface User {
  id: number;
  email: string;
  role: 'admin' | 'parent';
  name: string;
}

export interface Child {
  id: number;
  parent_id: number;
  name: string;
  date_of_birth: string;
  class_group: string;
  parent_name?: string;
  parent_email?: string;
  initials?: string;
  color?: string;
  attendance?: string;
}

export interface Assessment {
  id: number;
  child_id: number;
  date: string;
  domain: 'practical_life' | 'sensorial' | 'language' | 'math' | 'islamic_studies';
  score: number;
  notes: string | null;
  child_name?: string;
  class_group?: string;
}

export interface Photo {
  id: number;
  child_id: number;
  photo_url: string;
  caption: string | null;
  uploaded_at?: string;
  child_name?: string;
}

export interface PlayKit {
  id: number;
  title: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  category: string;
  color: string;
  icon: string;
}

export interface OrderItem {
  id?: number;
  order_id?: number;
  kit_id: number;
  quantity: number;
  price: number;
  kit_title?: string;
  kit_color?: string;
  kit_icon?: string;
}

export interface Order {
  id: number;
  parent_id: number;
  total_amount: number;
  payment_status: 'pending' | 'paid' | 'failed';
  shipping_status: 'New' | 'Packed' | 'Shipped';
  created_at: string;
  parent_name?: string;
  parent_email?: string;
  items?: OrderItem[];
}

export interface PopUpClass {
  id: number;
  title: string;
  date_day: string;
  date_month: string;
  location: string;
  time: string;
  tag: string | null;
}

export interface AdminMetrics {
  totalEnrolled: number;
  weeklyRevenue: number;
  ordersToShip: number;
  revenueRhythm: number[];
  todayRhythm: { time: string; title: string; sub: string }[];
  kitStock: { id: number; title: string; stock: number }[];
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('rumi_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers
  });

  if (!res.ok) {
    let errMsg = `Request failed with status ${res.status}`;
    try {
      const errData = await res.json();
      if (errData.error) errMsg = errData.error;
    } catch {}
    throw new Error(errMsg);
  }

  return res.json();
}

export const api = {
  auth: {
    login: (credentials: { email: string; password: string }) =>
      request<{ user: User; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
      }),
    me: () => request<{ user: User }>('/auth/me'),
    logout: () =>
      request<{ message: string }>('/auth/logout', { method: 'POST' }),
    register: (data: { email: string; password: string; name: string; role?: string }) =>
      request<{ user: User; token: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data)
      })
  },
  children: {
    list: () => request<{ children: Child[] }>('/children'),
    get: (id: number) => request<{ child: Child }>(`/children/${id}`),
    create: (data: Partial<Child>) =>
      request<{ child: Child }>('/children', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    update: (id: number, data: Partial<Child>) =>
      request<{ child: Child }>(`/children/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      }),
    delete: (id: number) =>
      request<{ message: string }>(`/children/${id}`, { method: 'DELETE' })
  },
  assessments: {
    list: (childId?: number) => {
      const query = childId ? `?child_id=${childId}` : '';
      return request<{ assessments: Assessment[] }>(`/assessments${query}`);
    },
    create: (data: { child_id: number; domain: string; score: number; notes?: string; date?: string }) =>
      request<{ assessment: Assessment }>('/assessments', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    delete: (id: number) =>
      request<{ message: string }>(`/assessments/${id}`, { method: 'DELETE' })
  },
  photos: {
    list: (childId?: number) => {
      const query = childId ? `?child_id=${childId}` : '';
      return request<{ photos: Photo[] }>(`/photos${query}`);
    },
    uploadBatch: (data: { child_ids: number[]; photo_urls: string[]; caption?: string }) =>
      request<{ photos: Photo[]; count: number }>('/photos', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    delete: (id: number) =>
      request<{ message: string }>(`/photos/${id}`, { method: 'DELETE' })
  },
  playKits: {
    list: () => request<{ play_kits: PlayKit[] }>('/play-kits'),
    get: (id: number) => request<{ play_kit: PlayKit }>(`/play-kits/${id}`),
    create: (data: Partial<PlayKit>) =>
      request<{ play_kit: PlayKit }>('/play-kits', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    updateStock: (id: number, stock: number) =>
      request<{ play_kit: PlayKit }>(`/play-kits/${id}/stock`, {
        method: 'PATCH',
        body: JSON.stringify({ stock })
      }),
    delete: (id: number) =>
      request<{ message: string }>(`/play-kits/${id}`, { method: 'DELETE' })
  },
  orders: {
    list: () => request<{ orders: Order[] }>('/orders'),
    create: (data: { items: { kit_id: number; quantity: number; price: number }[]; total_amount: number }) =>
      request<{ order: Order }>('/orders', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    updateStatus: (id: number, status: { shipping_status?: string; payment_status?: string }) =>
      request<{ order: Order }>(`/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(status)
      })
  },
  classes: {
    list: () => request<{ classes: PopUpClass[] }>('/classes'),
    create: (data: Partial<PopUpClass>) =>
      request<{ class: PopUpClass }>('/classes', {
        method: 'POST',
        body: JSON.stringify(data)
      })
  },
  metrics: {
    get: () => request<{ metrics: AdminMetrics }>('/admin/metrics')
  }
};
