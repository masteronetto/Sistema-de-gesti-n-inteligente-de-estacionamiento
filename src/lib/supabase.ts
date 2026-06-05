type AuthSession = {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string | null;
  };
};

type AuthSuccess<T> = {
  data: T;
  error: null;
};

type AuthFailure = {
  data: null;
  error: { message: string };
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const sessionStorageKey = 'sge-duoc.auth.session';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function getSessionFromStorage(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(sessionStorageKey);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.localStorage.removeItem(sessionStorageKey);
    return null;
  }
}

function saveSession(session: AuthSession | null) {
  if (typeof window === 'undefined') return;
  if (session) {
    window.localStorage.setItem(sessionStorageKey, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(sessionStorageKey);
  }
}

async function requestAuth<T>(path: string, init: RequestInit): Promise<AuthSuccess<T> | AuthFailure> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return { data: null, error: { message: 'Supabase no está configurado.' } };
  }

  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      data: null,
      error: { message: payload?.msg || payload?.message || 'Error de autenticación.' },
    };
  }

  return { data: payload as T, error: null };
}

export const supabase = {
  auth: {
    async getSession(): Promise<AuthSuccess<{ session: AuthSession | null }> | AuthFailure> {
      return { data: { session: getSessionFromStorage() }, error: null };
    },
    async signInWithPassword(params: { email: string; password: string }): Promise<AuthSuccess<{ user: AuthSession['user']; session: AuthSession }> | AuthFailure> {
      const result = await requestAuth<{
        access_token: string;
        refresh_token: string;
        user: AuthSession['user'];
      }>(`/auth/v1/token?grant_type=password`, {
        method: 'POST',
        body: JSON.stringify({ email: params.email, password: params.password }),
      });

      if (result.error) {
        return result;
      }

      const session: AuthSession = {
        access_token: result.data.access_token,
        refresh_token: result.data.refresh_token,
        user: result.data.user,
      };
      saveSession(session);

      return { data: { user: session.user, session }, error: null };
    },
    async signOut(): Promise<AuthSuccess<null> | AuthFailure> {
      const session = getSessionFromStorage();
      if (!session) {
        return { data: null, error: null };
      }

      saveSession(null);
      if (supabaseUrl && supabaseAnonKey) {
        await fetch(`${supabaseUrl}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh_token: session.refresh_token }),
        }).catch(() => null);
      }

      return { data: null, error: null };
    },
  },
  from(table: 'profiles') {
    return {
      select(_columns: string) {
        const query: { id?: string } = {};
        return {
          eq(column: 'id', value: string) {
            query[column] = value;
            return {
              async single(): Promise<AuthSuccess<{ email: string | null; role: string; full_name: string | null }> | AuthFailure> {
                const session = getSessionFromStorage();
                if (!session) {
                  return { data: null, error: { message: 'No hay sesión activa.' } };
                }

                if (!supabaseUrl || !supabaseAnonKey) {
                  return { data: null, error: { message: 'Supabase no está configurado.' } };
                }

                const response = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${encodeURIComponent(query.id || '')}&select=email,role,full_name`, {
                  headers: {
                    apikey: supabaseAnonKey,
                    Authorization: `Bearer ${session.access_token}`,
                  },
                });

                const payload = await response.json().catch(() => []);
                if (!response.ok) {
                  return {
                    data: null,
                    error: { message: payload?.message || 'No se pudo leer el perfil.' },
                  };
                }

                const record = Array.isArray(payload) ? payload[0] : payload;
                if (!record) {
                  return { data: null, error: { message: 'No se encontró el perfil del usuario.' } };
                }

                return { data: record, error: null };
              },
            };
          },
        };
      },
    };
  },
};
